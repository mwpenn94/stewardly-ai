import { describe, it, expect } from "vitest";
import {
  parseTscOutput,
  parseEslintJson,
  groupByFile,
  summarizeDiagnostics,
  filterDiagnostics,
} from "./diagnostics";

describe("diagnostics — parseTscOutput", () => {
  it("parses a single error line", () => {
    const out = parseTscOutput(
      "client/src/foo.ts(12,34): error TS2345: Argument of type 'string' is not assignable.",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("tsc");
    expect(out[0]!.severity).toBe("error");
    expect(out[0]!.path).toBe("client/src/foo.ts");
    expect(out[0]!.line).toBe(12);
    expect(out[0]!.column).toBe(34);
    expect(out[0]!.code).toBe("TS2345");
    expect(out[0]!.message).toMatch(/Argument of type/);
  });

  it("parses warning + info severities", () => {
    const out = parseTscOutput(
      [
        "a.ts(1,1): warning TS6123: Deprecated.",
        "b.ts(2,2): info TS6133: Nothing special.",
      ].join("\n"),
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.severity).toBe("warning");
    expect(out[1]!.severity).toBe("info");
  });

  it("drops non-matching lines silently", () => {
    const out = parseTscOutput(
      [
        "Starting compilation in watch mode...",
        "client/src/foo.ts(1,1): error TS2345: Real error.",
        "",
        "Found 1 error. Watching for file changes.",
      ].join("\n"),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.code).toBe("TS2345");
  });

  it("normalizes Windows-style separators", () => {
    const out = parseTscOutput(
      "client\\src\\foo.ts(1,1): error TS2345: X.",
    );
    expect(out[0]!.path).toBe("client/src/foo.ts");
  });

  it("handles multiple errors on the same file", () => {
    const out = parseTscOutput(
      [
        "a.ts(1,1): error TS1: one",
        "a.ts(2,1): error TS2: two",
        "a.ts(3,1): error TS3: three",
      ].join("\n"),
    );
    expect(out).toHaveLength(3);
  });

  it("returns empty array on empty input", () => {
    expect(parseTscOutput("")).toHaveLength(0);
  });

  it("handles messages containing colons and parens", () => {
    const out = parseTscOutput(
      "a.ts(1,1): error TS2345: Type 'a: b' is not assignable to 'c: d'.",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toContain("Type 'a: b'");
  });
});

describe("diagnostics — parseEslintJson", () => {
  it("parses a valid eslint JSON array", () => {
    const raw = JSON.stringify([
      {
        filePath: "/workspace/foo.ts",
        messages: [
          {
            ruleId: "no-unused-vars",
            severity: 2,
            message: "unused",
            line: 1,
            column: 1,
          },
          {
            ruleId: "prefer-const",
            severity: 1,
            message: "use const",
            line: 5,
            column: 3,
          },
        ],
      },
    ]);
    const out = parseEslintJson(raw, "/workspace");
    expect(out).toHaveLength(2);
    expect(out[0]!.severity).toBe("error");
    expect(out[0]!.path).toBe("foo.ts");
    expect(out[1]!.severity).toBe("warning");
    expect(out[1]!.code).toBe("prefer-const");
  });

  it("returns empty on malformed JSON", () => {
    expect(parseEslintJson("not json")).toHaveLength(0);
  });

  it("returns empty on non-array root", () => {
    expect(parseEslintJson(JSON.stringify({ foo: "bar" }))).toHaveLength(0);
  });

  it("skips files with no messages", () => {
    const raw = JSON.stringify([
      { filePath: "/ws/a.ts", messages: [] },
      { filePath: "/ws/b.ts", messages: [] },
    ]);
    expect(parseEslintJson(raw)).toHaveLength(0);
  });
});

describe("diagnostics — groupByFile", () => {
  const diags = parseTscOutput(
    [
      "a.ts(1,1): error TS1: one",
      "a.ts(2,1): error TS2: two",
      "b.ts(1,1): warning TS3: warn",
      "c.ts(1,1): error TS4: four",
    ].join("\n"),
  );

  it("groups by path", () => {
    const groups = groupByFile(diags);
    expect(groups).toHaveLength(3);
    const byPath = new Map(groups.map((g) => [g.path, g]));
    expect(byPath.get("a.ts")!.diagnostics).toHaveLength(2);
    expect(byPath.get("b.ts")!.diagnostics).toHaveLength(1);
  });

  it("sorts groups with most errors first", () => {
    const groups = groupByFile(diags);
    expect(groups[0]!.path).toBe("a.ts"); // 2 errors
    // b.ts (1 warning) and c.ts (1 error) — c.ts has more errors, should be second
    expect(groups[1]!.path).toBe("c.ts");
    expect(groups[2]!.path).toBe("b.ts");
  });

  it("sorts diagnostics inside a bucket by line then column", () => {
    const out = parseTscOutput(
      [
        "a.ts(5,1): error TS1: x",
        "a.ts(2,3): error TS2: y",
        "a.ts(2,1): error TS3: z",
      ].join("\n"),
    );
    const groups = groupByFile(out);
    expect(groups[0]!.diagnostics.map((d) => `${d.line}:${d.column}`)).toEqual([
      "2:1",
      "2:3",
      "5:1",
    ]);
  });
});

describe("diagnostics — summarizeDiagnostics", () => {
  const diags = parseTscOutput(
    [
      "a.ts(1,1): error TS2345: one",
      "a.ts(2,1): error TS2345: two",
      "b.ts(1,1): warning TS6123: warn",
      "c.ts(1,1): error TS2345: four",
    ].join("\n"),
  );

  it("counts by severity", () => {
    const s = summarizeDiagnostics(diags);
    expect(s.total).toBe(4);
    expect(s.errors).toBe(3);
    expect(s.warnings).toBe(1);
    expect(s.infos).toBe(0);
  });

  it("counts distinct files", () => {
    expect(summarizeDiagnostics(diags).filesAffected).toBe(3);
  });

  it("returns top rules sorted by count", () => {
    const s = summarizeDiagnostics(diags);
    expect(s.topRules[0]!.code).toBe("TS2345");
    expect(s.topRules[0]!.count).toBe(3);
  });
});

describe("diagnostics — filterDiagnostics", () => {
  const diags = parseTscOutput(
    [
      "client/src/a.ts(1,1): error TS2345: type mismatch here",
      "client/src/b.ts(1,1): warning TS6133: unused variable",
      "server/x.ts(1,1): error TS2304: cannot find name foo",
    ].join("\n"),
  );

  it("filters by severity", () => {
    const out = filterDiagnostics(diags, { severity: ["error"] });
    expect(out).toHaveLength(2);
  });

  it("filters by path prefix", () => {
    const out = filterDiagnostics(diags, { pathPrefix: "client/" });
    expect(out).toHaveLength(2);
  });

  it("filters by code", () => {
    const out = filterDiagnostics(diags, { code: "TS2345" });
    expect(out).toHaveLength(1);
  });

  it("filters by free-text search across message/code/path", () => {
    expect(filterDiagnostics(diags, { search: "unused" })).toHaveLength(1);
    expect(filterDiagnostics(diags, { search: "server" })).toHaveLength(1);
    expect(filterDiagnostics(diags, { search: "ts2304" })).toHaveLength(1);
  });

  it("composes multiple filters", () => {
    const out = filterDiagnostics(diags, {
      severity: ["error"],
      pathPrefix: "client/",
    });
    expect(out).toHaveLength(1);
  });
});
