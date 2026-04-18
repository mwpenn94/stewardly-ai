/**
 * Lead Pipeline Router — Lead management and pipeline operations
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "../_core/logger";

export const leadPipelineRouter = router({
  getPipeline: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) return [];
        const { leadPipeline } = await import("../../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        return db.select().from(leadPipeline).orderBy(desc(leadPipeline.createdAt)).limit(input?.limit || 50);
      } catch (e: any) {
        // Table may not exist yet — return empty array gracefully
        logger.warn("[leadPipeline.getPipeline]", { error: e?.message?.slice(0, 120) });
        return [];
      }
    }),

  assign: protectedProcedure
    .input(z.object({ leadId: z.number(), advisorId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ assignedAdvisorId: input.advisorId, assignedAt: new Date(), status: "assigned" }).where(eq(leadPipeline.id, input.leadId));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ leadId: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ status: input.status as any, updatedAt: new Date() }).where(eq(leadPipeline.id, input.leadId));
      return { success: true };
    }),

  bulkUpdateStatus: protectedProcedure
    .input(z.object({ leadIds: z.array(z.number()).min(1).max(100), status: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { leadPipeline } = await import("../../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ status: input.status as any, updatedAt: new Date() }).where(inArray(leadPipeline.id, input.leadIds));
      return { success: true, count: input.leadIds.length };
    }),

  sourcePerformance: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { leadSourcePerformance } = await import("../../drizzle/schema");
    return db.select().from(leadSourcePerformance);
  }),

  deletePii: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ piiDeletionRequested: true, updatedAt: new Date() }).where(eq(leadPipeline.id, input.leadId));
      return { success: true };
    }),

  getScoreHistory: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      try {
        const { getScoreHistory } = await import("../services/propensity/scoringEngine");
        return getScoreHistory(input.leadId);
      } catch (e: any) {
        logger.warn("[leadPipeline.getScoreHistory]", { error: e?.message?.slice(0, 120) });
        return [];
      }
    }),

  getLeadSources: adminProcedure.query(async () => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { leadSources } = await import("../../drizzle/schema");
      return db.select().from(leadSources);
    } catch (e: any) {
      logger.warn("[leadPipeline.getLeadSources]", { error: e?.message?.slice(0, 120) });
      return [];
    }
  }),

  getLeadDetail: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) return null;
        const { leadPipeline } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select().from(leadPipeline).where(eq(leadPipeline.id, input.leadId)).limit(1);
        return rows[0] ?? null;
      } catch (e: any) {
        logger.warn("[leadPipeline.getLeadDetail]", { error: e?.message?.slice(0, 120) });
        return null;
      }
    }),
});
