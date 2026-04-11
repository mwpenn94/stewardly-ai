/**
 * Tests for scratchpad.ts (Pass 240).
 */

import { describe, it, expect } from "vitest";
import {
  emptyScratchpad,
  setContent,
  append,
  prepend,
  insertAt,
  clear,
  scratchpadStats,
  extractLines,
  parseScratchpad,
  MAX_CONTENT_BYTES,
} from "./scratchpad";

describe("emptyScratchpad", () => {
  it("returns an empty state", () => {
    const s = emptyScratchpad();
    expect(s.content).toBe("");
    expect(s.updatedAt).toBe(0);
  });
});

describe("setContent", () => {
  it("replaces the content and bumps updatedAt", () => {
    const s = setContent(emptyScratchpad(), "hello");
    expect(s.content).toBe("hello");
    expect(s.updatedAt).toBeGreaterThan(0);
  });

  it("clamps to MAX_CONTENT_BYTES", () => {
    const big = "x".repeat(MAX_CONTENT_BYTES + 1000);
    const s = setContent(emptyScratchpad(), big);
    expect(s.content.length).toBe(MAX_CONTENT_BYTES);
  });
});

describe("append", () => {
  it("appends to empty scratchpad", () => {
    const s = append(emptyScratchpad(), "hello");
    expect(s.content).toBe("hello");
  });

  it("adds newline separator when prior content does not end with one", () => {
    let s = setContent(emptyScratchpad(), "line1");
    s = append(s, "line2");
    expect(s.content).toBe("line1\nline2");
  });

  it("skips separator when prior content already ends with newline", () => {
    let s = setContent(emptyScratchpad(), "line1\n");
    s = append(s, "line2");
    expect(s.content).toBe("line1\nline2");
  });

  it("is a no-op on empty input", () => {
    const initial = setContent(emptyScratchpad(), "keep");
    const next = append(initial, "");
    expect(next).toBe(initial);
  });
});

describe("prepend", () => {
  it("prepends with newline separator", () => {
    let s = setContent(emptyScratchpad(), "existing");
    s = prepend(s, "new");
    expect(s.content).toBe("new\nexisting");
  });

  it("handles empty scratchpad", () => {
    const s = prepend(emptyScratchpad(), "hello");
    expect(s.content).toBe("hello");
  });
});

describe("insertAt", () => {
  it("inserts at the given position", () => {
    let s = setContent(emptyScratchpad(), "abcdef");
    s = insertAt(s, 3, "XYZ");
    expect(s.content).toBe("abcXYZdef");
  });

  it("clamps position to start when negative", () => {
    let s = setContent(emptyScratchpad(), "abc");
    s = insertAt(s, -5, "X");
    expect(s.content).toBe("Xabc");
  });

  it("clamps position to end when beyond length", () => {
    let s = setContent(emptyScratchpad(), "abc");
    s = insertAt(s, 999, "X");
    expect(s.content).toBe("abcX");
  });
});

describe("clear", () => {
  it("returns empty state", () => {
    const s = clear();
    expect(s.content).toBe("");
  });
});

describe("scratchpadStats", () => {
  it("counts chars, words, lines for empty", () => {
    const stats = scratchpadStats(emptyScratchpad());
    expect(stats.chars).toBe(0);
    expect(stats.words).toBe(0);
    expect(stats.lines).toBe(0);
  });

  it("counts chars, words, lines for multi-line", () => {
    const s = setContent(emptyScratchpad(), "hello world\nfoo bar baz\nqux");
    const stats = scratchpadStats(s);
    expect(stats.chars).toBe(27);
    expect(stats.words).toBe(6);
    expect(stats.lines).toBe(3);
  });

  it("reports pct of cap used", () => {
    const s = setContent(emptyScratchpad(), "x".repeat(MAX_CONTENT_BYTES / 4));
    const stats = scratchpadStats(s);
    expect(stats.pct).toBeCloseTo(0.25, 2);
  });
});

describe("extractLines", () => {
  const s = setContent(emptyScratchpad(), "one\ntwo\nthree\nfour\nfive");

  it("extracts a range", () => {
    expect(extractLines(s, 2, 4)).toBe("two\nthree\nfour");
  });

  it("handles single-line selection", () => {
    expect(extractLines(s, 3, 3)).toBe("three");
  });

  it("clamps start to 1", () => {
    expect(extractLines(s, -5, 2)).toBe("one\ntwo");
  });

  it("clamps end to last line", () => {
    expect(extractLines(s, 4, 99)).toBe("four\nfive");
  });

  it("returns empty string for inverted range", () => {
    expect(extractLines(s, 4, 2)).toBe("");
  });
});

describe("parseScratchpad", () => {
  it("returns empty for null", () => {
    expect(parseScratchpad(null)).toEqual(emptyScratchpad());
  });

  it("returns empty for malformed JSON", () => {
    expect(parseScratchpad("{not json")).toEqual(emptyScratchpad());
  });

  it("round-trips valid content + updatedAt", () => {
    const raw = JSON.stringify({ content: "hi", updatedAt: 123, version: 1 });
    const s = parseScratchpad(raw);
    expect(s.content).toBe("hi");
    expect(s.updatedAt).toBe(123);
  });

  it("falls back to defaults for missing fields", () => {
    const raw = JSON.stringify({ content: "only content" });
    const s = parseScratchpad(raw);
    expect(s.content).toBe("only content");
    expect(s.updatedAt).toBe(0);
  });

  it("clamps over-cap content on load", () => {
    const raw = JSON.stringify({ content: "x".repeat(MAX_CONTENT_BYTES + 1000) });
    const s = parseScratchpad(raw);
    expect(s.content.length).toBe(MAX_CONTENT_BYTES);
  });

  it("rejects non-string content", () => {
    const raw = JSON.stringify({ content: 42 });
    const s = parseScratchpad(raw);
    expect(s.content).toBe("");
  });
});
