/**
 * Web fetch tool for Code Chat — Build-loop Pass 3.
 *
 * Claude Code parity for the `WebFetch` tool. Given a URL, fetches the
 * content and returns a cleaned plaintext + metadata so the agent can
 * read docs, changelog entries, MDN pages, GitHub READMEs, etc.
 *
 * Design decisions:
 *
 *  - **Allowlist-only.** SSRF-safe. The set of allowed hosts is
 *    intentionally broad (docs sites, major vendors, GitHub, dev.to,
 *    MDN, the major cloud providers) but excludes private IP ranges,
 *    cloud metadata endpoints, and localhost. Callers can override
 *    with `allowedHosts` when they need to reach an internal doc.
 *
 *  - **HTML-to-text, not HTML-to-markdown.** Markdown preserves the
 *    structure but bloats the response. A quality plaintext collapse
 *    with paragraph breaks and link URLs preserved inline is usually
 *    what the LLM wants for Q&A over docs.
 *
 *  - **Size cap**: 64KB of extracted text per fetch. Larger pages are
 *    truncated with a `truncated: true` flag so the LLM knows to
 *    request a different URL or paginate.
 *
 *  - **Timeout**: 10s default, configurable. Aborts with
 *    `code: "TIMEOUT"`.
 *
 *  - **Follows redirects**, stays on the allowlist for the redirect
 *    target too (so a vendor redirect that escapes the allowlist is
 *    refused).
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_EXTRACTED_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB ceiling
const DEFAULT_USER_AGENT =
  "Stewardly-CodeChat/1.0 (+https://stewardly.ai; webFetch tool)";

/**
 * Default host allowlist. Additive — callers can pass extra hosts
 * via `options.allowedHosts` to reach internal docs without editing
 * this file. Entries are matched against the parsed `url.hostname`
 * using exact match AND suffix match (so `github.com` matches
 * `api.github.com` too).
 */
export const DEFAULT_ALLOWED_HOSTS: readonly string[] = [
  // Programming language + framework docs
  "developer.mozilla.org",
  "nodejs.org",
  "react.dev",
  "tailwindcss.com",
  "typescriptlang.org",
  "vitejs.dev",
  "vitest.dev",
  "trpc.io",
  "expressjs.com",
  "drizzle.team",
  "zod.dev",
  "npmjs.com",
  "www.npmjs.com",
  "pnpm.io",
  // GitHub
  "github.com",
  "raw.githubusercontent.com",
  "gist.github.com",
  // Finance / regulatory (Stewardly domain)
  "sec.gov",
  "finra.org",
  "nasaa.org",
  "cfp.net",
  "irs.gov",
  "naic.org",
  "treasury.gov",
  "federalreserve.gov",
  "fred.stlouisfed.org",
  "census.gov",
  // Cloud + vendors
  "docs.aws.amazon.com",
  "cloud.google.com",
  "learn.microsoft.com",
  "docs.anthropic.com",
  "platform.openai.com",
  "ai.google.dev",
  // News / blogs (read-only; safe)
  "developer.chrome.com",
  "web.dev",
];

/** Private IP ranges we never contact, regardless of allowlist. */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./, // loopback
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // link-local (AWS metadata!)
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^169\.254\.169\.254$/,
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

export interface WebFetchOptions {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
  /** Extra allowed hosts beyond the default list. */
  allowedHosts?: string[];
  /** Override user agent. */
  userAgent?: string;
  /** Injected fetch (for tests). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

export interface WebFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  title?: string;
  text: string;
  truncated: boolean;
  bytes: number;
  elapsedMs: number;
}

export class WebFetchError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "WebFetchError";
  }
}

/**
 * Validate a URL and make sure it's an http(s) scheme pointing at an
 * allowlisted host that is NOT a private IP / metadata endpoint.
 */
export function validateFetchUrl(
  rawUrl: string,
  allowedHosts: readonly string[],
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new WebFetchError(`invalid URL: ${rawUrl}`, "BAD_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebFetchError(
      `only http/https URLs allowed (got ${parsed.protocol})`,
      "BAD_PROTOCOL",
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new WebFetchError(
      `hostname ${hostname} is blocked (localhost / metadata)`,
      "BLOCKED_HOST",
    );
  }
  for (const rx of PRIVATE_IP_PATTERNS) {
    if (rx.test(hostname)) {
      throw new WebFetchError(
        `hostname ${hostname} is a private IP range`,
        "PRIVATE_IP",
      );
    }
  }
  const allowed = allowedHosts.some((allow) => {
    const a = allow.toLowerCase();
    return hostname === a || hostname.endsWith("." + a);
  });
  if (!allowed) {
    throw new WebFetchError(
      `host ${hostname} is not on the fetch allowlist`,
      "HOST_NOT_ALLOWED",
    );
  }
  return parsed;
}

/**
 * Extract a readable plaintext view from a raw HTML string. Keeps
 * paragraph structure, surfaces link URLs inline (so the agent can
 * follow them), and strips `<script>`/`<style>`/`<noscript>` entirely.
 *
 * Also extracts the `<title>` for display in the result metadata.
 *
 * This is a small-but-good best-effort extractor — not a full HTML
 * parser. It works well enough for doc sites, blog posts, and READMEs,
 * which is the 95% use case.
 */
export function htmlToText(html: string): { title?: string; text: string } {
  // 1. Extract the title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtmlEntities(stripTags(titleMatch[1])).trim().slice(0, 200)
    : undefined;

  // 2. Strip script/style/noscript blocks entirely
  let work = html;
  work = work.replace(/<script[\s\S]*?<\/script>/gi, " ");
  work = work.replace(/<style[\s\S]*?<\/style>/gi, " ");
  work = work.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  work = work.replace(/<!--[\s\S]*?-->/g, " ");

  // 3. Convert <a href=""> to "text (href)" so link targets survive
  work = work.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, text: string) => {
      const cleanText = stripTags(text).trim();
      if (!cleanText) return "";
      if (cleanText === href) return cleanText;
      return `${cleanText} (${href})`;
    },
  );

  // 4. Preserve paragraph structure: replace <br>, <p>, <div>, <li>, <h*>
  //    with newlines BEFORE stripping the rest of the tags.
  work = work.replace(/<br\s*\/?>/gi, "\n");
  work = work.replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<\/tr>/gi, "\n\n");
  work = work.replace(/<hr\s*\/?>/gi, "\n---\n");
  // Bullet marker for list items
  work = work.replace(/<li[^>]*>/gi, "- ");

  // 5. Strip remaining tags
  work = stripTags(work);

  // 6. Decode HTML entities
  work = decodeHtmlEntities(work);

  // 7. Collapse whitespace: runs of spaces/tabs → single space,
  //    3+ newlines → 2 newlines (paragraph break).
  work = work.replace(/[ \t\f\v]+/g, " ");
  work = work.replace(/\n[ \t]+/g, "\n");
  work = work.replace(/\n{3,}/g, "\n\n");
  work = work.trim();

  return { title, text: work };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: '"',
  rdquo: '"',
  lsquo: "'",
  rsquo: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const n = parseInt(body.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    if (body.startsWith("#")) {
      const n = parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    const key = body.toLowerCase();
    return ENTITY_MAP[key] ?? full;
  });
}

/**
 * Execute an HTTP fetch with timeout + size cap + allowlist check.
 * Returns the cleaned text plus metadata. Never throws on the happy
 * path — throws only on validation / network errors.
 */
export async function webFetch(opts: WebFetchOptions): Promise<WebFetchResult> {
  const allowedHosts = [
    ...DEFAULT_ALLOWED_HOSTS,
    ...(opts.allowedHosts ?? []),
  ];
  const urlObj = validateFetchUrl(opts.url, allowedHosts);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = Math.min(opts.maxBytes ?? MAX_EXTRACTED_BYTES, MAX_RESPONSE_BYTES);
  const fetchImpl = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  let response: Response;
  try {
    response = await fetchImpl(urlObj.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": opts.userAgent ?? DEFAULT_USER_AGENT,
        Accept: "text/html,text/plain,text/markdown,application/json;q=0.8,*/*;q=0.5",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new WebFetchError(`fetch timeout after ${timeoutMs}ms`, "TIMEOUT");
    }
    throw new WebFetchError(
      `fetch failed: ${(err as Error).message}`,
      "FETCH_FAILED",
    );
  }
  clearTimeout(timer);

  const finalUrlStr = response.url || urlObj.toString();
  // Revalidate redirect target is still on the allowlist.
  try {
    validateFetchUrl(finalUrlStr, allowedHosts);
  } catch (err) {
    throw new WebFetchError(
      `redirect target failed allowlist check: ${(err as WebFetchError).message}`,
      "REDIRECT_BLOCKED",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  const capped = raw.length > MAX_RESPONSE_BYTES;
  const rawCapped = capped ? raw.slice(0, MAX_RESPONSE_BYTES) : raw;

  const isHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml") ||
    // Content-Type might be missing — sniff the body
    (contentType === "" && /<html[\s>]|<!doctype html/i.test(rawCapped.slice(0, 2000)));

  let title: string | undefined;
  let text: string;
  if (isHtml) {
    const extracted = htmlToText(rawCapped);
    title = extracted.title;
    text = extracted.text;
  } else {
    text = rawCapped;
  }

  const truncated = text.length > maxBytes || capped;
  const clippedText = text.length > maxBytes ? text.slice(0, maxBytes) : text;

  return {
    url: opts.url,
    finalUrl: finalUrlStr,
    status: response.status,
    contentType,
    title,
    text: clippedText,
    truncated,
    bytes: text.length,
    elapsedMs: Date.now() - start,
  };
}
