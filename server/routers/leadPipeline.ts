/**
 * Lead Pipeline Router — Lead management and pipeline operations
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const leadPipelineRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [lead] = await db.select().from(leadPipeline).where(eq(leadPipeline.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      return lead;
    }),

  getPipeline: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { leadPipeline } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(leadPipeline).orderBy(desc(leadPipeline.createdAt)).limit(input?.limit || 50);
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
});
