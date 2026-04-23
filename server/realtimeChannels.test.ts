/**
 * realtimeChannels.test.ts — Tests for real-time WebSocket channel infrastructure
 * and sidebar navigation wiring for new dashboard pages.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

function readFile(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf-8");
}

describe("Real-time Channel Infrastructure", () => {
  it("realtimeChannels.ts exists and exports key functions", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("export function registerChannelHandlers");
    expect(content).toContain("export function broadcastToChannel");
    expect(content).toContain("export function sendToUser");
    expect(content).toContain("export function startPeriodicBroadcast");
    expect(content).toContain("export function getChannelStats");
  });

  it("defines DataEngineCacheStats and ActivityTimelineEvent types", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("export interface DataEngineCacheStats");
    expect(content).toContain("export interface ActivityTimelineEvent");
  });

  it("handles channel subscribe/unsubscribe/refresh events", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("channel:subscribe");
    expect(content).toContain("channel:unsubscribe");
    expect(content).toContain("channel:refresh");
  });

  it("supports dataEngine:cacheStats channel", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("dataEngine:cacheStats");
  });

  it("supports activity:timeline channel", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("activity:timeline");
  });

  it("supports dataEngine:adapterHealth channel", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("dataEngine:adapterHealth");
  });

  it("generates cache stats with all required adapter names", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("\"FRED\"");
    expect(content).toContain("\"BLS\"");
    expect(content).toContain("\"BEA\"");
    expect(content).toContain("\"Census\"");
    expect(content).toContain("\"Treasury\"");
  });

  it("cleans up subscriptions on socket disconnect", () => {
    const content = readFile("server/services/realtimeChannels.ts");
    expect(content).toContain("socket.on(\"disconnect\"");
    expect(content).toContain("socketChannels.delete(socket.id)");
  });
});

describe("useRealtimeChannel Hook", () => {
  it("exists and exports the hook", () => {
    const content = readFile("client/src/hooks/useRealtimeChannel.ts");
    expect(content).toContain("export function useRealtimeChannel");
  });

  it("uses shared socket singleton pattern", () => {
    const content = readFile("client/src/hooks/useRealtimeChannel.ts");
    expect(content).toContain("sharedSocket");
    expect(content).toContain("sharedSocketRefCount");
    expect(content).toContain("getOrCreateSocket");
    expect(content).toContain("releaseSocket");
  });

  it("returns connected, data, history, lastUpdate, eventCount, requestRefresh", () => {
    const content = readFile("client/src/hooks/useRealtimeChannel.ts");
    expect(content).toContain("connected");
    expect(content).toContain("data");
    expect(content).toContain("history");
    expect(content).toContain("lastUpdate");
    expect(content).toContain("eventCount");
    expect(content).toContain("requestRefresh");
  });

  it("supports transform and onEvent callbacks", () => {
    const content = readFile("client/src/hooks/useRealtimeChannel.ts");
    expect(content).toContain("transform");
    expect(content).toContain("onEvent");
  });
});

describe("WebSocket Integration in websocketNotifications.ts", () => {
  it("imports and registers channel handlers", () => {
    const content = readFile("server/services/websocketNotifications.ts");
    expect(content).toContain("import { registerChannelHandlers }");
    expect(content).toContain("registerChannelHandlers(socket)");
  });
});

describe("DataEngineDashboard Live Mode", () => {
  it("imports useRealtimeChannel hook", () => {
    const content = readFile("client/src/pages/DataEngineDashboard.tsx");
    expect(content).toContain("useRealtimeChannel");
  });

  it("has a Live toggle button", () => {
    const content = readFile("client/src/pages/DataEngineDashboard.tsx");
    expect(content).toContain("liveMode");
    expect(content).toContain("setLiveMode");
    expect(content).toContain("Radio");
  });

  it("subscribes to dataEngine:cacheStats channel", () => {
    const content = readFile("client/src/pages/DataEngineDashboard.tsx");
    expect(content).toContain("dataEngine:cacheStats");
  });

  it("shows connection status when live", () => {
    const content = readFile("client/src/pages/DataEngineDashboard.tsx");
    expect(content).toContain("wsConnected");
    expect(content).toContain("eventCount");
    expect(content).toContain("lastUpdate");
  });
});

describe("ClientActivityTimeline Live Mode", () => {
  it("imports useRealtimeChannel hook", () => {
    const content = readFile("client/src/pages/ClientActivityTimeline.tsx");
    expect(content).toContain("useRealtimeChannel");
  });

  it("has a Live toggle button", () => {
    const content = readFile("client/src/pages/ClientActivityTimeline.tsx");
    expect(content).toContain("liveMode");
    expect(content).toContain("setLiveMode");
  });

  it("subscribes to activity:timeline channel", () => {
    const content = readFile("client/src/pages/ClientActivityTimeline.tsx");
    expect(content).toContain("activity:timeline");
  });

  it("auto-invalidates tRPC queries on live events", () => {
    const content = readFile("client/src/pages/ClientActivityTimeline.tsx");
    expect(content).toContain("utils.clientPortal.activityTimeline.invalidate");
    expect(content).toContain("utils.clientPortal.engagementSummary.invalidate");
  });
});

describe("Sidebar Navigation Wiring", () => {
  it("navigation.ts includes AI Usage Dashboard entry", () => {
    const content = readFile("client/src/lib/navigation.ts");
    expect(content).toContain("ai-usage");
  });

  it("navigation.ts includes Data Engine Dashboard entry", () => {
    const content = readFile("client/src/lib/navigation.ts");
    expect(content).toContain("data-engine");
  });

  it("navigation.ts includes Activity Timeline entry", () => {
    const content = readFile("client/src/lib/navigation.ts");
    expect(content).toContain("activity-timeline");
  });

  it("navigation.ts includes Global Leaderboard entry", () => {
    const content = readFile("client/src/lib/navigation.ts");
    expect(content).toContain("leaderboard");
  });

  it("App.tsx has routes for all new pages", () => {
    const content = readFile("client/src/App.tsx");
    expect(content).toContain("AIUsageDashboard");
    expect(content).toContain("DataEngineDashboard");
    expect(content).toContain("ClientActivityTimeline");
    expect(content).toContain("GlobalLeaderboard");
  });
});
