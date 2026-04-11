import { describe, it, expect } from "vitest";
import {
  normalizeCheckpointPath,
  buildCheckpoint,
  parseCheckpoint,
  buildRestorePlan,
  summarizeCheckpoint,
  MAX_FILES_PER_CHECKPOINT,
  MAX_CHECKPOINT_BYTES,
} from "./checkpoints";

describe("checkpoints — normalizeCheckpointPath", () => {
  it("converts Windows separators to POSIX", () => {
    expect(normalizeCheckpointPath("src\\foo\\bar.ts")).toBe("src/foo/bar.ts");
  });

  it("strips leading ./", () => {
    expect(normalizeCheckpointPath("./src/foo.ts")).toBe("src/foo.ts");
    expect(normalizeCheckpointPath("././src/foo.ts")).toBe("src/foo.ts");
  });

  it("rejects absolute paths", () => {
    expect(normalizeCheckpointPath("/etc/passwd")).toBeNull();
  });

  it("rejects parent-escaping paths", () => {
    expect(normalizeCheckpointPath("../outside.ts")).toBeNull();
    expect(normalizeCheckpointPath("src/../../outside.ts")).toBeNull();
  });

  it("rejects empty inputs", () => {
    expect(normalizeCheckpointPath("")).toBeNull();
    expect(normalizeCheckpointPath("./")).toBeNull();
  });

  it("accepts normal relative paths", () => {
    expect(normalizeCheckpointPath("client/src/pages/CodeChat.tsx")).toBe(
      "client/src/pages/CodeChat.tsx",
    );
  });
});

describe("checkpoints — buildCheckpoint", () => {
  it("throws when name is empty", () => {
    expect(() =>
      buildCheckpoint({ id: "c1", name: "   ", files: [] }),
    ).toThrow();
  });

  it("captures file bytes and total", () => {
    const { checkpoint, skipped } = buildCheckpoint({
      id: "c1",
      name: "test",
      files: [
        { path: "a.ts", content: "hello" },
        { path: "b.ts", content: "world!" },
      ],
    });
    expect(skipped).toHaveLength(0);
    expect(checkpoint.files).toHaveLength(2);
    expect(checkpoint.totalBytes).toBe(11);
    expect(checkpoint.files[0]!.byteLength).toBe(5);
  });

  it("skips invalid paths with reason", () => {
    const { checkpoint, skipped } = buildCheckpoint({
      id: "c1",
      name: "test",
      files: [
        { path: "/etc/passwd", content: "bad" },
        { path: "a.ts", content: "ok" },
      ],
    });
    expect(checkpoint.files).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.reason).toBe("invalid_path");
  });

  it("caps files at MAX_FILES_PER_CHECKPOINT", () => {
    const files = Array.from({ length: MAX_FILES_PER_CHECKPOINT + 5 }, (_, i) => ({
      path: `file${i}.ts`,
      content: "x",
    }));
    const { checkpoint, skipped } = buildCheckpoint({
      id: "c1",
      name: "test",
      files,
    });
    expect(checkpoint.files).toHaveLength(MAX_FILES_PER_CHECKPOINT);
    expect(skipped.filter((s) => s.reason === "file_cap_reached")).toHaveLength(5);
  });

  it("respects MAX_CHECKPOINT_BYTES cap", () => {
    const big = "x".repeat(Math.floor(MAX_CHECKPOINT_BYTES / 2));
    const { checkpoint, skipped } = buildCheckpoint({
      id: "c1",
      name: "test",
      files: [
        { path: "a.ts", content: big },
        { path: "b.ts", content: big },
        { path: "c.ts", content: big },
      ],
    });
    expect(checkpoint.files.length).toBeLessThan(3);
    expect(skipped.some((s) => s.reason === "size_cap_reached")).toBe(true);
  });

  it("trims name and description", () => {
    const { checkpoint } = buildCheckpoint({
      id: "c1",
      name: "  trimmed  ",
      description: "  desc  ",
      files: [{ path: "a.ts", content: "ok" }],
    });
    expect(checkpoint.name).toBe("trimmed");
    expect(checkpoint.description).toBe("desc");
  });

  it("normalizes tags and drops invalid ones", () => {
    const { checkpoint } = buildCheckpoint({
      id: "c1",
      name: "test",
      tags: ["  Safe  ", "ok", "has space", "$bad", "good-one"],
      files: [{ path: "a.ts", content: "ok" }],
    });
    expect(checkpoint.tags).toContain("safe");
    expect(checkpoint.tags).toContain("ok");
    expect(checkpoint.tags).toContain("good-one");
    expect(checkpoint.tags).not.toContain("has space");
    expect(checkpoint.tags).not.toContain("$bad");
  });
});

describe("checkpoints — parseCheckpoint", () => {
  it("returns null for non-object inputs", () => {
    expect(parseCheckpoint(null)).toBeNull();
    expect(parseCheckpoint("string")).toBeNull();
    expect(parseCheckpoint(42)).toBeNull();
  });

  it("requires id, name, createdAt, files", () => {
    expect(parseCheckpoint({})).toBeNull();
    expect(parseCheckpoint({ id: "c1" })).toBeNull();
    expect(parseCheckpoint({ id: "c1", name: "x", createdAt: "2026-01-01" })).toBeNull();
  });

  it("round-trips a built checkpoint via JSON", () => {
    const { checkpoint } = buildCheckpoint({
      id: "c1",
      name: "test",
      files: [{ path: "a.ts", content: "hello" }],
    });
    const json = JSON.parse(JSON.stringify(checkpoint));
    const parsed = parseCheckpoint(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe("c1");
    expect(parsed!.files).toHaveLength(1);
    expect(parsed!.files[0]!.content).toBe("hello");
  });

  it("drops corrupt file entries defensively", () => {
    const parsed = parseCheckpoint({
      id: "c1",
      name: "test",
      createdAt: "2026-01-01",
      files: [
        { path: "a.ts", content: "ok" },
        { path: 42, content: "bad" }, // corrupt
        null, // corrupt
        { path: "b.ts" }, // missing content
        { path: "c.ts", content: "ok" },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.files).toHaveLength(2);
    expect(parsed!.files.map((f) => f.path)).toEqual(["a.ts", "c.ts"]);
  });
});

describe("checkpoints — buildRestorePlan", () => {
  const baseCheckpoint = buildCheckpoint({
    id: "c1",
    name: "test",
    files: [
      { path: "a.ts", content: "A" },
      { path: "b.ts", content: "BB" },
      { path: "c.ts", content: "CCC" },
    ],
  }).checkpoint;

  it("restores every file when no filter is given", () => {
    const plan = buildRestorePlan(baseCheckpoint);
    expect(plan.entries).toHaveLength(3);
    expect(plan.filtered).toHaveLength(0);
  });

  it("filters restore entries by path", () => {
    const plan = buildRestorePlan(baseCheckpoint, { paths: ["a.ts", "c.ts"] });
    expect(plan.entries.map((e) => e.path)).toEqual(["a.ts", "c.ts"]);
    expect(plan.filtered).toEqual(["b.ts"]);
  });

  it("marks liveMatches on byte-length equality", () => {
    const liveBytes = new Map<string, number>([
      ["a.ts", 1],
      ["b.ts", 999], // drift
    ]);
    const plan = buildRestorePlan(baseCheckpoint, { liveBytes });
    const a = plan.entries.find((e) => e.path === "a.ts");
    const b = plan.entries.find((e) => e.path === "b.ts");
    const c = plan.entries.find((e) => e.path === "c.ts");
    expect(a!.liveMatches).toBe(true);
    expect(b!.liveMatches).toBe(false);
    expect(c!.liveMatches).toBe(false); // not in liveBytes map
  });
});

describe("checkpoints — summarizeCheckpoint", () => {
  it("returns a content-free summary", () => {
    const { checkpoint } = buildCheckpoint({
      id: "c1",
      name: "test",
      description: "description",
      tags: ["safe"],
      files: [
        { path: "a.ts", content: "A".repeat(100) },
        { path: "b.ts", content: "B".repeat(50) },
      ],
    });
    const s = summarizeCheckpoint(checkpoint);
    expect(s.fileCount).toBe(2);
    expect(s.totalBytes).toBe(150);
    expect(s.paths).toEqual(["a.ts", "b.ts"]);
    expect(s.tags).toEqual(["safe"]);
    // summary does NOT include content
    expect((s as any).content).toBeUndefined();
    expect((s as any).files).toBeUndefined();
  });
});
