/**
 * Dynamic Integration — per-blueprint token-bucket rate limiter.
 *
 * Enforces blueprint.rateLimitPerMin at run time. Each blueprint gets a
 * bucket that holds at most `rateLimitPerMin` tokens and refills at
 * `rateLimitPerMin / 60` tokens per second. A run consumes one token.
 *
 * In-memory. Pure for the scheduling math (`applyRefill`), easy to test.
 * Resets on process restart — which is fine because scheduled runs are
 * minute-grained and we have an additional 55-second dedup window on
 * lastRunAt in blueprintScheduler.
 */

export interface Bucket {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 10_000;

/**
 * Top up a bucket based on elapsed time. Pure — returns a new bucket state.
 * Exported for tests.
 */
export function applyRefill(bucket: Bucket, now: number): Bucket {
  const elapsed = Math.max(0, now - bucket.lastRefillMs);
  const refill = elapsed * bucket.refillPerMs;
  const tokens = Math.min(bucket.capacity, bucket.tokens + refill);
  return { ...bucket, tokens, lastRefillMs: now };
}

/**
 * Try to consume one token for a blueprint. Returns true if the run is
 * allowed, false if rate-limited. If `ratePerMin <= 0`, the bucket is
 * effectively disabled (always allows).
 */
export function checkAndConsumeRate(
  blueprintId: string,
  ratePerMin: number,
  now: number = Date.now(),
): { allowed: boolean; remaining: number; retryInMs?: number } {
  if (!ratePerMin || ratePerMin <= 0) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  }
  const capacity = Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(ratePerMin)));
  const refillPerMs = capacity / 60_000;
  let bucket = buckets.get(blueprintId);
  if (!bucket) {
    bucket = { tokens: capacity, capacity, refillPerMs, lastRefillMs: now };
  } else {
    // If the capacity was updated, rescale so the bucket never exceeds the
    // new ceiling but never goes negative.
    if (bucket.capacity !== capacity) {
      bucket = { ...bucket, capacity, refillPerMs, tokens: Math.min(bucket.tokens, capacity) };
    }
    bucket = applyRefill(bucket, now);
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(blueprintId, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }
  // Compute ms until we have 1 token again.
  const deficit = 1 - bucket.tokens;
  const retryInMs = Math.ceil(deficit / bucket.refillPerMs);
  buckets.set(blueprintId, bucket);
  return { allowed: false, remaining: 0, retryInMs };
}

/** Reset all buckets — exported for tests. */
export function _resetBuckets(): void {
  buckets.clear();
}

/** Peek at a bucket without consuming — exported for introspection. */
export function peekBucket(blueprintId: string): Bucket | null {
  return buckets.get(blueprintId) ?? null;
}
