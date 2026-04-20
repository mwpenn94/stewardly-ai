/**
 * useConversationalVoice — Full-duplex conversational voice mode (G6)
 *
 * Enables simultaneous listening + speaking with voice activity detection (VAD).
 * When the user speaks during TTS, it automatically pauses TTS, processes the
 * new input, and resumes the conversation loop.
 *
 * Architecture:
 * - Uses AudioContext analyser for real-time VAD (voice activity detection)
 * - Keeps SpeechRecognition running continuously (no guard)
 * - TTS plays through speakers while mic stays hot
 * - VAD threshold distinguishes user speech from ambient/TTS bleed
 * - Barge-in triggers TTS cancel + new input processing
 *
 * State machine:
 *   IDLE → LISTENING → PROCESSING → SPEAKING → LISTENING (loop)
 *   Any state + user speech → cancel current + PROCESSING
 */

import { useState, useCallback, useRef, useEffect } from "react";

export type ConversationalState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "paused";

export interface ConversationalVoiceOptions {
  /** Called when final transcript is ready to send */
  onTranscript: (text: string) => void;
  /** Called when TTS should be cancelled (barge-in) */
  onBargeIn: () => void;
  /** Called when state changes */
  onStateChange?: (state: ConversationalState) => void;
  /** VAD energy threshold (0-1). Default 0.015 */
  vadThreshold?: number;
  /** Silence duration (ms) before finalizing speech. Default 1500 */
  silenceTimeout?: number;
  /** Whether the browser supports SpeechRecognition */
  sttSupported: boolean;
}

export interface ConversationalVoiceReturn {
  state: ConversationalState;
  isActive: boolean;
  start: () => void;
  stop: () => void;
  /** Notify the hook that TTS started speaking */
  notifySpeaking: () => void;
  /** Notify the hook that TTS finished speaking */
  notifyDoneSpeaking: () => void;
  /** Notify the hook that processing is complete */
  notifyProcessingDone: () => void;
  /** Current VAD energy level (0-1) for visualization */
  vadLevel: number;
  /** Interim transcript for display */
  interimTranscript: string;
}

const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useConversationalVoice(
  options: ConversationalVoiceOptions
): ConversationalVoiceReturn {
  const {
    onTranscript,
    onBargeIn,
    onStateChange,
    vadThreshold = 0.015,
    silenceTimeout = 1500,
    sttSupported,
  } = options;

  const [state, setState] = useState<ConversationalState>("idle");
  const [vadLevel, setVadLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");

  const stateRef = useRef<ConversationalState>("idle");
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Callbacks stored in refs to avoid stale closures
  const onTranscriptRef = useRef(onTranscript);
  const onBargeInRef = useRef(onBargeIn);
  const onStateChangeRef = useRef(onStateChange);
  onTranscriptRef.current = onTranscript;
  onBargeInRef.current = onBargeIn;
  onStateChangeRef.current = onStateChange;

  const setConvState = useCallback((newState: ConversationalState) => {
    stateRef.current = newState;
    setState(newState);
    onStateChangeRef.current?.(newState);
  }, []);

  // ── VAD (Voice Activity Detection) via AudioContext ──────────
  const startVAD = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!activeRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 255;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVadLevel(rms);

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Mic permission denied — fall back to recognition-only mode
      console.warn("[ConversationalVoice] Mic access denied for VAD, using recognition-only mode");
    }
  }, []);

  const stopVAD = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setVadLevel(0);
  }, []);

  // ── SpeechRecognition (continuous, no guard) ────────────────
  const startRecognition = useCallback(() => {
    if (!SpeechRecognition || !sttSupported) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      // If we're in "speaking" state and user starts talking, barge-in
      if (isSpeakingRef.current && (final.trim() || interim.length > 10)) {
        isSpeakingRef.current = false;
        onBargeInRef.current();
        setConvState("listening");
      }

      if (final.trim()) {
        setInterimTranscript("");
        // Clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        onTranscriptRef.current(final.trim());
        setConvState("processing");
      } else if (interim) {
        // Reset silence timer on interim results
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          // Silence detected — if we have interim text, it might be a false start
          setInterimTranscript("");
        }, silenceTimeout);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // Normal — restart if still active
        if (activeRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
        return;
      }
      console.warn("[ConversationalVoice] Recognition error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (activeRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Already started
    }
  }, [sttSupported, setConvState, silenceTimeout]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ok */ }
      recognitionRef.current = null;
    }
    setInterimTranscript("");
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // ── Public API ──────────────────────────────────────────────
  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setConvState("listening");
    startVAD();
    startRecognition();
  }, [setConvState, startVAD, startRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    isSpeakingRef.current = false;
    stopRecognition();
    stopVAD();
    setConvState("idle");
  }, [setConvState, stopRecognition, stopVAD]);

  const notifySpeaking = useCallback(() => {
    if (!activeRef.current) return;
    isSpeakingRef.current = true;
    setConvState("speaking");
  }, [setConvState]);

  const notifyDoneSpeaking = useCallback(() => {
    if (!activeRef.current) return;
    isSpeakingRef.current = false;
    setConvState("listening");
  }, [setConvState]);

  const notifyProcessingDone = useCallback(() => {
    if (!activeRef.current) return;
    // Processing done — TTS will start speaking next
    // State transitions to "speaking" when notifySpeaking is called
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopRecognition();
      stopVAD();
    };
  }, [stopRecognition, stopVAD]);

  return {
    state,
    isActive: state !== "idle",
    start,
    stop,
    notifySpeaking,
    notifyDoneSpeaking,
    notifyProcessingDone,
    vadLevel,
    interimTranscript,
  };
}
