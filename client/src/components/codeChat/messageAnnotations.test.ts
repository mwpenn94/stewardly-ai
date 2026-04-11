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
