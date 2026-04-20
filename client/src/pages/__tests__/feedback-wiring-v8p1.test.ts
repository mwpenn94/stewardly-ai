/**
 * v8 Pass 1 — Feedback Wiring Verification Tests
 *
 * Verifies that all 14 previously-unwired feedback specs are now
 * dispatched from their correct files. Uses static analysis (import
 * and call-site checks) rather than runtime rendering.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CLIENT = join(__dirname, "..", "..");

function readSrc(relPath: string): string {
  return readFileSync(join(CLIENT, relPath), "utf-8");
}

describe("Feedback spec wiring — v8 Pass 1", () => {
  // ── COMPLIANCE ──────────────────────────────────────────────
  it("ComplianceAudit imports sendFeedback", () => {
    const src = readSrc("pages/ComplianceAudit.tsx");
    expect(src).toContain('import { sendFeedback } from "@/lib/feedbackSpecs"');
  });

  it("ComplianceAudit dispatches compliance.check_passed", () => {
    const src = readSrc("pages/ComplianceAudit.tsx");
    expect(src).toContain('sendFeedback("compliance.check_passed")');
  });

  // ── DOCUMENTS ───────────────────────────────────────────────
  it("KnowledgeBaseTab imports sendFeedback", () => {
    const src = readSrc("pages/settings/KnowledgeBaseTab.tsx");
    expect(src).toContain('import { sendFeedback } from "@/lib/feedbackSpecs"');
  });

  it("KnowledgeBaseTab dispatches document.uploaded", () => {
    const src = readSrc("pages/settings/KnowledgeBaseTab.tsx");
    expect(src).toContain('sendFeedback("document.uploaded"');
  });

  // ── REPORTS ─────────────────────────────────────────────────
  it("DownloadReportButton imports sendFeedback", () => {
    const src = readSrc("components/wealth-engine/DownloadReportButton.tsx");
    expect(src).toContain('import { sendFeedback } from "@/lib/feedbackSpecs"');
  });

  it("DownloadReportButton dispatches report.generated", () => {
    const src = readSrc("components/wealth-engine/DownloadReportButton.tsx");
    expect(src).toContain('sendFeedback("report.generated"');
  });

  // ── ADVISOR ─────────────────────────────────────────────────
  it("Portal imports sendFeedback", () => {
    const src = readSrc("pages/Portal.tsx");
    expect(src).toContain('import { sendFeedback } from "@/lib/feedbackSpecs"');
  });

  it("Portal dispatches advisor.client_added", () => {
    const src = readSrc("pages/Portal.tsx");
    expect(src).toContain('sendFeedback("advisor.client_added"');
  });

  // ── ONBOARDING ──────────────────────────────────────────────
  it("OnboardingTour dispatches onboarding.step_complete and onboarding.complete", () => {
    const src = readSrc("components/OnboardingTour.tsx");
    expect(src).toContain('sendFeedback("onboarding.step_complete")');
    expect(src).toContain('sendFeedback("onboarding.complete"');
  });

  it("WealthEngineOnboarding dispatches onboarding.complete", () => {
    const src = readSrc("pages/calculators/WealthEngineOnboarding.tsx");
    expect(src).toContain("sendFeedback('onboarding.complete'");
  });

  // ── ENGINE CALCULATIONS ─────────────────────────────────────
  it("StrategyComparison dispatches engine.calculation_complete", () => {
    const src = readSrc("pages/wealth-engine/StrategyComparison.tsx");
    expect(src).toContain('sendFeedback("engine.calculation_complete"');
  });

  it("BusinessIncome dispatches engine.calculation_complete", () => {
    const src = readSrc("pages/wealth-engine/BusinessIncome.tsx");
    expect(src).toContain('sendFeedback("engine.calculation_complete"');
  });

  it("PracticeToWealth dispatches engine.calculation_complete", () => {
    const src = readSrc("pages/wealth-engine/PracticeToWealth.tsx");
    expect(src).toContain('sendFeedback("engine.calculation_complete"');
  });

  it("WealthConfigurator dispatches engine.calculation_complete", () => {
    const src = readSrc("pages/wealth-engine/WealthConfigurator.tsx");
    expect(src).toContain('sendFeedback("engine.calculation_complete"');
  });

  // ── ALREADY-WIRED BY PIL (sanity check) ─────────────────────
  it("PlatformIntelligence dispatches handsfree and voice specs", () => {
    const src = readSrc("components/PlatformIntelligence.tsx");
    expect(src).toContain('giveFeedback("handsfree.activated")');
    expect(src).toContain('giveFeedback("handsfree.deactivated")');
    expect(src).toContain('giveFeedback("voice.listening_started")');
    expect(src).toContain('giveFeedback("voice.listening_stopped")');
    expect(src).toContain('giveFeedback("voice.not_understood")');
  });
});
