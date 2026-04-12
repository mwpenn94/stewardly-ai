/**
 * multiEdit.test.ts — Parity Pass 2.
 *
 * Covers the atomic batch edit tool added to fileTools.ts:
 *   - Single-step applies
 *   - Multi-step sequential application (later steps see earlier output)
 *   - Atomicity: one step failing leaves the file untouched
 *   - replaceAll vs unique-match semantics
 *   - Input validation (empty array, bad step shape, BAD_ARGS codes)
 *   - Sandbox guards (allowMutations, NOT_FOUND, TOO_LARGE, 50-step cap)
 *
 * Uses a tmp dir per-test so nothing leaks between cases.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { multiEditFile, SandboxError } from "./fileTools";
import fs from "fs/promises";
import path from "path";
import os from "os";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "multiedit-test-"));
});

afterEach(async () => {
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore cleanup errors */
  }
});

async function writeTestFile(name: string, content: string): Promise<string> {
  const p = path.join(tmpRoot, name);
  await fs.writeFile(p, content, "utf8");
  return name;
}

const sandbox = (allowMutations = true) => ({
  workspaceRoot: tmpRoot,
  allowMutations,
});

describe("multiEditFile — happy path", () => {
  it("applies a single edit", async () => {
    await writeTestFile("a.ts", "const x = 1;\n");
    const r = await multiEditFile(sandbox(), "a.ts", [
      { oldString: "const x = 1;", newString: "const x = 42;" },
    ]);
    expect(r.stepsApplied).toBe(1);
    expect(r.replacements).toBe(1);
    expect(r.steps[0].replacements).toBe(1);
    const content = await fs.readFile(path.join(tmpRoot, "a.ts"), "utf8");
    expect(content).toBe("const x = 42;\n");
  });

  it("applies multiple sequential edits (later sees earlier)", async () => {
    await writeTestFile("b.ts", "const foo = 1;\nconst bar = 2;\n");
    const r = await multiEditFile(sandbox(), "b.ts", [
      { oldString: "const foo = 1;", newString: "const foo = 100;" },
      { oldString: "const bar = 2;", newString: "const bar = 200;" },
    ]);
    expect(r.stepsApplied).toBe(2);
    expect(r.replacements).toBe(2);
    const content = await fs.readFile(path.join(tmpRoot, "b.ts"), "utf8");
    expect(content).toBe("const foo = 100;\nconst bar = 200;\n");
  });

  it("second step can match text introduced by first step", async () => {
    await writeTestFile("c.ts", "hello world\n");
    const r = await multiEditFile(sandbox(), "c.ts", [
      { oldString: "hello world", newString: "hola mundo" },
      { oldString: "hola mundo", newString: "bonjour monde" },
    ]);
    expect(r.stepsApplied).toBe(2);
    const content = await fs.readFile(path.join(tmpRoot, "c.ts"), "utf8");
    expect(content).toBe("bonjour monde\n");
  });

  it("replaceAll counts every occurrence", async () => {
    await writeTestFile("d.ts", "foo foo foo\n");
    const r = await multiEditFile(sandbox(), "d.ts", [
      { oldString: "foo", newString: "bar", replaceAll: true },
    ]);
    expect(r.replacements).toBe(3);
    expect(r.steps[0].replacements).toBe(3);
    const content = await fs.readFile(path.join(tmpRoot, "d.ts"), "utf8");
    expect(content).toBe("bar bar bar\n");
  });

  it("returns before + after snapshots", async () => {
    await writeTestFile("e.ts", "old\n");
    const r = await multiEditFile(sandbox(), "e.ts", [
      { oldString: "old", newString: "new" },
    ]);
    expect(r.before).toBe("old\n");
    expect(r.after).toBe("new\n");
    expect(r.byteLength).toBe(4); // "new\n"
  });

  it("combines mixed replaceAll and unique edits", async () => {
    await writeTestFile("f.ts", "const a = 1;\nconst b = 2;\nconst a2 = 3;\n");
    const r = await multiEditFile(sandbox(), "f.ts", [
      // unique match on const b
      { oldString: "const b = 2;", newString: "const b = 20;" },
      // replaceAll on "= " substring (bumps everyone once)
      { oldString: "= ", newString: ":= ", replaceAll: true },
    ]);
    expect(r.stepsApplied).toBe(2);
    const content = await fs.readFile(path.join(tmpRoot, "f.ts"), "utf8");
    expect(content).toBe("const a := 1;\nconst b := 20;\nconst a2 := 3;\n");
  });
});

describe("multiEditFile — atomicity", () => {
  it("aborts the entire batch if a later step fails", async () => {
    const original = "const x = 1;\nconst y = 2;\n";
    await writeTestFile("g.ts", original);
    await expect(
      multiEditFile(sandbox(), "g.ts", [
        { oldString: "const x = 1;", newString: "const x = 999;" },
        { oldString: "never matches", newString: "irrelevant" },
      ]),
    ).rejects.toBeInstanceOf(SandboxError);
    // File should be UNTOUCHED because the second step failed
    const content = await fs.readFile(path.join(tmpRoot, "g.ts"), "utf8");
    expect(content).toBe(original);
  });

  it("aborts when an intermediate step becomes ambiguous", async () => {
    const original = "foo bar\nfoo baz\n";
    await writeTestFile("h.ts", original);
    // Second step has two matches and replaceAll is false → fails
    await expect(
      multiEditFile(sandbox(), "h.ts", [
        { oldString: "bar", newString: "qux" },
        { oldString: "foo", newString: "boo" }, // 2 matches
      ]),
    ).rejects.toMatchObject({ code: "AMBIGUOUS" });
    const content = await fs.readFile(path.join(tmpRoot, "h.ts"), "utf8");
    expect(content).toBe(original);
  });

  it("surfaces the step index in the error message", async () => {
    await writeTestFile("i.ts", "hello\n");
    let err: unknown;
    try {
      await multiEditFile(sandbox(), "i.ts", [
        { oldString: "hello", newString: "hi" },
        { oldString: "nope", newString: "oops" },
        { oldString: "hi", newString: "hey" }, // would work, but step 1 fails first
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SandboxError);
    expect((err as Error).message).toContain("step 1");
  });
});

describe("multiEditFile — validation", () => {
  it("rejects empty edits array", async () => {
    await writeTestFile("j.ts", "x");
    await expect(multiEditFile(sandbox(), "j.ts", [])).rejects.toMatchObject({
      code: "BAD_ARGS",
    });
  });

  it("rejects non-string oldString", async () => {
    await writeTestFile("k.ts", "x");
    await expect(
      multiEditFile(sandbox(), "k.ts", [
        { oldString: "" as string, newString: "y" },
      ]),
    ).rejects.toMatchObject({ code: "BAD_ARGS" });
  });

  it("rejects oldString === newString no-ops", async () => {
    await writeTestFile("l.ts", "same\n");
    await expect(
      multiEditFile(sandbox(), "l.ts", [
        { oldString: "same", newString: "same" },
      ]),
    ).rejects.toMatchObject({ code: "BAD_ARGS" });
  });

  it("rejects >50 steps", async () => {
    await writeTestFile("m.ts", "x");
    const steps = Array.from({ length: 51 }, (_, i) => ({
      oldString: `a${i}`,
      newString: `b${i}`,
    }));
    await expect(multiEditFile(sandbox(), "m.ts", steps)).rejects.toMatchObject({
      code: "TOO_MANY_STEPS",
    });
  });
});

describe("multiEditFile — sandbox guards", () => {
  it("throws MUTATIONS_DISABLED when allowMutations is false", async () => {
    await writeTestFile("n.ts", "x");
    await expect(
      multiEditFile(sandbox(false), "n.ts", [
        { oldString: "x", newString: "y" },
      ]),
    ).rejects.toMatchObject({ code: "MUTATIONS_DISABLED" });
  });

  it("throws NOT_FOUND for missing file", async () => {
    await expect(
      multiEditFile(sandbox(), "does-not-exist.ts", [
        { oldString: "x", newString: "y" },
      ]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws OUT_OF_BOUNDS for escape attempts", async () => {
    await expect(
      multiEditFile(sandbox(), "../../etc/passwd", [
        { oldString: "x", newString: "y" },
      ]),
    ).rejects.toBeInstanceOf(SandboxError);
  });

  it("enforces maxWriteBytes on the final result", async () => {
    await writeTestFile("o.ts", "seed");
    await expect(
      multiEditFile(
        { workspaceRoot: tmpRoot, allowMutations: true, maxWriteBytes: 10 },
        "o.ts",
        [{ oldString: "seed", newString: "a".repeat(50) }],
      ),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
    // Original file stays intact
    const content = await fs.readFile(path.join(tmpRoot, "o.ts"), "utf8");
    expect(content).toBe("seed");
  });
});
