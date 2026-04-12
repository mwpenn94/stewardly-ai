/**
 * sandboxEscape.test.ts — Parity Pass 6 (security audit).
 *
 * Proves the sandbox blocks symlink-based escape attacks. Prior to
 * Pass 6, `resolveInside` only canonicalized the string form of the
 * path, which meant a symlink inside the workspace silently
 * redirected reads/writes to arbitrary files on the host (e.g.
 * `./notes.md` → `/etc/passwd`).
 *
 * `resolveInsideReal` fs.realpath()s both the target (if it exists)
 * and the parent directory (for create-a-new-file paths), then
 * re-verifies the REAL location still lives inside the workspace.
 *
 * Tests below:
 *   1. Direct symlink to a file outside the workspace is blocked.
 *   2. Symlinked directory escape is blocked.
 *   3. Write into a symlink pointing outside the workspace is blocked.
 *   4. Write into a directory whose PARENT is a symlink is blocked.
 *   5. Legitimate symlink-within-workspace still works (internal
 *      relocation shouldn't be penalized).
 *   6. The plain string-based resolveInside still rejects `../`
 *      escapes (regression guard).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readFile,
  writeFile,
  editFile,
  multiEditFile,
  listDirectory,
  resolveInside,
  resolveInsideReal,
  SandboxError,
} from "./fileTools";
import fs from "fs/promises";
import path from "path";
import os from "os";

let tmpRoot: string;
let outsideFile: string;
let outsideDir: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sbesc-ws-"));
  outsideFile = path.join(
    os.tmpdir(),
    `outside-${Math.random().toString(36).slice(2)}.txt`,
  );
  outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "outside-dir-"));
  await fs.writeFile(outsideFile, "SECRET", "utf8");
});

afterEach(async () => {
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.rm(outsideFile, { force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// ─── Sanity: plain .. escape still rejected ───────────────────────────

describe("sandbox escape — plain path traversal", () => {
  it("rejects ../../etc/passwd via resolveInside", () => {
    expect(() => resolveInside(tmpRoot, "../../etc/passwd")).toThrow(SandboxError);
  });

  it("rejects ../../etc/passwd via resolveInsideReal", async () => {
    await expect(
      resolveInsideReal(tmpRoot, "../../etc/passwd"),
    ).rejects.toBeInstanceOf(SandboxError);
  });

  it("allows a legitimate inside-workspace file", async () => {
    await fs.writeFile(path.join(tmpRoot, "normal.ts"), "x", "utf8");
    const real = await resolveInsideReal(tmpRoot, "normal.ts");
    expect(real).toBe(path.join(tmpRoot, "normal.ts"));
  });
});

// ─── Symlink file escape ──────────────────────────────────────────────

describe("sandbox escape — symlink file", () => {
  it("blocks readFile against a symlink pointing outside", async () => {
    // Plant a symlink inside the workspace that points to an
    // external file containing secret data.
    await fs.symlink(outsideFile, path.join(tmpRoot, "escape.txt"));
    await expect(
      readFile({ workspaceRoot: tmpRoot }, "escape.txt"),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
  });

  it("blocks writeFile against a symlink pointing outside", async () => {
    await fs.symlink(outsideFile, path.join(tmpRoot, "escape.txt"));
    await expect(
      writeFile(
        { workspaceRoot: tmpRoot, allowMutations: true },
        "escape.txt",
        "pwned",
      ),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
    // Verify the outside file was NOT touched
    const outsideContent = await fs.readFile(outsideFile, "utf8");
    expect(outsideContent).toBe("SECRET");
  });

  it("blocks editFile against a symlink pointing outside", async () => {
    await fs.symlink(outsideFile, path.join(tmpRoot, "escape.txt"));
    await expect(
      editFile(
        { workspaceRoot: tmpRoot, allowMutations: true },
        "escape.txt",
        "SECRET",
        "PWNED",
      ),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
    const outsideContent = await fs.readFile(outsideFile, "utf8");
    expect(outsideContent).toBe("SECRET");
  });

  it("blocks multiEditFile against a symlink pointing outside", async () => {
    await fs.symlink(outsideFile, path.join(tmpRoot, "escape.txt"));
    await expect(
      multiEditFile(
        { workspaceRoot: tmpRoot, allowMutations: true },
        "escape.txt",
        [{ oldString: "SECRET", newString: "PWNED" }],
      ),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
    const outsideContent = await fs.readFile(outsideFile, "utf8");
    expect(outsideContent).toBe("SECRET");
  });
});

// ─── Symlink directory escape ─────────────────────────────────────────

describe("sandbox escape — symlink directory", () => {
  it("blocks listDirectory against a symlinked dir pointing outside", async () => {
    await fs.writeFile(path.join(outsideDir, "secret.txt"), "x", "utf8");
    await fs.symlink(outsideDir, path.join(tmpRoot, "escape"));
    await expect(
      listDirectory({ workspaceRoot: tmpRoot }, "escape"),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
  });

  it("blocks writeFile when the PARENT directory is a symlink outside", async () => {
    // `tmpRoot/escape-dir` is a symlink to `outsideDir`, so
    // `tmpRoot/escape-dir/newfile.ts` resolves into outsideDir.
    await fs.symlink(outsideDir, path.join(tmpRoot, "escape-dir"));
    await expect(
      writeFile(
        { workspaceRoot: tmpRoot, allowMutations: true },
        "escape-dir/newfile.ts",
        "pwned",
      ),
    ).rejects.toMatchObject({ code: "SANDBOX_ESCAPE" });
    // Verify no file landed in outsideDir
    const outsideEntries = await fs.readdir(outsideDir);
    expect(outsideEntries).not.toContain("newfile.ts");
  });
});

// ─── Legitimate inside-workspace symlinks still work ─────────────────

describe("sandbox escape — inside-workspace symlinks", () => {
  it("allows a symlink that points to another file inside the workspace", async () => {
    // workspace/real.txt contains data, workspace/alias.txt -> real.txt
    await fs.writeFile(path.join(tmpRoot, "real.txt"), "inside-data", "utf8");
    await fs.symlink(path.join(tmpRoot, "real.txt"), path.join(tmpRoot, "alias.txt"));
    const result = await readFile({ workspaceRoot: tmpRoot }, "alias.txt");
    expect(result.content).toBe("inside-data");
  });

  it("allows a symlink using a relative path inside the workspace", async () => {
    await fs.writeFile(path.join(tmpRoot, "real.txt"), "rel-data", "utf8");
    await fs.symlink("./real.txt", path.join(tmpRoot, "rel-alias.txt"));
    const result = await readFile({ workspaceRoot: tmpRoot }, "rel-alias.txt");
    expect(result.content).toBe("rel-data");
  });
});

// ─── resolveInsideReal direct unit coverage ──────────────────────────

describe("resolveInsideReal — direct", () => {
  it("returns the path for a non-existent file when parent is clean", async () => {
    const real = await resolveInsideReal(tmpRoot, "new-file.ts");
    expect(real).toBe(path.join(tmpRoot, "new-file.ts"));
  });

  it("returns the path for an existing file", async () => {
    await fs.writeFile(path.join(tmpRoot, "x.ts"), "y", "utf8");
    const real = await resolveInsideReal(tmpRoot, "x.ts");
    expect(real).toBe(path.join(tmpRoot, "x.ts"));
  });

  it("rejects a symlink pointing outside via direct call", async () => {
    await fs.symlink(outsideFile, path.join(tmpRoot, "sym.txt"));
    await expect(resolveInsideReal(tmpRoot, "sym.txt")).rejects.toMatchObject({
      code: "SANDBOX_ESCAPE",
    });
  });
});
