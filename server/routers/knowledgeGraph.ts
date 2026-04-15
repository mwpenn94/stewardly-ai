/**
 * Knowledge Graph Router — kgNodes, kgEdges
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, or, count } from "drizzle-orm";
import { getDb } from "../db";
import { kgNodes, kgEdges } from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

const NODE_TYPES = ["person","account","goal","insurance","property","liability","income","tax","estate","product","regulation","document","advisor","beneficiary"] as const;
const EDGE_TYPES = ["owns","benefits_from","funds","pays","governs","depends_on","conflicts_with","beneficiary_of","manages","insures","employs","related_to"] as const;

const nodesRouter = router({
  list: protectedProcedure
    .input(z.object({ nodeType: z.enum(NODE_TYPES).optional(), limit: z.number().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      let q = db.select().from(kgNodes).where(eq(kgNodes.userId, ctx.user.id)).orderBy(desc(kgNodes.updatedAt)).limit(input.limit).$dynamic();
      if (input.nodeType) q = q.where(and(eq(kgNodes.userId, ctx.user.id), eq(kgNodes.nodeType, input.nodeType)));
      return q;
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(kgNodes).where(and(eq(kgNodes.id, input.id), eq(kgNodes.userId, ctx.user.id)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),
  create: protectedProcedure
    .input(z.object({
      nodeType: z.enum(NODE_TYPES),
      label: z.string().max(256),
      dataJson: z.any().optional(),
      status: z.enum(["active","inactive","pending"]).default("active"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [r] = await db.insert(kgNodes).values({ ...input, userId: ctx.user.id });
      return { id: r.insertId };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), label: z.string().max(256).optional(), dataJson: z.any().optional(), status: z.enum(["active","inactive","pending"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const { id, ...updates } = input;
      await db.update(kgNodes).set(updates).where(and(eq(kgNodes.id, id), eq(kgNodes.userId, ctx.user.id)));
      return { success: true };
    }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    // Also remove connected edges
    await db.delete(kgEdges).where(and(eq(kgEdges.userId, ctx.user.id), or(eq(kgEdges.sourceNodeId, input.id), eq(kgEdges.targetNodeId, input.id))));
    await db.delete(kgNodes).where(and(eq(kgNodes.id, input.id), eq(kgNodes.userId, ctx.user.id)));
    return { success: true };
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const rows = await db.select({ nodeType: kgNodes.nodeType, cnt: count() }).from(kgNodes).where(eq(kgNodes.userId, ctx.user.id)).groupBy(kgNodes.nodeType);
    return rows;
  }),
});

const edgesRouter = router({
  list: protectedProcedure
    .input(z.object({ nodeId: z.number().optional(), limit: z.number().min(1).max(500).default(200) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input.nodeId) {
        return db.select().from(kgEdges).where(and(eq(kgEdges.userId, ctx.user.id), or(eq(kgEdges.sourceNodeId, input.nodeId), eq(kgEdges.targetNodeId, input.nodeId)))).limit(input.limit);
      }
      return db.select().from(kgEdges).where(eq(kgEdges.userId, ctx.user.id)).orderBy(desc(kgEdges.id)).limit(input.limit);
    }),
  create: protectedProcedure
    .input(z.object({
      sourceNodeId: z.number(), targetNodeId: z.number(),
      edgeType: z.enum(EDGE_TYPES),
      weight: z.number().min(0).max(10).default(1),
      metadataJson: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [r] = await db.insert(kgEdges).values({ ...input, userId: ctx.user.id });
      return { id: r.insertId };
    }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(kgEdges).where(and(eq(kgEdges.id, input.id), eq(kgEdges.userId, ctx.user.id)));
    return { success: true };
  }),
});

export const knowledgeGraphRouter = router({
  nodes: nodesRouter,
  edges: edgesRouter,
});
