import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getUserNotifications,
  getUnreadCount,
  getConnectionStats,
  sendNotification,
  broadcastToAll,
} from "../services/websocketNotifications";

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
});
