/**
 * Tests for fileIndex.ts (Pass 206).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import {
  buildWorkspaceFileIndex,
  fuzzyFilterFiles,
  extractFileMentions,
  __resetFileIndexCache,
  getWorkspaceFileIndex,
} from "./fileIndex";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "stewardly-fileindex-"));
  // Build a small workspace
  await fs.mkdir(path.join(tmpRoot, "server", "routers"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "client", "src", "pages"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "node_modules", "vite"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, ".git"), { recursive: true });
  await fs.writeFile(path.join(tmpRoot, "README.md"), "# test");
  await fs.writeFile(path.join(tmpRoot, "package.json"), "{}");
  await fs.writeFile(path.join(tmpRoot, "pnpm-lock.yaml"), "lock");
  await fs.writeFile(path.join(tmpRoot, "logo.png"), "binary");
  await fs.writeFile(path.join(tmpRoot, "server/routers/codeChat.ts"), "// code");
  await fs.writeFile(path.join(tmpRoot, "server/routers/wealthEngine.ts"), "// code");
  await fs.writeFile(path.join(tmpRoot, "client/src/pages/CodeChat.tsx"), "// code");
  await fs.writeFile(path.join(tmpRoot, "client/src/pages/Chat.tsx"), "// code");
  await fs.writeFile(path.join(tmpRoot, "node_modules/vite/index.js"), "// deny");
  await fs.writeFile(path.join(tmpRoot, ".git/config"), "[core]");
  __resetFileIndexCache();
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  __resetFileIndexCache();
});

describe("buildWorkspaceFileIndex", () => {
  it("lists source files and skips denied dirs", async () => {
    const files = await buildWorkspaceFileIndex(tmpRoot);
    expect(files).toContain("README.md");
    expect(files).toContain("package.json");
    expect(files).toContain("server/routers/codeChat.ts");
    expect(files).toContain("client/src/pages/CodeChat.tsx");
    expect(files).not.toContain("node_modules/vite/index.js");
    expect(files.some((f) => f.startsWith(".git/"))).toBe(false);
  });

  it("skips binary and lockfile extensions", async () => {
    const files = await buildWorkspaceFileIndex(tmpRoot);
    expect(files).not.toContain("logo.png");
    expect(files).not.toContain("pnpm-lock.yaml");
  });

  it("returns POSIX-style paths on all platforms", async () => {
    const files = await buildWorkspaceFileIndex(tmpRoot);
    for (const f of files) {
      expect(f).not.toContain("\\");
    }
  });
});

describe("getWorkspaceFileIndex caching", () => {
  it("returns the same list on consecutive calls within TTL", async () => {
    const a = await getWorkspaceFileIndex(tmpRoot);
    // Add a file AFTER the cache is populated
    await fs.writeFile(path.join(tmpRoot, "server/routers/NEW.ts"), "// new");
    const b = await getWorkspaceFileIndex(tmpRoot);
    // The new file shouldn't show up because we're within the TTL
    expect(a).toEqual(b);
  });

  it("force:true bypasses the cache", async () => {
    await getWorkspaceFileIndex(tmpRoot);
    await fs.writeFile(path.join(tmpRoot, "server/routers/FORCED.ts"), "// new");
    const fresh = await getWorkspaceFileIndex(tmpRoot, { force: true });
    expect(fresh).toContain("server/routers/FORCED.ts");
  });
});

describe("fuzzyFilterFiles", () => {
  const files = [
    "server/routers/codeChat.ts",
    "server/routers/wealthEngine.ts",
    "client/src/pages/CodeChat.tsx",
    "client/src/pages/Chat.tsx",
    "README.md",
    "package.json",
  ];

  it("returns all files capped by limit on empty query", () => {
    expect(fuzzyFilterFiles(files, "", 3)).toHaveLength(3);
  });

  it("ranks exact basename match highest", () => {
    const r = fuzzyFilterFiles(files, "Chat.tsx");
    expect(r[0]).toBe("client/src/pages/Chat.tsx");
  });

  it("ranks basename-starts-with above basename-contains", () => {
    const r = fuzzyFilterFiles(files, "Code");
    // Both codeChat.ts and CodeChat.tsx start with "code" (case-insensitive)
    expect(r[0]).toMatch(/[cC]odeChat\.(ts|tsx)$/);
  });

  it("matches by path substring", () => {
    const r = fuzzyFilterFiles(files, "routers");
    expect(r.every((f) => f.includes("routers"))).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it("returns empty for no-match queries", () => {
    expect(fuzzyFilterFiles(files, "xyz987")).toEqual([]);
  });
});

describe("extractFileMentions", () => {
  it("extracts plain @path refs terminated by whitespace", () => {
    expect(
      extractFileMentions("explain @server/routers/codeChat.ts please"),
    ).toEqual(["server/routers/codeChat.ts"]);
  });

  it("extracts multiple plain refs in order", () => {
    const r = extractFileMentions(
      "diff @server/a.ts against @client/b.tsx",
    );
    expect(r).toEqual(["server/a.ts", "client/b.tsx"]);
  });

  it("dedupes repeated mentions", () => {
    const r = extractFileMentions("@a.ts and @a.ts again");
    expect(r).toEqual(["a.ts"]);
  });

  it("caps at maxRefs", () => {
    const r = extractFileMentions(
      "@a.ts @b.ts @c.ts @d.ts @e.ts @f.ts @g.ts",
      3,
    );
    expect(r).toHaveLength(3);
  });

  it("extracts bracketed refs with spaces", () => {
    const r = extractFileMentions("look at @{my file.ts}");
    expect(r).toEqual(["my file.ts"]);
  });

  it("skips bare @username-style tokens (no extension, no slash)", () => {
    const r = extractFileMentions("hey @bob take a look");
    expect(r).toEqual([]);
  });

  it("allows paths with directory components even without extensions", () => {
    const r = extractFileMentions("check @server/routers");
    expect(r).toEqual(["server/routers"]);
  });
});
