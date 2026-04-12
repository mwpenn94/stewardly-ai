import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAdaptiveRateStats,
  generateRateRecommendation,
  applyRecommendation,
  dismissRecommendation,
  analyzeNewIntegration,
  createExtractionPlan,
  getRefreshQueue,
} from "../services/adaptiveRateManagement";
import {
  fetchSOFRFromFRED,
  calculatePremiumFinanceRates,
} from "../services/orgProviders";
import { getDb } from "../db";
import { eq, desc, sql } from "drizzle-orm";
import {
  rateProfiles,
  rateRecommendations,
  extractionPlans,
} from "../../drizzle/schema";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const adminIntelligenceRouter = router({
  // ─── Stats Overview ───────────────────────────────────────────────
  getStats: adminProcedure.query(async () => {
    return getAdaptiveRateStats();
  }),

  // ─── Rate Profiles ────────────────────────────────────────────────
  getRateProfiles: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(rateProfiles).orderBy(desc(rateProfiles.provider)).limit(100);
    } catch {
      return [];
    }
  }),

  // ─── Rate Recommendations ─────────────────────────────────────────
  getRecommendations: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(rateRecommendations)
        .where(eq(rateRecommendations.status, "pending_review"))
        .orderBy(desc(rateRecommendations.createdAt))
        .limit(50);
    } catch {
      return [];
    }
  }),

  generateRecommendation: adminProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => {
      return generateRateRecommendation(input.provider);
    }),

  applyRecommendation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const result = await applyRecommendation(input.id);
      if (!result) throw new TRPCError({ code: "BAD_REQUEST", message: "Could not apply recommendation" });
      return { success: true };
    }),

  dismissRecommendation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await dismissRecommendation(input.id);
      return { success: true };
    }),

  // ─── Extraction Plans ─────────────────────────────────────────────
  getExtractionPlans: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(extractionPlans)
        .orderBy(desc(extractionPlans.createdAt))
        .limit(50);
    } catch {
      return [];
    }
  }),

  createExtractionPlan: adminProcedure
    .input(z.object({
      planName: z.string(),
      planType: z.enum(["initial_seed", "scheduled_refresh", "on_demand", "ai_suggested"]),
      provider: z.string(),
      targetDataCategories: z.array(z.string()),
      availableEndpoints: z.array(z.string()),
      dailyBudget: z.number(),
      priority: z.enum(["critical", "high", "medium", "low"]),
    }))
    .mutation(async ({ input }) => {
      return createExtractionPlan(input);
    }),

  // ─── Data Value / Refresh Queue ───────────────────────────────────
  getRefreshQueue: adminProcedure.query(async () => {
    return getRefreshQueue();
  }),

  // ─── Integration Onboarding ───────────────────────────────────────
  analyzeIntegration: adminProcedure
    .input(z.object({
      provider: z.string(),
      domain: z.string(),
      docsUrl: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return analyzeNewIntegration(input.provider, input.domain, input.docsUrl, input.category);
    }),

  // ─── SOFR / Premium Finance ───────────────────────────────────────
  getSOFRRates: adminProcedure.query(async () => {
    try {
      return await fetchSOFRFromFRED();
    } catch {
      return [];
    }
  }),

  getPremiumFinanceRates: adminProcedure.query(async () => {
    try {
      const sofrRates = await fetchSOFRFromFRED();
      const latestRate = sofrRates.length > 0 ? sofrRates[0].rate : 5.33;
      return calculatePremiumFinanceRates(latestRate);
    } catch {
      return calculatePremiumFinanceRates(5.33);
    }
  }),

  // ── Improvement Engine Dashboard ────────────────────────────────────
  getImprovementHypotheses: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "promoted", "rejected", "testing"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { hypotheses: [], total: 0 };
      const { improvementHypotheses } = await import("../../drizzle/schema");

      const rows = input?.status
        ? await db.select().from(improvementHypotheses)
            .where(eq(improvementHypotheses.status, input.status))
            .orderBy(desc(improvementHypotheses.createdAt))
            .limit(input.limit ?? 50)
        : await db.select().from(improvementHypotheses)
            .orderBy(desc(improvementHypotheses.createdAt))
            .limit(input?.limit ?? 50);
      const [countResult] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(improvementHypotheses);

      return {
        hypotheses: rows.map((h: any) => ({
          id: h.id,
          passType: h.passType,
          hypothesisText: h.hypothesisText,
          expectedDelta: h.expectedDelta,
          status: h.status,
          testCount: h.testCount,
          scope: typeof h.scope === "string" ? JSON.parse(h.scope) : h.scope,
          createdAt: h.createdAt,
          promotedAt: h.promotedAt,
          rejectedAt: h.rejectedAt,
          rejectedReason: h.rejectedReason,
        })),
        total: countResult?.cnt ?? 0,
      };
    }),

  getQualityScoresSummary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { avgScore: 0, totalRated: 0, recentScores: [], distribution: {} };
    const { qualityRatings } = await import("../../drizzle/schema");
    const { gte } = await import("drizzle-orm");

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentScores = await db
      .select({ score: qualityRatings.score, reasoning: qualityRatings.reasoning, createdAt: qualityRatings.createdAt })
      .from(qualityRatings)
      .where(gte(qualityRatings.createdAt, oneDayAgo))
      .orderBy(desc(qualityRatings.createdAt))
      .limit(50);

    const [avgResult] = await db.select({
      avg: sql<number>`AVG(${qualityRatings.score})`,
      cnt: sql<number>`COUNT(*)`,
    }).from(qualityRatings).where(gte(qualityRatings.createdAt, oneDayAgo));

    // Score distribution buckets
    const distribution: Record<string, number> = { "0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0 };
    for (const s of recentScores) {
      const score = Number(s.score);
      if (score < 0.2) distribution["0.0-0.2"]++;
      else if (score < 0.4) distribution["0.2-0.4"]++;
      else if (score < 0.6) distribution["0.4-0.6"]++;
      else if (score < 0.8) distribution["0.6-0.8"]++;
      else distribution["0.8-1.0"]++;
    }

    return {
      avgScore: avgResult?.avg ?? 0,
      totalRated: avgResult?.cnt ?? 0,
      recentScores: recentScores.map((s: any) => ({
        score: s.score,
        reasoning: s.reasoning,
        createdAt: s.createdAt,
      })),
      distribution,
    };
  }),

  runImprovementEngineNow: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const { detectSignals, checkConvergence } = await import("../shared/engine/improvementEngine");
    const { executeImprovementCycle } = await import("../services/improvement/improvementCycleRunner");
    const { backfillQualityRatings } = await import("../services/improvement/autoQualityRater");

    const [signals, convergence, cycleResult, ratingResult] = await Promise.all([
      detectSignals(db),
      checkConvergence(db),
      executeImprovementCycle(db),
      backfillQualityRatings(db),
    ]);

    return {
      signals,
      convergence,
      hypothesesGenerated: cycleResult.hypothesesGenerated,
      hypothesesPersisted: cycleResult.hypothesesPersisted,
      dataStats: cycleResult.dataStats,
      ratingsBackfilled: ratingResult.rated,
      avgQualityScore: ratingResult.avgScore,
    };
  }),
});
