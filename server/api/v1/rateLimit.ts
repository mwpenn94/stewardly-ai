/**
 * /api/v1 — lightweight in-process rate limiter.
 *
 * Shipped by Pass 6 of the hybrid build loop — PARITY-API-0001.
 *
 * A plain token-bucket keyed by `req.apiKey?.id || req.ip`. Nothing
 * fancy — this is a first line of defense, not a DDoS shield. For
 * real production we'd want Redis-backed distributed limiting, but
 * this unblocks the public API launch and lets us hard-cap per-key
 * QPS without an external service.
 *
 * The state is module-local in a Map so it's shared across all
 * requests to the same process. Tests pass their own Map to keep
 * isolation. Pure functions are exported for unit coverage.
 */

import type { Request, Response, NextFunction } from "express";
import { getRequestApiKey } from "./auth";

export interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitConfig {
  /** Max tokens in the bucket (burst size). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfterMs: number;
}

/** Pure: consume 1 token from a bucket, refilling first. */
export function consumeToken(
  bucket: TokenBucket,
  config: RateLimitConfig,
  nowMs: number,
): RateLimitResult {
  // Refill
  const elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
  const refill = (elapsedMs / 1000) * config.refillPerSec;
  bucket.tokens = Math.min(config.capacity, bucket.tokens + refill);
  bucket.lastRefillMs = nowMs;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      tokensRemaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
    };
  }

  // Not enough tokens — compute retry-after.
  const needed = 1 - bucket.tokens;
  const retryAfterMs =
    config.refillPerSec > 0 ? (needed / config.refillPerSec) * 1000 : 60_000;
  return {
    allowed: false,
    tokensRemaining: 0,
    retryAfterMs,
  };
}

/** Pure: get-or-create a bucket in a store. */
export function getOrCreateBucket(
  store: Map<string, TokenBucket>,
  key: string,
  config: RateLimitConfig,
  nowMs: number,
): TokenBucket {
  let b = store.get(key);
  if (!b) {
    b = { tokens: config.capacity, lastRefillMs: nowMs };
    store.set(key, b);
  }
  return b;
}

/**
 * Express middleware factory. Callers can pass their own bucket store
 * (for test isolation) or use the module-default one.
 */
const defaultStore = new Map<string, TokenBucket>();

export function rateLimitMiddleware(
  config: RateLimitConfig,
  store: Map<string, TokenBucket> = defaultStore,
) {
  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = getRequestApiKey(req)?.id ?? (req.ip ?? "anon");
    const now = Date.now();
    const bucket = getOrCreateBucket(store, key, config, now);
    const result = consumeToken(bucket, config, now);

    res.setHeader("X-RateLimit-Limit", String(config.capacity));
    res.setHeader("X-RateLimit-Remaining", String(result.tokensRemaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      res.status(429).json({
        error: {
          code: "rate_limited",
          message: `Too many requests. Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.`,
        },
      });
      return;
    }
    next();
  };
}

/** Exposed for tests. */
export function clearDefaultStore(): void {
  defaultStore.clear();
}
