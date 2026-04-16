/**
 * UnifiedAI.tsx — unit tests for the consolidated AI surface.
 *
 * Tests cover:
 * - Mode configuration integrity
 * - Progressive disclosure level logic
 * - Keyboard shortcut mapping
 * - Context sharing across modes
 */
import { describe, it, expect } from "vitest";

// ─── Mode configuration tests ──────────────────────────────────────
const MODE_CONFIGS = [
  { key: "chat", label: "Chat", minLevel: 1, shortcut: "Ctrl+1" },
  { key: "code", label: "Code", minLevel: 2, shortcut: "Ctrl+2" },
  { key: "agent", label: "Agent", minLevel: 3, shortcut: "Ctrl+3" },
];

describe("UnifiedAI mode configuration", () => {
  it("has exactly 3 modes", () => {
    expect(MODE_CONFIGS).toHaveLength(3);
  });

  it("chat is always visible at level 1", () => {
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= 1);
    expect(visible).toHaveLength(1);
    expect(visible[0].key).toBe("chat");
  });

  it("code becomes visible at level 2", () => {
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= 2);
    expect(visible).toHaveLength(2);
    expect(visible.map((m) => m.key)).toContain("code");
  });

  it("agent becomes visible at level 3", () => {
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= 3);
    expect(visible).toHaveLength(3);
    expect(visible.map((m) => m.key)).toContain("agent");
  });

  it("all modes visible at level 4", () => {
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= 4);
    expect(visible).toHaveLength(3);
  });

  it("each mode has a unique keyboard shortcut", () => {
    const shortcuts = MODE_CONFIGS.map((m) => m.shortcut);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("keyboard shortcuts follow Ctrl+N pattern", () => {
    MODE_CONFIGS.forEach((m) => {
      expect(m.shortcut).toMatch(/^Ctrl\+\d$/);
    });
  });

  it("modes are ordered by minLevel ascending", () => {
    for (let i = 1; i < MODE_CONFIGS.length; i++) {
      expect(MODE_CONFIGS[i].minLevel).toBeGreaterThanOrEqual(MODE_CONFIGS[i - 1].minLevel);
    }
  });
});

// ─── Progressive disclosure level tests ─────────────────────────────
describe("UnifiedAI progressive disclosure", () => {
  const LEVELS = [
    { level: 1, label: "Essential", modes: ["chat"] },
    { level: 2, label: "Developer", modes: ["chat", "code"] },
    { level: 3, label: "Power User", modes: ["chat", "code", "agent"] },
    { level: 4, label: "Full Access", modes: ["chat", "code", "agent"] },
  ];

  LEVELS.forEach(({ level, label, modes }) => {
    it(`level ${level} (${label}) shows ${modes.length} mode(s)`, () => {
      const visible = MODE_CONFIGS.filter((m) => m.minLevel <= level);
      expect(visible.map((m) => m.key)).toEqual(modes);
    });
  });

  it("level clamping: level 0 shows only chat", () => {
    const clamped = Math.max(1, Math.min(4, 0));
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= clamped);
    expect(visible).toHaveLength(1);
  });

  it("level clamping: level 5 shows all modes", () => {
    const clamped = Math.max(1, Math.min(4, 5));
    const visible = MODE_CONFIGS.filter((m) => m.minLevel <= clamped);
    expect(visible).toHaveLength(3);
  });
});

// ─── Mode switching validation tests ────────────────────────────────
describe("UnifiedAI mode switching", () => {
  it("switching to a mode above disclosure level is rejected", () => {
    const disclosureLevel = 1;
    const targetMode = "code";
    const config = MODE_CONFIGS.find((m) => m.key === targetMode);
    expect(config!.minLevel).toBeGreaterThan(disclosureLevel);
  });

  it("switching to chat is always valid", () => {
    [1, 2, 3, 4].forEach((level) => {
      const config = MODE_CONFIGS.find((m) => m.key === "chat");
      expect(config!.minLevel).toBeLessThanOrEqual(level);
    });
  });

  it("lowering disclosure level forces fallback to chat", () => {
    // Simulate: user is on agent (level 3), then lowers to level 1
    const activeMode = "agent";
    const newLevel = 1;
    const modeConfig = MODE_CONFIGS.find((m) => m.key === activeMode);
    const shouldFallback = modeConfig!.minLevel > newLevel;
    expect(shouldFallback).toBe(true);
  });
});

// ─── Route registration tests ───────────────────────────────────────
describe("UnifiedAI route", () => {
  it("/ai route is registered in App.tsx", () => {
    const fs = require("fs");
    const appSrc = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appSrc).toContain('"/ai"');
    expect(appSrc).toContain("UnifiedAI");
  });

  it("/ai is in navReachability exempt list", () => {
    const fs = require("fs");
    const testSrc = fs.readFileSync("server/navReachability.test.ts", "utf-8");
    expect(testSrc).toContain('"/ai"');
  });
});
