import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getDb } from "../db";
import { coachingMessages, propagationEvents, propagationActions } from "../../drizzle/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  type: "coaching" | "propagation" | "alert" | "model_complete" | "enrichment" | "system";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  readAt?: number | null;
}

interface UserSocket {
  userId: number | string;
  role: string;
  socketId: string;
}

// ─── In-Memory Notification Store (per-session) ────────────────────────────

const userNotifications = new Map<string, NotificationPayload[]>();
const MAX_NOTIFICATIONS_PER_USER = 100;

// ─── Singleton ─────────────────────────────────────────────────────────────

let io: Server | null = null;
const connectedUsers = new Map<string, UserSocket>();

// ─── Initialize WebSocket Server ───────────────────────────────────────────

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/ws",
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    const role = (socket.handshake.query.role as string) || "user";

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Register the connected user
    connectedUsers.set(socket.id, { userId: userId, role, socketId: socket.id });
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    // Send any pending notifications on connect
    const pending = userNotifications.get(String(userId)) || [];
    const unread = pending.filter((n) => !n.readAt);
    if (unread.length > 0) {
      socket.emit("notifications:pending", { count: unread.length, notifications: unread.slice(0, 10) });
    }

    // Handle mark-as-read
    socket.on("notification:read", (data: { notificationId: string }) => {
      const notifications = userNotifications.get(String(userId));
      if (notifications) {
        const notif = notifications.find((n) => n.id === data.notificationId);
        if (notif) {
          notif.readAt = Date.now();
        }
      }
      socket.emit("notification:read:ack", { notificationId: data.notificationId });
    });

    // Handle mark-all-read
    socket.on("notifications:readAll", () => {
      const notifications = userNotifications.get(String(userId));
      if (notifications) {
        const now = Date.now();
        notifications.forEach((n) => {
          if (!n.readAt) n.readAt = now;
        });
      }
      socket.emit("notifications:readAll:ack", {});
    });

    // Handle get-all request
    socket.on("notifications:getAll", () => {
      const notifications = userNotifications.get(String(userId)) || [];
      socket.emit("notifications:list", { notifications });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      connectedUsers.delete(socket.id);
    });
  });

  return io;
}

// ─── Send Notification to User ─────────────────────────────────────────────

export function sendNotification(userId: string | number, notification: Omit<NotificationPayload, "id" | "createdAt">) {
  const payload: NotificationPayload = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    readAt: null,
  };

  // Store in memory
  const key = String(userId);
  const existing = userNotifications.get(key) || [];
  existing.unshift(payload);
  if (existing.length > MAX_NOTIFICATIONS_PER_USER) {
    existing.splice(MAX_NOTIFICATIONS_PER_USER);
  }
  userNotifications.set(key, existing);

  // Emit via WebSocket if connected
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", payload);
  }

  return payload;
}

// ─── Broadcast to Role ─────────────────────────────────────────────────────

export function broadcastToRole(role: string, notification: Omit<NotificationPayload, "id" | "createdAt">) {
  const payload: NotificationPayload = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    readAt: null,
  };

  // Store for all connected users of that role
  for (const [, user] of Array.from(connectedUsers.entries())) {
    if (user.role === role) {
      const key = String(user.userId);
      const existing = userNotifications.get(key) || [];
      existing.unshift(payload);
      if (existing.length > MAX_NOTIFICATIONS_PER_USER) {
        existing.splice(MAX_NOTIFICATIONS_PER_USER);
      }
      userNotifications.set(key, existing);
    }
  }

  if (io) {
    io.to(`role:${role}`).emit("notification:new", payload);
  }

  return payload;
}

// ─── Broadcast to All ──────────────────────────────────────────────────────

export function broadcastToAll(notification: Omit<NotificationPayload, "id" | "createdAt">) {
  const payload: NotificationPayload = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    readAt: null,
  };

  // Store for all connected users
  for (const [, user] of Array.from(connectedUsers.entries())) {
    const key = String(user.userId);
    const existing = userNotifications.get(key) || [];
    existing.unshift(payload);
    if (existing.length > MAX_NOTIFICATIONS_PER_USER) {
      existing.splice(MAX_NOTIFICATIONS_PER_USER);
    }
    userNotifications.set(key, existing);
  }

  if (io) {
    io.emit("notification:new", payload);
  }

  return payload;
}

// ─── Get User Notifications ────────────────────────────────────────────────

export function getUserNotifications(userId: string | number): NotificationPayload[] {
  return userNotifications.get(String(userId)) || [];
}

export function getUnreadCount(userId: string | number): number {
  const notifications = userNotifications.get(String(userId)) || [];
  return notifications.filter((n) => !n.readAt).length;
}

// ─── Connection Stats ──────────────────────────────────────────────────────

export function getConnectionStats() {
  return {
    totalConnections: connectedUsers.size,
    usersByRole: Array.from(connectedUsers.values()).reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}

export function getIO(): Server | null {
  return io;
}
