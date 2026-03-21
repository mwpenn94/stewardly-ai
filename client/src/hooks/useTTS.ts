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
}

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

export function useTTS({
  enabled,
  voice = "aria",
  rate = 1.0,
  onStart,
  onEnd,
}: TTSOptions): TTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const guardRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const cancelledRef = useRef(false);

  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const speakMutation = trpc.voice.speak.useMutation();

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    // Cancel browser synthesis
    window.speechSynthesis?.cancel();
    // Cancel audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    guardRef.current = false;
    setIsSpeaking(false);
  }, []);

  /**
   * Play audio from base64-encoded webm data via Edge TTS.
   */
  const playEdgeAudio = useCallback(
    (base64Audio: string) => {
      if (cancelledRef.current) return;

      // Decode base64 to blob
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        if (cancelledRef.current) {
          audio.pause();
          return;
        }
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
      };

      audio.play().catch(() => {
        // Autoplay blocked — clean up
        URL.revokeObjectURL(url);
        audioRef.current = null;
        guardRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
      });
    },
    []
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
            onEndRef.current?.();
          };
        }
        window.speechSynthesis.speak(utterance);
      });
    },
    [rate]
  );

  /**
   * Main speak function — tries Edge TTS server first, falls back to browser.
   */
  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      cancel();
      cancelledRef.current = false;

      guardRef.current = true;
      setIsSpeaking(true);
      onStartRef.current?.();

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
    [enabled, cancel, voice, speakMutation, playEdgeAudio, speakWithBrowser]
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
      cancel();
      cancelledRef.current = false;

      guardRef.current = true;
      setIsSpeaking(true);
      onStartRef.current?.();

      speakMutation.mutate(
        { text, voice: voice as any },
        {
          onSuccess: (data) => {
            if (cancelledRef.current) return;
            if (data.audio) {
              playEdgeAudio(data.audio);
            } else {
              speakWithBrowser(text);
            }
          },
          onError: () => {
            if (cancelledRef.current) return;
            console.info("[TTS] Edge TTS unavailable, using browser fallback");
            speakWithBrowser(text);
          },
        }
      );
    },
    [cancel, voice, speakMutation, playEdgeAudio, speakWithBrowser]
  );

  return { isSpeaking, speak, forceSpeak, cancel, guardRef };
}
