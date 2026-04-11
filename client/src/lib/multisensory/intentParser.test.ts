/**
 * intentParser.test.ts — locks in the behaviour of the multisensory intent
 * parser. The parser is the single ground-truth for both voice utterances
 * and typed slash commands, so regressions here break hands-free mode
 * AND the /go text command simultaneously.
 */

import { describe, it, expect } from "vitest";
import {
  ROUTE_MAP,
  routeMapDestinations,
  friendlyRouteName,
  parseIntent,
  resolveNavTarget,
} from "./intentParser";

describe("ROUTE_MAP", () => {
  it("never maps to a placeholder route", () => {
    for (const route of Object.values(ROUTE_MAP)) {
      expect(route.startsWith("/")).toBe(true);
      expect(route).not.toContain("undefined");
      expect(route).not.toContain("null");
    }
  });

  it("has at least one entry per major persona (chat/clients/learning/settings)", () => {
    const dests = routeMapDestinations();
    expect(dests).toContain("/chat");
    expect(dests).toContain("/relationships");
    expect(dests).toContain("/learning");
    expect(dests).toContain("/settings");
    expect(dests).toContain("/settings/audio");
  });

  it("friendlyRouteName returns a human-readable label for known routes", () => {
    expect(friendlyRouteName("/chat")).toBe("Chat");
    expect(friendlyRouteName("/settings/audio")).toBe("Audio Settings");
    expect(friendlyRouteName("/learning/flashcards")).toBe("Flashcards");
  });

  it("friendlyRouteName degrades gracefully on unknown routes", () => {
    expect(friendlyRouteName("/some-future-page")).toBe("Some Future Page");
    expect(friendlyRouteName("/")).toBe("Page");
  });
});

describe("parseIntent — audio commands", () => {
  it("parses pause", () => {
    expect(parseIntent("pause")).toEqual({ kind: "audio", action: "pause" });
    expect(parseIntent("be quiet")).toEqual({ kind: "audio", action: "pause" });
    expect(parseIntent("stop")).toEqual({ kind: "audio", action: "pause" });
  });

  it("parses resume", () => {
    expect(parseIntent("resume")).toEqual({ kind: "audio", action: "resume" });
    expect(parseIntent("play")).toEqual({ kind: "audio", action: "resume" });
    expect(parseIntent("continue")).toEqual({ kind: "audio", action: "resume" });
  });

  it("parses speed controls", () => {
    expect(parseIntent("speed up")).toEqual({ kind: "audio", action: "speed_up" });
    expect(parseIntent("faster")).toEqual({ kind: "audio", action: "speed_up" });
    expect(parseIntent("slow down")).toEqual({ kind: "audio", action: "slow_down" });
    expect(parseIntent("slower")).toEqual({ kind: "audio", action: "slow_down" });
  });

  it("parses skip and restart", () => {
    expect(parseIntent("skip")).toEqual({ kind: "audio", action: "skip" });
    expect(parseIntent("restart")).toEqual({ kind: "audio", action: "restart" });
    expect(parseIntent("start over")).toEqual({ kind: "audio", action: "restart" });
  });

  it("is case-insensitive", () => {
    expect(parseIntent("PAUSE")).toEqual({ kind: "audio", action: "pause" });
    expect(parseIntent("  Pause  ")).toEqual({ kind: "audio", action: "pause" });
  });
});

describe("parseIntent — hands-free toggles", () => {
  it("enters hands-free on multiple phrasings", () => {
    expect(parseIntent("start hands-free")).toEqual({
      kind: "hands_free",
      action: "enter",
    });
    expect(parseIntent("turn on hands free")).toEqual({
      kind: "hands_free",
      action: "enter",
    });
    expect(parseIntent("hands-free")).toEqual({
      kind: "hands_free",
      action: "enter",
    });
  });

  it("exits hands-free on multiple phrasings", () => {
    expect(parseIntent("exit hands-free")).toEqual({
      kind: "hands_free",
      action: "exit",
    });
    expect(parseIntent("turn off hands-free")).toEqual({
      kind: "hands_free",
      action: "exit",
    });
    expect(parseIntent("hands-free off")).toEqual({
      kind: "hands_free",
      action: "exit",
    });
  });
});

describe("parseIntent — learning actions", () => {
  it("parses next card", () => {
    expect(parseIntent("next")).toEqual({ kind: "learning", action: "next" });
    expect(parseIntent("next card")).toEqual({ kind: "learning", action: "next" });
  });

  it("parses reveal answer", () => {
    expect(parseIntent("show answer")).toEqual({ kind: "learning", action: "reveal" });
    expect(parseIntent("flip")).toEqual({ kind: "learning", action: "reveal" });
    expect(parseIntent("reveal")).toEqual({ kind: "learning", action: "reveal" });
  });

  it("parses rating", () => {
    expect(parseIntent("easy")).toEqual({
      kind: "learning",
      action: "rate",
      rating: "easy",
    });
    expect(parseIntent("mark as hard")).toEqual({
      kind: "learning",
      action: "rate",
      rating: "hard",
    });
    expect(parseIntent("rate again")).toEqual({
      kind: "learning",
      action: "rate",
      rating: "again",
    });
  });
});

describe("parseIntent — navigation", () => {
  it("handles 'go to <page>'", () => {
    const r = parseIntent("go to learning");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") {
      expect(r.route).toBe("/learning");
      expect(r.label).toBe("Learning Center");
    }
  });

  it("handles 'open <page>'", () => {
    const r = parseIntent("open settings");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/settings");
  });

  it("handles 'show me <page>'", () => {
    const r = parseIntent("show me my clients");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/relationships");
  });

  it("handles 'navigate to <page>'", () => {
    const r = parseIntent("navigate to audio settings");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/settings/audio");
  });

  it("handles 'take me to <page>'", () => {
    const r = parseIntent("take me to help");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/help");
  });

  it("accepts bare words only when allowBareNav is true", () => {
    expect(parseIntent("learning").kind).toBe("unknown");
    const allowed = parseIntent("learning", { allowBareNav: true });
    expect(allowed.kind).toBe("navigate");
    if (allowed.kind === "navigate") expect(allowed.route).toBe("/learning");
  });

  it("strips trailing punctuation from 'go to learning!'", () => {
    const r = parseIntent("go to learning!");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/learning");
  });

  it("strips leading slash so '/go learning' works", () => {
    const r = parseIntent("/go learning");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.route).toBe("/learning");
  });

  it("strips 'the' prefix and 'page' suffix for resolveNavTarget", () => {
    const r = resolveNavTarget("the learning page");
    expect(r?.kind).toBe("navigate");
    if (r && r.kind === "navigate") expect(r.route).toBe("/learning");
  });

  it("falls through to unknown on gibberish", () => {
    expect(parseIntent("xyzzy plugh").kind).toBe("unknown");
    expect(parseIntent("go to narnia").kind).toBe("unknown");
  });
});

describe("parseIntent — read/focus/palette/help", () => {
  it("read page variants", () => {
    expect(parseIntent("read this").kind).toBe("read_page");
    expect(parseIntent("read this page").kind).toBe("read_page");
    expect(parseIntent("narrate").kind).toBe("read_page");
    expect(parseIntent("read aloud").kind).toBe("read_page");
  });

  it("focus chat variants", () => {
    expect(parseIntent("focus the chat").kind).toBe("focus_chat");
    expect(parseIntent("select input").kind).toBe("focus_chat");
    expect(parseIntent("type here").kind).toBe("focus_chat");
  });

  it("open palette variants", () => {
    expect(parseIntent("open palette").kind).toBe("open_palette");
    expect(parseIntent("command palette").kind).toBe("open_palette");
    expect(parseIntent("search pages").kind).toBe("open_palette");
  });

  it("help variants", () => {
    expect(parseIntent("help").kind).toBe("help");
    expect(parseIntent("shortcuts").kind).toBe("help");
    expect(parseIntent("what can you do").kind).toBe("help");
  });
});

describe("parseIntent — robustness", () => {
  it("empty input returns unknown", () => {
    expect(parseIntent("").kind).toBe("unknown");
    expect(parseIntent("   ").kind).toBe("unknown");
  });

  it("undefined-ish input returns unknown", () => {
    // @ts-expect-error — deliberately invalid
    expect(parseIntent(null).kind).toBe("unknown");
    // @ts-expect-error — deliberately invalid
    expect(parseIntent(undefined).kind).toBe("unknown");
  });
});
