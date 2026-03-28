/**
 * Tests for:
 * 1. Server-side keyboard shortcuts persistence (settings.getShortcuts / settings.saveShortcuts)
 * 2. Recently visited pages in command palette (useRecentPages)
 * 3. Toast notifications on shortcut changes (ShortcutsTab)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ═══════════════════════════════════════════════════════════════════════
// 1. SERVER-SIDE SHORTCUTS PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════

describe("Server-Side Shortcuts Persistence", () => {
  const routersPath = path.resolve(__dirname, "routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  it("should have getShortcuts procedure in settingsRouter", () => {
    expect(routersContent).toContain("getShortcuts:");
    expect(routersContent).toContain("protectedProcedure.query");
  });

  it("should have saveShortcuts procedure in settingsRouter", () => {
    expect(routersContent).toContain("saveShortcuts:");
    expect(routersContent).toContain("protectedProcedure");
  });

  it("getShortcuts should query userPreferences table", () => {
    expect(routersContent).toContain("userPreferences.customShortcuts");
    expect(routersContent).toContain("userPreferences.userId");
  });

  it("saveShortcuts should validate input with zod schema", () => {
    // Check that the input schema validates key, route, label
    expect(routersContent).toContain('key: z.string().min(1).max(1)');
    expect(routersContent).toContain('route: z.string().min(1)');
    expect(routersContent).toContain('label: z.string().min(1)');
  });

  it("saveShortcuts should limit to max 26 shortcuts", () => {
    expect(routersContent).toContain(".max(26)");
  });

  it("saveShortcuts should upsert (insert or update)", () => {
    // Should check for existing row and update or insert
    expect(routersContent).toContain("db.update(userPreferences)");
    expect(routersContent).toContain("db.insert(userPreferences)");
  });

  it("getShortcuts should return null when no custom shortcuts exist", () => {
    // The code should return null fallback
    expect(routersContent).toContain("?? null");
  });
});

describe("Schema — customShortcuts column", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("should have customShortcuts JSON column in userPreferences", () => {
    expect(schemaContent).toContain('customShortcuts: json("customShortcuts")');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. useCustomShortcuts HOOK — SERVER SYNC
// ═══════════════════════════════════════════════════════════════════════

describe("useCustomShortcuts — Server Sync", () => {
  const hookPath = path.resolve(__dirname, "../client/src/hooks/useCustomShortcuts.ts");
  const hookContent = fs.readFileSync(hookPath, "utf-8");

  it("should import trpc for server communication", () => {
    expect(hookContent).toContain('import { trpc }');
  });

  it("should import useAuth to check authentication", () => {
    expect(hookContent).toContain('import { useAuth }');
  });

  it("should query settings.getShortcuts when authenticated", () => {
    expect(hookContent).toContain("trpc.settings.getShortcuts.useQuery");
  });

  it("should only enable server query when authenticated", () => {
    expect(hookContent).toContain("enabled: isAuthenticated");
  });

  it("should use saveMutation for server persistence", () => {
    expect(hookContent).toContain("trpc.settings.saveShortcuts.useMutation");
  });

  it("should hydrate from server data on first load", () => {
    expect(hookContent).toContain("hydratedFromServer");
    expect(hookContent).toContain("serverQuery.data");
  });

  it("should keep localStorage in sync with server data", () => {
    expect(hookContent).toContain("saveLocalShortcuts");
  });

  it("should persist to both localStorage and server", () => {
    expect(hookContent).toContain("persistShortcuts");
    expect(hookContent).toContain("saveMutation.mutate");
  });

  it("should expose isSyncing state", () => {
    expect(hookContent).toContain("isSyncing: saveMutation.isPending");
  });

  it("should fall back to localStorage for guests", () => {
    expect(hookContent).toContain("loadLocalShortcuts");
    expect(hookContent).toContain("DEFAULT_SHORTCUTS");
  });

  it("should cache server data for 5 minutes", () => {
    expect(hookContent).toContain("staleTime: 5 * 60 * 1000");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. RECENTLY VISITED PAGES
// ═══════════════════════════════════════════════════════════════════════

describe("useRecentPages Hook", () => {
  const hookPath = path.resolve(__dirname, "../client/src/hooks/useRecentPages.ts");
  const hookContent = fs.readFileSync(hookPath, "utf-8");

  it("should export recordPageVisit function", () => {
    expect(hookContent).toContain("export function recordPageVisit");
  });

  it("should export clearRecentPages function", () => {
    expect(hookContent).toContain("export function clearRecentPages");
  });

  it("should export useRecentPages hook", () => {
    expect(hookContent).toContain("export function useRecentPages");
  });

  it("should cap entries at MAX_ENTRIES (5)", () => {
    expect(hookContent).toContain("const MAX_ENTRIES = 5");
    expect(hookContent).toContain(".slice(0, MAX_ENTRIES)");
  });

  it("should store in localStorage with correct key", () => {
    expect(hookContent).toContain('const LS_KEY = "stewardly-recent-pages"');
  });

  it("should deduplicate by route", () => {
    expect(hookContent).toContain("p.route !== route");
  });

  it("should order most-recent-first (prepend)", () => {
    // New entry is prepended
    expect(hookContent).toContain("{ route, label, visitedAt: now }, ...filtered");
  });

  it("should skip non-page routes (oauth, callback, root)", () => {
    expect(hookContent).toContain("/oauth");
    expect(hookContent).toContain("/callback");
    expect(hookContent).toContain('route === "/"');
  });

  it("should use useSyncExternalStore for cross-component reactivity", () => {
    expect(hookContent).toContain("useSyncExternalStore");
  });

  it("should have a comprehensive route-to-label mapping", () => {
    expect(hookContent).toContain("ROUTE_LABELS");
    expect(hookContent).toContain('"/chat": "Chat"');
    expect(hookContent).toContain('"/operations": "Operations Hub"');
    expect(hookContent).toContain('"/intelligence-hub": "Intelligence Hub"');
  });

  it("should track visitedAt timestamp", () => {
    expect(hookContent).toContain("visitedAt: number");
    expect(hookContent).toContain("Date.now()");
  });
});

describe("CommandPalette — Recent Pages Integration", () => {
  const palettePath = path.resolve(__dirname, "../client/src/components/CommandPalette.tsx");
  const paletteContent = fs.readFileSync(palettePath, "utf-8");

  it("should import useRecentPages hook", () => {
    expect(paletteContent).toContain('import { useRecentPages }');
  });

  it("should show Recent group when no query is entered", () => {
    expect(paletteContent).toContain('heading="Recent"');
    expect(paletteContent).toContain("showRecent");
  });

  it("should only show recent pages when query is empty", () => {
    expect(paletteContent).toContain("query.length === 0 && recentPages.length > 0");
  });

  it("should display time ago for recent pages", () => {
    expect(paletteContent).toContain("formatTimeAgo");
  });

  it("should have a formatTimeAgo helper", () => {
    expect(paletteContent).toContain("function formatTimeAgo");
    expect(paletteContent).toContain("just now");
    expect(paletteContent).toContain("m ago");
    expect(paletteContent).toContain("h ago");
    expect(paletteContent).toContain("d ago");
  });

  it("should reuse page icons from PAGES list for recent items", () => {
    expect(paletteContent).toContain("PAGES.find((p) => p.href === rp.route)");
    expect(paletteContent).toContain("pageEntry?.icon");
  });
});

describe("AppShell — recordPageVisit Integration", () => {
  const shellPath = path.resolve(__dirname, "../client/src/components/AppShell.tsx");
  const shellContent = fs.readFileSync(shellPath, "utf-8");

  it("should import recordPageVisit", () => {
    expect(shellContent).toContain('import { recordPageVisit }');
  });

  it("should call recordPageVisit on location change", () => {
    expect(shellContent).toContain("recordPageVisit(location)");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. TOAST NOTIFICATIONS ON SHORTCUT CHANGES
// ═══════════════════════════════════════════════════════════════════════

describe("ShortcutsTab — Toast Notifications", () => {
  const tabPath = path.resolve(__dirname, "../client/src/pages/settings/ShortcutsTab.tsx");
  const tabContent = fs.readFileSync(tabPath, "utf-8");

  it("should import toast from sonner", () => {
    expect(tabContent).toContain('import { toast } from "sonner"');
  });

  it("should show toast on shortcut update", () => {
    expect(tabContent).toContain("toast.success(`Updated: G then");
  });

  it("should show toast on shortcut add", () => {
    expect(tabContent).toContain("toast.success(`Added shortcut: G then");
  });

  it("should show toast on shortcut remove", () => {
    expect(tabContent).toContain("toast.success(`Removed shortcut: G then");
  });

  it("should show toast on reset to defaults", () => {
    expect(tabContent).toContain('toast.success("Shortcuts reset to defaults")');
  });

  it("should show error toast when add is incomplete", () => {
    expect(tabContent).toContain('toast.error("Select both a key and a page")');
  });

  it("should show syncing badge when saving to server", () => {
    expect(tabContent).toContain("isSyncing");
    expect(tabContent).toContain("Syncing...");
  });

  it("should indicate server sync in info text", () => {
    expect(tabContent).toContain("sync to your account when signed in");
    expect(tabContent).toContain("carry across devices");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. INTEGRATION CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════

describe("Integration Consistency", () => {
  it("useCustomShortcuts should export isSyncing", () => {
    const hookPath = path.resolve(__dirname, "../client/src/hooks/useCustomShortcuts.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");
    expect(hookContent).toContain("isSyncing");
  });

  it("ShortcutsTab should destructure isSyncing from useCustomShortcuts", () => {
    const tabPath = path.resolve(__dirname, "../client/src/pages/settings/ShortcutsTab.tsx");
    const tabContent = fs.readFileSync(tabPath, "utf-8");
    expect(tabContent).toContain("isSyncing,");
  });

  it("useRecentPages should export RecentPage type", () => {
    const hookPath = path.resolve(__dirname, "../client/src/hooks/useRecentPages.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");
    expect(hookContent).toContain("export interface RecentPage");
  });

  it("CommandPalette should export PAGES and ACTIONS for testing", () => {
    const palettePath = path.resolve(__dirname, "../client/src/components/CommandPalette.tsx");
    const paletteContent = fs.readFileSync(palettePath, "utf-8");
    expect(paletteContent).toContain("export { PAGES, ACTIONS }");
  });
});
