/**
 * EMBA Learning — Mixed SRS Review Session (Pass 1 — learning experience).
 *
 * Before this page existed, the "Start review" CTA on the Learning Home
 * deep-linked to `/learning/tracks/<firstTrack>/study` — which always
 * rendered the ENTIRE flashcard deck for the first track, regardless of
 * which items were actually due for review. That broke the whole value
 * prop of SRS: the user was supposed to see ONLY the items whose memory
 * was decaying, not re-study mastered cards.
 *
 * This page calls `learning.mastery.dueReview` which returns a
 * server-hydrated session: most-overdue-first, interleaved flashcards +
 * multiple-choice questions, already stamped with their `itemKey` so
 * the client doesn't need to reverse-engineer SRS bookkeeping.
 *
 * Every answer is written back through `learning.mastery.recordReview`
 * — the same pure `scheduleNextReview` helper that's unit-tested in
 * `mastery.test.ts` — so the session meaningfully moves the learner's
 * 0-5 confidence ladder forward (or halves it on a wrong answer).
 *
 * Keyboard shortcuts:
 *   Space    — flip a flashcard
 *   1 / W    — flashcard wrong
 *   2 / R    — flashcard right
 *   1-6      — select a quiz option
 *   Enter    — submit quiz answer, OR advance after feedback
 *   Esc      — exit session
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Check,
  X,
  RotateCw,
  Trophy,
  Sparkles,
  HelpCircle,
  BookOpen,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { useCelebration } from "@/lib/CelebrationEngine";
import { recordStudyEvent } from "@/lib/dailyStreak";

type SessionItem =
  | {
      kind: "flashcard";
      itemKey: string;
      isNew: boolean;
      flashcard: {
        id: number;
        term: string;
        definition: string;
      };
    }
  | {
      kind: "question";
      itemKey: string;
      isNew: boolean;
      question: {
        id: number;
        prompt: string;
        options: string[] | null;
        correctIndex: number;
        explanation: string | null;
        difficulty: "easy" | "medium" | "hard";
      };
    };

export default function LearningReview() {
  const [location, navigate] = useLocation();
  const studyAhead = useMemo(
    () => typeof location === "string" && location.includes("studyAhead"),
    [location],
  );
  const dueQ = trpc.learning.mastery.dueReview.useQuery({
    limit: 20,
    newQuota: 10,
    studyAhead,
  });
  const recordReview = trpc.learning.mastery.recordReview.useMutation();
  const celebrate = useCelebration();

  // Session state
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [complete, setComplete] = useState(false);

  const items: SessionItem[] = useMemo(
    () => (dueQ.data?.items as SessionItem[] | undefined) ?? [],
    [dueQ.data],
  );
  const total = items.length;
  const current = items[index];
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  // Reset when the session items load.
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setSelected(null);
    setRevealed(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setComplete(false);
  }, [dueQ.data]);

  const applyOutcome = useCallback(
    (correct: boolean) => {
      if (!current) return;
      // Persistent per-device streak — idempotent same-day.
      recordStudyEvent();
      recordReview
        .mutateAsync({
          itemKey: current.itemKey,
          itemType: current.kind,
          correct,
        })
        .catch((err) => {
          toast.error(`Review not saved: ${err.message ?? "network error"}`);
        });

      if (correct) {
        setCorrectCount((c) => c + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setIncorrectCount((c) => c + 1);
        setStreak(0);
      }
    },
    [current, recordReview],
  );

  const advance = useCallback(() => {
    if (index + 1 >= total) {
      setComplete(true);
      return;
    }
    setIndex((i) => i + 1);
    setFlipped(false);
    setSelected(null);
    setRevealed(false);
  }, [index, total]);

  const markFlashcard = useCallback(
    (correct: boolean) => {
      if (!current || current.kind !== "flashcard") return;
      applyOutcome(correct);
      advance();
    },
    [current, applyOutcome, advance],
  );

  const submitQuiz = useCallback(() => {
    if (!current || current.kind !== "question") return;
    if (selected == null) return;
    setRevealed(true);
    applyOutcome(selected === current.question.correctIndex);
  }, [current, selected, applyOutcome]);

  const restart = useCallback(() => {
    dueQ.refetch();
  }, [dueQ]);

  // Keyboard shortcuts
  useEffect(() => {
    if (complete) return;
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      // Ignore when focus is in a text field
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        navigate("/learning");
        return;
      }

      if (current.kind === "flashcard") {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          setFlipped((f) => !f);
          return;
        }
        if (!flipped) return;
        if (e.key === "1" || e.key.toLowerCase() === "w") {
          e.preventDefault();
          markFlashcard(false);
        } else if (e.key === "2" || e.key.toLowerCase() === "r") {
          e.preventDefault();
          markFlashcard(true);
        }
        return;
      }

      if (current.kind === "question") {
        const options = current.question.options ?? [];
        if (!revealed) {
          const digit = Number(e.key);
          if (Number.isFinite(digit) && digit >= 1 && digit <= options.length) {
            e.preventDefault();
            setSelected(digit - 1);
            return;
          }
          if (e.key === "Enter" && selected != null) {
            e.preventDefault();
            submitQuiz();
          }
          return;
        }
        if (e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          advance();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, flipped, revealed, selected, complete, markFlashcard, submitQuiz, advance, navigate]);

  // Celebrate on a strong finish.
  const finalPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  useEffect(() => {
    if (complete && finalPct >= 80) {
      celebrate(finalPct === 100 ? "heavy" : "medium");
    }
  }, [complete, finalPct, celebrate]);

  // Loading state
  if (dueQ.isLoading) {
    return (
      <AppShell title="Review">
        <SEOHead title="Review due items" description="SRS review session" />
        <div className="p-6 text-sm text-muted-foreground">Loading due items…</div>
      </AppShell>
    );
  }

  // Nothing due — caught up. Offer a study-ahead path when there are
  // new cards the user has never seen, otherwise route back to the
  // track browser.
  if (total === 0) {
    return (
      <AppShell title="Review">
        <SEOHead title="All caught up" description="No items due for review" />
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-2xl font-heading font-semibold">All caught up</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Nothing is due for review right now. Your next item will surface
                here once its memory window opens.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate("/learning/review?studyAhead=1")}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Study ahead (new cards)
                </Button>
                <Link href="/learning">
                  <Button variant="outline">Browse tracks</Button>
                </Link>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                Study-ahead pulls cards you've never seen and queues them for
                the SRS on the 0-5 confidence ladder.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const newCount = items.filter((i) => i.isNew).length;
  const reviewCount = items.length - newCount;

  return (
    <AppShell title={studyAhead ? "Study Ahead" : "Review"}>
      <SEOHead
        title={studyAhead ? "Study new cards" : "Review due items"}
        description="SRS review session"
      />
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/learning")}
            aria-label="Exit review"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Exit (Esc)
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap justify-end">
            {newCount > 0 && (
              <Badge
                variant="outline"
                className="text-accent border-accent/50"
                aria-label={`${newCount} new items in this session`}
              >
                <Sparkles className="h-3 w-3 mr-1" /> {newCount} new
              </Badge>
            )}
            {reviewCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                ↻ {reviewCount} review
              </Badge>
            )}
            {streak >= 3 && (
              <Badge
                variant="outline"
                className="text-accent border-accent/50 animate-pulse"
                aria-label={`Streak: ${streak} in a row`}
              >
                <Flame className="h-3 w-3 mr-1" /> {streak} streak
              </Badge>
            )}
            <Badge variant="outline" className="text-emerald-600">
              ✓ {correctCount}
            </Badge>
            <Badge variant="outline" className="text-rose-600">
              ✗ {incorrectCount}
            </Badge>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              Item {Math.min(index + 1, total)} of {total}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Body */}
        {complete ? (
          <CompletionCard
            correct={correctCount}
            total={total}
            bestStreak={bestStreak}
            onRestart={restart}
          />
        ) : current?.kind === "flashcard" ? (
          <FlashcardView
            card={current.flashcard}
            isNew={current.isNew}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onMark={markFlashcard}
            disabled={recordReview.isPending}
          />
        ) : current?.kind === "question" ? (
          <QuestionView
            q={current.question}
            isNew={current.isNew}
            selected={selected}
            revealed={revealed}
            onSelect={setSelected}
            onSubmit={submitQuiz}
            onAdvance={advance}
            isLast={index + 1 >= total}
            disabled={recordReview.isPending}
          />
        ) : null}

        {/* Keyboard hint */}
        {!complete && (
          <p className="text-[11px] text-muted-foreground text-center">
            {current?.kind === "flashcard"
              ? "Space to flip · 1 or W wrong · 2 or R right · Esc to exit"
              : "1–4 to select · Enter to submit/advance · Esc to exit"}
          </p>
        )}
      </div>
    </AppShell>
  );
}

// ─── Flashcard view ───────────────────────────────────────────────────────

function FlashcardView({
  card,
  isNew,
  flipped,
  onFlip,
  onMark,
  disabled,
}: {
  card: { term: string; definition: string };
  isNew: boolean;
  flipped: boolean;
  onFlip: () => void;
  onMark: (correct: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card
        className={`min-h-[220px] cursor-pointer select-none transition-transform duration-200 ${flipped ? "animate-card-flip-in" : ""}`}
        style={{ perspective: "600px" }}
        onClick={onFlip}
        role="button"
        aria-pressed={flipped}
        aria-label={flipped ? "Showing definition — click to hide" : "Showing term — click to reveal definition"}
        tabIndex={0}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[220px] text-center relative">
          <div className="absolute top-2 right-2 flex gap-1">
            {isNew && (
              <Badge variant="outline" className="text-[10px] text-accent border-accent/50">
                NEW
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              <Sparkles className="h-3 w-3 mr-1" /> Flashcard
            </Badge>
          </div>
          {flipped ? (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Definition
              </p>
              <p className="text-base leading-relaxed">{card.definition}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Term
              </p>
              <p className="text-xl font-semibold">{card.term}</p>
              <p className="text-xs text-muted-foreground mt-3">
                Click the card or press Space to reveal
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-400"
          onClick={() => onMark(false)}
          disabled={!flipped || disabled}
        >
          <X className="h-4 w-4 mr-2" /> Got it wrong <span className="ml-1 text-[10px] opacity-70">(1)</span>
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onMark(true)}
          disabled={!flipped || disabled}
        >
          <Check className="h-4 w-4 mr-2" /> Got it right <span className="ml-1 text-[10px] opacity-70">(2)</span>
        </Button>
      </div>
    </div>
  );
}

// ─── Multiple-choice question view ────────────────────────────────────────

function QuestionView({
  q,
  isNew,
  selected,
  revealed,
  onSelect,
  onSubmit,
  onAdvance,
  isLast,
  disabled,
}: {
  q: {
    prompt: string;
    options: string[] | null;
    correctIndex: number;
    explanation: string | null;
    difficulty: "easy" | "medium" | "hard";
  };
  isNew: boolean;
  selected: number | null;
  revealed: boolean;
  onSelect: (i: number) => void;
  onSubmit: () => void;
  onAdvance: () => void;
  isLast: boolean;
  disabled: boolean;
}) {
  const options: string[] = Array.isArray(q.options) ? q.options : [];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{q.difficulty}</Badge>
          <Badge variant="outline" className="text-[10px]">
            <HelpCircle className="h-3 w-3 mr-1" /> Question
          </Badge>
          {isNew && (
            <Badge variant="outline" className="text-[10px] text-accent border-accent/50">
              NEW
            </Badge>
          )}
        </div>
        <p className="text-base font-medium leading-relaxed">{q.prompt}</p>

        <ul className="space-y-2">
          {options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.correctIndex;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isSelected && !isCorrect;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => onSelect(i)}
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
                  aria-label={`Option ${i + 1}: ${opt}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {i + 1}.
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

        {revealed && q.explanation && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Explanation
            </p>
            <p className="text-sm leading-relaxed">{q.explanation}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {!revealed ? (
            <Button onClick={onSubmit} disabled={selected == null || disabled}>
              Submit <span className="ml-1 text-[10px] opacity-70">(⏎)</span>
            </Button>
          ) : (
            <Button onClick={onAdvance}>
              {isLast ? "Finish" : "Next"} <span className="ml-1 text-[10px] opacity-70">(⏎)</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Completion card ──────────────────────────────────────────────────────

function CompletionCard({
  correct,
  total,
  bestStreak,
  onRestart,
}: {
  correct: number;
  total: number;
  bestStreak: number;
  onRestart: () => void;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const isGreat = pct >= 80;
  const isGood = pct >= 60;

  const getMessage = () => {
    if (pct === 100)
      return "Flawless review. Every item held up under pressure.";
    if (isGreat)
      return "Strong session — the items you missed will come back on a shortened interval.";
    if (isGood)
      return "Solid progress. The misses will resurface for another pass.";
    return "The SRS scheduler will bring the misses back sooner. Every session strengthens retention.";
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
          <p className="text-2xl font-heading font-semibold">
            {pct === 100 ? "Flawless!" : isGreat ? "Great session" : "Session complete"}
          </p>
          <p className="text-sm text-muted-foreground">
            {correct} of {total} correct ({pct}%)
            {bestStreak >= 3 && (
              <>
                {" · "}
                <span className="text-accent">best streak: {bestStreak}</span>
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto">
            {getMessage()}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={onRestart} variant="outline">
            <RotateCw className="h-4 w-4 mr-2" /> Check for more
          </Button>
          <Link href="/learning">
            <Button>
              <BookOpen className="h-4 w-4 mr-2" /> Back to Learning
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
