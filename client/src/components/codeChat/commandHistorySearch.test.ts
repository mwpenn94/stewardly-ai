/**
 * Tests for commandHistorySearch.ts (Pass 216).
 */

import { describe, it, expect } from "vitest";
import { searchHistory, highlightEntry } from "./commandHistorySearch";

describe("searchHistory", () => {
  const history = [
    "explain the wealth engine architecture",
    "find where authentication is handled",
    "what does the chat streaming pipeline do",
    "list files in server/routers",
    "grep for getDb across the codebase",
    "duplicate", // duplicate of itself to exercise dedup
    "duplicate",
  ];

  it("returns everything capped by limit for empty query", () => {
    const r = searchHistory(history, "", 100);
    // Duplicates collapsed
    expect(r.length).toBe(6);
  });

  it("respects the limit argument", () => {
    expect(searchHistory(history, "", 3)).toHaveLength(3);
  });

  it("finds exact substring matches", () => {
    const r = searchHistory(history, "wealth");
    expect(r[0].entry).toContain("wealth");
    expect(r[0].score).toBeGreaterThan(50);
  });

  it("finds subsequence matches when no substring exists", () => {
    // `auh` is not a substring of any entry but matches "auth" subseq
    const r = searchHistory(history, "auh");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].entry).toContain("auth");
  });

  it("ranks earlier substring positions higher", () => {
    const short = [
      "foo bar baz",
      "baz foo bar",
      "bar baz foo",
    ];
    const r = searchHistory(short, "foo");
    expect(r[0].entry).toBe("foo bar baz");
  });

  it("is case insensitive", () => {
    const r = searchHistory(history, "GREP");
    expect(r[0].entry).toMatch(/grep/i);
  });

  it("dedupes identical entries", () => {
    const r = searchHistory(history, "duplicate");
    expect(r.filter((m) => m.entry === "duplicate")).toHaveLength(1);
  });

  it("returns the character indices of each matched char", () => {
    const r = searchHistory(["hello"], "ell");
    expect(r[0].indices).toEqual([1, 2, 3]);
  });

  it("returns empty array when nothing matches", () => {
    expect(searchHistory(history, "xyzqwe")).toEqual([]);
  });
});

describe("highlightEntry", () => {
  it("returns one non-highlight segment when no indices", () => {
    expect(highlightEntry("hello", [])).toEqual([
      { text: "hello", highlight: false },
    ]);
  });

  it("highlights contiguous runs", () => {
    expect(highlightEntry("hello", [1, 2, 3])).toEqual([
      { text: "h", highlight: false },
      { text: "ell", highlight: true },
      { text: "o", highlight: false },
    ]);
  });

  it("handles matches at the start", () => {
    expect(highlightEntry("hello", [0, 1])).toEqual([
      { text: "he", highlight: true },
      { text: "llo", highlight: false },
    ]);
  });

  it("handles non-contiguous matches", () => {
    expect(highlightEntry("abcdef", [0, 2, 4])).toEqual([
      { text: "a", highlight: true },
      { text: "b", highlight: false },
      { text: "c", highlight: true },
      { text: "d", highlight: false },
      { text: "e", highlight: true },
      { text: "f", highlight: false },
    ]);
  });
});
