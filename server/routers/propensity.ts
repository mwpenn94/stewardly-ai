/**
 * Propensity Router — Lead scoring and model management
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";

export const propensityRouter = router({
  score: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const { scoreLead } = await import("../services/propensity/scoringEngine");
      return scoreLead(input.leadId);
    }),

  getScores: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { propensityScores } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return db.select().from(propensityScores).where(eq(propensityScores.leadId, input.leadId));
    }),

  getModels: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { propensityModels } = await import("../../drizzle/schema");
    return db.select().from(propensityModels);
  }),

  retrainTrigger: adminProcedure.mutation(async () => {
    const { rescoreAllLeads } = await import("../services/propensity/scoringEngine");
    return rescoreAllLeads();
  }),
});
