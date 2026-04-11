/**
 * Tests for hooks.ts (Pass 249) — user-defined hook rule engine.
 */

import { describe, it, expect } from "vitest";
import {
  compilePattern,
  globToRegex,
  matchToolCall,
  makeHook,
  upsertHook,
  removeHook,
  toggleHook,
  filterByEvent,
  enabledHooks,
  evaluateToolCall,
  evaluatePrompt,
  applyPromptInjections,
  buildHookSystemOverlay,
  parseHooks,
  serializeHooks,
  summarizeHooks,
  MAX_HOOKS,
  MAX_MESSAGE_LENGTH,
  type HookRule,
} from "./hooks";

// ─── compilePattern ──────────────────────────────────────────────────────

describe("compilePattern", () => {
  it("returns null for empty or non-string input", () => {
    expect(compilePattern("")).toBeNull();
    expect(compilePattern("   ")).toBeNull();
    // @ts-expect-error — testing defensive parse
    expect(compilePattern(null)).toBeNull();
  });

  it("returns tool-only part when no colon", () => {
    const p = compilePattern("read_file");
    expect(p).toEqual({ toolPart: "read_file", argPart: null });
  });

  it("splits on first unescaped colon", () => {
    const p = compilePattern("write_*:*.env");
    expect(p).toEqual({ toolPart: "write_*", argPart: "*.env" });
  });

  it("handles escaped colons in left side", () => {
    const p = compilePattern("weird\\:tool:target.ts");
    expect(p?.toolPart).toBe("weird:tool");
    expect(p?.argPart).toBe("target.ts");
  });

  it("defaults tool to '*' when left side is empty", () => {
    const p = compilePattern(":foo.ts");
    expect(p?.toolPart).toBe("*");
    expect(p?.argPart).toBe("foo.ts");
  });

  it("returns null argPart when right side is empty after colon", () => {
    const p = compilePattern("read_file:");
    expect(p?.toolPart).toBe("read_file");
    expect(p?.argPart).toBeNull();
  });
});

// ─── globToRegex ─────────────────────────────────────────────────────────

describe("globToRegex", () => {
  it("converts * to .*", () => {
    expect(globToRegex("*").test("anything")).toBe(true);
    expect(globToRegex("write_*").test("write_file")).toBe(true);
    expect(globToRegex("write_*").test("read_file")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(globToRegex("read_file").test("READ_FILE")).toBe(true);
  });

  it("supports OR groups with [a|b|c]", () => {
    const rx = globToRegex("[read_file|write_file]");
    expect(rx.test("read_file")).toBe(true);
    expect(rx.test("write_file")).toBe(true);
    expect(rx.test("edit_file")).toBe(false);
  });

  it("matches file glob *.env", () => {
    const rx = globToRegex("*.env");
    expect(rx.test(".env")).toBe(true);
    expect(rx.test(".env.local")).toBe(false); // anchored
    expect(rx.test("config/prod.env")).toBe(true);
  });

  it("escapes regex metacharacters", () => {
    const rx = globToRegex("foo.bar");
    expect(rx.test("foo.bar")).toBe(true);
    expect(rx.test("fooxbar")).toBe(false);
  });
});

// ─── matchToolCall ───────────────────────────────────────────────────────

describe("matchToolCall", () => {
  it("matches by tool name only", () => {
    const p = compilePattern("read_file")!;
    expect(matchToolCall(p, "read_file", {})).toBe(true);
    expect(matchToolCall(p, "write_file", {})).toBe(false);
  });

  it("wildcard tool matches anything", () => {
    const p = compilePattern("*")!;
    expect(matchToolCall(p, "read_file", {})).toBe(true);
    expect(matchToolCall(p, "anything_else", {})).toBe(true);
  });

  it("matches on arg value when argPart provided", () => {
    const p = compilePattern("write_*:*.env")!;
    expect(matchToolCall(p, "write_file", { path: "config/.env" })).toBe(true);
    expect(matchToolCall(p, "write_file", { path: "config/foo.ts" })).toBe(false);
  });

  it("fails arg check when no string arg matches", () => {
    const p = compilePattern("read_file:auth.ts")!;
    expect(matchToolCall(p, "read_file", { path: "other.ts" })).toBe(false);
  });

  it("matches any string arg, not just `path`", () => {
    const p = compilePattern("*:*.env")!;
    expect(matchToolCall(p, "run_bash", { command: "cat .env" })).toBe(true);
  });

  it("requires tool match even when arg matches", () => {
    const p = compilePattern("write_file:foo.ts")!;
    expect(matchToolCall(p, "read_file", { path: "foo.ts" })).toBe(false);
  });
});

// ─── makeHook / upsertHook / removeHook / toggleHook ────────────────────

describe("makeHook", () => {
  it("builds a hook with defaults", () => {
    const h = makeHook({
      event: "PreToolUse",
      pattern: "write_*",
      action: "block",
    });
    expect(h.enabled).toBe(true);
    expect(h.message).toBe("");
    expect(h.id).toMatch(/./);
    expect(h.createdAt).toBeGreaterThan(0);
  });

  it("clamps message to MAX_MESSAGE_LENGTH", () => {
    const long = "x".repeat(MAX_MESSAGE_LENGTH + 500);
    const h = makeHook({
      event: "PreToolUse",
      pattern: "*",
      action: "warn",
      message: long,
    });
    expect(h.message.length).toBe(MAX_MESSAGE_LENGTH);
  });

  it("trims pattern", () => {
    const h = makeHook({
      event: "PreToolUse",
      pattern: "  read_file  ",
      action: "warn",
    });
    expect(h.pattern).toBe("read_file");
  });
});

describe("upsertHook", () => {
  it("inserts a new hook at the front", () => {
    const existing = [
      makeHook({ event: "PreToolUse", pattern: "a", action: "warn" }),
    ];
    const next = makeHook({ event: "PreToolUse", pattern: "b", action: "block" });
    const out = upsertHook(existing, next);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe(next.id);
  });

  it("replaces an existing hook by id", () => {
    const first = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    const second = makeHook({
      event: "PreToolUse",
      pattern: "a-renamed",
      action: "block",
      id: first.id,
    });
    const out = upsertHook([first], second);
    expect(out).toHaveLength(1);
    expect(out[0].pattern).toBe("a-renamed");
    expect(out[0].action).toBe("block");
  });

  it("sorts by updatedAt descending", async () => {
    const a = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    // bump time
    await new Promise((r) => setTimeout(r, 2));
    const b = makeHook({ event: "PreToolUse", pattern: "b", action: "warn" });
    const out = upsertHook([a], b);
    expect(out[0].id).toBe(b.id);
  });

  it("caps at MAX_HOOKS", () => {
    let hooks: HookRule[] = [];
    for (let i = 0; i < MAX_HOOKS + 10; i++) {
      hooks = upsertHook(
        hooks,
        makeHook({
          event: "PreToolUse",
          pattern: `pat-${i}`,
          action: "warn",
          id: `id-${i}`,
        }),
      );
    }
    expect(hooks.length).toBe(MAX_HOOKS);
  });
});

describe("removeHook / toggleHook", () => {
  it("removes by id", () => {
    const a = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    const b = makeHook({ event: "PreToolUse", pattern: "b", action: "warn" });
    const out = removeHook([a, b], a.id);
    expect(out).toEqual([b]);
  });

  it("toggle flips enabled flag", () => {
    const h = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    const out = toggleHook([h], h.id);
    expect(out[0].enabled).toBe(false);
    const back = toggleHook(out, h.id);
    expect(back[0].enabled).toBe(true);
  });
});

describe("filterByEvent / enabledHooks", () => {
  it("filters by event", () => {
    const a = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    const b = makeHook({ event: "PostToolUse", pattern: "b", action: "warn" });
    expect(filterByEvent([a, b], "PreToolUse")).toEqual([a]);
  });

  it("returns only enabled hooks", () => {
    const a = makeHook({ event: "PreToolUse", pattern: "a", action: "warn" });
    const b = makeHook({
      event: "PreToolUse",
      pattern: "b",
      action: "warn",
      enabled: false,
    });
    expect(enabledHooks([a, b])).toEqual([a]);
  });
});

// ─── evaluateToolCall ────────────────────────────────────────────────────

describe("evaluateToolCall", () => {
  it("returns empty outcome when no hooks match", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "write_*",
        action: "block",
        message: "no writes",
      }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "read_file", {});
    expect(o.blocked).toBe(false);
    expect(o.warnings).toEqual([]);
    expect(o.matchedIds).toEqual([]);
  });

  it("blocks on first block rule", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "write_file:*.env",
        action: "block",
        message: "no .env writes",
      }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "write_file", {
      path: ".env",
    });
    expect(o.blocked).toBe(true);
    expect(o.blockReason).toBe("no .env writes");
  });

  it("accumulates warnings", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "read_file",
        action: "warn",
        message: "slow",
      }),
      makeHook({
        event: "PreToolUse",
        pattern: "read_file",
        action: "warn",
        message: "expensive",
      }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "read_file", {});
    expect(o.warnings).toHaveLength(2);
  });

  it("collects prompt and system injections separately", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "write_file",
        action: "inject_prompt",
        message: "remember the style guide",
      }),
      makeHook({
        event: "PreToolUse",
        pattern: "write_file",
        action: "inject_system",
        message: "use tabs not spaces",
      }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "write_file", {});
    expect(o.promptInjections).toEqual(["remember the style guide"]);
    expect(o.systemInjections).toEqual(["use tabs not spaces"]);
  });

  it("skips disabled hooks", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "*",
        action: "block",
        enabled: false,
      }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "read_file", {});
    expect(o.blocked).toBe(false);
  });

  it("does not fire for wrong event kind", () => {
    const hooks = [
      makeHook({ event: "PostToolUse", pattern: "*", action: "block" }),
    ];
    const o = evaluateToolCall(hooks, "PreToolUse", "read_file", {});
    expect(o.blocked).toBe(false);
  });

  it("earliest block wins on reason", () => {
    const first = makeHook({
      event: "PreToolUse",
      pattern: "write_*",
      action: "block",
      message: "first block",
    });
    const second = makeHook({
      event: "PreToolUse",
      pattern: "write_file",
      action: "block",
      message: "second block",
    });
    const o = evaluateToolCall(
      [first, second],
      "PreToolUse",
      "write_file",
      {},
    );
    expect(o.blocked).toBe(true);
    expect(o.blockReason).toBe("first block");
  });
});

// ─── evaluatePrompt ──────────────────────────────────────────────────────

describe("evaluatePrompt", () => {
  it("matches UserPromptSubmit hook against prompt text", () => {
    const hooks = [
      makeHook({
        event: "UserPromptSubmit",
        pattern: "*deploy*",
        action: "warn",
        message: "check CI before deploying",
      }),
    ];
    const o = evaluatePrompt(hooks, "UserPromptSubmit", "ok please deploy to prod");
    expect(o.warnings).toEqual(["check CI before deploying"]);
  });

  it("matches SessionStart with '*' wildcard", () => {
    const hooks = [
      makeHook({
        event: "SessionStart",
        pattern: "*",
        action: "inject_system",
        message: "Stewardly house rules: always explain changes.",
      }),
    ];
    const o = evaluatePrompt(hooks, "SessionStart", "");
    expect(o.systemInjections).toEqual([
      "Stewardly house rules: always explain changes.",
    ]);
  });

  it("doesn't fire a SessionStart rule on UserPromptSubmit event", () => {
    const hooks = [
      makeHook({
        event: "SessionStart",
        pattern: "*",
        action: "inject_system",
        message: "x",
      }),
    ];
    const o = evaluatePrompt(hooks, "UserPromptSubmit", "hello");
    expect(o.systemInjections).toEqual([]);
  });

  it("supports plain substring matching as convenience", () => {
    const hooks = [
      makeHook({
        event: "UserPromptSubmit",
        pattern: "production",
        action: "block",
        message: "no prod changes from chat",
      }),
    ];
    const o = evaluatePrompt(
      hooks,
      "UserPromptSubmit",
      "apply this migration to production",
    );
    expect(o.blocked).toBe(true);
    expect(o.blockReason).toBe("no prod changes from chat");
  });
});

// ─── applyPromptInjections / buildHookSystemOverlay ─────────────────────

describe("applyPromptInjections", () => {
  it("returns prompt unchanged when no injections", () => {
    expect(applyPromptInjections("hello", [])).toBe("hello");
  });

  it("prepends a hook context block", () => {
    const out = applyPromptInjections("fix the bug", [
      "don't touch auth.ts",
      "use TypeScript strict mode",
    ]);
    expect(out).toContain("[Hook context");
    expect(out).toContain("don't touch auth.ts");
    expect(out).toContain("use TypeScript strict mode");
    expect(out).toContain("fix the bug");
    expect(out.indexOf("fix the bug")).toBeGreaterThan(out.indexOf("[Hook context"));
  });
});

describe("buildHookSystemOverlay", () => {
  it("returns empty when no injections", () => {
    expect(buildHookSystemOverlay([])).toBe("");
  });

  it("builds a markdown block", () => {
    const out = buildHookSystemOverlay(["rule 1", "rule 2"]);
    expect(out).toContain("# User-defined hook rules");
    expect(out).toContain("- rule 1");
    expect(out).toContain("- rule 2");
  });
});

// ─── parseHooks / serializeHooks ─────────────────────────────────────────

describe("parseHooks", () => {
  it("returns [] on null/empty/bad JSON", () => {
    expect(parseHooks(null)).toEqual([]);
    expect(parseHooks("")).toEqual([]);
    expect(parseHooks("{not json")).toEqual([]);
    expect(parseHooks("42")).toEqual([]);
    expect(parseHooks('"hello"')).toEqual([]);
  });

  it("drops malformed entries", () => {
    const raw = JSON.stringify([
      { pattern: "ok", event: "PreToolUse", action: "warn" }, // valid
      { pattern: "", event: "PreToolUse", action: "warn" }, // empty pattern
      { pattern: "ok", event: "nope", action: "warn" }, // bad event
      { pattern: "ok", event: "PreToolUse", action: "burn" }, // bad action
      { foo: "bar" }, // totally malformed
      null,
    ]);
    const out = parseHooks(raw);
    expect(out).toHaveLength(1);
    expect(out[0].pattern).toBe("ok");
  });

  it("round-trips with serializeHooks", () => {
    const hooks = [
      makeHook({
        event: "PreToolUse",
        pattern: "write_file",
        action: "block",
        message: "no writes",
      }),
      makeHook({
        event: "UserPromptSubmit",
        pattern: "*deploy*",
        action: "warn",
        message: "CI first",
      }),
    ];
    const raw = serializeHooks(hooks);
    const back = parseHooks(raw);
    expect(back).toHaveLength(2);
    expect(back.map((h) => h.pattern).sort()).toEqual(
      ["*deploy*", "write_file"].sort(),
    );
  });

  it("defaults enabled=true when missing", () => {
    const raw = JSON.stringify([
      { pattern: "a", event: "PreToolUse", action: "warn" },
    ]);
    const out = parseHooks(raw);
    expect(out[0].enabled).toBe(true);
  });

  it("respects enabled=false when present", () => {
    const raw = JSON.stringify([
      { pattern: "a", event: "PreToolUse", action: "warn", enabled: false },
    ]);
    const out = parseHooks(raw);
    expect(out[0].enabled).toBe(false);
  });

  it("clamps at MAX_HOOKS", () => {
    const many = Array.from({ length: MAX_HOOKS + 20 }, (_, i) => ({
      pattern: `pat-${i}`,
      event: "PreToolUse",
      action: "warn",
      id: `id-${i}`,
    }));
    const out = parseHooks(JSON.stringify(many));
    expect(out.length).toBe(MAX_HOOKS);
  });
});

// ─── summarizeHooks ──────────────────────────────────────────────────────

describe("summarizeHooks", () => {
  it("returns zero struct for empty", () => {
    const s = summarizeHooks([]);
    expect(s.total).toBe(0);
    expect(s.enabled).toBe(0);
    expect(s.byEvent.PreToolUse).toBe(0);
  });

  it("counts by event and action", () => {
    const s = summarizeHooks([
      makeHook({ event: "PreToolUse", pattern: "*", action: "block" }),
      makeHook({ event: "PreToolUse", pattern: "*", action: "warn", enabled: false }),
      makeHook({ event: "PostToolUse", pattern: "*", action: "inject_prompt" }),
      makeHook({ event: "SessionStart", pattern: "*", action: "inject_system" }),
    ]);
    expect(s.total).toBe(4);
    expect(s.enabled).toBe(3);
    expect(s.byEvent.PreToolUse).toBe(2);
    expect(s.byEvent.PostToolUse).toBe(1);
    expect(s.byEvent.SessionStart).toBe(1);
    expect(s.byAction.block).toBe(1);
    expect(s.byAction.warn).toBe(1);
    expect(s.byAction.inject_prompt).toBe(1);
    expect(s.byAction.inject_system).toBe(1);
  });
});
