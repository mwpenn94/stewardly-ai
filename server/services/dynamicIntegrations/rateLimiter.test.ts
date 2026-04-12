/**
 * Tests for rateLimiter.ts (Pass 9 — token bucket per-source rate limiting).
 *
 * Uses a virtual clock + virtual sleep so tests run in milliseconds
 * regardless of the limiter's refill rate.
 */

import { describe, it, expect } from "vitest";
import {
  TokenBucketRateLimiter,
  RateLimiterRegistry,
  RateLimitedError,
  getLimiterForSpec,
} from "./rateLimiter";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";

// ─── Virtual clock + sleep helpers ─────────────────────────────────────────

function makeVirtualClock(startTime = 1_700_000_000_000) {
  let current = startTime;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
    // Virtual sleep: advance time + yield to microtasks
    sleep: async (ms: number) => {
      current += ms;
      // Yield so queued promises can run
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
}

// ─── TokenBucketRateLimiter ────────────────────────────────────────────────

describe("TokenBucketRateLimiter — basic acquire", () => {
  it("allows up to capacity immediately", () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillPerSecond: 1,
      now: clock.now,
      sleep: clock.sleep,
    });
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);
  });

  it("refills tokens over time", () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillPerSecond: 10,
      now: clock.now,
      sleep: clock.sleep,
    });
    // Drain
    for (let i = 0; i < 5; i++) limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);
    // Advance 1 second → 10 tokens added (but capped at 5)
    clock.advance(1000);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
  });

  it("does not exceed capacity even with long idle", () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillPerSecond: 10,
      now: clock.now,
      sleep: clock.sleep,
    });
    clock.advance(60_000); // 60s idle
    const snapshot = limiter.snapshot();
    expect(snapshot.tokens).toBeLessThanOrEqual(5);
  });
});

describe("TokenBucketRateLimiter — async acquire", () => {
  it("resolves immediately when tokens are available", async () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillPerSecond: 1,
      now: clock.now,
      sleep: clock.sleep,
    });
    await limiter.acquire();
    expect(limiter.snapshot().tokens).toBe(4);
  });

  it("waits until refill when bucket is empty", async () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillPerSecond: 1, // 1 token per second
      now: clock.now,
      sleep: clock.sleep,
    });
    // Drain
    await limiter.acquire();
    await limiter.acquire();
    // Third acquire should wait
    const promise = limiter.acquire({ timeoutMs: 5_000 });
    await promise; // virtual clock advances automatically
    expect(limiter.snapshot().tokens).toBeLessThan(1);
  });

  it("throws RateLimitedError on timeout", async () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 0.01, // 1 token every 100s (effectively never during test)
      now: clock.now,
      sleep: clock.sleep,
    });
    await limiter.acquire();
    await expect(limiter.acquire({ timeoutMs: 100 })).rejects.toThrow(RateLimitedError);
  });

  it("processes queue in FIFO order", async () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 100,
      now: clock.now,
      sleep: clock.sleep,
    });
    // Drain initial token
    await limiter.acquire();
    const results: number[] = [];
    const p1 = limiter.acquire({ timeoutMs: 10_000 }).then(() => results.push(1));
    const p2 = limiter.acquire({ timeoutMs: 10_000 }).then(() => results.push(2));
    const p3 = limiter.acquire({ timeoutMs: 10_000 }).then(() => results.push(3));
    await Promise.all([p1, p2, p3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it("cancelAll rejects queued waiters", async () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 0.001,
      now: clock.now,
      sleep: clock.sleep,
    });
    await limiter.acquire();
    // Attach catch early to prevent unhandled rejection in the virtual-clock
    // race where drainQueue may reject via deadline before cancelAll lands.
    // Either rejection is correct — we just want ONE of them caught.
    const p1 = limiter.acquire({ timeoutMs: 60_000 });
    const swallowed: Array<Error> = [];
    p1.catch((e) => swallowed.push(e));
    await new Promise<void>((resolve) => setImmediate(resolve));
    limiter.cancelAll("test");
    // Wait for the rejection to land
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(swallowed.length).toBe(1);
    expect(swallowed[0]).toBeInstanceOf(RateLimitedError);
  });
});

describe("TokenBucketRateLimiter — snapshot", () => {
  it("exposes current state", () => {
    const clock = makeVirtualClock();
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillPerSecond: 5,
      now: clock.now,
      sleep: clock.sleep,
    });
    const snapshot = limiter.snapshot();
    expect(snapshot.capacity).toBe(10);
    expect(snapshot.refillPerSecond).toBe(5);
    expect(snapshot.tokens).toBe(10);
    expect(snapshot.queuedCount).toBe(0);
  });
});

// ─── RateLimiterRegistry ──────────────────────────────────────────────────

describe("RateLimiterRegistry", () => {
  it("isolates limiters per source", () => {
    const registry = new RateLimiterRegistry();
    const clock = makeVirtualClock();
    const a = registry.getOrCreate("source-a", { capacity: 5, refillPerSecond: 1, now: clock.now, sleep: clock.sleep });
    const b = registry.getOrCreate("source-b", { capacity: 5, refillPerSecond: 1, now: clock.now, sleep: clock.sleep });
    // Drain a
    for (let i = 0; i < 5; i++) a.tryAcquire();
    expect(a.tryAcquire()).toBe(false);
    // b should still have full capacity
    expect(b.tryAcquire()).toBe(true);
  });

  it("returns the same limiter for a repeat call", () => {
    const registry = new RateLimiterRegistry();
    const clock = makeVirtualClock();
    const a1 = registry.getOrCreate("src", { capacity: 5, refillPerSecond: 1, now: clock.now, sleep: clock.sleep });
    const a2 = registry.getOrCreate("src", { capacity: 99, refillPerSecond: 99, now: clock.now, sleep: clock.sleep });
    expect(a1).toBe(a2);
    // Config only applies on first create
    expect(a2.snapshot().capacity).toBe(5);
  });

  it("delete removes the limiter and cancels its queue", async () => {
    const registry = new RateLimiterRegistry();
    const clock = makeVirtualClock();
    const limiter = registry.getOrCreate("src", { capacity: 1, refillPerSecond: 0.001, now: clock.now, sleep: clock.sleep });
    await limiter.acquire();
    const p = limiter.acquire({ timeoutMs: 60_000 });
    const swallowed: Array<Error> = [];
    p.catch((e) => swallowed.push(e));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const deleted = registry.delete("src");
    expect(deleted).toBe(true);
    expect(registry.get("src")).toBeUndefined();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(swallowed.length).toBe(1);
    expect(swallowed[0]).toBeInstanceOf(RateLimitedError);
  });

  it("snapshotAll returns a map of limiter states", () => {
    const registry = new RateLimiterRegistry();
    const clock = makeVirtualClock();
    registry.getOrCreate("a", { capacity: 5, refillPerSecond: 1, now: clock.now, sleep: clock.sleep });
    registry.getOrCreate("b", { capacity: 10, refillPerSecond: 2, now: clock.now, sleep: clock.sleep });
    const all = registry.snapshotAll();
    expect(Object.keys(all)).toContain("a");
    expect(Object.keys(all)).toContain("b");
    expect(all.a.capacity).toBe(5);
    expect(all.b.capacity).toBe(10);
  });
});

// ─── getLimiterForSpec ────────────────────────────────────────────────────

describe("getLimiterForSpec", () => {
  it("builds a limiter from an AdapterSpec's rateLimit config", () => {
    const schema = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const spec = generateAdapter(schema, {
      name: "RateLimitedApi",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
      rateLimitHint: { requestsPerSecond: 3, burstBudget: 6 },
    });
    const registry = new RateLimiterRegistry();
    const limiter = getLimiterForSpec(spec, registry);
    const snap = limiter.snapshot();
    expect(snap.capacity).toBe(6);
    expect(snap.refillPerSecond).toBe(3);
  });

  it("shares a limiter for specs with the same name", () => {
    const schema = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const spec1 = generateAdapter(schema, {
      name: "Shared",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const spec2 = generateAdapter(schema, {
      name: "Shared",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const registry = new RateLimiterRegistry();
    const a = getLimiterForSpec(spec1, registry);
    const b = getLimiterForSpec(spec2, registry);
    expect(a).toBe(b);
  });
});
