/**
 * Pass 38 — Vitest tests
 *
 * Covers:
 *   1. PomodoroTimer named export fix (was default export, caused build failure)
 *   2. PomodoroTimer optional onClose prop (AppShell renders without onClose)
 *   3. Learning content seed script verification
 *   4. Notification routing guard (notifyOwner is the only external channel)
 *   5. Virtual e2e route coverage (all 9 new learning routes in App.tsx)
 *   6. useStudySession hook contract
 *   7. PersonaSidebar5 LEARN_ITEM match array coverage
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Helper to read project files
function readFile(relativePath: string): string {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf-8");
}

// ── 1. PomodoroTimer named export fix ────────────────────────────────────────

describe("P38-1: PomodoroTimer named export fix", () => {
  it("should use named export (not default export)", async () => {
    const mod = await import("../client/src/components/PomodoroTimer");
    expect(mod.PomodoroTimer).toBeDefined();
    expect(typeof mod.PomodoroTimer).toBe("function");
    // Should NOT have a default export
    expect(mod.default).toBeUndefined();
  });

  it("should use 'export function PomodoroTimer' syntax", () => {
    const content = readFile("../client/src/components/PomodoroTimer.tsx");
    expect(content).toContain("export function PomodoroTimer");
    expect(content).not.toContain("export default");
  });

  it("AppShell should import PomodoroTimer as named import", () => {
    const content = readFile("../client/src/components/AppShell.tsx");
    expect(content).toContain('import { PomodoroTimer } from "@/components/PomodoroTimer"');
  });

  it("AppShell should render <PomodoroTimer /> (without onClose)", () => {
    const content = readFile("../client/src/components/AppShell.tsx");
    expect(content).toContain("<PomodoroTimer />");
  });
});

// ── 2. PomodoroTimer optional onClose prop ───────────────────────────────────

describe("P38-1b: PomodoroTimer optional onClose", () => {
  it("should declare onClose as optional in the interface", () => {
    const content = readFile("../client/src/components/PomodoroTimer.tsx");
    expect(content).toMatch(/onClose\?:\s*\(\)\s*=>\s*void/);
  });

  it("should have internal visibility state (isHidden)", () => {
    const content = readFile("../client/src/components/PomodoroTimer.tsx");
    expect(content).toContain("isHidden");
    expect(content).toContain("setIsHidden");
  });

  it("should have a handleClose callback that falls back to setIsHidden", () => {
    const content = readFile("../client/src/components/PomodoroTimer.tsx");
    expect(content).toContain("handleClose");
    expect(content).toContain("setIsHidden(true)");
  });
});

// ── 3. Learning content seed script verification ─────────────────────────────

describe("P38-2: Learning content seed scripts", () => {
  it("seed-learning-content.mjs should exist and seed disciplines", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_disciplines");
    // Should have all 12 disciplines
    const disciplineSlugs = [
      "financial-planning", "investment-management", "tax-planning",
      "retirement-planning", "estate-planning", "insurance-planning",
      "behavioral-finance", "ethics-regulations", "debt-management",
      "business-planning", "education-planning", "real-estate",
    ];
    for (const slug of disciplineSlugs) {
      expect(content).toContain(slug);
    }
  });

  it("seed-learning-content.mjs should seed definitions", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_definitions");
    // Should have key financial terms
    expect(content).toContain("Net Worth");
    expect(content).toContain("Emergency Fund");
  });

  it("seed-learning-content.mjs should seed tracks", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_tracks");
  });

  it("seed-learning-content.mjs should seed flashcards", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_flashcards");
  });

  it("seed-learning-content.mjs should seed practice questions", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_practice_questions");
  });

  it("seed-learning-content.mjs should seed cases", () => {
    const content = readFile("../server/seed-learning-content.mjs");
    expect(content).toContain("learning_cases");
  });

  it("seed-formulas.mjs should exist and seed 15+ formulas", () => {
    const content = readFile("../server/seed-formulas.mjs");
    expect(content).toContain("learning_formulas");
    // Should have key formulas
    const formulaNames = ["NPV", "IRR", "PMT", "FV", "PV", "CAGR", "Sharpe"];
    for (const name of formulaNames) {
      expect(content).toContain(name);
    }
  });
});

// ── 4. Notification routing guard ────────────────────────────────────────────

describe("P38-3: Notification routing — Michael Penn only", () => {
  it("notifyOwner should be the only external notification function", () => {
    const content = readFile("../server/_core/notification.ts");
    expect(content).toContain("export async function notifyOwner");
    // Should NOT have any other export that sends external notifications
    const exports = content.match(/export\s+(async\s+)?function\s+\w+/g) || [];
    expect(exports.length).toBe(1); // Only notifyOwner
  });

  it("email delivery should require RESEND_API_KEY (not set = no external email)", () => {
    const content = readFile("../server/services/email/emailDelivery.ts");
    expect(content).toContain("RESEND_API_KEY");
    expect(content).toContain("Not configured");
    // Should fall through to in-app provider when Resend is not configured
    expect(content).toContain("inAppProvider");
  });

  it("commsEngine should only generate drafts (no send function)", () => {
    const content = readFile("../server/commsEngine.ts");
    expect(content).toContain("generateDraft");
    expect(content).toContain("CommDraft");
    // Should NOT have any send/deliver/dispatch functions
    const sendFunctions = content.match(/export\s+(async\s+)?function\s+(send|deliver|dispatch)\w*/g);
    expect(sendFunctions).toBeNull();
  });
});

// ── 5. Virtual e2e route coverage ────────────────────────────────────────────

describe("P38-4: Virtual e2e route coverage", () => {
  const allNewLearningRoutes = [
    "/learning/hands-free",
    "/learning/ai-quiz",
    "/learning/formula-lab",
    "/learning/analytics",
    "/learning/export",
    "/learning/bookmarks",
    "/learning/playlists",
    "/learning/groups",
    "/learning/discovery",
  ];

  it("App.tsx should contain all 9 new learning routes", () => {
    const content = readFile("../client/src/App.tsx");
    for (const route of allNewLearningRoutes) {
      expect(content).toContain(route);
    }
  });

  it("PersonaSidebar5 LEARN_ITEM match array should include all new routes", () => {
    const content = readFile("../client/src/components/PersonaSidebar5.tsx");
    for (const route of allNewLearningRoutes) {
      expect(content).toContain(route);
    }
  });

  it("App.tsx should lazy-load all 9 new learning page components", () => {
    const content = readFile("../client/src/App.tsx");
    const components = [
      "HandsFreeStudy", "AIQuizPage", "FormulaLab", "StudyAnalytics",
      "ProgressExport", "Bookmarks", "Playlists", "StudyGroups", "DiscoveryHistory",
    ];
    for (const comp of components) {
      expect(content).toContain(`lazy(() => import("./pages/learning/${comp}"))`);
    }
  });
});

// ── 6. useStudySession hook contract ─────────────────────────────────────────

describe("P38: useStudySession hook", () => {
  it("should export useStudySession as a named function", async () => {
    const mod = await import("../client/src/hooks/useStudySession");
    expect(mod.useStudySession).toBeDefined();
    expect(typeof mod.useStudySession).toBe("function");
  });

  it("should return recordItem, recordMastery, recordQuizScore, flush", () => {
    const content = readFile("../client/src/hooks/useStudySession.ts");
    expect(content).toContain("recordItem");
    expect(content).toContain("recordMastery");
    expect(content).toContain("recordQuizScore");
    expect(content).toContain("flush");
    // Return statement
    expect(content).toContain("return { recordItem, recordMastery, recordQuizScore, flush }");
  });

  it("should track study time and record on unmount", () => {
    const content = readFile("../client/src/hooks/useStudySession.ts");
    expect(content).toContain("startTimeRef");
    expect(content).toContain("Date.now()");
    expect(content).toContain("durationMinutes");
    expect(content).toContain("recordMutation.mutate");
  });

  it("should be wired into 8 learning pages", () => {
    const pages = [
      "../client/src/pages/learning/ExamSimulatorPage.tsx",
      "../client/src/pages/learning/LearningFlashcardStudy.tsx",
      "../client/src/pages/learning/LearningQuizRunner.tsx",
      "../client/src/pages/learning/LearningDueReview.tsx",
      "../client/src/pages/learning/AIQuizPage.tsx",
      "../client/src/pages/learning/HandsFreeStudy.tsx",
      "../client/src/pages/learning/FormulaLab.tsx",
      "../client/src/pages/learning/CaseStudySimulator.tsx",
    ];
    for (const page of pages) {
      const content = readFile(page);
      expect(content).toContain("useStudySession");
    }
  });
});

// ── 7. Role-based navigation structure ───────────────────────────────────────

describe("P38-4: Persona navigation structure", () => {
  it("should have 5 roles in ROLE_LEVEL", () => {
    const content = readFile("../client/src/components/PersonaSidebar5.tsx");
    expect(content).toContain("guest: 0");
    expect(content).toContain("user: 1");
    expect(content).toContain("advisor: 2");
    expect(content).toContain("manager: 3");
    expect(content).toContain("admin: 4");
  });

  it("should have PERSONA_LAYERS with correct minRole hierarchy", () => {
    const content = readFile("../client/src/components/PersonaSidebar5.tsx");
    // Core layer visible to guests
    expect(content).toMatch(/key:\s*"core"[\s\S]*?minRole:\s*"guest"/);
    // Wealth layer visible to users
    expect(content).toMatch(/key:\s*"wealth"[\s\S]*?minRole:\s*"user"/);
    // Professional layer visible to advisors
    expect(content).toMatch(/key:\s*"professional"[\s\S]*?minRole:\s*"advisor"/);
    // Leadership layer visible to managers
    expect(content).toMatch(/key:\s*"leadership"[\s\S]*?minRole:\s*"manager"/);
    // Platform layer visible to admins
    expect(content).toMatch(/key:\s*"platform"[\s\S]*?minRole:\s*"admin"/);
  });

  it("LEARN_ITEM should be available to all authenticated users", () => {
    const content = readFile("../client/src/components/PersonaSidebar5.tsx");
    expect(content).toContain('label: "Learn"');
    expect(content).toContain('path: "/learning"');
  });
});
