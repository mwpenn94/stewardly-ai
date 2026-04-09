/**
 * audio.ts — tRPC router for the universal audio intelligence system.
 *
 * Pass 136. Provides CRUD for user audio preferences and audio script
 * management. Backs the /settings/audio page and the AudioCompanion's
 * personalization pipeline.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userAudioPreferences, audioScripts, userAudioOverrides } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export const audioRouter = router({
  /**
   * Get the authenticated user's audio preferences.
   * Returns defaults if no row exists yet.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(userAudioPreferences)
      .where(eq(userAudioPreferences.userId, String(ctx.user!.id)));

    if (!row) {
      return {
        voiceId: "en-US-GuyNeural",
        speed: 1.0,
        pitch: "default",
        expandAcronyms: true,
        simplifyLanguage: false,
        includeExamples: true,
        verbosityLevel: "standard",
        enableNavigationAudio: true,
        enableActionFeedback: true,
        enableSoundEffects: true,
        autoRefineScripts: true,
      };
    }

    return {
      voiceId: row.voiceId ?? "en-US-GuyNeural",
      speed: Number(row.speed) || 1.0,
      pitch: row.pitch ?? "default",
      expandAcronyms: Boolean(row.expandAcronyms),
      simplifyLanguage: Boolean(row.simplifyLanguage),
      includeExamples: Boolean(row.includeExamples),
      verbosityLevel: row.verbosityLevel ?? "standard",
      enableNavigationAudio: Boolean(row.enableNavigationAudio),
      enableActionFeedback: Boolean(row.enableActionFeedback),
      enableSoundEffects: Boolean(row.enableSoundEffects),
      autoRefineScripts: Boolean(row.autoRefineScripts),
    };
  }),

  /**
   * Upsert the authenticated user's audio preferences.
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        voiceId: z.string().optional(),
        speed: z.number().min(0.5).max(3.0).optional(),
        pitch: z.string().optional(),
        expandAcronyms: z.boolean().optional(),
        simplifyLanguage: z.boolean().optional(),
        includeExamples: z.boolean().optional(),
        verbosityLevel: z.enum(["concise", "standard", "detailed"]).optional(),
        enableNavigationAudio: z.boolean().optional(),
        enableActionFeedback: z.boolean().optional(),
        enableSoundEffects: z.boolean().optional(),
        autoRefineScripts: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = String(ctx.user!.id);

      const [existing] = await db
        .select({ id: userAudioPreferences.id })
        .from(userAudioPreferences)
        .where(eq(userAudioPreferences.userId, userId));

      if (existing) {
        await db
          .update(userAudioPreferences)
          .set({
            ...(input.voiceId !== undefined && { voiceId: input.voiceId }),
            ...(input.speed !== undefined && { speed: String(input.speed) }),
            ...(input.pitch !== undefined && { pitch: input.pitch }),
            ...(input.expandAcronyms !== undefined && { expandAcronyms: input.expandAcronyms }),
            ...(input.simplifyLanguage !== undefined && { simplifyLanguage: input.simplifyLanguage }),
            ...(input.includeExamples !== undefined && { includeExamples: input.includeExamples }),
            ...(input.verbosityLevel !== undefined && { verbosityLevel: input.verbosityLevel }),
            ...(input.enableNavigationAudio !== undefined && { enableNavigationAudio: input.enableNavigationAudio }),
            ...(input.enableActionFeedback !== undefined && { enableActionFeedback: input.enableActionFeedback }),
            ...(input.enableSoundEffects !== undefined && { enableSoundEffects: input.enableSoundEffects }),
            ...(input.autoRefineScripts !== undefined && { autoRefineScripts: input.autoRefineScripts }),
          })
          .where(eq(userAudioPreferences.id, existing.id));
      } else {
        await db.insert(userAudioPreferences).values({
          id: nanoid(),
          userId,
          voiceId: input.voiceId ?? "en-US-GuyNeural",
          speed: String(input.speed ?? 1.0),
          pitch: input.pitch ?? "default",
          expandAcronyms: input.expandAcronyms ?? true,
          simplifyLanguage: input.simplifyLanguage ?? false,
          includeExamples: input.includeExamples ?? true,
          verbosityLevel: input.verbosityLevel ?? "standard",
          enableNavigationAudio: input.enableNavigationAudio ?? true,
          enableActionFeedback: input.enableActionFeedback ?? true,
          enableSoundEffects: input.enableSoundEffects ?? true,
          autoRefineScripts: input.autoRefineScripts ?? true,
        });
      }

      return { success: true };
    }),

  /**
   * Get an audio script for a specific content item.
   */
  getScript: protectedProcedure
    .input(z.object({ contentType: z.string(), contentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = String(ctx.user!.id);

      const [script] = await db
        .select()
        .from(audioScripts)
        .where(
          and(
            eq(audioScripts.contentType, input.contentType),
            eq(audioScripts.contentId, input.contentId),
          ),
        );

      if (!script) return null;

      // Check for user override
      const [override] = await db
        .select()
        .from(userAudioOverrides)
        .where(
          and(
            eq(userAudioOverrides.userId, userId),
            eq(userAudioOverrides.audioScriptId, script.id),
          ),
        );

      return {
        id: script.id,
        defaultScript: script.defaultScript,
        defaultScriptSsml: script.defaultScriptSsml,
        personalizedScript: override?.personalizedScript ?? null,
        personalizedSsml: override?.personalizedSsml ?? null,
        listenCount: script.listenCount ?? 0,
        clarityScore: script.clarityScore ? Number(script.clarityScore) : null,
      };
    }),

  /**
   * Record a listen event (increments listen count).
   */
  recordListen: protectedProcedure
    .input(z.object({ scriptId: z.string(), completionRate: z.number().min(0).max(1).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Simple increment — in production this would use SQL increment
      const [script] = await db
        .select({ id: audioScripts.id, listenCount: audioScripts.listenCount })
        .from(audioScripts)
        .where(eq(audioScripts.id, input.scriptId));

      if (script) {
        await db
          .update(audioScripts)
          .set({ listenCount: (script.listenCount ?? 0) + 1 })
          .where(eq(audioScripts.id, input.scriptId));
      }

      return { success: true };
    }),
});
