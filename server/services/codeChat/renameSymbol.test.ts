/**
 * Tests for rename-symbol refactor — Pass 257.
 */

import { describe, it, expect } from "vitest";
import {
  validateRename,
  replaceAllOccurrences,
  buildRenamePlan,
  planToBatchOps,
} from "./renameSymbol";

describe("validateRename", () => {
  it("accepts a valid identifier pair", () => {
    const out = validateRename("oldFoo", "newFoo");
    expect(out.ok).toBe(true);
    expect(out.issues).toEqual([]);
  });

  it("rejects identical names", () => {
    expect(validateRename("foo", "foo").ok).toBe(false);
  });

  it("rejects too-short names", () => {
    expect(validateRename("a", "b").ok).toBe(false);
  });

  it("rejects invalid identifier chars", () => {
    expect(validateRename("foo-bar", "foo.baz").ok).toBe(false);
  });

  it("rejects reserved words", () => {
    const out = validateRename("foo", "return");
    expect(out.ok).toBe(false);
    expect(out.issues.some((i) => i.includes("reserved"))).toBe(true);
  });

  it("rejects names starting with a digit", () => {
    expect(validateRename("foo", "1foo").ok).toBe(false);
  });

  it("allows $ and _ starts", () => {
    expect(validateRename("foo", "_bar").ok).toBe(true);
    expect(validateRename("foo", "$bar").ok).toBe(true);
  });
});

describe("replaceAllOccurrences", () => {
  it("returns unchanged on no match", () => {
    const out = replaceAllOccurrences("hello world", "foo", "bar");
    expect(out.content).toBe("hello world");
    expect(out.replacements).toBe(0);
  });

  it("replaces whole-word matches", () => {
    const out = replaceAllOccurrences("foo + foo", "foo", "bar");
    expect(out.content).toBe("bar + bar");
    expect(out.replacements).toBe(2);
  });

  it("respects word boundaries", () => {
    const out = replaceAllOccurrences("foobar + foo + foozilla", "foo", "bar");
    expect(out.content).toBe("foobar + bar + foozilla");
    expect(out.replacements).toBe(1);
  });

  it("handles multi-line source", () => {
    const out = replaceAllOccurrences(
      "const foo = 1;\nexport { foo };\nreturn foo;",
      "foo",
      "bar",
    );
    expect(out.replacements).toBe(3);
    expect(out.content).toContain("const bar =");
    expect(out.content).toContain("export { bar }");
  });

  it("is case-sensitive", () => {
    const out = replaceAllOccurrences("Foo + foo", "foo", "bar");
    expect(out.replacements).toBe(1);
    expect(out.content).toBe("Foo + bar");
  });

  it("empty source returns empty", () => {
    expect(replaceAllOccurrences("", "foo", "bar").content).toBe("");
  });
});

describe("buildRenamePlan", () => {
  it("returns empty plan when validation fails", () => {
    const plan = buildRenamePlan({
      oldName: "foo",
      newName: "foo",
      files: [{ path: "a.ts", content: "foo" }],
    });
    expect(plan.entries).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it("builds an entry per file with hits", () => {
    const plan = buildRenamePlan({
      oldName: "oldName",
      newName: "newName",
      files: [
        { path: "a.ts", content: "const oldName = 1; return oldName;" },
        { path: "b.ts", content: "const other = 1;" },
      ],
    });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].path).toBe("a.ts");
    expect(plan.entries[0].replacements).toBe(2);
    expect(plan.entries[0].after).toContain("newName");
    expect(plan.skipped.some((s) => s.path === "b.ts")).toBe(true);
  });

  it("captures before + after snapshots", () => {
    const plan = buildRenamePlan({
      oldName: "foo",
      newName: "bar",
      files: [{ path: "a.ts", content: "const foo = 1;" }],
    });
    expect(plan.entries[0].before).toBe("const foo = 1;");
    expect(plan.entries[0].after).toBe("const bar = 1;");
  });

  it("respects includeComments: false", () => {
    const plan = buildRenamePlan({
      oldName: "foo",
      newName: "bar",
      includeComments: false,
      files: [
        { path: "a.ts", content: "// foo is great\nconst foo = 1;" },
      ],
    });
    // Hits counted ignore comments
    expect(plan.entries[0].hits).toHaveLength(1);
    // But replacement still happens everywhere (comment gets renamed)
    expect(plan.entries[0].replacements).toBe(2);
  });

  it("summary aggregates across files", () => {
    const plan = buildRenamePlan({
      oldName: "foo",
      newName: "bar",
      files: [
        { path: "a.ts", content: "foo foo foo" },
        { path: "b.ts", content: "foo + 1" },
      ],
    });
    expect(plan.summary.fileCount).toBe(2);
    expect(plan.summary.totalReplacements).toBe(4);
  });
});

describe("planToBatchOps", () => {
  it("produces one write op per entry", () => {
    const plan = buildRenamePlan({
      oldName: "foo",
      newName: "bar",
      files: [
        { path: "a.ts", content: "foo" },
        { path: "b.ts", content: "foo" },
      ],
    });
    const ops = planToBatchOps(plan);
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.kind === "write")).toBe(true);
    expect(ops[0].content).toBe("bar");
  });
});
