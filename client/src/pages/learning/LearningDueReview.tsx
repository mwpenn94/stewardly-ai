/**
 * EMBA Learning — Cross-track Due Review session (pass 1, build loop).
 *
 * The Learning Home dashboard has always shown a "due now" counter
 * derived from the SRS scheduler, but until this pass there was no UI
 * to actually review those items as a single mixed session. Learners
 * had to hop into each track and grind through the whole deck —
 * defeating the point of spaced repetition.
 *
 * This page:
 *
 *   1. Pulls a ranked mixed deck from `learning.mastery.dueReview`
 *      (most-overdue first, flashcards + practice questions mixed)
 *   2. Renders flashcards with a flip card + correct/incorrect buttons
 *   3. Renders questions with multiple-choice + explanation reveal
 *   4. Wires every response through `mastery.recordReview` so the
 *      existing SRS scheduler runs
 *   5. Shows per-session stats (streak, correct, incorrect) with
 *      track provenance so learners always know what they're seeing
 *   6. Celebrates >=80% completions via the same CelebrationEngine
 *      the single-track runners use
 *
 * The page degrades gracefully when there's nothing due: empty state
 * points learners at the track list and explains why.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Check,
  X,
  RotateCw,
  Sparkles,
  Trophy,
  HelpCircle,
  BookOpen,
  Calendar,
  LayoutList,
} from "lucide-react";
import { toast } from "sonner";
import { useCelebration } from "@/lib/CelebrationEngine";
import { useAchievementToast } from "@/components/AchievementToast";
import { recordStudyNow } from "./lib/studyStreak";
import { sendFeedback } from "@/lib/feedbackSpecs";


import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useStudySession } from "@/hooks/useStudySession";
import { DifficultyRating, type Difficulty } from "@/components/learning/DifficultyRating";
type KindFilter = "all" | "flashcard" | "question";

export default function LearningDueReview() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [, navigate] = useLocation();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [limit, setLimit] = useState<10 | 20 | 50>(20);

  const deckQ = trpc.learning.mastery.dueReview.useQuery(
    {
      limit,
    },
    { refetchOnWindowFocus: false },
  );
  const { showAchievementToast } = useAchievementToast();
  const recordReview = trpc.learning.mastery.recordReview.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: (data) => {
      if (data?.milestone) {
        showAchievementToast({
          icon: data.milestone.icon,
          title: data.milestone.label,
          description: data.milestone.description,
        });
      }
    },
  });
  const studySession = useStudySession({ discipline: "due-review" });

  const items = deckQ.data?.items ?? [];
  const totalDue = deckQ.data?.dueTotal ?? 0;
  const unresolved = deckQ.data?.total ?? 0;

  // ── Session state ──────────────────────────────────────────────────────
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sessionKey, setSessionKey] = useState(0); // bumps on restart

  // Reset whenever a fresh deck lands (new filters / restart).
  useEffect(() => {
    setIndex(0);
    setRevealed(false);
    setSelected(null);
    setCorrect(0);
    setIncorrect(0);
    setComplete(false);
  }, [deckQ.data?.total, sessionKey]);

  const current = items[index];
  const total = items.length;
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  // ── Handlers ───────────────────────────────────────────────────────────

  const advance = () => {
    if (index + 1 >= total) {
      setComplete(true);
      return;
    }
    setIndex((i) => i + 1);
    setRevealed(false);
    setSelected(null);
  };

  const submitFlashcard = async (difficulty: "again" | "hard" | "good" | "easy") => {
    if (!current || current.kind !== "flashcard") return;
    const ok = difficulty !== "again";
    studySession.recordItem();
    if (ok) studySession.recordMastery();
    recordReview
      .mutateAsync({
        itemKey: current.itemKey,
        itemType: "flashcard",
        correct: ok,
        difficulty,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
    // Pass 7 (build loop) — every answer counts as studying today.
    recordStudyNow();
    // Pass 16 — PIL feedback dispatch (G1/G8).
    sendFeedback(ok ? "learning.answer_correct" : "learning.answer_incorrect");
    sendFeedback("learning.srs_rating", { rating: difficulty });

    if (ok) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
    advance();
  };

  // Phase 1: Submit answer (reveal correct/incorrect) — no SRS write yet
  const submitQuestion = async () => {
    if (!current || current.kind !== "question" || selected == null) return;
    setRevealed(true);
    const ok = selected === current.question.correctIndex;
    studySession.recordItem();
    if (ok) studySession.recordMastery();
    recordStudyNow();
    sendFeedback(ok ? "learning.answer_correct" : "learning.answer_incorrect");
    if (ok) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
  };

  // Phase 2: Rate difficulty AFTER seeing the answer — writes SRS
  const rateQuestionDifficulty = (difficulty: Difficulty) => {
    if (!current || current.kind !== "question" || selected == null) return;
    const ok = selected === current.question.correctIndex;
    recordReview
      .mutateAsync({
        itemKey: current.itemKey,
        itemType: "question",
        correct: ok,
        difficulty,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
    sendFeedback("learning.srs_rating", { rating: difficulty });
    advance();
  };

  const restart = () => {
    setSessionKey((k) => k + 1);
    deckQ.refetch();
  };

  // ── Header meta ────────────────────────────────────────────────────────

  const deckMeta = useMemo(() => {
    if (!current) return null;
    if (current.kind === "flashcard") {
      return {
        badge: "Flashcard",
        track: (current.flashcard as Record<string, any>).trackName ?? "—",
      };
    }
    return {
      badge: "Question",
      track: (current.question as Record<string, any>).trackName ?? "—",
    };
  }, [current]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (deckQ.isLoading) {

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Please sign in to access this page.</p>
        <a href={getLoginUrl()} className="text-amber-500 hover:text-amber-400 underline">Sign in</a>
      </div>
    );
  }

    return (
      <LearningShell title="Due Review">
        <SEOHead title="Due Review" description="SRS review across all exam tracks" />
        <div className="min-h-[60vh] flex items-center justify-center"><div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm text-muted-foreground">Loading your due items…</span></div></div>
      </LearningShell>
    );
  }

  if (total === 0) {
    return (
      <LearningShell title="Due Review">
        <SEOHead title="Due Review" description="SRS review across all exam tracks" />
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="font-medium">Nothing due right now</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your spaced-repetition scheduler has nothing ready. New items
                you study will appear here on their next review date.
              </p>
              <div className="pt-2">
                <Link href="/learning">
                  <Button size="sm" variant="outline">
                    <BookOpen className="h-4 w-4 mr-2" /> Browse tracks
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell title="Due Review">
      <SEOHead title="Due Review" description="SRS review across all exam tracks" />
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-emerald-600">
              ✓ {correct}
            </Badge>
            <Badge variant="outline" className="text-rose-600">
              ✗ {incorrect}
            </Badge>
          </div>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Sparkles className="h-5 w-5 text-accent" />
            Due Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {totalDue} item{totalDue === 1 ? "" : "s"} due across all your
            tracks · showing {total}
            {unresolved > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}
                · {unresolved} unresolved (content moved or archived)
              </span>
            )}
          </p>
        </div>

        {/* Filters — hidden mid-session to avoid accidental resets */}
        {!complete && index === 0 && (
          <Card>
            <CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LayoutList className="h-3.5 w-3.5" /> Type
              </div>
              {(["all", "flashcard", "question"] as KindFilter[]).map((k) => (
                <Button
                  key={k}
                  variant={kindFilter === k ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs capitalize"
                  onClick={() => setKindFilter(k)}
                >
                  {k === "all" ? "All" : k}
                </Button>
              ))}
              <div className="h-5 w-px bg-border mx-1" />
              <div className="text-xs text-muted-foreground">Size</div>
              {([10, 20, 50] as const).map((n) => (
                <Button
                  key={n}
                  variant={limit === n ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setLimit(n)}
                >
                  {n}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {Math.min(index + 1, total)} of {total}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {complete ? (
          <CompletionCard
            correct={correct}
            total={correct + incorrect}
            onRestart={restart}
          />
        ) : (
          current && (
            <>
              {deckMeta && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{deckMeta.badge}</Badge>
                  <Badge variant="outline">{deckMeta.track}</Badge>
                  {(current as any).confidence > 0 && (
                    <Badge variant="outline">
                      level {(current as any).confidence}/5
                    </Badge>
                  )}
                </div>
              )}

              {current.kind === "flashcard" ? (
                <FlashcardCard
                  term={current.flashcard.term}
                  definition={current.flashcard.definition}
                  confidence={(current as any).confidence ?? 0}
                  onDifficulty={submitFlashcard}
                  disabled={recordReview.isPending}
                />
              ) : (
                <QuestionCard
                  prompt={current.question.prompt}
                  options={(current.question.options ?? []) as string[]}
                  correctIndex={current.question.correctIndex ?? 0}
                  explanation={current.question.explanation}
                  difficulty={current.question.difficulty}
                  selected={selected}
                  revealed={revealed}
                  onSelect={setSelected}
                  onSubmit={submitQuestion}
                  onDifficulty={rateQuestionDifficulty}
                  confidence={(current as any).confidence ?? 0}
                  disabled={recordReview.isPending}
                />
              )}
            </>
          )
        )}
      </div>
    </LearningShell>
  );
}

// ─── Difficulty button config (Pass 154) ────────────────────────────────────

type DifficultyLevel = "again" | "hard" | "good" | "easy";

const DIFFICULTY_CONFIG: Record<DifficultyLevel, {
  label: string;
  color: string;
  darkColor: string;
}> = {
  again: {
    label: "Again",
    color: "border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
    darkColor: "dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950",
  },
  hard: {
    label: "Hard",
    color: "border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800",
    darkColor: "dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950",
  },
  good: {
    label: "Good",
    color: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800",
    darkColor: "dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950",
  },
  easy: {
    label: "Easy",
    color: "border-sky-300 text-sky-700 hover:bg-sky-50 hover:text-sky-800",
    darkColor: "dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950",
  },
};

/** Pure interval preview — mirrors server SRS logic for instant UI labels */
const SRS_INTERVALS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const DIFF_MULT: Record<DifficultyLevel, number> = { again: 0, hard: 0.5, good: 1.0, easy: 1.5 };

function previewLabel(confidence: number, difficulty: DifficultyLevel): string {
  let conf = Math.max(0, Math.min(5, confidence));
  if (difficulty === "again") conf = 0;
  else conf = Math.min(5, conf + 1);
  const baseDays = SRS_INTERVALS[conf] ?? 1;
  const days = Math.max(0, baseDays * DIFF_MULT[difficulty]);
  if (days < 1 / 1440) return "<1m";
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

const DIFF_ICONS: Record<DifficultyLevel, React.ReactNode> = {
  again: <RotateCw className="h-3.5 w-3.5" />,
  hard: <X className="h-3.5 w-3.5" />,
  good: <Check className="h-3.5 w-3.5" />,
  easy: <Sparkles className="h-3.5 w-3.5" />,
};

// ─── Flashcard card with 4-button difficulty (Pass 154) ─────────────────────

function FlashcardCard({
  term,
  definition,
  confidence,
  onDifficulty,
  disabled,
}: {
  term: string;
  definition: string;
  confidence: number;
  onDifficulty: (d: DifficultyLevel) => void;
  disabled?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip whenever the card changes.
  useEffect(() => {
    setFlipped(false);
  }, [term, definition]);

  // Keyboard: Space/Enter flip, 1-4 select difficulty (Pass 154)
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && !disabled) {
        const diffMap: Record<string, DifficultyLevel> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
        if (diffMap[e.key]) {
          e.preventDefault();
          onDifficulty(diffMap[e.key]);
        }
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [flipped, disabled, onDifficulty]);

  return (
    <div className="space-y-4">
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Definition revealed. ${definition}. Press 1-4 to rate difficulty.`
            : `Flashcard term: ${term}. Press space or enter to reveal the definition.`
        }
        className={`min-h-[220px] cursor-pointer select-none transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          flipped ? "animate-card-flip-in" : ""
        }`}
        style={{ perspective: "600px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[220px] text-center">
          {flipped ? (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Definition
              </p>
              <p className="text-base leading-relaxed">{definition}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Term
              </p>
              <p className="text-xl font-semibold">{term}</p>
              <p className="text-xs text-muted-foreground mt-3">
                Click or press Space to reveal
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4-button difficulty row with interval previews */}
      <div className="grid grid-cols-4 gap-2">
        {(["again", "hard", "good", "easy"] as DifficultyLevel[]).map((d) => {
          const cfg = DIFFICULTY_CONFIG[d];
          const interval = previewLabel(confidence, d);
          return (
            <Button
              key={d}
              variant="outline"
              size="sm"
              className={`flex flex-col items-center gap-0.5 h-auto py-2 ${cfg.color} ${cfg.darkColor}`}
              onClick={() => onDifficulty(d)}
              disabled={!flipped || disabled}
              aria-label={`Rate ${cfg.label} — next review in ${interval}`}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                {DIFF_ICONS[d]} {cfg.label}
              </span>
              <span className="text-[10px] opacity-70 font-mono">{interval}</span>
            </Button>
          );
        })}
      </div>
      {!flipped && (
        <p className="text-[11px] text-muted-foreground text-center">
          Reveal the answer before rating difficulty. Keys: 1–4
        </p>
      )}
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────

function QuestionCard({
  prompt,
  options,
  correctIndex,
  explanation,
  difficulty,
  selected,
  revealed,
  onSelect,
  onSubmit,
  onDifficulty,
  confidence,
  disabled,
}: {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficulty: "easy" | "medium" | "hard";
  selected: number | null;
  revealed: boolean;
  onSelect: (i: number) => void;
  onSubmit: () => void;
  onDifficulty: (d: Difficulty) => void;
  confidence: number;
  disabled?: boolean;
}) {
  // Keyboard shortcuts: digits 1..N select option, Enter submits.
  // When revealed, DifficultyRating handles 1-4 keys internally.
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!revealed) {
        if (/^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (idx < options.length) {
            e.preventDefault();
            onSelect(idx);
          }
          return;
        }
        if (e.key === "Enter" && selected != null && !disabled) {
          e.preventDefault();
          onSubmit();
        }
      }
      // When revealed, DifficultyRating's own keyboard handler takes over
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [options.length, revealed, selected, disabled, onSelect, onSubmit]);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <Badge variant="outline">{difficulty}</Badge>
          <span className="text-[10px] text-muted-foreground hidden md:inline" aria-hidden>
            {!revealed
              ? `Press 1–${options.length} to choose · Enter to submit`
              : "Rate difficulty: 1–4"}
          </span>
        </div>
        <p className="text-base font-medium leading-relaxed">{prompt}</p>

        <ul className="space-y-2">
          {options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === correctIndex;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isSelected && !isCorrect;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => onSelect(i)}
                  aria-label={`Option ${String.fromCharCode(65 + i)}`}
                  className={[
                    "w-full text-left p-3 rounded-md border text-sm transition-colors",
                    showCorrect
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : showWrong
                        ? "border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200"
                        : isSelected
                          ? "border-primary"
                          : "border-border hover:border-primary/50",
                    revealed ? "cursor-default" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1">{opt}</span>
                    {showCorrect && <Check className="h-4 w-4" />}
                    {showWrong && <X className="h-4 w-4" />}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {revealed && explanation && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Explanation
            </p>
            <p className="text-sm leading-relaxed">{explanation}</p>
          </div>
        )}

        {!revealed ? (
          <div className="flex justify-end">
            <Button onClick={onSubmit} disabled={selected == null || disabled}>
              Submit answer
            </Button>
          </div>
        ) : (
          <DifficultyRating
            confidence={confidence}
            onRate={onDifficulty}
            disabled={disabled}
            enableKeyboard={revealed}
            label="How difficult was this question?"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Completion card ──────────────────────────────────────────────────────

function CompletionCard({
  correct,
  total,
  onRestart,
}: {
  correct: number;
  total: number;
  onRestart: () => void;
}) {
  const celebrate = useCelebration();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const isGreat = pct >= 80;
  const isGood = pct >= 60;

  useEffect(() => {
    if (isGreat) celebrate(pct === 100 ? "heavy" : "medium");
  }, [isGreat, pct, celebrate]);

  const getMessage = () => {
    if (pct === 100) return "Perfect — every due item cleared.";
    if (isGreat) return "Strong session. Your SRS due list just got much shorter.";
    if (isGood) return "Good progress. The ones you missed will come back sooner.";
    return "Every session strengthens memory. Keep at it.";
  };

  return (
    <Card className="overflow-hidden">
      {isGreat && (
        <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
      )}
      <CardContent className="p-8 text-center space-y-5">
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            isGreat ? "bg-accent/15" : isGood ? "bg-emerald-500/15" : "bg-muted"
          }`}
          style={{ animation: "page-enter 0.5s ease-out" }}
        >
          <Trophy
            className={`h-8 w-8 ${
              isGreat
                ? "text-accent"
                : isGood
                  ? "text-emerald-500"
                  : "text-muted-foreground"
            }`}
          />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold">
            {pct === 100 ? "Flawless!" : isGreat ? "Great session!" : "Session complete"}
          </p>
          <p className="text-sm text-muted-foreground">
            {correct} of {total} correct ({pct}%)
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto">
            {getMessage()}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={onRestart} variant="outline">
            <RotateCw className="h-4 w-4 mr-2" /> New session
          </Button>
          <Link href="/learning">
            <Button>Back to Learning</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
