/**
 * useAutomationTelemetryStream — pass 7, scope: browser/device automation.
 *
 * React hook that consumes Server-Sent Events from
 * `GET /api/automation/telemetry/stream` (see server/routes/
 * automationTelemetryStream.ts) and exposes a live list of browser
 * navigation events.
 *
 * Usage:
 *
 *   const { events, connected, error, clear } = useAutomationTelemetryStream({
 *     enabled: true,
 *     types: ["request.network", "request.blocked"],
 *     replay: 10,
 *     maxEvents: 200,
 *   });
 *
 * Design choices:
 *   - Pure client state — no tRPC, no query cache. The endpoint is
 *     admin-only on the server so we don't need to manage auth here
 *     (the browser's session cookie travels with EventSource).
 *   - Ring buffer of `maxEvents` (default 200) so long-running
 *     sessions don't blow memory.
 *   - Filters out the `__hello` envelope (we surface it separately
 *     as the first-connect signal).
 *   - Auto-reconnects on `error` with exponential backoff (1s →
 *     2s → 4s → 8s, capped at 30s), and tags each reconnect so the
 *     caller can show "reconnecting…" state.
 *   - Cleans up both the EventSource and any pending reconnect
 *     timeout on unmount.
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type AutomationTelemetryEvent =
  | {
      type: "request.start";
      url: string;
      host: string;
      at: number;
      cacheState?: "miss" | "hit-fresh" | "hit-stale";
      revalidating?: boolean;
    }
  | {
      type: "request.blocked";
      url: string;
      host: string;
      reason: "BAD_URL" | "BLOCKED_HOST" | "RATE_LIMITED" | "BLOCKED_BY_ROBOTS";
      at: number;
      detail?: string;
    }
  | {
      type: "request.cached";
      url: string;
      host: string;
      cacheState: "hit-fresh" | "hit-stale";
      bytes: number;
      at: number;
    }
  | {
      type: "request.network";
      url: string;
      host: string;
      status: number;
      bytes: number;
      fetchMs: number;
      at: number;
      revalidated: boolean;
    }
  | {
      type: "request.error";
      url: string;
      host: string;
      code: string;
      message: string;
      at: number;
    };

export interface UseAutomationTelemetryStreamOptions {
  /** Start the EventSource. Default false so nothing happens until the UI turns it on. */
  enabled?: boolean;
  /** Filter event types (URL ?types= param). */
  types?: string[];
  /** Ring-buffer replay count (URL ?replay= param). */
  replay?: number;
  /** Max in-memory events (default 200). */
  maxEvents?: number;
  /** Override the endpoint (for tests). */
  url?: string;
}

export interface UseAutomationTelemetryStreamResult {
  events: AutomationTelemetryEvent[];
  connected: boolean;
  error: string | null;
  /** Reconnect attempt counter; 0 on fresh open. */
  reconnectAttempt: number;
  clear: () => void;
}

const DEFAULT_MAX_EVENTS = 200;

// Exported for tests
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function buildUrl(base: string, opts: UseAutomationTelemetryStreamOptions): string {
  const u = new URL(base, window.location.origin);
  if (opts.types && opts.types.length > 0) {
    u.searchParams.set("types", opts.types.join(","));
  }
  if (opts.replay && opts.replay > 0) {
    u.searchParams.set("replay", String(opts.replay));
  }
  return u.toString();
}

export function useAutomationTelemetryStream(
  opts: UseAutomationTelemetryStreamOptions = {},
): UseAutomationTelemetryStreamResult {
  const [events, setEvents] = useState<AutomationTelemetryEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const maxEvents = opts.maxEvents ?? DEFAULT_MAX_EVENTS;

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!opts.enabled) {
      return () => {};
    }

    let disposed = false;

    const open = () => {
      if (disposed) return;
      const url = buildUrl(opts.url ?? "/api/automation/telemetry/stream", opts);
      let source: EventSource;
      try {
        source = new EventSource(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open EventSource");
        return;
      }
      sourceRef.current = source;

      source.onopen = () => {
        setConnected(true);
        setError(null);
        attemptRef.current = 0;
        setReconnectAttempt(0);
      };

      source.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as AutomationTelemetryEvent | { type: "__hello" };
          if ((parsed as { type: string }).type === "__hello") return;
          setEvents((prev) => {
            const next = prev.concat(parsed as AutomationTelemetryEvent);
            if (next.length > maxEvents) return next.slice(-maxEvents);
            return next;
          });
        } catch {
          /* ignore malformed frames */
        }
      };

      source.onerror = () => {
        if (disposed) return;
        setConnected(false);
        source.close();
        sourceRef.current = null;
        const idx = Math.min(attemptRef.current, BACKOFF_MS.length - 1);
        const delay = BACKOFF_MS[idx];
        attemptRef.current++;
        setReconnectAttempt(attemptRef.current);
        setError(`disconnected — retrying in ${Math.round(delay / 1000)}s`);
        reconnectTimerRef.current = setTimeout(() => {
          if (!disposed) open();
        }, delay);
      };
    };

    open();

    return () => {
      disposed = true;
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(false);
    };
    // We intentionally stringify opts so the effect reruns when options
    // actually change (not on every render), and so the linter stays
    // happy without a custom deep-equal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.enabled,
    opts.url,
    (opts.types ?? []).join(","),
    opts.replay ?? 0,
    maxEvents,
  ]);

  return { events, connected, error, reconnectAttempt, clear };
}

// ─── Pure helpers the component reuses ───────────────────────────────

export function summarizeEvent(ev: AutomationTelemetryEvent): string {
  switch (ev.type) {
    case "request.start":
      return `→ ${ev.host}${new URL(ev.url).pathname}${ev.cacheState === "hit-stale" ? " (revalidating)" : ""}`;
    case "request.cached":
      return `⚡ ${ev.host} ${formatBytes(ev.bytes)} (cache ${ev.cacheState})`;
    case "request.network":
      return `${ev.status} ${ev.host} ${formatBytes(ev.bytes)} in ${ev.fetchMs}ms${ev.revalidated ? " (304 revalidated)" : ""}`;
    case "request.blocked":
      return `🚫 ${ev.host} blocked: ${ev.reason}${ev.detail ? ` — ${ev.detail}` : ""}`;
    case "request.error":
      return `× ${ev.host} error [${ev.code}]: ${ev.message}`;
  }
}

export function eventBadgeColor(ev: AutomationTelemetryEvent): string {
  switch (ev.type) {
    case "request.cached":
      return "emerald";
    case "request.network":
      return ev.status >= 400 ? "red" : "blue";
    case "request.blocked":
      return "amber";
    case "request.error":
      return "red";
    case "request.start":
      return "muted";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
