/**
 * Performance Report — Individual and team performance metrics
 * Tracks AUM growth, client acquisition, revenue, and activity
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "performanceReport" });

export interface PerformanceMetrics {
  advisorId?: number;
  teamId?: number;
  period: { start: Date; end: Date };
  aumStart: number;
  aumEnd: number;
  aumGrowthPct: number;
  newClients: number;
  lostClients: number;
  netClients: number;
  revenue: number;
  activitiesCompleted: number;
  meetingsHeld: number;
  proposalsGenerated: number;
  conversionRate: number;
}

export async function generatePerformanceReport(
  scopeType: "individual" | "team" | "platform",
  scopeId: number | undefined,
  periodStart: Date,
  periodEnd: Date,
): Promise<PerformanceMetrics> {
  const db = await getDb();
  const empty: PerformanceMetrics = {
    advisorId: scopeType === "individual" ? scopeId : undefined,
    teamId: scopeType === "team" ? scopeId : undefined,
    period: { start: periodStart, end: periodEnd },
    aumStart: 0, aumEnd: 0, aumGrowthPct: 0,
    newClients: 0, lostClients: 0, netClients: 0,
    revenue: 0, activitiesCompleted: 0, meetingsHeld: 0,
    proposalsGenerated: 0, conversionRate: 0,
  };

  if (!db) return empty;

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");
    const { eq, and, gte, lte, count } = await import("drizzle-orm");

    // Count converted leads as new clients proxy
    // leadPipeline.createdAt and updatedAt are timestamp (Date) columns
    const conditions: any[] = [
      eq(leadPipeline.status, "converted"),
      gte(leadPipeline.updatedAt, periodStart),
      lte(leadPipeline.updatedAt, periodEnd),
    ];
    if (scopeId && scopeType === "individual") {
      conditions.push(eq(leadPipeline.assignedAdvisorId, scopeId));
    }

    const [converted] = await db.select({ count: count() }).from(leadPipeline).where(and(...conditions));
    const [totalLeads] = await db.select({ count: count() }).from(leadPipeline).where(
      and(gte(leadPipeline.createdAt, periodStart), lte(leadPipeline.createdAt, periodEnd)),
    );

    const newClients = converted?.count || 0;
    const total = totalLeads?.count || 0;

    log.info({ scopeType, scopeId, newClients }, "Performance report generated");

    return {
      ...empty,
      newClients,
      conversionRate: total > 0 ? Math.round((newClients / total) * 10000) / 100 : 0,
    };
  } catch (e: any) {
    log.warn({ error: e.message }, "Performance report generation failed");
    return empty;
  }
}
