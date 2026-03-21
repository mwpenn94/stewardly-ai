/**
 * Exponential Engine Router
 * 
 * Provides endpoints for:
 * - Tracking user platform events (page visits, feature usage, etc.)
 * - Retrieving user proficiency data
 * - Managing platform changelog
 */

import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  trackEvent,
  recalculateProficiency,
  assembleExponentialContext,
  markChangelogInformed,
  addChangelogEntry,
  FEATURE_CATALOG,
} from "../services/exponentialEngine";

export const exponentialEngineRouter = router({
  // ── Track a platform event ──────────────────────────────────────
  trackEvent: protectedProcedure
    .input(z.object({
      eventType: z.string().max(64),
      featureKey: z.string().max(128),
      metadata: z.record(z.string(), z.unknown()).optional(),
      sessionId: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await trackEvent({
        userId: ctx.user.id,
        eventType: input.eventType,
        featureKey: input.featureKey,
        metadata: input.metadata,
        sessionId: input.sessionId,
      });
      return { success: true };
    }),

  // ── Batch track multiple events ─────────────────────────────────
  trackBatch: protectedProcedure
    .input(z.object({
      events: z.array(z.object({
        eventType: z.string().max(64),
        featureKey: z.string().max(128),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).max(50),
      sessionId: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const event of input.events) {
        await trackEvent({
          userId: ctx.user.id,
          eventType: event.eventType,
          featureKey: event.featureKey,
          metadata: event.metadata,
          sessionId: input.sessionId,
        });
      }
      return { success: true, tracked: input.events.length };
    }),

  // ── Get user's proficiency summary ──────────────────────────────
  getProficiency: protectedProcedure.query(async ({ ctx }) => {
    // Recalculate first to ensure freshness
    await recalculateProficiency(ctx.user.id);
    const context = await assembleExponentialContext(
      ctx.user.id,
      ctx.user.role || "user"
    );
    return {
      overallProficiency: context.overallProficiency,
      totalInteractions: context.totalInteractions,
      featuresExplored: context.featuresExplored,
      featuresTotal: context.featuresTotal,
      exploredFeatures: context.exploredFeatures,
      undiscoveredFeatures: context.undiscoveredFeatures,
      recentActivity: context.recentActivity,
    };
  }),

  // ── Get feature catalog ─────────────────────────────────────────
  getFeatureCatalog: publicProcedure.query(() => {
    return FEATURE_CATALOG.map(f => ({
      key: f.key,
      label: f.label,
      category: f.category,
      description: f.description,
      roles: f.roles,
    }));
  }),

  // ── Mark changelog as informed ──────────────────────────────────
  markChangelogRead: protectedProcedure
    .input(z.object({
      changelogId: z.number(),
      via: z.enum(["ai_chat", "notification", "changelog_page", "onboarding"]).default("ai_chat"),
    }))
    .mutation(async ({ ctx, input }) => {
      await markChangelogInformed(ctx.user.id, input.changelogId, input.via);
      return { success: true };
    }),

  // ── Admin: Add changelog entry ──────────────────────────────────
  addChangelog: adminProcedure
    .input(z.object({
      version: z.string().max(32),
      title: z.string().max(256),
      description: z.string(),
      featureKeys: z.array(z.string()).optional(),
      changeType: z.enum(["new_feature", "improvement", "fix", "removal"]),
      impactedRoles: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      await addChangelogEntry({
        version: input.version,
        title: input.title,
        description: input.description,
        featureKeys: input.featureKeys,
        changeType: input.changeType,
        impactedRoles: input.impactedRoles,
      });
      return { success: true };
    }),
});
