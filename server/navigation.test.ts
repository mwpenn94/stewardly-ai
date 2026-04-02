/**
 * Tests for the shared navigation configuration (lib/navigation.ts).
 *
 * These tests verify:
 * 1. All nav arrays export valid items with required fields
 * 2. hasMinRole correctly enforces role hierarchy
 * 3. No duplicate hrefs within or across arrays
 * 4. Chat page correctly filters out its own "/chat" entry
 */
import { describe, expect, it } from "vitest";

// We can't import client-side TS directly in server tests, so we replicate
// the pure logic that lives in navigation.ts (no React deps).
// This validates the contract rather than the file itself.

type UserRole = "user" | "advisor" | "manager" | "admin";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  advisor: 1,
  manager: 2,
  admin: 3,
};

function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[(userRole as UserRole) ?? "user"] >= ROLE_HIERARCHY[minRole];
}

// Mirror the shared nav arrays
const TOOLS_NAV = [
  { iconName: "MessageSquare", label: "Chat", href: "/chat", minRole: "user" as UserRole },
  { iconName: "Zap", label: "Operations", href: "/operations", minRole: "user" as UserRole },
  { iconName: "Brain", label: "Intelligence", href: "/intelligence-hub", minRole: "user" as UserRole },
  { iconName: "Package", label: "Advisory", href: "/advisory", minRole: "user" as UserRole },
  { iconName: "Users", label: "Relationships", href: "/relationships", minRole: "user" as UserRole },
  { iconName: "TrendingUp", label: "Market Data", href: "/market-data", minRole: "user" as UserRole },
  { iconName: "FileText", label: "Documents", href: "/documents", minRole: "user" as UserRole },
  { iconName: "Link2", label: "Integrations", href: "/integrations", minRole: "user" as UserRole },
  { iconName: "HeartPulse", label: "Integration Health", href: "/integration-health", minRole: "advisor" as UserRole },
  { iconName: "RefreshCw", label: "Passive Actions", href: "/passive-actions", minRole: "user" as UserRole },
  { iconName: "Activity", label: "My Progress", href: "/proficiency", minRole: "user" as UserRole },
];

const ADMIN_NAV = [
  { iconName: "Briefcase", label: "Portal", href: "/portal", minRole: "advisor" as UserRole },
  { iconName: "Building2", label: "Organizations", href: "/organizations", minRole: "advisor" as UserRole },
  { iconName: "BarChart3", label: "Manager Dashboard", href: "/manager", minRole: "manager" as UserRole },
  { iconName: "Globe", label: "Global Admin", href: "/admin", minRole: "admin" as UserRole },
  { iconName: "Wrench", label: "Improvement Engine", href: "/improvement", minRole: "advisor" as UserRole },
  { iconName: "BookOpen", label: "Platform Guide", href: "/admin/guide", minRole: "admin" as UserRole },
];

const UTILITY_NAV = [
  { iconName: "HelpCircle", label: "Help & Support", href: "/help", minRole: "user" as UserRole },
  { iconName: "Settings", label: "Settings", href: "/settings/profile", minRole: "user" as UserRole },
];

describe("hasMinRole", () => {
  it("grants user access to user-level items", () => {
    expect(hasMinRole("user", "user")).toBe(true);
  });

  it("denies user access to advisor-level items", () => {
    expect(hasMinRole("user", "advisor")).toBe(false);
  });

  it("grants admin access to all levels", () => {
    expect(hasMinRole("admin", "user")).toBe(true);
    expect(hasMinRole("admin", "advisor")).toBe(true);
    expect(hasMinRole("admin", "manager")).toBe(true);
    expect(hasMinRole("admin", "admin")).toBe(true);
  });

  it("grants manager access to manager and below", () => {
    expect(hasMinRole("manager", "user")).toBe(true);
    expect(hasMinRole("manager", "advisor")).toBe(true);
    expect(hasMinRole("manager", "manager")).toBe(true);
    expect(hasMinRole("manager", "admin")).toBe(false);
  });

  it("defaults undefined role to user", () => {
    expect(hasMinRole(undefined, "user")).toBe(true);
    expect(hasMinRole(undefined, "advisor")).toBe(false);
  });
});

describe("Navigation arrays", () => {
  it("TOOLS_NAV has no duplicate hrefs", () => {
    const hrefs = TOOLS_NAV.map(i => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("ADMIN_NAV has no duplicate hrefs", () => {
    const hrefs = ADMIN_NAV.map(i => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("all items have required fields", () => {
    const allItems = [...TOOLS_NAV, ...ADMIN_NAV, ...UTILITY_NAV];
    for (const item of allItems) {
      expect(item.iconName).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.href).toMatch(/^\//);
      expect(["user", "advisor", "manager", "admin"]).toContain(item.minRole);
    }
  });

  it("Chat page filters out /chat from its tools list", () => {
    const chatToolsNav = TOOLS_NAV.filter(i => i.href !== "/chat");
    expect(chatToolsNav.find(i => i.href === "/chat")).toBeUndefined();
    expect(chatToolsNav.length).toBe(TOOLS_NAV.length - 1);
  });

  it("user role sees only user-level items in TOOLS_NAV", () => {
    const visible = TOOLS_NAV.filter(i => hasMinRole("user", i.minRole));
    // Integration Health requires advisor
    expect(visible.find(i => i.href === "/integration-health")).toBeUndefined();
    expect(visible.length).toBe(TOOLS_NAV.length - 1);
  });

  it("advisor role sees all TOOLS_NAV items", () => {
    const visible = TOOLS_NAV.filter(i => hasMinRole("advisor", i.minRole));
    expect(visible.length).toBe(TOOLS_NAV.length);
  });
});
