import { describe, it, expect } from "vitest";
import {
  detectDeadCode,
  isEntrypoint,
  groupByPath,
  summarizeDeadCode,
} from "./deadCode";
import type { SymbolIndex, SymbolEntry } from "./symbolIndex";
import type { ImportGraph } from "./importGraph";

function mkSym(over: Partial<SymbolEntry> = {}): SymbolEntry {
  return {
    name: "foo",
    kind: "function",
    path: "src/foo.ts",
    line: 1,
    snippet: "export function foo() {}",
    exported: true,
    ...over,
  };
}

function mkIndex(symbols: SymbolEntry[]): SymbolIndex {
  const byName = new Map<string, number[]>();
  for (let i = 0; i < symbols.length; i++) {
    const lc = symbols[i]!.name.toLowerCase();
    const arr = byName.get(lc) ?? [];
    arr.push(i);
    byName.set(lc, arr);
  }
  return { symbols, byName, generatedAt: Date.now() };
}

function mkGraph(
  outgoing: Record<string, string[]> = {},
  incoming: Record<string, string[]> = {},
): ImportGraph {
  const out = new Map(Object.entries(outgoing));
  const inc = new Map(Object.entries(incoming));
  return {
    outgoing: out,
    incoming: inc,
    unresolved: new Map(),
    edgeCount: 0,
  };
}

describe("deadCode — isEntrypoint", () => {
  it("recognizes common entrypoints", () => {
    expect(isEntrypoint("client/src/App.tsx")).toBe(true);
    expect(isEntrypoint("client/src/main.tsx")).toBe(true);
    expect(isEntrypoint("server/_core/index.ts")).toBe(true);
    expect(isEntrypoint("vite.config.ts")).toBe(true);
    expect(isEntrypoint("drizzle.config.ts")).toBe(true);
    expect(isEntrypoint("client/src/routes/foo.ts")).toBe(true);
    expect(isEntrypoint("client/src/pages/HomePage.tsx")).toBe(true);
  });

  it("does not flag regular modules", () => {
    expect(isEntrypoint("server/services/foo.ts")).toBe(false);
    expect(isEntrypoint("client/src/components/Button.tsx")).toBe(false);
  });
});

describe("deadCode — detectDeadCode", () => {
  it("flags exports in files with no inbound imports", () => {
    const index = mkIndex([
      mkSym({ name: "deadFn", path: "src/orphan.ts" }),
      mkSym({
        name: "liveFn",
        path: "src/live.ts",
      }),
    ]);
    const graph = mkGraph(
      { "src/live.ts": [] },
      { "src/live.ts": ["src/other.ts"] },
    );
    const report = detectDeadCode(index, graph);
    expect(report.entries.map((e) => e.name)).toEqual(["deadFn"]);
    expect(report.orphanFiles).toContain("src/orphan.ts");
    expect(report.orphanFiles).not.toContain("src/live.ts");
  });

  it("skips entrypoint files", () => {
    const index = mkIndex([
      mkSym({ name: "ep", path: "client/src/App.tsx" }),
    ]);
    const report = detectDeadCode(index, mkGraph());
    expect(report.entries).toHaveLength(0);
    expect(report.skippedEntrypoints).toBe(1);
  });

  it("skips non-exported symbols", () => {
    const index = mkIndex([
      mkSym({ name: "internal", path: "src/foo.ts", exported: false }),
      mkSym({ name: "exported", path: "src/foo.ts", exported: true }),
    ]);
    const report = detectDeadCode(index, mkGraph());
    // Only the exported symbol should be counted
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]!.name).toBe("exported");
    expect(report.totalExports).toBe(1);
  });

  it("returns empty when all files are imported", () => {
    const index = mkIndex([
      mkSym({ name: "a", path: "src/a.ts" }),
      mkSym({ name: "b", path: "src/b.ts" }),
    ]);
    const graph = mkGraph(
      {},
      {
        "src/a.ts": ["src/c.ts"],
        "src/b.ts": ["src/d.ts"],
      },
    );
    const report = detectDeadCode(index, graph);
    expect(report.entries).toHaveLength(0);
    expect(report.orphanFiles).toHaveLength(0);
  });

  it("honors the entry limit", () => {
    const symbols: SymbolEntry[] = [];
    for (let i = 0; i < 100; i++) {
      symbols.push(mkSym({ name: `fn${i}`, path: `src/dead${i}.ts` }));
    }
    const report = detectDeadCode(mkIndex(symbols), mkGraph(), { limit: 10 });
    expect(report.entries.length).toBeLessThanOrEqual(10);
  });

  it("sorts entries by path then line", () => {
    const index = mkIndex([
      mkSym({ name: "a", path: "src/b.ts", line: 10 }),
      mkSym({ name: "b", path: "src/a.ts", line: 20 }),
      mkSym({ name: "c", path: "src/a.ts", line: 5 }),
    ]);
    const report = detectDeadCode(index, mkGraph());
    expect(report.entries.map((e) => `${e.path}:${e.line}`)).toEqual([
      "src/a.ts:5",
      "src/a.ts:20",
      "src/b.ts:10",
    ]);
  });
});

describe("deadCode — groupByPath", () => {
  it("buckets entries by file path", () => {
    const groups = groupByPath([
      { name: "a", kind: "function", path: "x.ts", line: 1, snippet: "", fileImported: false },
      { name: "b", kind: "function", path: "x.ts", line: 10, snippet: "", fileImported: false },
      { name: "c", kind: "function", path: "y.ts", line: 1, snippet: "", fileImported: false },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.path).toBe("x.ts");
    expect(groups[0]!.entries).toHaveLength(2);
  });
});

describe("deadCode — summarizeDeadCode", () => {
  it("counts entries by kind", () => {
    const summary = summarizeDeadCode({
      entries: [
        { name: "a", kind: "function", path: "x.ts", line: 1, snippet: "", fileImported: false },
        { name: "b", kind: "class", path: "y.ts", line: 1, snippet: "", fileImported: false },
        { name: "c", kind: "function", path: "z.ts", line: 1, snippet: "", fileImported: false },
      ],
      orphanFiles: ["x.ts", "y.ts", "z.ts"],
      totalExports: 10,
      skippedEntrypoints: 2,
    });
    expect(summary.deadEntries).toBe(3);
    expect(summary.byKind.function).toBe(2);
    expect(summary.byKind.class).toBe(1);
    expect(summary.orphanFiles).toBe(3);
    expect(summary.totalExports).toBe(10);
    expect(summary.skippedEntrypoints).toBe(2);
  });
});
