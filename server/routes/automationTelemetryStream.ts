/**
 * automationTelemetryStream — pass 6, scope: browser/device automation parity.
 *
 * Server-Sent Events bridge for the process-global
 * `AutomationTelemetryBus`. Each connection subscribes to the bus and
 * re-emits `request.start / request.cached / request.network /
 * request.blocked / request.error` events to the client as JSON lines.
 *
 *   GET /api/automation/telemetry/stream
 *     ?types=request.network,request.blocked    (optional filter)
 *     &replay=20                                 (optional: emit the
 *       last N events from the ring buffer immediately on connect)
 *
 * The route is gated through the standard authenticateRequest path in
 * server/_core/index.ts the same way the code-chat stream is.
 * Admin-only by default so untrusted clients don't see every URL the
 * agent is hitting.
 *
 * Heartbeats every 15s keep the connection alive through proxies;
 * disconnects unsubscribe from the bus.
 */

import { Router } from "express";
import { getAutomationTelemetryBus } from "../shared/automation/automationTelemetry";
import type { NavigationTelemetryEvent } from "../shared/automation/webNavigator";
import { logger } from "../_core/logger";

const log = logger.child({ module: "automationTelemetryStream" });

const automationTelemetryStreamRouter = Router();

const VALID_EVENT_TYPES = new Set<NavigationTelemetryEvent["type"]>([
  "request.start",
  "request.cached",
  "request.network",
  "request.blocked",
  "request.error",
]);

function parseTypesParam(raw: unknown): string[] | null {
  if (typeof raw !== "string" || !raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_EVENT_TYPES.has(s as NavigationTelemetryEvent["type"]));
  return list.length > 0 ? list : null;
}

function parseReplayParam(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(200, Math.floor(n));
}

function writeSse(res: any, event: NavigationTelemetryEvent | Record<string, unknown>): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

automationTelemetryStreamRouter.get("/api/automation/telemetry/stream", async (req, res) => {
  // Auth is set on req by the middleware wrapper in _core/index.ts
  const user = (req as any).__user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Admin-only by default — these events reveal outbound URLs which
  // may include tenant-sensitive paths.
  if (user.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const types = parseTypesParam(req.query.types);
  const replay = parseReplayParam(req.query.replay);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  writeSse(res, { type: "__hello", ts: Date.now(), filter: types ?? "all", replay });

  const bus = getAutomationTelemetryBus();

  // Replay from ring buffer first
  if (replay > 0) {
    const recent = bus.snapshot(replay);
    for (const ev of recent) {
      if (!types || types.includes(ev.type)) writeSse(res, ev);
    }
  }

  const sub = bus.subscribe(
    (ev) => writeSse(res, ev),
    types ? { types } : {},
  );

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`:heartbeat\n\n`);
  }, 15000);

  const cleanup = () => {
    sub.unsubscribe();
    clearInterval(heartbeat);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  };

  req.on("close", cleanup);
  req.on("error", (err) => {
    log.warn({ err: err.message }, "telemetry stream error");
    cleanup();
  });
});

export default automationTelemetryStreamRouter;
