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
});
