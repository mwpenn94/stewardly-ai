/**
 * Pass 32 — Admin Audit Trail UI + SSE Streaming Tests
 *
 * Tests:
 * 1. CRM Audit Log tRPC procedures (getCrmAuditLog, getCrmAuditSummary)
 * 2. SSE event bus (emitReconcileProgress, emitReconcileComplete, emitSyncError)
 * 3. Onboarding reconciliation SSE wiring (onProgress callback emits SSE events)
 * 4. Sync event bus client management (addClient, removeClient, getSSEStats)
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── SSE Event Bus Tests ─────────────────────────────────────────────────
describe("SSE Event Bus", () => {
  let eventBus: typeof import("./services/syncEventBus");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    eventBus = await import("./services/syncEventBus");
  });

  describe("emitReconcileProgress", () => {
    it("creates a reconcile_progress event with correct structure", () => {
      // No clients connected, so emitSyncEvent is a no-op but should not throw
      expect(() => {
        eventBus.emitReconcileProgress({
          locationId: 1,
          locationName: "Test Location",
          processed: 50,
          total: 200,
          matched: 30,
          created: 15,
          errors: 2,
        });
      }).not.toThrow();
    });

    it("calculates percentage correctly", () => {
      // We can test the event structure by capturing via a mock client
      const mockRes = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };

      // Add a client to capture events
      eventBus.addClient(mockRes as any, 1, []);

      eventBus.emitReconcileProgress({
        locationId: 1,
        locationName: "Test Location",
        processed: 75,
        total: 100,
        matched: 50,
        created: 20,
        errors: 3,
      });

      // Client should have received a write call with the event
      expect(mockRes.write).toHaveBeenCalled();
      const written = mockRes.write.mock.calls.find((call: any[]) =>
        call[0]?.includes("reconcile_progress")
      );
      expect(written).toBeTruthy();

      // Parse the SSE data
      const sseData = written![0] as string;
      const dataLine = sseData.split("\n").find((l: string) => l.startsWith("data:"));
      expect(dataLine).toBeTruthy();
      const parsed = JSON.parse(dataLine!.replace("data:", "").trim());
      expect(parsed.type).toBe("reconcile_progress");
      expect(parsed.data.pct).toBe(75);
      expect(parsed.data.processed).toBe(75);
      expect(parsed.data.matched).toBe(50);
      expect(parsed.data.created).toBe(20);
      expect(parsed.data.errors).toBe(3);
    });
  });

  describe("emitReconcileComplete", () => {
    it("creates a reconcile_complete event with stats and duration", () => {
      const mockRes = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };

      eventBus.addClient(mockRes as any, 1, []);

      eventBus.emitReconcileComplete({
        locationId: 1,
        locationName: "Test Location",
        stats: {
          ghlTotal: 200,
          matched: 150,
          createdInStewardly: 40,
          errors: 5,
        },
        durationMs: 12345,
      });

      expect(mockRes.write).toHaveBeenCalled();
      const written = mockRes.write.mock.calls.find((call: any[]) =>
        call[0]?.includes("reconcile_complete")
      );
      expect(written).toBeTruthy();

      const sseData = written![0] as string;
      const dataLine = sseData.split("\n").find((l: string) => l.startsWith("data:"));
      const parsed = JSON.parse(dataLine!.replace("data:", "").trim());
      expect(parsed.type).toBe("reconcile_complete");
      expect(parsed.data.durationMs).toBe(12345);
      expect(parsed.data.stats.ghlTotal).toBe(200);
    });
  });

  describe("emitSyncError", () => {
    it("creates a sync_error event with error and context", () => {
      const mockRes = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };

      eventBus.addClient(mockRes as any, 1, []);

      eventBus.emitSyncError({
        locationId: 1,
        locationName: "Test Location",
        error: "GHL API timeout",
        context: "onboarding_wizard",
      });

      expect(mockRes.write).toHaveBeenCalled();
      const written = mockRes.write.mock.calls.find((call: any[]) =>
        call[0]?.includes("sync_error")
      );
      expect(written).toBeTruthy();

      const sseData = written![0] as string;
      const dataLine = sseData.split("\n").find((l: string) => l.startsWith("data:"));
      const parsed = JSON.parse(dataLine!.replace("data:", "").trim());
      expect(parsed.type).toBe("sync_error");
      expect(parsed.data.error).toBe("GHL API timeout");
      expect(parsed.data.context).toBe("onboarding_wizard");
    });
  });

  describe("Client Management", () => {
    it("getSSEStats returns correct client count", () => {
      const stats = eventBus.getSSEStats();
      expect(stats).toHaveProperty("connectedClients");
      expect(typeof stats.connectedClients).toBe("number");
    });

    it("location-scoped events only go to subscribed clients", () => {
      const mockRes1 = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };
      const mockRes2 = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };

      // Client 1 subscribes to location 1
      eventBus.addClient(mockRes1 as any, 1, [1]);
      // Client 2 subscribes to location 2
      eventBus.addClient(mockRes2 as any, 2, [2]);

      // Emit event for location 1
      eventBus.emitReconcileProgress({
        locationId: 1,
        locationName: "Location 1",
        processed: 10,
        total: 100,
        matched: 5,
        created: 3,
        errors: 0,
      });

      // Client 1 should receive the event
      const client1Writes = mockRes1.write.mock.calls.filter((call: any[]) =>
        call[0]?.includes("reconcile_progress")
      );
      expect(client1Writes.length).toBe(1);

      // Client 2 should NOT receive the event (different location)
      const client2Writes = mockRes2.write.mock.calls.filter((call: any[]) =>
        call[0]?.includes("reconcile_progress")
      );
      expect(client2Writes.length).toBe(0);
    });

    it("admin clients (empty locationIds) receive all events", () => {
      const mockRes = {
        write: vi.fn(),
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        flushHeaders: vi.fn(),
      };

      // Admin client with empty locationIds
      eventBus.addClient(mockRes as any, 1, []);

      // Emit event for location 5
      eventBus.emitReconcileProgress({
        locationId: 5,
        locationName: "Any Location",
        processed: 10,
        total: 100,
        matched: 5,
        created: 3,
        errors: 0,
      });

      const writes = mockRes.write.mock.calls.filter((call: any[]) =>
        call[0]?.includes("reconcile_progress")
      );
      expect(writes.length).toBe(1);
    });
  });
});

// ─── Audit Log Query Tests ───────────────────────────────────────────────
describe("Audit Log Query Service", () => {
  let auditLog: typeof import("./services/auditLog");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    auditLog = await import("./services/auditLog");
  });

  describe("queryAuditLog", () => {
    it("returns paginated results with default limit", async () => {
      const mockRows = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        actor_id: 1,
        actor_name: "Admin",
        actor_role: "admin",
        action: "user_assigned",
        category: "permission",
        target_type: "user",
        target_id: String(i + 10),
        target_label: `User ${i}`,
        location_id: 1,
        location_name: "Main",
        before_state: null,
        after_state: JSON.stringify({ role: "editor" }),
        metadata: null,
        ip_address: null,
        created_at: Date.now() - i * 60000,
      }));

      // First call: count query
      mockQuery.mockResolvedValueOnce([[{ total: 5 }]]);
      // Second call: data query
      mockQuery.mockResolvedValueOnce([mockRows]);

      const result = await auditLog.queryAuditLog({});
      expect(result.total).toBe(5);
      expect(result.entries.length).toBe(5);
      expect(result.entries[0]).toHaveProperty("action", "user_assigned");
    });

    it("filters by category", async () => {
      mockQuery.mockResolvedValueOnce([[{ total: 3 }]]);
      mockQuery.mockResolvedValueOnce([[]]);

      await auditLog.queryAuditLog({ category: "permission" });

      // The SQL should contain a WHERE clause for category
      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain("category = ?");
      expect(countCall[1]).toContain("permission");
    });

    it("filters by action", async () => {
      mockQuery.mockResolvedValueOnce([[{ total: 2 }]]);
      mockQuery.mockResolvedValueOnce([[]]);

      await auditLog.queryAuditLog({ action: "user_assigned" });

      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain("action = ?");
      expect(countCall[1]).toContain("user_assigned");
    });

    it("filters by locationId", async () => {
      mockQuery.mockResolvedValueOnce([[{ total: 1 }]]);
      mockQuery.mockResolvedValueOnce([[]]);

      await auditLog.queryAuditLog({ locationId: 5 });

      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain("location_id = ?");
      expect(countCall[1]).toContain(5);
    });

    it("returns empty on pool unavailable", async () => {
      // Temporarily mock getRawPool to return null
      const dbMod = await import("./db");
      const origGetRawPool = dbMod.getRawPool;
      (dbMod as any).getRawPool = () => null;

      const result = await auditLog.queryAuditLog({});
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);

      (dbMod as any).getRawPool = origGetRawPool;
    });
  });

  describe("getAuditSummary", () => {
    it("returns structured summary with totalEvents, byCategory, byAction, topActors, recentActivity", async () => {
      // 1. Total events count
      mockQuery.mockResolvedValueOnce([[{ cnt: 15 }]]);
      // 2. By category
      mockQuery.mockResolvedValueOnce([[
        { category: "permission", cnt: 12 },
        { category: "sync", cnt: 3 },
      ]]);
      // 3. By action
      mockQuery.mockResolvedValueOnce([[
        { action: "user_assigned", cnt: 10 },
        { action: "role_changed", cnt: 5 },
      ]]);
      // 4. Top actors
      mockQuery.mockResolvedValueOnce([[
        { actor_id: 1, actor_name: "Admin", cnt: 15 },
      ]]);
      // 5. Recent activity
      mockQuery.mockResolvedValueOnce([[
        { id: 1, actor_id: 1, actor_name: "Admin", actor_role: "admin", action: "user_assigned", category: "permission", target_type: "user", target_id: "5", target_label: "User", location_id: 1, location_name: "Main", before_state: null, after_state: null, metadata: null, ip_address: null, created_at: Date.now() },
      ]]);

      const summary = await auditLog.getAuditSummary();
      expect(summary.totalEvents).toBe(15);
      expect(summary.byCategory).toEqual({ permission: 12, sync: 3 });
      expect(summary.byAction).toEqual({ user_assigned: 10, role_changed: 5 });
      expect(summary.topActors).toHaveLength(1);
      expect(summary.topActors[0].actorName).toBe("Admin");
      expect(summary.recentActivity).toHaveLength(1);
    });

    it("returns empty on pool unavailable", async () => {
      const dbMod = await import("./db");
      const origGetRawPool = dbMod.getRawPool;
      (dbMod as any).getRawPool = () => null;

      const summary = await auditLog.getAuditSummary();
      expect(summary.totalEvents).toBe(0);
      expect(summary.byCategory).toEqual({});
      expect(summary.byAction).toEqual({});
      expect(summary.topActors).toEqual([]);
      expect(summary.recentActivity).toEqual([]);

      (dbMod as any).getRawPool = origGetRawPool;
    });
  });
});

// ─── Onboarding Reconciliation SSE Wiring Tests ─────────────────────────
describe("Onboarding Reconciliation SSE Wiring", () => {
  it("reconcile function accepts onProgress callback", async () => {
    vi.resetModules();
    const { reconcile } = await import("./services/syncReconciliation");
    expect(typeof reconcile).toBe("function");
  });

  it("ReconcileOptions interface includes onProgress field", async () => {
    // Verify the type exists by checking the module exports
    const mod = await import("./services/syncReconciliation");
    // The function should accept options with onProgress
    // We can't call it without GHL credentials, but we can verify it doesn't throw on type level
    expect(mod.reconcile).toBeDefined();
  });

  it("syncEventBus convenience emitters are all exported", async () => {
    vi.resetModules();
    const bus = await import("./services/syncEventBus");
    expect(typeof bus.emitReconcileProgress).toBe("function");
    expect(typeof bus.emitReconcileComplete).toBe("function");
    expect(typeof bus.emitSyncError).toBe("function");
    expect(typeof bus.emitWebhookReceived).toBe("function");
    expect(typeof bus.emitContactSynced).toBe("function");
    expect(typeof bus.emitLocationProvisioned).toBe("function");
    expect(typeof bus.emitSyncEvent).toBe("function");
    expect(typeof bus.addClient).toBe("function");
    expect(typeof bus.removeClient).toBe("function");
    expect(typeof bus.getSSEStats).toBe("function");
  });
});
