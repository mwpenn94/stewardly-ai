/**
 * StudySession.tsx — The Atelier: Focused Study Session
 *
 * KE-inherited design: flashcard-style sequential study with keyboard navigation,
 * spaced repetition confidence rating, progress tracking, session stats.
 * Keyboard: Space/Enter=flip, 1=easy, 2=ok, 3=hard, ←=prev, →=next, Esc=exit
 *
 * Design tokens: font-display headings, font-mono metadata, 2px accent bars,
 * backdrop-blur sticky header, motion animations, rich session complete screen.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RotateCcw, ChevronLeft, ChevronRight,
  ThumbsUp, Minus, ThumbsDown, BookOpen, Keyboard,
  Shuffle, Filter, Zap, Clock, Star, Eye, EyeOff,
  CheckCircle2, Trophy, BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BookmarkButton from "@/components/BookmarkButton";

type Rating = "easy" | "medium" | "hard";
type StudyMode = "all" | "due" | "unseen" | "weak";

const MODE_META: Record<StudyMode, { label: string; description: string; icon: React.ElementType }> = {
  all: { label: "All Cards", description: "Study every card in order", icon: BookOpen },
  due: { label: "Due for Review", description: "Cards scheduled for review", icon: Clock },
  unseen: { label: "New Cards", description: "Cards you haven't seen yet", icon: Star },
  weak: { label: "Weak Areas", description: "Cards you rated as hard", icon: Zap },
};

export default function StudySession() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/learning/session/:trackSlug");
  const trackSlug = params?.trackSlug ?? "";

  const trackQ = trpc.learning.content.listTracks.useQuery(undefined, { enabled: !!isAuthenticated });
  const track = (trackQ.data ?? []).find((t: any) => t.slug === trackSlug);

  const flashcardsQ = trpc.learning.content.listFlashcardsForTrack.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!isAuthenticated && !!track?.id },
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [mode, setMode] = useState<StudyMode>("all");
  const [sessionStart] = useState(() => Date.now());

  const allCards = flashcardsQ.data ?? [];

  // Apply shuffle if enabled
  const cards = useMemo(() => {
    if (!shuffled) return allCards;
    const copy = [...allCards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [allCards, shuffled]);

  const total = cards.length;
  const current = cards[currentIdx];
  const pct = total > 0 ? Math.round(((currentIdx + (ratings[currentIdx] ? 1 : 0)) / total) * 100) : 0;

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const rate = useCallback((r: Rating) => {
    setRatings((prev) => ({ ...prev, [currentIdx]: r }));
    setFlipped(false);
    if (currentIdx < total - 1) {
      setTimeout(() => setCurrentIdx((i) => i + 1), 200);
    } else {
      setSessionComplete(true);
    }
  }, [currentIdx, total]);

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      setFlipped(false);
      setCurrentIdx((i) => i - 1);
    }
  }, [currentIdx]);

  const goForward = useCallback(() => {
    if (currentIdx < total - 1) {
      setFlipped(false);
      setCurrentIdx((i) => i + 1);
    }
  }, [currentIdx, total]);

  const restart = useCallback(() => {
    setCurrentIdx(0);
    setFlipped(false);
    setRatings({});
    setSessionComplete(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      if (e.key === "1") rate("easy");
      if (e.key === "2") rate("medium");
      if (e.key === "3") rate("hard");
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
      if (e.key === "Escape") navigate(track ? `/learning/tracks/${track.slug}` : "/learning");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flip, rate, goBack, goForward, navigate, track]);

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Study Session
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to start a focused study session with spaced repetition.
            </p>
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
            >
              Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const easyCount = Object.values(ratings).filter((r) => r === "easy").length;
  const medCount = Object.values(ratings).filter((r) => r === "medium").length;
  const hardCount = Object.values(ratings).filter((r) => r === "hard").length;
  const ratedCount = easyCount + medCount + hardCount;
  const elapsed = Math.round((Date.now() - sessionStart) / 60000);

  return (
    <LearningShell>
      <SEOHead title={`Study: ${track?.name ?? trackSlug}`} description="Focused flashcard study session" />
      <div className="min-h-screen flex flex-col">
        {/* Sticky Header — KE Atelier pattern */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="px-4 sm:px-6 lg:px-10 py-3">
            <div className="flex items-center gap-3">
              <Link href={track ? `/learning/tracks/${track.slug}` : "/learning"}>
                <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {track?.name ?? "Study Session"}
                </h1>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {currentIdx + 1}/{total} · {ratedCount} rated
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShuffled(!shuffled)}
                  className={`p-1.5 rounded-lg transition-colors ${shuffled ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                  title="Shuffle cards"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowKeyboard(!showKeyboard)}
                  className={`p-1.5 rounded-lg transition-colors ${showKeyboard ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts panel */}
        <AnimatePresence>
          {showKeyboard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-border bg-card/50 overflow-hidden"
            >
              <div className="px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-mono text-muted-foreground">
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">Space</kbd> Flip</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">1</kbd> Easy</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">2</kbd> OK</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">3</kbd> Hard</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">←</kbd> Prev</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">→</kbd> Next</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">Esc</kbd> Exit</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          {flashcardsQ.isLoading || trackQ.isLoading ? (
            <div className="w-full max-w-lg space-y-4">
              <Skeleton className="h-64 rounded-2xl" />
              <div className="flex justify-center gap-3">
                <Skeleton className="h-10 w-24 rounded-xl" />
                <Skeleton className="h-10 w-24 rounded-xl" />
                <Skeleton className="h-10 w-24 rounded-xl" />
              </div>
            </div>
          ) : total === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
              <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                No Flashcards Available
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                This track doesn't have any flashcards yet.
              </p>
              <Link href="/learning">
                <Button variant="outline" size="sm">Back to Learning</Button>
              </Link>
            </motion.div>
          ) : sessionComplete ? (
            /* ── Session Complete Screen ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-md w-full"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Session Complete!
              </h2>
              <p className="text-sm text-muted-foreground mb-6 font-mono">
                {total} cards reviewed · {elapsed > 0 ? `${elapsed}m` : "<1m"} elapsed
              </p>

              {/* Rating breakdown */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>{easyCount}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Easy</div>
                  <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${total > 0 ? (easyCount / total) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>{medCount}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">OK</div>
                  <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${total > 0 ? (medCount / total) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-2xl font-bold text-red-400" style={{ fontFamily: "var(--font-display)" }}>{hardCount}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Hard</div>
                  <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${total > 0 ? (hardCount / total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={restart}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/30 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Study Again
                </motion.button>
                <Link href={track ? `/learning/tracks/${track.slug}` : "/learning"}>
                  <motion.div
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Done
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          ) : (
            /* ── Active Study ── */
            <div className="w-full max-w-lg">
              {/* Flashcard */}
              <div
                className="cursor-pointer mb-6"
                onClick={flip}
                role="button"
                tabIndex={0}
                aria-label={flipped ? "Show question" : "Show answer"}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentIdx}-${flipped}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ perspective: 1000 }}
                  >
                    <div className={`relative min-h-[260px] rounded-2xl border bg-card flex flex-col items-center justify-center p-8 transition-colors ${
                      flipped ? "border-primary/30" : "border-border"
                    }`}>
                      {/* Accent bar */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                        style={{ background: flipped ? "var(--primary)" : "var(--border)" }}
                      />

                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-4 px-2 py-0.5 rounded bg-accent/50">
                        {flipped ? "Answer" : "Question"}
                      </span>

                      <p className="text-base leading-relaxed text-center" style={{ fontFamily: "var(--font-display)" }}>
                        {flipped
                          ? (current?.back ?? current?.answer ?? "")
                          : (current?.front ?? current?.question ?? "")}
                      </p>

                      {!flipped && (
                        <p className="text-[10px] text-muted-foreground mt-6 font-mono flex items-center gap-1.5">
                          <Eye className="w-3 h-3" /> tap or press Space to reveal
                        </p>
                      )}

                      {/* Card number indicator */}
                      {current?.discipline && (
                        <span className="absolute bottom-3 left-3 text-[9px] font-mono px-2 py-0.5 rounded bg-accent text-accent-foreground">
                          {current.discipline}
                        </span>
                      )}
                      {current && (
                        <span className="absolute bottom-3 right-3">
                          <BookmarkButton
                            contentType="flashcard"
                            contentId={String(current.id)}
                            contentTitle={current.front ?? current.question ?? ""}
                            discipline={current.discipline ?? trackSlug}
                            size="sm"
                          />
                        </span>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation + Rating Controls */}
              <div className="flex items-center justify-between">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goBack}
                  disabled={currentIdx === 0}
                  className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>

                <AnimatePresence>
                  {flipped && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex gap-2"
                    >
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rate("easy")}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 transition-colors"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Easy
                        <span className="text-[9px] opacity-50 ml-0.5">1</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rate("medium")}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" /> OK
                        <span className="text-[9px] opacity-50 ml-0.5">2</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rate("hard")}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> Hard
                        <span className="text-[9px] opacity-50 ml-0.5">3</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goForward}
                  disabled={currentIdx >= total - 1}
                  className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Mini session stats */}
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] font-mono text-muted-foreground">
                {easyCount > 0 && <span className="text-emerald-400">{easyCount} easy</span>}
                {medCount > 0 && <span className="text-amber-400">{medCount} ok</span>}
                {hardCount > 0 && <span className="text-red-400">{hardCount} hard</span>}
                {ratedCount === 0 && <span>Rate cards after flipping</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </LearningShell>
  );
}
