/**
 * Financial Instruments Router
 *
 * Covers: equityGrants, ltcAnalyses, businessExitPlans, paperTrades,
 *         digitalAssetInventory, healthScores, savedAnalyses, sharedLinks
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  equityGrants, ltcAnalyses, businessExitPlans, paperTrades,
  digitalAssetInventory, healthScores, savedAnalyses, sharedLinks,
} from "../../drizzle/schema";
import crypto from "crypto";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

// ─── Equity Grants ───────────────────────────────────────────────
const equityRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(equityGrants).where(eq(equityGrants.userId, ctx.user.id)).orderBy(desc(equityGrants.id));
  }),
  create: protectedProcedure.input(z.object({
    grantType: z.enum(["iso","nso","rsu","espp"]),
    company: z.string().max(256), grantDate: z.date().optional(), expirationDate: z.date().optional(),
    sharesGranted: z.number().optional(), sharesVested: z.number().default(0),
    exercisePrice: z.number().optional(), currentFMV: z.number().optional(),
    vestingSchedule: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(equityGrants).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(), sharesVested: z.number().optional(), currentFMV: z.number().optional(), sharesExercised: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(equityGrants).set(updates).where(and(eq(equityGrants.id, id), eq(equityGrants.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── LTC Analyses ────────────────────────────────────────────────
const ltcRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(ltcAnalyses).where(eq(ltcAnalyses.userId, ctx.user.id)).orderBy(desc(ltcAnalyses.id));
  }),
  create: protectedProcedure.input(z.object({
    currentAge: z.number().optional(), retirementAge: z.number().default(65),
    healthStatus: z.enum(["excellent","good","fair","poor"]).default("good"),
    state: z.string().max(2).optional(), zipCode: z.string().max(10).optional(),
    gender: z.enum(["male","female","other"]).optional(),
    annualIncome: z.string().optional(), totalAssets: z.string().optional(),
    ltcInsuranceHas: z.boolean().default(false),
    recommendedStrategy: z.string().max(50).optional(),
    analysisJson: z.string().optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(ltcAnalyses).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Business Exit Plans ─────────────────────────────────────────
const exitPlansRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(businessExitPlans).where(eq(businessExitPlans.userId, ctx.user.id)).orderBy(desc(businessExitPlans.id));
  }),
  create: protectedProcedure.input(z.object({
    businessName: z.string().max(256), businessType: z.string().max(128).optional(),
    estimatedValuation: z.string().optional(), targetExitYear: z.number().optional(),
    exitStrategy: z.enum(["sale","merger","ipo","esop","family_transfer","liquidation"]).optional(),
    readinessScore: z.number().min(0).max(100).optional(),
    keyPersonRisks: z.any().optional(), taxImplicationsJson: z.any().optional(),
    actionPlanJson: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(businessExitPlans).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(), readinessScore: z.number().optional(), actionPlanJson: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(businessExitPlans).set(updates).where(and(eq(businessExitPlans.id, id), eq(businessExitPlans.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Paper Trades ────────────────────────────────────────────────
const paperTradesRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(paperTrades).where(eq(paperTrades.userId, ctx.user.id)).orderBy(desc(paperTrades.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    symbol: z.string().max(20), tradeType: z.enum(["buy","sell"]),
    quantity: z.string(), price: z.string(), totalValue: z.string(),
    aiSuggested: z.boolean().default(false), aiReasoning: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(paperTrades).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Digital Asset Inventory ─────────────────────────────────────
const digitalAssetsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(digitalAssetInventory).where(eq(digitalAssetInventory.userId, ctx.user.id)).orderBy(desc(digitalAssetInventory.id));
  }),
  create: protectedProcedure.input(z.object({
    assetType: z.enum(["crypto_wallet","exchange_account","brokerage","bank","social_media","email","cloud_storage","loyalty_program","domain","digital_content","other"]),
    platform: z.string().max(256), approximateValue: z.number().optional(),
    accessMethod: z.string().optional(), beneficiaryId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(digitalAssetInventory).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(digitalAssetInventory).where(and(eq(digitalAssetInventory.id, input.id), eq(digitalAssetInventory.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Health Scores ───────────────────────────────────────────────
const healthScoresRouter = router({
  latest: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(healthScores).where(eq(healthScores.userId, ctx.user.id)).orderBy(desc(healthScores.id)).limit(1);
    return row ?? null;
  }),
  history: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(12) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(healthScores).where(eq(healthScores.userId, ctx.user.id)).orderBy(desc(healthScores.id)).limit(input.limit);
  }),
  record: protectedProcedure.input(z.object({
    totalScore: z.number(), spendScore: z.number().default(0), saveScore: z.number().default(0),
    borrowScore: z.number().default(0), planScore: z.number().default(0),
    status: z.enum(["healthy","coping","vulnerable"]).default("coping"),
    insightsJson: z.string().optional(), recommendationsJson: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(healthScores).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Saved Analyses ──────────────────────────────────────────────
const savedAnalysesRouter = router({
  list: protectedProcedure.input(z.object({ analysisType: z.string().optional(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let q = db.select().from(savedAnalyses).where(eq(savedAnalyses.userId, ctx.user.id)).orderBy(desc(savedAnalyses.id)).limit(input.limit).$dynamic();
    return q;
  }),
  create: protectedProcedure.input(z.object({
    clientId: z.number().optional(),
    analysisType: z.enum(["tax_projection","ss_optimization","hsa_optimization","medicare_navigation","charitable_giving","divorce_financial","education_plan","fee_comparison"]),
    title: z.string().max(256).optional(), inputJson: z.string().optional(),
    resultJson: z.string().optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(savedAnalyses).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(savedAnalyses).where(and(eq(savedAnalyses.id, input.id), eq(savedAnalyses.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Shared Links ────────────────────────────────────────────────
const sharedLinksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(sharedLinks).where(eq(sharedLinks.userId, ctx.user.id)).orderBy(desc(sharedLinks.id));
  }),
  create: protectedProcedure.input(z.object({
    contentType: z.enum(["protection_score","plan_summary","calculator_result","chat_excerpt"]),
    contentId: z.number(), maxViews: z.number().default(100),
    expiresAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const shareToken = crypto.randomBytes(32).toString("hex");
    const [r] = await db.insert(sharedLinks).values({ ...input, userId: ctx.user.id, shareToken });
    return { id: r.insertId, shareToken };
  }),
  getByToken: protectedProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(sharedLinks).where(eq(sharedLinks.shareToken, input.token));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    // Increment view count
    await db.update(sharedLinks).set({ viewCount: sql`${sharedLinks.viewCount} + 1` }).where(eq(sharedLinks.id, row.id));
    return row;
  }),
  revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(sharedLinks).where(and(eq(sharedLinks.id, input.id), eq(sharedLinks.userId, ctx.user.id)));
    return { success: true };
  }),
});

export const financialInstrumentsRouter = router({
  equity: equityRouter,
  ltc: ltcRouter,
  exitPlans: exitPlansRouter,
  paperTrades: paperTradesRouter,
  digitalAssets: digitalAssetsRouter,
  healthScores: healthScoresRouter,
  savedAnalyses: savedAnalysesRouter,
  sharedLinks: sharedLinksRouter,
});
