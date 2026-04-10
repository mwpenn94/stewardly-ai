/**
 * Tests for shared/lineDiff.ts (Pass 202).
 */

import { describe, it, expect } from "vitest";
import { lineDiff, formatUnifiedDiff, groupHunks } from "./lineDiff";

describe("lineDiff — basic", () => {
  it("returns an all-equal diff when inputs are identical", () => {
    const r = lineDiff("a\nb\nc", "a\nb\nc");
    expect(r.stats.added).toBe(0);
    expect(r.stats.deleted).toBe(0);
    expect(r.stats.unchanged).toBe(3);
    expect(r.stats.similarity).toBe(1);
    expect(r.hunks).toHaveLength(0); // no hunks when nothing changed
  });

  it("returns pure deletions when b is empty", () => {
    const r = lineDiff("a\nb\nc", "");
    expect(r.stats.deleted).toBe(3);
    expect(r.stats.added).toBe(0);
  });

  it("returns pure additions when a is empty", () => {
    const r = lineDiff("", "a\nb");
    expect(r.stats.added).toBe(2);
    expect(r.stats.deleted).toBe(0);
  });

  it("detects a single-line change in the middle", () => {
    const r = lineDiff(
      "line 1\nline 2\nline 3\nline 4\nline 5",
      "line 1\nline 2\nCHANGED\nline 4\nline 5",
    );
    expect(r.stats.added).toBe(1);
    expect(r.stats.deleted).toBe(1);
    expect(r.stats.unchanged).toBe(4);
    expect(r.hunks).toHaveLength(1);
  });
});

describe("lineDiff — edge cases", () => {
  it("normalizes CRLF to LF", () => {
    const r = lineDiff("a\r\nb\r\nc", "a\nb\nc");
    expect(r.stats.added).toBe(0);
    expect(r.stats.deleted).toBe(0);
  });

  it("preserves line numbers on both sides", () => {
    const r = lineDiff("a\nb\nc", "a\nX\nc");
    const delLine = r.entries.find((e) => e.op === "delete");
    const addLine = r.entries.find((e) => e.op === "add");
    expect(delLine?.oldLine).toBe(2);
    expect(delLine?.newLine).toBeNull();
    expect(addLine?.oldLine).toBeNull();
    expect(addLine?.newLine).toBe(2);
  });

  it("handles multi-hunk diffs with gaps", () => {
    const a = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const b = a
      .replace("line 3", "CHANGE A")
      .replace("line 15", "CHANGE B");
    const r = lineDiff(a, b, { contextLines: 1 });
    expect(r.hunks.length).toBe(2);
  });

  it("merges nearby changes into a single hunk", () => {
    const r = lineDiff(
      "1\n2\n3\n4\n5",
      "1\nX\n3\nY\n5",
    );
    // Only 1 unchanged line between the two changes, less than 2*context+1=7
    expect(r.hunks.length).toBe(1);
    expect(r.stats.added).toBe(2);
    expect(r.stats.deleted).toBe(2);
  });
});

describe("lineDiff — formatUnifiedDiff", () => {
  it("produces git-style hunk headers", () => {
    const r = lineDiff("a\nb\nc", "a\nX\nc");
    const formatted = formatUnifiedDiff(r, { pathA: "old.ts", pathB: "new.ts" });
    expect(formatted).toContain("--- old.ts");
    expect(formatted).toContain("+++ new.ts");
    expect(formatted).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(formatted).toContain("-b");
    expect(formatted).toContain("+X");
  });

  it("skips header when paths omitted", () => {
    const r = lineDiff("a\nb", "a\nX");
    const formatted = formatUnifiedDiff(r);
    expect(formatted).not.toContain("---");
    expect(formatted).not.toContain("+++");
  });
});

describe("groupHunks — direct unit", () => {
  it("returns no hunks for all-equal input", () => {
    const r = lineDiff("a\nb", "a\nb");
    expect(groupHunks(r.entries)).toHaveLength(0);
  });

  it("respects contextLines parameter", () => {
    const a = Array.from({ length: 10 }, (_, i) => `${i}`).join("\n");
    const b = a.replace("5", "X");
    const r1 = lineDiff(a, b, { contextLines: 1 });
    const r3 = lineDiff(a, b, { contextLines: 3 });
    // Larger context → more entries per hunk
    expect(r1.hunks[0].entries.length).toBeLessThan(r3.hunks[0].entries.length);
  });
});

describe("lineDiff — similarity metric", () => {
  it("is 1 for identical strings", () => {
    expect(lineDiff("foo", "foo").stats.similarity).toBe(1);
  });
  it("is 0 for entirely disjoint files", () => {
    expect(lineDiff("a\nb\nc", "x\ny\nz").stats.similarity).toBe(0);
  });
  it("falls between 0 and 1 for partial overlap", () => {
    const s = lineDiff("a\nb\nc\nd", "a\nb\nX\nY").stats.similarity;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});
