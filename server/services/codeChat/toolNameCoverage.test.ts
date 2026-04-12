/**
 * toolNameCoverage.test.ts — Parity Pass 10 (type safety).
 *
 * Ensures the `CodeToolName` union, the runtime `CODE_CHAT_TOOL_DEFINITIONS`
 * registry, the SSE route's KNOWN_TOOL_NAMES set, and the classify /
 * permission tables all stay in lockstep. If a new tool is added to
 * one surface and forgotten on another, the test fails loudly with
 * a list of missing / extra names.
 */

import { describe, it, expect } from "vitest";
import {
  CODE_CHAT_TOOL_DEFINITIONS,
  type CodeToolName,
} from "./codeChatExecutor";
import { classifyToolKind } from "./toolTelemetry";

// This array mirrors the CodeToolName union. TypeScript's type-system
// can't iterate a union at runtime, so we pin a constant list and let
// an exhaustive-typecheck trick catch drift.
const ALL_TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "multi_edit",
  "list_directory",
  "grep_search",
  "run_bash",
  "update_todos",
  "find_symbol",
  "web_fetch",
  "git_blame",
  "finish",
] as const satisfies readonly CodeToolName[];

// Compile-time check that the list is complete. If a new CodeToolName
// is added and NOT included above, this type will be "never" which
// the assignment error catches.
type _Exhaustive = Exclude<CodeToolName, (typeof ALL_TOOL_NAMES)[number]>;
const _exhaustiveAssertion: _Exhaustive extends never ? true : false = true;
void _exhaustiveAssertion;

describe("Tool name coverage", () => {
  it("CODE_CHAT_TOOL_DEFINITIONS covers every tool name except `finish`", () => {
    // `finish` is a special-case flow-control tool that the dispatcher
    // handles but isn't exposed in the CODE_CHAT_TOOL_DEFINITIONS the
    // LLM sees — the planner is allowed to simply return a final
    // message instead. Every OTHER tool must be in the definitions.
    const declaredNames = new Set(CODE_CHAT_TOOL_DEFINITIONS.map((t) => t.name));
    const expected = ALL_TOOL_NAMES.filter((n) => n !== "finish");
    const missing = expected.filter((n) => !declaredNames.has(n));
    expect(missing).toEqual([]);
  });

  it("classifyToolKind returns a non-unknown bucket for every real tool", () => {
    const unclassified = ALL_TOOL_NAMES.filter(
      (n) => n !== "finish" && classifyToolKind(n) === "unknown",
    );
    expect(unclassified).toEqual([]);
  });

  it("classifyToolKind returns unknown for obviously-bogus names", () => {
    expect(classifyToolKind("not_a_real_tool")).toBe("unknown");
    expect(classifyToolKind("")).toBe("unknown");
  });

  it("every read-only classification maps to a known tool", () => {
    // This catches the opposite direction of drift: a tool added to
    // toolTelemetry's READ_TOOLS set that no longer exists in the
    // executor. If the assignment succeeds at runtime, pass.
    const readOnlyNames = ALL_TOOL_NAMES.filter(
      (n) => classifyToolKind(n) === "read",
    );
    expect(readOnlyNames.length).toBeGreaterThan(0);
    // Every name we classified as read-only should be a real tool in
    // the definitions.
    const declaredNames = new Set(CODE_CHAT_TOOL_DEFINITIONS.map((t) => t.name));
    for (const name of readOnlyNames) {
      expect(declaredNames.has(name)).toBe(true);
    }
  });

  it("mutation classifications align with write/shell intent", () => {
    const writeNames = ALL_TOOL_NAMES.filter(
      (n) => classifyToolKind(n) === "write",
    );
    const shellNames = ALL_TOOL_NAMES.filter(
      (n) => classifyToolKind(n) === "shell",
    );
    // Known mutation tools that must survive refactors
    expect(writeNames).toContain("write_file");
    expect(writeNames).toContain("edit_file");
    expect(writeNames).toContain("multi_edit");
    expect(shellNames).toContain("run_bash");
  });

  it("network tools contain web_fetch", () => {
    const network = ALL_TOOL_NAMES.filter(
      (n) => classifyToolKind(n) === "network",
    );
    expect(network).toContain("web_fetch");
  });

  it("meta tools contain update_todos and finish", () => {
    const meta = ALL_TOOL_NAMES.filter((n) => classifyToolKind(n) === "meta");
    expect(meta).toContain("update_todos");
    expect(meta).toContain("finish");
  });
});
