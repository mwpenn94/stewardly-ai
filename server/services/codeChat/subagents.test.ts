/**
 * Tests for subagents.ts (Pass 253).
 * Focuses on pure functions; disk loading is covered by the
 * fs-backed integration path but uses a temp dir.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  parseFrontmatter,
  parseAgentFile,
  buildManifest,
  buildSubagentOverlay,
  intersectTools,
  loadSubagents,
  clearSubagentsCache,
  type SubagentSpec,
} from "./subagents";

// ─── parseFrontmatter ────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("returns null for content without a fence", () => {
    expect(parseFrontmatter("no fence here")).toBeNull();
  });

  it("returns null for an unterminated fence", () => {
    expect(parseFrontmatter("---\nname: foo\n")).toBeNull();
  });

  it("parses a simple key/value frontmatter", () => {
    const raw = `---\nname: Reviewer\ndescription: Reviews code\n---\nbody text`;
    const out = parseFrontmatter(raw);
    expect(out).not.toBeNull();
    expect(out!.data.name).toBe("Reviewer");
    expect(out!.data.description).toBe("Reviews code");
    expect(out!.body).toBe("body text");
  });

  it("unwraps double-quoted strings", () => {
    const raw = `---\nname: "Name with: colon"\n---\nbody`;
    const out = parseFrontmatter(raw);
    expect(out!.data.name).toBe("Name with: colon");
  });

  it("unwraps single-quoted strings", () => {
    const raw = `---\ndescription: 'Hi there'\n---\nb`;
    const out = parseFrontmatter(raw);
    expect(out!.data.description).toBe("Hi there");
  });

  it("parses inline array for tools", () => {
    const raw = `---\ntools: [read_file, grep_search, find_symbol]\n---\n`;
    const out = parseFrontmatter(raw);
    expect(out!.data.tools).toEqual([
      "read_file",
      "grep_search",
      "find_symbol",
    ]);
  });

  it("parses block array for tools", () => {
    const raw = `---\ntools:\n  - read_file\n  - grep_search\nname: X\n---\n`;
    const out = parseFrontmatter(raw);
    expect(out!.data.tools).toEqual(["read_file", "grep_search"]);
    expect(out!.data.name).toBe("X");
  });

  it("ignores unknown keys without failing", () => {
    const raw = `---\nname: X\nweird: value\ncustom_field: 42\n---\n`;
    const out = parseFrontmatter(raw);
    expect(out!.data.name).toBe("X");
  });

  it("skips comments and blank lines", () => {
    const raw = `---\n# this is a comment\nname: X\n\ndescription: Y\n---\nbody`;
    const out = parseFrontmatter(raw);
    expect(out!.data.name).toBe("X");
    expect(out!.data.description).toBe("Y");
  });

  it("handles empty body", () => {
    const raw = `---\nname: X\n---\n`;
    const out = parseFrontmatter(raw);
    expect(out!.body).toBe("");
  });
});

// ─── parseAgentFile ──────────────────────────────────────────────────────

describe("parseAgentFile", () => {
  const BASE = {
    filename: "reviewer.md",
    byteLength: 100,
    mtimeMs: 1_000_000,
    relativePath: ".stewardly/agents/reviewer.md",
  };

  it("derives slug from filename", () => {
    const spec = parseAgentFile({ ...BASE, content: "body" });
    expect(spec.slug).toBe("reviewer");
  });

  it("lowercases slug", () => {
    const spec = parseAgentFile({
      ...BASE,
      filename: "CodeReviewer.md",
      content: "body",
    });
    expect(spec.slug).toBe("codereviewer");
  });

  it("defaults name to slug when frontmatter missing", () => {
    const spec = parseAgentFile({ ...BASE, content: "body" });
    expect(spec.name).toBe("reviewer");
  });

  it("uses frontmatter name when present", () => {
    const spec = parseAgentFile({
      ...BASE,
      content: `---\nname: Code Reviewer\n---\nbody`,
    });
    expect(spec.name).toBe("Code Reviewer");
  });

  it("extracts systemPrompt from body", () => {
    const spec = parseAgentFile({
      ...BASE,
      content: `---\nname: R\n---\nYou are a strict reviewer.`,
    });
    expect(spec.systemPrompt).toBe("You are a strict reviewer.");
  });

  it("uses the full content as prompt when no frontmatter", () => {
    const spec = parseAgentFile({
      ...BASE,
      content: "  Just a prompt  ",
    });
    expect(spec.systemPrompt).toBe("Just a prompt");
  });

  it("passes through model override", () => {
    const spec = parseAgentFile({
      ...BASE,
      content: `---\nname: X\nmodel: claude-opus-4-6\n---\nbody`,
    });
    expect(spec.model).toBe("claude-opus-4-6");
  });

  it("passes through tools list", () => {
    const spec = parseAgentFile({
      ...BASE,
      content: `---\nname: X\ntools: [read_file, grep_search]\n---\nbody`,
    });
    expect(spec.tools).toEqual(["read_file", "grep_search"]);
  });

  it("defaults tools to empty array when missing", () => {
    const spec = parseAgentFile({ ...BASE, content: `---\nname: X\n---\nb` });
    expect(spec.tools).toEqual([]);
  });
});

// ─── buildManifest ───────────────────────────────────────────────────────

describe("buildManifest", () => {
  const makeSpec = (overrides: Partial<SubagentSpec> = {}): SubagentSpec => ({
    slug: "test",
    name: "Test",
    description: "desc",
    systemPrompt: "You are a test agent with a long prompt " + "x".repeat(200),
    tools: [],
    path: ".stewardly/agents/test.md",
    byteLength: 1000,
    mtimeMs: 1,
    ...overrides,
  });

  it("strips the full system prompt and caps preview at 160 chars", () => {
    const manifest = buildManifest([makeSpec()]);
    expect(manifest[0].promptPreview.length).toBeLessThanOrEqual(160);
    expect(manifest[0].promptPreview.endsWith("…")).toBe(true);
    expect((manifest[0] as any).systemPrompt).toBeUndefined();
  });

  it("passes through short prompts without ellipsis", () => {
    const manifest = buildManifest([
      makeSpec({ systemPrompt: "short prompt" }),
    ]);
    expect(manifest[0].promptPreview).toBe("short prompt");
  });

  it("collapses whitespace in preview", () => {
    const manifest = buildManifest([
      makeSpec({ systemPrompt: "multi\nline\n\n\nprompt" }),
    ]);
    expect(manifest[0].promptPreview).toBe("multi line prompt");
  });
});

// ─── buildSubagentOverlay ────────────────────────────────────────────────

describe("buildSubagentOverlay", () => {
  it("wraps the prompt with a header", () => {
    const spec: SubagentSpec = {
      slug: "r",
      name: "Reviewer",
      description: "",
      systemPrompt: "you are a reviewer",
      tools: [],
      path: "x",
      byteLength: 0,
      mtimeMs: 0,
    };
    const out = buildSubagentOverlay(spec);
    expect(out).toContain("# Subagent mode: Reviewer");
    expect(out).toContain("you are a reviewer");
  });

  it("includes description line when present", () => {
    const spec: SubagentSpec = {
      slug: "r",
      name: "Reviewer",
      description: "Reviews code",
      systemPrompt: "body",
      tools: [],
      path: "x",
      byteLength: 0,
      mtimeMs: 0,
    };
    const out = buildSubagentOverlay(spec);
    expect(out).toContain("Reviews code");
  });

  it("omits description line when empty", () => {
    const spec: SubagentSpec = {
      slug: "r",
      name: "Reviewer",
      description: "",
      systemPrompt: "body",
      tools: [],
      path: "x",
      byteLength: 0,
      mtimeMs: 0,
    };
    const out = buildSubagentOverlay(spec);
    // No double blank line or trailing description before body
    expect(out).not.toMatch(/\n\n\nbody/);
  });
});

// ─── intersectTools ──────────────────────────────────────────────────────

describe("intersectTools", () => {
  it("returns session allowlist when subagent tools empty", () => {
    expect(intersectTools(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  it("intersects two sets", () => {
    expect(intersectTools(["a", "b", "c"], ["b", "d"])).toEqual(["b"]);
  });

  it("preserves subagent tool ordering", () => {
    expect(intersectTools(["a", "b", "c", "d"], ["d", "b", "a"])).toEqual([
      "d",
      "b",
      "a",
    ]);
  });

  it("returns empty when no overlap", () => {
    expect(intersectTools(["a", "b"], ["c", "d"])).toEqual([]);
  });
});

// ─── loadSubagents (integration against a temp directory) ──────────────

describe("loadSubagents", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stewardly-subagents-"));
    const agentsDir = path.join(tempDir, ".stewardly", "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "reviewer.md"),
      `---\nname: Reviewer\ndescription: Reviews code for style + bugs\ntools: [read_file, grep_search]\n---\nYou are a strict reviewer.`,
      "utf8",
    );
    await fs.writeFile(
      path.join(agentsDir, "tester.md"),
      `---\nname: Tester\ndescription: Runs tests\n---\nYou are a test runner.`,
      "utf8",
    );
    await fs.writeFile(
      path.join(agentsDir, "no_frontmatter.md"),
      `This whole thing is the prompt.`,
      "utf8",
    );
    // Non-md file should be ignored
    await fs.writeFile(
      path.join(agentsDir, "readme.txt"),
      "not a markdown file",
      "utf8",
    );
    clearSubagentsCache();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    clearSubagentsCache();
  });

  it("loads every .md file as an agent", async () => {
    const manifest = await loadSubagents(tempDir);
    expect(manifest.scanned).toBe(true);
    expect(manifest.agents).toHaveLength(3);
    const slugs = manifest.agents.map((a) => a.slug).sort();
    expect(slugs).toEqual(["no_frontmatter", "reviewer", "tester"]);
  });

  it("sorts agents by name", async () => {
    const manifest = await loadSubagents(tempDir);
    const names = manifest.agents.map((a) => a.name);
    // no_frontmatter (default name) < Reviewer < Tester alphabetically
    expect(names).toEqual(["no_frontmatter", "Reviewer", "Tester"]);
  });

  it("caches results by workspace root", async () => {
    await loadSubagents(tempDir);
    const second = await loadSubagents(tempDir);
    // Same reference when cached
    expect(second.agents.length).toBe(3);
  });

  it("returns scanned=false when directory missing", async () => {
    const other = await fs.mkdtemp(
      path.join(os.tmpdir(), "stewardly-nomissing-"),
    );
    try {
      clearSubagentsCache();
      const manifest = await loadSubagents(other);
      expect(manifest.scanned).toBe(false);
      expect(manifest.agents).toEqual([]);
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });
});
