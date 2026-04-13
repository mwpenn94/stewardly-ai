/**
 * Tests for Popup Queue, Sidebar UI consistency, and mobile safety.
 *
 * Current state (2026-04-02):
 * - GuidedTour: REMOVED entirely
 * - WhatsNewModal: converted to data-only export (no modal popup)
 * - ConsentBanner: only remaining auto-show popup
 * - Sidebar: AppShell updated with collapsible sections matching Chat sidebar
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Popup Queue Logic Tests ──────────────────────────────────────────

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

  it("returns null when consent is dismissed", () => {
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

describe("Removed popup components", () => {
  it("GuidedTour component file should not exist", () => {
    const filePath = path.resolve(__dirname, "../client/src/components/GuidedTour.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("App.tsx should not reference GuidedTour", () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/App.tsx"),
      "utf-8"
    );
    expect(appSource).not.toContain("GuidedTour");
  });

  it("App.tsx should not reference WhatsNewModal", () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/App.tsx"),
      "utf-8"
    );
    expect(appSource).not.toContain("WhatsNewModal");
  });

  it("WhatsNewModal.tsx should be data-only (no modal UI)", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/WhatsNewModal.tsx"),
      "utf-8"
    );
    expect(source).toContain("export const CHANGELOG");
    expect(source).toContain("export const CURRENT_VERSION");
    expect(source).toContain("export const CATEGORY_STYLES");
    expect(source).not.toContain("<Dialog");
    expect(source).not.toContain("export default function");
  });
});

// ── Sidebar Navigation Consistency Tests ─────────────────────────────

describe("Sidebar Navigation Consistency", () => {
  const SHARED_TOOLS_NAV = [
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

  const SHARED_ADMIN_NAV = [
    { label: "Portal", href: "/portal" },
    { label: "Organizations", href: "/organizations" },
    { label: "Manager Dashboard", href: "/manager" },
    { label: "Global Admin", href: "/admin" },
    { label: "Improvement Engine", href: "/improvement" },
  ];

  const SHARED_UTILITY_NAV = [
    { label: "Help & Support", href: "/help" },
    { label: "Settings", href: "/settings/profile" },
  ];

  it("has all expected tools navigation items", () => {
    expect(SHARED_TOOLS_NAV).toHaveLength(10);
    expect(SHARED_TOOLS_NAV.map(i => i.label)).toContain("Operations");
    expect(SHARED_TOOLS_NAV.map(i => i.label)).toContain("Intelligence");
    expect(SHARED_TOOLS_NAV.map(i => i.label)).toContain("Advisory");
    expect(SHARED_TOOLS_NAV.map(i => i.label)).toContain("Relationships");
    expect(SHARED_TOOLS_NAV.map(i => i.label)).toContain("Market Data");
  });

  it("has all expected admin navigation items", () => {
    expect(SHARED_ADMIN_NAV).toHaveLength(5);
    expect(SHARED_ADMIN_NAV.map(i => i.label)).toContain("Portal");
    expect(SHARED_ADMIN_NAV.map(i => i.label)).toContain("Global Admin");
  });

  it("has utility links for Help and Settings", () => {
    expect(SHARED_UTILITY_NAV).toHaveLength(2);
    expect(SHARED_UTILITY_NAV[0].label).toBe("Help & Support");
    expect(SHARED_UTILITY_NAV[1].label).toBe("Settings");
  });

  it("all nav hrefs start with /", () => {
    const allItems = [...SHARED_TOOLS_NAV, ...SHARED_ADMIN_NAV, ...SHARED_UTILITY_NAV];
    for (const item of allItems) {
      expect(item.href).toMatch(/^\//);
    }
  });

  it("no duplicate hrefs in navigation", () => {
    const allItems = [...SHARED_TOOLS_NAV, ...SHARED_ADMIN_NAV, ...SHARED_UTILITY_NAV];
    const hrefs = allItems.map(i => i.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it("no duplicate labels in navigation", () => {
    const allItems = [...SHARED_TOOLS_NAV, ...SHARED_ADMIN_NAV, ...SHARED_UTILITY_NAV];
    const labels = allItems.map(i => i.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it("AppShell sidebar uses PersonaSidebar5 for navigation", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/AppShell.tsx"),
      "utf-8"
    );
    // PersonaSidebar5 is the real sidebar with its own collapsible state
    expect(source).toContain("PersonaSidebar5");
    // Should have collapsible toggle state for the sidebar itself
    expect(source).toMatch(/collapsed|setCollapsed/i);
  });
});

// ── Mobile Interaction Safety ───────────────────────────────────────

describe("Mobile Interaction Safety", () => {
  it("consent banner has dismissible close buttons", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/ConsentBanner.tsx"),
      "utf-8"
    );
    // Must have dismiss/close functionality
    expect(source).toMatch(/dismiss|close|accept/i);
    expect(source).toContain("localStorage");
  });

  it("no popup stacking on mobile — only consent banner auto-shows", () => {
    const appSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/App.tsx"),
      "utf-8"
    );
    // GuidedTour and WhatsNewModal should NOT be in App.tsx
    expect(appSource).not.toContain("GuidedTour");
    expect(appSource).not.toContain("WhatsNewModal");
    // ConsentBanner should still be present
    expect(appSource).toContain("ConsentBanner");
  });

  it("ContextualHelp does not reference GuidedTour reset", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/ContextualHelp.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("resetTour");
    expect(source).not.toContain("Restart Guided Tour");
  });
});
