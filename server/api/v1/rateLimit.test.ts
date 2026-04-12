/**
 * Unit tests for the pure rate limiter helpers.
 * Pass 6 of the hybrid build loop — PARITY-API-0001.
 */
import { describe, it, expect } from "vitest";
import {
  consumeToken,
  getOrCreateBucket,
  type RateLimitConfig,
  type TokenBucket,
} from "./rateLimit";

const cfg: RateLimitConfig = { capacity: 3, refillPerSec: 1 };

describe("api/v1/rateLimit — consumeToken", () => {
  it("allows the first request from a full bucket", () => {
    const bucket: TokenBucket = { tokens: 3, lastRefillMs: 0 };
    const r = consumeToken(bucket, cfg, 0);
    expect(r.allowed).toBe(true);
    expect(r.tokensRemaining).toBe(2);
  });

  it("denies when bucket is empty and no time has passed", () => {
    const bucket: TokenBucket = { tokens: 0, lastRefillMs: 1000 };
    const r = consumeToken(bucket, cfg, 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills over elapsed time", () => {
    const bucket: TokenBucket = { tokens: 0, lastRefillMs: 0 };
    // 2 seconds @ 1/sec refill = 2 tokens
    const r = consumeToken(bucket, cfg, 2_000);
    expect(r.allowed).toBe(true);
    expect(r.tokensRemaining).toBe(1);
  });

  it("caps refill at capacity", () => {
    const bucket: TokenBucket = { tokens: 0, lastRefillMs: 0 };
    // 10 seconds * 1/sec = 10, but capacity is 3
    const r = consumeToken(bucket, cfg, 10_000);
    expect(r.tokensRemaining).toBe(2); // 3 - 1 consumed = 2
  });

  it("burst of requests drains the bucket then rate limits", () => {
    const bucket: TokenBucket = { tokens: 3, lastRefillMs: 0 };
    const r1 = consumeToken(bucket, cfg, 100);
    const r2 = consumeToken(bucket, cfg, 101);
    const r3 = consumeToken(bucket, cfg, 102);
    const r4 = consumeToken(bucket, cfg, 103);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
  });

  it("computes retry-after from refill rate", () => {
    const bucket: TokenBucket = { tokens: 0, lastRefillMs: 100 };
    const r = consumeToken(bucket, cfg, 100);
    // Need 1 token at 1/sec → 1000ms
    expect(r.retryAfterMs).toBeCloseTo(1000, -2);
  });

  it("handles zero refill rate gracefully (fixed retry)", () => {
    const bucket: TokenBucket = { tokens: 0, lastRefillMs: 0 };
    const zeroRate: RateLimitConfig = { capacity: 1, refillPerSec: 0 };
    const r = consumeToken(bucket, zeroRate, 0);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(60_000);
  });
});

describe("api/v1/rateLimit — getOrCreateBucket", () => {
  it("creates a new bucket at full capacity", () => {
    const store = new Map<string, TokenBucket>();
    const b = getOrCreateBucket(store, "key1", cfg, 100);
    expect(b.tokens).toBe(3);
    expect(store.has("key1")).toBe(true);
  });

  it("returns the existing bucket on subsequent calls", () => {
    const store = new Map<string, TokenBucket>();
    const b1 = getOrCreateBucket(store, "k", cfg, 100);
    b1.tokens = 0.5;
    const b2 = getOrCreateBucket(store, "k", cfg, 200);
    expect(b2).toBe(b1);
    expect(b2.tokens).toBe(0.5);
  });

  it("tracks different keys independently", () => {
    const store = new Map<string, TokenBucket>();
    getOrCreateBucket(store, "a", cfg, 0);
    getOrCreateBucket(store, "b", cfg, 0);
    expect(store.size).toBe(2);
  });
});
