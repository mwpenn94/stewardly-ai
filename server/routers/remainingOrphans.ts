/**
 * Remaining Orphans Router — Pass 6 Landscape cleanup
 *
 * Covers: reconciliationLog, marketDataSubscriptions, marketEvents,
 *         regulatoryImpactAnalyses, transactionCategories, educationProgress,
 *         educationTriggers, studyProgress, modelBacktests, loadTestResults,
 *         leadSources, propensityFeatures, platformLearnings,
 *         providerHealthChecks, carrierSubmissions
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  reconciliationLog, marketDataSubscriptions, marketEvents,
  regulatoryImpactAnalyses, transactionCategories, educationProgress,
  educationTriggers, studyProgress, modelBacktests, loadTestResults,
  leadSources, propensityFeatures, platformLearnings,
  providerHealthChecks, carrierSubmissions,
} from "../../drizzle/schema";
import crypto from "crypto";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

// ─── Reconciliation Log ──────────────────────────────────────────
const reconciliationRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(reconciliationLog).orderBy(desc(reconciliationLog.createdAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    accountId: z.string().max(256), expectedBalance: z.string().optional(), actualBalance: z.string().optional(),
    discrepancy: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(reconciliationLog).values(input);
    return { id: r.insertId };
  }),
  resolve: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(reconciliationLog).set({ resolved: true, resolvedAt: new Date() }).where(eq(reconciliationLog.id, input.id));
    return { success: true };
  }),
});

// ─── Market Data Subscriptions ───────────────────────────────────
const marketSubsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(marketDataSubscriptions).where(eq(marketDataSubscriptions.userId, ctx.user.id));
  }),
  subscribe: protectedProcedure.input(z.object({ symbol: z.string().max(16) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(marketDataSubscriptions).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  unsubscribe: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(marketDataSubscriptions).where(and(eq(marketDataSubscriptions.id, input.id), eq(marketDataSubscriptions.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Market Events ───────────────────────────────────────────────
const marketEventsRouter = router({
  list: protectedProcedure.input(z.object({ symbol: z.string().max(16).optional(), limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.symbol) {
      return db.select().from(marketEvents).where(eq(marketEvents.symbol, input.symbol)).orderBy(desc(marketEvents.detectedAt)).limit(input.limit);
    }
    return db.select().from(marketEvents).orderBy(desc(marketEvents.detectedAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    eventType: z.string().max(64), symbol: z.string().max(16),
    magnitude: z.number().optional(), details: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(marketEvents).values(input);
    return { id: r.insertId };
  }),
});

// ─── Regulatory Impact Analyses ──────────────────────────────────
const regulatoryRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(regulatoryImpactAnalyses).orderBy(desc(regulatoryImpactAnalyses.generatedAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    updateId: z.number(), impactLevel: z.enum(["high","medium","low"]).default("low"),
    affectedAreas: z.any().optional(), recommendedActions: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(regulatoryImpactAnalyses).values(input);
    return { id: r.insertId };
  }),
});

// ─── Transaction Categories ──────────────────────────────────────
const txCategoriesRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(transactionCategories).where(eq(transactionCategories.userId, ctx.user.id)).orderBy(desc(transactionCategories.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    transactionId: z.string().max(256), aiCategory: z.string().max(128).optional(),
    userOverrideCategory: z.string().max(128).optional(), confidence: z.number().min(0).max(1).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(transactionCategories).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  override: protectedProcedure.input(z.object({ id: z.number(), userOverrideCategory: z.string().max(128) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(transactionCategories).set({ userOverrideCategory: input.userOverrideCategory }).where(and(eq(transactionCategories.id, input.id), eq(transactionCategories.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Education Progress ──────────────────────────────────────────
const eduProgressRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(educationProgress).where(eq(educationProgress.userId, ctx.user.id)).orderBy(desc(educationProgress.createdAt));
  }),
  create: protectedProcedure.input(z.object({
    moduleId: z.number(), assignedBy: z.string().max(64).default("system"),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(educationProgress).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  complete: protectedProcedure.input(z.object({ id: z.number(), score: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(educationProgress).set({ completedAt: new Date(), score: input.score }).where(and(eq(educationProgress.id, input.id), eq(educationProgress.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Education Triggers ──────────────────────────────────────────
const eduTriggersRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(educationTriggers).orderBy(desc(educationTriggers.createdAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    triggerCondition: z.any(), educationModuleId: z.number().optional(),
    targetAudience: z.enum(["all","new_users","professionals","managers","admins"]).default("all"),
    title: z.string().max(256), content: z.string().optional(), contentUrl: z.string().optional(),
    deliveryMethod: z.enum(["in_app","chat_injection","notification","email"]).default("in_app"),
    priority: z.number().default(50), isActive: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const id = crypto.randomUUID();
    await db.insert(educationTriggers).values({ ...input, id });
    return { id };
  }),
  toggle: adminProcedure.input(z.object({ id: z.string(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(educationTriggers).set({ isActive: input.isActive }).where(eq(educationTriggers.id, input.id));
    return { success: true };
  }),
});

// ─── Study Progress ──────────────────────────────────────────────
const studyProgressRouter = router({
  get: protectedProcedure.input(z.object({ certification: z.string().max(100) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(studyProgress).where(and(eq(studyProgress.userId, ctx.user.id), eq(studyProgress.certification, input.certification)));
    return row ?? null;
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(studyProgress).where(eq(studyProgress.userId, ctx.user.id));
  }),
  upsert: protectedProcedure.input(z.object({
    certification: z.string().max(100),
    studyTimeMinutes: z.number().default(0), totalQuestionsAttempted: z.number().default(0),
    totalQuestionsCorrect: z.number().default(0),
    currentDifficulty: z.enum(["beginner","intermediate","advanced"]).default("beginner"),
    topicsCovered: z.any().optional(), quizScores: z.any().optional(), weakAreas: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [existing] = await db.select().from(studyProgress).where(and(eq(studyProgress.userId, ctx.user.id), eq(studyProgress.certification, input.certification)));
    if (existing) {
      await db.update(studyProgress).set(input).where(eq(studyProgress.id, existing.id));
      return { id: existing.id };
    }
    const [r] = await db.insert(studyProgress).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Model Backtests ─────────────────────────────────────────────
const backtestsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(modelBacktests).where(eq(modelBacktests.userId, ctx.user.id)).orderBy(desc(modelBacktests.createdAt)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    modelType: z.string().max(64), historicalEvent: z.string().max(128), eventYear: z.number(),
    portfolioParams: z.any().optional(), resultJson: z.any().optional(),
    maxDrawdown: z.number().optional(), recoveryMonths: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(modelBacktests).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Load Test Results ───────────────────────────────────────────
const loadTestRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(loadTestResults).orderBy(desc(loadTestResults.testDate)).limit(input.limit);
  }),
  record: adminProcedure.input(z.object({
    scenario: z.string().max(256), concurrentUsers: z.number().optional(),
    requestsPerSecond: z.number().optional(), p95LatencyMs: z.number().optional(),
    errors: z.number().default(0), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(loadTestResults).values(input);
    return { id: r.insertId };
  }),
});

// ─── Lead Sources ────────────────────────────────────────────────
const leadSourcesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(leadSources).orderBy(desc(leadSources.id));
  }),
  create: adminProcedure.input(z.object({
    sourceName: z.string().max(200),
    sourceType: z.enum(["organic","paid","referral","event","directory","partnership"]),
    segment: z.string().max(100).optional(), provider: z.string().max(200).optional(),
    costModel: z.enum(["free","per_lead","per_click","subscription","revenue_share"]).default("free"),
    avgCost: z.string().optional(), estVolumeMonthly: z.number().optional(),
    qualityScore: z.string().optional(), enabled: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(leadSources).values(input);
    return { id: r.insertId };
  }),
  toggle: adminProcedure.input(z.object({ id: z.number(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(leadSources).set({ enabled: input.enabled }).where(eq(leadSources.id, input.id));
    return { success: true };
  }),
});

// ─── Propensity Features ─────────────────────────────────────────
const propensityRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(propensityFeatures).orderBy(propensityFeatures.importanceRank);
  }),
  create: adminProcedure.input(z.object({
    featureName: z.string().max(200), featureSource: z.string().max(100).optional(),
    dataType: z.enum(["numeric","categorical","boolean"]),
    description: z.string().optional(), importanceRank: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(propensityFeatures).values(input);
    return { id: r.insertId };
  }),
});

// ─── Platform Learnings ──────────────────────────────────────────
const platformLearningsRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(platformLearnings).orderBy(desc(platformLearnings.createdAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    learningType: z.enum(["pattern","anomaly","trend","correlation","best_practice","risk_factor"]),
    category: z.string().max(64).optional(), description: z.string(),
    evidence: z.any().optional(), confidence: z.number().optional(), impactScore: z.number().optional(),
    applicableLayer: z.enum(["platform","organization","manager","professional","user"]).optional(),
    actionRecommendation: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const id = crypto.randomUUID();
    await db.insert(platformLearnings).values({ ...input, id, status: "detected" as const });
    return { id };
  }),
  updateStatus: adminProcedure.input(z.object({
    id: z.string(), status: z.enum(["detected","validated","applied","rejected","expired"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const updates: Record<string, any> = { status: input.status };
    if (input.status === "applied") updates.appliedAt = new Date();
    await db.update(platformLearnings).set(updates).where(eq(platformLearnings.id, input.id));
    return { success: true };
  }),
});

// ─── Provider Health Checks ──────────────────────────────────────
const healthChecksRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(providerHealthChecks).orderBy(desc(providerHealthChecks.id));
  }),
  create: adminProcedure.input(z.object({
    providerName: z.string().max(100),
    checkType: z.enum(["known_good_query","availability_check","response_validation"]),
    knownGoodInput: z.any().optional(), expectedResultPattern: z.string().max(500).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(providerHealthChecks).values(input);
    return { id: r.insertId };
  }),
  updateStatus: adminProcedure.input(z.object({
    id: z.number(), status: z.enum(["healthy","degraded","down","blocked"]),
    responseTimeMs: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    const setData: Record<string, any> = { ...updates, lastCheckedAt: new Date() };
    if (input.status === "healthy") {
      setData.lastHealthyAt = new Date();
      setData.consecutiveFailures = 0;
      setData.alertSent = false;
    } else {
      setData.consecutiveFailures = sql`${providerHealthChecks.consecutiveFailures} + 1`;
    }
    await db.update(providerHealthChecks).set(setData).where(eq(providerHealthChecks.id, id));
    return { success: true };
  }),
});

// ─── Carrier Submissions ─────────────────────────────────────────
const carrierSubsRouter = router({
  list: protectedProcedure.input(z.object({ quoteId: z.number().optional(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.quoteId) {
      return db.select().from(carrierSubmissions).where(eq(carrierSubmissions.quoteId, input.quoteId)).orderBy(desc(carrierSubmissions.createdAt)).limit(input.limit);
    }
    return db.select().from(carrierSubmissions).orderBy(desc(carrierSubmissions.createdAt)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    quoteId: z.number().optional(), carrierId: z.number().optional(),
    submissionMethod: z.enum(["api","pdf","manual"]).default("manual"),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(carrierSubmissions).values({ ...input, status: "draft" as const });
    return { id: r.insertId };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(), status: z.enum(["draft","submitted","accepted","rejected","pending"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const updates: Record<string, any> = { status: input.status };
    if (input.status === "submitted") updates.submittedAt = new Date();
    if (["accepted","rejected"].includes(input.status)) updates.responseReceivedAt = new Date();
    await db.update(carrierSubmissions).set(updates).where(eq(carrierSubmissions.id, input.id));
    return { success: true };
  }),
});

export const remainingOrphansRouter = router({
  reconciliation: reconciliationRouter,
  marketSubs: marketSubsRouter,
  marketEvents: marketEventsRouter,
  regulatory: regulatoryRouter,
  txCategories: txCategoriesRouter,
  eduProgress: eduProgressRouter,
  eduTriggers: eduTriggersRouter,
  studyProgress: studyProgressRouter,
  backtests: backtestsRouter,
  loadTests: loadTestRouter,
  leadSources: leadSourcesRouter,
  propensity: propensityRouter,
  platformLearnings: platformLearningsRouter,
  healthChecks: healthChecksRouter,
  carrierSubs: carrierSubsRouter,
});
