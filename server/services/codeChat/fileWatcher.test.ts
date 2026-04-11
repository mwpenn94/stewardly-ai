/**
 * Tests for the file freshness checker — Pass 255.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  statFile,
  resolveSafe,
  checkFreshness,
  summarizeFreshness,
} from "./fileWatcher";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cc-watcher-test-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("resolveSafe", () => {
  it("resolves a workspace-relative path", () => {
    const out = resolveSafe("/ws", "src/a.ts");
    expect(out).toBe(path.resolve("/ws", "src/a.ts"));
  });

  it("refuses a traversal attempt", () => {
    const out = resolveSafe("/ws", "../outside/a.ts");
    expect(out).toBeNull();
  });

  it("resolves the workspace root itself", () => {
    const out = resolveSafe("/ws", ".");
    expect(out).toBe(path.resolve("/ws"));
  });
});

describe("statFile", () => {
  it("returns mtime for an existing file", async () => {
    const p = path.join(tmpRoot, "a.txt");
    await fs.writeFile(p, "hello");
    const stat = await statFile(tmpRoot, "a.txt");
    expect(stat.missing).toBe(false);
    expect(stat.mtime).toBeGreaterThan(0);
  });

  it("returns missing for a non-existent file", async () => {
    const stat = await statFile(tmpRoot, "missing.txt");
    expect(stat.missing).toBe(true);
    expect(stat.mtime).toBeNull();
  });

  it("returns missing for a directory", async () => {
    await fs.mkdir(path.join(tmpRoot, "d"));
    const stat = await statFile(tmpRoot, "d");
    expect(stat.missing).toBe(true);
  });

  it("returns missing on traversal attempts", async () => {
    const stat = await statFile(tmpRoot, "../outside.txt");
    expect(stat.missing).toBe(true);
  });
});

describe("checkFreshness", () => {
  it("returns an empty result for empty checks", async () => {
    const result = await checkFreshness(tmpRoot, []);
    expect(result.entries).toHaveLength(0);
  });

  it("flags stale when expected mtime drifts", async () => {
    const p = path.join(tmpRoot, "a.txt");
    await fs.writeFile(p, "one");
    const stat = await statFile(tmpRoot, "a.txt");
    const oldExpected = (stat.mtime ?? 0) - 10000;
    const result = await checkFreshness(tmpRoot, [
      { path: "a.txt", expectedMtime: oldExpected },
    ]);
    expect(result.entries[0].stale).toBe(true);
    expect(result.entries[0].missing).toBe(false);
  });

  it("does NOT flag stale when expected matches current", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.txt"), "one");
    const stat = await statFile(tmpRoot, "a.txt");
    const result = await checkFreshness(tmpRoot, [
      { path: "a.txt", expectedMtime: stat.mtime },
    ]);
    expect(result.entries[0].stale).toBe(false);
  });

  it("tolerates a 2s slop for clock drift", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.txt"), "one");
    const stat = await statFile(tmpRoot, "a.txt");
    const result = await checkFreshness(tmpRoot, [
      { path: "a.txt", expectedMtime: (stat.mtime ?? 0) + 1500 },
    ]);
    expect(result.entries[0].stale).toBe(false);
  });

  it("flags stale when file was deleted", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.txt"), "one");
    const stat = await statFile(tmpRoot, "a.txt");
    await fs.rm(path.join(tmpRoot, "a.txt"));
    const result = await checkFreshness(tmpRoot, [
      { path: "a.txt", expectedMtime: stat.mtime },
    ]);
    expect(result.entries[0].stale).toBe(true);
    expect(result.entries[0].missing).toBe(true);
  });

  it("does NOT flag missing files with no expected mtime (never seen)", async () => {
    const result = await checkFreshness(tmpRoot, [
      { path: "missing.txt", expectedMtime: null },
    ]);
    expect(result.entries[0].stale).toBe(false);
    expect(result.entries[0].missing).toBe(true);
  });

  it("caps at 500 entries", async () => {
    const checks = Array.from({ length: 600 }, (_, i) => ({
      path: `f${i}.txt`,
      expectedMtime: null,
    }));
    const result = await checkFreshness(tmpRoot, checks);
    expect(result.entries).toHaveLength(500);
  });

  it("skips empty and invalid paths", async () => {
    const result = await checkFreshness(tmpRoot, [
      { path: "", expectedMtime: null } as any,
      { path: "valid.txt", expectedMtime: null },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].path).toBe("valid.txt");
  });
});

describe("summarizeFreshness", () => {
  it("counts stale and missing", () => {
    const summary = summarizeFreshness({
      checkedAt: 0,
      entries: [
        { path: "a", expectedMtime: 1, currentMtime: 2, missing: false, stale: true },
        { path: "b", expectedMtime: 1, currentMtime: 1, missing: false, stale: false },
        { path: "c", expectedMtime: 1, currentMtime: null, missing: true, stale: true },
      ],
    });
    expect(summary.total).toBe(3);
    expect(summary.staleCount).toBe(2);
    expect(summary.missingCount).toBe(1);
    expect(summary.stalePaths).toEqual(["a", "c"]);
  });

  it("limits stalePaths to the cap", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      path: `p${i}`,
      expectedMtime: 1,
      currentMtime: 2,
      missing: false,
      stale: true,
    }));
    const summary = summarizeFreshness({ checkedAt: 0, entries }, 5);
    expect(summary.stalePaths).toHaveLength(5);
  });
});
