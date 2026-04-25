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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Volume2, Pause, Play, SkipForward, SkipBack,
  ChevronDown, ChevronUp, Minus, Plus, BookOpen, ListMusic, X, AudioLines,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

/** Read the selected voice ID from localStorage (set by VoiceTab in settings) */
function getSelectedVoiceId(): string {
  try {
    return localStorage.getItem("tts-voice") || "guy";
  } catch { return "guy"; }
}

function setSelectedVoiceId(id: string): void {
  try { localStorage.setItem("tts-voice", id); } catch { /* ignore */ }
}

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
  /** Current voice ID for TTS */
  voiceId: string;
  /** Index of current item within the original enqueued list (for progress persistence) */
  queueIndex: number;
}

/** Discrete speed steps for cycling */
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
interface AudioActions {
  play: (item: AudioItem) => void;
  enqueue: (items: AudioItem[]) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  previous: () => void;
  setSpeed: (speed: number) => void;
  adjustSpeed: (delta: number) => void;
  /** Cycle through SPEED_STEPS: 1 = forward, -1 = backward */
  cycleSpeed: (direction: 1 | -1) => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
  readCurrentPage: () => void;
  /** Change the TTS voice */
  setVoice: (voiceId: string) => void;
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
  voice?: string,
): Promise<{ blob: Blob; url: string } | null> {
  const voiceId = voice || getSelectedVoiceId();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed, voice: voiceId }),
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
      voiceId: getSelectedVoiceId(),
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
    cycleSpeed: (direction: 1 | -1) => {
      const currentIdx = SPEED_STEPS.findIndex(s => Math.abs(s - state.speed) < 0.01);
      let nextIdx: number;
      if (currentIdx === -1) {
        // Current speed isn't a standard step — snap to nearest
        nextIdx = SPEED_STEPS.reduce((best, s, i) =>
          Math.abs(s - state.speed) < Math.abs(SPEED_STEPS[best] - state.speed) ? i : best, 0);
      } else {
        nextIdx = currentIdx + direction;
        if (nextIdx >= SPEED_STEPS.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = SPEED_STEPS.length - 1;
      }
      const newSpeed = SPEED_STEPS[nextIdx];
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

    setVoice: (voiceId: string) => {
      setSelectedVoiceId(voiceId);
      setState(prev => ({ ...prev, voiceId }));
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

/* ── Voice catalog (static, matches server VOICE_CATALOG) ────────── */

const VOICE_OPTIONS = [
  // US Female
  { id: "ava", label: "Ava", gender: "female", locale: "US", desc: "Warm, professional" },
  { id: "aria", label: "Aria", gender: "female", locale: "US", desc: "Clear, versatile" },
  { id: "emma", label: "Emma", gender: "female", locale: "US", desc: "Friendly, conversational" },
  { id: "jenny", label: "Jenny", gender: "female", locale: "US", desc: "Bright, energetic" },
  { id: "michelle", label: "Michelle", gender: "female", locale: "US", desc: "Calm, reassuring" },
  { id: "ana", label: "Ana", gender: "female", locale: "US", desc: "Young, approachable" },
  // US Male
  { id: "andrew", label: "Andrew", gender: "male", locale: "US", desc: "Authoritative, polished" },
  { id: "brian", label: "Brian", gender: "male", locale: "US", desc: "Confident, modern" },
  { id: "christopher", label: "Christopher", gender: "male", locale: "US", desc: "Deep, trustworthy" },
  { id: "eric", label: "Eric", gender: "male", locale: "US", desc: "Smooth, professional" },
  { id: "guy", label: "Guy", gender: "male", locale: "US", desc: "Warm, natural" },
  { id: "roger", label: "Roger", gender: "male", locale: "US", desc: "Mature, composed" },
  { id: "steffan", label: "Steffan", gender: "male", locale: "US", desc: "Friendly, relaxed" },
  // UK
  { id: "libby", label: "Libby", gender: "female", locale: "UK", desc: "British, articulate" },
  { id: "sonia", label: "Sonia", gender: "female", locale: "UK", desc: "British, elegant" },
  { id: "ryan", label: "Ryan", gender: "male", locale: "UK", desc: "British, confident" },
  { id: "thomas", label: "Thomas", gender: "male", locale: "UK", desc: "British, warm" },
  // AU
  { id: "natasha", label: "Natasha", gender: "female", locale: "AU", desc: "Australian, friendly" },
  { id: "william", label: "William", gender: "male", locale: "AU", desc: "Australian, easygoing" },
] as const;

const VOICE_LOCALES = ["US", "UK", "AU"] as const;

/* ── UI component ──────────────────────────────────────────────── */

function AudioCompanionUI() {
  const audio = useAudioCompanion();
  const [location] = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [showQueue, setShowQueue] = useState(false);

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

  const currentVoice = VOICE_OPTIONS.find(v => v.id === audio.voiceId) || VOICE_OPTIONS.find(v => v.id === "guy")!;
  const totalItems = audio.queueIndex + 1 + audio.queue.length;

  /* ── Minimized bar ─────────────────────────────────────────── */
  if (audio.mode === "minimized") {
    return (
      <motion.div
        initial={shouldReduceMotion ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : undefined}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-lg max-w-[92vw] md:bottom-4"
      >
        <Volume2 className="w-3.5 h-3.5 text-primary flex-none" />
        <span className="text-xs text-foreground truncate max-w-[140px]">
          {audio.currentItem.title}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
          {audio.queueIndex + 1}/{totalItems}
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
        <div className="w-16 h-1 rounded-full bg-border overflow-hidden" role="progressbar"
          aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
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

  /* ── Expanded player ───────────────────────────────────────── */
  return (
    <motion.div
      initial={shouldReduceMotion ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : undefined}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/98 backdrop-blur-md shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-[420px] md:rounded-xl md:border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="px-4 py-3">
        {/* Header: title + controls */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 text-primary flex-none" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {audio.currentItem.title}
              </div>
              <div className="text-[10px] text-muted-foreground capitalize">
                {audio.currentItem.type.replace(/_/g, " ")}
                {totalItems > 1 && ` · ${audio.queueIndex + 1} of ${totalItems}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {audio.queue.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => setShowQueue(q => !q)}
                    aria-label={showQueue ? "Hide queue" : "Show queue"}
                    className={`w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors
                      ${showQueue ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                    <ListMusic className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Queue ({audio.queue.length})</TooltipContent>
              </Tooltip>
            )}
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

        {/* Progress bar */}
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

        {/* Transport controls */}
        <div className="flex items-center justify-between">
          {/* Speed control: - / value / + */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => audio.cycleSpeed(-1)}
              aria-label="Decrease speed"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer">
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-1 text-xs text-muted-foreground tabular-nums min-w-[3rem] text-center select-none">
              {audio.speed.toFixed(2)}x
            </span>
            <button type="button" onClick={() => audio.cycleSpeed(1)}
              aria-label="Increase speed"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Play / skip controls */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={audio.previous}
              aria-label="Restart current"
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

          {/* Voice selector */}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button"
                aria-label={`Voice: ${currentVoice.label}. Click to change.`}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border cursor-pointer">
                <AudioLines className="w-3 h-3" />
                <span className="max-w-[4rem] truncate">{currentVoice.label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64 p-0">
              <div className="p-2 border-b border-border">
                <div className="text-xs font-medium text-foreground">Voice</div>
                <div className="text-[10px] text-muted-foreground">Select a voice for audio playback</div>
              </div>
              <ScrollArea className="max-h-56">
                {VOICE_LOCALES.map(locale => (
                  <div key={locale}>
                    <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                      {locale === "US" ? "American" : locale === "UK" ? "British" : "Australian"}
                    </div>
                    {VOICE_OPTIONS.filter(v => v.locale === locale).map(voice => (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() => audio.setVoice(voice.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 cursor-pointer transition-colors
                          ${voice.id === audio.voiceId ? "bg-primary/10 text-primary" : "text-foreground"}`}
                      >
                        <span className="text-xs font-medium">{voice.label}</span>
                        <span className="text-[10px] text-muted-foreground">{voice.desc}</span>
                        {voice.id === audio.voiceId && (
                          <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">Active</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {/* Up next preview (when queue not expanded) */}
        {audio.queue.length > 0 && !showQueue && (
          <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
            Up next: {audio.queue[0].title}
            {audio.queue.length > 1 && ` (+${audio.queue.length - 1} more)`}
          </div>
        )}

        {/* Queue view */}
        <AnimatePresence>
          {showQueue && audio.queue.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Queue ({audio.queue.length})
                  </span>
                </div>
                <ScrollArea className="max-h-32">
                  <div className="space-y-0.5">
                    {audio.queue.slice(0, 20).map((item, i) => (
                      <div key={item.id}
                        className="flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-accent/30 transition-colors">
                        <span className="text-muted-foreground tabular-nums w-4 text-right flex-none">
                          {audio.queueIndex + 2 + i}
                        </span>
                        <span className="truncate text-foreground">{item.title}</span>
                        <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 flex-none capitalize">
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                    {audio.queue.length > 20 && (
                      <div className="text-[10px] text-muted-foreground text-center py-1">
                        +{audio.queue.length - 20} more items
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
