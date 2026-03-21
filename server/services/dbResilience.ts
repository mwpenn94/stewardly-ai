/**
 * Database Resilience Utilities
 * 
 * Shared helpers for retry logic, safe destructuring, and error handling
 * across all integration code paths. Ensures production stability when
 * DB connections are briefly unavailable (e.g., during deployment, cold start).
 */

import { getDb } from "../db";

// ─── Types ──────────────────────────────────────────────────────────────
export interface RetryOptions {
  maxRetries?: number;       // Default: 2 (3 total attempts)
  baseDelayMs?: number;      // Default: 2000ms
  backoffMultiplier?: number; // Default: 1.5
  context?: string;          // For logging (e.g., "getApiKeyForProvider")
}

// ─── Core: retry wrapper for any async DB operation ─────────────────────
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 2000,
    backoffMultiplier = 1.5,
    context = "dbOperation",
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isTransient = isTransientError(err);

      if (attempt < maxRetries && isTransient) {
        const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
        console.warn(
          `[DbResilience] ${context} attempt ${attempt + 1}/${maxRetries + 1} failed (transient): ${err.message}. Retrying in ${Math.round(delay)}ms...`,
        );
        await sleep(delay);
      } else if (attempt < maxRetries && !isTransient) {
        // Non-transient errors: still retry once in case it's a fluke
        if (attempt === 0) {
          const delay = baseDelayMs;
          console.warn(
            `[DbResilience] ${context} attempt ${attempt + 1} failed: ${err.message}. Retrying once in ${delay}ms...`,
          );
          await sleep(delay);
        } else {
          break; // Don't keep retrying non-transient errors
        }
      }
    }
  }

  throw lastError || new Error(`${context}: all retry attempts exhausted`);
}

// ─── Safe first-row extraction (replaces fragile [x] = await ...) ───────
export function firstOrNull<T>(rows: T[]): T | null {
  return rows.length > 0 ? rows[0] : null;
}

export function firstOrThrow<T>(rows: T[], errorMessage: string): T {
  if (rows.length === 0) throw new Error(errorMessage);
  return rows[0];
}

// ─── DB readiness check ─────────────────────────────────────────────────
export async function ensureDbReady(maxWaitMs = 15000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const db = await getDb();
      if (db) {
        // Try a simple query to verify the connection is actually working
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`SELECT 1`);
        return true;
      }
    } catch {
      // DB not ready yet
    }
    await sleep(checkInterval);
  }

  console.warn(`[DbResilience] DB not ready after ${maxWaitMs}ms`);
  return false;
}

// ─── Safe DB operation wrapper (getDb + retry + error boundary) ─────────
export async function safeDbOperation<T>(
  operation: (db: NonNullable<Awaited<ReturnType<typeof getDb>>>) => Promise<T>,
  options: RetryOptions & { fallback?: T } = {},
): Promise<T> {
  const { fallback, ...retryOpts } = options;

  try {
    return await withRetry(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database connection unavailable");
      return await operation(db);
    }, retryOpts);
  } catch (err: any) {
    if (fallback !== undefined) {
      console.warn(
        `[DbResilience] ${retryOpts.context || "safeDbOperation"} failed, using fallback: ${err.message}`,
      );
      return fallback;
    }
    throw err;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
function isTransientError(err: any): boolean {
  const message = (err.message || "").toLowerCase();
  const code = err.code || "";

  return (
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("epipe") ||
    message.includes("too many connections") ||
    message.includes("gone away") ||
    message.includes("lost connection") ||
    message.includes("deadlock") ||
    message.includes("lock wait") ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ER_LOCK_DEADLOCK"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
