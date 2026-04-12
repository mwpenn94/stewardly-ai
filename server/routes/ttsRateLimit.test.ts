/**
 * ttsRateLimit.test.ts — CBL21 test coverage for CBL17 TTS rate limiting
 *
 * Tests the per-user rate limit logic added to the TTS endpoint.
 */
import { describe, it, expect } from "vitest";

// Replica of the TTS rate limit logic from tts.ts
const TTS_RATE_LIMIT = 30;
const TTS_RATE_WINDOW_MS = 60_000;

function createRateLimiter() {
  const limits = new Map<number, { count: number; resetAt: number }>();

  return {
    check(userId: number, now = Date.now()): boolean {
      const entry = limits.get(userId);
      if (!entry || now > entry.resetAt) {
        limits.set(userId, { count: 1, resetAt: now + TTS_RATE_WINDOW_MS });
        return true;
      }
      if (entry.count >= TTS_RATE_LIMIT) return false;
      entry.count++;
      return true;
    },
    getCount(userId: number) {
      return limits.get(userId)?.count ?? 0;
    },
  };
}

describe("TTS per-user rate limiter", () => {
  it("allows first request", () => {
    const limiter = createRateLimiter();
    expect(limiter.check(1)).toBe(true);
  });

  it("allows up to 30 requests in a window", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 30; i++) {
      expect(limiter.check(1)).toBe(true);
    }
    expect(limiter.getCount(1)).toBe(30);
  });

  it("blocks the 31st request", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 30; i++) limiter.check(1);
    expect(limiter.check(1)).toBe(false);
  });

  it("different users have independent limits", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 30; i++) limiter.check(1);
    expect(limiter.check(1)).toBe(false);
    // User 2 should still be able to make requests
    expect(limiter.check(2)).toBe(true);
  });

  it("resets after window expires", () => {
    const limiter = createRateLimiter();
    const now = Date.now();
    for (let i = 0; i < 30; i++) limiter.check(1, now);
    expect(limiter.check(1, now)).toBe(false);
    // Advance past window
    expect(limiter.check(1, now + TTS_RATE_WINDOW_MS + 1)).toBe(true);
  });

  it("tracks count correctly after reset", () => {
    const limiter = createRateLimiter();
    const now = Date.now();
    for (let i = 0; i < 30; i++) limiter.check(1, now);
    // After reset, count should be 1
    limiter.check(1, now + TTS_RATE_WINDOW_MS + 1);
    expect(limiter.getCount(1)).toBe(1);
  });
});
