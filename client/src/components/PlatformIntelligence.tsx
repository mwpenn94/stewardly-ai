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
  speak: (text: string) => void;
  playSound: (soundId: string) => void;
}

type PILContext = PILState & PILActions;

/* ── Route map for intent → navigation ─────────────────────────── */

const ROUTE_MAP: Record<string, string> = {
  "chat": "/chat",
  "clients": "/relationships",
  "my clients": "/relationships",
  "cases": "/my-work",
  "my work": "/my-work",
  "work": "/my-work",
  "compliance": "/compliance-audit",
  "market data": "/market-data",
  "market": "/market-data",
  "calculators": "/wealth-engine",
  "calculator": "/wealth-engine",
  "wealth engine": "/wealth-engine",
  "learn": "/learning",
  "learning": "/learning",
  "study": "/learning",
  "settings": "/settings",
  "help": "/help",
  "documents": "/documents",
  "my documents": "/documents",
  "progress": "/progress",
  "my progress": "/progress",
  "team": "/manager",
  "team dashboard": "/manager",
  "admin": "/admin",
  "platform admin": "/admin",
  "financial twin": "/financial-twin",
  "my financial twin": "/financial-twin",
  "suitability": "/suitability",
  "recommendations": "/recommendations",
  "audio": "/settings/audio",
  "audio settings": "/settings/audio",
};

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

/* ── Helpers ───────────────────────────────────────────────────── */

function friendlyName(path: string): string {
  const names: Record<string, string> = {
    "/chat": "Chat",
    "/relationships": "Clients",
    "/my-work": "My Work",
    "/compliance-audit": "Compliance",
    "/market-data": "Market Data",
    "/wealth-engine": "Calculators",
    "/learning": "Learning Center",
    "/settings": "Settings",
    "/help": "Help",
    "/documents": "Documents",
    "/progress": "My Progress",
    "/manager": "Team Dashboard",
    "/admin": "Platform Admin",
    "/financial-twin": "Financial Twin",
    "/suitability": "Suitability",
    "/recommendations": "Recommendations",
  };
  return names[path] || path.split("/").pop() || "page";
}

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

  const processIntent = useCallback(async (source: IntentSource, input: string) => {
    const normalized = input.toLowerCase().trim();

    // Level 1: Navigation intent (bare words only match in voice/hands-free mode)
    const navPatterns: RegExp[] = [
      /^(?:go to|open|show me|navigate to|show)\s+(.+)$/i,
    ];
    if (source === "voice" || state.handsFreeActive) {
      navPatterns.push(/^(.+)$/i);
    }

    for (const pattern of navPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const target = match[1].trim();
        const route = ROUTE_MAP[target];
        if (route) {
          navigate(route);
          if (state.modalityPref !== "visual_only") {
            speakShort(friendlyName(route));
          }
          SOUNDS.navigate?.();
          return;
        }
      }
    }

    // Level 2: Audio commands
    if (/^(pause|stop|hold on)$/i.test(normalized)) {
      audioCompanion.pause();
      return;
    }
    if (/^(resume|continue|play|keep going)$/i.test(normalized)) {
      audioCompanion.resume();
      return;
    }
    if (/^(speed up|faster)$/i.test(normalized)) {
      audioCompanion.adjustSpeed(0.25);
      speakShort(`${(audioCompanion.speed + 0.25).toFixed(1)}x`);
      return;
    }
    if (/^(slow down|slower)$/i.test(normalized)) {
      audioCompanion.adjustSpeed(-0.25);
      speakShort(`${Math.max(0.5, audioCompanion.speed - 0.25).toFixed(1)}x`);
      return;
    }
    if (/^read this|read (?:this )?(?:page|aloud)/i.test(normalized)) {
      audioCompanion.readCurrentPage();
      return;
    }

    // Level 3: Hands-free mode
    if (/^(?:enter|start|activate) hands[- ]?free/i.test(normalized)) {
      actions.enterHandsFree();
      return;
    }
    if (/^(?:exit|stop|deactivate|leave) hands[- ]?free/i.test(normalized)) {
      actions.exitHandsFree();
      return;
    }

    // Level 4: Learning commands
    if (/^next|next (?:card|flashcard|question)/i.test(normalized)) {
      document.dispatchEvent(new CustomEvent("pil:learning", { detail: { action: "next" } }));
      return;
    }
    if (/^(?:show|flip|reveal)(?: (?:the )?answer)?/i.test(normalized)) {
      document.dispatchEvent(new CustomEvent("pil:learning", { detail: { action: "reveal" } }));
      return;
    }
    if (/^(?:rate |mark )?(?:as )?(easy|good|hard|again)$/i.test(normalized)) {
      const rating = normalized.match(/(easy|good|hard|again)/i)?.[1];
      document.dispatchEvent(new CustomEvent("pil:learning", { detail: { action: "rate", rating } }));
      return;
    }

    // Level 5: If nothing matched and source is voice — dispatch the
    // designed "voice.not_understood" spec (toast + gentle spoken retry).
    if (source === "voice") {
      giveFeedback("voice.not_understood");
    }
  }, [navigate, state.modalityPref, audioCompanion, giveFeedback]);

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
    try {
      recognition.start();
      setState(prev => ({ ...prev, voiceListening: true }));
      // Pass 1: dispatch designed "voice.listening_started" spec so the
      // mic-pulse animation + earcon actually fire for PIL hands-free path.
      giveFeedback("voice.listening_started");
    } catch (startErr) {
      // start() can throw in some Safari versions or when a prior instance
      // hasn't fully released the mic — fail safe instead of crashing.
      console.warn("[PIL] voice start failed:", startErr);
      recognitionRef.current = null;
    }
  }, [processIntent, state.handsFreeActive, giveFeedback]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState(prev => ({ ...prev, voiceListening: false }));
    // Pass 1: dispatch designed "voice.listening_stopped" spec.
    giveFeedback("voice.listening_stopped");
  }, [giveFeedback]);

  /* ── Actions ─────────────────────────────────────────────── */

  const actions: PILActions = {
    processIntent,
    giveFeedback,

    setModalityPref: (pref) => setState(prev => ({ ...prev, modalityPref: pref })),

    enterHandsFree: () => {
      // Pass 1 (multisensory build loop — G54): route through the dispatcher
      // instead of calling SOUNDS/speakShort directly so the designed
      // multimodal feedback spec ("handsfree.activated") is consistent with
      // every other feedback path in the app. Keep the "onboarding" prompt
      // line as a dedicated speak call because the spec is a short earcon
      // only; users need the verbal affordance the first time they activate.
      giveFeedback("handsfree.activated");
      setState(prev => ({ ...prev, handsFreeActive: true, modalityPref: "both" }));
      startListening();
      setTimeout(() => {
        speakShort("Hands-free mode active. What would you like to do?");
      }, 500);
    },

    exitHandsFree: () => {
      giveFeedback("handsfree.deactivated");
      stopListening();
      audioCompanion.pause();
      setState(prev => ({ ...prev, handsFreeActive: false, modalityPref: "both" }));
      speakShort("Hands-free mode off.");
    },

    speak: speakShort,
    playSound: (soundId) => SOUNDS[soundId]?.(),
  };

  return (
    <PILCtx.Provider value={{ ...state, ...actions }}>
      {children}
    </PILCtx.Provider>
  );
}
