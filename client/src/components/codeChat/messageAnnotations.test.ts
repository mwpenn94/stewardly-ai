/**
 * Tests for messageAnnotations.ts (Passes 233 + 235).
 */

import { describe, it, expect } from "vitest";
import {
  parseBookmarks,
  toggleBookmark,
  isBookmarked,
  parseReactions,
  setReaction,
  getReaction,
  countReactions,
  saveReactions,
} from "./messageAnnotations";

describe("parseBookmarks", () => {
  it("returns empty for null / invalid", () => {
    expect(parseBookmarks(null)).toEqual([]);
    expect(parseBookmarks("{bad")).toEqual([]);
    expect(parseBookmarks('"not array"')).toEqual([]);
  });

  it("parses a valid array", () => {
    expect(parseBookmarks('["a","b"]')).toEqual(["a", "b"]);
  });

  it("drops non-string entries", () => {
    expect(parseBookmarks('["a", 42, null, "b"]')).toEqual(["a", "b"]);
  });

  it("dedupes preserving first-seen order", () => {
    expect(parseBookmarks('["a","b","a","c"]')).toEqual(["a", "b", "c"]);
  });

  it("caps at MAX_BOOKMARKS (500)", () => {
    const many = Array.from({ length: 600 }, (_, i) => `m${i}`);
    expect(parseBookmarks(JSON.stringify(many)).length).toBe(500);
  });
});

describe("toggleBookmark", () => {
  it("adds a new bookmark", () => {
    expect(toggleBookmark([], "m1")).toEqual(["m1"]);
  });
  it("removes an existing bookmark", () => {
    expect(toggleBookmark(["m1", "m2"], "m1")).toEqual(["m2"]);
  });
  it("drops oldest on overflow", () => {
    const many = Array.from({ length: 500 }, (_, i) => `m${i}`);
    const after = toggleBookmark(many, "new");
    expect(after).toHaveLength(500);
    expect(after[after.length - 1]).toBe("new");
    expect(after).not.toContain("m0");
  });
});

describe("isBookmarked", () => {
  it("reports presence", () => {
    expect(isBookmarked(["a", "b"], "a")).toBe(true);
    expect(isBookmarked(["a", "b"], "c")).toBe(false);
  });
});

describe("parseReactions", () => {
  it("returns empty for null / invalid", () => {
    expect(parseReactions(null)).toEqual({});
    expect(parseReactions("[]")).toEqual({});
    expect(parseReactions("{bad")).toEqual({});
  });

  it("parses a valid map", () => {
    const raw = JSON.stringify({ a: "up", b: "down" });
    expect(parseReactions(raw)).toEqual({ a: "up", b: "down" });
  });

  it("drops invalid reaction values", () => {
    const raw = JSON.stringify({ a: "up", b: "heart", c: null });
    expect(parseReactions(raw)).toEqual({ a: "up" });
  });
});

describe("setReaction", () => {
  it("sets a fresh reaction", () => {
    expect(setReaction({}, "m1", "up")).toEqual({ m1: "up" });
  });
  it("replaces the opposite reaction", () => {
    expect(setReaction({ m1: "up" }, "m1", "down")).toEqual({ m1: "down" });
  });
  it("toggles off on same reaction", () => {
    expect(setReaction({ m1: "up" }, "m1", "up")).toEqual({});
  });
  it("leaves other entries untouched", () => {
    const r = setReaction({ a: "up", b: "down" }, "b", "up");
    expect(r).toEqual({ a: "up", b: "up" });
  });
});

describe("getReaction", () => {
  it("returns the reaction or null", () => {
    expect(getReaction({ m1: "up" }, "m1")).toBe("up");
    expect(getReaction({}, "m1")).toBeNull();
  });
});

describe("countReactions", () => {
  it("returns zero for empty", () => {
    expect(countReactions({})).toEqual({ up: 0, down: 0 });
  });
  it("counts by kind", () => {
    expect(countReactions({ a: "up", b: "up", c: "down" })).toEqual({
      up: 2,
      down: 1,
    });
  });
});

// Pass v5 #79: reactions cap at 1000 entries to prevent runaway growth.
describe("reactions cap", () => {
  it("drops oldest entries when parseReactions exceeds MAX_REACTIONS", () => {
    const over: Record<string, "up" | "down"> = {};
    for (let i = 0; i < 1500; i++) {
      over[`m${i}`] = i % 2 === 0 ? "up" : "down";
    }
    const parsed = parseReactions(JSON.stringify(over));
    const keys = Object.keys(parsed);
    expect(keys).toHaveLength(1000);
    // Oldest dropped, newest kept
    expect(parsed["m0"]).toBeUndefined();
    expect(parsed["m1499"]).toBe("down");
  });

  it("setReaction drops oldest when adding a new message past the cap", () => {
    const map: Record<string, "up" | "down"> = {};
    for (let i = 0; i < 1000; i++) map[`m${i}`] = "up";
    const next = setReaction(map, "mNEW", "down");
    const keys = Object.keys(next);
    expect(keys).toHaveLength(1000);
    expect(next["m0"]).toBeUndefined();
    expect(next["mNEW"]).toBe("down");
  });

  it("setReaction does not drop when replacing an existing entry", () => {
    const map: Record<string, "up" | "down"> = {};
    for (let i = 0; i < 1000; i++) map[`m${i}`] = "up";
    const next = setReaction(map, "m500", "down");
    expect(Object.keys(next)).toHaveLength(1000);
    expect(next["m0"]).toBe("up");
    expect(next["m500"]).toBe("down");
  });

  it("saveReactions returns ok:true on success", () => {
    // Node env has no localStorage — stub a minimal in-memory one.
    const store: Record<string, string> = {};
    const stub = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    };
    const hadGlobal = "localStorage" in globalThis;
    const prior = (globalThis as unknown as { localStorage?: unknown }).localStorage;
    (globalThis as unknown as { localStorage: unknown }).localStorage = stub;
    try {
      const result = saveReactions({ a: "up" });
      expect(result).toEqual({ ok: true });
    } finally {
      if (hadGlobal) {
        (globalThis as unknown as { localStorage: unknown }).localStorage = prior;
      } else {
        delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
      }
    }
  });

  it("saveReactions returns ok:false reason quota on setItem failure", () => {
    const stub = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const hadGlobal = "localStorage" in globalThis;
    const prior = (globalThis as unknown as { localStorage?: unknown }).localStorage;
    (globalThis as unknown as { localStorage: unknown }).localStorage = stub;
    try {
      const result = saveReactions({ a: "up" });
      expect(result).toEqual({ ok: false, reason: "quota" });
    } finally {
      if (hadGlobal) {
        (globalThis as unknown as { localStorage: unknown }).localStorage = prior;
      } else {
        delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
      }
    }
  });
});
