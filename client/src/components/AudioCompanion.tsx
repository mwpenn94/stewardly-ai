/**
 * AudioCompanion.tsx — Universal persistent audio player
 *
 * Pass 159. Platform-wide audio companion that:
 * - Plays TTS-optimized scripts for any content
 * - Pre-buffers next 2-3 TTS items while current plays (eliminates gaps)
 * - Persists playback position + queue across page navigation & refresh
 * - Supports speed control, queue, auto-advance
 * - Retries TTS on 429/5xx with exponential backoff
 * - Integrates with hands-free voice navigation
 *
 * Mount ONCE in App.tsx, outside the route content area.
 * Controlled via the useAudioCompanion hook.
 */

import { authFetch } from "@/lib/sessionToken";
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Volume2, Pause, Play, SkipForward, SkipBack,
  ChevronDown, ChevronUp, Mic, MicOff, X,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────────────── */

export interface AudioItem {
  id: string;
  type: "definition" | "chapter" | "case_study" | "chat_response" |
        "market_brief" | "recommendation" | "page_narration" | "quiz_question" | "question";
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
  /** Index of current item within the original enqueued list (for progress persistence) */
  queueIndex: number;
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

/* ── persistence ──────────────────────────────────────────────── */

const PERSIST_KEY = "stewardly-audio-companion-state";
const PROGRESS_KEY = "stewardly-audio-progress";

interface PersistedAudioState {
  currentItem: AudioItem | null;
  queue: AudioItem[];
  speed: number;
}

interface PersistedProgress {
  /** The ID of the item that was playing when the user left */
  currentItemId: string | null;
  /** Index within the original enqueued list */
  queueIndex: number;
  /** Playback position in seconds */
  position: number;
  /** Timestamp of when this was saved */
  savedAt: number;
}

function loadPersistedState(): PersistedAudioState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.currentItem != null && typeof parsed.currentItem.script !== "string") return null;
    if (!Array.isArray(parsed.queue)) return null;
    if (typeof parsed.speed !== "number" || !isFinite(parsed.speed)) parsed.speed = 1.0;
    return {
      currentItem: parsed.currentItem ?? null,
      queue: parsed.queue.slice(0, 200),
      speed: Math.max(0.5, Math.min(3.0, parsed.speed)),
    };
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedAudioState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch { /* private mode / quota — ignore */ }
}

function loadPersistedProgress(): PersistedProgress | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Reject stale progress (older than 24 hours)
    if (Date.now() - (parsed.savedAt ?? 0) > 86400000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedProgress(progress: PersistedProgress): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

function clearPersistedProgress(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}

/* ── pre-buffer cache ─────────────────────────────────────────── */

/** Cache of pre-fetched TTS audio blobs, keyed by AudioItem.id */
const preBufferCache = new Map<string, { blob: Blob; url: string }>();
const preBufferInFlight = new Set<string>();
const MAX_CACHE_SIZE = 5;

function clearPreBufferCache() {
  for (const entry of preBufferCache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  preBufferCache.clear();
  preBufferInFlight.clear();
}

function evictOldestFromCache() {
  if (preBufferCache.size <= MAX_CACHE_SIZE) return;
  const firstKey = preBufferCache.keys().next().value;
  if (firstKey) {
    const entry = preBufferCache.get(firstKey);
    if (entry) URL.revokeObjectURL(entry.url);
    preBufferCache.delete(firstKey);
  }
}

/* ── TTS fetch with retry + backoff ───────────────────────────── */

async function fetchTtsWithRetry(
  text: string,
  speed: number,
  maxRetries = 2,
): Promise<{ blob: Blob; url: string } | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed }),
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size < 100) return null; // empty/corrupt audio
        const url = URL.createObjectURL(blob);
        return { blob, url };
      }

      // Retry on 429 (rate limit) or 5xx (server error)
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        console.log(`[AudioCompanion] TTS ${res.status}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      return null; // non-retryable error
    } catch (err) {
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        console.log(`[AudioCompanion] TTS fetch error, retrying in ${backoffMs}ms`, err);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      return null;
    }
  }
  return null;
}

/* ── pre-buffer function ──────────────────────────────────────── */

async function preBufferItem(item: AudioItem, speed: number): Promise<void> {
  if (preBufferCache.has(item.id) || preBufferInFlight.has(item.id)) return;
  if (!item.script || item.script.trim().length < 5) return;

  preBufferInFlight.add(item.id);
  try {
    const result = await fetchTtsWithRetry(item.script, speed, 1);
    if (result) {
      evictOldestFromCache();
      preBufferCache.set(item.id, result);
      console.log(`[AudioCompanion] Pre-buffered: "${item.title}" (${result.blob.size} bytes)`);
    }
  } finally {
    preBufferInFlight.delete(item.id);
  }
}

/* ── provider ─────────────────────────────────────────────────── */

export function AudioCompanionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AudioState>(() => {
    const persisted = loadPersistedState();
    const progress = loadPersistedProgress();
    return {
      currentItem: persisted?.currentItem ?? null,
      queue: persisted?.queue ?? [],
      playing: false,
      speed: persisted?.speed ?? 1.0,
      position: progress?.position ?? 0,
      duration: 0,
      mode: persisted?.currentItem ? "minimized" : "hidden",
      voiceListening: false,
      queueIndex: progress?.queueIndex ?? 0,
    };
  });

  // Persist queue/current item whenever they change
  useEffect(() => {
    savePersistedState({
      currentItem: state.currentItem,
      queue: state.queue,
      speed: state.speed,
    });
  }, [state.currentItem, state.queue, state.speed]);

  // Persist playback progress periodically (every 3 seconds while playing)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (state.playing && state.currentItem) {
      progressIntervalRef.current = setInterval(() => {
        savePersistedProgress({
          currentItemId: state.currentItem?.id ?? null,
          queueIndex: state.queueIndex,
          position: state.position,
          savedAt: Date.now(),
        });
      }, 3000);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [state.playing, state.currentItem, state.queueIndex, state.position]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generationRef = useRef(0);
  const speakItemRef = useRef<((item: AudioItem, speed: number) => Promise<void>) | null>(null);
  const speedRef = useRef(state.speed);
  speedRef.current = state.speed;
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clear any active playback timeout */
  const clearPlaybackTimeout = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  /** Auto-advance to next item in queue */
  const doAutoAdvance = useCallback((reason: string) => {
    console.log(`[AudioCompanion] Auto-advancing: ${reason}`);
    clearPlaybackTimeout();
    setState(prev => {
      if (prev.queue.length > 0) {
        const [next, ...rest] = prev.queue;
        const newIndex = prev.queueIndex + 1;
        console.log(`[AudioCompanion] → next: "${next.title}" (${rest.length} remaining, idx=${newIndex})`);
        setTimeout(() => speakItemRef.current?.(next, speedRef.current), 50);
        return { ...prev, currentItem: next, queue: rest, position: 0, queueIndex: newIndex };
      }
      console.log("[AudioCompanion] Queue empty, stopping");
      clearPersistedProgress();
      return { ...prev, playing: false, currentItem: null, mode: "hidden", queueIndex: 0 };
    });
  }, [clearPlaybackTimeout]);

  /** Pre-buffer upcoming items in the queue */
  const triggerPreBuffer = useCallback((queue: AudioItem[], speed: number) => {
    // Pre-fetch next 2-3 items
    const toPreBuffer = queue.slice(0, 3);
    for (const item of toPreBuffer) {
      preBufferItem(item, speed).catch(() => { /* silent */ });
    }
  }, []);

  const speakItem = useCallback(async (item: AudioItem, speed: number) => {
    const thisGen = ++generationRef.current;
    console.log(`[AudioCompanion] speakItem gen=${thisGen}: "${item.title}" (${item.script?.length ?? 0} chars)`);

    // Clean up previous audio
    clearPlaybackTimeout();
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    // Skip items with empty/very short scripts
    if (!item.script || item.script.trim().length < 5) {
      console.log(`[AudioCompanion] Skipping empty script: "${item.title}"`);
      doAutoAdvance("empty script");
      return;
    }

    // Trigger pre-buffering of upcoming queue items
    setState(prev => {
      triggerPreBuffer(prev.queue, speed);
      return prev; // no state change
    });

    // Check pre-buffer cache first
    let ttsResult = preBufferCache.get(item.id) ?? null;
    if (ttsResult) {
      console.log(`[AudioCompanion] Using pre-buffered audio for: "${item.title}"`);
      preBufferCache.delete(item.id); // consumed
    }

    if (!ttsResult) {
      // Fetch with retry + backoff
      ttsResult = await fetchTtsWithRetry(item.script, speed);
    }

    if (generationRef.current !== thisGen) {
      console.log(`[AudioCompanion] Stale gen=${thisGen} (current=${generationRef.current}), discarding`);
      if (ttsResult) URL.revokeObjectURL(ttsResult.url);
      return;
    }

    if (ttsResult) {
      const { url, blob } = ttsResult;
      console.log(`[AudioCompanion] TTS blob: ${blob.size} bytes`);

      const audio = new Audio(url);
      audio.playbackRate = speed;
      audioRef.current = audio;

      audio.onended = () => {
        console.log(`[AudioCompanion] onended: "${item.title}"`);
        clearPlaybackTimeout();
        URL.revokeObjectURL(url);
        doAutoAdvance("playback ended");
      };

      audio.onerror = (e) => {
        console.log(`[AudioCompanion] onerror: "${item.title}"`, e);
        clearPlaybackTimeout();
        URL.revokeObjectURL(url);
        doAutoAdvance("audio decode error");
      };

      audio.ontimeupdate = () => {
        setState(prev => ({
          ...prev,
          position: audio.currentTime,
          duration: audio.duration || 0,
        }));
      };

      try {
        await audio.play();
        console.log(`[AudioCompanion] Playing: "${item.title}" (dur=${audio.duration}s)`);
        setState(prev => ({ ...prev, playing: true, duration: audio.duration || 0 }));

        // Playback timeout: auto-advance if onended never fires
        const timeoutMs = Math.max(30000, (audio.duration || 30) * 1000 * 2 / speed);
        playbackTimeoutRef.current = setTimeout(() => {
          console.log(`[AudioCompanion] Playback timeout for: "${item.title}"`);
          if (audioRef.current === audio) {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            URL.revokeObjectURL(url);
            audioRef.current = null;
            doAutoAdvance("playback timeout");
          }
        }, timeoutMs);
        return;
      } catch (playError) {
        console.log(`[AudioCompanion] audio.play() failed: "${item.title}"`, playError);
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
        audioRef.current = null;
        URL.revokeObjectURL(url);
        // Fall through to Web Speech API
      }
    }

    // Fallback: Web Speech API
    if (window.speechSynthesis) {
      console.log(`[AudioCompanion] Falling back to Web Speech API for: "${item.title}"`);
      const utterance = new SpeechSynthesisUtterance(item.script.slice(0, 2000));
      utterance.rate = speed;
      utterance.onend = () => {
        console.log(`[AudioCompanion] Web Speech onend: "${item.title}"`);
        doAutoAdvance("web speech ended");
      };
      utterance.onerror = (e) => {
        console.log(`[AudioCompanion] Web Speech onerror: "${item.title}"`, e);
        doAutoAdvance("web speech error");
      };
      window.speechSynthesis.speak(utterance);
      setState(prev => ({ ...prev, playing: true }));

      const wsTimeout = Math.max(30000, item.script.length * 80 / speed);
      playbackTimeoutRef.current = setTimeout(() => {
        console.log(`[AudioCompanion] Web Speech timeout for: "${item.title}"`);
        window.speechSynthesis?.cancel();
        doAutoAdvance("web speech timeout");
      }, wsTimeout);
      return;
    }

    // Both TTS and Web Speech API unavailable
    console.log(`[AudioCompanion] No TTS available, auto-advancing past: "${item.title}"`);
    doAutoAdvance("no TTS engine available");
  }, [doAutoAdvance, clearPlaybackTimeout, triggerPreBuffer]);

  // Keep speakItemRef in sync
  speakItemRef.current = speakItem;

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
      clearPreBufferCache();
      setState(prev => ({
        ...prev, currentItem: item, playing: true, position: 0, mode: "expanded", queueIndex: 0,
      }));
      speakItem(item, state.speed);
    },

    enqueue: (items) => {
      console.log(`[AudioCompanion] enqueue(): ${items.length} items`);
      setState(prev => {
        if (!prev.currentItem && items.length > 0) {
          const [first, ...rest] = items;
          console.log(`[AudioCompanion] enqueue() starting: "${first.title}" (${rest.length} queued)`);
          setTimeout(() => speakItem(first, prev.speed), 0);
          return { ...prev, currentItem: first, queue: rest, playing: true, mode: "expanded", queueIndex: 0 };
        }
        console.log(`[AudioCompanion] enqueue() appending ${items.length} to queue of ${prev.queue.length}`);
        return { ...prev, queue: [...prev.queue, ...items] };
      });
    },

    pause: () => {
      console.log("[AudioCompanion] pause()");
      window.speechSynthesis?.pause();
      audioRef.current?.pause();
      clearPlaybackTimeout();
      setState(prev => ({ ...prev, playing: false }));
      // Save progress on pause
      savePersistedProgress({
        currentItemId: state.currentItem?.id ?? null,
        queueIndex: state.queueIndex,
        position: state.position,
        savedAt: Date.now(),
      });
    },

    resume: () => {
      window.speechSynthesis?.resume();
      audioRef.current?.play();
      setState(prev => ({ ...prev, playing: true }));
    },

    skip: () => {
      console.log("[AudioCompanion] skip()");
      clearPlaybackTimeout();
      window.speechSynthesis?.cancel();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
      }
      setState(prev => {
        if (prev.queue.length > 0) {
          const [next, ...rest] = prev.queue;
          const newIndex = prev.queueIndex + 1;
          setTimeout(() => speakItem(next, prev.speed), 0);
          return { ...prev, currentItem: next, queue: rest, position: 0, queueIndex: newIndex };
        }
        clearPersistedProgress();
        return { ...prev, currentItem: null, playing: false, mode: "hidden", queueIndex: 0 };
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
      console.log("[AudioCompanion] dismiss()");
      clearPlaybackTimeout();
      clearPreBufferCache();
      clearPersistedProgress();
      window.speechSynthesis?.cancel();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      setState(prev => ({ ...prev, currentItem: null, playing: false, queue: [], mode: "hidden", queueIndex: 0 }));
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
  const [location] = useLocation();
  const shouldReduceMotion = useReducedMotion();

  // Auto-minimize when on HandsFreeStudy page
  const isHandsFreePage = location.startsWith("/learning/hands-free");
  useEffect(() => {
    if (isHandsFreePage && audio.mode === "expanded" && audio.currentItem) {
      audio.minimize();
    }
  }, [isHandsFreePage]); // eslint-disable-line react-hooks/exhaustive-deps

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
        initial={shouldReduceMotion ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : undefined}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-lg max-w-[90vw] md:bottom-4"
      >
        <Volume2 className="w-3.5 h-3.5 text-primary flex-none" />
        <span className="text-xs text-foreground truncate max-w-[150px]">
          {audio.currentItem.title}
        </span>
        <button type="button" onClick={audio.playing ? audio.pause : audio.resume}
          aria-label={audio.playing ? "Pause" : "Play"}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer">
          {audio.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={audio.skip}
          aria-label="Skip forward"
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <div className="w-16 h-1 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${Math.round(progress)}% complete`}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={audio.expand}
          aria-label="Expand player"
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : undefined}
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
                {audio.queue.length > 0 && ` · ${audio.queueIndex + 1} of ${audio.queueIndex + 1 + audio.queue.length}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={audio.minimize}
              aria-label="Minimize player"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button type="button" onClick={audio.dismiss}
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
            <button type="button" onClick={() => audio.adjustSpeed(0.25)}
              aria-label={`Playback speed ${audio.speed.toFixed(2)}x, click to increase`}
              className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border cursor-pointer tabular-nums">
              {audio.speed.toFixed(2)}x
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={audio.previous}
              aria-label="Previous track"
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer">
              <SkipBack className="w-4 h-4" />
            </button>
            <button type="button" onClick={audio.playing ? audio.pause : audio.resume}
              aria-label={audio.playing ? "Pause" : "Play"}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground cursor-pointer">
              {audio.playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button type="button" onClick={audio.skip}
              aria-label="Next track"
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={audio.toggleVoiceListening}
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
