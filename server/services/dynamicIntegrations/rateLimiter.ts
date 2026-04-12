/**
 * Rate Limiter — per-source token bucket
 *
 * Keeps adapters honest when multiple pipeline runs target the same
 * third-party source concurrently. Each source has a token bucket sized
 * to its rate-limit budget; calls must `acquire()` a token before
 * firing HTTP, and the limiter releases + refills tokens over time.
 *
 * Key properties:
 *   - Per-source isolation: a slow source doesn't starve faster sources
 *   - Burst budget: short bursts are allowed up to the bucket capacity
 *   - Refill rate: tokens replenish at a configurable rate per second
 *   - Queue-based ordering: acquire() returns in FIFO order
 *   - Graceful stall: if a caller times out, its slot is released
 *
 * The limiter is deterministic and testable: it accepts a `now` and
 * `sleep` dependency so tests can drive time manually.
 *
 * Pure state machine + async coordinator. No network. No database.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  capacity: number;           // max tokens in the bucket (burst budget)
  refillPerSecond: number;    // tokens added per second
  now?: () => number;         // injectable clock (default Date.now)
  sleep?: (ms: number) => Promise<void>; // injectable sleep
}

export interface AcquireOptions {
  timeoutMs?: number;         // max wait before throwing; default 30000
  tokens?: number;            // default 1
}

export interface RateLimiterSnapshot {
  capacity: number;
  refillPerSecond: number;
  tokens: number;             // current available tokens
  lastRefillAt: number;
  queuedCount: number;
}

export class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

// ─── Token bucket implementation ──────────────────────────────────────────

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private tokens: number;
  private lastRefillAt: number;
  private queue: Array<{
    tokens: number;
    resolve: () => void;
    reject: (err: Error) => void;
    deadline: number;
  }>;

  constructor(config: RateLimiterConfig) {
    this.capacity = Math.max(1, config.capacity);
    this.refillPerSecond = Math.max(0.001, config.refillPerSecond);
    this.now = config.now ?? Date.now;
    this.sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.tokens = this.capacity;
    this.lastRefillAt = this.now();
    this.queue = [];
  }

  /**
   * Refill the bucket based on elapsed time since last refill. Pure state
   * update — safe to call as often as desired.
   */
  private refill(): void {
    const currentTime = this.now();
    const elapsedMs = currentTime - this.lastRefillAt;
    if (elapsedMs <= 0) return;
    const addedTokens = (elapsedMs / 1000) * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
    this.lastRefillAt = currentTime;
  }

  /**
   * Try to acquire N tokens synchronously without waiting. Returns true
   * if successful, false otherwise. Does NOT queue.
   */
  tryAcquire(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Acquire tokens, waiting up to `timeoutMs` if the bucket is empty.
   * Throws RateLimitedError on timeout. Uses an internal queue to
   * preserve FIFO order across concurrent callers.
   */
  async acquire(options: AcquireOptions = {}): Promise<void> {
    const tokensNeeded = options.tokens ?? 1;
    const timeoutMs = options.timeoutMs ?? 30_000;

    // Fast path: queue is empty and tokens are available
    if (this.queue.length === 0 && this.tryAcquire(tokensNeeded)) {
      return;
    }

    // Slow path: enqueue + wait
    const deadline = this.now() + timeoutMs;
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ tokens: tokensNeeded, resolve, reject, deadline });
      void this.drainQueue();
    });
  }

  /**
   * Attempt to satisfy queued waiters in FIFO order. Called on every
   * arrival + after each refill interval.
   */
  private async drainQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    // One draining loop at a time per instance
    if (this._draining) return;
    this._draining = true;
    try {
      while (this.queue.length > 0) {
        const head = this.queue[0];

        // Drop expired
        const now = this.now();
        if (now >= head.deadline) {
          this.queue.shift();
          head.reject(new RateLimitedError(`Rate limit wait exceeded ${head.deadline - (now - 1)}ms`));
          continue;
        }

        this.refill();
        if (this.tokens >= head.tokens) {
          this.tokens -= head.tokens;
          this.queue.shift();
          head.resolve();
          continue;
        }

        // Not enough tokens — compute how long until we have enough
        const missing = head.tokens - this.tokens;
        const waitMs = Math.ceil((missing / this.refillPerSecond) * 1000);
        const clampedWait = Math.min(waitMs, Math.max(0, head.deadline - now));
        if (clampedWait <= 0) {
          // Deadline reached
          this.queue.shift();
          head.reject(new RateLimitedError("Rate limit deadline reached"));
          continue;
        }
        await this.sleep(clampedWait);
      }
    } finally {
      this._draining = false;
    }
  }
  private _draining = false;

  /**
   * Return a snapshot of the limiter state for debugging / UI display.
   */
  snapshot(): RateLimiterSnapshot {
    this.refill();
    return {
      capacity: this.capacity,
      refillPerSecond: this.refillPerSecond,
      tokens: this.tokens,
      lastRefillAt: this.lastRefillAt,
      queuedCount: this.queue.length,
    };
  }

  /**
   * Cancel all queued waiters with a custom error. Used by the
   * orchestrator when a pipeline run is aborted.
   */
  cancelAll(reason: string): void {
    while (this.queue.length > 0) {
      const w = this.queue.shift()!;
      w.reject(new RateLimitedError(`Cancelled: ${reason}`));
    }
  }
}

// ─── Registry — one limiter per source ────────────────────────────────────

/**
 * Per-source registry so every source gets its own bucket. Keyed by a
 * stable sourceKey (typically the adapter name or base URL).
 */
export class RateLimiterRegistry {
  private readonly limiters = new Map<string, TokenBucketRateLimiter>();

  getOrCreate(sourceKey: string, config: RateLimiterConfig): TokenBucketRateLimiter {
    const existing = this.limiters.get(sourceKey);
    if (existing) return existing;
    const limiter = new TokenBucketRateLimiter(config);
    this.limiters.set(sourceKey, limiter);
    return limiter;
  }

  get(sourceKey: string): TokenBucketRateLimiter | undefined {
    return this.limiters.get(sourceKey);
  }

  /**
   * Delete a limiter — useful when rotating config or tearing down
   * an adapter. Any queued waiters are rejected.
   */
  delete(sourceKey: string, reason = "removed"): boolean {
    const limiter = this.limiters.get(sourceKey);
    if (!limiter) return false;
    limiter.cancelAll(reason);
    this.limiters.delete(sourceKey);
    return true;
  }

  /**
   * Snapshot all limiters for a dashboard view.
   */
  snapshotAll(): Record<string, RateLimiterSnapshot> {
    const out: Record<string, RateLimiterSnapshot> = {};
    for (const [key, limiter] of Array.from(this.limiters.entries())) {
      out[key] = limiter.snapshot();
    }
    return out;
  }

  size(): number {
    return this.limiters.size;
  }

  clear(): void {
    for (const limiter of Array.from(this.limiters.values())) {
      limiter.cancelAll("registry cleared");
    }
    this.limiters.clear();
  }
}

// Process-global registry for production use. Tests should create their
// own registry to avoid cross-test contamination.
export const globalRateLimiterRegistry = new RateLimiterRegistry();

// ─── Integration helper for AdapterSpec ───────────────────────────────────

import type { AdapterSpec } from "./adapterGenerator";

/**
 * Create or fetch a rate limiter tuned to an AdapterSpec's rateLimit spec.
 * Uses sourceKey = spec.name so specs with the same name share a bucket.
 */
export function getLimiterForSpec(
  spec: AdapterSpec,
  registry = globalRateLimiterRegistry,
): TokenBucketRateLimiter {
  const rps = spec.rateLimit.requestsPerSecond ?? 5;
  const capacity = spec.rateLimit.burstBudget ?? 10;
  return registry.getOrCreate(spec.name, {
    capacity,
    refillPerSecond: rps,
  });
}
