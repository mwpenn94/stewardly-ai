/**
 * Plan Analyzer — Weekly AI variance analysis for business plans
 * Runs Monday 6am. Guard: skip if no actuals in 30+ days or <1 month of data.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "planAnalyzer" });

export async function analyzePlans(): Promise<{ analyzed: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { analyzed: 0, skipped: 0 };

  let analyzed = 0;
  let skipped = 0;

  try {
    const { businessPlans, productionActuals, planActualInsights } = await import("../../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    const activePlans = await db.select().from(businessPlans).where(eq(businessPlans.status, "active"));

    for (const plan of activePlans) {
      // Guard: minimum 1 month of data
      const actuals = await db.select().from(productionActuals)
        .where(eq(productionActuals.userId, plan.userId))
        .orderBy(desc(productionActuals.periodStart))
        .limit(1);

      if (actuals.length === 0) { skipped++; continue; }

      const latestActual = actuals[0];
      const daysSinceActual = (Date.now() - new Date(latestActual.periodStart).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActual > 30) { skipped++; continue; }

      // Calculate variance
      const gdcActual = Number(latestActual.gdcActual) || 0;
      const gdcTarget = Number(plan.gdcTarget) || 1;
      const variancePct = ((gdcActual - gdcTarget) / gdcTarget) * 100;

      const overallStatus = variancePct >= 0 ? "ahead" : variancePct >= -10 ? "on_track" : variancePct >= -25 ? "behind" : "at_risk";

      // Generate AI insight
      let insight: any = { keyFindings: [], recommendations: [] };
      try {
        const { contextualLLM } = await import("../../shared/stewardlyWiring");
        const response = await contextualLLM({
          userId: plan.userId,
          contextType: "analysis" as any,
          messages: [{
            role: "user",
            content: `Analyze this business plan variance: GDC target ${gdcTarget}, actual ${gdcActual}, variance ${variancePct.toFixed(1)}%. Cases placed: ${latestActual.casesPlaced}. Role: ${plan.roleSegment}. Generate top 3 findings and top 3 recommendations as JSON: { keyFindings: string[], recommendations: string[] }`,
          }],
        });
        const content = response.choices?.[0]?.message?.content || "{}";
        try { insight = JSON.parse(content); } catch { /* use defaults */ }
      } catch { /* AI optional */ }

      await db.insert(planActualInsights).values({
        userId: plan.userId,
        planId: plan.id,
        analysisPeriodStart: latestActual.periodStart,
        analysisPeriodEnd: latestActual.periodEnd,
        overallStatus: overallStatus as any,
        gdcVariancePct: String(variancePct),
        keyFindings: insight.keyFindings as any,
        recommendations: insight.recommendations as any,
      });

      analyzed++;
    }
  } catch (e: any) {
    log.error({ error: e.message }, "Plan analysis failed");
  }

  log.info({ analyzed, skipped }, "Plan analysis complete");
  return { analyzed, skipped };
}
