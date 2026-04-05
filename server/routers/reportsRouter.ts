/**
 * Reports Router — Report generation and snapshots
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const reportsBusinessRouter = router({
  generate: protectedProcedure
    .input(z.object({
      type: z.string(),
      scopeType: z.enum(["platform", "region", "team", "individual"]),
      scopeId: z.number().optional(),
      periodStart: z.string(),
      periodEnd: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { generateReport } = await import("../services/reporting/reportGenerator");
      return generateReport({
        type: input.type as any,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
      });
    }),

  getSnapshots: protectedProcedure
    .input(z.object({ type: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { reportSnapshots } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(reportSnapshots).orderBy(desc(reportSnapshots.generatedAt)).limit(input?.limit || 20);
    }),
});
