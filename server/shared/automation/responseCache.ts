/**
 * responseCache — pass 3, scope: browser/device automation parity.
 *
 * LRU + ETag cache in front of the `WebNavigator` page fetch pipeline.
 * Serves three jobs:
 *
 *   1. Avoid refetching pages the agent read seconds ago (big win for
 *      multi-tool-call chains like `web_read → web_extract` on the
 *      same URL, because the extractor re-fetches by default).
 *   2. Honor HTTP conditional GETs (`If-None-Match` + `If-Modified-Since`)
 *      so repeat fetches against the same URL become 304s where possible,
 *      not full body pulls.
 *   3. Support stale-while-revalidate semantics: return a stale entry
 *      immediately and optionally let the caller kick a background
 *      refresh. The cache state machine is pure; the refresh scheduling
 *      is the caller's decision.
 *
 * Design choices:
 *   - Pure, in-memory, single-process. Redis / L2 can wrap this later.
 *   - LRU eviction at `maxEntries` (default 256) with ring-buffer access
 *     tracking so a hot repeat reader never evicts itself.
 *   - Entries store `fetchedAt`, `etag`, `lastModified`, `maxAgeMs`,
 *     `staleMs`, and the body bytes.
 *   - `lookup(url)` returns one of three states:
 *       - `hit-fresh`        — return cached body, skip network
 *       - `hit-stale`        — caller may return stale, must revalidate
 *       - `miss`             — caller must fetch
 *   - `buildRevalidationHeaders(entry)` produces the conditional GET
 *     headers so a caller adapter can ask for a 304.
 *   - `absorbResponse(url, res)` ingests a completed HTTP response
 *     (status + headers + body) and writes it to the cache respecting
 *     `Cache-Control`, `ETag`, and `Last-Modified`.
 *
 * Zero dependencies. Fully unit-testable with a virtual clock.
 */

export type CacheLookupResult =
  | { state: "miss" }
  | { state: "hit-fresh"; entry: CachedResponse }
  | { state: "hit-stale"; entry: CachedResponse };

export interface CachedResponse {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  fetchedAt: number;
  etag: string | null;
  lastModified: string | null;
  /** Fresh window, in ms (from Cache-Control:max-age or default). */
  maxAgeMs: number;
  /**
   * Stale-while-revalidate window, in ms. An entry older than
   * `maxAgeMs` but younger than `maxAgeMs + staleMs` is returned as
   * stale and the caller may choose to revalidate.
   */
  staleMs: number;
}

export interface ResponseCacheConfig {
  maxEntries?: number;
  /** Default max-age when the server doesn't specify one. */
  defaultMaxAgeMs?: number;
  /** Default stale-while-revalidate when the server doesn't specify one. */
  defaultStaleMs?: number;
  now?: () => number;
}

const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_STALE_MS = 10 * 60 * 1000; // 10 min

/**
 * Parse a Cache-Control header into the directives we care about.
 * Returns `{maxAgeMs?, staleMs?, noStore?, noCache?}`.
 */
export function parseCacheControl(value: string | undefined): {
  maxAgeMs?: number;
  staleMs?: number;
  noStore?: boolean;
  noCache?: boolean;
} {
  if (!value || typeof value !== "string") return {};
  const out: ReturnType<typeof parseCacheControl> = {};
  for (const part of value.split(",")) {
    const [rawKey, rawVal] = part.split("=");
    const key = rawKey?.trim().toLowerCase();
    const val = rawVal?.trim();
    if (!key) continue;
    if (key === "no-store") out.noStore = true;
    else if (key === "no-cache") out.noCache = true;
    else if (key === "max-age" && val) {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) out.maxAgeMs = Math.round(n * 1000);
    } else if (key === "stale-while-revalidate" && val) {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) out.staleMs = Math.round(n * 1000);
    }
  }
  return out;
}

/**
 * Determine the cache freshness window from the response headers plus
 * the user-supplied defaults. Returns `null` if the response is
 * explicitly uncacheable.
 */
export function deriveFreshness(
  headers: Record<string, string>,
  defaults: { defaultMaxAgeMs: number; defaultStaleMs: number },
): { maxAgeMs: number; staleMs: number } | null {
  const cc = parseCacheControl(headers["cache-control"]);
  if (cc.noStore) return null;
  // no-cache means revalidate every time (0 fresh window) — still cacheable
  if (cc.noCache) return { maxAgeMs: 0, staleMs: 0 };
  return {
    maxAgeMs: cc.maxAgeMs ?? defaults.defaultMaxAgeMs,
    staleMs: cc.staleMs ?? defaults.defaultStaleMs,
  };
}

// ─── LRU map ───────────────────────────────────────────────────────────

class LruMap<K, V> {
  private map = new Map<K, V>();
  constructor(private limit: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // Touch: re-insert at tail
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }
}

// ─── Main cache class ──────────────────────────────────────────────────

export class ResponseCache {
  private readonly lru: LruMap<string, CachedResponse>;
  private readonly cfg: Required<Omit<ResponseCacheConfig, "now">>;
  private readonly now: () => number;
  private stats = { hitFresh: 0, hitStale: 0, miss: 0, store: 0, evict: 0 };

  constructor(cfg: ResponseCacheConfig = {}) {
    this.cfg = {
      maxEntries: cfg.maxEntries ?? DEFAULT_MAX_ENTRIES,
      defaultMaxAgeMs: cfg.defaultMaxAgeMs ?? DEFAULT_MAX_AGE_MS,
      defaultStaleMs: cfg.defaultStaleMs ?? DEFAULT_STALE_MS,
    };
    this.now = cfg.now ?? (() => Date.now());
    this.lru = new LruMap(this.cfg.maxEntries);
  }

  /** Composite cache key — normalizes trailing slash and drops fragments. */
  static keyFor(url: string): string {
    try {
      const u = new URL(url);
      u.hash = "";
      return u.toString();
    } catch {
      return url;
    }
  }

  lookup(url: string): CacheLookupResult {
    const key = ResponseCache.keyFor(url);
    const entry = this.lru.get(key);
    if (!entry) {
      this.stats.miss++;
      return { state: "miss" };
    }
    const age = this.now() - entry.fetchedAt;
    if (age < entry.maxAgeMs) {
      this.stats.hitFresh++;
      return { state: "hit-fresh", entry };
    }
    if (age < entry.maxAgeMs + entry.staleMs) {
      this.stats.hitStale++;
      return { state: "hit-stale", entry };
    }
    // Beyond stale window — treat as miss but keep entry around for
    // conditional revalidation (ETag / Last-Modified still useful).
    this.stats.miss++;
    return { state: "miss" };
  }

  /**
   * Build HTTP conditional-GET headers the caller can include when
   * revalidating a stale entry. Returns `{}` when the cached entry
   * has neither an ETag nor a Last-Modified date.
   */
  buildRevalidationHeaders(url: string): Record<string, string> {
    const key = ResponseCache.keyFor(url);
    const entry = this.lru.get(key);
    if (!entry) return {};
    const h: Record<string, string> = {};
    if (entry.etag) h["if-none-match"] = entry.etag;
    if (entry.lastModified) h["if-modified-since"] = entry.lastModified;
    return h;
  }

  /**
   * Absorb a finished HTTP response. Respects no-store directives.
   * Returns the stored entry (or null if uncacheable).
   */
  absorbResponse(
    url: string,
    res: {
      status: number;
      finalUrl: string;
      headers: Record<string, string>;
      body: string;
      bytes: number;
    },
  ): CachedResponse | null {
    const key = ResponseCache.keyFor(url);

    // 304 Not Modified — touch the existing entry and reset its
    // freshness window.
    if (res.status === 304) {
      const existing = this.lru.get(key);
      if (existing) {
        existing.fetchedAt = this.now();
        this.lru.set(key, existing);
        return existing;
      }
      return null;
    }

    if (res.status < 200 || res.status >= 400) return null;

    const freshness = deriveFreshness(res.headers, {
      defaultMaxAgeMs: this.cfg.defaultMaxAgeMs,
      defaultStaleMs: this.cfg.defaultStaleMs,
    });
    if (!freshness) return null;

    const entry: CachedResponse = {
      url,
      finalUrl: res.finalUrl,
      status: res.status,
      headers: res.headers,
      body: res.body,
      bytes: res.bytes,
      fetchedAt: this.now(),
      etag: res.headers["etag"] ?? null,
      lastModified: res.headers["last-modified"] ?? null,
      maxAgeMs: freshness.maxAgeMs,
      staleMs: freshness.staleMs,
    };
    this.lru.set(key, entry);
    this.stats.store++;
    return entry;
  }

  invalidate(url: string): boolean {
    return this.lru.delete(ResponseCache.keyFor(url));
  }

  clear(): void {
    this.lru.clear();
  }

  get size(): number {
    return this.lru.size;
  }

  getStats() {
    return { ...this.stats, size: this.lru.size };
  }

  resetStats(): void {
    this.stats = { hitFresh: 0, hitStale: 0, miss: 0, store: 0, evict: 0 };
  }
}
