/**
 * Exponential Engine Router v2 — Guest-Aware
 * 
 * 5-Layer hierarchy-aware endpoints for:
 * - Event tracking (authenticated users only — persisted to DB)
 * - Proficiency data with layer context (guests get session-based computation)
 * - AI-generated insights and recommendations (guests get client-layer insights)
 * - Adaptive onboarding checklist (guests get client-layer checklist)
 * - Changelog feed with unread counts (guests see all as unread)
 */
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  trackEvent,
  recalculateProficiency,
  assembleExponentialContext,
  assembleGuestContext,
  generateAIInsights,
  generateGuestInsights,
  generateOnboardingChecklist,
  generateGuestOnboardingChecklist,
  getChangelogFeed,
  getGuestChangelogFeed,
  markChangelogInformed,
  addChangelogEntry,
  FEATURE_CATALOG,
  LAYER_HIERARCHY,
} from "../services/exponentialEngine";

// Shared session event schema for guest data
const sessionEventSchema = z.object({
  featureKey: z.string().max(128),
  eventType: z.string().max(64),
  count: z.number().int().min(0),
  durationMs: z.number().min(0),
  lastUsed: z.number(),
});

export const exponentialEngineRouter = router({
  // ── Track a platform event (authenticated only — persisted) ────
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

  // ── Batch track multiple events (authenticated only) ───────────
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

  // ── Get proficiency summary (guest-aware) ──────────────────────
  getProficiency: publicProcedure
    .input(z.object({
      sessionEvents: z.array(sessionEventSchema).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Authenticated user: use DB-backed proficiency
      if (ctx.user) {
        await recalculateProficiency(ctx.user.id);
        const context = await assembleExponentialContext(
          ctx.user.id,
          ctx.user.role || "user"
        );
        return {
          isGuest: false as const,
          overallProficiency: context.overallProficiency,
          totalInteractions: context.totalInteractions,
          featuresExplored: context.featuresExplored,
          featuresTotal: context.featuresTotal,
          exploredFeatures: context.exploredFeatures,
          undiscoveredFeatures: context.undiscoveredFeatures,
          recentActivity: context.recentActivity,
          userLayer: context.userLayer,
          streak: context.streak,
        };
      }

      // Guest user: compute from session data
      const sessionData = { events: input?.sessionEvents || [] };
      const context = assembleGuestContext(sessionData);
      return {
        isGuest: true as const,
        overallProficiency: context.overallProficiency,
        totalInteractions: context.totalInteractions,
        featuresExplored: context.featuresExplored,
        featuresTotal: context.featuresTotal,
        exploredFeatures: context.exploredFeatures,
        undiscoveredFeatures: context.undiscoveredFeatures,
        recentActivity: context.recentActivity,
        userLayer: context.userLayer,
        streak: context.streak,
      };
    }),

  // ── AI-generated proficiency insights (guest-aware) ────────────
  getInsights: publicProcedure
    .input(z.object({
      sessionEvents: z.array(sessionEventSchema).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user) {
        await recalculateProficiency(ctx.user.id);
        return {
          isGuest: false as const,
          ...await generateAIInsights(ctx.user.id, ctx.user.role || "user"),
        };
      }

      const sessionData = { events: input?.sessionEvents || [] };
      return {
        isGuest: true as const,
        ...generateGuestInsights(sessionData),
      };
    }),

  // ── Adaptive onboarding checklist (guest-aware) ────────────────
  getOnboardingChecklist: publicProcedure
    .input(z.object({
      sessionEvents: z.array(sessionEventSchema).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user) {
        await recalculateProficiency(ctx.user.id);
        return generateOnboardingChecklist(ctx.user.id, ctx.user.role || "user");
      }

      const sessionData = { events: input?.sessionEvents || [] };
      return generateGuestOnboardingChecklist(sessionData);
    }),

  // ── Dismiss onboarding (authenticated only) ────────────────────
  dismissOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await trackEvent({
      userId: ctx.user.id,
      eventType: "onboarding_dismissed",
      featureKey: "chat",
      metadata: { dismissed: true },
    });
    return { success: true };
  }),

  // ── Changelog feed (guest-aware) ───────────────────────────────
  getChangelogFeed: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user) {
        return getChangelogFeed(ctx.user.id, input?.limit || 20);
      }
      return getGuestChangelogFeed(input?.limit || 20);
    }),

  // ── Get unread changelog count (guest-aware) ───────────────────
  getUnreadChangelogCount: publicProcedure.query(async ({ ctx }) => {
    if (ctx.user) {
      const { unreadCount } = await getChangelogFeed(ctx.user.id, 50);
      return { unreadCount };
    }
    const { unreadCount } = await getGuestChangelogFeed(50);
    return { unreadCount };
  }),

  // ── Mark changelog as read (authenticated only) ────────────────
  markChangelogRead: protectedProcedure
    .input(z.object({
      changelogId: z.number(),
      via: z.enum(["ai_chat", "notification", "changelog_page", "onboarding"]).default("changelog_page"),
    }))
    .mutation(async ({ ctx, input }) => {
      await markChangelogInformed(ctx.user.id, input.changelogId, input.via);
      return { success: true };
    }),

  // ── Mark all changelog as read (authenticated only) ────────────
  markAllChangelogRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { entries } = await getChangelogFeed(ctx.user.id, 50);
    const unread = entries.filter(e => !e.isRead);
    for (const entry of unread) {
      await markChangelogInformed(ctx.user.id, entry.id, "changelog_page");
    }
    return { success: true, marked: unread.length };
  }),

  // ── Get feature catalog (public) ───────────────────────────────
  getFeatureCatalog: publicProcedure.query(() => {
    return FEATURE_CATALOG.map(f => ({
      key: f.key,
      label: f.label,
      category: f.category,
      layer: f.layer,
      description: f.description,
      roles: f.roles,
    }));
  }),

  // ── Get layer hierarchy (public) ───────────────────────────────
  getLayerHierarchy: publicProcedure.query(() => {
    return LAYER_HIERARCHY;
  }),

  // ── Admin: Add changelog entry ─────────────────────────────────
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
