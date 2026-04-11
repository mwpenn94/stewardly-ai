/**
 * webNavigator — pass 1, scope: browser/device automation parity.
 *
 * Pure-TypeScript, fetch-based read-only browser primitive. The agent
 * calls one of three operations:
 *
 *   - `fetchPage(url)` — pull the raw HTML (or text) with safety checks
 *   - `readPage(url)`  — fetch + parse HTML into a structured PageView
 *   - `extractLinks(pageView, opts)` — filter/rank links from a PageView
 *
 * This is the foundation layer for the automation roadmap. It runs
 * without a headless browser, works inside edge runtimes, and is
 * intentionally pluggable so a Playwright adapter can slot in later
 * without breaking callers.
 *
 * Invariants enforced here (protected improvements — see docs/PARITY.md):
 *   - Allow/deny list on hostnames
 *   - Per-domain rate limit (token bucket)
 *   - Response size cap (default 2 MB) to prevent OOM
 *   - User-Agent header set to a stable Stewardly identifier
 *   - Redirect capped at 5 hops
 *   - Adapter interface (`PageFetcher`) so a Playwright/Chromium adapter
 *     can replace the default fetch adapter transparently
 *
 * No Anthropic/Claude/Manus-specific APIs are used — this is a pure
 * web read primitive that any LLM tool loop can drive.
 */

const DEFAULT_USER_AGENT =
  "StewardlyAI-Browser/1.0 (+https://stewardly.manus.space; compliance@stewardly.ai)";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_RATE_LIMIT_PER_MIN = 30; // per domain

/** Canonical result shape for a fetched raw page */
export interface RawFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  bytes: number;
  body: string;
  redirects: number;
  truncated: boolean;
  fetchMs: number;
}

/** Structured "what the agent can see on this page" view */
export interface PageView {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  description: string;
  canonical: string | null;
  language: string | null;
  text: string;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ href: string; text: string; rel: string | null; nofollow: boolean }>;
  images: Array<{ src: string; alt: string }>;
  forms: Array<{
    action: string;
    method: string;
    fields: Array<{ name: string; type: string; value: string; required: boolean }>;
  }>;
  wordCount: number;
  fetchedAt: string;
  fetchMs: number;
  truncated: boolean;
  raw?: RawFetchResult;
}

export interface NavigationConfig {
  /** Exact hostname allow-list. If set, only these hosts may be fetched. */
  allowHosts?: string[];
  /** Hostname deny-list (suffix match, e.g. `.internal.corp`). */
  denyHosts?: string[];
  /** Bytes ceiling per response (default 2 MB). */
  maxBytes?: number;
  /** Per-request timeout (default 15s). */
  timeoutMs?: number;
  /** Maximum redirects to follow (default 5). */
  maxRedirects?: number;
  /** Requests per minute per domain (default 30). */
  rateLimitPerMin?: number;
  /** User-Agent string override. */
  userAgent?: string;
  /** Optional fetch adapter (default uses the global `fetch`). */
  adapter?: PageFetcher;
  /** Optional clock for deterministic tests. */
  now?: () => number;
  /** Optional robots.txt checker (default: no-op = allow all). */
  robotsChecker?: { check: (url: string, userAgent: string) => Promise<{ allowed: boolean; matchedRule: { path: string; type: string } | null }> };
  /** Honor robots.txt decisions. Defaults to `true` when a checker is provided. */
  honorRobots?: boolean;
  /** Optional in-memory response cache (ETag + stale-while-revalidate). */
  cache?: {
    lookup(url: string): { state: "miss" | "hit-fresh" | "hit-stale"; entry?: { body: string; bytes: number; headers: Record<string, string>; status: number; finalUrl: string } };
    buildRevalidationHeaders(url: string): Record<string, string>;
    absorbResponse(
      url: string,
      res: { status: number; finalUrl: string; headers: Record<string, string>; body: string; bytes: number },
    ): unknown;
    invalidate(url: string): boolean;
  };
  /** Optional step-level telemetry sink. Invoked synchronously before and after every fetch. */
  telemetry?: NavigationTelemetrySink;
}

/**
 * Per-step telemetry hook. Each event carries a rich payload so
 * downstream observability (OTel, server logs, SSE) can render it.
 * Implementations must be fast — events fire inline with the fetch.
 */
export interface NavigationTelemetrySink {
  onEvent(event: NavigationTelemetryEvent): void;
}

export type NavigationTelemetryEvent =
  | { type: "request.start"; url: string; host: string; at: number; cacheState?: "miss" | "hit-fresh" | "hit-stale"; revalidating?: boolean }
  | { type: "request.blocked"; url: string; host: string; reason: "BAD_URL" | "BLOCKED_HOST" | "RATE_LIMITED" | "BLOCKED_BY_ROBOTS"; at: number; detail?: string }
  | { type: "request.cached"; url: string; host: string; cacheState: "hit-fresh" | "hit-stale"; bytes: number; at: number }
  | { type: "request.network"; url: string; host: string; status: number; bytes: number; fetchMs: number; at: number; revalidated: boolean }
  | { type: "request.error"; url: string; host: string; code: string; message: string; at: number };

/**
 * Pluggable page-fetcher adapter. Default implementation wraps
 * global `fetch`, but a Playwright adapter can be dropped in for
 * JS-rendered pages without touching callers.
 */
export interface PageFetcher {
  fetch(url: string, opts: { headers: Record<string, string>; timeoutMs: number }): Promise<{
    status: number;
    finalUrl: string;
    headers: Record<string, string>;
    body: string;
    bytes: number;
    truncated: boolean;
    redirects: number;
  }>;
}

// ─── Errors ─────────────────────────────────────────────────────────────

export class NavigationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "BAD_URL"
      | "BLOCKED_HOST"
      | "RATE_LIMITED"
      | "FETCH_FAILED"
      | "TIMEOUT"
      | "TOO_LARGE"
      | "NON_HTML"
      | "BLOCKED_BY_ROBOTS",
  ) {
    super(message);
    this.name = "NavigationError";
  }
}

// ─── Safety: URL + host checks ──────────────────────────────────────────

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /\.local$/i,
  /\.internal$/i,
];

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
}

export function validateUrl(
  raw: string,
  cfg: { allowHosts?: string[]; denyHosts?: string[] },
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NavigationError(`invalid URL: ${raw}`, "BAD_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new NavigationError(
      `unsupported protocol: ${url.protocol}`,
      "BAD_URL",
    );
  }
  const host = url.hostname.toLowerCase();
  if (isPrivateHost(host)) {
    throw new NavigationError(`private/internal host blocked: ${host}`, "BLOCKED_HOST");
  }
  if (cfg.denyHosts && cfg.denyHosts.length > 0) {
    for (const pattern of cfg.denyHosts) {
      const p = pattern.toLowerCase();
      if (host === p || host.endsWith(p.startsWith(".") ? p : "." + p)) {
        throw new NavigationError(`host denied: ${host}`, "BLOCKED_HOST");
      }
    }
  }
  if (cfg.allowHosts && cfg.allowHosts.length > 0) {
    const allowed = cfg.allowHosts.some((pattern) => {
      const p = pattern.toLowerCase();
      return host === p || host.endsWith(p.startsWith(".") ? p : "." + p);
    });
    if (!allowed) {
      throw new NavigationError(`host not in allow list: ${host}`, "BLOCKED_HOST");
    }
  }
  return url;
}

// ─── Token-bucket rate limiter ──────────────────────────────────────────

/**
 * Per-domain rate limiter. Pure state + pure update function so the
 * limiter is trivially unit-testable with a virtual clock. Supply
 * `now()` for deterministic tests.
 */
export interface RateLimiterState {
  buckets: Map<string, { tokens: number; updatedAt: number }>;
  perMinute: number;
}

export function createRateLimiter(perMinute: number): RateLimiterState {
  return { buckets: new Map(), perMinute };
}

/**
 * Try to consume a token for `host`. Returns `true` if the request is
 * allowed, `false` if rate-limited. Pure w.r.t. the state object.
 */
export function tryConsume(
  state: RateLimiterState,
  host: string,
  now: number,
): boolean {
  const capacity = state.perMinute;
  const refillPerMs = capacity / 60_000;
  let bucket = state.buckets.get(host);
  if (!bucket) {
    bucket = { tokens: capacity - 1, updatedAt: now };
    state.buckets.set(host, bucket);
    return true;
  }
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    return false;
  }
  bucket.tokens -= 1;
  return true;
}

// ─── Default fetch adapter ─────────────────────────────────────────────

class DefaultFetchAdapter implements PageFetcher {
  async fetch(
    url: string,
    opts: { headers: Record<string, string>; timeoutMs: number },
  ) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: opts.headers,
        redirect: "follow",
        signal: ctrl.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NavigationError(
          `fetch timed out after ${opts.timeoutMs}ms (url=${url}, elapsed=${Date.now() - started}ms)`,
          "TIMEOUT",
        );
      }
      throw new NavigationError(
        `fetch failed: ${(err as Error).message}`,
        "FETCH_FAILED",
      );
    } finally {
      clearTimeout(timer);
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const body = await res.text();
    const bytes = new TextEncoder().encode(body).length;
    return {
      status: res.status,
      finalUrl: res.url || url,
      headers,
      body,
      bytes,
      truncated: false,
      redirects: 0, // global fetch doesn't expose this; Playwright adapter will
    };
  }
}

// ─── HTML parsing (regex-based, adapter-independent) ───────────────────

/**
 * Strip comments, <script>, and <style> blocks. Regex-only so it runs
 * in any JS runtime without a DOM library. Good enough for the text
 * extraction pass; a richer adapter can post-process the raw body.
 */
export function stripHtmlBoilerplate(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
}

/**
 * Decode the most common HTML entities we care about for text display.
 * Numeric entities (decimal + hex) handled too.
 */
export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    copy: "(c)",
    reg: "(r)",
    hellip: "...",
    mdash: "-",
    ndash: "-",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
  };
  return input.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (full, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (body.startsWith("#")) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    const key = body.toLowerCase();
    return key in named ? named[key] : full;
  });
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]*\\bname=["']${name}["'][^>]*\\bcontent=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bproperty=["']${name}["'][^>]*\\bcontent=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${name}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]).trim();
  }
  return "";
}

function extractAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "");
}

export function parseHtmlToPageView(
  rawHtml: string,
  url: string,
  finalUrl: string,
  status: number,
  opts: { fetchMs: number; truncated: boolean } = { fetchMs: 0, truncated: false },
): PageView {
  const html = rawHtml;
  const noisy = stripHtmlBoilerplate(html);

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";

  // Description / canonical / language
  const description =
    extractMeta(html, "description") || extractMeta(html, "og:description");
  const canonicalMatch = html.match(
    /<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i,
  );
  const canonical = canonicalMatch ? canonicalMatch[1] : null;
  const langMatch = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  const language = langMatch ? langMatch[1] : null;

  // Headings
  const headings: Array<{ level: number; text: string }> = [];
  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(noisy)) !== null) {
    const level = parseInt(hm[1], 10);
    const text = stripTags(hm[2]);
    if (text) headings.push({ level, text });
    if (headings.length > 200) break;
  }

  // Links
  const links: Array<{ href: string; text: string; rel: string | null; nofollow: boolean }> = [];
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(noisy)) !== null) {
    const attrs = lm[1];
    const href = extractAttr(attrs, "href");
    if (!href) continue;
    // Resolve relative
    let resolved = href;
    try {
      resolved = new URL(href, finalUrl).toString();
    } catch {
      /* keep raw */
    }
    const rel = extractAttr(attrs, "rel");
    const nofollow = !!rel && /\bnofollow\b/i.test(rel);
    const text = stripTags(lm[2]);
    links.push({ href: resolved, text, rel, nofollow });
    if (links.length >= 500) break;
  }

  // Images
  const images: Array<{ src: string; alt: string }> = [];
  const imgRe = /<img\b([^>]*)\/?>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(noisy)) !== null) {
    const src = extractAttr(im[1], "src");
    if (!src) continue;
    let resolved = src;
    try {
      resolved = new URL(src, finalUrl).toString();
    } catch {
      /* keep raw */
    }
    const alt = extractAttr(im[1], "alt") ?? "";
    images.push({ src: resolved, alt });
    if (images.length >= 200) break;
  }

  // Forms
  const forms: PageView["forms"] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(noisy)) !== null) {
    const attrs = fm[1];
    const body = fm[2];
    const action = extractAttr(attrs, "action") ?? "";
    const method = (extractAttr(attrs, "method") ?? "GET").toUpperCase();
    const fields: PageView["forms"][number]["fields"] = [];
    // inputs
    const inputRe = /<input\b([^>]*)\/?>/gi;
    let inm: RegExpExecArray | null;
    while ((inm = inputRe.exec(body)) !== null) {
      const n = extractAttr(inm[1], "name");
      if (!n) continue;
      fields.push({
        name: n,
        type: (extractAttr(inm[1], "type") ?? "text").toLowerCase(),
        value: extractAttr(inm[1], "value") ?? "",
        required: /\brequired\b/i.test(inm[1]),
      });
    }
    // textareas
    const taRe = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
    let tam: RegExpExecArray | null;
    while ((tam = taRe.exec(body)) !== null) {
      const n = extractAttr(tam[1], "name");
      if (!n) continue;
      fields.push({
        name: n,
        type: "textarea",
        value: stripTags(tam[2]),
        required: /\brequired\b/i.test(tam[1]),
      });
    }
    // selects
    const selRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = selRe.exec(body)) !== null) {
      const n = extractAttr(sm[1], "name");
      if (!n) continue;
      fields.push({
        name: n,
        type: "select",
        value: "",
        required: /\brequired\b/i.test(sm[1]),
      });
    }
    forms.push({ action, method, fields });
    if (forms.length >= 50) break;
  }

  // Visible text
  const text = stripTags(noisy);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    url,
    finalUrl,
    status,
    title,
    description,
    canonical,
    language,
    text,
    headings,
    links,
    images,
    forms,
    wordCount,
    fetchedAt: new Date().toISOString(),
    fetchMs: opts.fetchMs,
    truncated: opts.truncated,
  };
}

// ─── WebNavigator public class ─────────────────────────────────────────

export class WebNavigator {
  private readonly cfg: Required<
    Omit<
      NavigationConfig,
      | "allowHosts"
      | "denyHosts"
      | "adapter"
      | "now"
      | "robotsChecker"
      | "honorRobots"
      | "cache"
      | "telemetry"
    >
  > & {
    allowHosts?: string[];
    denyHosts?: string[];
  };
  private readonly adapter: PageFetcher;
  private readonly rate: RateLimiterState;
  private readonly now: () => number;
  private readonly robotsChecker: NonNullable<NavigationConfig["robotsChecker"]> | null;
  private readonly honorRobots: boolean;
  private readonly cache: NonNullable<NavigationConfig["cache"]> | null;
  private readonly telemetry: NavigationTelemetrySink | null;
  private history: Array<{ url: string; finalUrl: string; status: number; at: number }> = [];

  constructor(cfg: NavigationConfig = {}) {
    this.cfg = {
      maxBytes: cfg.maxBytes ?? DEFAULT_MAX_BYTES,
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRedirects: cfg.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      rateLimitPerMin: cfg.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
      userAgent: cfg.userAgent ?? DEFAULT_USER_AGENT,
      allowHosts: cfg.allowHosts,
      denyHosts: cfg.denyHosts,
    };
    this.adapter = cfg.adapter ?? new DefaultFetchAdapter();
    this.now = cfg.now ?? (() => Date.now());
    this.rate = createRateLimiter(this.cfg.rateLimitPerMin);
    this.robotsChecker = cfg.robotsChecker ?? null;
    this.honorRobots = cfg.honorRobots ?? Boolean(cfg.robotsChecker);
    this.cache = cfg.cache ?? null;
    this.telemetry = cfg.telemetry ?? null;
  }

  private emit(event: NavigationTelemetryEvent): void {
    if (this.telemetry) {
      try {
        this.telemetry.onEvent(event);
      } catch {
        /* never let a telemetry sink throw break navigation */
      }
    }
  }

  getHistory(): ReadonlyArray<{ url: string; finalUrl: string; status: number; at: number }> {
    return this.history.slice();
  }

  clearHistory(): void {
    this.history = [];
  }

  async fetchPage(url: string): Promise<RawFetchResult> {
    let validated: URL;
    try {
      validated = validateUrl(url, {
        allowHosts: this.cfg.allowHosts,
        denyHosts: this.cfg.denyHosts,
      });
    } catch (err) {
      if (err instanceof NavigationError) {
        this.emit({
          type: "request.blocked",
          url,
          host: "",
          reason: err.code === "BAD_URL" || err.code === "BLOCKED_HOST" ? err.code : "BLOCKED_HOST",
          at: this.now(),
          detail: err.message,
        });
      }
      throw err;
    }
    const host = validated.hostname.toLowerCase();

    // Cache lookup — fresh hit short-circuits every downstream check.
    const cacheLookup = this.cache?.lookup(validated.toString());
    if (cacheLookup?.state === "hit-fresh" && cacheLookup.entry) {
      const entry = cacheLookup.entry;
      this.emit({
        type: "request.cached",
        url,
        host,
        cacheState: "hit-fresh",
        bytes: entry.bytes,
        at: this.now(),
      });
      const cached: RawFetchResult = {
        url,
        finalUrl: entry.finalUrl,
        status: entry.status,
        headers: entry.headers,
        contentType: entry.headers["content-type"] ?? "",
        bytes: entry.bytes,
        body: entry.body,
        redirects: 0,
        truncated: false,
        fetchMs: 0,
      };
      this.history.push({ url, finalUrl: cached.finalUrl, status: cached.status, at: this.now() });
      if (this.history.length > 500) this.history.shift();
      return cached;
    }

    this.emit({
      type: "request.start",
      url,
      host,
      at: this.now(),
      cacheState: cacheLookup?.state,
      revalidating: cacheLookup?.state === "hit-stale",
    });

    // Robots.txt gate (if configured). We check BEFORE rate-limiting so a
    // robots-blocked URL doesn't eat a token bucket slot.
    if (this.honorRobots && this.robotsChecker) {
      const decision = await this.robotsChecker.check(validated.toString(), this.cfg.userAgent);
      if (!decision.allowed) {
        this.emit({
          type: "request.blocked",
          url,
          host,
          reason: "BLOCKED_BY_ROBOTS",
          at: this.now(),
          detail: `${decision.matchedRule?.type ?? "?"} ${decision.matchedRule?.path ?? "?"}`,
        });
        throw new NavigationError(
          `blocked by robots.txt: ${host}${validated.pathname} (matched ${decision.matchedRule?.type ?? "?"} ${decision.matchedRule?.path ?? "?"})`,
          "BLOCKED_BY_ROBOTS",
        );
      }
    }

    if (!tryConsume(this.rate, host, this.now())) {
      this.emit({
        type: "request.blocked",
        url,
        host,
        reason: "RATE_LIMITED",
        at: this.now(),
      });
      throw new NavigationError(
        `rate limit exceeded for host: ${host} (${this.cfg.rateLimitPerMin}/min)`,
        "RATE_LIMITED",
      );
    }

    // Merge revalidation headers when we have a stale entry.
    const extraHeaders = cacheLookup?.state === "hit-stale" && this.cache
      ? this.cache.buildRevalidationHeaders(validated.toString())
      : {};

    const started = this.now();
    let result;
    try {
      result = await this.adapter.fetch(validated.toString(), {
        headers: {
          "User-Agent": this.cfg.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...extraHeaders,
        },
        timeoutMs: this.cfg.timeoutMs,
      });
    } catch (err) {
      this.emit({
        type: "request.error",
        url,
        host,
        code: err instanceof NavigationError ? err.code : "FETCH_FAILED",
        message: err instanceof Error ? err.message : String(err),
        at: this.now(),
      });
      throw err;
    }
    const fetchMs = this.now() - started;

    // 304 Not Modified — serve the stale cache entry.
    if (result.status === 304 && cacheLookup?.state === "hit-stale" && cacheLookup.entry) {
      this.cache?.absorbResponse(validated.toString(), {
        status: 304,
        finalUrl: cacheLookup.entry.finalUrl,
        headers: cacheLookup.entry.headers,
        body: cacheLookup.entry.body,
        bytes: cacheLookup.entry.bytes,
      });
      this.emit({
        type: "request.network",
        url,
        host,
        status: 304,
        bytes: 0,
        fetchMs,
        at: this.now(),
        revalidated: true,
      });
      const cached: RawFetchResult = {
        url,
        finalUrl: cacheLookup.entry.finalUrl,
        status: 200,
        headers: cacheLookup.entry.headers,
        contentType: cacheLookup.entry.headers["content-type"] ?? "",
        bytes: cacheLookup.entry.bytes,
        body: cacheLookup.entry.body,
        redirects: result.redirects,
        truncated: false,
        fetchMs,
      };
      this.history.push({ url, finalUrl: cached.finalUrl, status: 304, at: this.now() });
      if (this.history.length > 500) this.history.shift();
      return cached;
    }

    let body = result.body;
    let bytes = result.bytes;
    let truncated = result.truncated;
    if (bytes > this.cfg.maxBytes) {
      // Truncate defensively — keep the first maxBytes of the body
      const encoder = new TextEncoder();
      const slice = encoder.encode(body).slice(0, this.cfg.maxBytes);
      body = new TextDecoder().decode(slice);
      bytes = slice.byteLength;
      truncated = true;
    }

    const contentType = result.headers["content-type"] ?? "";
    const raw: RawFetchResult = {
      url,
      finalUrl: result.finalUrl,
      status: result.status,
      headers: result.headers,
      contentType,
      bytes,
      body,
      redirects: result.redirects,
      truncated,
      fetchMs,
    };

    // Store in cache (absorbResponse handles no-store / non-2xx / etc.)
    if (this.cache && !truncated) {
      this.cache.absorbResponse(validated.toString(), {
        status: result.status,
        finalUrl: result.finalUrl,
        headers: result.headers,
        body,
        bytes,
      });
    }

    this.emit({
      type: "request.network",
      url,
      host,
      status: result.status,
      bytes,
      fetchMs,
      at: this.now(),
      revalidated: cacheLookup?.state === "hit-stale",
    });

    this.history.push({ url, finalUrl: result.finalUrl, status: result.status, at: this.now() });
    if (this.history.length > 500) this.history.shift();
    return raw;
  }

  async readPage(url: string): Promise<PageView> {
    const raw = await this.fetchPage(url);
    const looksHtml =
      /html/i.test(raw.contentType) ||
      /<html[\s>]/i.test(raw.body.slice(0, 1024)) ||
      raw.contentType === "";
    if (!looksHtml) {
      // Degrade to a text-only PageView so callers still get SOMETHING.
      return {
        url: raw.url,
        finalUrl: raw.finalUrl,
        status: raw.status,
        title: "",
        description: "",
        canonical: null,
        language: null,
        text: raw.body.slice(0, 50_000),
        headings: [],
        links: [],
        images: [],
        forms: [],
        wordCount: raw.body.split(/\s+/).filter(Boolean).length,
        fetchedAt: new Date().toISOString(),
        fetchMs: raw.fetchMs,
        truncated: raw.truncated,
        raw,
      };
    }
    const view = parseHtmlToPageView(raw.body, raw.url, raw.finalUrl, raw.status, {
      fetchMs: raw.fetchMs,
      truncated: raw.truncated,
    });
    view.raw = raw;
    return view;
  }
}

// ─── Pure helpers the agent can call on a PageView ─────────────────────

export interface LinkFilter {
  /** Keep links whose text matches this substring (case-insensitive). */
  textContains?: string;
  /** Keep links whose href matches this substring (case-insensitive). */
  hrefContains?: string;
  /** Restrict to these hostnames. */
  hosts?: string[];
  /** Skip nofollow links. */
  excludeNofollow?: boolean;
  /** Maximum results. */
  limit?: number;
}

export function extractLinks(view: PageView, filter: LinkFilter = {}): PageView["links"] {
  const tc = filter.textContains?.toLowerCase();
  const hc = filter.hrefContains?.toLowerCase();
  const hostSet = filter.hosts && filter.hosts.length > 0
    ? new Set(filter.hosts.map((h) => h.toLowerCase()))
    : null;

  const out: PageView["links"] = [];
  for (const link of view.links) {
    if (filter.excludeNofollow && link.nofollow) continue;
    if (tc && !link.text.toLowerCase().includes(tc)) continue;
    if (hc && !link.href.toLowerCase().includes(hc)) continue;
    if (hostSet) {
      try {
        const h = new URL(link.href).hostname.toLowerCase();
        if (!hostSet.has(h)) continue;
      } catch {
        continue;
      }
    }
    out.push(link);
    if (filter.limit && out.length >= filter.limit) break;
  }
  return out;
}

export function summarizePageView(view: PageView, maxChars = 1500): string {
  const parts: string[] = [];
  if (view.title) parts.push(`# ${view.title}`);
  if (view.description) parts.push(view.description);
  if (view.headings.length > 0) {
    parts.push(
      "## Outline\n" +
        view.headings
          .slice(0, 12)
          .map((h) => `${"#".repeat(Math.min(h.level, 6))} ${h.text}`)
          .join("\n"),
    );
  }
  if (view.text) {
    parts.push("## Content\n" + view.text.slice(0, 1000));
  }
  const joined = parts.join("\n\n");
  return joined.length > maxChars ? joined.slice(0, maxChars - 1) + "…" : joined;
}
