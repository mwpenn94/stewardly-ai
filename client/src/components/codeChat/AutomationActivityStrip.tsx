/**
 * AutomationActivityStrip — pass 7, scope: browser/device automation.
 *
 * A compact, live "browser activity" panel that subscribes to the
 * server-side AutomationTelemetryBus via the pass-6 SSE route and
 * renders each navigation event as a timestamped row. Drops into the
 * Code Chat page's config bar when the user wants to watch the agent's
 * web reads happen in real time.
 *
 * Props:
 *   - open:      controls visibility of the panel body (the button
 *                stays visible even when closed so the user can toggle)
 *   - onClose:   collapse handler
 *   - types?:    optional event-type filter forwarded to the stream
 *   - maxEvents?:ring buffer size (default 100)
 *   - replay?:   optional ring-buffer replay from the server on connect
 *
 * Admin only: the underlying route is role-gated on the server, so
 * non-admin clients just see `error: "admin only"` from the hook — the
 * component renders a "admin required" notice in that case. No
 * additional client-side gating is needed.
 */

import { X, Globe, Zap, ShieldAlert, AlertTriangle, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import {
  useAutomationTelemetryStream,
  summarizeEvent,
  eventBadgeColor,
  type AutomationTelemetryEvent,
} from "@/hooks/useAutomationTelemetryStream";

const COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  muted: "bg-muted/40 text-muted-foreground border-border/40",
};

function iconForEvent(ev: AutomationTelemetryEvent) {
  switch (ev.type) {
    case "request.start":
      return <ArrowRight className="w-3 h-3" aria-hidden />;
    case "request.cached":
      return <Zap className="w-3 h-3" aria-hidden />;
    case "request.network":
      return <Globe className="w-3 h-3" aria-hidden />;
    case "request.blocked":
      return <ShieldAlert className="w-3 h-3" aria-hidden />;
    case "request.error":
      return <AlertTriangle className="w-3 h-3" aria-hidden />;
  }
}

function relTime(at: number, now: number): string {
  const delta = now - at;
  if (delta < 1000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  return `${Math.floor(delta / 3_600_000)}h`;
}

export default function AutomationActivityStrip({
  open,
  onClose,
  types,
  maxEvents = 100,
  replay = 20,
}: {
  open: boolean;
  onClose: () => void;
  types?: string[];
  maxEvents?: number;
  replay?: number;
}) {
  const { events, connected, error, reconnectAttempt, clear } =
    useAutomationTelemetryStream({
      enabled: open,
      types,
      replay,
      maxEvents,
    });

  // Reverse for display — newest at the top.
  const sorted = useMemo(() => events.slice().reverse(), [events]);
  const now = Date.now();

  const counts = useMemo(() => {
    const c = {
      start: 0,
      cached: 0,
      network: 0,
      blocked: 0,
      error: 0,
    };
    for (const ev of events) {
      if (ev.type === "request.start") c.start++;
      else if (ev.type === "request.cached") c.cached++;
      else if (ev.type === "request.network") c.network++;
      else if (ev.type === "request.blocked") c.blocked++;
      else if (ev.type === "request.error") c.error++;
    }
    return c;
  }, [events]);

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Automation telemetry activity"
      className="mt-2 rounded border border-border/60 bg-card text-card-foreground shadow-sm"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <Globe className="w-4 h-4 text-accent" aria-hidden />
        <span className="text-xs font-medium">Browser activity</span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] tabular-nums border ${
            connected
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
          }`}
          aria-live="polite"
        >
          {connected ? "live" : reconnectAttempt > 0 ? `retry #${reconnectAttempt}` : "connecting…"}
        </span>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground tabular-nums">
          <span>net {counts.network}</span>
          <span>·</span>
          <span>cache {counts.cached}</span>
          {counts.blocked > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600">blocked {counts.blocked}</span>
            </>
          )}
          {counts.error > 0 && (
            <>
              <span>·</span>
              <span className="text-red-600">err {counts.error}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={clear}
            className="text-[9px] text-muted-foreground hover:text-foreground"
            aria-label="Clear activity log"
            title="Clear activity log"
          >
            clear
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close browser activity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 border-b border-border/40">
          {error}
        </div>
      )}

      <div
        className="max-h-56 overflow-y-auto text-[11px] font-mono"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {sorted.length === 0 ? (
          <div className="px-3 py-4 text-center text-muted-foreground text-[10px]">
            No browser activity yet. The agent's web reads will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {sorted.map((ev, i) => {
              const color = eventBadgeColor(ev);
              return (
                <li
                  key={`${ev.at}-${i}`}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30"
                >
                  <span
                    className={`inline-flex items-center gap-1 px-1 py-0.5 rounded border ${
                      COLOR_CLASSES[color] ?? COLOR_CLASSES.muted
                    }`}
                  >
                    {iconForEvent(ev)}
                  </span>
                  <span className="flex-1 truncate" title={summarizeEvent(ev)}>
                    {summarizeEvent(ev)}
                  </span>
                  <span className="text-muted-foreground/70 tabular-nums text-[9px]">
                    {relTime(ev.at, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
