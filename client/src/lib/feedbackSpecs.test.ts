import { describe, it, expect } from "vitest";
import { FEEDBACK_SPECS, getFeedback } from "./feedbackSpecs";

/**
 * Build Loop Pass 2 — lock the feedbackSpecs inventory in place as a
 * regression guard. Pass 1 started wiring these into Chat.tsx /
 * PlatformIntelligence.tsx; this test makes sure nobody accidentally drops
 * one of the 30 designed events while refactoring.
 */

const REQUIRED_KEYS = [
  // navigation
  "navigate.success",
  // chat
  "chat.sent",
  "chat.streaming_start",
  "chat.streaming_end",
  "chat.error",
  "chat.new_conversation",
  // learning
  "learning.answer_correct",
  "learning.answer_incorrect",
  "learning.exam_complete",
  "learning.case_complete",
  "learning.streak_milestone",
  "learning.mastered",
  "learning.flashcard_flip",
  "learning.srs_rating",
  "learning.achievement_earned",
  // compliance
  "compliance.check_passed",
  "compliance.flag_raised",
  // documents
  "document.uploaded",
  "document.analyzed",
  // audio
  "audio.speed_changed",
  "audio.preferences_saved",
  // voice
  "voice.listening_started",
  "voice.listening_stopped",
  "voice.not_understood",
  // client
  "client.twin_updated",
  "client.visibility_changed",
  // advisor
  "advisor.client_added",
  "advisor.recommendation_delivered",
  // calculators
  "calculator.result",
  // code chat
  "codechat.connected",
  // hands-free
  "handsfree.activated",
  "handsfree.deactivated",
  // onboarding
  "onboarding.step_complete",
  "onboarding.complete",
  // Pass 11 (G22) — goal / milestone / report / engine wins
  "goal.completed",
  "report.generated",
  "engine.calculation_complete",
  "milestone.reached",
];

describe("feedbackSpecs inventory", () => {
  it("has all designed event keys defined", () => {
    for (const key of REQUIRED_KEYS) {
      expect(FEEDBACK_SPECS[key], `missing spec: ${key}`).toBeDefined();
    }
  });

  it("every factory returns a FeedbackSpec shape with at least one channel", () => {
    for (const [key, factory] of Object.entries(FEEDBACK_SPECS)) {
      const spec = factory({});
      const hasAny = Boolean(spec.visual || spec.audio || spec.haptic);
      expect(hasAny, `spec ${key} must fire on at least one channel`).toBe(true);
    }
  });

  it("getFeedback returns undefined for unknown keys (safe no-op)", () => {
    expect(getFeedback("totally.bogus.key")).toBeUndefined();
  });

  it("chat.error dispatches Steward-personality recovery copy by code", () => {
    const network = getFeedback("chat.error", { code: "NETWORK" });
    const auth = getFeedback("chat.error", { code: "AUTH_EXPIRED" });
    const rate = getFeedback("chat.error", { code: "RATE_LIMIT" });
    const generic = getFeedback("chat.error", { code: "UNKNOWN_CODE" });
    expect(network?.visual?.content?.title).toMatch(/connection/i);
    expect(auth?.visual?.content?.title).toMatch(/session/i);
    expect(rate?.visual?.content?.title).toMatch(/thinking too fast/i);
    // Unknown codes fall back to GENERIC:
    expect(generic?.visual?.content?.title).toMatch(/something went wrong/i);
  });

  it("chat.sent uses a haptic light + send earcon (low-friction feel)", () => {
    const spec = getFeedback("chat.sent");
    expect(spec?.haptic).toBe("light");
    expect(spec?.audio?.type).toBe("sound_effect");
    expect(spec?.audio?.soundId).toBe("send");
  });

  it("learning.exam_complete scales celebration intensity by score", () => {
    const pass = getFeedback("learning.exam_complete", { percentage: 85 });
    const fail = getFeedback("learning.exam_complete", { percentage: 55 });
    expect(pass?.visual?.content?.intensity).toBe("heavy");
    expect(fail?.visual?.content?.intensity).toBe("light");
  });

  it("voice.not_understood is gentle — no heavy haptic, no error visual", () => {
    const spec = getFeedback("voice.not_understood");
    expect(spec?.haptic).toBeUndefined();
    expect(spec?.visual?.type).toBe("toast");
  });

  /* Pass 11 (G22) — non-learning win specs */
  it("goal.completed fires heavy celebration + success haptic", () => {
    const spec = getFeedback("goal.completed", { goalName: "Retirement on track" });
    expect(spec?.visual?.type).toBe("success_celebration");
    expect(spec?.visual?.content?.intensity).toBe("heavy");
    expect(spec?.haptic).toBe("success");
    expect(spec?.audio?.text).toMatch(/Retirement on track/);
  });

  it("report.generated surfaces a success toast with the report name", () => {
    const spec = getFeedback("report.generated", { reportName: "2026 Q1 Plan" });
    expect(spec?.visual?.type).toBe("toast");
    expect(spec?.visual?.content?.description).toMatch(/2026 Q1 Plan/);
  });

  it("milestone.reached uses heavy celebration + heavy haptic", () => {
    const spec = getFeedback("milestone.reached", { name: "First 10 clients" });
    expect(spec?.visual?.content?.intensity).toBe("heavy");
    expect(spec?.haptic).toBe("heavy");
  });

  it("engine.calculation_complete is gentle (light) — it's a calculation, not a celebration", () => {
    const spec = getFeedback("engine.calculation_complete");
    expect(spec?.visual?.content?.intensity).toBe("light");
  });

  it("compliance.check_passed is now a celebration (Pass 11 upgrade from toast)", () => {
    const spec = getFeedback("compliance.check_passed");
    expect(spec?.visual?.type).toBe("success_celebration");
  });
});
