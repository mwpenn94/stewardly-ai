/**
 * Tests for toolSummary.ts (Pass 217).
 */

import { describe, it, expect } from "vitest";
import {
  summarizeToolEvents,
  summaryChips,
  summarySentence,
} from "./toolSummary";
import type { ToolEvent } from "@/hooks/useCodeChatStream";

const ev = (
  toolName: string,
  overrides: Partial<ToolEvent> = {},
): ToolEvent => ({
  stepIndex: overrides.stepIndex ?? 1,
  toolName,
  args: overrides.args ?? {},
  status: overrides.status ?? "complete",
  durationMs: overrides.durationMs ?? 10,
  ...overrides,
});

describe("summarizeToolEvents", () => {
  it("returns zero-summary for empty or undefined input", () => {
    const empty = summarizeToolEvents(undefined);
    expect(empty.reads).toBe(0);
    expect(empty.filesTouched).toEqual([]);
    const arr = summarizeToolEvents([]);
    expect(arr.reads).toBe(0);
  });

  it("counts each tool kind separately", () => {
    const s = summarizeToolEvents([
      ev("read_file", { args: { path: "a.ts" } }),
      ev("read_file", { args: { path: "b.ts" } }),
      ev("list_directory", { args: { path: "server/" } }),
      ev("grep_search", { args: { pattern: "getDb" } }),
      ev("write_file", { args: { path: "c.ts" } }),
      ev("edit_file", { args: { path: "a.ts" } }),
      ev("run_bash", { args: { command: "ls" } }),
    ]);
    expect(s.reads).toBe(2);
    expect(s.lists).toBe(1);
    expect(s.greps).toBe(1);
    expect(s.writes).toBe(1);
    expect(s.edits).toBe(1);
    expect(s.bashRuns).toBe(1);
  });

  it("counts errors across all tool kinds", () => {
    const s = summarizeToolEvents([
      ev("read_file", { status: "error" }),
      ev("grep_search", { status: "error" }),
      ev("read_file", { status: "complete" }),
    ]);
    expect(s.errors).toBe(2);
    // Errored reads still count toward the reads total
    expect(s.reads).toBe(2);
  });

  it("sums durations across events", () => {
    const s = summarizeToolEvents([
      ev("read_file", { durationMs: 10 }),
      ev("grep_search", { durationMs: 20 }),
      ev("edit_file", { durationMs: 30 }),
    ]);
    expect(s.totalDurationMs).toBe(60);
  });

  it("collects unique file paths from read/write/edit", () => {
    const s = summarizeToolEvents([
      ev("read_file", { args: { path: "a.ts" } }),
      ev("read_file", { args: { path: "a.ts" } }), // dup
      ev("edit_file", { args: { path: "b.ts" } }),
      ev("write_file", { args: { path: "c.ts" } }),
      ev("list_directory", { args: { path: "server/" } }), // list excluded
    ]);
    expect(s.filesTouched).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("tolerates missing path args", () => {
    const s = summarizeToolEvents([
      ev("read_file", { args: {} }),
      ev("write_file", {}),
    ]);
    expect(s.reads).toBe(1);
    expect(s.writes).toBe(1);
    expect(s.filesTouched).toEqual([]);
  });
});

describe("summaryChips", () => {
  it("filters zero counts", () => {
    const s = summarizeToolEvents([ev("read_file")]);
    const chips = summaryChips(s);
    expect(chips.every((c) => c.count > 0)).toBe(true);
    expect(chips.some((c) => c.key === "read")).toBe(true);
    expect(chips.some((c) => c.key === "bash")).toBe(false);
  });

  it("tags mutation tools as warn", () => {
    const s = summarizeToolEvents([
      ev("write_file"),
      ev("run_bash"),
    ]);
    const chips = summaryChips(s);
    expect(chips.find((c) => c.key === "write")?.variant).toBe("warn");
    expect(chips.find((c) => c.key === "bash")?.variant).toBe("warn");
  });

  it("tags error counts as error", () => {
    const s = summarizeToolEvents([ev("read_file", { status: "error" })]);
    const chips = summaryChips(s);
    expect(chips.find((c) => c.key === "errors")?.variant).toBe("error");
  });
});

describe("summarySentence", () => {
  it("returns 'no tool calls' for empty summary", () => {
    expect(summarySentence(summarizeToolEvents([]))).toBe("no tool calls");
  });

  it("uses singular/plural correctly", () => {
    const s = summarizeToolEvents([ev("read_file")]);
    expect(summarySentence(s)).toBe("1 read");
    const s2 = summarizeToolEvents([ev("read_file"), ev("read_file")]);
    expect(summarySentence(s2)).toBe("2 reads");
  });

  it("joins multiple parts with a separator", () => {
    const s = summarizeToolEvents([
      ev("read_file"),
      ev("grep_search"),
      ev("edit_file"),
    ]);
    expect(summarySentence(s)).toContain("1 read");
    expect(summarySentence(s)).toContain("1 grep");
    expect(summarySentence(s)).toContain("1 edit");
    expect(summarySentence(s)).toContain(" · ");
  });
});
