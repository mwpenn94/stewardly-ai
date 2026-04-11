/**
 * Tests for the TypeScript diagnostics parser — Pass 251.
 */

import { describe, it, expect } from "vitest";
import {
  parseTscOutput,
  summarizeDiagnostics,
  filterDiagnostics,
  groupByFile,
} from "./diagnostics";

describe("parseTscOutput", () => {
  it("returns empty for empty input", () => {
    expect(parseTscOutput("")).toEqual([]);
  });

  it("parses a single error line", () => {
    const raw = `client/src/App.tsx(42,15): error TS2304: Cannot find name 'Foo'.`;
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      path: "client/src/App.tsx",
      line: 42,
      column: 15,
      severity: "error",
      code: "TS2304",
      message: "Cannot find name 'Foo'.",
      details: [],
    });
  });

  it("parses a warning", () => {
    const raw = `server/index.ts(1,1): warning TS6031: Unused.`;
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
  });

  it("attaches continuation lines as details", () => {
    const raw = [
      `src/foo.ts(10,5): error TS2322: Type 'X' is not assignable to type 'Y'.`,
      `  Property 'bar' is missing in type 'X'.`,
      `  Required property 'bar' exists in type 'Y'.`,
    ].join("\n");
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(1);
    expect(out[0].details).toHaveLength(2);
    expect(out[0].details[0]).toBe("Property 'bar' is missing in type 'X'.");
  });

  it("empty line between diagnostics ends the details window", () => {
    const raw = [
      `a.ts(1,1): error TS0001: first.`,
      `  detail of first`,
      ``,
      `  orphan`,
      `b.ts(2,2): error TS0002: second.`,
    ].join("\n");
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(2);
    expect(out[0].details).toEqual(["detail of first"]);
    expect(out[1].details).toEqual([]);
  });

  it("handles multiple diagnostics across many files", () => {
    const raw = [
      `a.ts(1,1): error TS1: err1.`,
      `b.ts(2,2): error TS2: err2.`,
      `c.ts(3,3): warning TS3: warn3.`,
    ].join("\n");
    const out = parseTscOutput(raw);
    expect(out.map((d) => d.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(out[2].severity).toBe("warning");
  });

  it("handles Windows-style paths with drive letters", () => {
    const raw = `C:\\proj\\src\\a.ts(5,10): error TS1: boom.`;
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("C:\\proj\\src\\a.ts");
    expect(out[0].line).toBe(5);
    expect(out[0].column).toBe(10);
  });

  it("handles CRLF line endings", () => {
    const raw = `a.ts(1,1): error TS1: first.\r\nb.ts(2,2): error TS2: second.\r\n`;
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(2);
  });

  it("ignores bare non-header lines at the top", () => {
    const raw = [
      `Starting compilation...`,
      `a.ts(1,1): error TS1: boom.`,
    ].join("\n");
    const out = parseTscOutput(raw);
    expect(out).toHaveLength(1);
  });

  it("preserves the full message text", () => {
    const raw = `a.ts(1,1): error TS2322: Type '{ a: number; b: string; }' is not assignable to type 'never'.`;
    const out = parseTscOutput(raw);
    expect(out[0].message).toContain("Type '{ a: number");
    expect(out[0].message).toContain("not assignable");
  });
});

describe("summarizeDiagnostics", () => {
  it("returns zeros on empty input", () => {
    const s = summarizeDiagnostics([]);
    expect(s.total).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.fileCount).toBe(0);
    expect(s.topFiles).toEqual([]);
  });

  it("counts errors / warnings / info separately", () => {
    const diags = [
      { path: "a.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "a.ts", line: 2, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "b.ts", line: 1, column: 1, severity: "warning" as const, code: "TS2", message: "", details: [] },
      { path: "c.ts", line: 1, column: 1, severity: "info" as const, code: "TS3", message: "", details: [] },
    ];
    const s = summarizeDiagnostics(diags);
    expect(s.total).toBe(4);
    expect(s.errors).toBe(2);
    expect(s.warnings).toBe(1);
    expect(s.info).toBe(1);
    expect(s.fileCount).toBe(3);
  });

  it("topFiles is sorted by count descending then alphabetically", () => {
    const diags = [
      { path: "z.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "a.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "a.ts", line: 2, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "m.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
    ];
    const s = summarizeDiagnostics(diags);
    expect(s.topFiles[0]).toEqual({ path: "a.ts", count: 2 });
    expect(s.topFiles[1].path).toBe("m.ts");
  });
});

describe("filterDiagnostics", () => {
  const sample = [
    { path: "src/a.ts", line: 1, column: 1, severity: "error" as const, code: "TS2304", message: "Cannot find name", details: [] },
    { path: "src/b.ts", line: 2, column: 1, severity: "warning" as const, code: "TS6133", message: "Unused", details: [] },
    { path: "server/x.ts", line: 1, column: 1, severity: "error" as const, code: "TS2322", message: "Type mismatch", details: [] },
  ];

  it("filters by severity", () => {
    expect(filterDiagnostics(sample, { severity: "error" })).toHaveLength(2);
    expect(filterDiagnostics(sample, { severity: "warning" })).toHaveLength(1);
    expect(filterDiagnostics(sample, { severity: "all" })).toHaveLength(3);
  });

  it("filters by path prefix", () => {
    expect(filterDiagnostics(sample, { pathPrefix: "src/" })).toHaveLength(2);
    expect(filterDiagnostics(sample, { pathPrefix: "server/" })).toHaveLength(1);
  });

  it("filters by search (message or code or path)", () => {
    expect(filterDiagnostics(sample, { search: "unused" })).toHaveLength(1);
    expect(filterDiagnostics(sample, { search: "TS2304" })).toHaveLength(1);
    expect(filterDiagnostics(sample, { search: "a.ts" })).toHaveLength(1);
  });

  it("composes multiple filters", () => {
    const out = filterDiagnostics(sample, {
      severity: "error",
      pathPrefix: "src/",
    });
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("src/a.ts");
  });

  it("search matches against detail lines", () => {
    const withDetails = [
      {
        path: "a.ts",
        line: 1,
        column: 1,
        severity: "error" as const,
        code: "TS1",
        message: "boom",
        details: ["something about readonly"],
      },
    ];
    expect(filterDiagnostics(withDetails, { search: "readonly" })).toHaveLength(1);
  });
});

describe("groupByFile", () => {
  it("groups by path", () => {
    const diags = [
      { path: "a.ts", line: 2, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "a.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
      { path: "b.ts", line: 1, column: 1, severity: "warning" as const, code: "TS2", message: "", details: [] },
    ];
    const groups = groupByFile(diags);
    expect(groups).toHaveLength(2);
    expect(groups[0].path).toBe("a.ts");
    expect(groups[0].diagnostics).toHaveLength(2);
    // sorted by line number within a file
    expect(groups[0].diagnostics[0].line).toBe(1);
  });

  it("puts files with most errors first", () => {
    const diags = [
      { path: "warn.ts", line: 1, column: 1, severity: "warning" as const, code: "TS1", message: "", details: [] },
      { path: "warn.ts", line: 2, column: 1, severity: "warning" as const, code: "TS1", message: "", details: [] },
      { path: "warn.ts", line: 3, column: 1, severity: "warning" as const, code: "TS1", message: "", details: [] },
      { path: "err.ts", line: 1, column: 1, severity: "error" as const, code: "TS1", message: "", details: [] },
    ];
    const groups = groupByFile(diags);
    expect(groups[0].path).toBe("err.ts");
  });
});
