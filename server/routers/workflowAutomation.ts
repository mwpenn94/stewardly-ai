/**
 * Workflow Automation Router — workflowEventChains, workflowExecutionLog, workflowCheckpoints
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, count } from "drizzle-orm";
import { getDb } from "../db";
import { workflowEventChains, workflowExecutionLog, workflowCheckpoints } from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

const chainsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(workflowEventChains).orderBy(desc(workflowEventChains.id)).limit(input.limit);
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(workflowEventChains).where(eq(workflowEventChains.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),
  create: adminProcedure.input(z.object({
    name: z.string().max(256), eventType: z.string().max(128), actionsJson: z.string(), isActive: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(workflowEventChains).values({ ...input, createdBy: ctx.user.id });
    return { id: r.insertId };
  }),
  toggle: adminProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(workflowEventChains).set({ isActive: input.isActive }).where(eq(workflowEventChains.id, input.id));
    return { success: true };
  }),
  remove: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(workflowEventChains).where(eq(workflowEventChains.id, input.id));
    return { success: true };
  }),
});

const executionLogRouter = router({
  list: protectedProcedure.input(z.object({ chainId: z.number().optional(), limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let q = db.select().from(workflowExecutionLog).orderBy(desc(workflowExecutionLog.id)).limit(input.limit).$dynamic();
    if (input.chainId) q = q.where(eq(workflowExecutionLog.chainId, input.chainId));
    return q;
  }),
  create: protectedProcedure.input(z.object({
    chainId: z.number(), eventSource: z.string().max(256).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(workflowExecutionLog).values({ ...input, status: "running" as const });
    return { id: r.insertId };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(), status: z.enum(["running","completed","failed","partial"]),
    actionsExecuted: z.number().optional(), actionsFailed: z.number().optional(), resultJson: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(workflowExecutionLog).set(updates).where(eq(workflowExecutionLog.id, id));
    return { success: true };
  }),
});

const checkpointsRouter = router({
  list: protectedProcedure.input(z.object({ workflowId: z.number(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(workflowCheckpoints).where(eq(workflowCheckpoints.workflowId, input.workflowId)).orderBy(desc(workflowCheckpoints.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    workflowId: z.number(), agentRunId: z.number().optional(), stepIndex: z.number().default(0),
    stepName: z.string().max(255).optional(), state: z.any().optional(),
    status: z.enum(["saved","restored","compensating","compensated","failed"]).default("saved"),
    compensationAction: z.string().optional(), maxRetries: z.number().default(3),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(workflowCheckpoints).values(input);
    return { id: r.insertId };
  }),
  restore: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [cp] = await db.select().from(workflowCheckpoints).where(eq(workflowCheckpoints.id, input.id));
    if (!cp) throw new TRPCError({ code: "NOT_FOUND" });
    await db.update(workflowCheckpoints).set({ status: "restored" as const }).where(eq(workflowCheckpoints.id, input.id));
    return { state: cp.state, stepIndex: cp.stepIndex };
  }),
});

export const workflowAutomationRouter = router({
  chains: chainsRouter,
  executions: executionLogRouter,
  checkpoints: checkpointsRouter,
});
