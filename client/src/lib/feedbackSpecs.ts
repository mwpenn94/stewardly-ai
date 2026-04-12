/**
 * feedbackSpecs.ts — Runtime feedback definitions for the Platform Intelligence Layer
 *
 * Pass 116. Maps action event keys to multimodal feedback specs.
 * Used by PILProvider.giveFeedback(eventKey, data).
 */

/* ── types ─────────────────────────────────────────────────────── */

export interface FeedbackVisual {
  type: "toast" | "page_transition" | "highlight" | "modal" | "inline_data" |
        "animation" | "progress_update" | "error" | "success_celebration";
  content: Record<string, any>;
  duration?: number;
}

export interface FeedbackAudio {
  type: "spoken" | "sound_effect" | "tts_content" | "silent";
  text?: string;
  soundId?: string;
  ttsScript?: string;
}

export interface FeedbackSpec {
  visual?: FeedbackVisual;
  audio?: FeedbackAudio;
  haptic?: "light" | "medium" | "heavy" | "success" | "error";
}

type FeedbackFactory = (data?: any) => FeedbackSpec;

/* ── error messages (Steward personality) ──────────────────────── */

const STEWARD_ERRORS: Record<string, { message: string; recovery: string }> = {
  NETWORK: { message: "I've lost my connection.", recovery: "Reconnecting — your work is safe." },
  RATE_LIMIT: { message: "I'm thinking too fast.", recovery: "Give me a moment and try again." },
  AUTH_EXPIRED: { message: "Your session has expired.", recovery: "Sign in to continue where you left off." },
  GENERIC: { message: "Something went wrong on my end.", recovery: "Retrying automatically…" },
  AI_UNAVAILABLE: { message: "My intelligence systems are temporarily offline.", recovery: "You can still browse documents, check compliance, and view client profiles." },
  NOT_FOUND: { message: "I couldn't find what you're looking for.", recovery: "Try searching with different terms." },
  PERMISSION: { message: "You don't have access to that.", recovery: "Contact your administrator if you need it." },
};

function getError(code: string) {
  return STEWARD_ERRORS[code] || STEWARD_ERRORS.GENERIC;
}

/* ── spec definitions ──────────────────────────────────────────── */

export const FEEDBACK_SPECS: Record<string, FeedbackFactory> = {

  // ── NAVIGATION ──────────────────────────────────────────
  "navigate.success": (data) => ({
    visual: { type: "page_transition", content: { to: data?.page } },
    audio: { type: "spoken", text: data?.pageName || "Done" },
  }),

  // ── CHAT ────────────────────────────────────────────────
  "chat.sent": () => ({
    visual: { type: "animation", content: { name: "message-send" }, duration: 200 },
    audio: { type: "sound_effect", soundId: "send" },
    haptic: "light",
  }),
  "chat.streaming_start": () => ({
    visual: { type: "animation", content: { name: "typing-start" } },
    audio: { type: "silent" },
  }),
  "chat.streaming_end": () => ({
    visual: { type: "animation", content: { name: "typing-end" } },
    audio: { type: "silent" },
  }),
  "chat.error": (data) => {
    const err = getError(data?.code);
    return {
      visual: { type: "error", content: { title: err.message, description: err.recovery, variant: "destructive" } },
      audio: { type: "spoken", text: `${err.message} ${err.recovery}` },
      haptic: "error",
    };
  },
  "chat.new_conversation": () => ({
    visual: { type: "animation", content: { name: "fade-in" }, duration: 200 },
    audio: { type: "sound_effect", soundId: "navigate" },
  }),

  // ── LEARNING ────────────────────────────────────────────
  "learning.answer_correct": () => ({
    visual: { type: "success_celebration", content: { intensity: "light", color: "emerald" } },
    audio: { type: "sound_effect", soundId: "correct" },
    haptic: "success",
  }),
  "learning.answer_incorrect": (data) => ({
    visual: { type: "highlight", content: { selector: `[data-option="${data?.correctKey}"]` }, duration: 2000 },
    audio: { type: "spoken", text: `Not quite. The answer is ${data?.correctKey}.` },
    haptic: "error",
  }),
  "learning.exam_complete": (data) => ({
    visual: { type: "success_celebration", content: { intensity: data?.percentage >= 70 ? "heavy" : "light", score: data?.percentage } },
    audio: { type: "spoken", text: `Exam complete. You scored ${data?.percentage}%. ${data?.percentage >= 70 ? "Great work!" : "Keep studying."}` },
    haptic: "success",
  }),
  "learning.case_complete": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "medium" } },
    audio: { type: "spoken", text: `Case study complete. Score: ${data?.percentage}%. ${data?.complianceFlags > 0 ? `${data.complianceFlags} compliance flag${data.complianceFlags > 1 ? "s" : ""} raised.` : "No compliance issues."}` },
    haptic: "success",
  }),
  "learning.streak_milestone": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "medium", streak: data?.days } },
    audio: { type: "spoken", text: `${data?.days}-day study streak! Keep it going.` },
    haptic: "success",
  }),
  "learning.mastered": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "light" } },
    audio: { type: "spoken", text: `${data?.term} mastered.` },
    haptic: "success",
  }),
  "learning.flashcard_flip": () => ({
    visual: { type: "animation", content: { name: "card-flip" }, duration: 300 },
    audio: { type: "silent" },
    haptic: "light",
  }),
  "learning.srs_rating": (data) => ({
    visual: { type: "animation", content: { name: "card-slide" }, duration: 250 },
    audio: { type: "spoken", text: data?.isLast ? "Session complete." : "" },
    haptic: "light",
  }),
  "learning.achievement_earned": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "heavy" } },
    audio: { type: "spoken", text: `Achievement unlocked: ${data?.title}!` },
    haptic: "heavy",
  }),

  // ── COMPLIANCE ──────────────────────────────────────────
  "compliance.check_passed": () => ({
    visual: { type: "success_celebration", content: { intensity: "medium" } },
    audio: { type: "spoken", text: "Compliance check passed." },
    haptic: "success",
  }),
  "compliance.flag_raised": (data) => ({
    visual: { type: "toast", content: { variant: "warning", title: `Compliance flag: ${data?.flag}`, persistent: true } },
    audio: { type: "spoken", text: `Compliance flag raised. ${data?.flag}. Please review.` },
    haptic: "heavy",
  }),

  // ── GOALS & WINS (Pass 11 / G22) ────────────────────────
  "goal.completed": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "heavy", color: "gold" } },
    audio: {
      type: "spoken",
      text: data?.goalName ? `Goal complete: ${data.goalName}.` : "Goal complete.",
    },
    haptic: "success",
  }),
  "report.generated": (data) => ({
    visual: {
      type: "toast",
      content: {
        variant: "success",
        title: "Report ready",
        description: data?.reportName || "Your report has been generated.",
      },
    },
    audio: {
      type: "spoken",
      text: data?.reportName ? `${data.reportName} is ready.` : "Your report is ready.",
    },
    haptic: "success",
  }),
  "engine.calculation_complete": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "light" } },
    audio: {
      type: "spoken",
      text: data?.summary || "Calculation complete.",
    },
    haptic: "success",
  }),
  "milestone.reached": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "heavy" } },
    audio: {
      type: "spoken",
      text: data?.name ? `Milestone reached: ${data.name}!` : "Milestone reached!",
    },
    haptic: "heavy",
  }),

  // ── DOCUMENTS ───────────────────────────────────────────
  "document.uploaded": (data) => ({
    visual: { type: "toast", content: { variant: "success", title: `${data?.filename} uploaded` } },
    audio: { type: "spoken", text: `${data?.filename} uploaded. Ready to analyze.` },
    haptic: "light",
  }),
  "document.analyzed": (data) => ({
    visual: { type: "toast", content: { variant: "info", title: "Analysis complete", description: `${data?.findings} key findings` } },
    audio: { type: "spoken", text: `Analysis complete. ${data?.findings} key findings. Want me to walk through them?` },
  }),

  // ── AUDIO ───────────────────────────────────────────────
  "audio.speed_changed": (data) => ({
    visual: { type: "toast", content: { variant: "info", title: `Speed: ${data?.speed}x`, duration: 1500 } },
    audio: { type: "spoken", text: `${data?.speed}x` },
  }),
  "audio.preferences_saved": () => ({
    visual: { type: "toast", content: { variant: "success", title: "Audio preferences saved" } },
    audio: { type: "spoken", text: "Preferences saved." },
    haptic: "success",
  }),

  // ── VOICE ───────────────────────────────────────────────
  "voice.listening_started": () => ({
    visual: { type: "animation", content: { name: "mic-pulse" }, duration: -1 },
    audio: { type: "sound_effect", soundId: "mic_on" },
  }),
  "voice.listening_stopped": () => ({
    visual: { type: "animation", content: { name: "mic-pulse-stop" } },
    audio: { type: "sound_effect", soundId: "mic_off" },
  }),
  "voice.not_understood": () => ({
    visual: { type: "toast", content: { variant: "muted", title: "Didn't catch that. Try again?" } },
    audio: { type: "spoken", text: "Sorry, I didn't catch that." },
  }),

  // ── CLIENT ──────────────────────────────────────────────
  "client.twin_updated": () => ({
    visual: { type: "toast", content: { variant: "info", title: "Financial twin updated" } },
    audio: { type: "spoken", text: "Your financial twin has been updated." },
  }),
  "client.visibility_changed": (data) => ({
    visual: { type: "toast", content: { variant: "success", title: `Visibility: ${data?.level}` } },
    audio: { type: "spoken", text: `Privacy set to ${data?.level}.` },
  }),

  // ── ADVISOR ─────────────────────────────────────────────
  "advisor.client_added": (data) => ({
    visual: { type: "toast", content: { variant: "success", title: `${data?.name} added` } },
    audio: { type: "spoken", text: `${data?.name} added. Their financial twin is building.` },
    haptic: "success",
  }),
  "advisor.recommendation_delivered": () => ({
    visual: { type: "success_celebration", content: { intensity: "medium" } },
    audio: { type: "spoken", text: "Recommendation delivered. Compliance documentation generated." },
    haptic: "success",
  }),

  // ── CALCULATORS ─────────────────────────────────────────
  "calculator.result": (data) => ({
    visual: { type: "inline_data", content: data },
    audio: { type: "spoken", text: `Result: ${data?.formatted}. ${data?.insight || ""}` },
  }),

  // ── CODE CHAT ───────────────────────────────────────────
  "codechat.connected": (data) => ({
    visual: { type: "toast", content: { variant: "success", title: `Connected to ${data?.repo}` } },
    audio: { type: "spoken", text: `Connected to ${data?.repo}. Ready to code.` },
    haptic: "success",
  }),

  // ── HANDS-FREE MODE ─────────────────────────────────────
  "handsfree.activated": () => ({
    visual: { type: "toast", content: { variant: "info", title: "Hands-free mode active" } },
    audio: { type: "sound_effect", soundId: "mode_activate" },
  }),
  "handsfree.deactivated": () => ({
    visual: { type: "toast", content: { variant: "info", title: "Hands-free mode off" } },
    audio: { type: "sound_effect", soundId: "mode_deactivate" },
  }),

  // ── ONBOARDING ──────────────────────────────────────────
  "onboarding.step_complete": () => ({
    visual: { type: "animation", content: { name: "step-check" }, duration: 300 },
    audio: { type: "sound_effect", soundId: "correct" },
    haptic: "light",
  }),
  "onboarding.complete": (data) => ({
    visual: { type: "success_celebration", content: { intensity: "medium" } },
    audio: { type: "spoken", text: `${data?.persona} setup complete. You're all set.` },
    haptic: "success",
  }),
};

/**
 * Get a feedback spec for an event key.
 * Returns undefined if no spec exists (event has no designed feedback).
 */
export function getFeedback(key: string, data?: any): FeedbackSpec | undefined {
  const factory = FEEDBACK_SPECS[key];
  return factory ? factory(data) : undefined;
}
