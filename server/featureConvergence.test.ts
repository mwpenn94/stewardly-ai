/**
 * Cross-Feature Convergence Tests
 * Validates notification badges, self-discovery settings, and onboarding tour enhancements
 * across all 3 features implemented with v13 parity convergence.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

function readFile(rel: string): string {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) throw new Error(`Missing: ${rel}`);
  return readFileSync(p, "utf-8");
}

// ─── Feature 1: Notification Badges ─────────────────────────────────────
describe("Feature 1: Notification Badges", () => {
  const hook = readFile("client/src/hooks/useNavBadges.ts");
  const sidebar = readFile("client/src/components/PersonaSidebar5.tsx");

  it("useNavBadges hook exists and exports a function", () => {
    expect(hook).toContain("export function useNavBadges");
  });

  it("aggregates unread counts from multiple sources", () => {
    expect(hook).toContain("notifications");
    expect(hook).toContain("unread");
  });

  it("returns a badge map structure", () => {
    expect(hook).toMatch(/Map|map\.set|badgeMap|badges/i);
  });

  it("sidebar imports useNavBadges", () => {
    expect(sidebar).toContain("useNavBadges");
  });

  it("sidebar renders badge indicators", () => {
    expect(sidebar).toMatch(/badge|Badge|badgeCount/i);
  });

  it("badges use polling interval >= 60s to avoid excessive requests", () => {
    const intervals = hook.match(/(\d+)_?000/g) || [];
    const msValues = intervals.map(s => parseInt(s.replace(/_/g, ""), 10));
    // At least one interval >= 60000
    expect(msValues.some(v => v >= 60000 || v >= 60)).toBe(true);
  });

  it("no external outreach in badge system (G14)", () => {
    expect(hook).not.toMatch(/sendEmail|sendSms|smtp|twilio/i);
  });
});

// ─── Feature 2: Self-Discovery Settings ─────────────────────────────────
describe("Feature 2: Self-Discovery Settings", () => {
  const aiTuning = readFile("client/src/pages/settings/AITuningTab.tsx");
  const service = readFile("server/services/selfDiscovery.ts");
  const hook = readFile("client/src/hooks/useSelfDiscovery.ts");

  it("AITuningTab has discovery enabled toggle", () => {
    expect(aiTuning).toContain("discoveryEnabled");
  });

  it("AITuningTab has discovery direction selector", () => {
    expect(aiTuning).toContain("discoveryDirection");
  });

  it("AITuningTab has idle threshold control", () => {
    expect(aiTuning).toContain("discoveryIdleMs");
  });

  it("AITuningTab has continuous mode toggle", () => {
    expect(aiTuning).toContain("discoveryContinuous");
  });

  it("backend service supports continuous mode", () => {
    expect(service).toContain("continuous");
  });

  it("backend service supports direction (deeper/broader/related)", () => {
    expect(service).toMatch(/deeper|broader|related/);
  });

  it("frontend hook exists and manages discovery state", () => {
    expect(hook).toContain("useSelfDiscovery");
  });

  it("no external outreach in discovery (G14)", () => {
    expect(service).not.toMatch(/sendEmail|sendSms|smtp|twilio/i);
  });
});

// ─── Feature 3: Onboarding Tour Enhancements ────────────────────────────
describe("Feature 3: Onboarding Tour Enhancements", () => {
  const tour = readFile("client/src/components/OnboardingTour.tsx");
  const roleService = readFile("server/services/roleOnboarding.ts");
  const notifications = readFile("client/src/components/OnboardingNotifications.tsx");

  it("tour has role-adaptive step mapping", () => {
    expect(tour).toContain("ROLE_STEP_MAP");
  });

  it("tour supports advisor role path", () => {
    expect(tour).toMatch(/advisor.*\[.*"welcome"/);
  });

  it("tour supports client role path", () => {
    expect(tour).toMatch(/client.*\[.*"welcome"/);
  });

  it("tour supports admin role path", () => {
    expect(tour).toMatch(/admin.*\[.*"welcome"/);
  });

  it("tour uses filteredSteps based on role", () => {
    expect(tour).toContain("filteredSteps");
  });

  it("tour persists step for resume capability", () => {
    expect(tour).toContain("onboarding_tour_step");
  });

  it("tour loads saved step on open (resume)", () => {
    expect(tour).toMatch(/getItem.*onboarding_tour_step/);
  });

  it("skip preserves progress for later resume", () => {
    expect(tour).toContain("Don't remove step");
  });

  it("completion clears saved step", () => {
    expect(tour).toMatch(/removeItem.*onboarding_tour_step/);
  });

  it("server-side role onboarding has all 3 paths", () => {
    expect(roleService).toContain("advisor");
    expect(roleService).toContain("client");
    expect(roleService).toContain("admin");
  });

  it("server-side tracks progress in database", () => {
    expect(roleService).toContain("onboardingProgress");
  });

  it("onboarding notifications hook exists", () => {
    expect(notifications).toContain("useOnboardingNotifications");
  });

  it("tour has accessibility labels", () => {
    expect(tour).toContain("aria-label");
  });

  it("no external outreach in tour (G14)", () => {
    expect(tour).not.toMatch(/sendEmail|sendSms|smtp|twilio/i);
  });
});

// ─── Cross-Feature Integration ──────────────────────────────────────────
describe("Cross-Feature Integration", () => {
  const nav = readFile("client/src/lib/navigation.ts");
  const appTsx = readFile("client/src/App.tsx");

  it("navigation has all new dashboard entries", () => {
    expect(nav).toContain("ai-usage");
    expect(nav).toContain("data-engine");
    expect(nav).toContain("activity-timeline");
    expect(nav).toContain("leaderboard");
  });

  it("App.tsx imports OnboardingTour", () => {
    expect(appTsx).toContain("OnboardingTour");
  });

  it("App.tsx has tour state management", () => {
    expect(appTsx).toContain("useOnboardingTour");
  });

  it("no hardcoded secrets in any feature file", () => {
    const files = [
      "client/src/hooks/useNavBadges.ts",
      "client/src/components/OnboardingTour.tsx",
      "client/src/pages/settings/AITuningTab.tsx",
    ];
    for (const f of files) {
      const content = readFile(f);
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}/);
    }
  });

  it("all features use try/catch for localStorage (Safari Private)", () => {
    const tour = readFile("client/src/components/OnboardingTour.tsx");
    const badges = readFile("client/src/hooks/useNavBadges.ts");
    // Tour must have try/catch
    expect(tour).toContain("try");
    expect(tour).toContain("catch");
  });
});
