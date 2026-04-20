/**
 * v8.2 Pass 2 — PARITY gap closures:
 *   G16: Voice command palette (already implemented)
 *   G36: role=tablist on bespoke tabs (already handled by shadcn)
 *   G38: Global skip-to-content link
 *   G48: ::selection styling (already implemented)
 *   G55: Consolidated g-chord handler → useGChordNavigation
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../..");

// ── G55: useGChordNavigation hook exists and is used ──
describe("G55 — Consolidated g-chord handler", () => {
  const hookPath = path.join(CLIENT, "hooks/useGChordNavigation.ts");

  it("useGChordNavigation hook file exists", () => {
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it("hook exports useGChordNavigation function", () => {
    const src = fs.readFileSync(hookPath, "utf-8");
    expect(src).toContain("export function useGChordNavigation");
  });

  it("hook uses useCustomShortcuts internally", () => {
    const src = fs.readFileSync(hookPath, "utf-8");
    expect(src).toContain("useCustomShortcuts");
  });

  it("hook attaches window keydown listener", () => {
    const src = fs.readFileSync(hookPath, "utf-8");
    expect(src).toContain("addEventListener");
  });

  it("AppShell.tsx uses useGChordNavigation instead of inline handler", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/AppShell.tsx"), "utf-8");
    expect(src).toContain("useGChordNavigation");
    // Should NOT have inline gPressedRef anymore
    expect(src).not.toContain("gPressedRef");
  });

  it("Chat.tsx uses useGChordNavigation instead of inline handler", () => {
    const src = fs.readFileSync(path.join(CLIENT, "pages/Chat.tsx"), "utf-8");
    expect(src).toContain("useGChordNavigation");
    // Should NOT have inline gPressedRef anymore
    expect(src).not.toContain("gPressedRef");
  });

  it("Chat.tsx still has Chat-specific shortcuts (Ctrl+K, Ctrl+Shift+N)", () => {
    const src = fs.readFileSync(path.join(CLIENT, "pages/Chat.tsx"), "utf-8");
    expect(src).toContain("New conversation");
    expect(src).toContain("Search conversations");
  });
});

// ── G38: Global skip-to-content link ──
describe("G38 — Global skip-to-content link", () => {
  it("App.tsx has a skip-to-content link", () => {
    const src = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf-8");
    expect(src).toContain("Skip to main content");
    expect(src).toContain('#main-content');
  });

  it("skip link uses sr-only with focus:not-sr-only pattern", () => {
    const src = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf-8");
    expect(src).toContain("sr-only");
    expect(src).toContain("focus:not-sr-only");
  });
});

// ── G16: Voice command palette ──
describe("G16 — Voice command palette", () => {
  it("PlatformIntelligence handles 'open palette' voice command", () => {
    const src = fs.readFileSync(
      path.join(CLIENT, "components/PlatformIntelligence.tsx"),
      "utf-8"
    );
    // Should have either 'palette' or 'command-palette' voice handling
    const hasPalette = src.includes("palette") || src.includes("command-palette");
    expect(hasPalette).toBe(true);
  });
});

// ── G48: ::selection styling ──
describe("G48 — ::selection styling", () => {
  it("index.css has ::selection styling", () => {
    const src = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");
    expect(src).toContain("::selection");
  });

  it("index.css has ::-moz-selection for Firefox", () => {
    const src = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");
    expect(src).toContain("::-moz-selection");
  });
});
