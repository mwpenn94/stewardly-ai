/**
 * Tests for circularDeps.ts (Pass 247).
 */

import { describe, it, expect } from "vitest";
import { buildImportGraph } from "./importGraph";
import { findCycles, summarizeCycles } from "./circularDeps";

describe("findCycles", () => {
  it("returns empty for acyclic graph", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `export const b = 1;` },
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("detects a 2-file cycle", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import a from "./a";` },
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].size).toBe(2);
    expect(cycles[0].files).toEqual(["a.ts", "b.ts"]);
  });

  it("detects a 3-file cycle", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import c from "./c";` },
      { path: "c.ts", content: `import a from "./a";` },
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].size).toBe(3);
  });

  it("detects multiple disjoint cycles", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import a from "./a";` },
      { path: "x.ts", content: `import y from "./y";` },
      { path: "y.ts", content: `import x from "./x";` },
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(2);
  });

  it("sorts cycles by size descending", () => {
    const graph = buildImportGraph([
      // 3-cycle
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import c from "./c";` },
      { path: "c.ts", content: `import a from "./a";` },
      // 2-cycle
      { path: "x.ts", content: `import y from "./y";` },
      { path: "y.ts", content: `import x from "./x";` },
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(2);
    expect(cycles[0].size).toBe(3);
    expect(cycles[1].size).toBe(2);
  });

  it("ignores acyclic portions", () => {
    const graph = buildImportGraph([
      { path: "main.ts", content: `import a from "./a";\nimport leaf from "./leaf";` },
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import a from "./a";` }, // cycle a↔b
      { path: "leaf.ts", content: `export const x = 1;` }, // not in cycle
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].files).not.toContain("main.ts");
    expect(cycles[0].files).not.toContain("leaf.ts");
  });

  it("skips isolated nodes with no edges", () => {
    const graph = buildImportGraph([
      { path: "isolated.ts", content: `export const x = 1;` },
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("returns empty for empty graph", () => {
    const graph = buildImportGraph([]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("handles complex SCC with multiple paths", () => {
    // a → b → c → a AND a → d → a (two cycles sharing nodes)
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";\nimport d from "./d";` },
      { path: "b.ts", content: `import c from "./c";` },
      { path: "c.ts", content: `import a from "./a";` },
      { path: "d.ts", content: `import a from "./a";` },
    ]);
    const cycles = findCycles(graph);
    // Tarjan returns ONE SCC containing all 4 nodes
    expect(cycles).toHaveLength(1);
    expect(cycles[0].size).toBe(4);
    expect(cycles[0].files.sort()).toEqual(["a.ts", "b.ts", "c.ts", "d.ts"]);
  });
});

describe("summarizeCycles", () => {
  it("returns zero for empty", () => {
    const s = summarizeCycles([]);
    expect(s.totalCycles).toBe(0);
    expect(s.filesInCycles).toBe(0);
  });

  it("counts total cycles and participating files", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import a from "./a";` },
      { path: "x.ts", content: `import y from "./y";` },
      { path: "y.ts", content: `import x from "./x";` },
    ]);
    const s = summarizeCycles(findCycles(graph));
    expect(s.totalCycles).toBe(2);
    expect(s.filesInCycles).toBe(4);
  });

  it("tracks largest cycle size", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `import c from "./c";` },
      { path: "c.ts", content: `import a from "./a";` },
      { path: "x.ts", content: `import y from "./y";` },
      { path: "y.ts", content: `import x from "./x";` },
    ]);
    const s = summarizeCycles(findCycles(graph));
    expect(s.largestCycle).toBe(3);
  });
});
