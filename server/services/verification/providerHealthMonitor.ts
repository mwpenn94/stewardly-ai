/**
 * Provider Health Monitor — Tracks uptime, response times, error rates
 * for all verification and data providers
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "providerHealthMonitor" });

export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastCheck: number;
  avgResponseMs: number;
  errorRate: number;
  uptime24h: number;
  consecutiveFailures: number;
}

// In-memory health tracking (persisted to DB periodically)
const healthState = new Map<string, {
  checks: Array<{ timestamp: number; success: boolean; responseMs: number }>;
  consecutiveFailures: number;
}>();

const MAX_HISTORY = 100;

export function recordCheck(provider: string, success: boolean, responseMs: number): void {
  let state = healthState.get(provider);
  if (!state) {
    state = { checks: [], consecutiveFailures: 0 };
    healthState.set(provider, state);
  }

  state.checks.push({ timestamp: Date.now(), success, responseMs });
  if (state.checks.length > MAX_HISTORY) state.checks.shift();

  if (success) {
    state.consecutiveFailures = 0;
  } else {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 3) {
      log.warn({ provider, consecutiveFailures: state.consecutiveFailures }, "Provider degraded");
    }
  }
}

export function getProviderHealth(provider: string): ProviderHealth {
  const state = healthState.get(provider);
  if (!state || state.checks.length === 0) {
    return { provider, status: "unknown", lastCheck: 0, avgResponseMs: 0, errorRate: 0, uptime24h: 0, consecutiveFailures: 0 };
  }

  const now = Date.now();
  const last24h = state.checks.filter((c) => now - c.timestamp < 24 * 60 * 60 * 1000);
  const successCount = last24h.filter((c) => c.success).length;
  const totalCount = last24h.length;
  const errorRate = totalCount > 0 ? (totalCount - successCount) / totalCount : 0;
  const avgResponseMs = last24h.length > 0 ? last24h.reduce((s, c) => s + c.responseMs, 0) / last24h.length : 0;
  const uptime24h = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  let status: ProviderHealth["status"] = "healthy";
  if (state.consecutiveFailures >= 5) status = "down";
  else if (state.consecutiveFailures >= 3 || errorRate > 0.2) status = "degraded";

  return {
    provider, status,
    lastCheck: state.checks[state.checks.length - 1].timestamp,
    avgResponseMs: Math.round(avgResponseMs),
    errorRate: Math.round(errorRate * 10000) / 100,
    uptime24h: Math.round(uptime24h * 100) / 100,
    consecutiveFailures: state.consecutiveFailures,
  };
}

export function getAllProviderHealth(): ProviderHealth[] {
  const providers = [
    "sec_iapd", "finra", "cfp_board", "nasba", "nmls",
    "state_bar", "nipr", "clearbit", "fullcontact",
    "fred", "census", "wealthbox", "redtail", "snaptrade",
  ];

  return providers.map((p) => getProviderHealth(p));
}

export async function persistHealthSnapshot(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { systemHealthEvents } = await import("../../../drizzle/schema");
    const allHealth = getAllProviderHealth();

    for (const health of allHealth) {
      if (health.status === "unknown") continue;
      await db.insert(systemHealthEvents).values({
        eventType: "service_degraded" as const,
        sourceName: health.provider,
        severity: health.status === "down" ? "critical" as const : health.status === "degraded" ? "warning" as const : "info" as const,
        message: `Provider ${health.provider}: ${health.status} (error rate: ${health.errorRate}%)`,
        metadata: health as any,
      }).catch(() => { /* graceful degradation */ });
    }

    log.info({ providers: allHealth.length }, "Health snapshot persisted");
  } catch (e: any) {
    log.warn({ error: e.message }, "Health snapshot persistence failed");
  }
}
