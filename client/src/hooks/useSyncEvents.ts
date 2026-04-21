/**
 * useSyncEvents — React hook for real-time sync event streaming via SSE
 *
 * Connects to /api/sync/events and provides typed events to the UI.
 * Auto-reconnects on disconnect with exponential backoff.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SyncEvent {
  type:
    | "webhook_received"
    | "contact_synced"
    | "reconcile_progress"
    | "reconcile_complete"
    | "location_provisioned"
    | "sync_error"
    | "heartbeat";
  locationId?: number;
  ghlLocationId?: string;
  locationName?: string;
  timestamp: number;
  data: Record<string, any>;
}

interface UseSyncEventsOptions {
  /** Max events to keep in buffer (default: 100) */
  maxEvents?: number;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Filter events by type */
  eventTypes?: SyncEvent["type"][];
}

interface UseSyncEventsReturn {
  /** Array of received events (newest first) */
  events: SyncEvent[];
  /** Whether SSE is currently connected */
  connected: boolean;
  /** Connection error if any */
  error: string | null;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Clear event buffer */
  clearEvents: () => void;
  /** Latest event of a specific type */
  latestByType: (type: SyncEvent["type"]) => SyncEvent | undefined;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSyncEvents(options: UseSyncEventsOptions = {}): UseSyncEventsReturn {
  const {
    maxEvents = 100,
    autoConnect = true,
    eventTypes,
  } = options;

  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectDelay = 30_000;

  const addEvent = useCallback(
    (event: SyncEvent) => {
      // Filter by type if specified
      if (eventTypes && !eventTypes.includes(event.type)) return;
      // Skip heartbeats from the event buffer
      if (event.type === "heartbeat") return;

      setEvents((prev) => {
        const next = [event, ...prev];
        return next.length > maxEvents ? next.slice(0, maxEvents) : next;
      });
    },
    [maxEvents, eventTypes],
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource("/api/sync/events", { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        setConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0;
      });

      // Listen for all sync event types
      const syncEventTypes = [
        "webhook_received",
        "contact_synced",
        "reconcile_progress",
        "reconcile_complete",
        "location_provisioned",
        "sync_error",
        "heartbeat",
      ];

      for (const type of syncEventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as SyncEvent;
            addEvent(data);
          } catch {
            // Ignore parse errors
          }
        });
      }

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(1000 * Math.pow(2, attempt), maxReconnectDelay);
        setError(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnected(false);
    }
  }, [addEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const latestByType = useCallback(
    (type: SyncEvent["type"]) => events.find((e) => e.type === type),
    [events],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    events,
    connected,
    error,
    connect,
    disconnect,
    clearEvents,
    latestByType,
  };
}
