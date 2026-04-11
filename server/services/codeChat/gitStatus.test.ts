/**
 * Tests for gitStatus.ts parser (Pass 244).
 */

import { describe, it, expect } from "vitest";
import { parseGitStatusPorcelain, summarizeGitStatus } from "./gitStatus";

describe("parseGitStatusPorcelain", () => {
  it("returns empty for empty input", () => {
    expect(parseGitStatusPorcelain("")).toEqual([]);
  });

  it("parses a modified file (unstaged)", () => {
    const out = ` M src/foo.ts`;
    const entries = parseGitStatusPorcelain(out);
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("src/foo.ts");
    expect(entries[0].staged).toBe("unknown");
    expect(entries[0].worktree).toBe("modified");
    expect(entries[0].dirty).toBe(true);
  });

  it("parses a modified file (staged)", () => {
    const entries = parseGitStatusPorcelain(`M  src/foo.ts`);
    expect(entries[0].staged).toBe("modified");
    expect(entries[0].worktree).toBe("unknown");
  });

  it("parses modified in both index and worktree", () => {
    const entries = parseGitStatusPorcelain(`MM src/foo.ts`);
    expect(entries[0].staged).toBe("modified");
    expect(entries[0].worktree).toBe("modified");
  });

  it("parses added file", () => {
    const entries = parseGitStatusPorcelain(`A  new.ts`);
    expect(entries[0].staged).toBe("added");
  });

  it("parses deleted file", () => {
    const entries = parseGitStatusPorcelain(` D gone.ts`);
    expect(entries[0].worktree).toBe("deleted");
  });

  it("parses untracked file (both X and Y are '?')", () => {
    const entries = parseGitStatusPorcelain(`?? new-untracked.ts`);
    expect(entries[0].staged).toBe("untracked");
    expect(entries[0].worktree).toBe("untracked");
  });

  it("parses renamed file", () => {
    const entries = parseGitStatusPorcelain(`R  old.ts -> new.ts`);
    expect(entries[0].path).toBe("new.ts");
    expect(entries[0].originalPath).toBe("old.ts");
    expect(entries[0].staged).toBe("renamed");
  });

  it("parses copied file", () => {
    const entries = parseGitStatusPorcelain(`C  src.ts -> dst.ts`);
    expect(entries[0].staged).toBe("copied");
    expect(entries[0].originalPath).toBe("src.ts");
    expect(entries[0].path).toBe("dst.ts");
  });

  it("parses conflicted file", () => {
    const entries = parseGitStatusPorcelain(`UU conflict.ts`);
    expect(entries[0].staged).toBe("conflicted");
    expect(entries[0].worktree).toBe("conflicted");
  });

  it("parses multiple lines", () => {
    const out = [
      ` M a.ts`,
      `M  b.ts`,
      `?? c.ts`,
      `R  old.ts -> new.ts`,
    ].join("\n");
    const entries = parseGitStatusPorcelain(out);
    expect(entries).toHaveLength(4);
  });

  it("skips short/invalid lines", () => {
    const out = `abc\n\n M foo.ts\n?`;
    const entries = parseGitStatusPorcelain(out);
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("foo.ts");
  });

  it("requires a space in position 2", () => {
    // Invalid: no space separator
    expect(parseGitStatusPorcelain("MMfoo.ts")).toHaveLength(0);
  });
});

describe("summarizeGitStatus", () => {
  it("returns zero counts for empty list", () => {
    const s = summarizeGitStatus([]);
    expect(s.total).toBe(0);
    expect(s.modified).toBe(0);
  });

  it("counts modified files", () => {
    const entries = parseGitStatusPorcelain(` M a.ts\n M b.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.modified).toBe(2);
    expect(s.total).toBe(2);
  });

  it("counts untracked separately", () => {
    const entries = parseGitStatusPorcelain(`?? new.ts\n M old.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.untracked).toBe(1);
    expect(s.modified).toBe(1);
  });

  it("counts conflicts first when dual-state", () => {
    const entries = parseGitStatusPorcelain(`UU conflict.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.conflicted).toBe(1);
  });

  it("counts rename once", () => {
    const entries = parseGitStatusPorcelain(`R  old.ts -> new.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.renamed).toBe(1);
  });

  it("counts added separately from modified", () => {
    const entries = parseGitStatusPorcelain(`A  new.ts\n M old.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.added).toBe(1);
    expect(s.modified).toBe(1);
  });

  it("counts deleted files", () => {
    const entries = parseGitStatusPorcelain(` D gone.ts`);
    const s = summarizeGitStatus(entries);
    expect(s.deleted).toBe(1);
  });
});
