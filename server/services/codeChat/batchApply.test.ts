/**
 * Tests for batch apply — Pass 256.
 *
 * Uses a real tmpdir to exercise the atomic-write + rollback path
 * end-to-end against the fileTools sandbox. Each test nukes the tmp
 * dir in afterEach so there's no state leakage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { applyBatch, previewBatch, validateBatch } from "./batchApply";

let tmpRoot: string;
let sandbox: { workspaceRoot: string; allowMutations: true };

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cc-batch-test-"));
  sandbox = { workspaceRoot: tmpRoot, allowMutations: true };
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function readFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(tmpRoot, p), "utf8");
  } catch {
    return null;
  }
}

describe("validateBatch", () => {
  it("flags empty batch", () => {
    const out = validateBatch([]);
    expect(out.ok).toBe(false);
    expect(out.issues[0].message).toContain("empty");
  });

  it("accepts a valid single write", () => {
    const out = validateBatch([
      { kind: "write", path: "a.ts", content: "hi" },
    ]);
    expect(out.ok).toBe(true);
  });

  it("flags missing path", () => {
    const out = validateBatch([
      { kind: "write", path: "", content: "hi" },
    ]);
    expect(out.ok).toBe(false);
  });

  it("flags traversal attempt", () => {
    const out = validateBatch([
      { kind: "write", path: "../etc/passwd", content: "bad" },
    ]);
    expect(out.ok).toBe(false);
    expect(out.issues[0].message).toContain("traversal");
  });

  it("flags unknown kind", () => {
    const out = validateBatch([
      { kind: "nope" as any, path: "a.ts" } as any,
    ]);
    expect(out.ok).toBe(false);
  });

  it("flags empty oldString on edit", () => {
    const out = validateBatch([
      { kind: "edit", path: "a.ts", oldString: "", newString: "new" },
    ]);
    expect(out.ok).toBe(false);
  });

  it("flags missing content on write", () => {
    const out = validateBatch([
      { kind: "write", path: "a.ts" } as any,
    ]);
    expect(out.ok).toBe(false);
  });
});

describe("applyBatch - successful path", () => {
  it("writes a single file", async () => {
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "hello" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.operations[0].ok).toBe(true);
    expect(await readFile("a.ts")).toBe("hello");
  });

  it("writes multiple files", async () => {
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "A" },
      { kind: "write", path: "b.ts", content: "B" },
      { kind: "write", path: "sub/c.ts", content: "C" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(await readFile("a.ts")).toBe("A");
    expect(await readFile("b.ts")).toBe("B");
    expect(await readFile("sub/c.ts")).toBe("C");
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("captures before/after snapshots", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "original");
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "new" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.operations[0].before).toBe("original");
    expect(result.operations[0].after).toBe("new");
  });

  it("applies an edit op", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "foo bar baz");
    const result = await applyBatch(sandbox, [
      { kind: "edit", path: "a.ts", oldString: "bar", newString: "qux" },
    ]);
    expect(result.ok).toBe(true);
    expect(await readFile("a.ts")).toBe("foo qux baz");
  });
});

describe("applyBatch - rollback on failure", () => {
  it("rolls back earlier writes when a later op fails", async () => {
    // Pre-create a.ts so we have a snapshot baseline
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "original");
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "modified" },
      // This edit targets a non-existent file — editFile will throw
      { kind: "edit", path: "missing.ts", oldString: "x", newString: "y" },
    ]);
    expect(result.ok).toBe(false);
    // First op reports success, second reports failure
    expect(result.operations[0].ok).toBe(true);
    expect(result.operations[1].ok).toBe(false);
    // After rollback, a.ts is back to "original"
    expect(await readFile("a.ts")).toBe("original");
    expect(result.rolledBack).toContain("a.ts");
  });

  it("deletes files that didn't exist before when rolling back", async () => {
    // a.ts doesn't exist; after write it will; after rollback it should
    // be gone again.
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "new" },
      // force a failure on second op
      { kind: "edit", path: "missing.ts", oldString: "x", newString: "y" },
    ]);
    expect(result.ok).toBe(false);
    expect(await readFile("a.ts")).toBeNull();
    expect(result.rolledBack).toContain("a.ts");
  });

  it("skips subsequent ops after an abort", async () => {
    const result = await applyBatch(sandbox, [
      { kind: "edit", path: "missing.ts", oldString: "x", newString: "y" },
      { kind: "write", path: "should-not-exist.ts", content: "X" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.operations[1].ok).toBe(false);
    expect(result.operations[1].error).toContain("skipped");
    expect(await readFile("should-not-exist.ts")).toBeNull();
  });
});

describe("previewBatch / dryRun", () => {
  it("writes then rolls back automatically", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "original");
    const result = await previewBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "preview" },
    ]);
    expect(result.dryRun).toBe(true);
    // ok is false for dryRun (we always roll back)
    expect(result.ok).toBe(false);
    expect(result.operations[0].ok).toBe(true);
    // File back to original
    expect(await readFile("a.ts")).toBe("original");
    expect(result.rolledBack).toContain("a.ts");
  });

  it("captures before/after in preview mode so UI can diff", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "original");
    const result = await previewBatch(sandbox, [
      { kind: "write", path: "a.ts", content: "preview" },
    ]);
    expect(result.operations[0].before).toBe("original");
    expect(result.operations[0].after).toBe("preview");
  });
});

describe("validation failures skip execution", () => {
  it("returns early when validation fails and touches no files", async () => {
    await fs.writeFile(path.join(tmpRoot, "a.ts"), "untouched");
    const result = await applyBatch(sandbox, [
      { kind: "write", path: "../bad", content: "x" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.operations[0].error).toContain("traversal");
    expect(await readFile("a.ts")).toBe("untouched");
  });
});
