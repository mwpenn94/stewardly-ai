/**
 * Health Monitor — Wrap cron jobs with monitoring, timeouts, and alerts
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "healthMonitor" });
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function runMonitoredCron(
  name: string,
  fn: () => Promise<void>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Cron ${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    await logHealthEvent(name, "cron_success", "info", `Completed in ${Date.now() - start}ms`);
  } catch (err: any) {
    const eventType = err.message?.includes("timed out") ? "cron_timeout" : "cron_failure";
    const severity = eventType === "cron_timeout" ? "warning" : "error";
    log.error({ cron: name, error: err.message, durationMs: Date.now() - start }, `Cron ${name} failed`);
    await logHealthEvent(name, eventType, severity, err.message);
  }
}

export async function logHealthEvent(
  sourceName: string,
  eventType: string,
  severity: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const { systemHealthEvents } = await import("../../../drizzle/schema");
    await db.insert(systemHealthEvents).values({
      eventType: eventType as any,
      sourceName,
      severity: severity as any,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {
    // Don't fail on monitoring failure
  }
}

export function getHealthStatus() {
  return { status: "ok", timestamp: new Date().toISOString() };
}
