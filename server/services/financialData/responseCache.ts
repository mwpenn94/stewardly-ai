/**
 * Financial Data Response Cache
 * 
 * In-memory TTL cache for financial data adapter responses.
 * Prevents redundant API calls for identical queries within the TTL window.
 * 
 * TTL defaults by data type:
 * - Real-time quotes: 60s
 * - Historical data: 1 hour
 * - Economic series: 6 hours
 * - SEC filings: 24 hours
 * - Treasury yields: 1 hour
 * - Entity lookups (FIGI, LEI): 24 hours
 */
import type { AdapterQueryResult } from "./types";

interface CacheEntry {
  result: AdapterQueryResult;
  expiresAt: number;
  hitCount: number;
}

// TTL in milliseconds by adapter+action pattern
const TTL_MAP: Record<string, number> = {
  // Real-time market data — short TTL
  "fmp:quote": 60_000,
  "polygon:quote": 60_000,
  "tiingo:quote": 60_000,
  "fmp:profile": 3_600_000,
  "polygon:ticker": 3_600_000,
  
  // Historical data — medium TTL
  "fmp:historical": 3_600_000,
  "polygon:historical": 3_600_000,
  "tiingo:historical": 3_600_000,
  
  // Economic data — long TTL (updated infrequently)
  "fred:series": 21_600_000,
  "fred:search": 21_600_000,
  "bls:series": 21_600_000,
  "bls:latest": 21_600_000,
  "bea:gdp": 21_600_000,
  "bea:personal_income": 21_600_000,
  
  // Government data — very long TTL
  "edgar:filings": 86_400_000,
  "edgar:company": 86_400_000,
  "treasury:yields": 3_600_000,
  "treasury:debt": 3_600_000,
  "treasury:rates": 3_600_000,
  
  // Entity lookups — very long TTL
  "openfigi:lookup": 86_400_000,
  "gleif:search": 86_400_000,
  "gleif:lookup": 86_400_000,
};

const DEFAULT_TTL = 300_000; // 5 minutes default
const MAX_CACHE_SIZE = 2000;

const cache = new Map<string, CacheEntry>();

/**
 * Generate a cache key from adapter ID, action, and params
 */
function buildKey(adapterId: string, action: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${JSON.stringify(params[k])}`).join("&");
  return `${adapterId}:${action}:${sortedParams}`;
}

/**
 * Get TTL for a specific adapter+action combination
 */
function getTTL(adapterId: string, action: string): number {
  return TTL_MAP[`${adapterId}:${action}`] ?? DEFAULT_TTL;
}

/**
 * Get a cached response if available and not expired
 */
export function getCached(adapterId: string, action: string, params: Record<string, unknown>): AdapterQueryResult | null {
  const key = buildKey(adapterId, action, params);
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  entry.hitCount++;
  return {
    ...entry.result,
    cachedAt: entry.result.cachedAt,
    metadata: {
      ...entry.result.metadata,
      cacheHit: true,
      cacheHitCount: entry.hitCount,
    },
  };
}

/**
 * Store a response in the cache
 */
export function setCached(adapterId: string, action: string, params: Record<string, unknown>, result: AdapterQueryResult): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  
  const key = buildKey(adapterId, action, params);
  const ttl = getTTL(adapterId, action);
  
  cache.set(key, {
    result: {
      ...result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    },
    expiresAt: Date.now() + ttl,
    hitCount: 0,
  });
}

/**
 * Invalidate cache entries for a specific adapter
 */
export function invalidateAdapter(adapterId: string): number {
  let count = 0;
  for (const [key] of cache.entries()) {
    if (key.startsWith(`${adapterId}:`)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Invalidate all cache entries
 */
export function invalidateAll(): number {
  const count = cache.size;
  cache.clear();
  return count;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  byAdapter: Record<string, { entries: number; totalHits: number }>;
} {
  const byAdapter: Record<string, { entries: number; totalHits: number }> = {};
  let totalHits = 0;
  
  for (const [key, entry] of cache.entries()) {
    const adapterId = key.split(":")[0];
    if (!byAdapter[adapterId]) byAdapter[adapterId] = { entries: 0, totalHits: 0 };
    byAdapter[adapterId].entries++;
    byAdapter[adapterId].totalHits += entry.hitCount;
    totalHits += entry.hitCount;
  }
  
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: cache.size > 0 ? totalHits / (totalHits + cache.size) : 0,
    byAdapter,
  };
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}, 300_000);
