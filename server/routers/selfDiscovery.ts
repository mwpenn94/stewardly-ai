/**
 * Self-Discovery Loop — tRPC Router
 *
 * Endpoints for triggering, configuring, and tracking the continuous
 * self-discovery loop. All endpoints require authentication since
 * discovery history is persisted per-user.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  triggerSelfDiscovery,
  getDiscoverySettings,
  updateDiscoverySettings,
  getDiscoveryHistory,
  updateDiscoveryStatus,
  recordDiscoveryEngagement,
} from "../services/selfDiscovery";

export const selfDiscoveryRouter = router({
  // ── Trigger self-discovery query generation ────────────────────────
  trigger: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      lastUserQuery: z.string().min(1).max(5000),
      lastAiResponse: z.string().min(1).max(10000),
      triggerMessageId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await triggerSelfDiscovery({
        userId: ctx.user.id,
        userRole: ctx.user.role || "user",
        conversationId: input.conversationId,
        lastUserQuery: input.lastUserQuery,
        lastAiResponse: input.lastAiResponse,
        triggerMessageId: input.triggerMessageId,
      });

      if (!result) {
        return { triggered: false as const, reason: "disabled_or_limit_reached" };
      }

      // Mark as sent
      await updateDiscoveryStatus(result.id, "sent");

      return {
        triggered: true as const,
        id: result.id,
        query: result.discovery.query,
        direction: result.discovery.direction,
        reasoning: result.discovery.reasoning,
        relatedFeatures: result.discovery.relatedFeatures,
      };
    }),

  // ── Get/update discovery settings ──────────────────────────────────
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      return getDiscoverySettings(ctx.user.id);
    }),

  updateSettings: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      maxOccurrences: z.number().min(1).max(10).optional(),
      idleThresholdMs: z.number().min(30000).max(600000).optional(),
      direction: z.enum(["deeper", "broader", "applied", "auto"]).optional(),
      continuous: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return updateDiscoverySettings(ctx.user.id, input);
    }),

  // ── Discovery history ──────────────────────────────────────────────
  getHistory: protectedProcedure
    .input(z.object({
      conversationId: z.number().optional(),
      limit: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getDiscoveryHistory(
        ctx.user.id,
        input?.conversationId,
        input?.limit ?? 20,
      );
    }),

  // ── Record engagement (user clicked/responded to discovery) ────────
  engage: protectedProcedure
    .input(z.object({
      discoveryId: z.number(),
      engaged: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordDiscoveryEngagement(ctx.user.id, input.discoveryId, input.engaged);
      return { success: true };
    }),

  // ── Dismiss a discovery suggestion ─────────────────────────────────
  dismiss: protectedProcedure
    .input(z.object({
      discoveryId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordDiscoveryEngagement(ctx.user.id, input.discoveryId, false);
      return { success: true };
    }),
});
