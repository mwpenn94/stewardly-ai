import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: "coaching" | "propagation" | "alert" | "model_complete" | "enrichment" | "system";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  readAt?: number | null;
}

interface UseWebSocketOptions {
  userId?: string | number | null;
  role?: string;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  connected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

// ─── Priority-based toast styling ───────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { icon: string; duration: number }> = {
  critical: { icon: "!", duration: 10000 },
  high: { icon: "!", duration: 7000 },
  medium: { icon: "i", duration: 5000 },
  low: { icon: "i", duration: 3000 },
};

const TYPE_LABELS: Record<string, string> = {
  coaching: "Coaching",
  propagation: "Intelligence",
  alert: "Alert",
  model_complete: "Model",
  enrichment: "Enrichment",
  system: "System",
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { userId, role = "user", enabled = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Connect to WebSocket server
  useEffect(() => {
    if (!enabled || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${window.location.protocol}//${window.location.host}`;

    const socket = io(wsUrl, {
      path: "/ws",
      transports: ["websocket", "polling"],
      query: {
        userId: String(userId),
        role,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Request pending notifications on connect
      socket.emit("notifications:getAll");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Handle new notification
    socket.on("notification:new", (notification: Notification) => {
      setNotifications((prev) => {
        // Deduplicate
        if (prev.some((n) => n.id === notification.id)) return prev;
        const updated = [notification, ...prev];
        // Keep max 100 notifications
        return updated.slice(0, 100);
      });

      // Show toast for high/critical priority
      const config = PRIORITY_CONFIG[notification.priority] || PRIORITY_CONFIG.medium;
      const typeLabel = TYPE_LABELS[notification.type] || notification.type;

      if (notification.priority === "critical" || notification.priority === "high") {
        toast(notification.title, {
          description: notification.body.length > 120 ? notification.body.slice(0, 120) + "..." : notification.body,
          duration: config.duration,
          icon: config.icon,
        });
      } else if (notification.priority === "medium") {
        toast(notification.title, {
          description: notification.body.length > 80 ? notification.body.slice(0, 80) + "..." : notification.body,
          duration: config.duration,
        });
      }
    });

    // Handle pending notifications on connect
    socket.on("notifications:pending", (data: { count: number; notifications: Notification[] }) => {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newOnes = data.notifications.filter((n) => !existingIds.has(n.id));
        return [...newOnes, ...prev].slice(0, 100);
      });
    });

    // Handle full notification list
    socket.on("notifications:list", (data: { notifications: Notification[] }) => {
      setNotifications(data.notifications.slice(0, 100));
    });

    // Handle read acknowledgments
    socket.on("notification:read:ack", (data: { notificationId: string }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === data.notificationId ? { ...n, readAt: Date.now() } : n))
      );
    });

    socket.on("notifications:readAll:ack", () => {
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: Date.now() }))
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId, role, enabled]);

  const markAsRead = useCallback((notificationId: string) => {
    socketRef.current?.emit("notification:read", { notificationId });
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, readAt: Date.now() } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    socketRef.current?.emit("notifications:readAll");
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: Date.now() }))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return {
    connected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}
