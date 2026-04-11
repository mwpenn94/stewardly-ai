/**
 * Tests for the server-side hook matcher in codeChatStream.ts
 * (Pass 249). The matcher mirrors the client-side pure module in
 * client/src/components/codeChat/hooks.ts — both must evaluate the
 * same pattern grammar identically so that Pre/PostToolUse hook
 * rules evaluated on the server produce the same decision the user
 * would see previewing them in the UI.
 */

import { describe, it, expect } from "vitest";
import { evaluateToolHooks } from "./codeChatStream";

const BASE_RULE = {
  event: "PreToolUse" as const,
  pattern: "write_*:*.env",
  action: "block" as const,
  message: "no env writes",
};

describe("evaluateToolHooks", () => {
  it("returns empty outcome when no rules", () => {
    const o = evaluateToolHooks([], "PreToolUse", "read_file", {});
    expect(o.blocked).toBe(false);
    expect(o.warnings).toEqual([]);
  });

  it("blocks when a tool+arg pattern matches", () => {
    const o = evaluateToolHooks(
      [BASE_RULE],
      "PreToolUse",
      "write_file",
      { path: "config/.env" },
    );
    expect(o.blocked).toBe(true);
    expect(o.blockMessage).toBe("no env writes");
  });

  it("does not block when arg doesn't match", () => {
    const o = evaluateToolHooks(
      [BASE_RULE],
      "PreToolUse",
      "write_file",
      { path: "config/foo.ts" },
    );
    expect(o.blocked).toBe(false);
  });

  it("does not block when event mismatches", () => {
    const o = evaluateToolHooks(
      [BASE_RULE],
      "PostToolUse",
      "write_file",
      { path: "config/.env" },
    );
    expect(o.blocked).toBe(false);
  });

  it("accumulates warnings from multiple rules", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "read_file",
          action: "warn",
          message: "slow",
        },
        {
          event: "PreToolUse",
          pattern: "read_file",
          action: "warn",
          message: "expensive",
        },
      ],
      "PreToolUse",
      "read_file",
      {},
    );
    expect(o.warnings).toHaveLength(2);
    expect(o.warnings.map((w) => w.message).sort()).toEqual([
      "expensive",
      "slow",
    ]);
  });

  it("first block wins on blockMessage", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "write_*",
          action: "block",
          message: "first block",
        },
        {
          event: "PreToolUse",
          pattern: "write_file",
          action: "block",
          message: "second block",
        },
      ],
      "PreToolUse",
      "write_file",
      {},
    );
    expect(o.blocked).toBe(true);
    expect(o.blockMessage).toBe("first block");
  });

  it("supports OR groups with [a|b]", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "[read_file|list_directory]",
          action: "warn",
          message: "explore",
        },
      ],
      "PreToolUse",
      "list_directory",
      { path: "." },
    );
    expect(o.warnings).toHaveLength(1);
  });

  it("wildcard * matches any tool", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "*",
          action: "warn",
          message: "every tool",
        },
      ],
      "PreToolUse",
      "whatever_tool",
      {},
    );
    expect(o.warnings).toHaveLength(1);
  });

  it("falls back to default block message when rule message is empty", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "write_file",
          action: "block",
          message: "",
        },
      ],
      "PreToolUse",
      "write_file",
      {},
    );
    expect(o.blocked).toBe(true);
    expect(o.blockMessage).toContain("write_file");
  });

  it("checks string arg values, not keys", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "run_bash:*rm -rf*",
          action: "block",
          message: "dangerous bash",
        },
      ],
      "PreToolUse",
      "run_bash",
      { command: "rm -rf node_modules" },
    );
    expect(o.blocked).toBe(true);
  });

  it("skips numeric args when matching arg part", () => {
    const o = evaluateToolHooks(
      [
        {
          event: "PreToolUse",
          pattern: "find_symbol:*",
          action: "warn",
          message: "x",
        },
      ],
      "PreToolUse",
      "find_symbol",
      { limit: 10 },
    );
    // limit is numeric — no string arg to match, so no warning fires
    expect(o.warnings).toEqual([]);
  });
});
