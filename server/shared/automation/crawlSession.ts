/**
 * crawlSession — pass 4, scope: browser/device automation parity.
 *
 * Bounded BFS crawl over the `WebNavigator` read primitive. Lets the
 * agent follow link trails through a site (or across sites) without
 * blowing the rate limit or the context window.
 *
 * Guardrails:
 *   - `maxPages` budget (default 10, hard cap 100)
 *   - `maxDepth` depth limit (default 2, hard cap 5)
 *   - Per-URL dedupe via a canonicalizing visited set
 *   - `sameOriginOnly` flag (default true) so crawls stay on-topic
 *   - `includePatterns` / `excludePatterns` regex filters on URLs
 *   - Per-page `onPage` callback so the caller can stream results
 *     instead of waiting for the whole BFS to finish
 *   - Short-circuits on any `NavigationError` (respects the
 *     underlying navigator's rate limit + robots + allow/deny list)
 *
 * Design choice: this module does NOT depend on the concrete
 * `WebNavigator` class — it takes a plain `{ readPage(url) }` shape
 * so a future Playwright-backed navigator can slot in transparently.
 */

import type { PageView } from "./webNavigator";

export interface PageReader {
  readPage(url: string): Promise<PageView>;
}

export interface CrawlOptions {
  startUrl: string;
  /** Max unique pages to visit. Default 10, cap 100. */
  maxPages?: number;
  /** Max link depth. Start URL is depth 0. Default 2, cap 5. */
  maxDepth?: number;
  /** Restrict crawl to the same origin as startUrl. Default true. */
  sameOriginOnly?: boolean;
  /** Restrict crawl to hosts whose suffix appears in this list. */
  allowHosts?: string[];
  /** Regex patterns (tested against the absolute URL) — must match. */
  includePatterns?: string[];
  /** Regex patterns (tested against the absolute URL) — must not match. */
  excludePatterns?: string[];
  /** Skip nofollow links (default: true). */
  excludeNofollow?: boolean;
  /** Optional per-page callback (after each page is read). */
  onPage?: (page: CrawlVisit) => void | Promise<void>;
  /** Optional skip-on-error. Default: true — errors don't halt the crawl. */
  continueOnError?: boolean;
}

export interface CrawlVisit {
  url: string;
  depth: number;
  title: string;
  wordCount: number;
  links: number;
  status: number;
  durationMs: number;
  error?: string;
}

export interface CrawlResult {
  startUrl: string;
  pages: CrawlVisit[];
  skipped: Array<{ url: string; reason: string }>;
  totalMs: number;
  pagesAttempted: number;
  pagesSuccessful: number;
  pagesFailed: number;
}

const HARD_MAX_PAGES = 100;
const HARD_MAX_DEPTH = 5;

// ─── Pure URL helpers ─────────────────────────────────────────────────

export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Trim trailing slash on the path (but keep root /)
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    // Sort query params for stable dedupe
    const params = Array.from(u.searchParams.entries()).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    u.search = "";
    for (const [k, v] of params) u.searchParams.append(k, v);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.host === ub.host;
  } catch {
    return false;
  }
}

function hostMatches(host: string, suffixes: string[]): boolean {
  const h = host.toLowerCase();
  return suffixes.some((s) => {
    const p = s.toLowerCase();
    return h === p || h.endsWith(p.startsWith(".") ? p : "." + p);
  });
}

function compilePatterns(patterns: string[] | undefined): RegExp[] {
  if (!patterns) return [];
  const out: RegExp[] = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(p));
    } catch {
      /* ignore malformed patterns */
    }
  }
  return out;
}

function passesPatternFilter(
  url: string,
  include: RegExp[],
  exclude: RegExp[],
): boolean {
  for (const re of exclude) if (re.test(url)) return false;
  if (include.length === 0) return true;
  return include.some((re) => re.test(url));
}

// ─── Main crawl function ─────────────────────────────────────────────

export async function runCrawl(
  reader: PageReader,
  opts: CrawlOptions,
): Promise<CrawlResult> {
  const start = Date.now();
  const maxPages = Math.min(Math.max(opts.maxPages ?? 10, 1), HARD_MAX_PAGES);
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 2, 0), HARD_MAX_DEPTH);
  const sameOriginOnly = opts.sameOriginOnly ?? true;
  const excludeNofollow = opts.excludeNofollow ?? true;
  const continueOnError = opts.continueOnError ?? true;

  const include = compilePatterns(opts.includePatterns);
  const exclude = compilePatterns(opts.excludePatterns);

  const pages: CrawlVisit[] = [];
  const skipped: Array<{ url: string; reason: string }> = [];
  let pagesAttempted = 0;
  let pagesFailed = 0;

  // Normalized visited set. Using URLs canonicalized via the helper so
  // `/x` + `/x/` + `/x?b=2&a=1` + `/x?a=1&b=2` all collapse.
  const visited = new Set<string>();

  // Queue of [url, depth]. We normalize on entry to guarantee dedupe.
  const queue: Array<{ url: string; depth: number }> = [];

  const startCanonical = canonicalizeUrl(opts.startUrl);
  visited.add(startCanonical);
  queue.push({ url: startCanonical, depth: 0 });

  while (queue.length > 0 && pages.length < maxPages) {
    const { url, depth } = queue.shift()!;
    pagesAttempted++;
    const t0 = Date.now();

    let view: PageView | null = null;
    let errorMsg: string | undefined;
    try {
      view = await reader.readPage(url);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      pagesFailed++;
      if (!continueOnError) {
        pages.push({
          url,
          depth,
          title: "",
          wordCount: 0,
          links: 0,
          status: 0,
          durationMs: Date.now() - t0,
          error: errorMsg,
        });
        break;
      }
    }

    const visit: CrawlVisit = {
      url,
      depth,
      title: view?.title ?? "",
      wordCount: view?.wordCount ?? 0,
      links: view?.links.length ?? 0,
      status: view?.status ?? 0,
      durationMs: Date.now() - t0,
      error: errorMsg,
    };
    pages.push(visit);
    if (opts.onPage) {
      try {
        await opts.onPage(visit);
      } catch {
        /* caller callback error — don't let it halt the crawl */
      }
    }

    // Enqueue children only if the read succeeded and we're not at depth cap.
    if (view && depth < maxDepth) {
      for (const link of view.links) {
        if (pages.length + queue.length >= maxPages) break;
        if (excludeNofollow && link.nofollow) continue;
        const href = canonicalizeUrl(link.href);
        if (!href || visited.has(href)) continue;

        // SSRF prevention: we only enqueue http(s)
        let parsed: URL;
        try {
          parsed = new URL(href);
        } catch {
          skipped.push({ url: href, reason: "invalid URL" });
          continue;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          skipped.push({ url: href, reason: `protocol ${parsed.protocol}` });
          continue;
        }
        if (sameOriginOnly && !sameOrigin(href, opts.startUrl)) {
          skipped.push({ url: href, reason: "cross-origin" });
          continue;
        }
        if (opts.allowHosts && !hostMatches(parsed.hostname, opts.allowHosts)) {
          skipped.push({ url: href, reason: "host not allowed" });
          continue;
        }
        if (!passesPatternFilter(href, include, exclude)) {
          skipped.push({ url: href, reason: "pattern filter" });
          continue;
        }

        visited.add(href);
        queue.push({ url: href, depth: depth + 1 });
      }
    }
  }

  return {
    startUrl: opts.startUrl,
    pages,
    skipped,
    totalMs: Date.now() - start,
    pagesAttempted,
    pagesSuccessful: pagesAttempted - pagesFailed,
    pagesFailed,
  };
}
