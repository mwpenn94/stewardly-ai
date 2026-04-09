/**
 * FeedbackDispatcher.ts — The GLUE between feedbackSpecs and actual UI
 *
 * Pass 123. This is what makes the PIL actually work.
 */

import { toast } from "sonner";
import { getFeedback, type FeedbackSpec } from "./feedbackSpecs";

/* ── types ─────────────────────────────────────────────────────── */

type ModalityPref = "visual_only" | "audio_only" | "both" | "minimal";

interface DispatchContext {
  modalityPref: ModalityPref;
  deviceType: "mobile" | "tablet" | "desktop";
  speak: (text: string) => void;
  playAudio: (item: { id: string; type: string; title: string; script: string }) => void;
  playSound: (soundId: string) => void;
  celebrate: (intensity: "light" | "medium" | "heavy", x?: number, y?: number) => void;
  soundEffectsEnabled: boolean;
}

/* ── visual dispatch ───────────────────────────────────────────── */

function dispatchVisual(visual: FeedbackSpec["visual"], ctx: DispatchContext) {
  if (!visual) return;
  if (ctx.modalityPref === "audio_only") return;

  switch (visual.type) {
    case "toast": {
      const { variant, title, description, persistent, duration: dur } = visual.content;
      const toastFn = variant === "success" ? toast.success
        : variant === "warning" ? toast.warning
        : variant === "destructive" || variant === "error" ? toast.error
        : toast.info;
      toastFn(title, {
        description,
        duration: persistent ? Infinity : (dur || 4000),
      });
      break;
    }
    case "success_celebration": {
      const { intensity = "medium" } = visual.content;
      ctx.celebrate(intensity);
      break;
    }
    case "animation": {
      const { name, duration } = visual.content;
      document.dispatchEvent(new CustomEvent("pil:animation", {
        detail: { name, duration: duration || 300 },
      }));
      break;
    }
    case "highlight": {
      const { selector, duration: highlightDur } = visual.content;
      const el = document.querySelector(selector);
      if (el) {
        el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        }, highlightDur || 2000);
      }
      break;
    }
    case "error": {
      const { title, description } = visual.content;
      toast.error(title, { description, duration: 6000 });
      break;
    }
    case "progress_update": {
      document.dispatchEvent(new CustomEvent("pil:progress", { detail: visual.content }));
      break;
    }
    case "inline_data": {
      document.dispatchEvent(new CustomEvent("pil:inline-data", { detail: visual.content }));
      break;
    }
    case "modal": {
      document.dispatchEvent(new CustomEvent("pil:modal", { detail: visual.content }));
      break;
    }
    case "page_transition": {
      break;
    }
  }
}

/* ── audio dispatch ────────────────────────────────────────────── */

function dispatchAudio(audio: FeedbackSpec["audio"], ctx: DispatchContext) {
  if (!audio) return;
  if (ctx.modalityPref === "visual_only") return;
  if (ctx.modalityPref === "minimal" && audio.type !== "spoken") return;

  switch (audio.type) {
    case "spoken":
      if (audio.text) ctx.speak(audio.text);
      break;
    case "sound_effect":
      if (audio.soundId && ctx.soundEffectsEnabled) {
        ctx.playSound(audio.soundId);
      }
      break;
    case "tts_content":
      if (audio.ttsScript) {
        ctx.playAudio({
          id: `feedback-${Date.now()}`,
          type: "page_narration",
          title: "Response",
          script: audio.ttsScript,
        });
      }
      break;
    case "silent":
      break;
  }
}

/* ── haptic dispatch ───────────────────────────────────────────── */

function dispatchHaptic(haptic: FeedbackSpec["haptic"], ctx: DispatchContext) {
  if (!haptic) return;
  if (ctx.deviceType !== "mobile") return;
  if (!navigator.vibrate) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 40,
    success: [10, 50, 10],
    error: [30, 30, 30],
  };

  const pattern = patterns[haptic];
  if (pattern) navigator.vibrate(pattern);
}

/* ── main dispatcher ───────────────────────────────────────────── */

export function dispatchFeedback(
  eventKey: string,
  data: any,
  ctx: DispatchContext,
): void {
  const spec = getFeedback(eventKey, data);
  if (!spec) return;

  dispatchVisual(spec.visual, ctx);
  dispatchAudio(spec.audio, ctx);
  dispatchHaptic(spec.haptic, ctx);
}

export function createFeedbackDispatcher(ctx: DispatchContext) {
  return (eventKey: string, data?: any) => dispatchFeedback(eventKey, data, ctx);
}
