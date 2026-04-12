/**
 * sseConnectionLimiter.ts — Per-user SSE connection limiter
 *
 * CBL17 security hardening: prevents a single user from opening
 * excessive SSE connections that exhaust server memory.
 *
 * Usage:
 *   if (!sseConnectionLimiter.acquire(userId, "chat")) {
 *     res.status(429).json({ error: "Too many concurrent streams" });
 *     return;
 *   }
 *   req.on("close", () => sseConnectionLimiter.release(userId, "chat"));
 */

export interface ConnectionLimiterConfig {
  /** Max concurrent SSE connections per user per endpoint type (default 5) */
  maxPerUserPerType: number;
  /** Max concurrent SSE connections per user across all types (default 10) */
  maxPerUserTotal: number;
  /** Idle timeout in ms — auto-close if no writes for this long (default 30 min) */
  idleTimeoutMs: number;
}

const DEFAULT_CONFIG: ConnectionLimiterConfig = {
  maxPerUserPerType: 5,
  maxPerUserTotal: 10,
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
};

interface ConnectionEntry {
  userId: number;
  type: string;
  createdAt: number;
}

class SseConnectionLimiter {
  private connections = new Map<string, ConnectionEntry>(); // connId -> entry
  private userCounts = new Map<string, number>(); // "userId:type" -> count
  private userTotals = new Map<number, number>(); // userId -> total count
  private config: ConnectionLimiterConfig;
  private connCounter = 0;

  constructor(config: Partial<ConnectionLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Try to acquire a connection slot.
   * Returns a connection ID if successful, or null if limits exceeded.
   */
  acquire(userId: number, type: string): string | null {
    const userTypeKey = `${userId}:${type}`;
    const currentPerType = this.userCounts.get(userTypeKey) ?? 0;
    const currentTotal = this.userTotals.get(userId) ?? 0;

    if (currentPerType >= this.config.maxPerUserPerType) return null;
    if (currentTotal >= this.config.maxPerUserTotal) return null;

    const connId = `sse-${++this.connCounter}`;
    this.connections.set(connId, { userId, type, createdAt: Date.now() });
    this.userCounts.set(userTypeKey, currentPerType + 1);
    this.userTotals.set(userId, currentTotal + 1);

    return connId;
  }

  /**
   * Release a connection slot when the SSE stream closes.
   */
  release(connId: string): void {
    const entry = this.connections.get(connId);
    if (!entry) return;

    this.connections.delete(connId);

    const userTypeKey = `${entry.userId}:${entry.type}`;
    const currentPerType = this.userCounts.get(userTypeKey) ?? 1;
    if (currentPerType <= 1) {
      this.userCounts.delete(userTypeKey);
    } else {
      this.userCounts.set(userTypeKey, currentPerType - 1);
    }

    const currentTotal = this.userTotals.get(entry.userId) ?? 1;
    if (currentTotal <= 1) {
      this.userTotals.delete(entry.userId);
    } else {
      this.userTotals.set(entry.userId, currentTotal - 1);
    }
  }

  /** Get stats for observability */
  stats(): { totalConnections: number; uniqueUsers: number } {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userTotals.size,
    };
  }
}

/** Shared singleton limiter for all SSE endpoints */
export const sseConnectionLimiter = new SseConnectionLimiter();
