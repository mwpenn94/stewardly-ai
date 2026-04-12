/**
 * toolRateLimiter.ts — per-user token bucket rate limiter (Parity Pass 11).
 *
 * A single malicious or careless prompt can drive the ReAct loop to
 * hammer the write tools / shell / external fetch endpoints dozens
 * of times per second. Without a rate limit:
 *   - run_bash could fork-bomb the server across many iterations
 *   - web_fetch could be turned into a low-rate DDoS against a
 *     third-party target (the SSRF guard blocks private hosts but
 *     not rate abuse of public ones)
 *   - write_file / edit_file could burn through disk quota
 *
 * This module provides a pure token-bucket reducer with per-tool-kind
 * config. It's used by the SSE route to gate every dispatch BEFORE
 * the subprocess / fetch fires; blocked calls return a specific
 * rate-limited error shape the agent can react to (retry with
 * different strategy, finish early, etc).
 *
 * Design:
 *   - Per user + per kind bucket (not per tool name) — categories
 *     share a budget so the agent can't evade by alternating tools
 *     in the same kind.
 *   - Pure reducer functions so the state itself lives in a caller-
 *     owned Map. Makes unit testing dead simple (no fake timers).
 *   - Buckets refill continuously based on elapsed-time math.
 *   - `allowed: false` returns `retryAfterMs` so the caller can
 *     surface a precise wait time.
 *   - Rates are conservative by default but overridable per
 *     deployment via options to `createRateLimitConfig`.
 */

import type { ToolKindLabel } from "./toolTelemetry";

// ─── Config ────────────────────────────────────────────────────────────

export interface BucketConfig {
  /** Maximum tokens the bucket can hold */
  capacity: number;
  /** Refill rate in tokens per SECOND */
  refillPerSecond: number;
}

export type RateLimitConfig = Record<ToolKindLabel, BucketConfig | null>;

/**
 * Default config — conservative enough to block abusive loops but
 * generous enough that a normal ReAct run never hits a limit. Rates
 * target "sustained abuse over 60 seconds" as the threshold.
 *
 *   reads: unlimited (null) — read-only tools are cheap and users
 *          frequently batch many reads in one session
 *   writes: 30/min burst 10 — a batch of coordinated edits shouldn't
 *           hit this; a fork-bomb will
 *   shell: 10/min burst 5 — conservative because bash is the
 *          highest-impact tool
 *   network: 20/min burst 10 — protect third-party endpoints
 *   meta: unlimited (null) — update_todos is a progress reporter
 *   unknown: uses writes config as a safety default
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  read: null,
  write: { capacity: 10, refillPerSecond: 30 / 60 },
  shell: { capacity: 5, refillPerSecond: 10 / 60 },
  network: { capacity: 10, refillPerSecond: 20 / 60 },
  meta: null,
  unknown: { capacity: 10, refillPerSecond: 30 / 60 },
};

export function createRateLimitConfig(
  overrides: Partial<RateLimitConfig> = {},
): RateLimitConfig {
  return { ...DEFAULT_RATE_LIMIT_CONFIG, ...overrides };
}

// ─── Bucket state ──────────────────────────────────────────────────────

export interface BucketState {
  /** Current token count (floating-point for fractional refill) */
  tokens: number;
  /** Last tick timestamp in ms */
  updatedAt: number;
}

export function emptyBucket(capacity: number, now: number): BucketState {
  return { tokens: capacity, updatedAt: now };
}

// ─── Refill ────────────────────────────────────────────────────────────

/**
 * Refill a bucket based on elapsed time. Pure — never mutates the
 * input. Caller is responsible for clock injection.
 */
export function refill(
  state: BucketState,
  config: BucketConfig,
  now: number,
): BucketState {
  if (now <= state.updatedAt) return state;
  const elapsedSec = (now - state.updatedAt) / 1000;
  const gained = elapsedSec * config.refillPerSecond;
  const tokens = Math.min(config.capacity, state.tokens + gained);
  return { tokens, updatedAt: now };
}

// ─── Take ──────────────────────────────────────────────────────────────

export interface TakeResult {
  allowed: boolean;
  /** If denied, how long the caller should wait before retrying */
  retryAfterMs: number;
  /** Next state (regardless of allow/deny — always reflects refill) */
  next: BucketState;
  /** Tokens remaining after the take (0 if denied) */
  remaining: number;
}

/**
 * Try to take one token from the bucket. Returns an `allowed`
 * boolean + the new state. Pure.
 */
export function take(
  state: BucketState,
  config: BucketConfig,
  now: number,
  cost = 1,
): TakeResult {
  const refilled = refill(state, config, now);
  if (refilled.tokens >= cost) {
    const next: BucketState = {
      tokens: refilled.tokens - cost,
      updatedAt: now,
    };
    return { allowed: true, retryAfterMs: 0, next, remaining: next.tokens };
  }
  // Not enough tokens — compute retry-after as the time needed to
  // accumulate the missing tokens given the refill rate.
  const missing = cost - refilled.tokens;
  const retryAfterMs =
    config.refillPerSecond > 0
      ? Math.ceil((missing / config.refillPerSecond) * 1000)
      : Number.POSITIVE_INFINITY;
  return {
    allowed: false,
    retryAfterMs,
    next: refilled,
    remaining: refilled.tokens,
  };
}

// ─── Per-user store ────────────────────────────────────────────────────

export interface UserBuckets {
  [kind: string]: BucketState;
}

/**
 * Check + consume a token for a given user/kind pair. Returns either
 * `{allowed: true}` or `{allowed: false, retryAfterMs, code,
 * message}` suitable for a dispatcher error result.
 *
 * `null` config for a kind means unlimited — the function just
 * returns allowed immediately without touching state.
 */
export function consumeFromStore(
  store: Map<string, UserBuckets>,
  userKey: string,
  kind: ToolKindLabel,
  config: RateLimitConfig,
  now: number,
):
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number; code: "RATE_LIMITED"; message: string } {
  const bucketConfig = config[kind];
  if (!bucketConfig) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  }
  let userBuckets = store.get(userKey);
  if (!userBuckets) {
    userBuckets = {};
    store.set(userKey, userBuckets);
  }
  const state = userBuckets[kind] ?? emptyBucket(bucketConfig.capacity, now);
  const result = take(state, bucketConfig, now);
  userBuckets[kind] = result.next;
  if (result.allowed) {
    return { allowed: true, remaining: result.remaining };
  }
  return {
    allowed: false,
    retryAfterMs: result.retryAfterMs,
    code: "RATE_LIMITED",
    message: `rate limit exceeded for ${kind} tools — retry in ${Math.ceil(result.retryAfterMs / 1000)}s`,
  };
}

/**
 * Periodic GC — drop user buckets that haven't been touched in the
 * last `maxAgeMs`. Safe to call on an interval; pure except for the
 * Map mutation (which the caller owns). Returns the number of entries
 * removed so callers can log it.
 */
export function gcStore(
  store: Map<string, UserBuckets>,
  now: number,
  maxAgeMs: number,
): number {
  let removed = 0;
  for (const [key, buckets] of Array.from(store.entries())) {
    let oldest = Infinity;
    for (const bucket of Object.values(buckets)) {
      if (bucket.updatedAt < oldest) oldest = bucket.updatedAt;
    }
    if (oldest !== Infinity && now - oldest > maxAgeMs) {
      store.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Singleton store used by the SSE route. Exposed so tests can reset
 * it between runs.
 */
const _globalStore: Map<string, UserBuckets> = new Map();

export function getGlobalRateLimitStore(): Map<string, UserBuckets> {
  return _globalStore;
}

export function resetGlobalRateLimitStore(): void {
  _globalStore.clear();
}
