/**
 * Tests for projectInstructions.ts (Pass 238).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import {
  loadProjectInstructions,
  buildInstructionsPromptOverlay,
  manifestForUI,
  clearProjectInstructionsCache,
  MAX_BYTES,
} from "./projectInstructions";

describe("projectInstructions", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(path.join(os.tmpdir(), "stewardly-instr-"));
    clearProjectInstructionsCache();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("returns empty when no instructions exist", async () => {
    const result = await loadProjectInstructions(workspace);
    expect(result.entries).toEqual([]);
    expect(result.totalBytes).toBe(0);
  });

  it("loads CLAUDE.md from workspace root", async () => {
    await fs.writeFile(path.join(workspace, "CLAUDE.md"), "# Project rules\n- Be concise");
    const result = await loadProjectInstructions(workspace);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].kind).toBe("claude");
    expect(result.entries[0].path).toBe("CLAUDE.md");
    expect(result.entries[0].content).toContain("Be concise");
  });

  it("loads AGENTS.md as fallback convention", async () => {
    await fs.writeFile(path.join(workspace, "AGENTS.md"), "agent rules");
    const result = await loadProjectInstructions(workspace);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].kind).toBe("agents");
  });

  it("loads .stewardly/instructions.md with higher priority", async () => {
    await fs.mkdir(path.join(workspace, ".stewardly"), { recursive: true });
    await fs.writeFile(path.join(workspace, ".stewardly/instructions.md"), "stewardly override");
    await fs.writeFile(path.join(workspace, "CLAUDE.md"), "claude rules");
    const result = await loadProjectInstructions(workspace);
    expect(result.entries).toHaveLength(2);
    // Priority order: stewardly first
    expect(result.entries[0].kind).toBe("stewardly");
    expect(result.entries[1].kind).toBe("claude");
  });

  it("loads all three sources when present", async () => {
    await fs.mkdir(path.join(workspace, ".stewardly"), { recursive: true });
    await fs.writeFile(path.join(workspace, ".stewardly/instructions.md"), "a");
    await fs.writeFile(path.join(workspace, "CLAUDE.md"), "b");
    await fs.writeFile(path.join(workspace, "AGENTS.md"), "c");
    const result = await loadProjectInstructions(workspace);
    expect(result.entries.map((e) => e.kind)).toEqual(["stewardly", "claude", "agents"]);
  });

  it("truncates files over MAX_BYTES", async () => {
    const big = "x".repeat(MAX_BYTES + 5_000);
    await fs.writeFile(path.join(workspace, "CLAUDE.md"), big);
    const result = await loadProjectInstructions(workspace);
    expect(result.entries[0].truncated).toBe(true);
    expect(result.entries[0].byteLength).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("ignores directories that happen to match a source name", async () => {
    await fs.mkdir(path.join(workspace, "CLAUDE.md"));
    const result = await loadProjectInstructions(workspace);
    expect(result.entries).toEqual([]);
  });

  it("caches identical files across successive loads", async () => {
    const filePath = path.join(workspace, "CLAUDE.md");
    await fs.writeFile(filePath, "original");
    const first = await loadProjectInstructions(workspace);
    // Second load without touching the file returns the same entry
    const second = await loadProjectInstructions(workspace);
    expect(second.entries[0].content).toBe("original");
    expect(first.entries[0].content).toBe("original");
  });

  it("invalidates cache on mtime change", async () => {
    const filePath = path.join(workspace, "CLAUDE.md");
    await fs.writeFile(filePath, "v1");
    await loadProjectInstructions(workspace);
    // Bump mtime explicitly to a future timestamp
    const future = new Date(Date.now() + 5000);
    await fs.writeFile(filePath, "v2");
    await fs.utimes(filePath, future, future);
    const second = await loadProjectInstructions(workspace);
    expect(second.entries[0].content).toBe("v2");
  });
});

describe("buildInstructionsPromptOverlay", () => {
  it("returns empty string for empty result", () => {
    expect(buildInstructionsPromptOverlay({ entries: [], totalBytes: 0 })).toBe("");
  });

  it("wraps single entry with header + content", () => {
    const overlay = buildInstructionsPromptOverlay({
      entries: [
        {
          path: "CLAUDE.md",
          content: "Rule A",
          byteLength: 6,
          truncated: false,
          kind: "claude",
        },
      ],
      totalBytes: 6,
    });
    expect(overlay).toContain("Project instructions");
    expect(overlay).toContain("CLAUDE.md");
    expect(overlay).toContain("Rule A");
  });

  it("marks truncated entries in the header", () => {
    const overlay = buildInstructionsPromptOverlay({
      entries: [
        {
          path: "CLAUDE.md",
          content: "x",
          byteLength: 1,
          truncated: true,
          kind: "claude",
        },
      ],
      totalBytes: 1,
    });
    expect(overlay).toContain("(truncated)");
  });

  it("separates multiple entries with a divider", () => {
    const overlay = buildInstructionsPromptOverlay({
      entries: [
        { path: ".stewardly/instructions.md", content: "A", byteLength: 1, truncated: false, kind: "stewardly" },
        { path: "CLAUDE.md", content: "B", byteLength: 1, truncated: false, kind: "claude" },
      ],
      totalBytes: 2,
    });
    expect(overlay).toContain("---");
    expect(overlay).toContain(".stewardly/instructions.md");
    expect(overlay).toContain("CLAUDE.md");
  });
});

describe("manifestForUI", () => {
  it("strips full content but keeps a 512-char preview", () => {
    const m = manifestForUI({
      entries: [
        {
          path: "CLAUDE.md",
          content: "a".repeat(2000),
          byteLength: 2000,
          truncated: false,
          kind: "claude",
        },
      ],
      totalBytes: 2000,
    });
    expect(m.entries[0]).not.toHaveProperty("content");
    expect(m.entries[0].preview.length).toBe(512);
  });

  it("propagates total bytes", () => {
    const m = manifestForUI({
      entries: [
        { path: "CLAUDE.md", content: "x", byteLength: 1, truncated: false, kind: "claude" },
      ],
      totalBytes: 1,
    });
    expect(m.totalBytes).toBe(1);
  });
});
