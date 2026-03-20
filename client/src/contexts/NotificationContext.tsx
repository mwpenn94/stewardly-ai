import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket, type Notification } from "@/hooks/useWebSocket";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Context Type ───────────────────────────────────────────────────────────

interface NotificationContextType {
  connected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  connected: false,
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const ws = useWebSocket({
    userId: user?.id ?? null,
    role: user?.role ?? "user",
    enabled: Boolean(user?.id),
  });

  return (
    <NotificationContext.Provider value={ws}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useContext(NotificationContext);
}
