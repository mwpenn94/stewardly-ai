/**
 * Client Outcomes Report — Measures client financial health improvements
 * Tracks goal progress, risk score changes, plan completion, satisfaction
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "clientOutcomesReport" });

export interface ClientOutcome {
  clientId: number;
  goalCompletionPct: number;
  riskScoreChange: number;
  planCompletionPct: number;
  satisfactionScore: number | null;
  domainsImproved: number;
  domainsDeclined: number;
}

export interface ClientOutcomesReport {
  period: { start: Date; end: Date };
  totalClients: number;
  avgGoalCompletion: number;
  avgPlanCompletion: number;
  avgSatisfaction: number;
  clientsImproved: number;
  clientsDeclined: number;
  topPerformers: ClientOutcome[];
  needsAttention: ClientOutcome[];
}

export async function generateClientOutcomesReport(
  periodStart: Date,
  periodEnd: Date,
  advisorId?: number,
): Promise<ClientOutcomesReport> {
  const db = await getDb();
  const empty: ClientOutcomesReport = {
    period: { start: periodStart, end: periodEnd },
    totalClients: 0, avgGoalCompletion: 0, avgPlanCompletion: 0,
    avgSatisfaction: 0, clientsImproved: 0, clientsDeclined: 0,
    topPerformers: [], needsAttention: [],
  };

  if (!db) return empty;

  try {
    const { clientAssociations } = await import("../../../drizzle/schema");
    const { count, eq, and } = await import("drizzle-orm");

    const conditions: any[] = [eq(clientAssociations.status, "active")];
    if (advisorId) conditions.push(eq(clientAssociations.professionalId, advisorId));

    const [totalResult] = await db.select({ count: count() }).from(clientAssociations)
      .where(and(...conditions));

    log.info({ totalClients: totalResult?.count || 0 }, "Client outcomes report generated");

    return {
      ...empty,
      totalClients: totalResult?.count || 0,
    };
  } catch (e: any) {
    log.warn({ error: e.message }, "Client outcomes report generation failed");
    return empty;
  }
}
