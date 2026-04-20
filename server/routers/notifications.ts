import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getUserNotifications,
  getUnreadCount,
  getConnectionStats,
  sendNotification,
  broadcastToAll,
  getUserPreferences,
  setUserPreferences,
  type NotificationPreferences,
} from "../services/websocketNotifications";
import {
  dispatchWorkflowEvent,
  getWorkflowRules,
  getWorkflowStats,
  checkMeetingReminders,
  checkOverdueActionItems,
  checkComplianceAlerts,
} from "../services/notificationWorkflows";

export const notificationsRouter = router({
  // Get all notifications for the current user (REST fallback)
  list: protectedProcedure.query(({ ctx }) => {
    const notifications = getUserNotifications(ctx.user.id);
    return {
      notifications,
      total: notifications.length,
      unread: notifications.filter((n) => !n.readAt).length,
    };
  }),

  // Get unread count
  unreadCount: protectedProcedure.query(({ ctx }) => {
    return { count: getUnreadCount(ctx.user.id) };
  }),

  // Send a test notification (for development/admin)
  sendTest: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(1000),
      type: z.enum(["coaching", "propagation", "alert", "model_complete", "enrichment", "system"]).default("system"),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }))
    .mutation(({ ctx, input }) => {
      const payload = sendNotification(ctx.user.id, {
        type: input.type,
        priority: input.priority,
        title: input.title,
        body: input.body,
        metadata: { source: "test", triggeredBy: ctx.user.id },
      });
      return { success: true, notification: payload };
    }),

  // Broadcast to all connected users (admin only)
  broadcast: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(1000),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }))
    .mutation(({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can broadcast notifications");
      }
      const payload = broadcastToAll({
        type: "system",
        priority: input.priority,
        title: input.title,
        body: input.body,
        metadata: { broadcastBy: ctx.user.id },
      });
      return { success: true, notification: payload };
    }),

  // Get WebSocket connection stats (admin only)
  connectionStats: protectedProcedure.query(({ ctx }) => {
    if (ctx.user.role !== "admin") {
      return { totalConnections: 0, usersByRole: {} };
    }
    return getConnectionStats();
  }),

  // Get notification preferences
  getPreferences: protectedProcedure.query(({ ctx }) => {
    const prefs = getUserPreferences(ctx.user.id);
    return prefs || {
      enabledTypes: {
        coaching: true, propagation: true, alert: true,
        model_complete: true, enrichment: true, system: true,
      },
      deliveryMethods: { toast: true, sound: false, badge: true },
    };
  }),

  // ─── Workflow Automation ──────────────────────────────────────────────
  workflowRules: protectedProcedure.query(() => getWorkflowRules()),
  workflowStats: protectedProcedure.query(() => getWorkflowStats()),
  triggerWorkflow: protectedProcedure
    .input(z.object({
      eventType: z.string(),
      userId: z.number().default(0),
      data: z.record(z.string(), z.unknown()).default({}),
    }))
    .mutation(({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Only admins can trigger workflow events");
      const result = dispatchWorkflowEvent({
        type: input.eventType, userId: input.userId,
        data: input.data, timestamp: Date.now(),
      });
      return { success: true, ...result };
    }),
  runScheduledChecks: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new Error("Only admins can run scheduled checks");
    const [meetings, actions, compliance] = await Promise.all([
      checkMeetingReminders(), checkOverdueActionItems(), checkComplianceAlerts(),
    ]);
    return { success: true, meetingReminders: meetings, overdueActions: actions, complianceAlerts: compliance };
  }),
  // Save notification preferences
  savePreferences: protectedProcedure
    .input(z.object({
      enabledTypes: z.record(z.string(), z.boolean()),
      deliveryMethods: z.object({
        toast: z.boolean(),
        sound: z.boolean(),
        badge: z.boolean(),
      }),
      quietHoursStart: z.string().optional(),
      quietHoursEnd: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const prefs: NotificationPreferences = {
        enabledTypes: input.enabledTypes,
        deliveryMethods: input.deliveryMethods,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
      };
      setUserPreferences(ctx.user.id, prefs);
      return { success: true };
    }),
});
