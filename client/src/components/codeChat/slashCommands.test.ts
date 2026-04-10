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
});
