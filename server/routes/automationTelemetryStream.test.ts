import { describe, it, expect, beforeEach } from "vitest";
import { EventEmitter } from "events";
import {
  __resetAutomationTelemetryBus,
  getAutomationTelemetryBus,
} from "../shared/automation/automationTelemetry";
import type { NavigationTelemetryEvent } from "../shared/automation/webNavigator";
import automationTelemetryStreamRouter from "./automationTelemetryStream";

// ─── Fixture events ───────────────────────────────────────────────────
const networkEvent: NavigationTelemetryEvent = {
  type: "request.network",
  url: "https://ex.com/",
  host: "ex.com",
  status: 200,
  bytes: 1234,
  fetchMs: 5,
  at: 1,
  revalidated: false,
};
const blockedEvent: NavigationTelemetryEvent = {
  type: "request.blocked",
  url: "https://ex.com/private",
  host: "ex.com",
  reason: "BLOCKED_BY_ROBOTS",
  at: 2,
};

// ─── Fake req/res ────────────────────────────────────────────────────
//
// Express routers are plain functions (app.handle internally). We can
// invoke the router with fake req/res objects shaped like Express's
// interfaces, collect `res.write` calls, and assert what the handler
// emitted without touching the network.

interface Harness {
  req: any;
  res: any;
  written: string[];
  statusCode: number | null;
  endCalled: boolean;
  emitClose: () => void;
}

function makeFakeReqRes(opts: {
  path: string;
  query: Record<string, string>;
  user?: { role: string; id: number } | null;
}): Harness {
  const req = new EventEmitter() as any;
  req.method = "GET";
  req.path = opts.path;
  req.originalUrl = opts.path;
  req.url = opts.path;
  req.query = opts.query;
  req.headers = {};
  req.__user = opts.user === undefined ? { role: "admin", id: 1 } : opts.user;

  const harness: Harness = {
    req,
    res: null,
    written: [],
    statusCode: null,
    endCalled: false,
    emitClose: () => req.emit("close"),
  };

  const res = new EventEmitter() as any;
  res.headers = {};
  res.writableEnded = false;
  res.setHeader = (k: string, v: string) => {
    res.headers[k] = v;
  };
  res.flushHeaders = () => {};
  res.status = (code: number) => {
    harness.statusCode = code;
    return res;
  };
  res.json = (obj: any) => {
    harness.written.push(JSON.stringify(obj));
    res.writableEnded = true;
    harness.endCalled = true;
    return res;
  };
  res.write = (chunk: string) => {
    harness.written.push(chunk);
    return true;
  };
  res.end = () => {
    res.writableEnded = true;
    harness.endCalled = true;
  };
  harness.res = res;

  return harness;
}

function callRouter(req: any, res: any): Promise<void> {
  return new Promise((resolve) => {
    (automationTelemetryStreamRouter as any).handle(req, res, () => resolve());
    // Router returns synchronously for our handler — give microtasks a tick
    setTimeout(resolve, 0);
  });
}

function parseDataLines(chunks: string[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          out.push(JSON.parse(line.slice(6)));
        } catch {
          /* non-JSON heartbeat or partial */
        }
      }
    }
  }
  return out;
}

beforeEach(() => {
  __resetAutomationTelemetryBus();
});

describe("automationTelemetryStream route", () => {
  it("returns 401 when no user is attached", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: {},
      user: null,
    });
    await callRouter(h.req, h.res);
    expect(h.statusCode).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: {},
      user: { role: "user", id: 1 },
    });
    await callRouter(h.req, h.res);
    expect(h.statusCode).toBe(403);
  });

  it("sends __hello envelope on connect + sets SSE headers", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: {},
    });
    await callRouter(h.req, h.res);
    expect(h.res.headers["Content-Type"]).toBe("text/event-stream");
    expect(h.res.headers["Cache-Control"]).toContain("no-cache");
    const events = parseDataLines(h.written);
    expect(events[0]).toMatchObject({ type: "__hello" });
    h.emitClose();
  });

  it("forwards live bus events to the subscribed stream", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: {},
    });
    await callRouter(h.req, h.res);
    expect(getAutomationTelemetryBus().listenerCount()).toBe(1);
    getAutomationTelemetryBus().publish(networkEvent);
    const events = parseDataLines(h.written);
    expect(events.some((e) => e.type === "request.network")).toBe(true);
    h.emitClose();
  });

  it("replay parameter emits ring-buffered events on connect", async () => {
    // Prime the global bus first
    getAutomationTelemetryBus().publish(networkEvent);
    getAutomationTelemetryBus().publish(blockedEvent);

    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: { replay: "10" },
    });
    await callRouter(h.req, h.res);
    const events = parseDataLines(h.written);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("__hello");
    expect(types).toContain("request.network");
    expect(types).toContain("request.blocked");
    h.emitClose();
  });

  it("types= filter excludes non-matching events", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: { types: "request.network" },
    });
    await callRouter(h.req, h.res);
    getAutomationTelemetryBus().publish(blockedEvent);
    getAutomationTelemetryBus().publish(networkEvent);
    const events = parseDataLines(h.written).filter((e) => e.type !== "__hello");
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("request.network");
    h.emitClose();
  });

  it("filters unknown types (invalid types= value) to 'all'", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: { types: "not.a.real.type" },
    });
    await callRouter(h.req, h.res);
    const hello = parseDataLines(h.written)[0];
    expect(hello.filter).toBe("all");
    h.emitClose();
  });

  it("client disconnect unsubscribes from the bus", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: {},
    });
    await callRouter(h.req, h.res);
    expect(getAutomationTelemetryBus().listenerCount()).toBe(1);
    h.emitClose();
    // Subscription removed synchronously in the close handler
    expect(getAutomationTelemetryBus().listenerCount()).toBe(0);
  });

  it("replay parameter clamps to max 200 events", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: { replay: "99999" },
    });
    await callRouter(h.req, h.res);
    const hello = parseDataLines(h.written)[0];
    expect(hello.replay).toBe(200);
    h.emitClose();
  });

  it("replay=NaN coerces to 0", async () => {
    const h = makeFakeReqRes({
      path: "/api/automation/telemetry/stream",
      query: { replay: "abc" },
    });
    await callRouter(h.req, h.res);
    const hello = parseDataLines(h.written)[0];
    expect(hello.replay).toBe(0);
    h.emitClose();
  });
});
