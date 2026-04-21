/**
 * Location Access Control + Multi-Location Tests
 *
 * Tests:
 * 1. getLocationScope — admin bypass, regular user scoping, no assignments, owner bypass
 * 2. canAccessLead — admin access, scoped access, denied access, null location_id legacy
 * 3. getActiveLocations — returns active locations with config
 * 4. reconcileAllLocations — iterates through active locations
 * 5. Webhook location resolution — tags events with correct location_id
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock mysql2/promise ─────────────────────────────────────────────────────
const mockQuery = vi.fn();
const mockEnd = vi.fn();
const mockPool = { query: mockQuery, end: mockEnd };
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => mockPool },
  createPool: () => mockPool,
}));

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock("../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────
import { getLocationScope, canAccessLead } from "../server/services/locationAccess";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.OWNER_OPEN_ID = "owner-open-id-123";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// getLocationScope
// ═══════════════════════════════════════════════════════════════════════════════
describe("getLocationScope", () => {
  it("returns zero access for null user", async () => {
    const scope = await getLocationScope(mockPool, null);
    expect(scope.isAdmin).toBe(false);
    expect(scope.locationIds).toEqual([]);
    expect(scope.sqlFilter).toContain("1=0");
    expect(scope.drizzleIds).toEqual([]);
  });

  it("returns admin scope for admin role user", async () => {
    const scope = await getLocationScope(mockPool, { id: 1, role: "admin" });
    expect(scope.isAdmin).toBe(true);
    expect(scope.sqlFilter).toBe("");
    expect(scope.sqlWhere).toBe("");
    expect(scope.drizzleIds).toBeNull();
  });

  it("returns admin scope for owner (OWNER_OPEN_ID match)", async () => {
    const scope = await getLocationScope(mockPool, { id: 2, role: "user", openId: "owner-open-id-123" });
    expect(scope.isAdmin).toBe(true);
    expect(scope.sqlFilter).toBe("");
  });

  it("returns scoped access for regular user with assignments", async () => {
    mockQuery.mockResolvedValueOnce([[
      { ghl_location_id: 5 },
      { ghl_location_id: 12 },
    ]]);

    const scope = await getLocationScope(mockPool, { id: 3, role: "user", openId: "other-id" });
    expect(scope.isAdmin).toBe(false);
    expect(scope.locationIds).toEqual([5, 12]);
    expect(scope.sqlFilter).toContain("IN (5,12)");
    expect(scope.drizzleIds).toEqual([5, 12]);
  });

  it("returns zero access for user with no assignments", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const scope = await getLocationScope(mockPool, { id: 4, role: "user", openId: "other-id" });
    expect(scope.isAdmin).toBe(false);
    expect(scope.locationIds).toEqual([]);
    expect(scope.sqlFilter).toContain("1=0");
  });

  it("returns zero access when DB query fails (fail-closed)", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection lost"));

    const scope = await getLocationScope(mockPool, { id: 5, role: "user", openId: "other-id" });
    expect(scope.isAdmin).toBe(false);
    expect(scope.locationIds).toEqual([]);
    expect(scope.sqlFilter).toContain("1=0");
  });

  it("returns zero access when pool is null", async () => {
    const scope = await getLocationScope(null, { id: 6, role: "user" });
    expect(scope.isAdmin).toBe(false);
    expect(scope.locationIds).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// canAccessLead
// ═══════════════════════════════════════════════════════════════════════════════
describe("canAccessLead", () => {
  it("admin can access any lead", async () => {
    const result = await canAccessLead(mockPool, { id: 1, role: "admin" }, 42);
    expect(result).toBe(true);
    // Admin doesn't even need to query the lead
  });

  it("user can access lead in their assigned location", async () => {
    // First query: getLocationScope → user_locations
    mockQuery.mockResolvedValueOnce([[{ ghl_location_id: 5 }]]);
    // Second query: canAccessLead → lead_pipeline location_id
    mockQuery.mockResolvedValueOnce([[{ location_id: 5 }]]);

    const result = await canAccessLead(mockPool, { id: 3, role: "user", openId: "other" }, 42);
    expect(result).toBe(true);
  });

  it("user cannot access lead in different location", async () => {
    // First query: getLocationScope → user_locations
    mockQuery.mockResolvedValueOnce([[{ ghl_location_id: 5 }]]);
    // Second query: canAccessLead → lead_pipeline location_id
    mockQuery.mockResolvedValueOnce([[{ location_id: 99 }]]);

    const result = await canAccessLead(mockPool, { id: 3, role: "user", openId: "other" }, 42);
    expect(result).toBe(false);
  });

  it("user can access legacy lead with null location_id", async () => {
    // First query: getLocationScope → user_locations
    mockQuery.mockResolvedValueOnce([[{ ghl_location_id: 5 }]]);
    // Second query: canAccessLead → lead_pipeline location_id is null
    mockQuery.mockResolvedValueOnce([[{ location_id: null }]]);

    const result = await canAccessLead(mockPool, { id: 3, role: "user", openId: "other" }, 42);
    expect(result).toBe(true);
  });

  it("returns false for non-existent lead", async () => {
    // First query: getLocationScope → user_locations
    mockQuery.mockResolvedValueOnce([[{ ghl_location_id: 5 }]]);
    // Second query: canAccessLead → no rows
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await canAccessLead(mockPool, { id: 3, role: "user", openId: "other" }, 999);
    expect(result).toBe(false);
  });

  it("user with no assignments cannot access any lead", async () => {
    // First query: getLocationScope → no assignments
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await canAccessLead(mockPool, { id: 4, role: "user", openId: "other" }, 42);
    expect(result).toBe(false);
    // Should not even query the lead
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getActiveLocations (from syncReconciliation)
// ═══════════════════════════════════════════════════════════════════════════════
describe("getActiveLocations", () => {
  it("returns active locations with per-location config", async () => {
    const { getActiveLocations } = await import("../server/services/syncReconciliation");

    mockQuery.mockResolvedValueOnce([[
      {
        id: 1,
        location_id: "loc-abc",
        name: "Florida Office",
        region: "Southeast",
        is_active: 1,
        sync_direction: "bidirectional",
        sync_frequency: "daily",
        conflict_policy: "newest_wins",
        max_contacts_per_run: 0,
        rate_limit_ms: 50,
        last_sync_cursor: null,
        last_sync_at: null,
      },
      {
        id: 2,
        location_id: "loc-xyz",
        name: "California Office",
        region: "West",
        is_active: 1,
        sync_direction: "pull_only",
        sync_frequency: "hourly",
        conflict_policy: "ghl_wins",
        max_contacts_per_run: 1000,
        rate_limit_ms: 100,
        last_sync_cursor: "cursor-123",
        last_sync_at: 1700000000000,
      },
    ]]);

    const locations = await getActiveLocations();
    expect(locations).toHaveLength(2);
    expect(locations[0].dbId).toBe(1);
    expect(locations[0].locationId).toBe("loc-abc");
    expect(locations[0].syncDirection).toBe("bidirectional");
    expect(locations[1].dbId).toBe(2);
    expect(locations[1].syncDirection).toBe("pull_only");
    expect(locations[1].maxContactsPerRun).toBe(1000);
  });

  it("returns empty array when DB unavailable", async () => {
    const { getActiveLocations } = await import("../server/services/syncReconciliation");
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const locations = await getActiveLocations();
    expect(locations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-location reconcile (location-scoped queries)
// ═══════════════════════════════════════════════════════════════════════════════
describe("reconcile with location config", () => {
  it("passes location config to buildLocalIndexes and GHL API calls", async () => {
    const { reconcile } = await import("../server/services/syncReconciliation");

    // buildLocalIndexes: chunked local lead query (returns empty → no leads)
    mockQuery.mockResolvedValueOnce([[]]);

    // GHL API fetch — mock global fetch to return empty contacts
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ contacts: [], meta: {} }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const stats = await reconcile({
      maxGHLContacts: 10,
      pushOrphans: false,
      resumeCursor: null,
      location: {
        dbId: 1,
        locationId: "loc-test",
        name: "Test Office",
        apiKeyOverride: null,
        syncDirection: "bidirectional",
        conflictPolicy: "newest_wins",
        maxContactsPerRun: 10,
        rateLimitMs: 0,
        lastSyncCursor: null,
      },
    });

    expect(stats.locationId).toBe("loc-test");
    expect(stats.locationName).toBe("Test Office");
    expect(stats.complete).toBe(true);

    // Verify GHL API was called with the correct location ID
    expect(mockFetch).toHaveBeenCalled();
    const fetchUrl = mockFetch.mock.calls[0][0];
    expect(fetchUrl).toContain("loc-test");

    vi.unstubAllGlobals();
  });

  it("respects pull_only direction — does not push orphans", async () => {
    const { reconcile } = await import("../server/services/syncReconciliation");

    // buildLocalIndexes: one local lead
    mockQuery.mockResolvedValueOnce([[
      { id: 1, firstName: "John", lastName: "Doe", email: "john@test.com", phone: "5551234567", source: "web", status: "new", crmExternalId: null, notesJson: null, created_at: Date.now(), updated_at: Date.now(), location_id: 1 },
    ]]);
    // Second chunk: empty (end of local leads)
    mockQuery.mockResolvedValueOnce([[]]);

    // GHL API: no contacts
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ contacts: [], meta: {} }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const stats = await reconcile({
      maxGHLContacts: 10,
      pushOrphans: true, // Even though pushOrphans is true...
      resumeCursor: null,
      location: {
        dbId: 1,
        locationId: "loc-pull",
        name: "Pull Only Office",
        apiKeyOverride: null,
        syncDirection: "pull_only", // ...pull_only should prevent pushing
        conflictPolicy: "ghl_wins",
        maxContactsPerRun: 10,
        rateLimitMs: 0,
        lastSyncCursor: null,
      },
    });

    // Should not have pushed any orphans (pull_only blocks outbound)
    expect(stats.createdInGHL).toBe(0);
    expect(stats.orphansFixed).toBe(0);

    vi.unstubAllGlobals();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getSyncAggregation with location filter
// ═══════════════════════════════════════════════════════════════════════════════
describe("getSyncAggregation with location filter", () => {
  it("applies location filter to all queries when locationDbId provided", async () => {
    const { getSyncAggregation } = await import("../server/services/syncReconciliation");

    // Query 1: total leads (with location filter)
    mockQuery.mockResolvedValueOnce([[{ cnt: 50 }]]);
    // Query 2: linked leads
    mockQuery.mockResolvedValueOnce([[{ cnt: 45 }]]);
    // Query 3: by status
    mockQuery.mockResolvedValueOnce([[{ status: "new", cnt: 30 }, { status: "qualified", cnt: 20 }]]);
    // Query 4: by source
    mockQuery.mockResolvedValueOnce([[{ source: "web", cnt: 40 }, { source: "referral", cnt: 10 }]]);
    // Query 5: last reconcile from notesJson
    mockQuery.mockResolvedValueOnce([[]]);
    // Query 6: platform_kv last reconcile
    mockQuery.mockResolvedValueOnce([[]]);
    // Query 7: platform_kv last run stats
    mockQuery.mockResolvedValueOnce([[]]);

    const agg = await getSyncAggregation(1); // locationDbId = 1
    expect(agg.stewardlyTotal).toBe(50);
    expect(agg.ghlLinked).toBe(45);
    expect(agg.linkRate).toBe(90); // 45/50 * 100

    // Verify location filter was applied (check that query was called with location_id param)
    const firstCall = mockQuery.mock.calls[0];
    expect(firstCall[0]).toContain("location_id");
    expect(firstCall[1]).toContain(1);
  });
});
