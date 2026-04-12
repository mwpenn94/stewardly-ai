/**
 * toolRateLimiter.test.ts — Parity Pass 11.
 *
 * Covers the pure token-bucket reducer + the per-user store glue.
 * Clock is always injected so no fake timers are needed.
 */

import { describe, it, expect } from "vitest";
import {
  refill,
  take,
  consumeFromStore,
  gcStore,
  emptyBucket,
  DEFAULT_RATE_LIMIT_CONFIG,
  createRateLimitConfig,
  type BucketConfig,
  type UserBuckets,
} from "./toolRateLimiter";

const cfg: BucketConfig = { capacity: 10, refillPerSecond: 1 };

// ─── refill ────────────────────────────────────────────────────────

describe("refill", () => {
  it("returns state unchanged when no time has passed", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    expect(refill(s, cfg, 1000)).toEqual(s);
  });

  it("returns state unchanged when now is before updatedAt", () => {
    const s = { tokens: 5, updatedAt: 2000 };
    expect(refill(s, cfg, 1000)).toEqual(s);
  });

  it("adds tokens proportional to elapsed seconds", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    const r = refill(s, cfg, 3000); // 2 seconds → 2 tokens
    expect(r.tokens).toBe(7);
    expect(r.updatedAt).toBe(3000);
  });

  it("caps at capacity", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    const r = refill(s, cfg, 1000 + 60_000); // 60 seconds → 60 tokens
    expect(r.tokens).toBe(10); // capped at 10
  });

  it("handles fractional refill", () => {
    const s = { tokens: 0, updatedAt: 1000 };
    const r = refill(s, cfg, 1500); // 0.5 seconds → 0.5 tokens
    expect(r.tokens).toBe(0.5);
  });
});

// ─── take ──────────────────────────────────────────────────────────

describe("take", () => {
  it("allows when bucket has tokens", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    const r = take(s, cfg, 1000);
    expect(r.allowed).toBe(true);
    expect(r.next.tokens).toBe(4);
    expect(r.remaining).toBe(4);
    expect(r.retryAfterMs).toBe(0);
  });

  it("refills before taking (combined operation)", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    const r = take(s, cfg, 3000); // refill adds 2 → 7, take → 6
    expect(r.allowed).toBe(true);
    expect(r.next.tokens).toBe(6);
  });

  it("denies when empty", () => {
    const s = { tokens: 0, updatedAt: 1000 };
    const r = take(s, cfg, 1000);
    expect(r.allowed).toBe(false);
    expect(r.next.tokens).toBe(0);
    expect(r.remaining).toBe(0);
    // 1 token needed at 1/s = 1000ms retry
    expect(r.retryAfterMs).toBe(1000);
  });

  it("computes retry-after proportional to refill rate", () => {
    const slow: BucketConfig = { capacity: 10, refillPerSecond: 0.5 }; // 1 token per 2s
    const s = { tokens: 0, updatedAt: 1000 };
    const r = take(s, slow, 1000);
    expect(r.retryAfterMs).toBe(2000);
  });

  it("honors cost > 1", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    const r = take(s, cfg, 1000, 3);
    expect(r.allowed).toBe(true);
    expect(r.next.tokens).toBe(2);
  });

  it("denies when cost exceeds available", () => {
    const s = { tokens: 2, updatedAt: 1000 };
    const r = take(s, cfg, 1000, 5);
    expect(r.allowed).toBe(false);
    // 3 missing at 1/s = 3000ms retry
    expect(r.retryAfterMs).toBe(3000);
  });

  it("returns Infinity retry-after when refillRate is 0", () => {
    const dead: BucketConfig = { capacity: 1, refillPerSecond: 0 };
    const s = { tokens: 0, updatedAt: 1000 };
    const r = take(s, dead, 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(Number.POSITIVE_INFINITY);
  });

  it("does not mutate input state", () => {
    const s = { tokens: 5, updatedAt: 1000 };
    take(s, cfg, 3000);
    expect(s).toEqual({ tokens: 5, updatedAt: 1000 });
  });
});

// ─── emptyBucket ───────────────────────────────────────────────────

describe("emptyBucket", () => {
  it("starts at full capacity", () => {
    const b = emptyBucket(10, 1000);
    expect(b.tokens).toBe(10);
    expect(b.updatedAt).toBe(1000);
  });
});

// ─── consumeFromStore ──────────────────────────────────────────────

describe("consumeFromStore", () => {
  it("allows unlimited kinds (null config)", () => {
    const store = new Map<string, UserBuckets>();
    const r = consumeFromStore(store, "user1", "read", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    expect(r.allowed).toBe(true);
    // Store shouldn't be touched for unlimited kinds
    expect(store.size).toBe(0);
  });

  it("allows first write from a fresh user", () => {
    const store = new Map<string, UserBuckets>();
    const r = consumeFromStore(store, "user1", "write", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    expect(r.allowed).toBe(true);
    expect(store.get("user1")?.write).toBeDefined();
  });

  it("denies after capacity is exhausted", () => {
    const store = new Map<string, UserBuckets>();
    // Shell has capacity 5
    for (let i = 0; i < 5; i++) {
      const r = consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
      expect(r.allowed).toBe(true);
    }
    const r6 = consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    expect(r6.allowed).toBe(false);
    if (!r6.allowed) {
      expect(r6.code).toBe("RATE_LIMITED");
      expect(r6.message).toContain("shell");
      expect(r6.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("allows again after refill", () => {
    const store = new Map<string, UserBuckets>();
    // Exhaust
    for (let i = 0; i < 5; i++) {
      consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    }
    expect(
      consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000).allowed,
    ).toBe(false);
    // 60 seconds later at 10/min, 10 tokens should be available (capped at 5)
    const later = consumeFromStore(
      store,
      "user1",
      "shell",
      DEFAULT_RATE_LIMIT_CONFIG,
      1000 + 60_000,
    );
    expect(later.allowed).toBe(true);
  });

  it("isolates per-user buckets", () => {
    const store = new Map<string, UserBuckets>();
    // user1 exhausts shell
    for (let i = 0; i < 5; i++) {
      consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    }
    // user2 still has a full bucket
    const r = consumeFromStore(store, "user2", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    expect(r.allowed).toBe(true);
  });

  it("isolates per-kind buckets for the same user", () => {
    const store = new Map<string, UserBuckets>();
    // Exhaust shell
    for (let i = 0; i < 5; i++) {
      consumeFromStore(store, "user1", "shell", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    }
    // Write is a separate kind, still available
    const r = consumeFromStore(store, "user1", "write", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    expect(r.allowed).toBe(true);
  });
});

// ─── createRateLimitConfig ────────────────────────────────────────

describe("createRateLimitConfig", () => {
  it("returns defaults when no overrides", () => {
    const c = createRateLimitConfig();
    expect(c.write).toEqual(DEFAULT_RATE_LIMIT_CONFIG.write);
  });

  it("merges overrides", () => {
    const c = createRateLimitConfig({
      write: { capacity: 100, refillPerSecond: 10 },
    });
    expect(c.write).toEqual({ capacity: 100, refillPerSecond: 10 });
    // Other kinds unchanged
    expect(c.shell).toEqual(DEFAULT_RATE_LIMIT_CONFIG.shell);
  });

  it("allows setting a kind to unlimited (null)", () => {
    const c = createRateLimitConfig({ shell: null });
    expect(c.shell).toBeNull();
  });
});

// ─── gcStore ──────────────────────────────────────────────────────

describe("gcStore", () => {
  it("removes users whose buckets are older than maxAge", () => {
    const store = new Map<string, UserBuckets>();
    consumeFromStore(store, "old", "write", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    consumeFromStore(store, "new", "write", DEFAULT_RATE_LIMIT_CONFIG, 10_000);
    expect(store.size).toBe(2);
    const removed = gcStore(store, 15_000, 5_000);
    expect(removed).toBe(1);
    expect(store.has("old")).toBe(false);
    expect(store.has("new")).toBe(true);
  });

  it("returns 0 when nothing is old enough", () => {
    const store = new Map<string, UserBuckets>();
    consumeFromStore(store, "u", "write", DEFAULT_RATE_LIMIT_CONFIG, 1000);
    const removed = gcStore(store, 2000, 5000);
    expect(removed).toBe(0);
    expect(store.has("u")).toBe(true);
  });

  it("handles empty store", () => {
    const store = new Map<string, UserBuckets>();
    expect(gcStore(store, 1000, 5000)).toBe(0);
  });
});
