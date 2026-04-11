/**
 * Tests for agentMemory.ts (Pass 241).
 */

import { describe, it, expect } from "vitest";
import {
  addMemory,
  removeMemory,
  updateMemory,
  clearMemory,
  filterByCategory,
  buildMemoryOverlay,
  summarizeMemory,
  parseMemory,
  MAX_ENTRIES,
  MAX_CONTENT_LENGTH,
  type MemoryEntry,
} from "./agentMemory";

describe("addMemory", () => {
  it("appends a new entry", () => {
    const entries = addMemory([], "use pnpm");
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("use pnpm");
    expect(entries[0].category).toBe("fact");
  });

  it("defaults to 'fact' category", () => {
    const entries = addMemory([], "x");
    expect(entries[0].category).toBe("fact");
  });

  it("accepts explicit category", () => {
    const entries = addMemory([], "use pnpm", "preference");
    expect(entries[0].category).toBe("preference");
  });

  it("trims whitespace and rejects empty", () => {
    expect(addMemory([], "")).toEqual([]);
    expect(addMemory([], "   ")).toEqual([]);
    const e = addMemory([], "  hello  ");
    expect(e[0].content).toBe("hello");
  });

  it("clamps to MAX_CONTENT_LENGTH", () => {
    const long = "x".repeat(MAX_CONTENT_LENGTH + 500);
    const e = addMemory([], long);
    expect(e[0].content.length).toBe(MAX_CONTENT_LENGTH);
  });

  it("dedupes on same content + category", () => {
    let e = addMemory([], "use pnpm", "preference");
    const firstUpdatedAt = e[0].updatedAt;
    // Sleep-like gap
    e = addMemory(e, "use pnpm", "preference");
    expect(e).toHaveLength(1);
    expect(e[0].updatedAt).toBeGreaterThanOrEqual(firstUpdatedAt);
  });

  it("does NOT dedupe on same content but different category", () => {
    let e = addMemory([], "use pnpm", "preference");
    e = addMemory(e, "use pnpm", "fact");
    expect(e).toHaveLength(2);
  });

  it("caps at MAX_ENTRIES and drops oldest", () => {
    let e: MemoryEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      e = addMemory(e, `fact ${i}`);
    }
    expect(e).toHaveLength(MAX_ENTRIES);
    // Most recent at index 0
    expect(e[0].content).toBe(`fact ${MAX_ENTRIES + 9}`);
  });

  it("new entries appear at the top", () => {
    let e = addMemory([], "first");
    e = addMemory(e, "second");
    expect(e[0].content).toBe("second");
    expect(e[1].content).toBe("first");
  });
});

describe("removeMemory", () => {
  it("drops by id", () => {
    let e = addMemory([], "a");
    e = addMemory(e, "b");
    e = removeMemory(e, e[0].id);
    expect(e).toHaveLength(1);
    expect(e[0].content).toBe("a");
  });

  it("is a no-op for unknown id", () => {
    const e = addMemory([], "a");
    expect(removeMemory(e, "nope")).toBe(e);
  });
});

describe("updateMemory", () => {
  it("updates content", () => {
    let e = addMemory([], "original");
    e = updateMemory(e, e[0].id, { content: "updated" });
    expect(e[0].content).toBe("updated");
  });

  it("updates category", () => {
    let e = addMemory([], "x", "fact");
    e = updateMemory(e, e[0].id, { category: "warning" });
    expect(e[0].category).toBe("warning");
  });

  it("rejects empty content", () => {
    let e = addMemory([], "keep");
    e = updateMemory(e, e[0].id, { content: "   " });
    expect(e[0].content).toBe("keep");
  });

  it("is a no-op for unknown id", () => {
    const e = addMemory([], "x");
    expect(updateMemory(e, "missing", { content: "y" })).toBe(e);
  });
});

describe("clearMemory", () => {
  it("returns empty array", () => {
    expect(clearMemory()).toEqual([]);
  });
});

describe("filterByCategory", () => {
  const setup = () => {
    let e: MemoryEntry[] = [];
    e = addMemory(e, "a", "project");
    e = addMemory(e, "b", "fact");
    e = addMemory(e, "c", "preference");
    e = addMemory(e, "d", "project");
    return e;
  };

  it("returns all entries for 'all'", () => {
    expect(filterByCategory(setup(), "all")).toHaveLength(4);
  });

  it("filters by specific category", () => {
    expect(filterByCategory(setup(), "project")).toHaveLength(2);
    expect(filterByCategory(setup(), "preference")).toHaveLength(1);
    expect(filterByCategory(setup(), "warning")).toHaveLength(0);
  });
});

describe("buildMemoryOverlay", () => {
  it("returns empty string for empty list", () => {
    expect(buildMemoryOverlay([])).toBe("");
  });

  it("groups by category with headers", () => {
    let e: MemoryEntry[] = [];
    e = addMemory(e, "fact one", "fact");
    e = addMemory(e, "pref one", "preference");
    const overlay = buildMemoryOverlay(e);
    expect(overlay).toContain("Agent memory");
    expect(overlay).toContain("## FACT");
    expect(overlay).toContain("## PREFERENCE");
    expect(overlay).toContain("- fact one");
    expect(overlay).toContain("- pref one");
  });

  it("respects category order", () => {
    let e: MemoryEntry[] = [];
    e = addMemory(e, "a", "warning");
    e = addMemory(e, "b", "project");
    const overlay = buildMemoryOverlay(e);
    const projectIdx = overlay.indexOf("PROJECT");
    const warningIdx = overlay.indexOf("WARNING");
    expect(projectIdx).toBeLessThan(warningIdx);
  });
});

describe("summarizeMemory", () => {
  it("counts total and per-category", () => {
    let e: MemoryEntry[] = [];
    e = addMemory(e, "a", "project");
    e = addMemory(e, "b", "project");
    e = addMemory(e, "c", "fact");
    const s = summarizeMemory(e);
    expect(s.total).toBe(3);
    expect(s.byCategory.project).toBe(2);
    expect(s.byCategory.fact).toBe(1);
    expect(s.byCategory.warning).toBe(0);
  });

  it("tracks most recently updated", () => {
    let e: MemoryEntry[] = [];
    e = addMemory(e, "first");
    e = addMemory(e, "second");
    const s = summarizeMemory(e);
    expect(s.mostRecent?.content).toBe("second");
  });

  it("handles empty list", () => {
    const s = summarizeMemory([]);
    expect(s.total).toBe(0);
    expect(s.mostRecent).toBeNull();
  });
});

describe("parseMemory", () => {
  it("returns empty for null", () => {
    expect(parseMemory(null)).toEqual([]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseMemory("{{{")).toEqual([]);
  });

  it("returns empty for non-array input", () => {
    expect(parseMemory(JSON.stringify({ oops: true }))).toEqual([]);
  });

  it("filters out malformed entries", () => {
    const raw = JSON.stringify([
      { id: "a", content: "valid", category: "fact", createdAt: 1, updatedAt: 1 },
      { id: "b", content: 42 }, // bad content type
      { id: "c", content: "x", category: "bogus", createdAt: 1, updatedAt: 1 }, // bad category
    ]);
    const e = parseMemory(raw);
    expect(e).toHaveLength(1);
    expect(e[0].id).toBe("a");
  });

  it("clamps over-length content", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        content: "x".repeat(MAX_CONTENT_LENGTH + 500),
        category: "fact",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const e = parseMemory(raw);
    expect(e[0].content.length).toBe(MAX_CONTENT_LENGTH);
  });

  it("caps at MAX_ENTRIES", () => {
    const items = Array.from({ length: MAX_ENTRIES + 20 }, (_, i) => ({
      id: `m${i}`,
      content: `entry ${i}`,
      category: "fact",
      createdAt: i,
      updatedAt: i,
    }));
    const e = parseMemory(JSON.stringify(items));
    expect(e).toHaveLength(MAX_ENTRIES);
  });
});
