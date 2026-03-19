import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Financial term dictionary — hints for the speech recognition engine.
 * Web Speech API supports `grammars` on some browsers; we also use these
 * for post-processing corrections.
 */
const FINANCIAL_TERMS: Record<string, string> = {
  // Acronyms & initialisms
  "i u l": "IUL",
  "i you l": "IUL",
  "eye you el": "IUL",
  "four oh one k": "401(k)",
  "four oh one kay": "401(k)",
  "401 k": "401(k)",
  "four oh three b": "403(b)",
  "four oh three bee": "403(b)",
  "roth": "Roth",
  "roth ira": "Roth IRA",
  "i r a": "IRA",
  "e b i t d a": "EBITDA",
  "ebitda": "EBITDA",
  "s and p": "S&P",
  "s and p 500": "S&P 500",
  "e t f": "ETF",
  "etf": "ETF",
  "r o i": "ROI",
  "roi": "ROI",
  "a u m": "AUM",
  "aum": "AUM",
  "k y c": "KYC",
  "kyc": "KYC",
  "r i a": "RIA",
  "ria": "RIA",
  "finra": "FINRA",
  "fin ra": "FINRA",
  "s e c": "SEC",
  "sec": "SEC",
  "c f p": "CFP",
  "cfp": "CFP",
  "c l u": "CLU",
  "clu": "CLU",
  "ch f c": "ChFC",
  "c p a": "CPA",
  "cpa": "CPA",
  "r m d": "RMD",
  "rmd": "RMD",
  "i r m a a": "IRMAA",
  "irmaa": "IRMAA",
  "w e p": "WEP",
  "wep": "WEP",
  "g p o": "GPO",
  "gpo": "GPO",
  // Basis points
  "basis points": "basis points",
  "bips": "bps",
  "b p s": "bps",
  // Common misheard financial terms
  "whole life": "whole life",
  "term life": "term life",
  "universal life": "universal life",
  "indexed universal life": "indexed universal life",
  "variable universal life": "variable universal life",
  "annuity": "annuity",
  "annuities": "annuities",
  "monte carlo": "Monte Carlo",
  "fiduciary": "fiduciary",
  "beneficiary": "beneficiary",
  "beneficiaries": "beneficiaries",
};

/**
 * Apply financial term corrections to a transcript.
 */
function correctFinancialTerms(text: string): string {
  let corrected = text;
  // Sort by length descending so longer phrases match first
  const entries = Object.entries(FINANCIAL_TERMS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [pattern, replacement] of entries) {
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    corrected = corrected.replace(regex, replacement);
  }
  return corrected;
}

export interface VoiceRecognitionOptions {
  /** Whether the hook is enabled (e.g., hands-free mode active) */
  enabled: boolean;
  /** Silence duration (ms) before auto-sending. Default 1500 */
  silenceTimeout?: number;
  /** Language code. Default "en-US" */
  lang?: string;
  /** Called when final transcript is ready to send */
  onTranscript: (text: string) => void;
  /** Called when interim (partial) transcript updates */
  onInterim?: (text: string) => void;
  /** Guard ref — if true, recognition should not start (e.g., TTS playing) */
  guardRef?: React.MutableRefObject<boolean>;
}

export interface VoiceRecognitionReturn {
  isListening: boolean;
  interimText: string;
  start: () => void;
  stop: () => void;
}

export function useVoiceRecognition({
  enabled,
  silenceTimeout = 1500,
  lang = "en-US",
  onTranscript,
  onInterim,
  guardRef,
}: VoiceRecognitionOptions): VoiceRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);

  // Keep refs in sync
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Silence detected — finalize and send
      const transcript = finalTranscriptRef.current.trim();
      if (transcript) {
        const corrected = correctFinancialTerms(transcript);
        onTranscriptRef.current(corrected);
        finalTranscriptRef.current = "";
        setInterimText("");
      }
      // Stop and restart recognition for next utterance
      recognitionRef.current?.stop();
    }, silenceTimeout);
  }, [silenceTimeout, clearSilenceTimer]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    finalTranscriptRef.current = "";
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    // Don't start if guarded (TTS playing) or already listening
    if (guardRef?.current) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
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
      startSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // Benign — restart if still enabled
      } else {
        console.warn("[VoiceRecognition] Error:", event.error);
      }
      setIsListening(false);
      // Auto-restart if enabled and not guarded
      if (enabledRef.current && !guardRef?.current) {
        setTimeout(() => {
          if (enabledRef.current && !guardRef?.current) start();
        }, 800);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart for continuous listening if enabled
      if (enabledRef.current && !guardRef?.current) {
        setTimeout(() => {
          if (enabledRef.current && !guardRef?.current) start();
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn("[VoiceRecognition] Start failed:", err);
    }
  }, [lang, guardRef, startSilenceTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [clearSilenceTimer]);

  // Auto-stop when disabled
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return { isListening, interimText, start, stop };
}
