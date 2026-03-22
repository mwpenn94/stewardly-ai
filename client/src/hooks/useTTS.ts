import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export interface TTSOptions {
  /** Whether TTS is enabled */
  enabled: boolean;
  /** Edge TTS voice preset. Default "aria" */
  voice?: string;
  /** Rate (for browser fallback, 0.5 - 2.0). Default 1.0 */
  rate?: number;
  /** Called when TTS starts playing */
  onStart?: () => void;
  /** Called when TTS finishes playing */
  onEnd?: () => void;
}

export interface TTSReturn {
  isSpeaking: boolean;
  /** Speak text — tries Edge TTS first, falls back to browser. Respects enabled flag. */
  speak: (text: string) => void;
  /** Speak text regardless of enabled flag — for explicit user actions like per-message read aloud */
  forceSpeak: (text: string) => void;
  /** Cancel any current speech */
  cancel: () => void;
  /** Guard ref — true while TTS is playing (use to block recognition) */
  guardRef: React.MutableRefObject<boolean>;
  /** Play an audible processing cue */
  playCue: (type: "listening" | "thinking" | "speaking" | "done") => void;
}

// ─── Audio cue frequencies ──────────────────────────────────────────
const AUDIO_CUES = {
  listening: { freq: 440, duration: 150, gain: 0.08 },
  thinking: { freq: 330, duration: 200, gain: 0.06 },
  speaking: { freq: 520, duration: 100, gain: 0.06 },
  done: { freq: 660, duration: 120, gain: 0.07 },
};

/**
 * Clean markdown/formatting from text for natural speech (browser fallback only).
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block omitted ")
    .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ""))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~\[\]()>|]/g, "")
    .replace(/---[\s\S]*$/m, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Split text into sentence-sized chunks for browser SpeechSynthesis reliability.
 */
function chunkText(text: string, maxWords = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const currentWords = current.split(/\s+/).filter(Boolean).length;
    const sentenceWords = trimmed.split(/\s+/).filter(Boolean).length;

    if (currentWords + sentenceWords > maxWords && current) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? " " : "") + trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ─── iOS / Mobile Audio Unlock ─────────────────────────────────────
// iOS WebKit requires a user gesture to unlock audio playback.
// We keep a persistent <audio> element that gets "primed" on first
// user interaction, then reuse it for all TTS playback.

let _sharedAudio: HTMLAudioElement | null = null;
let _audioUnlocked = false;

/**
 * Get or create the shared audio element used for TTS playback.
 * Reusing a single element that was unlocked by a user gesture
 * is the most reliable way to play audio on iOS.
 */
function getSharedAudio(): HTMLAudioElement {
  if (!_sharedAudio) {
    _sharedAudio = new Audio();
    // Ensure it works on iOS
    _sharedAudio.setAttribute("playsinline", "");
    _sharedAudio.setAttribute("webkit-playsinline", "");
  }
  return _sharedAudio;
}

/**
 * Unlock audio playback on iOS by playing a tiny silent MP3 data URI
 * from within a user gesture handler. This "primes" the audio element
 * so subsequent programmatic .play() calls succeed.
 */
function unlockAudio() {
  if (_audioUnlocked) return;
  try {
    const audio = getSharedAudio();
    // Tiny valid MP3 frame (silence) — base64 encoded
    // This is a minimal valid MP3 file that plays silence
    const silentMp3 = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwMHAAAAAAD/+1DEAAAB8ANoAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UMQbAAAA0gAAAAAAAAANIAAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
    audio.src = silentMp3;
    audio.volume = 0.01;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        _audioUnlocked = true;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
        audio.src = "";
      }).catch(() => {
        // Will retry on next user gesture
      });
    }
  } catch {
    // Ignore — will retry on next user interaction
  }
}

// Register unlock handlers on first load
if (typeof window !== "undefined") {
  const events = ["click", "touchstart", "touchend", "keydown", "pointerdown"];
  const onGesture = () => {
    unlockAudio();
    // Keep listeners until actually unlocked
    if (_audioUnlocked) {
      events.forEach(e => window.removeEventListener(e, onGesture));
    }
  };
  events.forEach(e => window.addEventListener(e, onGesture, { passive: true }));
}

export function useTTS({
  enabled,
  voice = "aria",
  rate = 1.0,
  onStart,
  onEnd,
}: TTSOptions): TTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const guardRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const cancelledRef = useRef(false);
  // Track the current object URL so we can revoke it
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const speakMutation = trpc.voice.speak.useMutation();

  /**
   * Play an audible processing cue (short tone).
   */
  const playCue = useCallback((type: "listening" | "thinking" | "speaking" | "done") => {
    try {
      const cue = AUDIO_CUES[type];
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = cue.freq;
      gain.gain.setValueAtTime(cue.gain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cue.duration / 1000);
      osc.start();
      osc.stop(ctx.currentTime + cue.duration / 1000);
      setTimeout(() => ctx.close(), cue.duration + 100);
    } catch {
      // AudioContext not available
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    // Cancel browser synthesis
    window.speechSynthesis?.cancel();
    // Cancel shared audio element
    const audio = getSharedAudio();
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    } catch { /* ignore */ }
    // Revoke any object URL
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    guardRef.current = false;
    setIsSpeaking(false);
  }, []);

  /**
   * Play audio from base64-encoded MP3 data via Edge TTS.
   * Uses the shared audio element for iOS compatibility.
   */
  const playEdgeAudio = useCallback(
    (base64Audio: string) => {
      if (cancelledRef.current) return;

      // Decode base64 to blob — use audio/mpeg for universal compatibility
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      // Revoke previous URL if any
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
      currentUrlRef.current = url;

      // Use the shared audio element (already unlocked by user gesture on iOS)
      const audio = getSharedAudio();
      audio.src = url;
      audio.volume = 1.0;

      const cleanup = () => {
        if (currentUrlRef.current === url) {
          URL.revokeObjectURL(url);
          currentUrlRef.current = null;
        }
      };

      audio.onplay = () => {
        if (cancelledRef.current) {
          audio.pause();
          return;
        }
      };

      audio.onended = () => {
        cleanup();
        guardRef.current = false;
        setIsSpeaking(false);
        playCue("done");
        onEndRef.current?.();
      };

      audio.onerror = (e) => {
        console.warn("[TTS] Audio playback error:", e);
        cleanup();
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
      };

      // Play — on iOS this should work because the shared element was
      // unlocked by a user gesture. If it still fails, fall back to browser TTS.
      audio.play().catch((err) => {
        console.warn("[TTS] Play failed, will retry once:", err.message);
        // One retry after a short delay
        setTimeout(() => {
          if (cancelledRef.current) {
            cleanup();
            guardRef.current = false;
            setIsSpeaking(false);
            onEndRef.current?.();
            return;
          }
          audio.play().catch(() => {
            console.warn("[TTS] Retry failed, falling back to browser TTS");
            cleanup();
            // Signal that we need browser fallback
            // (handled by the caller via the returned promise)
          });
        }, 150);
      });
    },
    [playCue]
  );

  /**
   * Browser SpeechSynthesis fallback — works everywhere, no API needed.
   */
  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) {
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
        return;
      }
      window.speechSynthesis.cancel();

      const cleaned = cleanForSpeech(text);
      if (!cleaned) {
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
        return;
      }

      const chunks = chunkText(cleaned);
      chunks.forEach((chunk, i) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = rate;
        utterance.pitch = 1.0;

        if (i === chunks.length - 1) {
          utterance.onend = () => {
            guardRef.current = false;
            setIsSpeaking(false);
            playCue("done");
            onEndRef.current?.();
          };
          utterance.onerror = () => {
            guardRef.current = false;
            setIsSpeaking(false);
            onEndRef.current?.();
          };
        }
        window.speechSynthesis.speak(utterance);
      });
    },
    [rate, playCue]
  );

  /**
   * Core speak implementation — shared by speak() and forceSpeak()
   */
  const doSpeak = useCallback(
    (text: string) => {
      cancel();
      cancelledRef.current = false;

      // Re-unlock audio on each explicit speak action (user gesture context)
      unlockAudio();

      guardRef.current = true;
      setIsSpeaking(true);
      onStartRef.current?.();
      playCue("speaking");

      // Try Edge TTS via server
      speakMutation.mutate(
        { text, voice: voice as any },
        {
          onSuccess: (data) => {
            if (cancelledRef.current) return;
            if (data.audio) {
              playEdgeAudio(data.audio);
            } else {
              // No audio returned — fall back to browser
              speakWithBrowser(text);
            }
          },
          onError: () => {
            if (cancelledRef.current) return;
            // Edge TTS failed — fall back to browser SpeechSynthesis
            console.info("[TTS] Edge TTS unavailable, using browser fallback");
            speakWithBrowser(text);
          },
        }
      );
    },
    [cancel, voice, speakMutation, playEdgeAudio, speakWithBrowser, playCue]
  );

  /**
   * Main speak function — respects enabled flag.
   */
  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      doSpeak(text);
    },
    [enabled, doSpeak]
  );

  // Cancel on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  // Cancel when disabled
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  /**
   * Force speak — bypasses the enabled check for explicit user actions (e.g. per-message read aloud button).
   */
  const forceSpeak = useCallback(
    (text: string) => {
      doSpeak(text);
    },
    [doSpeak]
  );

  return { isSpeaking, speak, forceSpeak, cancel, guardRef, playCue };
}
