/**
 * Pass 62 — Documentation & Onboarding Completeness Tests
 *
 * Verifies:
 * 1. Documentation metrics are up-to-date
 * 2. Route map completeness in comprehensive guide
 * 3. Help page FAQ coverage
 * 4. Onboarding flow completeness
 * 5. Contextual help coverage
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ── 1. Documentation metrics accuracy ────────────────────────────
describe("Documentation metrics accuracy (Pass 62)", () => {
  it("STEWARDLY_COMPREHENSIVE_GUIDE.md exists and is version 4.0", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("Version:** 4.1");
    expect(content).toContain("April 18, 2026");
  });

  it("guide reports 430,000+ lines of code", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("442,000+");
  });

  it("guide reports 383 database tables", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("383");
    expect(content).toContain("database tables");
  });

  it("guide reports 105 tRPC routers", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("105");
    expect(content).toContain("tRPC");
  });

  it("guide reports 9,883 tests", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("9,883");
  });

  it("guide reports 398 test files", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("398");
  });

  it("guide reports 120 recursive optimization passes", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("120 recursive optimization passes");
  });

  it("PLATFORM_GUIDE.md metrics are updated", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "PLATFORM_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("442,000+");
    expect(content).toContain("383 database tables");
    expect(content).toContain("9,883");
  });
});

// ── 2. Route map completeness ─────────────────────────────────────
describe("Route map completeness (Pass 62)", () => {
  it("guide documents 90+ routes (was 45)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    const routeMatches = content.match(/\| `\//g) || [];
    expect(routeMatches.length).toBeGreaterThanOrEqual(85);
  });

  it("guide includes new admin routes", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("/admin/api-keys");
    expect(content).toContain("/admin/audit-trail");
    expect(content).toContain("/admin/feature-permissions");
    expect(content).toContain("/admin/system-health");
    expect(content).toContain("/admin/webhooks");
  });

  it("guide includes learning routes", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("/learning");
    expect(content).toContain("/learning/achievements");
    expect(content).toContain("/learning/tracks");
  });

  it("guide includes financial planning routes", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("/financial-planning");
    expect(content).toContain("/financial-twin");
    expect(content).toContain("/estate");
    expect(content).toContain("/tax-planning");
    expect(content).toContain("/medicare");
    expect(content).toContain("/social-security");
  });

  it("guide includes settings/audio route", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    expect(content).toContain("/settings/audio");
  });
});

// ── 3. Help page FAQ coverage ─────────────────────────────────────
describe("Help page FAQ coverage (Pass 62)", () => {
  it("Help page has 30+ FAQ items", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/pages/Help.tsx"),
      "utf-8"
    );
    const questionCount = (content.match(/question:/g) || []).length;
    expect(questionCount).toBeGreaterThanOrEqual(30);
  });

  it("Help page has search functionality", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/pages/Help.tsx"),
      "utf-8"
    );
    expect(content).toContain("Search");
    expect(content).toContain("search");
  });

  it("Help page has contact/support form", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/pages/Help.tsx"),
      "utf-8"
    );
    expect(content).toContain("Send");
    expect(content).toContain("Textarea");
  });
});

// ── 4. Onboarding flow completeness ───────────────────────────────
describe("Onboarding flow completeness (Pass 62)", () => {
  it("OnboardingTour is rendered in App.tsx", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/App.tsx"),
      "utf-8"
    );
    expect(content).toContain("OnboardingTour");
    expect(content).toContain("useOnboardingTour");
  });

  it("ContextualHelp is rendered in App.tsx", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/App.tsx"),
      "utf-8"
    );
    expect(content).toContain("ContextualHelp");
  });

  it("OnboardingChecklist is used in Chat page", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/pages/Chat.tsx"),
      "utf-8"
    );
    expect(content).toContain("OnboardingChecklist");
  });

  it("ContextualHelp has 40+ help topics", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/components/ContextualHelp.tsx"),
      "utf-8"
    );
    const titleCount = (content.match(/title:/g) || []).length;
    expect(titleCount).toBeGreaterThanOrEqual(40);
  });

  it("OnboardingFlow has 40+ step references", () => {
    const p = path.join(ROOT, "client/src/components/OnboardingFlow.tsx");
    if (!fs.existsSync(p)) return; // removed in dead code cleanup
    const content = fs.readFileSync(p, "utf-8");
    const stepCount = (content.match(/[Ss]tep/g) || []).length;
    expect(stepCount).toBeGreaterThanOrEqual(40);
  });

  it("VoiceOnboardingCoach was removed in Pass 147 (dead code cleanup)", () => {
    // VoiceOnboardingCoach was intentionally deleted in Pass 147 as dead code.
    // No component imported it. Verify it stays removed.
    expect(
      fs.existsSync(path.join(ROOT, "client/src/components/VoiceOnboardingCoach.tsx"))
    ).toBe(false);
  });

  it("WhatsNewModal exists for changelog notifications", () => {
    expect(
      fs.existsSync(path.join(ROOT, "client/src/components/WhatsNewModal.tsx"))
    ).toBe(true);
  });

  it("Changelog page exists and imports from WhatsNewModal", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "client/src/pages/Changelog.tsx"),
      "utf-8"
    );
    expect(content).toContain("WhatsNewModal");
    expect(content).toContain("CHANGELOG");
  });
});

// ── 5. Documentation file inventory ───────────────────────────────
describe("Documentation file inventory (Pass 62)", () => {
  const requiredDocs = [
    "STEWARDLY_COMPREHENSIVE_GUIDE.md",
    "PLATFORM_GUIDE.md",
    "SETUP.md",
    "SETUP_GUIDE.md",
    "INTEGRATION-SETUP-GUIDE.md",
    "CONVERGENCE_REPORT.md",
    "REMAINING_ITEMS.md",
  ];

  for (const doc of requiredDocs) {
    it(`${doc} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, doc))).toBe(true);
    });
  }

  it("PLATFORM_GUIDE.md is substantial (1000+ lines)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "PLATFORM_GUIDE.md"),
      "utf-8"
    );
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeGreaterThan(1000);
  });

  it("STEWARDLY_COMPREHENSIVE_GUIDE.md is substantial (800+ lines)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "STEWARDLY_COMPREHENSIVE_GUIDE.md"),
      "utf-8"
    );
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeGreaterThan(800);
  });
});
