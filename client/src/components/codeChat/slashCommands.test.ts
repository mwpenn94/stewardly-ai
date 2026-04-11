/**
 * Tests for the slash-command registry (Pass 203).
 */

import { describe, it, expect, vi } from "vitest";
import {
  BUILT_IN_COMMANDS,
  parseSlashInput,
  resolveCommand,
  filterCommands,
  tryRunSlashCommand,
  type SlashCommandContext,
} from "./slashCommands";

function mockCtx(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
  return {
    clear: vi.fn(),
    cancel: vi.fn(),
    setInput: vi.fn(),
    setAllowMutations: vi.fn(),
    setMaxIterations: vi.fn(),
    setModel: vi.fn(),
    toast: vi.fn(),
    isAdmin: false,
    ...overrides,
  };
}

describe("parseSlashInput", () => {
  it("parses plain commands", () => {
    expect(parseSlashInput("/clear")).toEqual({ name: "clear", args: "" });
  });
  it("parses commands with args", () => {
    expect(parseSlashInput("/diff path/to/file.ts")).toEqual({
      name: "diff",
      args: "path/to/file.ts",
    });
  });
  it("ignores non-slash input", () => {
    expect(parseSlashInput("hello")).toBeNull();
    expect(parseSlashInput("")).toBeNull();
    expect(parseSlashInput("/")).toBeNull();
  });
  it("preserves multi-word args including spaces", () => {
    expect(parseSlashInput("/find  my pattern")).toEqual({
      name: "find",
      args: " my pattern",
    });
  });
});

describe("resolveCommand", () => {
  it("resolves primary names case-insensitively", () => {
    expect(resolveCommand("clear")?.name).toBe("clear");
    expect(resolveCommand("CLEAR")?.name).toBe("clear");
  });
  it("resolves aliases", () => {
    expect(resolveCommand("c")?.name).toBe("clear");
    expect(resolveCommand("h")?.name).toBe("help");
    expect(resolveCommand("?")?.name).toBe("help");
    expect(resolveCommand("stop")?.name).toBe("cancel");
  });
  it("returns null for unknown commands", () => {
    expect(resolveCommand("nope")).toBeNull();
  });
});

describe("filterCommands", () => {
  it("returns all commands for empty query (capped by limit)", () => {
    const all = filterCommands("", BUILT_IN_COMMANDS, 100);
    expect(all.length).toBe(BUILT_IN_COMMANDS.length);
  });

  it("ranks exact name matches highest", () => {
    const r = filterCommands("clear");
    expect(r[0].name).toBe("clear");
  });

  it("matches by prefix", () => {
    const r = filterCommands("iter");
    expect(r[0].name).toBe("iterations");
  });

  it("matches by description substring", () => {
    const r = filterCommands("admin");
    // "write" command mentions admin
    expect(r.some((c) => c.name === "write")).toBe(true);
  });

  it("respects the limit argument", () => {
    const r = filterCommands("", BUILT_IN_COMMANDS, 3);
    expect(r).toHaveLength(3);
  });
});

describe("tryRunSlashCommand — built-ins", () => {
  it("returns null for non-slash input", async () => {
    const ctx = mockCtx();
    expect(await tryRunSlashCommand("hello world", ctx)).toBeNull();
  });

  it("runs /clear and calls ctx.clear", async () => {
    const ctx = mockCtx();
    const result = await tryRunSlashCommand("/clear", ctx);
    expect(result).toEqual({ handled: true });
    expect(ctx.clear).toHaveBeenCalledTimes(1);
    expect(ctx.toast).toHaveBeenCalledWith("success", "Chat cleared");
  });

  it("runs /c alias", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/c", ctx);
    expect(ctx.clear).toHaveBeenCalled();
  });

  it("runs /cancel and calls ctx.cancel", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/cancel", ctx);
    expect(ctx.cancel).toHaveBeenCalled();
  });

  // Pass v5 #80: /help dispatches a window event so the overlay opens
  // instead of dumping a wall of text into a toast. The tests run in
  // a Node environment with no global `window`, so we stub a minimal
  // DOM event target so the handler can dispatch into it.
  function withWindowStub<T>(fn: (received: () => boolean) => Promise<T>): Promise<T> {
    let received = false;
    const listeners = new Set<() => void>();
    const stub = {
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: (_event: unknown) => {
        for (const l of listeners) l();
        return true;
      },
    };
    const hadGlobal = "window" in globalThis;
    const prior = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = stub;
    const listener = () => { received = true; };
    (stub as unknown as Window).addEventListener("codechat-show-shortcuts", listener);
    return Promise.resolve(fn(() => received)).finally(() => {
      if (hadGlobal) {
        (globalThis as unknown as { window: unknown }).window = prior;
      } else {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });
  }

  it("runs /help and dispatches codechat-show-shortcuts", async () => {
    const ctx = mockCtx();
    await withWindowStub(async (received) => {
      const r = await tryRunSlashCommand("/help", ctx);
      expect(r).toEqual({ handled: true });
      expect(received()).toBe(true);
      // Should NOT dump command list into a toast
      expect(ctx.toast).not.toHaveBeenCalled();
    });
  });

  it("/h alias also dispatches the shortcuts event", async () => {
    const ctx = mockCtx();
    await withWindowStub(async (received) => {
      await tryRunSlashCommand("/h", ctx);
      expect(received()).toBe(true);
    });
  });

  it("refuses /write for non-admin", async () => {
    const ctx = mockCtx({ isAdmin: false });
    await tryRunSlashCommand("/write on", ctx);
    expect(ctx.setAllowMutations).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith(
      "error",
      expect.stringMatching(/admin role/),
    );
  });

  it("accepts /write on for admin", async () => {
    const ctx = mockCtx({ isAdmin: true });
    await tryRunSlashCommand("/write on", ctx);
    expect(ctx.setAllowMutations).toHaveBeenCalledWith(true);
  });

  it("accepts /write off", async () => {
    const ctx = mockCtx({ isAdmin: true });
    await tryRunSlashCommand("/write off", ctx);
    expect(ctx.setAllowMutations).toHaveBeenCalledWith(false);
  });

  it("rejects /write with bad args", async () => {
    const ctx = mockCtx({ isAdmin: true });
    await tryRunSlashCommand("/write maybe", ctx);
    expect(ctx.setAllowMutations).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith(
      "error",
      expect.stringMatching(/usage/i),
    );
  });

  it("runs /iterations with valid number", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/iterations 7", ctx);
    expect(ctx.setMaxIterations).toHaveBeenCalledWith(7);
  });

  it("rejects /iterations with invalid number", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/iterations 42", ctx);
    expect(ctx.setMaxIterations).not.toHaveBeenCalled();
  });

  it("runs /model with a model id", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/model gpt-4o", ctx);
    expect(ctx.setModel).toHaveBeenCalledWith("gpt-4o");
  });

  it("runs /model empty to clear override", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/model", ctx);
    expect(ctx.setModel).toHaveBeenCalledWith(undefined);
  });

  it("/diff returns a rewrite instruction", async () => {
    const ctx = mockCtx();
    const r = await tryRunSlashCommand("/diff server/foo.ts", ctx);
    expect(r).toMatchObject({ handled: true });
    if (r && "rewrite" in r) {
      expect(r.rewrite).toContain("server/foo.ts");
      expect(r.rewrite).toContain("unified diff");
    }
  });

  it("/explain returns a rewrite instruction", async () => {
    const r = await tryRunSlashCommand("/explain server/foo.ts", mockCtx());
    expect(r).toMatchObject({ handled: true });
    if (r && "rewrite" in r) {
      expect(r.rewrite).toContain("server/foo.ts");
    }
  });

  it("/find returns a rewrite instruction", async () => {
    const r = await tryRunSlashCommand("/find getDb", mockCtx());
    if (r && "rewrite" in r) {
      expect(r.rewrite).toContain("getDb");
    }
  });

  it("returns handled:false for unknown commands", async () => {
    const r = await tryRunSlashCommand("/bogus args", mockCtx());
    expect(r).toEqual({
      handled: false,
      error: "Unknown slash command: /bogus",
    });
  });

  it("/compact returns the compact intent with default keepRecent", async () => {
    const r = await tryRunSlashCommand("/compact", mockCtx());
    expect(r).toMatchObject({ handled: true, compact: true, keepRecent: 4 });
  });

  it("/compact with a numeric arg overrides keepRecent", async () => {
    const r = await tryRunSlashCommand("/compact 6", mockCtx());
    expect(r).toMatchObject({ handled: true, compact: true, keepRecent: 6 });
  });

  it("/compact with invalid arg returns handled:true without compact flag", async () => {
    const r = await tryRunSlashCommand("/compact abc", mockCtx());
    expect(r).toMatchObject({ handled: true });
    if (r && "compact" in r) expect(r.compact).toBeUndefined();
  });

  it("/plan rewrites into a plan-generation prompt (Pass 236)", async () => {
    const r = await tryRunSlashCommand("/plan refactor auth layer", mockCtx());
    expect(r).toMatchObject({ handled: true });
    if (r && "rewrite" in r && r.rewrite) {
      expect(r.rewrite).toContain("step-by-step plan");
      expect(r.rewrite).toContain("refactor auth layer");
      expect(r.rewrite).toContain("do NOT execute");
    }
  });

  it("/p alias also expands the plan prompt", async () => {
    const r = await tryRunSlashCommand("/p add feature flag to chat", mockCtx());
    expect(r).toMatchObject({ handled: true });
    if (r && "rewrite" in r && r.rewrite) {
      expect(r.rewrite).toContain("add feature flag to chat");
    }
  });

  it("/plan with empty body is a no-op", async () => {
    const r = await tryRunSlashCommand("/plan   ", mockCtx());
    expect(r).toEqual({ handled: true });
    if (r && "rewrite" in r) expect(r.rewrite).toBeUndefined();
  });

  it("/remember with a fact calls toast success (Pass 241)", async () => {
    const ctx = mockCtx();
    const r = await tryRunSlashCommand("/remember use pnpm", ctx);
    expect(r).toEqual({ handled: true });
    expect(ctx.toast).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("use pnpm"),
    );
  });

  it("/remember without a fact shows an error", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/remember   ", ctx);
    expect(ctx.toast).toHaveBeenCalledWith("error", expect.stringMatching(/usage/));
  });

  it("/mem alias also works", async () => {
    const ctx = mockCtx();
    await tryRunSlashCommand("/mem always use drizzle", ctx);
    expect(ctx.toast).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("drizzle"),
    );
  });
});
