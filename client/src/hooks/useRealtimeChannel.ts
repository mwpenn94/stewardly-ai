/**
 * useRealtimeChannel — subscribe to a specific WebSocket event channel.
 *
 * Builds on the existing socket.io infrastructure (useWebSocket.ts /
 * websocketNotifications.ts) but provides a generic, typed interface
 * for any real-time data stream — not just notifications.
 *
 * Usage:
 *   const { data, connected, lastUpdate } = useRealtimeChannel<CacheStats>({
 *     channel: "dataEngine:cacheStats",
 *     userId,
 *     enabled: true,
 *   });
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RealtimeChannelOptions<T> {
  /** The socket.io event name to subscribe to */
  channel: string;
  /** User ID for authentication */
  userId?: string | number | null;
  /** User role */
  role?: string;
  /** Whether the subscription is active */
  enabled?: boolean;
  /** Optional transform before storing */
  transform?: (raw: unknown) => T;
  /** How many historical items to keep (default: 50) */
  bufferSize?: number;
  /** Optional callback on each new event */
  onEvent?: (data: T) => void;
}

export interface RealtimeChannelReturn<T> {
  /** Whether the socket is connected */
  connected: boolean;
  /** Latest data received on the channel */
  data: T | null;
  /** Buffer of recent items (newest first) */
  history: T[];
  /** Timestamp of the last received event */
  lastUpdate: number | null;
  /** Number of events received since mount */
  eventCount: number;
  /** Manually request a refresh from the server */
  requestRefresh: () => void;
}

// ─── Shared socket singleton ────────────────────────────────────────────────
// Re-use a single socket connection across all channel subscriptions.

let sharedSocket: Socket | null = null;
let sharedSocketRefCount = 0;

function getOrCreateSocket(userId: string | number, role: string): Socket {
  if (sharedSocket && sharedSocket.connected) {
    sharedSocketRefCount++;
    return sharedSocket;
  }

  const wsUrl = `${window.location.protocol}//${window.location.host}`;
  sharedSocket = io(wsUrl, {
    path: "/ws",
    transports: ["websocket", "polling"],
    query: { userId: String(userId), role },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });
  sharedSocketRefCount = 1;
  return sharedSocket;
}

function releaseSocket() {
  sharedSocketRefCount--;
  if (sharedSocketRefCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    sharedSocketRefCount = 0;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useRealtimeChannel<T = unknown>(
  options: RealtimeChannelOptions<T>,
): RealtimeChannelReturn<T> {
  const {
    channel,
    userId,
    role = "user",
    enabled = true,
    transform,
    bufferSize = 50,
    onEvent,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [history, setHistory] = useState<T[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState(0);

  // Stable refs for callbacks
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !userId || !channel) return;

    const socket = getOrCreateSocket(userId, role);
    socketRef.current = socket;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    const handleEvent = (raw: unknown) => {
      const parsed = transformRef.current ? transformRef.current(raw) : (raw as T);
      setData(parsed);
      setLastUpdate(Date.now());
      setEventCount((c) => c + 1);
      setHistory((prev) => [parsed, ...prev].slice(0, bufferSize));
      onEventRef.current?.(parsed);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(channel, handleEvent);

    // Subscribe to the channel (server can use this to start pushing)
    socket.emit("channel:subscribe", { channel });

    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off(channel, handleEvent);
      socket.emit("channel:unsubscribe", { channel });
      socketRef.current = null;
      releaseSocket();
    };
  }, [channel, userId, role, enabled, bufferSize]);

  const requestRefresh = useCallback(() => {
    socketRef.current?.emit("channel:refresh", { channel });
  }, [channel]);

  return { connected, data, history, lastUpdate, eventCount, requestRefresh };
}
