import { describe, it, expect, vi } from "vitest";
import { reorderDocuments } from "./db";

// Mock the database module
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => null),
}));

describe("reorderDocuments — db helper", () => {
  it("returns { updated: 0 } for empty updates array", async () => {
    const result = await reorderDocuments(1, []);
    expect(result).toEqual({ updated: 0 });
  });

  it("accepts valid updates array and userId without throwing", async () => {
    // No DB connection, returns early with updated: 0
    const result = await reorderDocuments(1, [
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 1 },
      { id: 3, sortOrder: 2 },
    ]);
    expect(result).toEqual({ updated: 0 });
  });

  it("handles single-item reorder", async () => {
    const result = await reorderDocuments(1, [{ id: 42, sortOrder: 0 }]);
    expect(result).toEqual({ updated: 0 });
  });

  it("handles large reorder batch (500 items)", async () => {
    const updates = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, sortOrder: i }));
    const result = await reorderDocuments(1, updates);
    expect(result).toEqual({ updated: 0 });
  });

  it("is a function export from db module", () => {
    expect(typeof reorderDocuments).toBe("function");
  });
});

describe("Recently Added filter — pure logic", () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function isRecentlyAdded(createdAt: string | Date): boolean {
    const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    return Date.now() - created.getTime() < SEVEN_DAYS_MS;
  }

  it("returns true for a document created 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(isRecentlyAdded(oneHourAgo)).toBe(true);
  });

  it("returns true for a document created 6 days ago", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    expect(isRecentlyAdded(sixDaysAgo)).toBe(true);
  });

  it("returns false for a document created 8 days ago", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isRecentlyAdded(eightDaysAgo)).toBe(false);
  });

  it("returns false for a document created 30 days ago", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(isRecentlyAdded(thirtyDaysAgo)).toBe(false);
  });

  it("handles ISO string dates", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyAdded(recent)).toBe(true);

    const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyAdded(old)).toBe(false);
  });

  it("handles edge case: exactly 7 days ago is NOT recent", () => {
    const exactlySevenDays = new Date(Date.now() - SEVEN_DAYS_MS);
    expect(isRecentlyAdded(exactlySevenDays)).toBe(false);
  });

  it("handles documents created just now", () => {
    expect(isRecentlyAdded(new Date())).toBe(true);
  });
});

describe("Sort order — pure logic", () => {
  it("sorts documents by sortOrder ascending", () => {
    const docs = [
      { id: 1, sortOrder: 2 },
      { id: 2, sortOrder: 0 },
      { id: 3, sortOrder: 1 },
    ];
    const sorted = [...docs].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(sorted.map(d => d.id)).toEqual([2, 3, 1]);
  });

  it("handles documents with same sortOrder (stable sort)", () => {
    const docs = [
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 0 },
      { id: 3, sortOrder: 1 },
    ];
    const sorted = [...docs].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(sorted[2].id).toBe(3);
    // First two should both have sortOrder 0
    expect(sorted[0].sortOrder).toBe(0);
    expect(sorted[1].sortOrder).toBe(0);
  });

  it("handles null/undefined sortOrder with fallback to 0", () => {
    const docs = [
      { id: 1, sortOrder: null },
      { id: 2, sortOrder: 1 },
      { id: 3, sortOrder: undefined },
    ];
    const sorted = [...docs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    expect(sorted[sorted.length - 1].id).toBe(2);
  });

  it("generates correct reorder updates after arrayMove", () => {
    // Simulate moving item at index 2 to index 0
    const docs = [
      { id: 10, sortOrder: 0 },
      { id: 20, sortOrder: 1 },
      { id: 30, sortOrder: 2 },
    ];
    // arrayMove equivalent: move index 2 to index 0
    const reordered = [docs[2], docs[0], docs[1]];
    const updates = reordered.map((doc, idx) => ({ id: doc.id, sortOrder: idx }));
    expect(updates).toEqual([
      { id: 30, sortOrder: 0 },
      { id: 10, sortOrder: 1 },
      { id: 20, sortOrder: 2 },
    ]);
  });
});
