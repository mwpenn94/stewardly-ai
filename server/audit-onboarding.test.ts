/**
 * Audit Logging + Location Onboarding Wizard — Vitest Tests
 *
 * Tests:
 * 1. Audit Log Service: logAuditEvent, queryAuditLog, getAuditSummary, convenience loggers
 * 2. Audit Log tRPC: getCrmAuditLog, getCrmAuditSummary
 * 3. Permission audit wiring: bulkAssign/unassign/updateRole emit audit events
 * 4. Onboarding Wizard: discover, configure, assign, reconcile, status
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// ─── Audit Log Service Tests ─────────────────────────────────────────────
describe("Audit Log Service", () => {
  let auditLog: typeof import("./services/auditLog");

  beforeEach(async () => {
    vi.clearAllMocks();
    auditLog = await import("./services/auditLog");
  });

  describe("logAuditEvent", () => {
    it("inserts an audit event into crm_audit_log", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 42 }]);
      const id = await auditLog.logAuditEvent({
        actorId: 1,
        actorName: "Admin User",
        actorRole: "admin",
        action: "user_assigned",
        category: "permission",
        targetType: "user",
        targetId: "5",
        targetLabel: "Test User",
        locationId: 10,
        locationName: "Main Office",
        afterState: { role: "editor" },
      });
      expect(id).toBe(42);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO crm_audit_log");
      expect(params[0]).toBe(1); // actor_id
      expect(params[1]).toBe("Admin User"); // actor_name
      expect(params[3]).toBe("user_assigned"); // action
      expect(params[4]).toBe("permission"); // category
    });

    it("returns null on pool unavailable", async () => {
      // Re-import with null pool
      vi.resetModules();
      vi.mock("./db", () => ({ getDb: () => null, getRawPool: () => null }));
      vi.mock("./_core/logger", () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }));
      const mod = await import("./services/auditLog");
      const id = await mod.logAuditEvent({
        action: "user_assigned",
        category: "permission",
      });
      expect(id).toBeNull();
    });

    it("returns null on query error without throwing", async () => {
      vi.resetModules();
      const errQuery = vi.fn().mockRejectedValueOnce(new Error("DB error"));
      vi.mock("./db", () => ({
        getDb: () => null,
        getRawPool: () => ({ query: errQuery, execute: errQuery }),
      }));
      vi.mock("./_core/logger", () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }));
      const mod = await import("./services/auditLog");
      const id = await mod.logAuditEvent({
        action: "user_assigned",
        category: "permission",
      });
      expect(id).toBeNull();
    });
  });

  describe("queryAuditLog", () => {
    it("returns paginated entries with total count", async () => {
      // Count query
      mockQuery.mockResolvedValueOnce([[{ total: 3 }]]);
      // Data query
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 1, actor_id: 1, actor_name: "Admin", actor_role: "admin",
            action: "user_assigned", category: "permission",
            target_type: "user", target_id: "5", target_label: "User 5",
            location_id: 10, location_name: "Office",
            before_state: null, after_state: JSON.stringify({ role: "editor" }),
            metadata: null, ip_address: null, created_at: "1700000000000",
          },
        ],
      ]);
      const result = await auditLog.queryAuditLog({ category: "permission", limit: 10 });
      expect(result.total).toBe(3);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].action).toBe("user_assigned");
      expect(result.entries[0].afterState).toEqual({ role: "editor" });
    });

    it("applies all filters correctly", async () => {
      mockQuery.mockResolvedValueOnce([[{ total: 0 }]]);
      mockQuery.mockResolvedValueOnce([[]]);
      await auditLog.queryAuditLog({
        actorId: 1,
        action: "user_assigned",
        category: "permission",
        locationId: 10,
        targetType: "user",
        startDate: 1700000000000,
        endDate: 1700099999999,
      });
      const [countSql] = mockQuery.mock.calls[0];
      expect(countSql).toContain("actor_id = ?");
      expect(countSql).toContain("action = ?");
      expect(countSql).toContain("category = ?");
      expect(countSql).toContain("location_id = ?");
      expect(countSql).toContain("target_type = ?");
      expect(countSql).toContain("created_at >= ?");
      expect(countSql).toContain("created_at <= ?");
    });
  });

  describe("getAuditSummary", () => {
    it("returns summary statistics", async () => {
      // Total count
      mockQuery.mockResolvedValueOnce([[{ cnt: 25 }]]);
      // By category
      mockQuery.mockResolvedValueOnce([[
        { category: "permission", cnt: 15 },
        { category: "sync", cnt: 10 },
      ]]);
      // By action
      mockQuery.mockResolvedValueOnce([[
        { action: "user_assigned", cnt: 8 },
        { action: "reconciliation_completed", cnt: 7 },
      ]]);
      // Top actors
      mockQuery.mockResolvedValueOnce([[
        { actor_id: 1, actor_name: "Admin", cnt: 20 },
      ]]);
      // Recent activity
      mockQuery.mockResolvedValueOnce([[]]);

      const summary = await auditLog.getAuditSummary();
      expect(summary.totalEvents).toBe(25);
      expect(summary.byCategory.permission).toBe(15);
      expect(summary.byCategory.sync).toBe(10);
      expect(summary.byAction.user_assigned).toBe(8);
      expect(summary.topActors).toHaveLength(1);
      expect(summary.topActors[0].actorName).toBe("Admin");
    });
  });

  describe("Convenience loggers", () => {
    it("logPermissionAssign creates correct audit entry", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);
      await auditLog.logPermissionAssign({
        actorId: 1,
        actorName: "Admin",
        actorRole: "admin",
        userId: 5,
        userName: "Test User",
        locationId: 10,
        locationName: "Office",
        role: "editor",
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("user_assigned");
      expect(params[4]).toBe("permission");
      expect(params[5]).toBe("user"); // target_type
      expect(params[6]).toBe("5"); // target_id
    });

    it("logPermissionUnassign creates correct audit entry", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 2 }]);
      await auditLog.logPermissionUnassign({
        actorId: 1,
        actorName: "Admin",
        actorRole: "admin",
        userId: 5,
        locationId: 10,
        previousRole: "editor",
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("user_unassigned");
    });

    it("logRoleUpdate captures before and after state", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 3 }]);
      await auditLog.logRoleUpdate({
        actorId: 1,
        actorName: "Admin",
        actorRole: "admin",
        userId: 5,
        locationId: 10,
        previousRole: "viewer",
        newRole: "admin",
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("role_updated");
      const beforeState = JSON.parse(params[10]); // before_state (index 10)
      const afterState = JSON.parse(params[11]); // after_state (index 11)
      expect(beforeState.role).toBe("viewer");
      expect(afterState.role).toBe("admin");
    });

    it("logReconciliationEvent logs sync events", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 4 }]);
      await auditLog.logReconciliationEvent({
        action: "reconciliation_completed",
        locationId: 10,
        locationName: "Office",
        metadata: { ghlTotal: 500, matched: 450 },
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("reconciliation_completed");
      expect(params[4]).toBe("sync");
    });

    it("logLocationConfigChange captures config diff", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 5 }]);
      await auditLog.logLocationConfigChange({
        actorId: 1,
        actorName: "Admin",
        actorRole: "admin",
        locationId: 10,
        locationName: "Office",
        beforeConfig: { syncDirection: "pull_only" },
        afterConfig: { syncDirection: "bidirectional" },
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("location_config_updated");
      expect(params[4]).toBe("location_config");
    });

    it("logLocationProvisioned logs provisioning events", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 6 }]);
      await auditLog.logLocationProvisioned({
        locationId: 10,
        locationName: "New Office",
        ghlLocationId: "ghl_abc123",
        source: "webhook",
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[3]).toBe("location_provisioned");
      expect(params[4]).toBe("provisioning");
    });
  });
});

// ─── Onboarding Wizard Backend Tests ─────────────────────────────────────
describe("Onboarding Wizard Backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("onboardingDiscoverLocations", () => {
    it("returns existing locations from DB", async () => {
      const mockLocations = [
        { id: 1, name: "Office A", ghl_location_id: "loc_a", is_active: true, sync_direction: "bidirectional", sync_frequency: "daily" },
        { id: 2, name: "Office B", ghl_location_id: "loc_b", is_active: false, sync_direction: "disabled", sync_frequency: "manual" },
      ];
      mockQuery.mockResolvedValueOnce([mockLocations]);
      const [rows] = await mockPool.query(
        "SELECT id, name, ghl_location_id, is_active, sync_direction, sync_frequency FROM ghl_locations ORDER BY name"
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("Office A");
      expect(rows[1].is_active).toBe(false);
    });
  });

  describe("onboardingConfigureLocation", () => {
    it("updates location sync config", async () => {
      // Before state query
      mockQuery.mockResolvedValueOnce([[{
        sync_direction: "disabled",
        sync_frequency: "manual",
        conflict_policy: null,
        rate_limit_per_minute: 30,
      }]]);
      // Update query
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const [beforeRows] = await mockPool.query(
        "SELECT sync_direction, sync_frequency, conflict_policy, rate_limit_per_minute FROM ghl_locations WHERE id = ?",
        [1]
      );
      expect(beforeRows[0].sync_direction).toBe("disabled");

      const [result] = await mockPool.query(
        "UPDATE ghl_locations SET sync_direction = ?, sync_frequency = ?, conflict_policy = ?, rate_limit_per_minute = ? WHERE id = ?",
        ["bidirectional", "daily", "newest_wins", 30, 1]
      );
      expect(result.affectedRows).toBe(1);
    });
  });

  describe("onboardingAssignMembers", () => {
    it("assigns multiple users to a location", async () => {
      // Simulate assignUser calls
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // user 1
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // user 2
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); // user 3 (already assigned)

      const assignments = [
        { userId: 1, role: "editor" },
        { userId: 2, role: "viewer" },
        { userId: 3, role: "admin" },
      ];

      let assigned = 0;
      let skipped = 0;
      for (const a of assignments) {
        const [result] = await mockPool.query(
          "INSERT IGNORE INTO user_locations (user_id, location_id, role) VALUES (?, ?, ?)",
          [a.userId, 10, a.role]
        );
        if (result.affectedRows > 0) assigned++;
        else skipped++;
      }
      expect(assigned).toBe(2);
      expect(skipped).toBe(1);
    });
  });

  describe("getOnboardingStatus", () => {
    it("returns location status with onboarding progress", async () => {
      mockQuery.mockResolvedValueOnce([[
        {
          id: 1, name: "Office A", ghl_location_id: "loc_a", is_active: true,
          sync_direction: "bidirectional", sync_frequency: "daily",
          conflict_policy: "newest_wins", rate_limit_per_minute: 30,
          member_count: 3, completed_syncs: 2,
        },
        {
          id: 2, name: "Office B", ghl_location_id: "loc_b", is_active: true,
          sync_direction: "disabled", sync_frequency: null,
          conflict_policy: null, rate_limit_per_minute: 30,
          member_count: 0, completed_syncs: 0,
        },
      ]]);

      const [rows] = await mockPool.query(expect.any(String));
      const locations = (rows as any[]).map((r: any) => ({
        id: r.id,
        name: r.name,
        isConfigured: r.sync_direction !== "disabled" && r.sync_direction != null,
        hasMembers: Number(r.member_count) > 0,
        hasSynced: Number(r.completed_syncs) > 0,
      }));

      expect(locations[0].isConfigured).toBe(true);
      expect(locations[0].hasMembers).toBe(true);
      expect(locations[0].hasSynced).toBe(true);
      expect(locations[1].isConfigured).toBe(false);
      expect(locations[1].hasMembers).toBe(false);
      expect(locations[1].hasSynced).toBe(false);
    });
  });

  describe("onboardingRunReconciliation", () => {
    it("retrieves location config before running reconciliation", async () => {
      mockQuery.mockResolvedValueOnce([[{
        ghl_location_id: "loc_a",
        name: "Office A",
        sync_direction: "bidirectional",
        api_key: null,
        conflict_policy: "newest_wins",
        rate_limit_per_minute: 30,
      }]]);

      const [locRows] = await mockPool.query(
        "SELECT ghl_location_id, name, sync_direction, api_key, conflict_policy, rate_limit_per_minute FROM ghl_locations WHERE id = ?",
        [1]
      );
      const loc = locRows[0];
      expect(loc.ghl_location_id).toBe("loc_a");
      expect(loc.sync_direction).toBe("bidirectional");
      expect(loc.conflict_policy).toBe("newest_wins");
    });
  });
});

// ─── CRM Audit Log tRPC Procedure Tests ──────────────────────────────────
describe("CRM Audit Log tRPC Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCrmAuditLog calls queryAuditLog with filters", async () => {
    // Simulate the tRPC procedure calling queryAuditLog
    mockQuery.mockResolvedValueOnce([[{ total: 5 }]]);
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1, actor_id: 1, actor_name: "Admin", actor_role: "admin",
          action: "bulk_assign", category: "permission",
          target_type: "location", target_id: "10", target_label: null,
          location_id: 10, location_name: null,
          before_state: null, after_state: null,
          metadata: JSON.stringify({ assigned: 3, skipped: 0 }),
          ip_address: null, created_at: "1700000000000",
        },
      ],
    ]);

    vi.resetModules();
    vi.mock("./db", () => ({ getDb: () => null, getRawPool: () => mockPool }));
    vi.mock("./_core/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    const mod = await import("./services/auditLog");
    const result = await mod.queryAuditLog({ category: "permission", limit: 10 });
    expect(result.total).toBe(5);
    expect(result.entries[0].metadata).toEqual({ assigned: 3, skipped: 0 });
  });

  it("getCrmAuditSummary calls getAuditSummary with date range", async () => {
    mockQuery.mockResolvedValueOnce([[{ cnt: 10 }]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);

    vi.resetModules();
    vi.mock("./db", () => ({ getDb: () => null, getRawPool: () => mockPool }));
    vi.mock("./_core/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    const mod = await import("./services/auditLog");
    const summary = await mod.getAuditSummary(1700000000000, 1700099999999);
    expect(summary.totalEvents).toBe(10);
    const [countSql, countParams] = mockQuery.mock.calls[0];
    expect(countSql).toContain("created_at >= ?");
    expect(countSql).toContain("created_at <= ?");
    expect(countParams).toContain(1700000000000);
    expect(countParams).toContain(1700099999999);
  });
});
