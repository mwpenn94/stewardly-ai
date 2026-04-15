/**
 * AI Autonomy Router
 *
 * Covers: browserSessions, userAutonomyProfiles, improvementSignals,
 *         hypothesisTestResults, reasoningTraces, escalationHistory, promptInteractions
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  browserSessions, userAutonomyProfiles, improvementSignals,
  hypothesisTestResults, reasoningTraces, escalationHistory,
} from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

// ─── Browser Sessions ────────────────────────────────────────────
const browserSessionsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(browserSessions).where(eq(browserSessions.userId, ctx.user.id)).orderBy(desc(browserSessions.createdAt)).limit(input.limit);
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(browserSessions).where(and(eq(browserSessions.id, input.id), eq(browserSessions.userId, ctx.user.id)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),
  create: protectedProcedure.input(z.object({
    agentRunId: z.number().optional(), targetUrl: z.string(),
    domain: z.string().max(255).optional(), allowed: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(browserSessions).values({ ...input, userId: ctx.user.id, status: "initializing" as const });
    return { id: r.insertId };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(), status: z.enum(["initializing","active","completed","failed","timeout"]),
    actionsLog: z.any().optional(), screenshots: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    if (input.status === "completed" || input.status === "failed" || input.status === "timeout") {
      Object.assign(updates, { endedAt: new Date() });
    }
    await db.update(browserSessions).set(updates).where(and(eq(browserSessions.id, id), eq(browserSessions.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── User Autonomy Profiles ─────────────────────────────────────
const autonomyProfilesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(userAutonomyProfiles).where(eq(userAutonomyProfiles.userId, ctx.user.id));
    return row ?? null;
  }),
  upsert: protectedProcedure.input(z.object({
    level: z.enum(["supervised","guided","semi_autonomous","autonomous"]).optional(),
    trustScore: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [existing] = await db.select().from(userAutonomyProfiles).where(eq(userAutonomyProfiles.userId, ctx.user.id));
    if (existing) {
      await db.update(userAutonomyProfiles).set(input).where(eq(userAutonomyProfiles.userId, ctx.user.id));
      return { id: existing.id };
    }
    const [r] = await db.insert(userAutonomyProfiles).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  recordInteraction: protectedProcedure.input(z.object({
    successful: z.boolean(), overridden: z.boolean().default(false), escalated: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const updates: Record<string, any> = {
      totalInteractions: sql`${userAutonomyProfiles.totalInteractions} + 1`,
    };
    if (input.successful) updates.successfulActions = sql`${userAutonomyProfiles.successfulActions} + 1`;
    if (input.overridden) updates.overriddenActions = sql`${userAutonomyProfiles.overriddenActions} + 1`;
    if (input.escalated) {
      updates.escalations = sql`${userAutonomyProfiles.escalations} + 1`;
      updates.lastEscalation = new Date();
    }
    await db.update(userAutonomyProfiles).set(updates).where(eq(userAutonomyProfiles.userId, ctx.user.id));
    return { success: true };
  }),
});

// ─── Improvement Signals ─────────────────────────────────────────
const signalsRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(improvementSignals).orderBy(desc(improvementSignals.detectedAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    signalType: z.string().max(50), severity: z.string().max(20),
    sourceMetric: z.string().max(100).optional(), sourceValue: z.string().optional(), threshold: z.string().max(100).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(improvementSignals).values(input);
    return { id: r.insertId };
  }),
  resolve: adminProcedure.input(z.object({ id: z.number(), resolvedByHypothesisId: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(improvementSignals).set({ resolvedAt: new Date(), resolvedByHypothesisId: input.resolvedByHypothesisId }).where(eq(improvementSignals.id, input.id));
    return { success: true };
  }),
});

// ─── Hypothesis Test Results ─────────────────────────────────────
const hypothesisRouter = router({
  list: adminProcedure.input(z.object({ hypothesisId: z.number().optional(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.hypothesisId) {
      return db.select().from(hypothesisTestResults).where(eq(hypothesisTestResults.hypothesisId, input.hypothesisId)).orderBy(desc(hypothesisTestResults.id)).limit(input.limit);
    }
    return db.select().from(hypothesisTestResults).orderBy(desc(hypothesisTestResults.id)).limit(input.limit);
  }),
  record: adminProcedure.input(z.object({
    hypothesisId: z.number(), sessionId: z.number().optional(),
    qualityBefore: z.any().optional(), qualityAfter: z.any().optional(),
    regressionDetected: z.boolean().default(false), costDelta: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(hypothesisTestResults).values(input);
    return { id: r.insertId };
  }),
});

// ─── Reasoning Traces ────────────────────────────────────────────
const tracesRouter = router({
  list: protectedProcedure.input(z.object({ sessionId: z.number().optional(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.sessionId) {
      return db.select().from(reasoningTraces).where(eq(reasoningTraces.sessionId, input.sessionId)).orderBy(desc(reasoningTraces.id)).limit(input.limit);
    }
    return db.select().from(reasoningTraces).orderBy(desc(reasoningTraces.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    sessionId: z.number().optional(), stepNumber: z.number(),
    thought: z.string().optional(), action: z.string().optional(),
    observation: z.string().optional(), toolName: z.string().max(100).optional(),
    durationMs: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(reasoningTraces).values(input);
    return { id: r.insertId };
  }),
});

// ─── Escalation History ──────────────────────────────────────────
const escalationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(escalationHistory).where(eq(escalationHistory.userId, ctx.user.id)).orderBy(desc(escalationHistory.id)).limit(input.limit);
  }),
  record: protectedProcedure.input(z.object({
    fromLevel: z.number(), toLevel: z.number(), reason: z.string().optional(), decidedBy: z.string().max(50).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(escalationHistory).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

export const aiAutonomyRouter = router({
  browserSessions: browserSessionsRouter,
  autonomyProfiles: autonomyProfilesRouter,
  signals: signalsRouter,
  hypothesis: hypothesisRouter,
  traces: tracesRouter,
  escalation: escalationRouter,
});
