import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getOrCreateProfile,
  getProfileWithDimensions,
  updateDimension,
  synthesizeProfile,
  generateQuestions,
  getPendingQuestions,
  linkHousehold,
  getHouseholdMembers,
  getChangeHistory,
  SUITABILITY_DIMENSIONS,
} from "../services/suitabilityEngine";

export const suitabilityEngineRouter = router({
  // Get dimension definitions
  getDimensions: publicProcedure.query(() => SUITABILITY_DIMENSIONS),

  // Get or create user's suitability profile with all dimensions
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return getProfileWithDimensions(ctx.user.id);
  }),

  // Update a specific dimension
  updateDimension: protectedProcedure
    .input(z.object({
      dimensionKey: z.string(),
      value: z.any(),
      score: z.number().min(0).max(100),
      confidence: z.number().min(0).max(1),
      source: z.string().default("user_input"),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      return updateDimension(
        profile.id,
        input.dimensionKey as any,
        input.value,
        input.score,
        input.confidence,
        input.source,
        ctx.user.id,
      );
    }),

  // Synthesize profile (recalculate overall scores)
  synthesize: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    return synthesizeProfile(profile.id);
  }),

  // Get pending profiling questions
  getQuestions: protectedProcedure.query(async ({ ctx }) => {
    return getPendingQuestions(ctx.user.id);
  }),

  // Generate new profiling questions
  generateQuestions: protectedProcedure.mutation(async ({ ctx }) => {
    return generateQuestions(ctx.user.id);
  }),

  // Answer a profiling question
  answerQuestion: protectedProcedure
    .input(z.object({
      questionId: z.string(),
      answer: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { suitabilityQuestionsQueue } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await db.update(suitabilityQuestionsQueue)
        .set({
          status: "answered",
          answer: JSON.stringify(input.answer),
          answeredAt: new Date(),
        })
        .where(eq(suitabilityQuestionsQueue.id, input.questionId));

      return { success: true };
    }),

  // Get change history
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      return getChangeHistory(profile.id, input?.limit ?? 50);
    }),

  // Household links
  linkHousehold: protectedProcedure
    .input(z.object({
      linkedUserId: z.number(),
      relationship: z.enum(["spouse", "partner", "dependent", "parent", "sibling", "other"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return linkHousehold(ctx.user.id, input.linkedUserId, input.relationship);
    }),

  getHousehold: protectedProcedure.query(async ({ ctx }) => {
    return getHouseholdMembers(ctx.user.id);
  }),
});
