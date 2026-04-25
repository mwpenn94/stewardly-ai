/**
 * HandsFreeStudy.tsx — KE-style Hands-Free Audio Learning
 *
 * Pass 157. Complete rewrite: uses the exhaustive getHandsFreeContent
 * procedure that fetches ALL content types (definitions, formulas, cases,
 * applications, subsections, flashcards, questions) from the Knowledge
 * Explorer database with pre-formatted TTS scripts.
 *
 * Features: audio chimes (Web Audio API), section-based content with
 * colored badges, voice/speed settings, circular transport controls,
 * keyboard shortcuts (Space/arrows/Esc), coming-up queue preview,
 * repeat mode, and rich completion screen.
 *
 * Fixes from Pass 156 preserved: session persistence, restore on mount,
 * speed sync, TTS failure recovery, repeat mode re-enqueue.
 *
 * CRITICAL FIX: Hides own transport controls when AudioCompanion expanded
 * panel is visible (prevents duplicate controls). Uses audio.mode to detect.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useStudySession } from "@/hooks/useStudySession";
import { useAudioCompanion, type AudioItem } from "@/components/AudioCompanion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Headphones, Play, Pause, SkipForward, SkipBack, Square,
  Volume2, ArrowLeft, Shuffle, Settings, ChevronDown,
  Brain, BookOpen, Loader2, CheckCircle2, Repeat,
  Calculator, FileText, Briefcase, LogIn,
  GraduationCap, HelpCircle, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useAchievementToast } from "@/components/AchievementToast";
import { motion, AnimatePresence } from "framer-motion";

// ── Extended section types to cover ALL Knowledge Explorer content ──
type SectionType = "definitions" | "formulas" | "cases" | "applications" | "subsections" | "flashcards" | "questions";
type Phase = "setup" | "playing" | "complete";

interface ContentItem {
  type: SectionType;
  label: string;
  text: string;
  key: string;
}

const SECTION_CONFIG: { type: SectionType; label: string; icon: any; color: string }[] = [
  { type: "definitions", label: "Definitions", icon: BookOpen, color: "#3B82F6" },
  { type: "formulas", label: "Formulas", icon: Calculator, color: "#10B981" },
  { type: "cases", label: "Case Studies", icon: FileText, color: "#F59E0B" },
  { type: "applications", label: "Applications", icon: Briefcase, color: "#8B5CF6" },
  { type: "subsections", label: "Lessons", icon: Layers, color: "#EC4899" },
  { type: "flashcards", label: "Flashcards", icon: GraduationCap, color: "#06B6D4" },
  { type: "questions", label: "Questions", icon: HelpCircle, color: "#EF4444" },
];

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
];

/* ── Audio Chimes via Web Audio API ── */
function playChime(type: "start" | "section" | "complete") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";

    if (type === "start") {
      osc.frequency.setValueAtTime(523, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3); // G5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "section") {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.1); // C5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch { /* AudioContext not available */ }
}

export default function HandsFreeStudy() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const audio = useAudioCompanion();
  const studySession = useStudySession({ discipline: "hands-free" });

  // Session persistence key
  const SESSION_KEY = "stewardly-handsfree-session";

  /* ── Shared session restore helper ── */
  const restoreSession = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (saved.phase !== "playing" || !Array.isArray(saved.contentQueue) || saved.contentQueue.length === 0) return false;
      setContentQueue(saved.contentQueue);
      setSpeed(saved.speed ?? 1.0);
      setRepeatMode(saved.repeatMode ?? false);
      setPhase("playing");
      setIsPlaying(audio.playing);
      playingRef.current = audio.playing;
      const matchIdx = saved.contentQueue.findIndex((item: ContentItem) => item.key === audio.currentItem?.id);
      setCurrentItemIndex(matchIdx >= 0 ? matchIdx : saved.currentItemIndex ?? 0);
      return true;
    } catch { return false; }
  }, [audio.playing, audio.currentItem?.id]);

  // Settings — all 7 sections enabled by default
  const [enabledSections, setEnabledSections] = useState<SectionType[]>(
    ["definitions", "formulas", "cases", "applications", "subsections", "flashcards", "questions"]
  );
  const [repeatMode, setRepeatMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  // Playback state
  const [phase, setPhase] = useState<Phase>("setup");
  const [isPlaying, setIsPlaying] = useState(false);
  const [contentQueue, setContentQueue] = useState<ContentItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentSection, setCurrentSection] = useState<SectionType | null>(null);
  const playingRef = useRef(false);

  // ── Data: use the new exhaustive getHandsFreeContent procedure ──
  const handsFreeQ = trpc.learning.content.getHandsFreeContent.useQuery(
    { sections: enabledSections, limit: 100 },
    { enabled: !!isAuthenticated }
  );
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([handsFreeQ.refetch(), summaryQ.refetch()]);
  }, [handsFreeQ, summaryQ]);
  const { pullRef, isRefreshing, pullProgress, pullDistance } = usePullToRefresh({ onRefresh: handlePullRefresh });
  const { showAchievementToast } = useAchievementToast();
  const recordReview = trpc.learning.mastery.recordReview.useMutation({
    onSuccess: (data) => {
      if (data?.milestone) {
        showAchievementToast({ icon: data.milestone.icon, title: data.milestone.label, description: data.milestone.description });
      }
    },
  });

  const toggleSection = useCallback((type: SectionType) => {
    setEnabledSections(prev =>
      prev.includes(type) ? prev.filter(s => s !== type) : [...prev, type]
    );
  }, []);

  /* ── Build content queue from ACTUAL Knowledge Explorer data ── */
  const buildQueue = useCallback((): ContentItem[] => {
    const items: ContentItem[] = [];
    const data = handsFreeQ.data;
    if (!data) return items;

    // 1. Definitions — actual terms + definitions from KE
    if (enabledSections.includes("definitions") && data.definitions) {
      for (const def of data.definitions) {
        items.push({
          type: "definitions",
          label: def.term,
          text: def.ttsScript,
          key: `def-${def.id}`,
        });
      }
    }

    // 2. Formulas — actual formulas with variable explanations
    if (enabledSections.includes("formulas") && data.formulas) {
      for (const f of data.formulas) {
        items.push({
          type: "formulas",
          label: f.name,
          text: f.ttsScript,
          key: `formula-${f.id}`,
        });
      }
    }

    // 3. Cases — actual case study content
    if (enabledSections.includes("cases") && data.cases) {
      for (const c of data.cases) {
        items.push({
          type: "cases",
          label: c.title,
          text: c.ttsScript,
          key: `case-${c.id}`,
        });
      }
    }

    // 4. Applications — actual FS application content
    if (enabledSections.includes("applications") && data.applications) {
      for (const a of data.applications) {
        items.push({
          type: "applications",
          label: a.title,
          text: a.ttsScript,
          key: `app-${a.id}`,
        });
      }
    }

    // 5. Subsections — the richest educational content (lesson paragraphs)
    if (enabledSections.includes("subsections") && data.subsections) {
      for (const s of data.subsections) {
        items.push({
          type: "subsections",
          label: s.title ?? `Lesson Section ${s.id}`,
          text: s.ttsScript,
          key: `subsec-${s.id}`,
        });
      }
    }

    // 6. Flashcards — term + definition pairs
    if (enabledSections.includes("flashcards") && data.flashcards) {
      for (const f of data.flashcards) {
        items.push({
          type: "flashcards",
          label: f.term,
          text: f.ttsScript,
          key: `fc-${f.id}`,
        });
      }
    }

    // 7. Questions — practice questions with explanations
    if (enabledSections.includes("questions") && data.questions) {
      for (const q of data.questions) {
        items.push({
          type: "questions",
          label: q.prompt.slice(0, 80) + (q.prompt.length > 80 ? "..." : ""),
          text: q.ttsScript,
          key: `q-${q.id}`,
        });
      }
    }

    // Shuffle (Fisher-Yates)
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  }, [enabledSections, handsFreeQ.data]);

  /* ── Sync speed to AudioCompanion ── */
  useEffect(() => {
    audio.setSpeed(speed);
  }, [speed]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Start playback ── */
  const startPlayback = useCallback(() => {
    const queue = buildQueue();
    if (queue.length === 0) {
      toast.error("No content available. Import content in the Knowledge Explorer first.");
      return;
    }
    setContentQueue(queue);
    setCurrentItemIndex(0);
    setPhase("playing");
    setIsPlaying(true);
    playingRef.current = true;
    playChime("start");

    // Sync speed to AudioCompanion before enqueuing
    audio.setSpeed(speed);

    // Enqueue in AudioCompanion
    const audioItems: AudioItem[] = queue.map(item => ({
      id: item.key,
      type: "definition",
      title: item.label,
      script: item.text,
      contentId: item.key,
    }));
    audio.enqueue(audioItems);
    toast.success(`Started session with ${queue.length} items`);
  }, [buildQueue, audio, speed]);

  /* ── Stop playback ── */
  const stopPlayback = useCallback(() => {
    setPhase("complete");
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setIsPlaying(false);
    playingRef.current = false;
    audio.dismiss();
    playChime("complete");
    studySession.flush();
  }, [audio, studySession]);

  /* ── Toggle pause ── */
  const togglePause = useCallback(() => {
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.resume();
      setIsPlaying(true);
    }
  }, [isPlaying, audio]);

  /* ── Skip forward (re-enqueue remaining to keep AudioCompanion queue in sync) ── */
  const skipForward = useCallback(() => {
    if (currentItemIndex < contentQueue.length - 1) {
      const nextIdx = currentItemIndex + 1;
      setCurrentItemIndex(nextIdx);
      setCurrentSection(contentQueue[nextIdx].type);
      studySession.recordItem();

      // Play section chime if section changed
      if (contentQueue[nextIdx].type !== contentQueue[currentItemIndex]?.type) {
        playChime("section");
      }

      // Dismiss + re-enqueue from the skip point so AudioCompanion's queue stays in sync
      const remaining = contentQueue.slice(nextIdx).map(item => ({
        id: item.key,
        type: "definition" as const,
        title: item.label,
        script: item.text,
        contentId: item.key,
      }));
      audio.dismiss();
      audio.enqueue(remaining);
    } else if (repeatMode) {
      setCurrentItemIndex(0);
      const allItems = contentQueue.map(item => ({
        id: item.key,
        type: "definition" as const,
        title: item.label,
        script: item.text,
        contentId: item.key,
      }));
      audio.dismiss();
      audio.enqueue(allItems);
    } else {
      stopPlayback();
    }
  }, [currentItemIndex, contentQueue, audio, repeatMode, stopPlayback, studySession]);

  /* ── Skip backward (re-enqueue from skip point) ── */
  const skipBackward = useCallback(() => {
    if (currentItemIndex > 0) {
      const prevIdx = currentItemIndex - 1;
      setCurrentItemIndex(prevIdx);
      setCurrentSection(contentQueue[prevIdx].type);
      const remaining = contentQueue.slice(prevIdx).map(item => ({
        id: item.key,
        type: "definition" as const,
        title: item.label,
        script: item.text,
        contentId: item.key,
      }));
      audio.dismiss();
      audio.enqueue(remaining);
    }
  }, [currentItemIndex, contentQueue, audio]);

  /* ── Sync with AudioCompanion auto-advance (repeat mode support) ── */
  const repeatPendingRef = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || contentQueue.length === 0) return;
    const currentAudioId = audio.currentItem?.id;
    if (!currentAudioId) {
      if (playingRef.current || repeatPendingRef.current) {
        repeatPendingRef.current = false;
        if (repeatMode) {
          setCurrentItemIndex(0);
          setCurrentSection(contentQueue[0].type);
          const allItems = contentQueue.map(item => ({
            id: item.key,
            type: "definition" as const,
            title: item.label,
            script: item.text,
            contentId: item.key,
          }));
          repeatPendingRef.current = true;
          audio.enqueue(allItems);
          playChime("section");
        } else {
          stopPlayback();
        }
      }
      return;
    }
    repeatPendingRef.current = false;
    const matchIdx = contentQueue.findIndex(item => item.key === currentAudioId);
    if (matchIdx >= 0 && matchIdx !== currentItemIndex) {
      setCurrentItemIndex(matchIdx);
      setCurrentSection(contentQueue[matchIdx].type);
      studySession.recordItem();
    }
  }, [audio.currentItem?.id, phase, contentQueue, currentItemIndex, studySession, stopPlayback, repeatMode, audio]);

  /* ── Sync playing state with AudioCompanion ── */
  useEffect(() => {
    if (phase !== "playing") return;
    if (audio.playing !== isPlaying) {
      setIsPlaying(audio.playing);
      playingRef.current = audio.playing;
    }
  }, [audio.playing, phase, isPlaying]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.key === "ArrowRight") skipForward();
      if (e.key === "ArrowLeft") skipBackward();
      if (e.key === "Escape") stopPlayback();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, togglePause, skipForward, skipBackward, stopPlayback]);

  /* ── Persist session state for background navigation ── */
  useEffect(() => {
    if (phase === "playing" && contentQueue.length > 0) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          phase, contentQueue, currentItemIndex, speed, repeatMode,
        }));
      } catch { /* quota or private mode */ }
    } else if (phase === "setup" || phase === "complete") {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [phase, contentQueue, currentItemIndex, speed, repeatMode]);

  /* ── Restore session on mount if AudioCompanion is still playing ── */
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current || phase !== "setup" || !audio.currentItem) return;
    if (restoreSession()) {
      hasRestoredRef.current = true;
      toast.info("Resumed hands-free session");
    }
  }, [audio.currentItem?.id, phase, restoreSession]);

  /* ── Auto-minimize AudioCompanion when HandsFreeStudy is in playing phase ── */
  useEffect(() => {
    if (phase === "playing" && audio.mode === "expanded") {
      audio.minimize();
    }
  }, [phase, audio.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Section counts from actual data ── */
  const sectionCounts = useMemo(() => {
    const data = handsFreeQ.data;
    if (!data) return {
      definitions: 0, formulas: 0, cases: 0, applications: 0,
      subsections: 0, flashcards: 0, questions: 0,
    };
    return {
      definitions: data.definitions?.length ?? 0,
      formulas: data.formulas?.length ?? 0,
      cases: data.cases?.length ?? 0,
      applications: data.applications?.length ?? 0,
      subsections: data.subsections?.length ?? 0,
      flashcards: data.flashcards?.length ?? 0,
      questions: data.questions?.length ?? 0,
    };
  }, [handsFreeQ.data]);

  const currentItem = contentQueue[currentItemIndex];
  const progress = contentQueue.length > 0 ? Math.round(((currentItemIndex + 1) / contentQueue.length) * 100) : 0;
  const totalAvailable = Object.values(sectionCounts).reduce((a, b) => a + b, 0);

  /* ── Auth guard ── */
  if (authLoading) {
    return <LearningShell><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></LearningShell>;
  }
  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Hands-Free Study" description="Audio-based learning sessions" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Headphones className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Hands-Free Study</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to start audio learning sessions.</p>
            <a href={getLoginUrl("/learning/hands-free")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Hands-Free Study" description="Audio-based learning sessions" />
      <div ref={pullRef as any} className="min-h-screen pb-36">
        <PullToRefreshIndicator pullDistance={pullDistance} pullProgress={pullProgress} isRefreshing={isRefreshing} />
        {/* ── Header ── */}
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Hands-Free Study
              </h1>
              <p className="text-xs text-muted-foreground font-mono">Listen and learn — no screen required</p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-8">
          <AnimatePresence mode="wait">
            {/* ═══════════ SETUP PHASE ═══════════ */}
            {phase === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                {/* Resume banner — shown when AudioCompanion is still playing from a previous session */}
                {audio.currentItem && phase === "setup" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-none">
                        <Volume2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Session in progress</p>
                        <p className="text-xs text-muted-foreground truncate">Now playing: {audio.currentItem.title}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!restoreSession()) {
                          audio.expand();
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-none"
                    >
                      Resume
                    </button>
                  </motion.div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Items Available", value: handsFreeQ.isLoading ? "..." : totalAvailable },
                    { label: "Content Types", value: SECTION_CONFIG.filter(s => sectionCounts[s.type] > 0).length },
                    { label: "Mastered", value: (summaryQ.data as any)?.mastered ?? 0 },
                  ].map(stat => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold font-mono">{stat.value}</div>
                      <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Section Selection — all 7 types */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <BookOpen className="w-4 h-4 text-primary" />
                    Content Sections
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {SECTION_CONFIG.map(sec => {
                      const Icon = sec.icon;
                      const count = sectionCounts[sec.type] ?? 0;
                      return (
                        <button
                          key={sec.type}
                          onClick={() => toggleSection(sec.type)}
                          className={`text-left p-3 sm:p-4 rounded-xl border transition-all ${
                            enabledSections.includes(sec.type)
                              ? "border-primary bg-primary/5"
                              : "border-border opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-4 h-4 flex-none" style={{ color: sec.color }} />
                            <span className="text-xs sm:text-sm font-medium truncate">{sec.label}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto font-mono flex-none">{count}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {enabledSections.includes(sec.type) ? "Included" : "Excluded"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Playback Settings */}
                <section>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-2 text-sm font-semibold mb-3"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    <Settings className="w-4 h-4 text-primary" />
                    Playback Settings
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        {/* Speed */}
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Speed</label>
                          <div className="flex gap-2">
                            {SPEED_OPTIONS.map(s => (
                              <button
                                key={s.value}
                                onClick={() => setSpeed(s.value)}
                                className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                                  speed === s.value
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border hover:border-primary/30"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Repeat */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setRepeatMode(!repeatMode)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                              repeatMode ? "border-primary bg-primary/10 text-primary" : "border-border"
                            }`}
                          >
                            <Repeat className="w-3 h-3" />
                            {repeatMode ? "Repeat On" : "Repeat Off"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* Start Button */}
                <button
                  onClick={startPlayback}
                  disabled={enabledSections.length === 0 || totalAvailable === 0 || handsFreeQ.isLoading}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {handsFreeQ.isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Loading content...</>
                  ) : (
                    <><Headphones className="w-4 h-4" /> Start Listening Session ({totalAvailable} items)</>
                  )}
                </button>
              </motion.div>
            )}

            {/* ═══════════ PLAYING PHASE ═══════════ */}
            {phase === "playing" && (
              <motion.div
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto"
              >
                {/* Now Playing Card */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                  {/* Progress */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{currentItemIndex + 1} / {contentQueue.length}</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-6">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {/* Current section badge */}
                  {currentItem && (() => {
                    const sec = SECTION_CONFIG.find(s => s.type === currentItem.type);
                    const Icon = sec?.icon || BookOpen;
                    return (
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="w-4 h-4" style={{ color: sec?.color }} />
                        <span className="text-xs font-mono" style={{ color: sec?.color }}>{sec?.label}</span>
                      </div>
                    );
                  })()}

                  {/* Current item */}
                  {currentItem && (
                    <div className="mb-6">
                      <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                        {currentItem.label}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                        {currentItem.text}
                      </p>
                    </div>
                  )}

                  {/* Audio indicator */}
                  {isPlaying && (
                    <div className="flex items-center gap-2 text-xs text-primary mb-4">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                      <span>Playing...</span>
                    </div>
                  )}

                  {/* Transport Controls — only show when AudioCompanion is NOT expanded */}
                  {audio.mode !== "expanded" && (
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={skipBackward}
                        disabled={currentItemIndex === 0}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
                        title="Previous (Left Arrow)"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={togglePause}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                        title="Play/Pause (Space)"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </button>
                      <button
                        onClick={skipForward}
                        disabled={currentItemIndex >= contentQueue.length - 1 && !repeatMode}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
                        title="Next (Right Arrow)"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={stopPlayback}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-destructive/30 text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors"
                        title="Stop (Escape)"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Keyboard hints */}
                  <p className="text-center text-[10px] text-muted-foreground mt-4 font-mono">
                    Space: pause/resume · Arrows: skip · Esc: stop
                  </p>

                  {/* Repeat indicator */}
                  {repeatMode && (
                    <div className="flex items-center justify-center gap-1 mt-3 text-[10px] text-primary">
                      <Repeat className="w-3 h-3" />
                      Repeat mode active
                    </div>
                  )}
                </div>

                {/* Coming Up queue */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-xs font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
                    Coming Up
                  </h3>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {contentQueue.slice(currentItemIndex + 1, currentItemIndex + 8).map((item, i) => {
                      const sec = SECTION_CONFIG.find(s => s.type === item.type);
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sec?.color }} />
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                    {contentQueue.length - currentItemIndex - 1 > 8 && (
                      <p className="text-[10px] text-muted-foreground text-center py-1">
                        +{contentQueue.length - currentItemIndex - 9} more items
                      </p>
                    )}
                    {contentQueue.length - currentItemIndex - 1 === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">
                        Last item in queue
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══════════ COMPLETE PHASE ═══════════ */}
            {phase === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto text-center"
              >
                <div className="bg-card border border-border rounded-2xl p-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-500/10"
                  >
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    Session Complete
                  </h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    You listened through {contentQueue.length} items.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6 font-mono">
                    {currentItemIndex + 1} of {contentQueue.length} completed
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => { setPhase("setup"); setContentQueue([]); }}
                      className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> New Session
                    </button>
                    <button
                      onClick={startPlayback}
                      className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Repeat className="w-4 h-4" /> Replay
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LearningShell>
  );
}
