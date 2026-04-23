/**
 * Data Engine Cache Layer — v4.0+
 * 
 * In-memory cache with TTL, stale-while-revalidate, and analytics.
 * Designed for government data APIs (FRED, BLS, BEA, Census) where:
 * - Data updates infrequently (daily/monthly/quarterly)
 * - API rate limits are strict
 * - Latency matters for dashboard responsiveness
 * 
 * Features:
 * - Configurable TTL per data source
 * - Stale-while-revalidate pattern
 * - Cache hit/miss analytics
 * - LRU eviction when memory limit reached
 * - Automatic background refresh for popular keys
 * - Cache warming for frequently accessed series
 */

/* ─── Types ─── */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  source: string;
  staleAt: number; // When to start background refresh
  size: number; // Approximate size in bytes
}

export interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Stale-while-revalidate window in ms (serves stale data while refreshing) */
  staleWhileRevalidateMs: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Maximum total size in bytes (approximate) */
  maxSizeBytes: number;
  /** Enable background refresh for popular keys */
  enableBackgroundRefresh: boolean;
  /** Minimum access count to trigger background refresh */
  backgroundRefreshThreshold: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  staleHitCount: number;
  evictionCount: number;
  hitRate: number;
  avgAccessCount: number;
  bySource: Record<string, { entries: number; hits: number; misses: number }>;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/* ─── Source-specific TTLs ─── */

/** TTL configurations per data source (in milliseconds) */
export const SOURCE_TTLS: Record<string, { ttlMs: number; staleMs: number; description: string }> = {
  fred: {
    ttlMs: 6 * 60 * 60 * 1000,      // 6 hours (FRED updates daily)
    staleMs: 12 * 60 * 60 * 1000,    // 12 hours stale window
    description: "Federal Reserve Economic Data — daily updates",
  },
  bls: {
    ttlMs: 12 * 60 * 60 * 1000,     // 12 hours (BLS updates monthly)
    staleMs: 24 * 60 * 60 * 1000,   // 24 hours stale window
    description: "Bureau of Labor Statistics — monthly updates",
  },
  bea: {
    ttlMs: 24 * 60 * 60 * 1000,     // 24 hours (BEA updates quarterly)
    staleMs: 48 * 60 * 60 * 1000,   // 48 hours stale window
    description: "Bureau of Economic Analysis — quarterly updates",
  },
  census: {
    ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days (Census updates annually)
    staleMs: 14 * 24 * 60 * 60 * 1000, // 14 days stale window
    description: "US Census Bureau — annual updates",
  },
  market: {
    ttlMs: 5 * 60 * 1000,           // 5 minutes (market data is real-time)
    staleMs: 15 * 60 * 1000,        // 15 minutes stale window
    description: "Market data — real-time updates",
  },
  default: {
    ttlMs: 60 * 60 * 1000,          // 1 hour default
    staleMs: 2 * 60 * 60 * 1000,    // 2 hours stale window
    description: "Default cache TTL",
  },
};

/* ─── Cache Implementation ─── */

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtlMs: 60 * 60 * 1000,
  staleWhileRevalidateMs: 2 * 60 * 60 * 1000,
  maxEntries: 5000,
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  enableBackgroundRefresh: true,
  backgroundRefreshThreshold: 3,
};

class DataCache {
  private store = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hitCount: 0,
    missCount: 0,
    staleHitCount: 0,
    evictionCount: 0,
  };
  private sourceStats = new Map<string, { hits: number; misses: number }>();
  private totalSizeBytes = 0;
  private refreshCallbacks = new Map<string, () => Promise<unknown>>();
  private refreshInProgress = new Set<string>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get a value from cache. Returns undefined on miss.
   * Serves stale data during revalidation window.
   */
  get<T>(key: string): { value: T; stale: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.missCount++;
      this.trackSourceMiss(key);
      return undefined;
    }

    const now = Date.now();
    entry.lastAccessed = now;
    entry.accessCount++;

    // Fresh hit
    if (now < entry.expiresAt) {
      this.stats.hitCount++;
      this.trackSourceHit(key);
      return { value: entry.value as T, stale: false };
    }

    // Stale but within revalidation window
    if (now < entry.staleAt) {
      this.stats.staleHitCount++;
      this.trackSourceHit(key);
      // Trigger background refresh if configured
      if (this.config.enableBackgroundRefresh && entry.accessCount >= this.config.backgroundRefreshThreshold) {
        this.triggerBackgroundRefresh(key);
      }
      return { value: entry.value as T, stale: true };
    }

    // Expired beyond stale window
    this.store.delete(key);
    this.totalSizeBytes -= entry.size;
    this.stats.missCount++;
    this.trackSourceMiss(key);
    return undefined;
  }

  /**
   * Set a value in cache with source-specific TTL
   */
  set<T>(key: string, value: T, source: string = "default"): void {
    const sourceTtl = SOURCE_TTLS[source] || SOURCE_TTLS.default;
    const now = Date.now();
    const size = this.estimateSize(value);

    // Evict if necessary
    this.evictIfNeeded(size);

    const existing = this.store.get(key);
    if (existing) {
      this.totalSizeBytes -= existing.size;
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + sourceTtl.ttlMs,
      staleAt: now + sourceTtl.ttlMs + sourceTtl.staleMs,
      lastAccessed: now,
      accessCount: existing?.accessCount ?? 0,
      source,
      size,
    };

    this.store.set(key, entry as CacheEntry);
    this.totalSizeBytes += size;
  }

  /**
   * Register a refresh callback for background revalidation
   */
  registerRefreshCallback(keyPattern: string, callback: () => Promise<unknown>): void {
    this.refreshCallbacks.set(keyPattern, callback);
  }

  /**
   * Invalidate a specific key or all keys matching a source
   */
  invalidate(keyOrSource: string): number {
    let count = 0;
    // Try exact key first
    const entry = this.store.get(keyOrSource);
    if (entry) {
      this.totalSizeBytes -= entry.size;
      this.store.delete(keyOrSource);
      count = 1;
    } else {
      // Invalidate by source
      for (const [key, e] of this.store) {
        if (e.source === keyOrSource) {
          this.totalSizeBytes -= e.size;
          this.store.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Warm the cache with pre-fetched data
   */
  warm(entries: Array<{ key: string; value: unknown; source: string }>): number {
    let warmed = 0;
    for (const { key, value, source } of entries) {
      if (!this.store.has(key)) {
        this.set(key, value, source);
        warmed++;
      }
    }
    return warmed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    let totalAccessCount = 0;

    for (const entry of this.store.values()) {
      totalAccessCount += entry.accessCount;
      if (!oldestEntry || entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
      if (!newestEntry || entry.createdAt > newestEntry) newestEntry = entry.createdAt;
    }

    const bySource: Record<string, { entries: number; hits: number; misses: number }> = {};
    for (const entry of this.store.values()) {
      if (!bySource[entry.source]) bySource[entry.source] = { entries: 0, hits: 0, misses: 0 };
      bySource[entry.source].entries++;
    }
    for (const [source, stats] of this.sourceStats) {
      if (!bySource[source]) bySource[source] = { entries: 0, hits: 0, misses: 0 };
      bySource[source].hits = stats.hits;
      bySource[source].misses = stats.misses;
    }

    const totalRequests = this.stats.hitCount + this.stats.missCount + this.stats.staleHitCount;

    return {
      totalEntries: this.store.size,
      totalSizeBytes: this.totalSizeBytes,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      staleHitCount: this.stats.staleHitCount,
      evictionCount: this.stats.evictionCount,
      hitRate: totalRequests > 0 ? (this.stats.hitCount + this.stats.staleHitCount) / totalRequests : 0,
      avgAccessCount: this.store.size > 0 ? totalAccessCount / this.store.size : 0,
      bySource,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
    this.totalSizeBytes = 0;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /* ─── Private Methods ─── */

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB for non-serializable
    }
  }

  private evictIfNeeded(incomingSize: number): void {
    // Evict by count
    while (this.store.size >= this.config.maxEntries) {
      this.evictLRU();
    }
    // Evict by size
    while (this.totalSizeBytes + incomingSize > this.config.maxSizeBytes && this.store.size > 0) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    for (const [key, entry] of this.store) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    if (lruKey) {
      const entry = this.store.get(lruKey)!;
      this.totalSizeBytes -= entry.size;
      this.store.delete(lruKey);
      this.stats.evictionCount++;
    }
  }

  private triggerBackgroundRefresh(key: string): void {
    if (this.refreshInProgress.has(key)) return;
    const callback = this.refreshCallbacks.get(key);
    if (!callback) return;

    this.refreshInProgress.add(key);
    callback()
      .then(value => {
        const entry = this.store.get(key);
        if (entry) {
          this.set(key, value, entry.source);
        }
      })
      .catch(() => {
        // Background refresh failed — stale data continues to be served
      })
      .finally(() => {
        this.refreshInProgress.delete(key);
      });
  }

  private trackSourceHit(key: string): void {
    const entry = this.store.get(key);
    if (!entry) return;
    const stats = this.sourceStats.get(entry.source) || { hits: 0, misses: 0 };
    stats.hits++;
    this.sourceStats.set(entry.source, stats);
  }

  private trackSourceMiss(key: string): void {
    // Try to infer source from key prefix
    const source = key.split(":")[0] || "unknown";
    const stats = this.sourceStats.get(source) || { hits: 0, misses: 0 };
    stats.misses++;
    this.sourceStats.set(source, stats);
  }
}

/* ─── Singleton Instance ─── */

export const dataCache = new DataCache();

/* ─── Cache-Wrapped Fetch Helper ─── */

/**
 * Fetch data through the cache layer.
 * Returns cached data if available, otherwise fetches and caches.
 */
export async function cachedFetch<T>(
  key: string,
  source: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cached: boolean; stale: boolean }> {
  const cached = dataCache.get<T>(key);
  if (cached) {
    return { data: cached.value, cached: true, stale: cached.stale };
  }

  const data = await fetcher();
  dataCache.set(key, data, source);
  return { data, cached: false, stale: false };
}

/**
 * Build a cache key from source and parameters
 */
export function buildCacheKey(source: string, action: string, params: Record<string, string | number | boolean> = {}): string {
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${source}:${action}:${sortedParams}`;
}
