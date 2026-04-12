import { describe, it, expect } from "vitest";
import {
  extractSymbolCitations,
  buildCitationContext,
  formatCitationOverlay,
} from "./symbolCitations";

describe("extractSymbolCitations", () => {
  it("returns an empty array for plain text", () => {
    expect(extractSymbolCitations("just a message")).toEqual([]);
  });

  it("extracts a single citation", () => {
    expect(
      extractSymbolCitations("explain [useAuth at hooks/useAuth.ts:42]"),
    ).toEqual([{ name: "useAuth", path: "hooks/useAuth.ts", line: 42 }]);
  });

  it("extracts multiple citations in order", () => {
    const out = extractSymbolCitations(
      "compare [Foo at a.ts:10] and [Bar at b.ts:20]",
    );
    expect(out).toEqual([
      { name: "Foo", path: "a.ts", line: 10 },
      { name: "Bar", path: "b.ts", line: 20 },
    ]);
  });

  it("dedupes identical citations", () => {
    const out = extractSymbolCitations(
      "[Foo at a.ts:10] and [Foo at a.ts:10] again",
    );
    expect(out).toHaveLength(1);
  });

  it("rejects malformed line numbers", () => {
    expect(extractSymbolCitations("[Foo at a.ts:abc]")).toEqual([]);
    expect(extractSymbolCitations("[Foo at a.ts:0]")).toEqual([]); // line >= 1
    expect(extractSymbolCitations("[Foo at a.ts:-5]")).toEqual([]);
  });

  it("rejects names that don't start with letter/_/$", () => {
    expect(extractSymbolCitations("[123 at a.ts:1]")).toEqual([]);
  });

  it("caps at 10 citations", () => {
    let input = "";
    for (let i = 0; i < 15; i++) input += `[Foo${i} at a.ts:${i + 1}] `;
    expect(extractSymbolCitations(input)).toHaveLength(10);
  });

  it("handles empty / null input gracefully", () => {
    expect(extractSymbolCitations("")).toEqual([]);
  });

  it("supports underscores and dollar signs in symbol names", () => {
    expect(
      extractSymbolCitations("[$myVar at file.ts:5]"),
    ).toEqual([{ name: "$myVar", path: "file.ts", line: 5 }]);
    expect(
      extractSymbolCitations("[my_func at file.ts:5]"),
    ).toEqual([{ name: "my_func", path: "file.ts", line: 5 }]);
  });
});

describe("buildCitationContext", () => {
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);

  it("returns the requested window centered on the cited line", () => {
    const ctx = buildCitationContext(
      lines,
      { name: "x", path: "f.ts", line: 50 },
      5,
      5,
    );
    expect(ctx?.startLine).toBe(45);
    expect(ctx?.context.split("\n")).toHaveLength(11); // 5 before + line + 5 after
    expect(ctx?.context).toContain("line 50");
  });

  it("clamps to start of file", () => {
    const ctx = buildCitationContext(
      lines,
      { name: "x", path: "f.ts", line: 2 },
      5,
      5,
    );
    expect(ctx?.startLine).toBe(1); // can't go below 1
  });

  it("clamps to end of file", () => {
    const ctx = buildCitationContext(
      lines,
      { name: "x", path: "f.ts", line: 99 },
      5,
      10,
    );
    // 10 lines after line 99 = lines 100, 101 ... but file only has 100
    expect(ctx?.context).toContain("line 100");
    expect(ctx?.context).not.toContain("line 101");
  });

  it("returns null for empty file content", () => {
    expect(
      buildCitationContext([], { name: "x", path: "f.ts", line: 1 }),
    ).toBeNull();
  });

  it("uses default before/after when not specified", () => {
    const ctx = buildCitationContext(lines, {
      name: "x",
      path: "f.ts",
      line: 50,
    });
    // Default is 5 before, 25 after = 31 total
    expect(ctx?.context.split("\n")).toHaveLength(31);
  });
});

describe("formatCitationOverlay", () => {
  it("formats a resolved citation with line range", () => {
    const out = formatCitationOverlay({
      name: "useAuth",
      path: "hooks/useAuth.ts",
      line: 42,
      resolved: true,
      context: "line one\nline two\nline three",
      startLine: 40,
    });
    expect(out).toContain("Cited symbol: useAuth at hooks/useAuth.ts:42");
    expect(out).toContain("lines 40-42");
    expect(out).toContain("line one");
    expect(out).toContain("line three");
  });

  it("formats an unresolved citation with the error", () => {
    const out = formatCitationOverlay({
      name: "useAuth",
      path: "hooks/useAuth.ts",
      line: 42,
      resolved: false,
      error: "file not found",
    });
    expect(out).toContain("error: file not found");
  });

  it("falls back to a default error message when resolved=false but no error", () => {
    const out = formatCitationOverlay({
      name: "useAuth",
      path: "hooks/useAuth.ts",
      line: 42,
      resolved: false,
    });
    expect(out).toContain("error: unresolved");
  });
});
