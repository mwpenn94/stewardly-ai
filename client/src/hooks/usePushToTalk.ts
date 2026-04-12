/**
 * usePushToTalk.ts — Hold-to-dictate one-shot voice capture
 *
 * Build Loop Pass 10 (G7). The existing `useVoiceRecognition` hook
 * implements the CONTINUOUS hands-free voice loop (capture until silence,
 * then auto-send). That's the wrong UX for:
 *   1. Users on Safari iOS / desktop Safari where `continuous=true` is
 *      silently ignored (Pass 2 capability probe reports `ptt_only`).
 *   2. Users who don't want always-on listening — privacy-conscious
 *      users, users in open offices, users with background noise.
 *   3. Motor-impaired users who prefer an explicit hold-action (easier
 *      to confirm intent than a "is it listening?" affordance).
 *
 * This hook implements the push-to-talk / hold-to-dictate pattern:
 *   - start() begins capture (call on pointer/key down)
 *   - release() ends capture + returns the transcript (call on up/leave)
 *   - cancel() aborts capture without emitting anything (esc, drag-off)
 *
 * Single-shot: the underlying `recognition.continuous` is forced to
 * false so Safari iOS / desktop work. Interim results are surfaced
 * via `interimText` when supported, but the final transcript is only
 * emitted on release().
 *
 * Independent of useVoiceRecognition — the two hooks do not share
 * state so you can PTT from any page even while hands-free is off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectStt, type SttCapabilities } from "@/lib/sttSupport";

export interface PushToTalkOptions {
  lang?: string;
  /** Minimum hold duration before accepting the transcript (ms). Prevents accidental taps. */
  minHoldMs?: number;
  /** Called with the final transcript on release (unless empty / below minHoldMs). */
  onTranscript: (text: string) => void;
  /** Called with interim (in-progress) transcript tokens, if supported. */
  onInterim?: (text: string) => void;
}

export interface PushToTalkReturn {
  isActive: boolean;
  interimText: string;
  start: () => void;
  release: () => void;
  cancel: () => void;
  capabilities: SttCapabilities;
  isAvailable: boolean;
}

/**
 * A strict single-shot STT capture. Designed for button-press UX where
 * the button is held (mousedown/keydown/touchstart) and released
 * (mouseup/keyup/touchend).
 */
export function usePushToTalk({
  lang = "en-US",
  minHoldMs = 150,
  onTranscript,
  onInterim,
}: PushToTalkOptions): PushToTalkReturn {
  const [isActive, setIsActive] = useState(false);
  const [interimText, setInterimText] = useState("");
  const capabilities = useMemo<SttCapabilities>(() => detectStt(), []);

  const recognitionRef = useRef<any>(null);
  const startedAtRef = useRef<number>(0);
  const finalRef = useRef<string>("");
  const interimRef = useRef<string>("");
  // canceled = true → release() will NOT emit even if a transcript arrived
  const canceledRef = useRef<boolean>(false);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const destroyRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // Short-circuit on unsupported.
    if (capabilities.mode === "unsupported") {
      console.warn("[PTT] Speech recognition unsupported:", capabilities.browserFamily);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // Reset capture state.
    destroyRecognition();
    finalRef.current = "";
    interimRef.current = "";
    setInterimText("");
    canceledRef.current = false;
    startedAtRef.current = Date.now();

    const rec = new SR();
    // Force single-shot — the caller controls start/stop via press/release.
    rec.continuous = false;
    rec.interimResults = capabilities.supportsInterim;
    rec.lang = lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) finalRef.current += final;
      interimRef.current = interim;
      const display = (finalRef.current + " " + interim).trim();
      setInterimText(display);
      onInterimRef.current?.(display);
    };

    rec.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        console.warn("[PTT] Microphone permission denied");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[PTT] Error:", event.error);
      }
    };

    rec.onend = () => {
      setIsActive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsActive(true);
    } catch (err) {
      console.warn("[PTT] start failed:", err);
      setIsActive(false);
    }
  }, [capabilities, lang, destroyRecognition]);

  const release = useCallback(() => {
    const heldMs = Date.now() - startedAtRef.current;
    const rec = recognitionRef.current;

    // Stop the browser-side capture — we still want the final result
    // event to fire before onend.
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }

    setIsActive(false);

    // Defer emission so the last `onresult` has a chance to fire.
    // 250ms covers the typical finalization latency without feeling
    // like an interaction hang.
    setTimeout(() => {
      const transcript = finalRef.current.trim();
      destroyRecognition();
      setInterimText("");
      finalRef.current = "";
      interimRef.current = "";

      if (canceledRef.current) return;
      if (heldMs < minHoldMs) return; // accidental tap — ignore
      if (!transcript) return;

      onTranscriptRef.current(transcript);
    }, 250);
  }, [destroyRecognition, minHoldMs]);

  const cancel = useCallback(() => {
    canceledRef.current = true;
    destroyRecognition();
    setIsActive(false);
    setInterimText("");
    finalRef.current = "";
    interimRef.current = "";
  }, [destroyRecognition]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      canceledRef.current = true;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return {
    isActive,
    interimText,
    start,
    release,
    cancel,
    capabilities,
    isAvailable: capabilities.mode !== "unsupported",
  };
}
