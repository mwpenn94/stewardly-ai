import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectStt, type SttCapabilities } from "@/lib/sttSupport";

/**
 * Financial term dictionary for post-processing corrections.
 */
const FINANCIAL_TERMS: Record<string, string> = {
  "i u l": "IUL", "i you l": "IUL", "eye you el": "IUL",
  "four oh one k": "401(k)", "four oh one kay": "401(k)", "401 k": "401(k)",
  "four oh three b": "403(b)", "four oh three bee": "403(b)",
  "roth": "Roth", "roth ira": "Roth IRA", "i r a": "IRA",
  "e b i t d a": "EBITDA", "ebitda": "EBITDA",
  "s and p": "S&P", "s and p 500": "S&P 500",
  "e t f": "ETF", "etf": "ETF", "r o i": "ROI", "roi": "ROI",
  "a u m": "AUM", "aum": "AUM", "k y c": "KYC", "kyc": "KYC",
  "r i a": "RIA", "ria": "RIA", "finra": "FINRA", "fin ra": "FINRA",
  "s e c": "SEC", "sec": "SEC", "c f p": "CFP", "cfp": "CFP",
  "c l u": "CLU", "clu": "CLU", "ch f c": "ChFC",
  "c p a": "CPA", "cpa": "CPA", "r m d": "RMD", "rmd": "RMD",
  "i r m a a": "IRMAA", "irmaa": "IRMAA",
  "w e p": "WEP", "wep": "WEP", "g p o": "GPO", "gpo": "GPO",
  "basis points": "basis points", "bips": "bps", "b p s": "bps",
  "whole life": "whole life", "term life": "term life",
  "universal life": "universal life", "indexed universal life": "indexed universal life",
  "variable universal life": "variable universal life",
  "annuity": "annuity", "annuities": "annuities",
  "monte carlo": "Monte Carlo", "fiduciary": "fiduciary",
  "beneficiary": "beneficiary", "beneficiaries": "beneficiaries",
};

function correctFinancialTerms(text: string): string {
  let corrected = text;
  const entries = Object.entries(FINANCIAL_TERMS).sort((a, b) => b[0].length - a[0].length);
  for (const [pattern, replacement] of entries) {
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    corrected = corrected.replace(regex, replacement);
  }
  return corrected;
}

/**
 * State machine for hands-free voice recognition.
 *
 * States:
 *   IDLE       → not listening, waiting for explicit start()
 *   LISTENING  → actively capturing speech
 *   SENT       → transcript was sent, recognition stopped, waiting for parent to call start() again
 *   STOPPED    → intentionally stopped (hands-free deactivated)
 *
 * The key insight: once we send a transcript, we move to SENT state and NEVER
 * auto-restart. The parent (Chat.tsx) is the ONLY thing that can move us back
 * to LISTENING by calling start(). This eliminates all race conditions.
 */
type VoiceState = "IDLE" | "LISTENING" | "SENT" | "STOPPED";

export interface VoiceRecognitionOptions {
  enabled: boolean;
  silenceTimeout?: number;
  lang?: string;
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  guardRef?: React.MutableRefObject<boolean>;
}

export interface VoiceRecognitionReturn {
  isListening: boolean;
  interimText: string;
  start: () => void;
  stop: () => void;
  /** Pass 2 (G59) — capability probe result so callers can fall back to PTT / keyboard. */
  capabilities: SttCapabilities;
  /** Convenience: true only when start() will actually do anything. */
  isAvailable: boolean;
}

export function useVoiceRecognition({
  enabled,
  silenceTimeout = 1800,
  lang = "en-US",
  onTranscript,
  onInterim,
  guardRef,
}: VoiceRecognitionOptions): VoiceRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  // Pass 2 (G59): probe once on mount. We use useMemo (not useRef) so
  // SSR-safe: detectStt() returns an "unsupported" shape when window is
  // undefined and the memo recomputes on the client.
  const capabilities = useMemo<SttCapabilities>(() => detectStt(), []);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const stateRef = useRef<VoiceState>("IDLE");

  // Keep callback refs in sync (avoids stale closures)
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  const enabledRef = useRef(enabled);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  /**
   * Destroy the current recognition instance. Does NOT change state.
   */
  const destroyRecognition = useCallback(() => {
    clearSilenceTimer();
    const rec = recognitionRef.current;
    if (rec) {
      // Remove handlers to prevent onend from firing after we destroy
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch {}
      recognitionRef.current = null;
    }
  }, [clearSilenceTimer]);

  /**
   * Stop listening. Moves to STOPPED state. Will NOT auto-restart.
   */
  const stop = useCallback(() => {
    stateRef.current = "STOPPED";
    destroyRecognition();
    setIsListening(false);
    setInterimText("");
    finalTranscriptRef.current = "";
  }, [destroyRecognition]);

  /**
   * Start listening. Only works if not guarded and enabled.
   * Moves to LISTENING state.
   */
  const start = useCallback(() => {
    // Guard checks
    if (guardRef?.current) {
      console.debug("[Voice] start() blocked by guard");
      return;
    }
    if (!enabledRef.current) {
      console.debug("[Voice] start() blocked — not enabled");
      return;
    }

    // Clean up any existing instance first
    destroyRecognition();

    // Pass 2 (G59): every caller gets the capability hint via the return
    // value now, but we still guard here as a defence in depth. If the
    // probe says "unsupported", log a structured warning instead of a
    // blank silent return so devs can actually see the failure in prod.
    if (capabilities.mode === "unsupported") {
      console.warn("[Voice] Speech recognition unsupported:", capabilities.browserFamily, capabilities.userMessage);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn("[Voice] SpeechRecognition constructor missing despite capability probe — ", capabilities);
      return;
    }

    const recognition = new SR();
    // Pass 2 (G59): Safari desktop + iOS silently ignore `continuous=true`,
    // so we set it only when the capability probe reports full support.
    // On PTT-only browsers we get a single final-result burst per start(),
    // which is the correct push-to-talk semantic anyway.
    recognition.continuous = capabilities.supportsContinuous;
    recognition.interimResults = capabilities.supportsInterim;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";
    stateRef.current = "LISTENING";

    recognition.onresult = (event: any) => {
      // If we're not in LISTENING state, ignore results
      if (stateRef.current !== "LISTENING") return;

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
      }

      const display = finalTranscriptRef.current + interim;
      setInterimText(display);
      onInterimRef.current?.(display);

      // Reset silence timer on any speech activity
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        // Double-check we're still in LISTENING state
        if (stateRef.current !== "LISTENING") return;

        const transcript = finalTranscriptRef.current.trim();
        if (transcript) {
          // ── TRANSITION TO SENT STATE ──
          // This is the critical transition. We:
          // 1. Move to SENT state FIRST (prevents any auto-restart)
          // 2. Clear UI state
          // 3. Destroy recognition
          // 4. Call onTranscript
          // After this, ONLY an explicit start() call can restart listening.
          stateRef.current = "SENT";
          const corrected = correctFinancialTerms(transcript);

          setInterimText("");
          setIsListening(false);
          finalTranscriptRef.current = "";

          // Destroy recognition BEFORE calling onTranscript to prevent
          // any onend handler from firing and trying to restart
          destroyRecognition();

          // Now call the transcript handler — this triggers the AI send
          onTranscriptRef.current(corrected);
        }
      }, silenceTimeout);
    };

    recognition.onerror = (event: any) => {
      // Only handle errors if we're in LISTENING state
      if (stateRef.current !== "LISTENING") return;

      if (event.error === "no-speech" || event.error === "aborted") {
        // Benign — browser ended recognition due to no speech detected.
        // We'll handle restart in onend.
      } else if (event.error === "network") {
        // Network error — don't spam restart
        console.warn("[Voice] Network error — will retry in 2s");
      } else {
        console.warn("[Voice] Error:", event.error);
      }
    };

    recognition.onend = () => {
      // Only auto-restart if we're still in LISTENING state.
      // If state is SENT or STOPPED, do nothing.
      if (stateRef.current === "LISTENING") {
        // Recognition ended unexpectedly (browser timeout, no-speech, etc.)
        // Auto-restart after a brief delay
        recognitionRef.current = null;
        if (enabledRef.current && !guardRef?.current) {
          setTimeout(() => {
            // Re-check everything before restarting
            if (stateRef.current === "LISTENING" && enabledRef.current && !guardRef?.current) {
              start();
            }
          }, 500);
        } else {
          setIsListening(false);
        }
      } else {
        // SENT or STOPPED — just clean up
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn("[Voice] Start failed:", err);
      stateRef.current = "IDLE";
      setIsListening(false);
    }
  }, [lang, guardRef, clearSilenceTimer, destroyRecognition, silenceTimeout, capabilities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateRef.current = "STOPPED";
      destroyRecognition();
    };
  }, [destroyRecognition]);

  // Auto-stop when disabled
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return {
    isListening,
    interimText,
    start,
    stop,
    capabilities,
    isAvailable: capabilities.mode !== "unsupported",
  };
}
