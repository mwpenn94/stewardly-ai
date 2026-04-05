/**
 * Integration Analyzer — Analyze provider integration health and data quality
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "integrationAnalyzer" });

export interface IntegrationHealth {
  provider: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastSuccessfulSync: number | null;
  failureCount: number;
  avgResponseTime: number;
  dataFreshness: "fresh" | "stale" | "expired";
  dataCompleteness: number; // 0-1
  recommendations: string[];
}

export function analyzeHealth(
  provider: string,
  syncHistory: Array<{ success: boolean; responseTime: number; timestamp: number; recordCount: number }>
): IntegrationHealth {
  const now = Date.now();
  const recent = syncHistory.filter((s) => now - s.timestamp < 7 * 24 * 60 * 60 * 1000);
  const successes = recent.filter((s) => s.success);
  const failures = recent.filter((s) => !s.success);
  const lastSuccess = successes.length > 0 ? Math.max(...successes.map((s) => s.timestamp)) : null;
  const avgResponseTime = successes.length > 0 ? successes.reduce((sum, s) => sum + s.responseTime, 0) / successes.length : 0;

  let status: IntegrationHealth["status"] = "unknown";
  if (recent.length === 0) status = "unknown";
  else if (failures.length === 0) status = "healthy";
  else if (failures.length / recent.length > 0.5) status = "down";
  else status = "degraded";

  let dataFreshness: IntegrationHealth["dataFreshness"] = "expired";
  if (lastSuccess && now - lastSuccess < 24 * 60 * 60 * 1000) dataFreshness = "fresh";
  else if (lastSuccess && now - lastSuccess < 7 * 24 * 60 * 60 * 1000) dataFreshness = "stale";

  const totalRecords = successes.reduce((sum, s) => sum + s.recordCount, 0);
  const dataCompleteness = Math.min(1, totalRecords / 100);

  const recommendations: string[] = [];
  if (status === "down") recommendations.push("Provider appears down — check API status page");
  if (status === "degraded") recommendations.push("Intermittent failures — consider increasing retry count");
  if (dataFreshness === "expired") recommendations.push("Data expired — trigger manual refresh");
  if (avgResponseTime > 5000) recommendations.push("Slow response times — consider caching layer");

  log.info({ provider, status, dataFreshness }, "Integration health analyzed");
  return { provider, status, lastSuccessfulSync: lastSuccess, failureCount: failures.length, avgResponseTime, dataFreshness, dataCompleteness, recommendations };
}

export function rankProviders(healthReports: IntegrationHealth[]): IntegrationHealth[] {
  const statusOrder = { healthy: 0, degraded: 1, unknown: 2, down: 3 };
  return [...healthReports].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}
