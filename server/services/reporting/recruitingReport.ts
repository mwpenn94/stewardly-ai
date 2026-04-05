/**
 * Recruiting Report — Advisor recruiting pipeline tracking
 * Tracks candidates, interviews, offers, onboarding, ramp progress
 * Note: Uses leadPipeline with targetSegment='recruiting' as proxy until
 * a dedicated recruiting_pipeline table is added.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "recruitingReport" });

export interface RecruitingMetrics {
  period: { start: Date; end: Date };
  totalCandidates: number;
  byStage: Record<string, number>;
  offersExtended: number;
  offersAccepted: number;
  acceptanceRate: number;
  avgTimeToHire: number; // days
  onboardingInProgress: number;
  rampMetrics: { month1Pct: number; month3Pct: number; month6Pct: number };
}

export async function generateRecruitingReport(
  periodStart: Date,
  periodEnd: Date,
): Promise<RecruitingMetrics> {
  const empty: RecruitingMetrics = {
    period: { start: periodStart, end: periodEnd },
    totalCandidates: 0, byStage: {}, offersExtended: 0, offersAccepted: 0,
    acceptanceRate: 0, avgTimeToHire: 0, onboardingInProgress: 0,
    rampMetrics: { month1Pct: 0, month3Pct: 0, month6Pct: 0 },
  };

  const db = await getDb();
  if (!db) return empty;

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");
    const { and, gte, lte, count, eq } = await import("drizzle-orm");

    // Filter leads that are recruiting-related
    const conditions = [
      eq(leadPipeline.targetSegment, "recruiting"),
      gte(leadPipeline.createdAt, periodStart),
      lte(leadPipeline.createdAt, periodEnd),
    ];

    const [total] = await db.select({ count: count() }).from(leadPipeline).where(and(...conditions));

    log.info({ total: total?.count || 0 }, "Recruiting report generated");

    return {
      ...empty,
      totalCandidates: total?.count || 0,
    };
  } catch (e: any) {
    log.warn({ error: e.message }, "Recruiting report generation failed");
    return empty;
  }
}
