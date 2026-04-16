/**
 * useTaskProgress — WebSocket-based real-time task progress hook.
 *
 * Pass 60. Connects to the server's WebSocket and listens for
 * task:progress events, providing real-time updates to the UI
 * without polling.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";

export interface TaskProgressEvent {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  progressMessage: string;
  error?: string;
  result?: unknown;
}

interface UseTaskProgressOptions {
  /** Only listen for specific task types */
  taskTypes?: string[];
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

export function useTaskProgress(options: UseTaskProgressOptions = {}) {
  const { taskTypes, autoConnect = true } = options;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Map<string, TaskProgressEvent>>(new Map());
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!user?.id || socketRef.current?.connected) return;

    const socket = io(window.location.origin, {
      path: "/ws",
      transports: ["websocket", "polling"],
      query: { userId: String(user.id), role: user.role ?? "user" },
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("task:progress", (event: TaskProgressEvent) => {
      // Filter by task type if specified
      if (taskTypes && taskTypes.length > 0 && !taskTypes.includes(event.type)) return;

      setTasks((prev) => {
        const next = new Map(prev);
        next.set(event.id, event);

        // Clean up completed/failed tasks after 30s
        if (["completed", "failed", "cancelled"].includes(event.status)) {
          setTimeout(() => {
            setTasks((p) => {
              const n = new Map(p);
              n.delete(event.id);
              return n;
            });
          }, 30000);
        }

        return next;
      });
    });

    socketRef.current = socket;
  }, [user?.id, user?.role, taskTypes]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  // Derived state
  const activeTasks = Array.from(tasks.values()).filter(
    (t) => t.status === "pending" || t.status === "running"
  );
  const completedTasks = Array.from(tasks.values()).filter(
    (t) => t.status === "completed"
  );
  const failedTasks = Array.from(tasks.values()).filter(
    (t) => t.status === "failed"
  );

  return {
    tasks: Array.from(tasks.values()),
    activeTasks,
    completedTasks,
    failedTasks,
    connected,
    connect,
    disconnect,
    getTask: (id: string) => tasks.get(id),
  };
}
