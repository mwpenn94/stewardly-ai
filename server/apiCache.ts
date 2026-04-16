/**
 * apiCache — lightweight in-memory cache for frequently accessed API data.
 *
 * Provides a simple TTL-based cache that can be used in tRPC procedures
 * to avoid redundant database queries or external API calls for data
 * that changes infrequently (e.g., market data, reference rates, system config).
 *
 * Pass 68 — C8 Performance improvement.
 *
 * Usage:
 *   const cache = new ApiCache<MarketData>(5 * 60 * 1000); // 5 min TTL
 *   const data = await cache.getOrFetch("market-summary", () => fetchMarketData());
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

export class ApiCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs = 5 * 60 * 1000, maxEntries = 500) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /** Get cached value or fetch and cache it */
  async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const existing = this.get(key);
    if (existing !== undefined) return existing;

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }

  /** Get cached value (returns undefined if expired or missing) */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /** Set a cached value */
  set(key: string, data: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldest = [...this.store.entries()].sort(
        (a, b) => a[1].createdAt - b[1].createdAt,
      );
      for (let i = 0; i < Math.ceil(this.maxEntries * 0.1); i++) {
        this.store.delete(oldest[i][0]);
      }
    }

    const now = Date.now();
    this.store.set(key, {
      data,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      createdAt: now,
    });
  }

  /** Invalidate a specific key */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /** Invalidate all keys matching a prefix */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Clear all cached entries */
  clear(): void {
    this.store.clear();
  }

  /** Get cache statistics */
  stats(): { size: number; maxEntries: number; ttlMs: number } {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      ttlMs: this.defaultTtlMs,
    };
  }
}

/** Shared cache instances for common data types */
export const marketDataCache = new ApiCache(5 * 60 * 1000); // 5 min
export const referenceDataCache = new ApiCache(60 * 60 * 1000); // 1 hour
export const systemConfigCache = new ApiCache(15 * 60 * 1000); // 15 min
