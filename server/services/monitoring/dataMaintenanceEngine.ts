/**
 * Data Maintenance Engine — Orchestrate freshness checks and alerts
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";
import { logHealthEvent } from "./healthMonitor";

const log = logger.child({ module: "dataMaintenance" });

export async function checkDataFreshness(): Promise<{ checked: number; stale: number; alerts: number }> {
  const db = await getDb();
  if (!db) return { checked: 0, stale: 0, alerts: 0 };

  let checked = 0, stale = 0, alerts = 0;

  try {
    const { dataFreshnessRegistry } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const providers = await db.select().from(dataFreshnessRegistry).where(eq(dataFreshnessRegistry.status, "fresh"));

    for (const provider of providers) {
      checked++;
      const lastRefresh = provider.lastRefreshedAt ? new Date(provider.lastRefreshedAt).getTime() : 0;
      const intervalMs = (provider.refreshIntervalHours || 24) * 60 * 60 * 1000;
      const isStale = Date.now() - lastRefresh > intervalMs;

      if (isStale) {
        stale++;
        const criticality = (provider as any).providerCriticality || "supplementary";
        if (criticality === "critical") {
          alerts++;
          await logHealthEvent(
            provider.provider || "unknown",
            "seed_data_stale",
            "warning",
            `${provider.provider} data is stale (last refresh: ${provider.lastRefreshedAt})`,
          );
        }
      }
    }
  } catch (e: any) {
    log.error({ error: e.message }, "Data freshness check failed");
  }

  log.info({ checked, stale, alerts }, "Data freshness check complete");
  return { checked, stale, alerts };
}
