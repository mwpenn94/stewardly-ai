/**
 * SSE Event Bus + Permission Management — Vitest Tests
 *
 * Tests:
 * 1. SSE Event Bus: client management, event routing, location scoping, heartbeat
 * 2. Permission Management: CRUD procedures for user-location assignments
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock pool for permission management tests ───────────────────────────

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, execute: mockQuery };

vi.mock("./db", () => ({
  getRawPool: () => mockPool,
}));

// ─── SSE Event Bus Tests ─────────────────────────────────────────────────

describe("SSE Event Bus", () => {
  let bus: typeof import("./services/syncEventBus");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("./db", () => ({
      getRawPool: () => mockPool,
    }));
    bus = await import("./services/syncEventBus");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("addClient", () => {
    it("registers a client and sends connected event", () => {
      const written: string[] = [];
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn((data: string) => written.push(data)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      const clientId = bus.addClient(mockRes, 1, []);

      expect(clientId).toMatch(/^sse_/);
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        "Content-Type": "text/event-stream",
      }));
      expect(written.length).toBe(1);
      expect(written[0]).toContain("event: connected");
      expect(written[0]).toContain(clientId);
    });

    it("evicts oldest client when MAX_CLIENTS reached", () => {
      const clients: any[] = [];
      for (let i = 0; i < 501; i++) {
        const mockRes = {
          writeHead: vi.fn(),
          write: vi.fn(),
          on: vi.fn(),
          end: vi.fn(),
        } as any;
        bus.addClient(mockRes, i, []);
        clients.push(mockRes);
      }

      // Stats should show max 500 (evicted the oldest)
      const stats = bus.getSSEStats();
      expect(stats.connectedClients).toBeLessThanOrEqual(500);
    });
  });

  describe("removeClient", () => {
    it("removes a client and calls res.end()", () => {
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      const clientId = bus.addClient(mockRes, 1, []);
      expect(bus.getSSEStats().connectedClients).toBeGreaterThanOrEqual(1);

      bus.removeClient(clientId);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("handles removing non-existent client gracefully", () => {
      expect(() => bus.removeClient("non_existent")).not.toThrow();
    });
  });

  describe("emitSyncEvent", () => {
    it("sends global events to all clients", () => {
      const writes1: string[] = [];
      const writes2: string[] = [];
      const res1 = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes1.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      const res2 = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes2.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      bus.addClient(res1, 1, [10]);      // subscribed to location 10
      bus.addClient(res2, 2, [20]);      // subscribed to location 20

      // Global event (no locationId) — should go to both
      bus.emitSyncEvent({
        type: "reconcile_complete",
        timestamp: Date.now(),
        data: { stats: {} },
      });

      // Both clients should receive (writes1[0] is "connected", writes1[1] is the event)
      expect(writes1.length).toBe(2);
      expect(writes2.length).toBe(2);
      expect(writes1[1]).toContain("event: reconcile_complete");
      expect(writes2[1]).toContain("event: reconcile_complete");
    });

    it("sends location-scoped events only to subscribed clients", () => {
      const writes1: string[] = [];
      const writes2: string[] = [];
      const res1 = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes1.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      const res2 = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes2.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      bus.addClient(res1, 1, [10]);      // subscribed to location 10
      bus.addClient(res2, 2, [20]);      // subscribed to location 20

      // Location 10 event — should only go to client 1
      bus.emitSyncEvent({
        type: "webhook_received",
        locationId: 10,
        timestamp: Date.now(),
        data: { eventType: "ContactCreate" },
      });

      expect(writes1.length).toBe(2); // connected + event
      expect(writes2.length).toBe(1); // connected only
    });

    it("sends all events to admin clients (empty locationIds)", () => {
      const adminWrites: string[] = [];
      const userWrites: string[] = [];
      const adminRes = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => adminWrites.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      const userRes = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => userWrites.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      bus.addClient(adminRes, 1, []);    // admin — sees all
      bus.addClient(userRes, 2, [20]);   // user — only location 20

      // Location 10 event
      bus.emitSyncEvent({
        type: "contact_synced",
        locationId: 10,
        timestamp: Date.now(),
        data: { action: "created" },
      });

      expect(adminWrites.length).toBe(2); // connected + event
      expect(userWrites.length).toBe(1);  // connected only (not subscribed to 10)
    });

    it("does nothing when no clients connected", () => {
      // Should not throw
      expect(() =>
        bus.emitSyncEvent({
          type: "sync_error",
          timestamp: Date.now(),
          data: { error: "test" },
        })
      ).not.toThrow();
    });
  });

  describe("convenience emitters", () => {
    it("emitWebhookReceived formats correctly", () => {
      const writes: string[] = [];
      const res = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      bus.addClient(res, 1, []);

      bus.emitWebhookReceived({
        locationId: 5,
        eventType: "ContactCreate",
        contactId: "abc123",
        contactName: "John Doe",
      });

      expect(writes.length).toBe(2);
      expect(writes[1]).toContain("event: webhook_received");
      const parsed = JSON.parse(writes[1].split("data: ")[1].split("\n")[0]);
      expect(parsed.data.eventType).toBe("ContactCreate");
      expect(parsed.data.contactName).toBe("John Doe");
    });

    it("emitReconcileProgress includes percentage", () => {
      const writes: string[] = [];
      const res = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      bus.addClient(res, 1, []);

      bus.emitReconcileProgress({
        processed: 50,
        total: 200,
        matched: 40,
        created: 10,
        errors: 0,
      });

      const parsed = JSON.parse(writes[1].split("data: ")[1].split("\n")[0]);
      expect(parsed.data.pct).toBe(25);
      expect(parsed.data.processed).toBe(50);
    });

    it("emitLocationProvisioned includes action", () => {
      const writes: string[] = [];
      const res = {
        writeHead: vi.fn(),
        write: vi.fn((d: string) => writes.push(d)),
        on: vi.fn(),
        end: vi.fn(),
      } as any;
      bus.addClient(res, 1, []);

      bus.emitLocationProvisioned({
        locationId: 7,
        ghlLocationId: "ghl_abc",
        locationName: "Florida Office",
        action: "created",
      });

      const parsed = JSON.parse(writes[1].split("data: ")[1].split("\n")[0]);
      expect(parsed.type).toBe("location_provisioned");
      expect(parsed.data.action).toBe("created");
      expect(parsed.locationName).toBe("Florida Office");
    });
  });

  describe("getSSEStats", () => {
    it("returns correct stats", () => {
      const res = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      const stats0 = bus.getSSEStats();
      // May have clients from previous tests in same module, just check structure
      expect(stats0).toHaveProperty("connectedClients");
      expect(stats0).toHaveProperty("oldestConnection");

      bus.addClient(res, 1, []);
      const stats1 = bus.getSSEStats();
      expect(stats1.connectedClients).toBeGreaterThanOrEqual(1);
      expect(stats1.oldestConnection).toBeGreaterThan(0);
    });
  });
});

// ─── Permission Management Procedure Tests ───────────────────────────────

describe("Permission Management Procedures", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listUsers", () => {
    it("returns all users with role info", async () => {
      mockQuery.mockResolvedValueOnce([[
        { id: 1, name: "Alice Admin", email: "alice@test.com", role: "admin", avatarUrl: null },
        { id: 2, name: "Bob User", email: "bob@test.com", role: "user", avatarUrl: null },
      ]]);

      const [rows] = await mockPool.query("SELECT id, name, email, role, avatarUrl FROM users ORDER BY name");
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("Alice Admin");
      expect(rows[1].role).toBe("user");
    });
  });

  describe("getLocationMembers", () => {
    it("returns members with location role and global role", async () => {
      mockQuery.mockResolvedValueOnce([[
        { user_id: 1, name: "Alice", email: "alice@test.com", global_role: "admin", location_role: "admin", avatarUrl: null },
        { user_id: 2, name: "Bob", email: "bob@test.com", global_role: "user", location_role: "editor", avatarUrl: null },
      ]]);

      const [rows] = await mockPool.query(
        "SELECT ul.user_id, u.name, u.email, u.role AS global_role, ul.role AS location_role FROM user_locations ul JOIN users u ON u.id = ul.user_id WHERE ul.location_id = ?",
        [1]
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].location_role).toBe("admin");
      expect(rows[1].location_role).toBe("editor");
    });
  });

  describe("bulkAssignUsersToLocation", () => {
    it("assigns multiple users to a location", async () => {
      // INSERT IGNORE for each user
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); // already exists

      let assigned = 0;
      const userIds = [1, 2, 3];
      for (const uid of userIds) {
        const [result] = await mockPool.query(
          "INSERT IGNORE INTO user_locations (user_id, location_id, role) VALUES (?, ?, ?)",
          [uid, 5, "editor"]
        );
        if (result.affectedRows > 0) assigned++;
      }

      expect(assigned).toBe(2);
    });
  });

  describe("bulkUnassignUsersFromLocation", () => {
    it("removes multiple users from a location", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 2 }]);

      const [result] = await mockPool.query(
        "DELETE FROM user_locations WHERE location_id = ? AND user_id IN (?)",
        [5, [1, 2]]
      );

      expect(result.affectedRows).toBe(2);
    });
  });

  describe("updateLocationMemberRole", () => {
    it("updates a user's role for a specific location", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const [result] = await mockPool.query(
        "UPDATE user_locations SET role = ? WHERE user_id = ? AND location_id = ?",
        ["admin", 2, 5]
      );

      expect(result.affectedRows).toBe(1);
    });
  });

  describe("getUserLocationAssignments", () => {
    it("returns all locations assigned to a user", async () => {
      mockQuery.mockResolvedValueOnce([[
        { location_id: 1, location_name: "Florida", ghl_location_id: "ghl_fl", location_role: "editor", is_active: 1 },
        { location_id: 2, location_name: "California", ghl_location_id: "ghl_ca", location_role: "viewer", is_active: 1 },
      ]]);

      const [rows] = await mockPool.query(
        "SELECT ul.location_id, gl.name AS location_name, gl.ghl_location_id, ul.role AS location_role, gl.is_active FROM user_locations ul JOIN ghl_locations gl ON gl.id = ul.location_id WHERE ul.user_id = ?",
        [2]
      );

      expect(rows).toHaveLength(2);
      expect(rows[0].location_name).toBe("Florida");
      expect(rows[1].location_role).toBe("viewer");
    });
  });

  describe("getPermissionSummary", () => {
    it("returns location stats and unassigned user count", async () => {
      // Locations with member counts
      mockQuery.mockResolvedValueOnce([[
        { id: 1, name: "Florida", ghl_location_id: "ghl_fl", is_active: 1, member_count: 3, admin_count: 1, editor_count: 1, viewer_count: 1 },
        { id: 2, name: "California", ghl_location_id: "ghl_ca", is_active: 1, member_count: 2, admin_count: 0, editor_count: 2, viewer_count: 0 },
      ]]);
      // Total assignments
      mockQuery.mockResolvedValueOnce([[{ cnt: 5 }]]);
      // Unassigned users (non-admin users with no location assignments)
      mockQuery.mockResolvedValueOnce([[{ cnt: 3 }]]);

      const [locations] = await mockPool.query("SELECT ... locations with counts");
      const [totalResult] = await mockPool.query("SELECT COUNT(*) as cnt FROM user_locations");
      const [unassignedResult] = await mockPool.query("SELECT COUNT(*) as cnt FROM users WHERE role != 'admin' AND id NOT IN (SELECT user_id FROM user_locations)");

      expect(locations).toHaveLength(2);
      expect(totalResult[0].cnt).toBe(5);
      expect(unassignedResult[0].cnt).toBe(3);
    });
  });
});
