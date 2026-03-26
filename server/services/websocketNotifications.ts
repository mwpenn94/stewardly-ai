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
  preferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  enabledTypes: Record<string, boolean>;
  deliveryMethods: {
    toast: boolean;
    sound: boolean;
    badge: boolean;
  };
  quietHoursStart?: string; // HH:MM
  quietHoursEnd?: string;   // HH:MM
}

// ─── In-Memory Notification Store (per-session) ────────────────────────────

const userNotifications = new Map<string, NotificationPayload[]>();
const userPreferences = new Map<string, NotificationPreferences>();
const MAX_NOTIFICATIONS_PER_USER = 100;

// ─── Singleton ─────────────────────────────────────────────────────────────

let io: Server | null = null;
const connectedUsers = new Map<string, UserSocket>();

// ─── Initialize WebSocket Server ───────────────────────────────────────────

export function initWebSocket(httpServer: HttpServer): Server {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : undefined;

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins || (process.env.NODE_ENV === "development" ? true : false),
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

    // Handle preference sync from client
    socket.on("preferences:sync", (prefs: NotificationPreferences) => {
      const userEntry = connectedUsers.get(socket.id);
      if (userEntry) {
        userEntry.preferences = prefs;
        connectedUsers.set(socket.id, userEntry);
      }
      // Store in per-user preferences map
      userPreferences.set(String(userId), prefs);
      socket.emit("preferences:synced", { success: true });
    });

    // Handle preference request
    socket.on("preferences:get", () => {
      const prefs = userPreferences.get(String(userId));
      socket.emit("preferences:current", prefs || null);
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

  const key = String(userId);

  // Check user preferences — skip if type is disabled
  const prefs = userPreferences.get(key);
  const shouldDeliver = shouldDeliverNotification(payload, prefs);

  // Always store in memory (for history), but mark delivery flags
  const existing = userNotifications.get(key) || [];
  existing.unshift(payload);
  if (existing.length > MAX_NOTIFICATIONS_PER_USER) {
    existing.splice(MAX_NOTIFICATIONS_PER_USER);
  }
  userNotifications.set(key, existing);

  // Only emit via WebSocket if preferences allow delivery
  if (io && shouldDeliver) {
    io.to(`user:${userId}`).emit("notification:new", {
      ...payload,
      _delivery: prefs?.deliveryMethods || { toast: true, sound: false, badge: true },
    });
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


// ─── Preference-Based Filtering ───────────────────────────────────────────

function shouldDeliverNotification(
  notification: NotificationPayload,
  prefs: NotificationPreferences | undefined
): boolean {
  // No preferences set = deliver everything
  if (!prefs) return true;

  // Check if the notification type is enabled
  const typeEnabled = prefs.enabledTypes[notification.type];
  if (typeEnabled === false) return false; // Explicitly disabled

  // Check quiet hours
  if (prefs.quietHoursStart && prefs.quietHoursEnd) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same-day range (e.g., 22:00 to 23:00)
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        // Allow critical notifications even during quiet hours
        return notification.priority === "critical";
      }
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return notification.priority === "critical";
      }
    }
  }

  // Check if any delivery method is enabled
  const { toast, sound, badge } = prefs.deliveryMethods;
  if (!toast && !sound && !badge) return false;

  return true;
}

// ─── Get/Set User Preferences ─────────────────────────────────────────────

export function getUserPreferences(userId: string | number): NotificationPreferences | null {
  return userPreferences.get(String(userId)) || null;
}

export function setUserPreferences(userId: string | number, prefs: NotificationPreferences): void {
  userPreferences.set(String(userId), prefs);
}
