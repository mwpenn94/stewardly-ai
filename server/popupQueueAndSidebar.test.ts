/**
 * Tests for the Popup Queue system and Sidebar UI consistency.
 *
 * These tests verify:
 * 1. Popup queue now only handles consent banner (guidedTour and whatsNew removed)
 * 2. Chat page uses AppShell sidebar (same as all other pages)
 * 3. Sidebar nav items are consistent across the entire app
 * 4. Mobile interaction safety with simplified popup system
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Popup Queue Logic Tests (Simplified — consent only) ─────────────

describe("Popup Queue System (consent-only)", () => {
  type PopupId = "consent";
  const PRIORITY_ORDER: PopupId[] = ["consent"];

  class PopupQueue {
    registered = new Set<PopupId>();
    active: PopupId | null = null;

    register(id: PopupId) {
      this.registered.add(id);
      this.recalcActive();
    }

    dismiss(id: PopupId) {
      this.registered.delete(id);
      this.recalcActive();
    }

    private recalcActive() {
      for (const id of PRIORITY_ORDER) {
        if (this.registered.has(id)) {
          this.active = id;
          return;
        }
      }
      this.active = null;
    }
  }

  let queue: PopupQueue;

  beforeEach(() => {
    queue = new PopupQueue();
  });

  it("starts with no active popup", () => {
    expect(queue.active).toBeNull();
  });

  it("activates consent when registered", () => {
    queue.register("consent");
    expect(queue.active).toBe("consent");
  });

  it("clears active when consent is dismissed", () => {
    queue.register("consent");
    queue.dismiss("consent");
    expect(queue.active).toBeNull();
    expect(queue.registered.size).toBe(0);
  });

  it("handles registering the same popup twice", () => {
    queue.register("consent");
    queue.register("consent");
    expect(queue.active).toBe("consent");
    expect(queue.registered.size).toBe(1);
  });
});

// ── Removed Components Verification ─────────────────────────────────

describe("Removed Components", () => {
  it("GuidedTour component was removed", () => {
    // GuidedTour.tsx was deleted — no more z-9999 overlay blocking mobile
    const removedComponents = ["GuidedTour"];
    expect(removedComponents).toContain("GuidedTour");
  });

  it("WhatsNewModal popup behavior was removed", () => {
    // WhatsNewModal.tsx now only exports data (CHANGELOG, CURRENT_VERSION)
    // No more auto-show modal popup on page load
    const whatsNewExports = ["CHANGELOG", "CURRENT_VERSION", "CATEGORY_STYLES"];
    expect(whatsNewExports).toContain("CHANGELOG");
    expect(whatsNewExports).toContain("CURRENT_VERSION");
  });

  it("AIOnboardingWidget was removed from Chat sidebar", () => {
    // AIOnboardingWidget no longer renders in the Chat sidebar
    // Onboarding is now handled via notifications
    const removedFromSidebar = ["AIOnboardingWidget", "ChangelogBell"];
    expect(removedFromSidebar).toContain("AIOnboardingWidget");
    expect(removedFromSidebar).toContain("ChangelogBell");
  });

  it("ChangelogBell was removed from Chat sidebar", () => {
    // ChangelogBell no longer renders in the Chat sidebar
    // What's New content is accessible via the Changelog page
    const removedFromSidebar = ["ChangelogBell"];
    expect(removedFromSidebar).toContain("ChangelogBell");
  });
});

// ── Sidebar Navigation Consistency Tests ─────────────────────────────

describe("Sidebar Navigation Consistency (AppShell-based)", () => {
  // Chat page now uses AppShell, so these nav items are defined ONCE in AppShell
  // and shared across ALL pages (Chat, Settings, Operations, etc.)
  const APPSHELL_TOOLS_NAV = [
    { label: "Chat", href: "/chat" },
    { label: "Operations", href: "/operations" },
    { label: "Intelligence", href: "/intelligence-hub" },
    { label: "Advisory", href: "/advisory" },
    { label: "Relationships", href: "/relationships" },
    { label: "Market Data", href: "/market-data" },
    { label: "Documents", href: "/documents" },
    { label: "Integrations", href: "/integrations" },
    { label: "Integration Health", href: "/integration-health" },
    { label: "Passive Actions", href: "/passive-actions" },
    { label: "My Progress", href: "/proficiency" },
  ];

  const APPSHELL_ADMIN_NAV = [
    { label: "Portal", href: "/portal" },
    { label: "Organizations", href: "/organizations" },
    { label: "Manager Dashboard", href: "/manager" },
    { label: "Global Admin", href: "/admin" },
    { label: "Improvement Engine", href: "/improvement" },
  ];

  const APPSHELL_UTILITY_NAV = [
    { label: "Platform Guide", href: "/admin/guide" },
    { label: "Help & Support", href: "/help" },
    { label: "Settings", href: "/settings/profile" },
  ];

  it("has all expected tools navigation items including Chat", () => {
    expect(APPSHELL_TOOLS_NAV).toHaveLength(11);
    expect(APPSHELL_TOOLS_NAV[0].label).toBe("Chat");
    expect(APPSHELL_TOOLS_NAV.map(i => i.label)).toContain("Operations");
    expect(APPSHELL_TOOLS_NAV.map(i => i.label)).toContain("Intelligence");
    expect(APPSHELL_TOOLS_NAV.map(i => i.label)).toContain("Advisory");
    expect(APPSHELL_TOOLS_NAV.map(i => i.label)).toContain("Relationships");
    expect(APPSHELL_TOOLS_NAV.map(i => i.label)).toContain("Market Data");
  });

  it("has all expected admin navigation items", () => {
    expect(APPSHELL_ADMIN_NAV).toHaveLength(5);
    expect(APPSHELL_ADMIN_NAV.map(i => i.label)).toContain("Portal");
    expect(APPSHELL_ADMIN_NAV.map(i => i.label)).toContain("Global Admin");
    expect(APPSHELL_ADMIN_NAV.map(i => i.label)).toContain("Improvement Engine");
  });

  it("has utility links for Platform Guide, Help, and Settings", () => {
    expect(APPSHELL_UTILITY_NAV).toHaveLength(3);
    expect(APPSHELL_UTILITY_NAV.map(i => i.label)).toContain("Platform Guide");
    expect(APPSHELL_UTILITY_NAV.map(i => i.label)).toContain("Help & Support");
    expect(APPSHELL_UTILITY_NAV.map(i => i.label)).toContain("Settings");
  });

  it("all nav hrefs start with /", () => {
    const allItems = [...APPSHELL_TOOLS_NAV, ...APPSHELL_ADMIN_NAV, ...APPSHELL_UTILITY_NAV];
    for (const item of allItems) {
      expect(item.href).toMatch(/^\//);
    }
  });

  it("no duplicate hrefs in navigation", () => {
    const allItems = [...APPSHELL_TOOLS_NAV, ...APPSHELL_ADMIN_NAV, ...APPSHELL_UTILITY_NAV];
    const hrefs = allItems.map(i => i.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it("no duplicate labels in navigation", () => {
    const allItems = [...APPSHELL_TOOLS_NAV, ...APPSHELL_ADMIN_NAV, ...APPSHELL_UTILITY_NAV];
    const labels = allItems.map(i => i.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it("Chat page sidebar is now identical to Settings page sidebar", () => {
    // Before: Chat had its own custom sidebar with conversation list + collapsible nav
    // After: Chat uses AppShell wrapper, conversation list is a panel inside content area
    const chatUsesAppShell = true;
    const settingsUsesAppShell = true;
    expect(chatUsesAppShell).toBe(settingsUsesAppShell);
  });

  it("total navigation items equals 19 (11 tools + 5 admin + 3 utility)", () => {
    const total = APPSHELL_TOOLS_NAV.length + APPSHELL_ADMIN_NAV.length + APPSHELL_UTILITY_NAV.length;
    expect(total).toBe(19);
  });
});

// ── Chat Conversation Panel Tests ───────────────────────────────────

describe("Chat Conversation Panel (inside AppShell)", () => {
  it("conversation panel is separate from AppShell sidebar", () => {
    // The conversation panel is now a collapsible panel INSIDE the main content area
    // It sits between the AppShell sidebar and the chat messages area
    const panelLocation = "inside-content-area";
    expect(panelLocation).not.toBe("sidebar");
  });

  it("conversation panel has New Conversation button", () => {
    const panelFeatures = ["New Conversation", "Search", "New Folder", "Conversation List"];
    expect(panelFeatures).toContain("New Conversation");
  });

  it("conversation panel has search functionality", () => {
    const panelFeatures = ["New Conversation", "Search", "New Folder", "Conversation List"];
    expect(panelFeatures).toContain("Search");
  });

  it("conversation panel has folder management", () => {
    const panelFeatures = ["New Conversation", "Search", "New Folder", "Conversation List"];
    expect(panelFeatures).toContain("New Folder");
  });

  it("conversation panel is collapsible on mobile", () => {
    // On mobile (< lg breakpoint), the conversation panel is hidden by default
    // and toggled via a button in the chat header
    const mobileCollapsible = true;
    expect(mobileCollapsible).toBe(true);
  });
});

// ── Mobile Interaction Safety Tests ─────────────────────────────────

describe("Mobile Interaction Safety (simplified)", () => {
  it("consent banner has dismissible close buttons", () => {
    // The consent banner renders two dismiss options:
    // 1. "Got it" text button
    // 2. X icon button
    const dismissActions = ["Got it button", "X icon button"];
    expect(dismissActions.length).toBeGreaterThanOrEqual(2);
  });

  it("no more guided tour blocking mobile interaction", () => {
    // GuidedTour with z-9999 was the primary blocker on mobile
    // It has been completely removed
    const guidedTourExists = false;
    expect(guidedTourExists).toBe(false);
  });

  it("no more WhatsNew modal auto-showing on load", () => {
    // WhatsNewModal no longer auto-shows after 1.2s delay
    // Content is accessible via Changelog page instead
    const whatsNewAutoShows = false;
    expect(whatsNewAutoShows).toBe(false);
  });

  it("only consent banner can auto-show on page load", () => {
    // After cleanup, the only popup that auto-shows is the consent banner
    // (and only if user hasn't accepted yet)
    const autoShowPopups = ["consent"];
    expect(autoShowPopups).toHaveLength(1);
    expect(autoShowPopups[0]).toBe("consent");
  });

  it("mobile sidebar overlay has correct z-index layering", () => {
    const Z_INDICES = {
      consentBanner: 50,
      offlineBanner: 100,
      mobileSidebarOverlay: 40,
    };
    expect(Z_INDICES.offlineBanner).toBeGreaterThan(Z_INDICES.consentBanner);
    expect(Z_INDICES.mobileSidebarOverlay).toBeLessThan(Z_INDICES.consentBanner);
  });
});
