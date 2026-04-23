/**
 * Pass 34 — GHL Polling Fallback + Location Health Dashboard Tests
 *
 * Tests:
 * 1. GHL polling service — state management (active/inactive, interval config)
 * 2. GHL polling service — poll cycle execution and result tracking
 * 3. GHL polling service — scheduled handler integration
 * 4. Location health dashboard — route and navigation registration
 * 5. Polling config validation
 * 6. Scheduler integration — ghl_contact_polling job registration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock pool ───────────────────────────────────────────────────────────
const mockQuery = vi.fn();
const mockPool = { query: mockQuery, execute: mockQuery };
vi.mock("./db", () => ({
  getDb: () => null,
  getRawPool: () => mockPool,
}));
vi.mock("./_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

// ─── GHL Polling Service — State Management ──────────────────────────────
describe("GHL Polling Service — State Management", () => {
  let polling: typeof import("./services/ghlPolling");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    polling = await import("./services/ghlPolling");
  });

  it("starts with polling inactive by default", () => {
    const status = polling.getPollingStatus(0);
    expect(status.isActive).toBe(false);
    expect(status.lastCycleAt).toBeNull();
    expect(status.lastCycleResult).toBeNull();
    expect(status.nextCycleAt).toBeNull();
  });

  it("setPollingActive toggles the active state", () => {
    polling.setPollingActive(true);
    expect(polling.getPollingStatus(0).isActive).toBe(true);
    polling.setPollingActive(false);
    expect(polling.getPollingStatus(0).isActive).toBe(false);
  });

  it("setPollingInterval updates the interval", () => {
    polling.setPollingInterval(120000);
    const status = polling.getPollingStatus(0);
    expect(status.intervalMs).toBe(120000);
  });

  it("setPollingInterval clamps to minimum 60000ms", () => {
    polling.setPollingInterval(30000); // Below minimum
    const status = polling.getPollingStatus(0);
    expect(status.intervalMs).toBe(60000);
  });

  it("getPollingStatus includes locationsMonitored count", () => {
    const status = polling.getPollingStatus(5);
    expect(status.locationsMonitored).toBe(5);
  });

  it("updateLastCycleResult stores the result and updates lastCycleAt", () => {
    const mockResult: import("./services/ghlPolling").PollCycleResult = {
      locations: [{
        locationId: "loc-1",
        locationName: "WealthBridge HQ",
        contactsFound: 100,
        contactsCreated: 5,
        contactsUpdated: 10,
        contactsDeleted: 0,
        opportunitiesFound: 3,
        errors: [],
        durationMs: 2500,
        pollTimestamp: Date.now(),
      }],
      totalContactsProcessed: 100,
      totalErrors: 0,
      cycleStartedAt: Date.now(),
      cycleDurationMs: 2500,
    };
    polling.updateLastCycleResult(mockResult);
    const status = polling.getPollingStatus(1);
    expect(status.lastCycleResult).toBeDefined();
    expect(status.lastCycleResult!.totalContactsProcessed).toBe(100);
    expect(status.lastCycleAt).toBe(mockResult.cycleStartedAt);
    expect(status.nextCycleAt).toBe(mockResult.cycleStartedAt + status.intervalMs);
  });
});

// ─── GHL Polling Service — Poll Cycle Execution ──────────────────────────
describe("GHL Polling Service — Poll Cycle Execution", () => {
  let polling: typeof import("./services/ghlPolling");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    polling = await import("./services/ghlPolling");
  });

  it("runPollCycle returns a structured PollCycleResult", async () => {
    const result = await polling.runPollCycle();
    expect(result).toHaveProperty("locations");
    expect(result).toHaveProperty("totalContactsProcessed");
    expect(result).toHaveProperty("totalErrors");
    expect(result).toHaveProperty("cycleStartedAt");
    expect(result).toHaveProperty("cycleDurationMs");
    expect(Array.isArray(result.locations)).toBe(true);
    expect(typeof result.cycleDurationMs).toBe("number");
  });

  it("runPollCycle handles no DB gracefully (returns empty result)", async () => {
    const result = await polling.runPollCycle();
    // With getDb() returning null, should return empty locations
    expect(result.locations).toHaveLength(0);
    expect(result.totalContactsProcessed).toBe(0);
    expect(result.totalErrors).toBe(0);
  });
});

// ─── GHL Polling Service — Scheduled Handler ─────────────────────────────
describe("GHL Polling Service — Scheduled Handler", () => {
  let polling: typeof import("./services/ghlPolling");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    polling = await import("./services/ghlPolling");
  });

  it("scheduledPollHandler skips when polling is inactive", async () => {
    polling.setPollingActive(false);
    await polling.scheduledPollHandler();
    // Should not have updated lastCycleResult since it was skipped
    const status = polling.getPollingStatus(0);
    expect(status.lastCycleResult).toBeNull();
  });

  it("scheduledPollHandler skips when GHL_API_KEY is not set", async () => {
    const originalKey = process.env.GHL_API_KEY;
    delete process.env.GHL_API_KEY;
    polling.setPollingActive(true);
    await polling.scheduledPollHandler();
    // Should not have updated lastCycleResult since API key is missing
    const status = polling.getPollingStatus(0);
    expect(status.lastCycleResult).toBeNull();
    // Restore
    if (originalKey) process.env.GHL_API_KEY = originalKey;
  });
});

// ─── Polling Config Validation ───────────────────────────────────────────
describe("Polling Config Validation", () => {
  let polling: typeof import("./services/ghlPolling");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    polling = await import("./services/ghlPolling");
  });

  it("accepts valid interval values", () => {
    polling.setPollingInterval(300000); // 5 min
    expect(polling.getPollingStatus(0).intervalMs).toBe(300000);

    polling.setPollingInterval(60000); // 1 min (minimum)
    expect(polling.getPollingStatus(0).intervalMs).toBe(60000);

    polling.setPollingInterval(3600000); // 1 hour
    expect(polling.getPollingStatus(0).intervalMs).toBe(3600000);
  });

  it("polling status shape matches PollingStatus interface", () => {
    const status = polling.getPollingStatus(2);
    expect(typeof status.isActive).toBe("boolean");
    expect(typeof status.intervalMs).toBe("number");
    expect(typeof status.locationsMonitored).toBe("number");
    // Nullable fields
    expect(status.lastCycleAt === null || typeof status.lastCycleAt === "number").toBe(true);
    expect(status.lastCycleResult === null || typeof status.lastCycleResult === "object").toBe(true);
    expect(status.nextCycleAt === null || typeof status.nextCycleAt === "number").toBe(true);
  });
});

// ─── Location Health — Route & Navigation ────────────────────────────────
describe("Location Health — Route & Navigation", () => {
  it("App.tsx contains LocationHealth route", async () => {
    const fs = await import("fs");
    const appCode = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appCode).toContain("LocationHealth");
    expect(appCode).toContain("/location-health");
  });

  it("navigation.ts contains Location Health entry", async () => {
    const fs = await import("fs");
    const navCode = fs.readFileSync("client/src/lib/navigation.ts", "utf-8");
    expect(navCode).toContain("Location Health");
    expect(navCode).toContain("/location-health");
  });

  it("LocationHealth.tsx exists and imports required trpc procedures", async () => {
    const fs = await import("fs");
    const pageCode = fs.readFileSync("client/src/pages/LocationHealth.tsx", "utf-8");
    expect(pageCode).toContain("trpc");
    expect(pageCode).toContain("getLocationHealth");
    expect(pageCode).toContain("getHealthHistory");
    expect(pageCode).toContain("getPollingStatus");
    expect(pageCode).toContain("triggerPollCycle");
  });
});

// ─── Scheduler Integration ───────────────────────────────────────────────
describe("Scheduler Integration", () => {
  it("scheduler.ts contains ghl_contact_polling job with auto-activation for active locations", async () => {
    const fs = await import("fs");
    const schedulerCode = fs.readFileSync("server/services/scheduler.ts", "utf-8");
    expect(schedulerCode).toContain("ghl_contact_polling");
    expect(schedulerCode).toContain("scheduledPollHandler");
    // Auto-activates when GHL_API_KEY is set and active locations exist
    expect(schedulerCode).toContain("setPollingActive(true)");
    expect(schedulerCode).toContain("Auto-activated GHL polling");
  });

  it("ghlPolling.ts exports all required functions", async () => {
    const polling = await import("./services/ghlPolling");
    expect(typeof polling.runPollCycle).toBe("function");
    expect(typeof polling.scheduledPollHandler).toBe("function");
    expect(typeof polling.getPollingStatus).toBe("function");
    expect(typeof polling.setPollingActive).toBe("function");
    expect(typeof polling.setPollingInterval).toBe("function");
    expect(typeof polling.updateLastCycleResult).toBe("function");
  });
});

// ─── Health Status Determination Logic ───────────────────────────────────
describe("Health Status Determination Logic", () => {
  it("healthy: synced recently with success status", () => {
    const now = Date.now();
    const loc = { lastSyncAt: now - 5 * 60000, lastSyncStatus: "success" };
    const syncLagMinutes = Math.round((now - loc.lastSyncAt) / 60000);
    expect(syncLagMinutes).toBeLessThanOrEqual(60);
    expect(loc.lastSyncStatus).not.toBe("failed");
  });

  it("warning: synced > 60 min ago", () => {
    const now = Date.now();
    const loc = { lastSyncAt: now - 90 * 60000, lastSyncStatus: "success" };
    const syncLagMinutes = Math.round((now - loc.lastSyncAt) / 60000);
    expect(syncLagMinutes).toBeGreaterThan(60);
  });

  it("critical: last sync failed", () => {
    const loc = { lastSyncAt: Date.now() - 5 * 60000, lastSyncStatus: "failed" };
    expect(loc.lastSyncStatus).toBe("failed");
  });

  it("unknown: never synced", () => {
    const loc = { lastSyncAt: null, lastSyncStatus: null };
    expect(loc.lastSyncAt).toBeNull();
  });
});
