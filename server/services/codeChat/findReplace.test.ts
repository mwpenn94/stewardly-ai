import { describe, it, expect } from "vitest";
import {
  compilePattern,
  previewFile,
  aggregateWorkspacePreview,
  buildApplyPlan,
  type FindReplaceOptions,
  type FilePreview,
} from "./findReplace";

const opts = (over: Partial<FindReplaceOptions> = {}): FindReplaceOptions => ({
  find: "foo",
  replace: "bar",
  ...over,
});

describe("findReplace — compilePattern", () => {
  it("returns a case-insensitive regex by default", () => {
    const re = compilePattern(opts({ find: "FOO" }));
    expect("foo".match(re)?.length).toBe(1);
  });

  it("respects caseSensitive flag", () => {
    const re = compilePattern(opts({ find: "FOO", caseSensitive: true }));
    expect("foo".match(re)).toBeNull();
    expect("FOO".match(re)?.length).toBe(1);
  });

  it("escapes regex metacharacters in literal mode", () => {
    const re = compilePattern(opts({ find: "a.b" }));
    expect("a.b".match(re)?.length).toBe(1);
    expect("axb".match(re)).toBeNull();
  });

  it("passes regex body through in regex mode", () => {
    const re = compilePattern(opts({ find: "a.b", regex: true }));
    expect("axb".match(re)?.length).toBe(1);
  });

  it("adds word boundaries with wholeWord", () => {
    const re = compilePattern(opts({ find: "foo", wholeWord: true }));
    expect("foo bar".match(re)?.length).toBe(1);
    expect("foobar".match(re)).toBeNull();
  });

  it("throws on empty pattern", () => {
    expect(() => compilePattern(opts({ find: "" }))).toThrow();
  });

  it("throws on invalid regex body", () => {
    expect(() => compilePattern(opts({ find: "(", regex: true }))).toThrow();
  });
});

describe("findReplace — previewFile", () => {
  it("returns null when a file has no matches", () => {
    const p = previewFile("a.ts", "nothing here", opts());
    expect(p).toBeNull();
  });

  it("collects line/column for every match", () => {
    const content = "foo\nbar\nfoo bar foo\n";
    const p = previewFile("a.ts", content, opts())!;
    expect(p.matches.length).toBe(3);
    expect(p.matches[0]!.line).toBe(1);
    expect(p.matches[0]!.column).toBe(0);
    expect(p.matches[1]!.line).toBe(3);
    expect(p.matches[1]!.column).toBe(0);
    expect(p.matches[2]!.line).toBe(3);
    expect(p.matches[2]!.column).toBe(8);
  });

  it("builds correct before/after diffed lines", () => {
    const p = previewFile("a.ts", "const foo = 1", opts())!;
    expect(p.matches[0]!.before).toBe("const foo = 1");
    expect(p.matches[0]!.after).toBe("const bar = 1");
  });

  it("produces replaced newContent preserving line terminators", () => {
    const crlf = "foo\r\nbar\r\n";
    const p = previewFile("a.ts", crlf, opts())!;
    expect(p.newContent).toBe("bar\r\nbar\r\n");
  });

  it("supports $1 capture group expansion in regex mode", () => {
    const p = previewFile(
      "a.ts",
      "const abc = 1",
      opts({ find: "const (\\w+)", replace: "let $1", regex: true }),
    )!;
    expect(p.newContent).toBe("let abc = 1");
  });

  it("tracks delta bytes", () => {
    const p = previewFile("a.ts", "foo", opts({ find: "foo", replace: "hello" }))!;
    expect(p.delta.added).toBe(2);
    expect(p.delta.removed).toBe(0);
  });

  it("caps matches at perFileLimit and marks truncated", () => {
    const content = Array.from({ length: 500 }, () => "foo").join("\n");
    const p = previewFile("a.ts", content, opts({ perFileLimit: 10 }))!;
    expect(p.matches.length).toBe(10);
    expect(p.truncated).toBe(true);
  });

  it("handles whole-word matching", () => {
    const p = previewFile(
      "a.ts",
      "foo foobar foo",
      opts({ wholeWord: true }),
    )!;
    expect(p.matches.length).toBe(2);
  });
});

describe("findReplace — aggregateWorkspacePreview", () => {
  const mk = (path: string, count: number): FilePreview => ({
    path,
    matches: Array.from({ length: count }, (_, i) => ({
      line: i + 1,
      column: 0,
      match: "foo",
      before: "foo",
      after: "bar",
    })),
    truncated: false,
    newContent: "bar",
    delta: { removed: 0, added: 0 },
  });

  it("skips nulls and counts files", () => {
    const w = aggregateWorkspacePreview(
      opts(),
      [mk("a.ts", 3), null, mk("b.ts", 5)],
      3,
    );
    expect(w.totals.filesMatched).toBe(2);
    expect(w.totals.filesScanned).toBe(3);
    expect(w.totals.totalMatches).toBe(8);
  });

  it("truncates at workspaceLimit", () => {
    const w = aggregateWorkspacePreview(
      opts(),
      [mk("a.ts", 40), mk("b.ts", 40), mk("c.ts", 40)],
      3,
      60,
    );
    expect(w.totals.totalMatches).toBe(60);
    expect(w.totals.workspaceTruncated).toBe(true);
    expect(w.files.length).toBeLessThanOrEqual(3);
  });

  it("counts per-file truncated flag", () => {
    const truncatedFile = { ...mk("a.ts", 5), truncated: true };
    const w = aggregateWorkspacePreview(opts(), [truncatedFile], 1);
    expect(w.totals.filesTruncated).toBe(1);
  });
});

describe("findReplace — buildApplyPlan", () => {
  const mk = (path: string): FilePreview => ({
    path,
    matches: [{ line: 1, column: 0, match: "foo", before: "foo", after: "bar" }],
    truncated: false,
    newContent: `new content for ${path}`,
    delta: { removed: 0, added: 0 },
  });

  it("builds writes for accepted paths only", () => {
    const plan = buildApplyPlan({
      acceptPaths: ["a.ts"],
      preview: {
        options: opts(),
        files: [mk("a.ts"), mk("b.ts")],
        totals: {
          filesMatched: 2,
          filesScanned: 2,
          totalMatches: 2,
          workspaceTruncated: false,
          filesTruncated: 0,
        },
      },
    });
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]!.path).toBe("a.ts");
    expect(plan.writes[0]!.content).toBe("new content for a.ts");
  });

  it("reports unknown paths as skipped", () => {
    const plan = buildApplyPlan({
      acceptPaths: ["a.ts", "missing.ts"],
      preview: {
        options: opts(),
        files: [mk("a.ts")],
        totals: {
          filesMatched: 1,
          filesScanned: 1,
          totalMatches: 1,
          workspaceTruncated: false,
          filesTruncated: 0,
        },
      },
    });
    expect(plan.writes).toHaveLength(1);
    expect(plan.skippedUnknown).toEqual(["missing.ts"]);
  });

  it("sorts writes deterministically", () => {
    const plan = buildApplyPlan({
      acceptPaths: ["z.ts", "a.ts", "m.ts"],
      preview: {
        options: opts(),
        files: [mk("z.ts"), mk("a.ts"), mk("m.ts")],
        totals: {
          filesMatched: 3,
          filesScanned: 3,
          totalMatches: 3,
          workspaceTruncated: false,
          filesTruncated: 0,
        },
      },
    });
    expect(plan.writes.map((w) => w.path)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });
});
