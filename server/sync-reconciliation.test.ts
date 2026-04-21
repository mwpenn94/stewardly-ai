/**
 * Sync Reconciliation Engine — Vitest Tests
 * Tests 3-layer dedup, conflict resolution, dedup-safe push,
 * aggregation stats, and full reconciliation.
 *
 * NOTE: Uses vi.clearAllMocks() + vi.resetAllMocks() in beforeEach
 * to prevent mock state leaking between tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock pino logger
vi.mock("pino", () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

// ─── Mock getRawPool ────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

vi.mock("./db", () => ({
  getRawPool: vi.fn(async () => mockPool),
  getDb: vi.fn(async () => null),
}));

// ─── Mock global fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Set env vars ───────────────────────────────────────────────────────────

process.env.GHL_API_KEY = "test-api-key";
process.env.GHL_LOCATION_ID = "test-location-id";

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  findLocalMatch,
  findGHLMatch,
  dedupSafePush,
  getSyncAggregation,
  reconcile,
} from "./services/syncReconciliation";

beforeEach(() => {
  mockQuery.mockReset();
  mockFetch.mockReset();
});

afterEach(() => {
  mockQuery.mockReset();
  mockFetch.mockReset();
});

// ═══════════════════════════════════════════════════════════════════════════
// findLocalMatch — 3-layer dedup
// ═══════════════════════════════════════════════════════════════════════════

describe("findLocalMatch — 3-layer dedup", () => {
  it("Layer 1: matches by crmExternalId", async () => {
    const mockLead = { id: 1, firstName: "John", crmExternalId: "ghl-123" };
    mockQuery.mockResolvedValueOnce([[mockLead]]);

    const result = await findLocalMatch({ crmExternalId: "ghl-123" });
    expect(result).toEqual(mockLead);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("crmExternalId = ?"),
      ["ghl-123"]
    );
  });

  it("Layer 2: matches by email when crmExternalId not found", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const mockLead = { id: 2, firstName: "Jane", email: "jane@test.com" };
    mockQuery.mockResolvedValueOnce([[mockLead]]);

    const result = await findLocalMatch({
      crmExternalId: "nonexistent",
      email: "Jane@Test.com",
    });
    expect(result).toEqual(mockLead);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("Layer 3: matches by phone when email not found", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);
    const mockLead = { id: 3, firstName: "Bob", phone: "+1-555-123-4567" };
    mockQuery.mockResolvedValueOnce([[mockLead]]);

    const result = await findLocalMatch({
      crmExternalId: "nonexistent",
      email: "nobody@test.com",
      phone: "(555) 123-4567",
    });
    expect(result).toEqual(mockLead);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("returns null when no match found on any layer", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await findLocalMatch({
      crmExternalId: "nonexistent",
      email: "nobody@test.com",
      phone: "555-000-0000",
    });
    expect(result).toBeNull();
  });

  it("normalizes email to lowercase", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[{ id: 4 }]]);

    await findLocalMatch({ email: "  JOHN@EXAMPLE.COM  " });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("email = ?"),
      ["john@example.com"]
    );
  });

  it("normalizes phone to last 10 digits", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 5 }]]);

    await findLocalMatch({ phone: "+1 (555) 987-6543" });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("LIKE ?"),
      ["%5559876543"]
    );
  });

  it("skips phone layer if phone too short", async () => {
    const result = await findLocalMatch({ phone: "123" });
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findGHLMatch — GHL API search
// ═══════════════════════════════════════════════════════════════════════════

describe("findGHLMatch — GHL API search", () => {
  it("Layer 1: finds by crmExternalId (direct lookup)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "ghl-abc", firstName: "Test" } }),
    });

    const result = await findGHLMatch({ crmExternalId: "ghl-abc" });
    expect(result).toEqual({ id: "ghl-abc", firstName: "Test" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/contacts/ghl-abc"),
      expect.any(Object)
    );
  });

  it("Layer 2: finds by email (duplicate search)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "ghl-def", email: "test@test.com" } }),
    });

    const result = await findGHLMatch({
      crmExternalId: "nonexistent",
      email: "test@test.com",
    });
    expect(result).toEqual({ id: "ghl-def", email: "test@test.com" });
  });

  it("Layer 3: finds by phone (duplicate search)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "ghl-ghi", phone: "+15551234567" } }),
    });

    const result = await findGHLMatch({
      crmExternalId: "nonexistent",
      email: "nobody@test.com",
      phone: "+15551234567",
    });
    expect(result).toEqual({ id: "ghl-ghi", phone: "+15551234567" });
  });

  it("returns null when all layers miss", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });

    const result = await findGHLMatch({
      crmExternalId: "none",
      email: "none@test.com",
      phone: "+10000000000",
    });
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// dedupSafePush — pre-check before creating
// ═══════════════════════════════════════════════════════════════════════════

describe("dedupSafePush — dedup-safe outbound push", () => {
  it("updates existing GHL contact instead of creating duplicate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contact: { id: "existing-ghl-id", firstName: "Existing", tags: ["old-tag"] },
      }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await dedupSafePush({
      firstName: "New",
      lastName: "Lead",
      email: "existing@test.com",
      tags: ["new-tag"],
    });

    expect(result.action).toBe("updated");
    expect(result.ghlContactId).toBe("existing-ghl-id");
    expect(result.message).toContain("existing GHL contact");
  });

  it("creates new contact when no duplicate found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "new-ghl-id" } }),
    });

    const result = await dedupSafePush({
      firstName: "Brand",
      lastName: "New",
      email: "brandnew@test.com",
    });

    expect(result.action).toBe("created");
    expect(result.ghlContactId).toBe("new-ghl-id");
  });

  it("handles race condition duplicate (400 with contactId)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ meta: { contactId: "race-id" }, message: "duplicate" }),
    });

    const result = await dedupSafePush({
      firstName: "Race",
      email: "race@test.com",
    });

    expect(result.action).toBe("linked");
    expect(result.ghlContactId).toBe("race-id");
    expect(result.message).toContain("Race condition");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getSyncAggregation — stats without side effects
// ═══════════════════════════════════════════════════════════════════════════

describe("getSyncAggregation", () => {
  it("returns correct totals and breakdowns", async () => {
    mockQuery.mockResolvedValueOnce([[{ cnt: 150 }]]);
    mockQuery.mockResolvedValueOnce([[{ cnt: 120 }]]);
    mockQuery.mockResolvedValueOnce([
      [
        { status: "new", cnt: 50 },
        { status: "qualified", cnt: 40 },
        { status: "contacted", cnt: 30 },
      ],
    ]);
    mockQuery.mockResolvedValueOnce([
      [
        { source: "ghl_webhook", cnt: 80 },
        { source: "calculator", cnt: 40 },
        { source: "manual", cnt: 30 },
      ],
    ]);
    mockQuery.mockResolvedValueOnce([
      [{ notesJson: JSON.stringify({ lastReconcileAt: "2026-04-20T12:00:00Z" }) }],
    ]);

    const agg = await getSyncAggregation();

    expect(agg.stewardlyTotal).toBe(150);
    expect(agg.ghlLinked).toBe(120);
    expect(agg.ghlUnlinked).toBe(30);
    expect(agg.byStatus).toEqual({ new: 50, qualified: 40, contacted: 30 });
    expect(agg.bySource).toEqual({ ghl_webhook: 80, calculator: 40, manual: 30 });
    expect(agg.lastReconcileAt).toBe("2026-04-20T12:00:00Z");
  });

  it("returns zeros when database is empty", async () => {
    mockQuery.mockResolvedValueOnce([[{ cnt: 0 }]]);
    mockQuery.mockResolvedValueOnce([[{ cnt: 0 }]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([[]]);

    const agg = await getSyncAggregation();

    expect(agg.stewardlyTotal).toBe(0);
    expect(agg.ghlLinked).toBe(0);
    expect(agg.ghlUnlinked).toBe(0);
    expect(agg.byStatus).toEqual({});
    expect(agg.bySource).toEqual({});
    expect(agg.lastReconcileAt).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// reconcile — full bidirectional reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("reconcile — full bidirectional sync", () => {
  it("creates local leads for GHL contacts with no local match", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contacts: [
          { id: "ghl-new-1", firstName: "New", lastName: "Contact", email: "new@ghl.com" },
        ],
        meta: {},
      }),
    });
    mockQuery.mockResolvedValueOnce([[]]);
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);

    const stats = await reconcile();

    expect(stats.ghlTotal).toBe(1);
    expect(stats.stewardlyTotal).toBe(0);
    expect(stats.createdInStewardly).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it("matches and reconciles existing contacts by email", async () => {
    const localUpdated = Date.now() - 86400000;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contacts: [
          {
            id: "ghl-existing",
            firstName: "Updated",
            lastName: "Name",
            email: "shared@test.com",
            phone: "+15551234567",
            dateUpdated: "2026-04-20T12:00:00Z",
          },
        ],
        meta: {},
      }),
    });

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 42,
          firstName: "Old",
          lastName: "Name",
          email: "shared@test.com",
          phone: "555-123-4567",
          source: "calculator",
          status: "new",
          crmExternalId: null,
          notesJson: "{}",
          created_at: localUpdated,
          updated_at: localUpdated,
        },
      ],
    ]);

    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const stats = await reconcile();

    expect(stats.ghlTotal).toBe(1);
    expect(stats.stewardlyTotal).toBe(1);
    expect(stats.matched).toBe(1);
    expect(stats.updatedInStewardly).toBe(1);
    expect(stats.createdInStewardly).toBe(0);
  });

  it("pushes local orphans to GHL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contacts: [], meta: {} }),
    });

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 99,
          firstName: "Orphan",
          lastName: "Lead",
          email: "orphan@test.com",
          phone: null,
          source: "manual",
          status: "new",
          crmExternalId: null,
          notesJson: "{}",
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
    ]);

    // findGHLMatch for orphan: email search returns no match
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });

    // Create in GHL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "ghl-new-orphan" } }),
    });

    // Update local with new crmExternalId
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const stats = await reconcile();

    expect(stats.ghlTotal).toBe(0);
    expect(stats.stewardlyTotal).toBe(1);
    expect(stats.createdInGHL).toBe(1);
  });

  it("handles GHL API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockQuery.mockResolvedValueOnce([[]]);

    const stats = await reconcile();

    expect(stats.ghlTotal).toBe(0);
    // No errors because the GHL fetch just breaks the loop, no contacts to process
    expect(stats.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("resolves field conflicts with newer-wins strategy", async () => {
    const ghlUpdated = "2026-04-21T00:00:00Z";
    const localUpdated = new Date("2026-04-19T00:00:00Z").getTime();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contacts: [
          {
            id: "ghl-conflict",
            firstName: "GHL-First",
            lastName: "GHL-Last",
            email: "conflict@test.com",
            phone: "+15559999999",
            dateUpdated: ghlUpdated,
          },
        ],
        meta: {},
      }),
    });

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 77,
          firstName: "Local-First",
          lastName: "Local-Last",
          email: "conflict@test.com",
          phone: "555-888-8888",
          source: "manual",
          status: "new",
          crmExternalId: "ghl-conflict",
          notesJson: "{}",
          created_at: localUpdated,
          updated_at: localUpdated,
        },
      ],
    ]);

    // UPDATE local (GHL wins because newer)
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const stats = await reconcile();

    expect(stats.matched).toBe(1);
    expect(stats.conflictsResolved).toBeGreaterThan(0);
    const ghlWins = stats.conflicts.filter(c => c.resolution === "ghl_wins");
    expect(ghlWins.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: outbound sync uses dedupSafePush
// ═══════════════════════════════════════════════════════════════════════════

describe("outbound sync integration", () => {
  it("pushLeadToGHL uses dedupSafePush under the hood", async () => {
    const { pushLeadToGHL } = await import("./services/ghlOutboundSync");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: null }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contact: { id: "new-via-dedup" } }),
    });

    const result = await pushLeadToGHL({
      firstName: "Test",
      email: "test-dedup@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.ghlContactId).toBe("new-via-dedup");
    expect(result.mode).toBe("live");
  });
});
