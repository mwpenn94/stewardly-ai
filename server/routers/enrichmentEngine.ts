/**
 * Enrichment Engine Router — enrichmentDatasets, enrichmentCohorts, enrichmentMatches
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { enrichmentDatasets, enrichmentCohorts, enrichmentMatches } from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

const datasetsRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(enrichmentDatasets).orderBy(desc(enrichmentDatasets.id)).limit(input.limit);
  }),
  create: adminProcedure.input(z.object({
    name: z.string().max(256), description: z.string().optional(),
    applicableDomains: z.array(z.string()).optional(), dataType: z.string().max(64).optional(),
    matchDimensions: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(enrichmentDatasets).values(input);
    return { id: r.insertId };
  }),
  remove: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(enrichmentDatasets).where(eq(enrichmentDatasets.id, input.id));
    return { success: true };
  }),
});

const cohortsRouter = router({
  list: adminProcedure.input(z.object({ datasetId: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(enrichmentCohorts).where(eq(enrichmentCohorts.datasetId, input.datasetId)).orderBy(desc(enrichmentCohorts.id));
  }),
  create: adminProcedure.input(z.object({
    datasetId: z.number(), matchCriteria: z.any(), enrichmentFields: z.any(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(enrichmentCohorts).values(input);
    return { id: r.insertId };
  }),
});

const matchesRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(enrichmentMatches).where(eq(enrichmentMatches.userId, ctx.user.id)).orderBy(desc(enrichmentMatches.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    datasetId: z.number(), cohortId: z.number(), matchFields: z.any().optional(),
    confidenceScore: z.number().min(0).max(1).default(0), applicableDomains: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(enrichmentMatches).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

export const enrichmentEngineRouter = router({
  datasets: datasetsRouter,
  cohorts: cohortsRouter,
  matches: matchesRouter,
});
