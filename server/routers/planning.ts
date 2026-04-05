/**
 * Planning Router — Business plans, actuals, and insights
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const planningRouter = router({
  createPlan: protectedProcedure
    .input(z.object({
      planYear: z.number(),
      planQuarter: z.number().optional(),
      roleSegment: z.string().optional(),
      incomeTarget: z.number().optional(),
      gdcTarget: z.number().optional(),
      productMix: z.any().optional(),
      funnelTargets: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { businessPlans } = await import("../../drizzle/schema");
      const [result] = await db.insert(businessPlans).values({
        userId: ctx.user!.id,
        planYear: input.planYear,
        planQuarter: input.planQuarter,
        roleSegment: input.roleSegment as any,
        incomeTarget: String(input.incomeTarget || 0),
        gdcTarget: String(input.gdcTarget || 0),
        productMix: input.productMix as any,
        funnelTargets: input.funnelTargets as any,
      }).$returningId();
      return { id: result.id };
    }),

  getPlans: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { businessPlans } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    return db.select().from(businessPlans).where(eq(businessPlans.userId, ctx.user!.id)).orderBy(desc(businessPlans.createdAt));
  }),

  enterActuals: protectedProcedure
    .input(z.object({
      periodType: z.string(),
      periodStart: z.string(),
      periodEnd: z.string(),
      gdcActual: z.number().optional(),
      casesPlaced: z.number().optional(),
      casesSubmitted: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { productionActuals } = await import("../../drizzle/schema");
      const [result] = await db.insert(productionActuals).values({
        userId: ctx.user!.id,
        periodType: input.periodType as any,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        gdcActual: String(input.gdcActual || 0),
        casesPlaced: input.casesPlaced,
        casesSubmitted: input.casesSubmitted,
      }).$returningId();
      return { id: result.id };
    }),
});
