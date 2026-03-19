import { useCallback, useEffect, useRef, useState } from "react";

export interface TTSOptions {
  /** Whether TTS is enabled */
  enabled: boolean;
  /** Voice preference (for browser SpeechSynthesis fallback) */
  voice?: string;
  /** Rate (0.5 - 2.0). Default 1.0 */
  rate?: number;
  /** Called when TTS starts playing */
  onStart?: () => void;
  /** Called when TTS finishes playing */
  onEnd?: () => void;
}

export interface TTSReturn {
  isSpeaking: boolean;
  /** Speak text — tries Edge TTS first, falls back to browser */
  speak: (text: string) => void;
  /** Cancel any current speech */
  cancel: () => void;
  /** Guard ref — true while TTS is playing (use to block recognition) */
  guardRef: React.MutableRefObject<boolean>;
}

/**
 * Clean markdown/formatting from text for natural speech.
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block omitted ") // code blocks
    .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ""))     // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")              // markdown links
    .replace(/[#*_~\[\]()>|]/g, "")                       // markdown chars
    .replace(/---[\s\S]*$/m, "")                           // horizontal rules and below
    .replace(/\n{2,}/g, ". ")                              // double newlines → pause
    .replace(/\n/g, " ")                                   // single newlines → space
    .replace(/\s{2,}/g, " ")                               // collapse whitespace
    .trim();
}

/**
 * Split text into sentence-sized chunks for natural speech cadence.
 * Targets ~200 words per chunk max for browser SpeechSynthesis reliability.
 */
function chunkText(text: string, maxWords = 200): string[] {
  // First split on sentence boundaries
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
  voice,
  rate = 1.0,
  onStart,
  onEnd,
}: TTSOptions): TTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const guardRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);

  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const cancel = useCallback(() => {
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
   * Browser SpeechSynthesis fallback — works everywhere, no API key needed.
   */
  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const cleaned = cleanForSpeech(text);
      if (!cleaned) return;

      guardRef.current = true;
      setIsSpeaking(true);
      onStartRef.current?.();

      const chunks = chunkText(cleaned);
      chunks.forEach((chunk, i) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = rate;
        utterance.pitch = 1.0;

        // Try to find a good voice
        if (voice) {
          const voices = window.speechSynthesis.getVoices();
          const match = voices.find(
            (v) =>
              v.name.toLowerCase().includes(voice.toLowerCase()) ||
              v.voiceURI.toLowerCase().includes(voice.toLowerCase())
          );
          if (match) utterance.voice = match;
        }

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
    [rate, voice]
  );

  /**
   * Main speak function — uses browser SpeechSynthesis.
   * Edge TTS integration would go here if EDGE_TTS_PROXY_URL is configured.
   */
  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      cancel();
      speakWithBrowser(text);
    },
    [enabled, cancel, speakWithBrowser]
  );

  // Cancel on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  // Cancel when disabled
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  return { isSpeaking, speak, cancel, guardRef };
}
