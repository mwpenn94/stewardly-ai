import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  createPropagationEvent,
  getEventsForEntity,
  recordAction,
  cascadeInsight,
  deliverPendingEvents,
  createCoachingMessage,
  getCoachingMessages,
  markCoachingMessageRead,
  expireOldEvents,
} from "../services/propagationEngine";

const layerEnum = z.enum(["platform", "organization", "manager", "professional", "user"]);
const eventTypeEnum = z.enum(["insight", "alert", "recommendation", "compliance", "milestone", "risk_change", "opportunity"]);
const priorityEnum = z.enum(["critical", "high", "medium", "low"]);

export const propagationRouter = router({
  // Get events for the current user
  getMyEvents: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return getEventsForEntity("user", ctx.user.id, input?.limit ?? 50);
    }),

  // Create a propagation event (admin/professional)
  createEvent: protectedProcedure
    .input(z.object({
      sourceLayer: layerEnum,
      targetLayer: layerEnum,
      eventType: eventTypeEnum,
      sourceEntityId: z.number().optional(),
      targetEntityId: z.number().optional(),
      payload: z.record(z.string(), z.any()),
      priority: priorityEnum.optional().default("medium"),
      expiresInHours: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createPropagationEvent(input);
      return { id };
    }),

  // Record an action on an event
  recordAction: protectedProcedure
    .input(z.object({
      eventId: z.string(),
      actionType: z.enum(["acknowledge", "act", "dismiss", "escalate", "snooze", "delegate"]),
      notes: z.string().optional(),
      resultData: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordAction(input.eventId, ctx.user.id, input.actionType, input.notes, input.resultData);
      return { success: true };
    }),

  // Cascade an insight across layers
  cascadeInsight: protectedProcedure
    .input(z.object({
      originLayer: layerEnum,
      originEntityId: z.number(),
      insight: z.string(),
      insightType: z.enum(["pattern", "risk", "opportunity", "compliance"]),
      confidence: z.number().min(0).max(1),
      direction: z.enum(["up", "down", "both"]),
    }))
    .mutation(async ({ input }) => {
      const eventIds = await cascadeInsight(input);
      return { eventIds, count: eventIds.length };
    }),

  // Deliver pending events (admin cron)
  deliverPending: adminProcedure.mutation(async () => {
    return deliverPendingEvents();
  }),

  // Expire old events (admin cron)
  expireOld: adminProcedure.mutation(async () => {
    return expireOldEvents();
  }),

  // ─── Coaching Messages ──────────────────────────────────────────

  getCoachingMessages: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return getCoachingMessages(ctx.user.id, input?.limit ?? 20);
    }),

  createCoachingMessage: protectedProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number().optional(),
      messageType: z.enum(["nudge", "celebration", "reminder", "education", "insight", "alert"]),
      category: z.string().optional(),
      title: z.string(),
      content: z.string(),
      priority: priorityEnum.optional().default("medium"),
      triggerEvent: z.string().optional(),
      expiresInDays: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createCoachingMessage(input);
      return { id };
    }),

  markCoachingRead: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ input }) => {
      await markCoachingMessageRead(input.messageId);
      return { success: true };
    }),
});
