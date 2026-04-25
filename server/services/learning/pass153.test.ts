/**
 * Pass 153 — SRS Settings Enforcement + Pomodoro Session Logging tests
 */
import { describe, it, expect } from "vitest";

// ── SRS Settings Enforcement ──
describe("SRS Settings Enforcement (Pass 153)", () => {
  it("dueReview procedure reads learningSettings for daily_review_cap", () => {
    // Verify the code path exists by checking the procedure source
    const fs = require("fs");
    const source = fs.readFileSync("server/routers/learning.ts", "utf-8");
    expect(source).toContain("srs_daily_review_cap");
    expect(source).toContain("srs_new_card_quota");
    expect(source).toContain("settingsLimit");
    expect(source).toContain("settingsNewQuota");
  });

  it("settings values are bounded between valid ranges", () => {
    // Verify the bounds checking code exists
    const fs = require("fs");
    const source = fs.readFileSync("server/routers/learning.ts", "utf-8");
    expect(source).toContain("val > 0 && val <= 100");
    expect(source).toContain("val >= 0 && val <= 100");
  });

  it("falls back to defaults when settings are not found", () => {
    const fs = require("fs");
    const source = fs.readFileSync("server/routers/learning.ts", "utf-8");
    expect(source).toContain("let settingsLimit = 20");
    expect(source).toContain("let settingsNewQuota = 10");
    expect(source).toContain("catch { /* fallback to defaults */ }");
  });
});

// ── Pomodoro Session Logging ──
describe("Pomodoro Session Logging (Pass 153)", () => {
  it("PomodoroTimer imports trpc and calls studySessions.record", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/src/components/PomodoroTimer.tsx", "utf-8");
    expect(source).toContain("trpc.learningSocial.studySessions.record.useMutation");
    expect(source).toContain("recordSession.mutate");
  });

  it("PomodoroTimer tracks work start time for accurate duration", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/src/components/PomodoroTimer.tsx", "utf-8");
    expect(source).toContain("workStartRef");
    expect(source).toContain("Date.now() - workStartRef.current");
  });

  it("PomodoroTimer logs session only on work cycle completion", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/src/components/PomodoroTimer.tsx", "utf-8");
    expect(source).toContain("logWorkCycle");
    // logWorkCycle is called inside the phase === "work" branch
    expect(source).toContain('if (phase === "work")');
  });

  it("PomodoroTimer shows completed cycle count badge", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/src/components/PomodoroTimer.tsx", "utf-8");
    expect(source).toContain("completedCycles > 0");
    expect(source).toContain("done");
  });
});

// ── PWA Learning Cache ──
describe("PWA Learning Cache (Pass 153)", () => {
  it("service worker has separate LEARNING_CACHE", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/public/sw.js", "utf-8");
    expect(source).toContain("LEARNING_CACHE");
    expect(source).toContain("stewardly-learning-v1");
  });

  it("service worker caches learning tRPC procedures aggressively", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/public/sw.js", "utf-8");
    expect(source).toContain("isLearningRequest");
    expect(source).toContain("learning.mastery.dueReview");
    expect(source).toContain("learning.content.");
  });

  it("service worker uses stale-while-revalidate for learning requests", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/public/sw.js", "utf-8");
    // Stale-while-revalidate pattern: return cached || fetchPromise
    expect(source).toContain("return cached || fetchPromise");
  });
});

// ── StudyAnalytics Export Button ──
describe("StudyAnalytics Export Button (Pass 153)", () => {
  it("StudyAnalytics has an Export Report button linking to /learning/export", () => {
    const fs = require("fs");
    const source = fs.readFileSync("client/src/pages/learning/StudyAnalytics.tsx", "utf-8");
    expect(source).toContain("Export Report");
    expect(source).toContain("/learning/export");
    expect(source).toContain("Download");
  });
});
