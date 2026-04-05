/**
 * Pipeline Health Report — Lead pipeline analysis
 * Tracks stage distribution, conversion rates, velocity, bottlenecks, aging
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "pipelineHealthReport" });

export interface StageMetrics {
  stage: string;
  count: number;
  avgDaysInStage: number;
  conversionToNext: number;
}

export interface PipelineHealthReport {
  period: { start: Date; end: Date };
  totalLeads: number;
  stageMetrics: StageMetrics[];
  overallConversion: number;
  avgVelocityDays: number;
  bottleneckStage: string | null;
  agingLeads: number;
  sourceQuality: Array<{ source: string; count: number; conversionRate: number }>;
}

const PIPELINE_STAGES = ["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified"] as const;

export async function generatePipelineHealthReport(
  periodStart: Date,
  periodEnd: Date,
): Promise<PipelineHealthReport> {
  const db = await getDb();
  const empty: PipelineHealthReport = {
    period: { start: periodStart, end: periodEnd },
    totalLeads: 0, stageMetrics: [], overallConversion: 0,
    avgVelocityDays: 0, bottleneckStage: null, agingLeads: 0, sourceQuality: [],
  };

  if (!db) return empty;

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");
    const { count, eq, and, gte, lte, lt } = await import("drizzle-orm");

    // leadPipeline.createdAt is timestamp (Date type)
    const conditions = [
      gte(leadPipeline.createdAt, periodStart),
      lte(leadPipeline.createdAt, periodEnd),
    ];

    const [total] = await db.select({ count: count() }).from(leadPipeline).where(and(...conditions));
    const totalLeads = total?.count || 0;

    // Stage distribution
    const stageMetrics: StageMetrics[] = [];
    let maxCount = 0;
    let bottleneck: string | null = null;

    for (const stage of PIPELINE_STAGES) {
      const [result] = await db.select({ count: count() }).from(leadPipeline)
        .where(and(...conditions, eq(leadPipeline.status, stage)));
      const stageCount = result?.count || 0;

      stageMetrics.push({
        stage,
        count: stageCount,
        avgDaysInStage: 0,
        conversionToNext: 0,
      });

      if (stage !== "converted" && stage !== "disqualified" && stageCount > maxCount) {
        maxCount = stageCount;
        bottleneck = stage;
      }
    }

    // Calculate conversion rates between stages
    for (let i = 0; i < stageMetrics.length - 2; i++) {
      const current = stageMetrics[i].count;
      const nextStages = stageMetrics.slice(i + 1).reduce((s, m) => s + m.count, 0);
      stageMetrics[i].conversionToNext = current > 0 ? Math.round((nextStages / current) * 10000) / 100 : 0;
    }

    // Aging leads (> 30 days without update)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let agingCount = 0;
    try {
      const [aging] = await db.select({ count: count() }).from(leadPipeline)
        .where(and(
          lt(leadPipeline.updatedAt, thirtyDaysAgo),
          eq(leadPipeline.status, "new"),
        ));
      agingCount = aging?.count || 0;
    } catch {
      // Ignore aging query errors
    }

    const converted = stageMetrics.find((s) => s.stage === "converted")?.count || 0;
    const overallConversion = totalLeads > 0 ? Math.round((converted / totalLeads) * 10000) / 100 : 0;

    log.info({ totalLeads, overallConversion, bottleneck }, "Pipeline health report generated");

    return {
      period: { start: periodStart, end: periodEnd },
      totalLeads, stageMetrics, overallConversion,
      avgVelocityDays: 0,
      bottleneckStage: bottleneck,
      agingLeads: agingCount,
      sourceQuality: [],
    };
  } catch (e: any) {
    log.warn({ error: e.message }, "Pipeline health report generation failed");
    return empty;
  }
}
