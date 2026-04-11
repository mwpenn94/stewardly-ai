/**
 * Tests for fileTreeBuilder.ts (Pass 215).
 */

import { describe, it, expect } from "vitest";
import { buildFileTree, computeStats } from "./fileTreeBuilder";

describe("buildFileTree", () => {
  it("returns an empty directory for no files", () => {
    const tree = buildFileTree([]);
    expect(tree.type).toBe("directory");
    expect(tree.children).toEqual([]);
  });

  it("creates top-level files", () => {
    const tree = buildFileTree(["README.md", "package.json"]);
    expect(tree.children).toHaveLength(2);
    expect(tree.children!.map((c) => c.name).sort()).toEqual([
      "README.md",
      "package.json",
    ]);
  });

  it("nests files into directories", () => {
    const tree = buildFileTree([
      "server/routers/chat.ts",
      "server/routers/wealth.ts",
      "client/src/App.tsx",
    ]);
    expect(tree.children).toHaveLength(2);
    const server = tree.children!.find((c) => c.name === "server");
    const client = tree.children!.find((c) => c.name === "client");
    expect(server?.type).toBe("directory");
    expect(client?.type).toBe("directory");
    const routers = server!.children!.find((c) => c.name === "routers");
    expect(routers?.children).toHaveLength(2);
    expect(routers!.children!.map((c) => c.name).sort()).toEqual([
      "chat.ts",
      "wealth.ts",
    ]);
  });

  it("sorts directories before files at each level", () => {
    const tree = buildFileTree([
      "README.md",
      "server/index.ts",
      "LICENSE",
      "client/App.tsx",
    ]);
    const kinds = tree.children!.map((c) => c.type);
    // dirs first: client, server, then files
    expect(kinds).toEqual(["directory", "directory", "file", "file"]);
  });

  it("handles deeply nested paths", () => {
    const tree = buildFileTree([
      "a/b/c/d/e/leaf.ts",
    ]);
    let node = tree;
    for (const name of ["a", "b", "c", "d", "e", "leaf.ts"]) {
      const child = node.children!.find((c) => c.name === name);
      expect(child).toBeDefined();
      node = child!;
    }
    expect(node.type).toBe("file");
  });

  it("stores the full path on each node", () => {
    const tree = buildFileTree(["server/routers/chat.ts"]);
    const server = tree.children![0];
    const routers = server.children![0];
    const chat = routers.children![0];
    expect(server.path).toBe("server");
    expect(routers.path).toBe("server/routers");
    expect(chat.path).toBe("server/routers/chat.ts");
  });

  it("dedupes duplicate entries", () => {
    const tree = buildFileTree([
      "server/index.ts",
      "server/index.ts",
    ]);
    const server = tree.children![0];
    expect(server.children).toHaveLength(1);
  });
});

describe("computeStats", () => {
  it("returns zero stats for empty input", () => {
    const s = computeStats([]);
    expect(s.totalFiles).toBe(0);
    expect(s.totalDirs).toBe(0);
    expect(s.topLanguages).toEqual([]);
  });

  it("counts files and unique directories", () => {
    const s = computeStats([
      "README.md",
      "server/index.ts",
      "server/routers/a.ts",
      "server/routers/b.ts",
      "client/src/App.tsx",
    ]);
    expect(s.totalFiles).toBe(5);
    // server, server/routers, client, client/src
    expect(s.totalDirs).toBe(4);
  });

  it("ranks languages by count with percentages", () => {
    const s = computeStats([
      "a.ts",
      "b.ts",
      "c.ts",
      "d.tsx",
      "e.md",
    ]);
    expect(s.topLanguages[0].ext).toBe(".ts");
    expect(s.topLanguages[0].count).toBe(3);
    expect(s.topLanguages[0].pct).toBe(60);
  });

  it("handles extensionless files", () => {
    const s = computeStats(["Makefile", "README", "server/index.ts"]);
    const noExt = s.topLanguages.find((l) => l.ext === "(no ext)");
    expect(noExt?.count).toBe(2);
  });

  it("returns top directories by file count", () => {
    const s = computeStats([
      "server/a.ts",
      "server/b.ts",
      "server/c.ts",
      "client/a.tsx",
    ]);
    expect(s.topDirs[0].dir).toBe("server");
    expect(s.topDirs[0].count).toBe(3);
    expect(s.topDirs[1].dir).toBe("client");
  });

  it("respects the topN limit", () => {
    const files = Array.from({ length: 10 }, (_, i) => `file.ext${i}`);
    const s = computeStats(files, 3);
    expect(s.topLanguages.length).toBeLessThanOrEqual(3);
  });
});
