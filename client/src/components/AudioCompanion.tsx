/**
 * AudioCompanion.tsx — Universal persistent audio player
 *
 * Pass 102. Platform-wide audio companion that:
 * - Plays TTS-optimized scripts for any content
 * - Persists across page navigation (minimized pill mode)
 * - Supports speed control, queue, auto-advance
 * - Integrates with hands-free voice navigation
 *
 * Mount ONCE in App.tsx, outside the route content area.
 * Controlled via the useAudioCompanion hook.
 */

import { useState, useRef, useCallback, createContext, useContext } from "react";
import { motion } from "framer-motion";
import {
  Volume2, Pause, Play, SkipForward, SkipBack,
  ChevronDown, ChevronUp, Mic, MicOff, X,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────────────── */

export interface AudioItem {
  id: string;
  type: "definition" | "chapter" | "case_study" | "chat_response" |
        "market_brief" | "recommendation" | "page_narration" | "quiz_question";
  title: string;
  script: string;
  contentId?: string;
}

interface AudioState {
  currentItem: AudioItem | null;
  queue: AudioItem[];
  playing: boolean;
  speed: number;
  position: number;
  duration: number;
  mode: "expanded" | "minimized" | "hidden";
  voiceListening: boolean;
}

interface AudioActions {
  play: (item: AudioItem) => void;
  enqueue: (items: AudioItem[]) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  previous: () => void;
  setSpeed: (speed: number) => void;
  adjustSpeed: (delta: number) => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
  readCurrentPage: () => void;
  toggleVoiceListening: () => void;
  speak: (text: string) => void;
}

type AudioContextType = AudioState & AudioActions;

/* ── context ───────────────────────────────────────────────────── */

const AudioCtx = createContext<AudioContextType | null>(null);

export function useAudioCompanion() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudioCompanion must be used within AudioCompanionProvider");
  return ctx;
}

/* ── provider ──────────────────────────────────────────────────── */

export function AudioCompanionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentItem: null,
    queue: [],
    playing: false,
    speed: 1.0,
    position: 0,
    duration: 0,
    mode: "hidden",
    voiceListening: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generationRef = useRef(0);

  const speakItem = useCallback(async (item: AudioItem, speed: number) => {
    const thisGen = ++generationRef.current;
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.script, speed }),
      });

      if (res.ok) {
        if (generationRef.current !== thisGen) return; // stale, discard
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = speed;
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setState(prev => {
            if (prev.queue.length > 0) {
              const [next, ...rest] = prev.queue;
              return { ...prev, currentItem: next, queue: rest, position: 0 };
            }
            return { ...prev, playing: false, currentItem: null, mode: "hidden" };
          });
        };

        audio.ontimeupdate = () => {
          setState(prev => ({
            ...prev,
            position: audio.currentTime,
            duration: audio.duration || 0,
          }));
        };

        await audio.play();
        setState(prev => ({ ...prev, playing: true, duration: audio.duration || 0 }));
        return;
      }
    } catch {
      // Server TTS unavailable, fall through to Web Speech API
    }

    // Fallback: Web Speech API
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(item.script);
      utterance.rate = speed;
      utterance.onend = () => {
        setState(prev => {
          if (prev.queue.length > 0) {
            const [next, ...rest] = prev.queue;
            return { ...prev, currentItem: next, queue: rest };
          }
          return { ...prev, playing: false, currentItem: null, mode: "hidden" };
        });
      };
      window.speechSynthesis.speak(utterance);
      setState(prev => ({ ...prev, playing: true }));
    }
  }, []);

  const speakShort = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.volume = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const actions: AudioActions = {
    play: (item) => {
      setState(prev => ({
        ...prev, currentItem: item, playing: true, position: 0, mode: "expanded",
      }));
      speakItem(item, state.speed);
    },

    enqueue: (items) => setState(prev => {
      if (!prev.currentItem && items.length > 0) {
        const [first, ...rest] = items;
        speakItem(first, prev.speed);
        return { ...prev, currentItem: first, queue: rest, playing: true, mode: "expanded" };
      }
      return { ...prev, queue: [...prev.queue, ...items] };
    }),

    pause: () => {
      window.speechSynthesis?.pause();
      audioRef.current?.pause();
      setState(prev => ({ ...prev, playing: false }));
    },

    resume: () => {
      window.speechSynthesis?.resume();
      audioRef.current?.play();
      setState(prev => ({ ...prev, playing: true }));
    },

    skip: () => {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      setState(prev => {
        if (prev.queue.length > 0) {
          const [next, ...rest] = prev.queue;
          speakItem(next, prev.speed);
          return { ...prev, currentItem: next, queue: rest, position: 0 };
        }
        return { ...prev, currentItem: null, playing: false, mode: "hidden" };
      });
    },

    previous: () => {
      if (audioRef.current) audioRef.current.currentTime = 0;
      window.speechSynthesis?.cancel();
      if (state.currentItem) speakItem(state.currentItem, state.speed);
    },

    setSpeed: (speed) => {
      if (audioRef.current) audioRef.current.playbackRate = speed;
      setState(prev => ({ ...prev, speed }));
    },

    adjustSpeed: (delta) => {
      const newSpeed = Math.max(0.5, Math.min(3.0, state.speed + delta));
      if (audioRef.current) audioRef.current.playbackRate = newSpeed;
      setState(prev => ({ ...prev, speed: newSpeed }));
    },

    minimize: () => setState(prev => ({ ...prev, mode: "minimized" })),
    expand: () => setState(prev => ({ ...prev, mode: "expanded" })),
    dismiss: () => {
      window.speechSynthesis?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
      setState(prev => ({ ...prev, currentItem: null, playing: false, queue: [], mode: "hidden" }));
    },

    readCurrentPage: () => {
      const content =
        document.querySelector("[data-page-content]") ||
        document.querySelector("main") ||
        document.querySelector("[role='main']") ||
        document.querySelector(".page-content");

      if (content) {
        const clone = content.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("nav, aside, footer, [aria-hidden='true']").forEach(el => el.remove());
        const text = clone.textContent?.trim() || "";
        if (text) {
          actions.play({
            id: `page-${Date.now()}`,
            type: "page_narration",
            title: document.title || "Current page",
            script: text.slice(0, 5000),
          });
        }
      }
    },

    toggleVoiceListening: () => {
      setState(prev => ({ ...prev, voiceListening: !prev.voiceListening }));
    },

    speak: speakShort,
  };

  return (
    <AudioCtx.Provider value={{ ...state, ...actions }}>
      {children}
      <AudioCompanionUI />
    </AudioCtx.Provider>
  );
}

/* ── UI component ──────────────────────────────────────────────── */

function AudioCompanionUI() {
  const audio = useAudioCompanion();

  if (audio.mode === "hidden" || !audio.currentItem) return null;

  const progress = audio.duration > 0 ? (audio.position / audio.duration) * 100 : 0;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (audio.mode === "minimized") {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-lg max-w-[90vw] md:bottom-4"
      >
        <Volume2 className="w-3.5 h-3.5 text-primary flex-none" />
        <span className="text-xs text-foreground truncate max-w-[150px]">
          {audio.currentItem.title}
        </span>
        <button onClick={audio.playing ? audio.pause : audio.resume}
          aria-label={audio.playing ? "Pause" : "Play"}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer">
          {audio.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={audio.skip}
          aria-label="Skip forward"
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <div className="w-16 h-1 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${Math.round(progress)}% complete`}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={audio.expand}
          aria-label="Expand player"
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/98 backdrop-blur-md shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-[400px] md:rounded-xl md:border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 text-primary flex-none" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {audio.currentItem.title}
              </div>
              <div className="text-[10px] text-muted-foreground capitalize">
                {audio.currentItem.type.replace(/_/g, " ")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={audio.minimize}
              aria-label="Minimize player"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={audio.dismiss}
              aria-label="Close player"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
            {formatTime(audio.position)}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8">
            {formatTime(audio.duration)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => audio.adjustSpeed(0.25)}
              aria-label={`Playback speed ${audio.speed.toFixed(2)}x, click to increase`}
              className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border cursor-pointer tabular-nums">
              {audio.speed.toFixed(2)}x
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={audio.previous}
              aria-label="Previous track"
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={audio.playing ? audio.pause : audio.resume}
              aria-label={audio.playing ? "Pause" : "Play"}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground cursor-pointer">
              {audio.playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={audio.skip}
              aria-label="Next track"
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={audio.toggleVoiceListening}
              className={`w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors
                ${audio.voiceListening ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={audio.voiceListening ? "Disable voice commands" : "Enable voice commands"}
              title="Voice commands">
              {audio.voiceListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {audio.queue.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
            Up next: {audio.queue[0].title}
            {audio.queue.length > 1 && ` (+${audio.queue.length - 1} more)`}
          </div>
        )}
      </div>
    </motion.div>
  );
}
