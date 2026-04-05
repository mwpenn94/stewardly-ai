/**
 * Tests for Keyboard Shortcuts Overlay & Expanded Changelog
 *
 * Covers:
 *  - KeyboardShortcuts component structure, categories, "?" key listener
 *  - G-then-X navigation wired in Chat.tsx and AppShell.tsx
 *  - Visual hint in sidebar footer
 *  - Expanded WhatsNewModal changelog (3 releases, 15+ entries)
 *  - Version bump to re-trigger modal
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

// ─── KeyboardShortcuts Overlay ─────────────────────────────────────────────

describe("KeyboardShortcuts Overlay", () => {
  const source = fs.readFileSync("client/src/components/KeyboardShortcuts.tsx", "utf-8");

  it("should export the SHORTCUTS array for testability", () => {
    expect(source).toContain("export { SHORTCUTS }");
  });

  it("should have Navigation, Chat, and General categories", () => {
    expect(source).toContain('"Navigation"');
    expect(source).toContain('"Chat"');
    expect(source).toContain('"General"');
  });

  it("should include at least 10 navigation shortcuts", () => {
    const navMatches = source.match(/category:\s*"Navigation"/g);
    expect(navMatches).toBeTruthy();
    expect(navMatches!.length).toBeGreaterThanOrEqual(10);
  });

  it("should include G-then-X shortcuts for all major pages", () => {
    const pages = [
      "Go to Chat",
      "Go to Operations",
      "Go to Intelligence",
      "Go to Advisory",
      "Go to Relationships",
      "Go to Market Data",
      "Go to Documents",
      "Go to Integrations",
      "Go to Settings",
      "Go to Help",
    ];
    for (const page of pages) {
      expect(source).toContain(page);
    }
  });

  it("should listen for '?' key to toggle the modal", () => {
    expect(source).toContain('e.key === "?"');
    expect(source).toContain("toggle");
  });

  it("should not trigger when typing in inputs", () => {
    expect(source).toContain("isInput");
    expect(source).toContain("INPUT");
    expect(source).toContain("TEXTAREA");
    expect(source).toContain("isContentEditable");
  });

  it("should close on Escape key", () => {
    expect(source).toContain('"Escape"');
    expect(source).toContain("setOpen(false)");
  });

  it("should have proper ARIA attributes for accessibility", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain("aria-modal");
    expect(source).toContain("aria-label");
  });

  it("should show macOS hint in the footer", () => {
    expect(source).toContain("macOS");
    expect(source).toContain("⌘");
    expect(source).toContain("Ctrl");
  });

  it("should have category descriptions for context", () => {
    expect(source).toContain("CATEGORY_DESCRIPTIONS");
    expect(source).toContain("Press G, then a letter");
  });

  it("should be mounted in App.tsx", () => {
    const appSource = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appSource).toContain("KeyboardShortcuts");
    expect(appSource).toContain("<KeyboardShortcuts");
  });
});

// ─── G-then-X Navigation in Chat.tsx ───────────────────────────────────────

describe("G-then-X Navigation in Chat.tsx", () => {
  const source = fs.readFileSync("client/src/pages/Chat.tsx", "utf-8");

  it("should have G-then-X navigation handler", () => {
    expect(source).toContain("G-then-X navigation");
    expect(source).toContain("gPressedRef");
    expect(source).toContain("gTimerRef");
  });

  it("should use shortcutMap from useCustomShortcuts for navigation", () => {
    expect(source).toContain("shortcutMap.get(e.key.toLowerCase())");
    expect(source).toContain("useCustomShortcuts");
    expect(source).toContain("navigate(route)");
  });

  it("should use 800ms timeout for G key sequence", () => {
    expect(source).toContain("800");
  });

  it("should prevent default on navigation", () => {
    expect(source).toContain("e.preventDefault()");
  });

  it("should clean up timer on unmount", () => {
    expect(source).toContain("gTimerRef.current");
    expect(source).toContain("clearTimeout");
  });
});

// ─── G-then-X Navigation in AppShell.tsx ───────────────────────────────────

describe("G-then-X Navigation in AppShell.tsx", () => {
  const source = fs.readFileSync("client/src/components/AppShell.tsx", "utf-8");

  it("should have G-then-X navigation handler in AppShell", () => {
    expect(source).toContain("G-then-X keyboard navigation");
    expect(source).toContain("gPressedRef");
  });

  it("should support the same navigation targets as Chat", () => {
    const routes = [
      "/chat",
      "/operations",
      "/intelligence-hub",
      "/advisory",
      "/relationships",
      "/market-data",
      "/documents",
      "/integrations",
      "/settings/profile",
      "/help",
    ];
    for (const route of routes) {
      expect(source).toContain(`"${route}"`);
    }
  });

  it("should not trigger when typing in inputs", () => {
    expect(source).toContain("isInput");
    expect(source).toContain("INPUT");
    expect(source).toContain("TEXTAREA");
  });
});

// ─── Keyboard Shortcut Hint in Sidebar ─────────────────────────────────────

describe("Keyboard Shortcut Hint in Sidebar", () => {
  const source = fs.readFileSync("client/src/components/AppShell.tsx", "utf-8");

  it("should show a hint about the '?' shortcut in the sidebar", () => {
    expect(source).toContain("for shortcuts");
    expect(source).toContain("?");
  });

  it("should import the Keyboard icon", () => {
    expect(source).toContain("Keyboard");
  });
});

// ─── Expanded WhatsNewModal Changelog ──────────────────────────────────────

describe("Expanded WhatsNewModal Changelog", () => {
  const source = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

  it("should have version bumped to 2026.04.04", () => {
    expect(source).toContain('CURRENT_VERSION = "2026.04.04"');
  });

  it("should have 5 changelog releases", () => {
    const versionMatches = source.match(/version:\s*"/g);
    expect(versionMatches).toBeTruthy();
    expect(versionMatches!.length).toBe(5);
  });

  it("should have the latest release about keyboard shortcuts", () => {
    expect(source).toContain("Keyboard shortcuts, expanded navigation");
    expect(source).toContain("Keyboard shortcuts overlay");
    expect(source).toContain("Full keyboard navigation");
  });

  it("should have the original 2026.03.28 release", () => {
    expect(source).toContain("Smarter AI, resilient UI, and faster navigation");
    expect(source).toContain("Multi-tool AI conversations");
    expect(source).toContain("Offline detection");
  });

  it("should have the historical 2026.03.20 release", () => {
    expect(source).toContain("2026.03.20");
    expect(source).toContain("Deep intelligence, real-time data, and compliance tools");
    expect(source).toContain("Intelligence Hub");
    expect(source).toContain("Real-time market data");
    expect(source).toContain("Document management");
    expect(source).toContain("Relationship management");
    expect(source).toContain("Role-based access control");
  });

  it("should use all four category types across releases", () => {
    expect(source).toContain('"feature"');
    expect(source).toContain('"fix"');
    expect(source).toContain('"improvement"');
    expect(source).toContain('"security"');
  });

  it("should have at least 15 total changelog entries", () => {
    const entryMatches = source.match(/category:\s*"/g);
    expect(entryMatches).toBeTruthy();
    expect(entryMatches!.length).toBeGreaterThanOrEqual(15);
  });

  it("should import new icons for expanded entries", () => {
    expect(source).toContain("Keyboard");
    expect(source).toContain("Globe");
    expect(source).toContain("Brain");
    expect(source).toContain("Lock");
    expect(source).toContain("Gauge");
  });
});

// ─── Integration: Shortcuts + Changelog coexist ────────────────────────────

describe("Feature Integration — Shortcuts and Changelog", () => {
  it("should have KeyboardShortcuts in App.tsx (WhatsNewModal removed — data-only)", () => {
    const appSource = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appSource).toContain("KeyboardShortcuts");
    // WhatsNewModal is now a data-only export, not rendered in App.tsx
    expect(appSource).not.toContain("WhatsNewModal");
  });

  it("should have '?' shortcut listed in KeyboardShortcuts", () => {
    const source = fs.readFileSync("client/src/components/KeyboardShortcuts.tsx", "utf-8");
    expect(source).toContain('"?"');
    expect(source).toContain("Show this shortcuts panel");
  });

  it("should have consistent navigation targets between KeyboardShortcuts and AppShell", () => {
    const ksSource = fs.readFileSync("client/src/components/KeyboardShortcuts.tsx", "utf-8");
    const asSource = fs.readFileSync("client/src/components/AppShell.tsx", "utf-8");

    // AppShell should have the same G-then-X routes
    const sharedRoutes = ["/operations", "/intelligence-hub", "/advisory", "/relationships", "/market-data"];
    for (const route of sharedRoutes) {
      expect(asSource).toContain(route);
    }

    // KeyboardShortcuts should describe the same pages
    const sharedPages = ["Operations", "Intelligence", "Advisory", "Relationships", "Market Data"];
    for (const page of sharedPages) {
      expect(ksSource).toContain(page);
    }
  });
});
