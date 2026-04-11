/**
 * PlatformIntelligence.tsx — Core PIL React context + provider
 *
 * Pass 106. This is the nervous system. Mount once in App.tsx.
 * Every component in the app can call usePlatformIntelligence() to:
 * - Dispatch intents ("navigate to clients")
 * - Execute actions
 * - Trigger multimodal feedback
 * - Check current modality preference
 * - Enter/exit hands-free mode
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAudioCompanion } from "./AudioCompanion";
import { dispatchFeedback } from "@/lib/FeedbackDispatcher";
import { useCelebration } from "@/lib/CelebrationEngine";
// Pass 2 (multisensory): delegate intent classification to the shared
// parser — same function handles text slash-commands AND voice commands,
// same ROUTE_MAP is used by navigation keyboard chords, /go slash commands,
// and PIL voice dispatch. One source of truth.
import { parseIntent, friendlyRouteName } from "@/lib/multisensory/intentParser";
import { announce } from "@/lib/multisensory/LiveAnnouncer";

/* ── Types ──────────────────────────────────────────────────────── */

type IntentSource = "chat" | "voice" | "click" | "keyboard" | "gesture" | "contextual";
type ModalityPref = "visual_only" | "audio_only" | "both" | "minimal";

interface PILState {
  modalityPref: ModalityPref;
  handsFreeActive: boolean;
  voiceListening: boolean;
  currentPage: string;
  deviceType: "mobile" | "tablet" | "desktop";
}

interface PILActions {
  processIntent: (source: IntentSource, input: string) => Promise<void>;
  giveFeedback: (eventKey: string, data?: any) => void;
  setModalityPref: (pref: ModalityPref) => void;
  enterHandsFree: () => void;
  exitHandsFree: () => void;
  /** Pass 2: listen for one utterance, process it through `processIntent`,
   *  then stop. Used by the Alt+V global shortcut for push-to-talk.
   *  Returns a promise that resolves when recognition ends. */
  listenOnce: () => Promise<void>;
  speak: (text: string) => void;
  playSound: (soundId: string) => void;
}

type PILContext = PILState & PILActions;

/* Pass 2: ROUTE_MAP + friendlyName were moved to
 * `@/lib/multisensory/intentParser` so voice, text slash commands, and the
 * keyboard intent router all share one source of truth. The parser's
 * ROUTE_MAP is broader than what lived here before — see intentParser.ts. */

/* ── Sound effects (Web Audio API) ─────────────────────────────── */

function playTone(freq: number, dur: number, type: OscillatorType, then?: () => void) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
    if (then) setTimeout(then, dur * 1000);
  } catch { /* AudioContext not available */ }
}

const SOUNDS: Record<string, () => void> = {
  send: () => playTone(880, 0.08, "sine"),
  correct: () => playTone(660, 0.1, "sine", () => playTone(880, 0.15, "sine")),
  error: () => playTone(330, 0.15, "sawtooth"),
  navigate: () => playTone(440, 0.05, "sine"),
  mic_on: () => playTone(660, 0.05, "sine"),
  mic_off: () => playTone(440, 0.05, "sine"),
  mode_activate: () => { playTone(440, 0.08, "sine"); setTimeout(() => playTone(660, 0.08, "sine"), 100); setTimeout(() => playTone(880, 0.12, "sine"), 200); },
  mode_deactivate: () => { playTone(880, 0.08, "sine"); setTimeout(() => playTone(660, 0.08, "sine"), 100); setTimeout(() => playTone(440, 0.12, "sine"), 200); },
};

/* ── Web Speech TTS ────────────────────────────────────────────── */

function speakShort(text: string, rate = 1.1) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.volume = 0.7;
  window.speechSynthesis.speak(u);
}

/* ── Context ───────────────────────────────────────────────────── */

const PILCtx = createContext<PILContext | null>(null);

export function usePlatformIntelligence() {
  const ctx = useContext(PILCtx);
  if (!ctx) throw new Error("usePlatformIntelligence must be within PILProvider");
  return ctx;
}

/* Pass 2: `friendlyName` was moved to `friendlyRouteName` in
 * `@/lib/multisensory/intentParser` (already imported above). */

/* ── Provider ──────────────────────────────────────────────────── */

export function PILProvider({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const audioCompanion = useAudioCompanion();
  const celebrate = useCelebration();

  const [state, setState] = useState<PILState>({
    modalityPref: "both",
    handsFreeActive: false,
    voiceListening: false,
    currentPage: location,
    deviceType: typeof window !== "undefined" && window.innerWidth < 768
      ? "mobile" : typeof window !== "undefined" && window.innerWidth < 1024 ? "tablet" : "desktop",
  });

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setState(prev => ({ ...prev, currentPage: location }));
  }, [location]);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setState(prev => ({
        ...prev,
        deviceType: w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop",
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Feedback rendering (wired to FeedbackDispatcher) ──── */

  const giveFeedback = useCallback((eventKey: string, data?: any) => {
    dispatchFeedback(eventKey, data, {
      modalityPref: state.modalityPref,
      deviceType: state.deviceType,
      speak: speakShort,
      playAudio: (item) => audioCompanion.play(item as any),
      playSound: (id) => SOUNDS[id]?.(),
      celebrate,
      soundEffectsEnabled: true,
    });
  }, [state.modalityPref, state.deviceType, audioCompanion, celebrate]);

  /* ── Intent processing ───────────────────────────────────── */

  // Pass 2: delegated to `lib/multisensory/intentParser.parseIntent`.
  // Bare words ("learning") are only permitted in voice / hands-free mode
  // so that a user typing plain prose in some future text intake doesn't
  // accidentally navigate away.
  const processIntent = useCallback(async (source: IntentSource, input: string) => {
    const allowBareNav = source === "voice" || state.handsFreeActive;
    const parsed = parseIntent(input, { allowBareNav });

    switch (parsed.kind) {
      case "navigate":
        navigate(parsed.route);
        if (state.modalityPref !== "visual_only") {
          speakShort(parsed.label || friendlyRouteName(parsed.route));
        }
        announce(`Navigated to ${parsed.label}`, "polite");
        SOUNDS.navigate?.();
        return;

      case "audio":
        if (parsed.action === "pause") {
          audioCompanion.pause();
        } else if (parsed.action === "resume") {
          audioCompanion.resume();
        } else if (parsed.action === "speed_up") {
          audioCompanion.adjustSpeed(0.25);
          speakShort(`${(audioCompanion.speed + 0.25).toFixed(1)}x`);
        } else if (parsed.action === "slow_down") {
          audioCompanion.adjustSpeed(-0.25);
          speakShort(`${Math.max(0.5, audioCompanion.speed - 0.25).toFixed(1)}x`);
        }
        return;

      case "read_page":
        audioCompanion.readCurrentPage();
        return;

      case "hands_free":
        if (parsed.action === "enter") actions.enterHandsFree();
        else actions.exitHandsFree();
        return;

      case "learning": {
        const detail: Record<string, unknown> = { action: parsed.action };
        if (parsed.action === "rate" && parsed.rating) {
          detail.rating = parsed.rating;
        }
        document.dispatchEvent(new CustomEvent("pil:learning", { detail }));
        return;
      }

      case "focus_chat":
        window.dispatchEvent(
          new CustomEvent("multisensory-intent", {
            detail: { intent: "chat.focus_input", source: "voice" },
          }),
        );
        return;

      case "open_palette":
        window.dispatchEvent(new CustomEvent("toggle-command-palette"));
        return;

      case "help":
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "?", bubbles: true }),
        );
        return;

      case "unknown":
        if (source === "voice") {
          speakShort("I didn't catch that. Try again?");
        }
        return;
    }
  }, [navigate, state.modalityPref, state.handsFreeActive, audioCompanion]);

  /* ── Voice listening ─────────────────────────────────────── */

  const startListening = useCallback(() => {
    if (recognitionRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        processIntent("voice", last[0].transcript.trim());
      }
    };

    recognition.onend = () => {
      if (state.handsFreeActive) {
        setTimeout(() => recognitionRef.current?.start(), 100);
      } else {
        setState(prev => ({ ...prev, voiceListening: false }));
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState(prev => ({ ...prev, voiceListening: true }));
  }, [processIntent, state.handsFreeActive]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState(prev => ({ ...prev, voiceListening: false }));
  }, []);

  /* Pass 2: single-utterance recognition for push-to-talk (Alt+V). */
  const listenOnce = useCallback(async () => {
    // If hands-free is already running, don't interfere with its loop —
    // let it handle the next utterance naturally.
    if (state.handsFreeActive) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speakShort("Voice input isn't supported in this browser.");
      return;
    }

    return new Promise<void>((resolve) => {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        let finalized = false;
        const cleanup = () => {
          recognitionRef.current = null;
          setState((prev) => ({ ...prev, voiceListening: false }));
          resolve();
        };

        recognition.onresult = (event: any) => {
          finalized = true;
          const last = event.results[event.results.length - 1];
          if (last.isFinal) {
            processIntent("voice", last[0].transcript.trim());
          }
        };
        recognition.onerror = () => {
          if (!finalized) speakShort("Sorry, I didn't catch that.");
          cleanup();
        };
        recognition.onend = cleanup;

        recognitionRef.current = recognition;
        recognition.start();
        setState((prev) => ({ ...prev, voiceListening: true }));
        SOUNDS.mic_on?.();
      } catch {
        // Recognition.start() can throw if a prior instance is still running,
        // or on a permission denial. Fail silent — the user will simply not
        // see the mic-pulse animation.
        setState((prev) => ({ ...prev, voiceListening: false }));
        resolve();
      }
    });
  }, [processIntent, state.handsFreeActive]);

  /* ── Actions ─────────────────────────────────────────────── */

  const actions: PILActions = {
    processIntent,
    giveFeedback,

    setModalityPref: (pref) => setState(prev => ({ ...prev, modalityPref: pref })),

    enterHandsFree: () => {
      SOUNDS.mode_activate();
      setState(prev => ({ ...prev, handsFreeActive: true, modalityPref: "both" }));
      startListening();
      setTimeout(() => {
        speakShort("Hands-free mode active. What would you like to do?");
      }, 500);
    },

    exitHandsFree: () => {
      SOUNDS.mode_deactivate();
      stopListening();
      audioCompanion.pause();
      setState(prev => ({ ...prev, handsFreeActive: false, modalityPref: "both" }));
      speakShort("Hands-free mode off.");
    },

    listenOnce,

    speak: speakShort,
    playSound: (soundId) => SOUNDS[soundId]?.(),
  };

  return (
    <PILCtx.Provider value={{ ...state, ...actions }}>
      {children}
    </PILCtx.Provider>
  );
}
