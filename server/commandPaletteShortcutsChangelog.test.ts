/**
 * Tests for:
 *  1. CommandPalette — global search overlay (Ctrl+K)
 *  2. useCustomShortcuts — user-customizable G-then-X shortcuts
 *  3. Changelog page — dedicated full release history
 *  4. ShortcutsTab — Settings tab for customizing shortcuts
 *  5. WhatsNewModal — "View all releases" link
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── 1. CommandPalette ──────────────────────────────────────────────

describe("CommandPalette component", () => {
  const filePath = path.resolve(__dirname, "../client/src/components/CommandPalette.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("exists and exports CommandPalette", () => {
    expect(src).toContain("export function CommandPalette");
  });

  it("uses CommandDialog from shadcn/ui", () => {
    expect(src).toContain("CommandDialog");
    expect(src).toContain("CommandInput");
    expect(src).toContain("CommandList");
    expect(src).toContain("CommandGroup");
    expect(src).toContain("CommandItem");
  });

  it("listens for Ctrl+K / Cmd+K to toggle", () => {
    expect(src).toMatch(/e\.key\s*===\s*["']k["']/);
    expect(src).toMatch(/e\.metaKey\s*\|\|\s*e\.ctrlKey/);
  });

  it("has pages group with at least 15 entries", () => {
    const pageMatches = src.match(/\{ label: "/g);
    expect(pageMatches).not.toBeNull();
    expect(pageMatches!.length).toBeGreaterThanOrEqual(15);
  });

  it("has actions group with at least 3 entries", () => {
    const actionMatches = src.match(/action:\s*\(/g);
    expect(actionMatches).not.toBeNull();
    expect(actionMatches!.length).toBeGreaterThanOrEqual(3);
  });

  it("includes keyboard shortcuts action", () => {
    expect(src).toContain("Keyboard shortcuts");
  });

  it("searches conversations via trpc when query is long enough", () => {
    expect(src).toContain("trpc.conversations.search.useQuery");
    expect(src).toContain("debouncedQuery.length >= 2");
  });

  it("uses useDebounce hook for search", () => {
    expect(src).toContain("useDebounce");
  });

  it("renders footer with keyboard hints", () => {
    expect(src).toContain("navigate");
    expect(src).toContain("select");
    expect(src).toContain("close");
    expect(src).toContain("toggle");
  });

  it("exports PAGES and ACTIONS for testing", () => {
    expect(src).toContain("export { PAGES, ACTIONS }");
  });

  it("includes shortcut hints for pages with G-then-X", () => {
    expect(src).toContain('shortcut: "G C"');
    expect(src).toContain('shortcut: "G O"');
    expect(src).toContain('shortcut: "G M"');
  });

  it("navigates to conversation on select", () => {
    expect(src).toContain('navigate(`/chat/${convId}`)');
  });
});

// ── 2. useDebounce hook ────────────────────────────────────────────

describe("useDebounce hook", () => {
  const filePath = path.resolve(__dirname, "../client/src/hooks/useDebounce.ts");
  const src = fs.readFileSync(filePath, "utf-8");

  it("exports useDebounce function", () => {
    expect(src).toContain("export function useDebounce");
  });

  it("uses useState and useEffect", () => {
    expect(src).toContain("useState");
    expect(src).toContain("useEffect");
  });

  it("uses setTimeout for debouncing", () => {
    expect(src).toContain("setTimeout");
    expect(src).toContain("clearTimeout");
  });
});

// ── 3. useCustomShortcuts hook ─────────────────────────────────────

describe("useCustomShortcuts hook", () => {
  const filePath = path.resolve(__dirname, "../client/src/hooks/useCustomShortcuts.ts");
  const src = fs.readFileSync(filePath, "utf-8");

  it("exports useCustomShortcuts function", () => {
    expect(src).toContain("export function useCustomShortcuts");
  });

  it("exports DEFAULT_SHORTCUTS with 10 entries", () => {
    expect(src).toContain("export const DEFAULT_SHORTCUTS");
    const defaults = src.match(/\{ key: "[a-z]", route: "[^"]+", label: "[^"]+" \}/g);
    expect(defaults).not.toBeNull();
    expect(defaults!.length).toBe(10);
  });

  it("exports AVAILABLE_ROUTES with 20+ routes", () => {
    expect(src).toContain("export const AVAILABLE_ROUTES");
    const routes = src.match(/\{ route: "[^"]+", label: "[^"]+" \}/g);
    expect(routes).not.toBeNull();
    expect(routes!.length).toBeGreaterThanOrEqual(20);
  });

  it("persists to localStorage with correct key", () => {
    expect(src).toContain("stewardly-custom-shortcuts");
    expect(src).toContain("localStorage.setItem");
    expect(src).toContain("localStorage.getItem");
  });

  it("returns shortcutMap as a Map", () => {
    expect(src).toContain("new Map");
    expect(src).toContain("shortcutMap");
  });

  it("provides updateShortcut, resetToDefaults, addShortcut, removeShortcut", () => {
    expect(src).toContain("updateShortcut");
    expect(src).toContain("resetToDefaults");
    expect(src).toContain("addShortcut");
    expect(src).toContain("removeShortcut");
  });

  it("validates stored data structure on load", () => {
    expect(src).toContain('typeof item.key !== "string"');
  });

  it("default shortcuts include all expected keys", () => {
    const expectedKeys = ["c", "o", "i", "a", "r", "m", "d", "n", "s", "h"];
    for (const key of expectedKeys) {
      expect(src).toContain(`key: "${key}"`);
    }
  });
});

// ── 4. ShortcutsTab ────────────────────────────────────────────────

describe("ShortcutsTab settings component", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/settings/ShortcutsTab.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("exists and exports default", () => {
    expect(src).toContain("export default function ShortcutsTab");
  });

  it("uses useCustomShortcuts hook", () => {
    expect(src).toContain("useCustomShortcuts");
  });

  it("renders active shortcuts with key display", () => {
    expect(src).toContain("Active Shortcuts");
    expect(src).toContain("shortcut.key.toUpperCase()");
  });

  it("allows adding new shortcuts", () => {
    expect(src).toContain("Add Shortcut");
    expect(src).toContain("handleAdd");
  });

  it("allows removing shortcuts", () => {
    expect(src).toContain("removeShortcut");
    expect(src).toContain("Trash2");
  });

  it("has reset to defaults button", () => {
    expect(src).toContain("Reset to defaults");
    expect(src).toContain("resetToDefaults");
  });

  it("uses Select component for route picking", () => {
    expect(src).toContain("Select");
    expect(src).toContain("SelectTrigger");
    expect(src).toContain("SelectContent");
    expect(src).toContain("SelectItem");
  });

  it("shows customized/default status badge", () => {
    expect(src).toContain("isCustomized");
    expect(src).toContain("Customized");
    expect(src).toContain("Default");
  });

  it("includes info section about keyboard shortcuts", () => {
    expect(src).toContain("Custom shortcuts are saved locally");
  });
});

// ── 5. SettingsHub integration ─────────────────────────────────────

describe("SettingsHub includes ShortcutsTab", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/SettingsHub.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("imports ShortcutsTab", () => {
    expect(src).toContain('import ShortcutsTab from "./settings/ShortcutsTab"');
  });

  it("has shortcuts in tab type", () => {
    expect(src).toContain('"shortcuts"');
  });

  it("has shortcuts tab definition", () => {
    expect(src).toContain('id: "shortcuts"');
    expect(src).toContain("Keyboard Shortcuts");
  });

  it("shortcuts tab is accessible without auth", () => {
    expect(src).toContain('"shortcuts"');
    // Check it's in ANONYMOUS_TABS
    const anonMatch = src.match(/ANONYMOUS_TABS.*=.*\[([^\]]+)\]/);
    expect(anonMatch).not.toBeNull();
    expect(anonMatch![1]).toContain("shortcuts");
  });

  it("renders ShortcutsTab when active", () => {
    expect(src).toContain('<ShortcutsTab />');
  });
});

// ── 6. AppShell uses custom shortcuts ──────────────────────────────

describe("AppShell uses custom shortcuts", () => {
  const filePath = path.resolve(__dirname, "../client/src/components/AppShell.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("imports useCustomShortcuts", () => {
    expect(src).toContain('import { useCustomShortcuts }');
  });

  it("uses shortcutMap for navigation", () => {
    expect(src).toContain("shortcutMap.get(e.key.toLowerCase())");
  });

  it("no longer has hardcoded route if-chains", () => {
    // Should NOT have the old pattern
    expect(src).not.toContain('if (k === "c") { e.preventDefault(); navigate("/chat")');
  });
});

// ── 7. Chat.tsx uses custom shortcuts ──────────────────────────────

describe("Chat.tsx uses custom shortcuts", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/Chat.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("imports useCustomShortcuts", () => {
    expect(src).toContain('import { useCustomShortcuts }');
  });

  it("uses shortcutMap for navigation", () => {
    expect(src).toContain("shortcutMap.get(e.key.toLowerCase())");
  });

  it("includes shortcutMap in useEffect deps", () => {
    expect(src).toContain("shortcutMap]");
  });
});

// ── 8. Changelog page ──────────────────────────────────────────────

describe("Changelog page", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/Changelog.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("exists and exports default", () => {
    expect(src).toContain("export default function Changelog");
  });

  it("imports CHANGELOG and CURRENT_VERSION from WhatsNewModal", () => {
    expect(src).toContain('import { CHANGELOG, CURRENT_VERSION } from "@/components/WhatsNewModal"');
  });

  it("wraps in AppShell", () => {
    expect(src).toContain("<AppShell");
  });

  it("renders timeline with dots", () => {
    expect(src).toContain("Timeline dot");
    expect(src).toContain("rounded-full");
  });

  it("has expand/collapse all buttons", () => {
    expect(src).toContain("Expand all");
    expect(src).toContain("Collapse all");
    expect(src).toContain("expandAll");
    expect(src).toContain("collapseAll");
  });

  it("shows version, date, and headline for each release", () => {
    expect(src).toContain("release.version");
    expect(src).toContain("release.date");
    expect(src).toContain("release.headline");
  });

  it("renders entries with category badges", () => {
    expect(src).toContain("entry.category");
    expect(src).toContain("CATEGORY_STYLES");
  });

  it("first release is expanded by default", () => {
    expect(src).toContain("CHANGELOG[0].version");
  });

  it("shows Latest badge on first release", () => {
    expect(src).toContain("Latest");
    expect(src).toContain("isLatest");
  });

  it("shows entry count badge", () => {
    expect(src).toContain("release.entries.length");
  });
});

// ── 9. App.tsx integration ─────────────────────────────────────────

describe("App.tsx integrations", () => {
  const filePath = path.resolve(__dirname, "../client/src/App.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("imports CommandPalette", () => {
    expect(src).toContain('import { CommandPalette }');
  });

  it("renders CommandPalette", () => {
    expect(src).toContain("<CommandPalette />");
  });

  it("lazy-loads Changelog page", () => {
    expect(src).toContain('lazy(() => import("./pages/Changelog"))');
  });

  it("has /changelog route", () => {
    expect(src).toContain('/changelog');
    expect(src).toContain("Changelog");
  });
});

// ── 10. WhatsNewModal "View all releases" link ─────────────────────

describe("WhatsNewModal changelog link", () => {
  const filePath = path.resolve(__dirname, "../client/src/components/WhatsNewModal.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("has 'View all releases' text", () => {
    expect(src).toContain("View all releases");
  });

  it("navigates to /changelog on click", () => {
    expect(src).toContain('navigate("/changelog")');
  });

  it("dismisses modal before navigating", () => {
    expect(src).toContain("handleDismiss()");
    expect(src).toContain('navigate("/changelog")');
  });

  it("imports useLocation from wouter", () => {
    expect(src).toContain('import { useLocation } from "wouter"');
  });
});

// ── 11. KeyboardShortcuts updated ──────────────────────────────────

describe("KeyboardShortcuts includes Ctrl+K as command palette", () => {
  const filePath = path.resolve(__dirname, "../client/src/components/KeyboardShortcuts.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("lists Ctrl+K as command palette shortcut", () => {
    expect(src).toContain("Open command palette");
    expect(src).toContain('"Ctrl"');
    expect(src).toContain('"K"');
  });
});
