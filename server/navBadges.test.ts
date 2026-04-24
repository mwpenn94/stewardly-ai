/**
 * navBadges.test.ts — Parity convergence tests for notification badges feature
 *
 * Tests:
 * 1. useNavBadges hook exports and interface
 * 2. formatBadgeCount formatting rules
 * 3. PersonaSidebar5 badge integration
 * 4. Security: no XSS vectors
 * 5. A11y: aria attributes present
 * 6. Performance: memoization and polling
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Feature 1: Notification Badges — Parity Convergence", () => {
  // ── Hook structure ──
  describe("useNavBadges hook", () => {
    it("exports useNavBadges, formatBadgeCount, and BadgeInfo type", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("export function useNavBadges");
      expect(src).toContain("export function formatBadgeCount");
      expect(src).toContain("export interface BadgeInfo");
    });

    it("returns a Map<string, BadgeInfo>", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("NavBadgeMap = Map<string, BadgeInfo>");
    });

    it("uses useMemo for stable reference", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("return useMemo(");
    });

    it("polls at 120s intervals with 60s staleTime", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("refetchInterval: 120_000");
      expect(src).toContain("staleTime: 60_000");
    });

    it("reads from real tRPC procedures (not mock endpoints)", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("trpc.exponentialEngine.getUnreadChangelogCount");
      expect(src).toContain("trpc.learning.mastery.dueReview");
    });

    it("uses WebSocket-driven notification count", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain("useNotifications");
      expect(src).toContain("unreadCount");
    });
  });

  // ── formatBadgeCount ──
  describe("formatBadgeCount", () => {
    it("returns empty string for 0", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain('if (count <= 0) return ""');
    });

    it("returns '9+' for counts above 9", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(src).toContain('if (count > 9) return "9+"');
    });
  });

  // ── Sidebar integration ──
  describe("PersonaSidebar5 badge integration", () => {
    const sidebarSrc = fs.readFileSync(
      path.join(ROOT, "client/src/components/PersonaSidebar5.tsx"), "utf8"
    );

    it("imports useNavBadges hook", () => {
      expect(sidebarSrc).toContain("useNavBadges");
      expect(sidebarSrc).toContain("formatBadgeCount");
    });

    it("calls useNavBadges() in SidebarInner", () => {
      expect(sidebarSrc).toContain("const badges = useNavBadges()");
    });

    it("has getBadge helper that checks path and match arrays", () => {
      expect(sidebarSrc).toContain("const getBadge = (item: NavItem)");
      expect(sidebarSrc).toContain("badges.get(item.path)");
      expect(sidebarSrc).toContain("badges.get(m)");
    });

    it("renders badge in collapsed mode (icon overlay)", () => {
      expect(sidebarSrc).toContain("badge && collapsed");
    });

    it("renders badge in expanded mode (right-aligned pill)", () => {
      // Should have badge rendering outside of collapsed check
      const expandedBadge = sidebarSrc.includes("ml-auto flex-none");
      expect(expandedBadge).toBe(true);
    });

    it("supports three badge variants: dot, count, urgent", () => {
      expect(sidebarSrc).toContain('"dot"');
      expect(sidebarSrc).toContain('"count"');
      expect(sidebarSrc).toContain('"urgent"');
    });

    it("uses animate-pulse for urgent badges", () => {
      expect(sidebarSrc).toContain("animate-pulse");
    });
  });

  // ── Security ──
  describe("Security", () => {
    it("no dangerouslySetInnerHTML in badge code", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(hookSrc).not.toContain("dangerouslySetInnerHTML");
    });

    it("no eval or Function constructor in badge code", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(hookSrc).not.toContain("eval(");
      expect(hookSrc).not.toContain("new Function(");
    });

    it("badge counts are numeric only (no user-supplied strings rendered)", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      // formatBadgeCount only returns "", "9+", or String(number)
      expect(hookSrc).toContain("return String(count)");
    });
  });

  // ── Accessibility ──
  describe("Accessibility", () => {
    const sidebarSrc = fs.readFileSync(
      path.join(ROOT, "client/src/components/PersonaSidebar5.tsx"), "utf8"
    );

    it("aria-label includes unread count for screen readers", () => {
      expect(sidebarSrc).toContain("unread)");
    });

    it("visual badges are aria-hidden to avoid double announcement", () => {
      const ariaHiddenCount = (sidebarSrc.match(/aria-hidden="true"/g) || []).length;
      expect(ariaHiddenCount).toBeGreaterThanOrEqual(2);
    });

    it("collapsed mode includes count in title attribute", () => {
      expect(sidebarSrc).toContain("badge.count");
    });
  });

  // ── Performance ──
  describe("Performance", () => {
    it("hook uses useMemo to prevent unnecessary re-renders", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(hookSrc).toContain("useMemo");
    });

    it("polling intervals are reasonable (>= 60s)", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      // Match the full numeric literal including underscores (e.g., 120_000)
      const intervals = hookSrc.match(/refetchInterval:\s*([\d_]+)/g) || [];
      for (const interval of intervals) {
        const numStr = interval.replace(/refetchInterval:\s*/, "").replace(/_/g, "");
        const ms = parseInt(numStr);
        expect(ms).toBeGreaterThanOrEqual(60_000);
      }
    });

    it("no direct DOM manipulation", () => {
      const hookSrc = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf8");
      expect(hookSrc).not.toContain("document.");
      expect(hookSrc).not.toContain("querySelector");
    });
  });
});
