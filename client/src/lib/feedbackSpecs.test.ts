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
];

describe("feedbackSpecs inventory", () => {
  it("has all 34 designed event keys defined", () => {
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
});
