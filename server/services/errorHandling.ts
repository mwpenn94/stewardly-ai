/**
 * Task #27 — Error Handling Service
 * Structured error boundaries, retry logic, graceful degradation,
 * and server-side error logging.
 */
import { getDb } from "../db";
import { serverErrors } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface StructuredError {
  type: string;
  message: string;
  stack?: string;
  componentName?: string;
  userId?: number;
  url?: string;
  metadata?: Record<string, any>;
}

// ─── Log Error ───────────────────────────────────────────────────────────
export async function logError(error: StructuredError): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const [result] = await db.insert(serverErrors).values({
    errorType: error.type,
    message: error.message,
    stack: error.stack,
    componentName: error.componentName,
    userId: error.userId,
    url: error.url,
    metadata: error.metadata ?? {},
  }).$returningId();
  return result.id;
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  componentName?: string
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  // Log final failure
  await logError({
    type: "retry_exhausted",
    message: lastError?.message ?? "Unknown error after retries",
    stack: lastError?.stack,
    componentName,
  });
  throw lastError;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────
const circuitBreakers = new Map<string, { failures: number; lastFailure: number; state: "closed" | "open" | "half-open" }>();

export function getCircuitState(serviceName: string): "closed" | "open" | "half-open" {
  const cb = circuitBreakers.get(serviceName);
  if (!cb) return "closed";
  if (cb.state === "open" && Date.now() - cb.lastFailure > 30000) {
    cb.state = "half-open";
  }
  return cb.state;
}

export function recordCircuitFailure(serviceName: string): void {
  const cb = circuitBreakers.get(serviceName) ?? { failures: 0, lastFailure: 0, state: "closed" as const };
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= 5) cb.state = "open";
  circuitBreakers.set(serviceName, cb);
}

export function recordCircuitSuccess(serviceName: string): void {
  circuitBreakers.set(serviceName, { failures: 0, lastFailure: 0, state: "closed" });
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getRecentErrors(limit = 50) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(serverErrors).orderBy(desc(serverErrors.createdAt)).limit(limit);
}

export async function getErrorStats() {
  const db = await getDb(); if (!db) return null as any;
  const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(serverErrors);
  const [unresolved] = await db.select({ count: sql<number>`COUNT(*)` }).from(serverErrors).where(eq(serverErrors.resolved, false));
  return {
    totalErrors: total?.count ?? 0,
    unresolvedErrors: unresolved?.count ?? 0,
    circuitBreakers: Object.fromEntries(circuitBreakers),
  };
}

export async function resolveError(errorId: number): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  await db.update(serverErrors).set({ resolved: true }).where(eq(serverErrors.id, errorId));
}
