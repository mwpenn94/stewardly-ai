/**
 * Tests for actionPalette.ts (Pass 248).
 */

import { describe, it, expect } from "vitest";
import {
  scoreAction,
  filterActions,
  groupByCategory,
  DEFAULT_ACTIONS,
  type PaletteAction,
} from "./actionPalette";

const mk = (overrides: Partial<PaletteAction> = {}): PaletteAction => ({
  id: overrides.id ?? "test:id",
  label: overrides.label ?? "Test action",
  category: overrides.category ?? "tab",
  hint: overrides.hint,
  keywords: overrides.keywords,
});

describe("scoreAction", () => {
  it("returns 1 for empty query (keeps all)", () => {
    expect(scoreAction(mk(), "")).toBe(1);
  });

  it("scores exact label match highest", () => {
    const action = mk({ label: "Chat" });
    expect(scoreAction(action, "chat")).toBe(100);
  });

  it("scores label prefix match", () => {
    const action = mk({ label: "Chat history" });
    expect(scoreAction(action, "chat")).toBe(80);
  });

  it("scores label substring match", () => {
    const action = mk({ label: "Clear chat history" });
    expect(scoreAction(action, "chat")).toBe(40);
  });

  it("scores keyword match", () => {
    const action = mk({ label: "Go to Files", keywords: ["browser"] });
    expect(scoreAction(action, "browser")).toBeGreaterThanOrEqual(60);
  });

  it("scores subsequence fallback", () => {
    const action = mk({ label: "Go to Roadmap" });
    expect(scoreAction(action, "gtrm")).toBe(10);
  });

  it("returns 0 for no match", () => {
    expect(scoreAction(mk({ label: "Chat" }), "xylophone")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(scoreAction(mk({ label: "Chat" }), "CHAT")).toBe(100);
    expect(scoreAction(mk({ label: "CHAT" }), "chat")).toBe(100);
  });
});

describe("filterActions", () => {
  it("returns first N actions for empty query", () => {
    const out = filterActions(DEFAULT_ACTIONS, "", 5);
    expect(out).toHaveLength(5);
  });

  it("filters by query", () => {
    const out = filterActions(DEFAULT_ACTIONS, "chat");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].label.toLowerCase()).toContain("chat");
  });

  it("ranks exact matches first", () => {
    const actions: PaletteAction[] = [
      mk({ label: "Chat history" }),
      mk({ label: "Chat" }),
    ];
    const out = filterActions(actions, "Chat");
    expect(out[0].label).toBe("Chat");
  });

  it("respects limit", () => {
    const out = filterActions(DEFAULT_ACTIONS, "", 3);
    expect(out).toHaveLength(3);
  });

  it("returns empty for no match", () => {
    expect(filterActions(DEFAULT_ACTIONS, "xxxnope")).toEqual([]);
  });

  it("matches by keyword", () => {
    const out = filterActions(DEFAULT_ACTIONS, "definition");
    expect(out.some((a) => a.label.toLowerCase().includes("symbol"))).toBe(true);
  });
});

describe("groupByCategory", () => {
  it("returns empty for no actions", () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it("groups and orders canonically (tab, popover, workspace, slash, shortcut)", () => {
    const actions: PaletteAction[] = [
      mk({ id: "a1", label: "slash", category: "slash" }),
      mk({ id: "a2", label: "tab", category: "tab" }),
      mk({ id: "a3", label: "pop", category: "popover" }),
    ];
    const groups = groupByCategory(actions);
    expect(groups.map((g) => g.category)).toEqual(["tab", "popover", "slash"]);
  });

  it("groups every action", () => {
    const groups = groupByCategory(DEFAULT_ACTIONS);
    const allCount = groups.reduce((acc, g) => acc + g.items.length, 0);
    expect(allCount).toBe(DEFAULT_ACTIONS.length);
  });

  it("preserves original order within a category", () => {
    const actions: PaletteAction[] = [
      mk({ id: "a", label: "A", category: "tab" }),
      mk({ id: "b", label: "B", category: "tab" }),
      mk({ id: "c", label: "C", category: "tab" }),
    ];
    const groups = groupByCategory(actions);
    expect(groups[0].items.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
});

describe("DEFAULT_ACTIONS", () => {
  it("has tab entries for every major tab", () => {
    const tabIds = DEFAULT_ACTIONS.filter((a) => a.category === "tab").map((a) => a.id);
    expect(tabIds).toContain("tab:chat");
    expect(tabIds).toContain("tab:imports");
    expect(tabIds).toContain("tab:todos");
  });

  it("has popover entries for every major popover", () => {
    const popoverIds = DEFAULT_ACTIONS.filter((a) => a.category === "popover").map((a) => a.id);
    expect(popoverIds).toContain("open:symbols");
    expect(popoverIds).toContain("open:memory");
    expect(popoverIds).toContain("open:scratchpad");
  });

  it("has every entry with a unique id", () => {
    const ids = new Set(DEFAULT_ACTIONS.map((a) => a.id));
    expect(ids.size).toBe(DEFAULT_ACTIONS.length);
  });
});
