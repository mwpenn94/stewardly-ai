import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  listModels,
  executeModel,
  getModelRunHistory,
  seedAnalyticalModels,
  storeOutputRecord,
} from "../services/modelEngine";

export const modelEngineRouter = router({
  // List all available models
  list: protectedProcedure.query(async () => {
    return listModels();
  }),

  // Execute a model manually
  execute: protectedProcedure
    .input(z.object({
      modelSlug: z.string(),
      inputData: z.record(z.string(), z.any()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      return executeModel(input.modelSlug, input.inputData, "manual", `user:${ctx.user.id}`);
    }),

  // Get run history for a model
  getRunHistory: protectedProcedure
    .input(z.object({
      modelSlug: z.string(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return getModelRunHistory(input.modelSlug, input.limit);
    }),

  // Seed built-in models (admin only)
  seed: adminProcedure.mutation(async () => {
    await seedAnalyticalModels();
    return { success: true };
  }),
});
