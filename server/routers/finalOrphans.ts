/**
 * Final Orphans Router — Pass 6 Landscape cleanup (last 5 tables)
 *
 * Covers: integrationSyncConfig, plaidWebhooksLog, exportJobs,
 *         documentTemplates, integrationOptimizationCycles
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  integrationSyncConfig, plaidWebhooksLog, exportJobs,
  documentTemplates, integrationOptimizationCycles,
  promptExperiments, modelSchedules, modelBacktests,
} from "../../drizzle/schema";
import crypto from "crypto";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
};

// ─── Integration Sync Config ─────────────────────────────────────
const syncConfigRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(integrationSyncConfig).orderBy(desc(integrationSyncConfig.lastSyncAt));
  }),
  getByConnection: adminProcedure.input(z.object({ connectionId: z.string() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(integrationSyncConfig).where(eq(integrationSyncConfig.connectionId, input.connectionId));
    return row ?? null;
  }),
  create: adminProcedure.input(z.object({
    connectionId: z.string().max(36),
    syncType: z.enum(["full","incremental","webhook"]).default("incremental"),
    schedule: z.string().max(64).optional(), maxRetries: z.number().default(3),
    backoffMinutes: z.number().default(5), fieldMappingOverrides: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const id = crypto.randomUUID();
    await db.insert(integrationSyncConfig).values({ ...input, id });
    return { id };
  }),
  update: adminProcedure.input(z.object({
    id: z.string(), schedule: z.string().max(64).optional(),
    syncType: z.enum(["full","incremental","webhook"]).optional(),
    maxRetries: z.number().optional(), backoffMinutes: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(integrationSyncConfig).set(updates).where(eq(integrationSyncConfig.id, id));
    return { success: true };
  }),
  recordSync: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(integrationSyncConfig).set({ lastSyncAt: new Date(), retryCount: 0 }).where(eq(integrationSyncConfig.id, input.id));
    return { success: true };
  }),
});

// ─── Plaid Webhooks Log ──────────────────────────────────────────
const plaidWebhooksRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(plaidWebhooksLog).orderBy(desc(plaidWebhooksLog.createdAt)).limit(input.limit);
  }),
  getByItemId: adminProcedure.input(z.object({ itemId: z.string() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(plaidWebhooksLog).where(eq(plaidWebhooksLog.itemId, input.itemId)).orderBy(desc(plaidWebhooksLog.createdAt));
  }),
  record: adminProcedure.input(z.object({
    webhookType: z.string().max(128), itemId: z.string().max(256).optional(), payload: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(plaidWebhooksLog).values(input);
    return { id: r.insertId };
  }),
  updateStatus: adminProcedure.input(z.object({
    id: z.number(), status: z.enum(["received","processing","processed","failed"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const updates: Record<string, any> = { status: input.status };
    if (input.status === "processed") updates.processedAt = new Date();
    await db.update(plaidWebhooksLog).set(updates).where(eq(plaidWebhooksLog.id, input.id));
    return { success: true };
  }),
});

// ─── Export Jobs ─────────────────────────────────────────────────
const exportJobsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(exportJobs).where(eq(exportJobs.userId, ctx.user.id)).orderBy(desc(exportJobs.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    format: z.enum(["csv","excel","pdf","docx","json"]).default("csv"),
    entityType: z.string().max(100), filters: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(exportJobs).values({ ...input, userId: ctx.user.id, status: "pending" as const });
    return { id: r.insertId };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(), status: z.enum(["pending","processing","completed","failed"]),
    fileUrl: z.string().optional(), fileKey: z.string().optional(), rowCount: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(exportJobs).set(updates).where(and(eq(exportJobs.id, id), eq(exportJobs.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Document Templates ──────────────────────────────────────────
const docTemplatesRouter = router({
  list: protectedProcedure.input(z.object({ category: z.string().optional() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(documentTemplates).where(eq(documentTemplates.active, true)).orderBy(desc(documentTemplates.id));
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),
  create: adminProcedure.input(z.object({
    name: z.string().max(255),
    category: z.enum(["compliance","client_report","proposal","agreement","disclosure","meeting_notes","review","planning","custom"]).default("custom"),
    description: z.string().optional(), templateBody: z.string(),
    variables: z.any().optional(),
    outputFormat: z.enum(["pdf","docx","html"]).default("pdf"),
    isSystem: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(documentTemplates).values(input);
    return { id: r.insertId };
  }),
  update: adminProcedure.input(z.object({
    id: z.number(), name: z.string().max(255).optional(), templateBody: z.string().optional(),
    variables: z.any().optional(), active: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(documentTemplates).set(updates).where(eq(documentTemplates.id, id));
    return { success: true };
  }),
});

// ─── Integration Optimization Cycles ─────────────────────────────
const optimizationCyclesRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(integrationOptimizationCycles).orderBy(desc(integrationOptimizationCycles.startedAt)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    cycleType: z.string().max(100).optional(), improvements: z.any().optional(),
    scoreBefore: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(integrationOptimizationCycles).values(input);
    return { id: r.insertId };
  }),
  complete: adminProcedure.input(z.object({
    id: z.number(), improvements: z.any().optional(), scoreAfter: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(integrationOptimizationCycles).set({ ...updates, completedAt: new Date() }).where(eq(integrationOptimizationCycles.id, id));
    return { success: true };
  }),
});

// ─── Prompt Experiments ─────────────────────────────────────────
const promptExperimentsRouter = router({
  list: protectedProcedure.input(z.object({ variantId: z.number().optional(), limit: z.number().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const q = input.variantId
      ? db.select().from(promptExperiments).where(eq(promptExperiments.variantId, input.variantId)).orderBy(desc(promptExperiments.createdAt)).limit(input.limit)
      : db.select().from(promptExperiments).orderBy(desc(promptExperiments.createdAt)).limit(input.limit);
    return q;
  }),
  create: protectedProcedure.input(z.object({
    variantId: z.number(), conversationId: z.number(), messageId: z.number().optional(),
    feedbackRating: z.enum(["up", "down"]).optional(), confidenceScore: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(promptExperiments).values(input);
    return { id: r.insertId };
  }),
  feedback: protectedProcedure.input(z.object({
    id: z.number(), feedbackRating: z.enum(["up", "down"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(promptExperiments).set({ feedbackRating: input.feedbackRating }).where(eq(promptExperiments.id, input.id));
    return { success: true };
  }),
});

// ─── Model Schedules ───────────────────────────────────────────
const modelSchedulesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(modelSchedules).orderBy(desc(modelSchedules.createdAt));
  }),
  create: adminProcedure.input(z.object({
    id: z.string().max(36).default(() => crypto.randomUUID()),
    modelId: z.string().max(36), cronExpression: z.string().max(64),
    timezone: z.string().max(64).default("UTC"), isActive: z.boolean().default(true),
    filterCriteria: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.insert(modelSchedules).values(input);
    return { id: input.id };
  }),
  toggle: adminProcedure.input(z.object({ id: z.string(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(modelSchedules).set({ isActive: input.isActive }).where(eq(modelSchedules.id, input.id));
    return { success: true };
  }),
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(modelSchedules).where(eq(modelSchedules.id, input.id));
    return { success: true };
  }),
});

// ─── Model Backtests ───────────────────────────────────────────
const modelBacktestsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(modelBacktests).where(eq(modelBacktests.userId, ctx.user.id)).orderBy(desc(modelBacktests.createdAt)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    modelName: z.string().max(100), startDate: z.string(), endDate: z.string(),
    initialCapital: z.string(), finalCapital: z.string().optional(),
    returnPct: z.string().optional(), maxDrawdown: z.string().optional(),
    sharpeRatio: z.string().optional(), parameters: z.any().optional(),
    results: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(modelBacktests).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

export const finalOrphansRouter = router({
  syncConfig: syncConfigRouter,
  plaidWebhooks: plaidWebhooksRouter,
  exportJobs: exportJobsRouter,
  docTemplates: docTemplatesRouter,
  optimizationCycles: optimizationCyclesRouter,
  promptExperiments: promptExperimentsRouter,
  modelSchedules: modelSchedulesRouter,
  modelBacktests: modelBacktestsRouter,
});
