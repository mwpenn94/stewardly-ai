import { describe, it, expect, beforeEach } from "vitest";
import {
  applyRefill,
  checkAndConsumeRate,
  peekBucket,
  _resetBuckets,
} from "./rateLimiter";

beforeEach(() => _resetBuckets());

describe("applyRefill", () => {
  it("refills tokens based on elapsed time", () => {
    const bucket = {
      tokens: 0,
      capacity: 60,
      refillPerMs: 60 / 60_000,
      lastRefillMs: 0,
    };
    const refilled = applyRefill(bucket, 60_000);
    expect(refilled.tokens).toBe(60);
  });
  it("caps at capacity", () => {
    const bucket = {
      tokens: 50,
      capacity: 60,
      refillPerMs: 60 / 60_000,
      lastRefillMs: 0,
    };
    const refilled = applyRefill(bucket, 120_000);
    expect(refilled.tokens).toBe(60);
  });
  it("does not go below starting tokens when elapsed==0", () => {
    const bucket = {
      tokens: 30,
      capacity: 60,
      refillPerMs: 60 / 60_000,
      lastRefillMs: 1000,
    };
    const refilled = applyRefill(bucket, 1000);
    expect(refilled.tokens).toBe(30);
  });
});

describe("checkAndConsumeRate", () => {
  it("allows the first request", () => {
    const r = checkAndConsumeRate("bp-1", 10, 0);
    expect(r.allowed).toBe(true);
  });
  it("rejects after burst exceeded", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkAndConsumeRate("bp-2", 10, 0).allowed).toBe(true);
    }
    // 11th call at t=0 should be rejected
    const r = checkAndConsumeRate("bp-2", 10, 0);
    expect(r.allowed).toBe(false);
    expect(r.retryInMs).toBeGreaterThan(0);
  });
  it("refills over time", () => {
    for (let i = 0; i < 10; i++) checkAndConsumeRate("bp-3", 10, 0);
    expect(checkAndConsumeRate("bp-3", 10, 0).allowed).toBe(false);
    // After 6 seconds, 1 token has refilled
    const r = checkAndConsumeRate("bp-3", 10, 6000);
    expect(r.allowed).toBe(true);
  });
  it("allows unlimited when ratePerMin <= 0", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkAndConsumeRate("bp-4", 0, 0).allowed).toBe(true);
    }
    expect(checkAndConsumeRate("bp-4", -5, 0).allowed).toBe(true);
  });
  it("rescales bucket when capacity changes", () => {
    checkAndConsumeRate("bp-5", 10, 0);
    checkAndConsumeRate("bp-5", 10, 0);
    // Lower capacity to 5 — the bucket's tokens should clamp.
    const r = checkAndConsumeRate("bp-5", 5, 0);
    expect(r.allowed).toBe(true);
    const bucket = peekBucket("bp-5")!;
    expect(bucket.capacity).toBe(5);
    expect(bucket.tokens).toBeLessThanOrEqual(5);
  });
});
