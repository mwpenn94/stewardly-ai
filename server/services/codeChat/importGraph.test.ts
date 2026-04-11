/**
 * Tests for importGraph.ts (Pass 245).
 */

import { describe, it, expect } from "vitest";
import {
  parseImports,
  resolveImport,
  buildImportGraph,
  getFileDependencies,
  findLeafFiles,
  findHotFiles,
  graphStats,
} from "./importGraph";

describe("parseImports", () => {
  it("returns empty for no imports", () => {
    expect(parseImports(`const x = 1;`)).toEqual([]);
  });

  it("parses default import", () => {
    const imports = parseImports(`import foo from "./foo";`);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./foo");
    expect(imports[0].line).toBe(1);
  });

  it("parses named imports", () => {
    const imports = parseImports(`import { a, b } from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses namespace import", () => {
    const imports = parseImports(`import * as ns from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses side-effect import", () => {
    const imports = parseImports(`import "./styles.css";`);
    expect(imports[0].specifier).toBe("./styles.css");
  });

  it("parses mixed default and named", () => {
    const imports = parseImports(`import foo, { a, b } from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses type-only imports", () => {
    const imports = parseImports(`import type { Foo } from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses export * from", () => {
    const imports = parseImports(`export * from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses export { x } from", () => {
    const imports = parseImports(`export { foo } from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("parses export type { T } from", () => {
    const imports = parseImports(`export type { Foo } from "./foo";`);
    expect(imports[0].specifier).toBe("./foo");
  });

  it("handles multiple imports per file", () => {
    const src = `import a from "./a";\nimport b from "./b";\nconst x = 1;`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(2);
    expect(imports[1].line).toBe(2);
  });

  it("ignores imports inside comments", () => {
    const src = `// import foo from "./foo";\nimport bar from "./bar";`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./bar");
  });

  it("ignores dynamic imports", () => {
    const src = `const mod = await import("./foo");`;
    // Dynamic imports are not matched by the top-level regexes
    expect(parseImports(src).length).toBe(0);
  });

  it("captures both single-quoted and double-quoted", () => {
    const src = `import a from './single';\nimport b from "./double";`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(2);
  });
});

describe("resolveImport", () => {
  const known = new Set([
    "src/foo.ts",
    "src/bar.ts",
    "src/nested/index.ts",
    "client/src/components/x.tsx",
  ]);

  it("resolves relative sibling", () => {
    expect(
      resolveImport("src/foo.ts", "./bar", { knownFiles: known }),
    ).toBe("src/bar.ts");
  });

  it("resolves relative parent", () => {
    expect(
      resolveImport("src/nested/index.ts", "../foo", { knownFiles: known }),
    ).toBe("src/foo.ts");
  });

  it("resolves directory index", () => {
    expect(
      resolveImport("src/foo.ts", "./nested", { knownFiles: known }),
    ).toBe("src/nested/index.ts");
  });

  it("resolves alias @/ to client/src", () => {
    expect(
      resolveImport("server/a.ts", "@/components/x", { knownFiles: known }),
    ).toBe("client/src/components/x.tsx");
  });

  it("returns null for bare module", () => {
    expect(
      resolveImport("src/foo.ts", "react", { knownFiles: known }),
    ).toBeNull();
  });

  it("returns null for unresolvable path", () => {
    expect(
      resolveImport("src/foo.ts", "./missing", { knownFiles: known }),
    ).toBeNull();
  });

  it("returns null for empty specifier", () => {
    expect(
      resolveImport("src/foo.ts", "", { knownFiles: known }),
    ).toBeNull();
  });

  it("honors custom alias roots", () => {
    const custom = new Set(["lib/helpers.ts"]);
    expect(
      resolveImport("app/a.ts", "~/helpers", {
        knownFiles: custom,
        aliasRoots: { "~/": "lib/" },
      }),
    ).toBe("lib/helpers.ts");
  });
});

describe("buildImportGraph", () => {
  it("builds a small graph with outgoing + incoming edges", () => {
    const files = [
      { path: "a.ts", content: `import b from "./b";\nimport c from "./c";` },
      { path: "b.ts", content: `import c from "./c";` },
      { path: "c.ts", content: `export const c = 1;` },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("a.ts")).toEqual(["b.ts", "c.ts"]);
    expect(graph.outgoing.get("b.ts")).toEqual(["c.ts"]);
    expect(graph.incoming.get("c.ts")).toEqual(["a.ts", "b.ts"]);
    expect(graph.incoming.get("b.ts")).toEqual(["a.ts"]);
  });

  it("tracks unresolved specifiers", () => {
    const files = [
      { path: "a.ts", content: `import r from "react";\nimport b from "./b";` },
    ];
    const graph = buildImportGraph(files);
    expect(graph.unresolved.get("a.ts")).toEqual(["react", "./b"]); // both unresolved since b.ts not in knownFiles
  });

  it("dedupes duplicate edges", () => {
    const files = [
      { path: "a.ts", content: `import b1 from "./b";\nimport { x } from "./b";` },
      { path: "b.ts", content: `export const x = 1;` },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("a.ts")).toEqual(["b.ts"]);
  });
});

describe("getFileDependencies", () => {
  it("returns empty lists for unknown file", () => {
    const graph = buildImportGraph([]);
    const deps = getFileDependencies(graph, "missing.ts");
    expect(deps.imports).toEqual([]);
    expect(deps.importedBy).toEqual([]);
  });

  it("returns both directions for known file", () => {
    const graph = buildImportGraph([
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `` },
    ]);
    const deps = getFileDependencies(graph, "b.ts");
    expect(deps.imports).toEqual([]);
    expect(deps.importedBy).toEqual(["a.ts"]);
  });
});

describe("findLeafFiles", () => {
  it("returns files with no outgoing edges", () => {
    const files = [
      { path: "a.ts", content: `import b from "./b";` },
      { path: "b.ts", content: `export const x = 1;` },
    ];
    const graph = buildImportGraph(files);
    const leaves = findLeafFiles(graph, ["a.ts", "b.ts"]);
    expect(leaves).toEqual(["b.ts"]);
  });
});

describe("findHotFiles", () => {
  it("ranks by inbound edge count", () => {
    const files = [
      { path: "a.ts", content: `import util from "./util";` },
      { path: "b.ts", content: `import util from "./util";` },
      { path: "c.ts", content: `import lib from "./lib";` },
      { path: "util.ts", content: `export const util = 1;` },
      { path: "lib.ts", content: `export const lib = 1;` },
    ];
    const graph = buildImportGraph(files);
    const hot = findHotFiles(graph, 5);
    expect(hot[0].path).toBe("util.ts");
    expect(hot[0].count).toBe(2);
  });

  it("respects limit", () => {
    const files = [
      { path: "a.ts", content: `import x from "./x";` },
      { path: "b.ts", content: `import y from "./y";` },
      { path: "x.ts", content: `` },
      { path: "y.ts", content: `` },
    ];
    const graph = buildImportGraph(files);
    expect(findHotFiles(graph, 1)).toHaveLength(1);
  });
});

describe("graphStats", () => {
  it("returns zero-ish stats for empty", () => {
    const graph = buildImportGraph([]);
    const stats = graphStats(graph, []);
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalEdges).toBe(0);
  });

  it("reports edges, unresolved, and fanout", () => {
    const files = [
      { path: "a.ts", content: `import b from "./b";\nimport r from "react";` },
      { path: "b.ts", content: `` },
    ];
    const graph = buildImportGraph(files);
    const stats = graphStats(graph, files.map((f) => f.path));
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalEdges).toBe(1);
    expect(stats.unresolvedCount).toBe(1);
    expect(stats.leafCount).toBe(1);
  });
});
