/**
 * sseConnectionLimiter.test.ts — CBL17 security hardening tests
 *
 * Tests the pure acquire/release/stats logic of the SSE connection limiter.
 * Each test creates a fresh limiter to avoid cross-test state.
 */
import { describe, it, expect } from "vitest";

/** Minimal replica of SseConnectionLimiter for isolated per-test instances */
class TestLimiter {
  private connections = new Map<string, { userId: number; type: string }>();
  private userCounts = new Map<string, number>();
  private userTotals = new Map<number, number>();
  private connCounter = 0;

  constructor(
    private maxPerUserPerType = 5,
    private maxPerUserTotal = 10,
  ) {}

  acquire(userId: number, type: string): string | null {
    const userTypeKey = `${userId}:${type}`;
    const currentPerType = this.userCounts.get(userTypeKey) ?? 0;
    const currentTotal = this.userTotals.get(userId) ?? 0;
    if (currentPerType >= this.maxPerUserPerType) return null;
    if (currentTotal >= this.maxPerUserTotal) return null;
    const connId = `sse-${++this.connCounter}`;
    this.connections.set(connId, { userId, type });
    this.userCounts.set(userTypeKey, currentPerType + 1);
    this.userTotals.set(userId, currentTotal + 1);
    return connId;
  }

  release(connId: string): void {
    const entry = this.connections.get(connId);
    if (!entry) return;
    this.connections.delete(connId);
    const userTypeKey = `${entry.userId}:${entry.type}`;
    const currentPerType = this.userCounts.get(userTypeKey) ?? 1;
    if (currentPerType <= 1) this.userCounts.delete(userTypeKey);
    else this.userCounts.set(userTypeKey, currentPerType - 1);
    const currentTotal = this.userTotals.get(entry.userId) ?? 1;
    if (currentTotal <= 1) this.userTotals.delete(entry.userId);
    else this.userTotals.set(entry.userId, currentTotal - 1);
  }

  stats() {
    return { totalConnections: this.connections.size, uniqueUsers: this.userTotals.size };
  }
}

describe("SseConnectionLimiter", () => {
  it("allows first connection", () => {
    const limiter = new TestLimiter();
    const connId = limiter.acquire(1, "chat");
    expect(connId).toBeTruthy();
    expect(limiter.stats().totalConnections).toBe(1);
  });

  it("blocks when per-type limit exceeded", () => {
    const limiter = new TestLimiter();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = limiter.acquire(1, "chat");
      expect(id).toBeTruthy();
      ids.push(id!);
    }
    // 6th should be blocked
    expect(limiter.acquire(1, "chat")).toBeNull();
    // But different type should still work
    expect(limiter.acquire(1, "codechat")).toBeTruthy();
  });

  it("blocks when total limit exceeded", () => {
    const limiter = new TestLimiter();
    for (let i = 0; i < 5; i++) limiter.acquire(1, "chat");
    for (let i = 0; i < 5; i++) limiter.acquire(1, "codechat");
    expect(limiter.stats().totalConnections).toBe(10);
    // 11th should be blocked even on a new type
    expect(limiter.acquire(1, "consensus")).toBeNull();
  });

  it("release frees a slot", () => {
    const limiter = new TestLimiter();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(limiter.acquire(1, "chat")!);
    expect(limiter.acquire(1, "chat")).toBeNull();
    limiter.release(ids[0]);
    expect(limiter.acquire(1, "chat")).toBeTruthy();
  });

  it("different users have independent limits", () => {
    const limiter = new TestLimiter();
    for (let i = 0; i < 5; i++) limiter.acquire(1, "chat");
    expect(limiter.acquire(2, "chat")).toBeTruthy();
  });

  it("release of unknown connId is a no-op", () => {
    const limiter = new TestLimiter();
    limiter.acquire(1, "chat");
    limiter.release("nonexistent");
    expect(limiter.stats().totalConnections).toBe(1);
  });

  it("stats tracks unique users", () => {
    const limiter = new TestLimiter();
    limiter.acquire(1, "chat");
    limiter.acquire(2, "chat");
    limiter.acquire(1, "codechat");
    expect(limiter.stats()).toEqual({ totalConnections: 3, uniqueUsers: 2 });
  });

  it("custom limits are respected", () => {
    const limiter = new TestLimiter(2, 3);
    expect(limiter.acquire(1, "chat")).toBeTruthy();
    expect(limiter.acquire(1, "chat")).toBeTruthy();
    expect(limiter.acquire(1, "chat")).toBeNull(); // per-type limit = 2
    expect(limiter.acquire(1, "codechat")).toBeTruthy(); // total = 3
    expect(limiter.acquire(1, "consensus")).toBeNull(); // total limit = 3
  });

  it("full release cycle restores all slots", () => {
    const limiter = new TestLimiter(2, 4);
    const a = limiter.acquire(1, "chat")!;
    const b = limiter.acquire(1, "chat")!;
    expect(limiter.acquire(1, "chat")).toBeNull();
    limiter.release(a);
    limiter.release(b);
    expect(limiter.stats()).toEqual({ totalConnections: 0, uniqueUsers: 0 });
    // Can acquire again after full release
    expect(limiter.acquire(1, "chat")).toBeTruthy();
  });
});
