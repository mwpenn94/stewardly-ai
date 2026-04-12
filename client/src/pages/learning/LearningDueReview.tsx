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
import AppShell from "@/components/AppShell";
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
import { recordStudyNow } from "./lib/studyStreak";
import { sendFeedback } from "@/lib/feedbackSpecs";


type KindFilter = "all" | "flashcard" | "question";

export default function LearningDueReview() {
  const [, navigate] = useLocation();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [limit, setLimit] = useState<10 | 20 | 50>(20);

  const deckQ = trpc.learning.mastery.dueReview.useQuery(
    {
      limit,
      ...(kindFilter !== "all" ? { kind: kindFilter } : {}),
    },
    { refetchOnWindowFocus: false },
  );
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const items = deckQ.data?.items ?? [];
  const totalDue = deckQ.data?.counts?.totalDue ?? 0;
  const unresolved = deckQ.data?.counts?.unresolved ?? 0;

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
  }, [deckQ.data?.generatedAt, sessionKey]);

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

  const submitFlashcard = async (ok: boolean) => {
    if (!current || current.kind !== "flashcard") return;
    recordReview
      .mutateAsync({
        itemKey: current.itemKey,
        itemType: "flashcard",
        correct: ok,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
    // Pass 7 (build loop) — every answer counts as studying today.
    recordStudyNow();
    // Pass 16 — PIL feedback dispatch (G1/G8).
    sendFeedback(ok ? "learning.answer_correct" : "learning.answer_incorrect");

    if (ok) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
    advance();
  };

  const submitQuestion = async () => {
    if (!current || current.kind !== "question" || selected == null) return;
    setRevealed(true);
    const ok = selected === current.question.correctIndex;
    recordReview
      .mutateAsync({
        itemKey: current.itemKey,
        itemType: "question",
        correct: ok,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
    recordStudyNow();
    // Pass 16 — PIL feedback dispatch (G1/G8).
    sendFeedback(ok ? "learning.answer_correct" : "learning.answer_incorrect");

    if (ok) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
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
        track: current.card.trackName ?? "—",
      };
    }
    return {
      badge: "Question",
      track: current.question.trackName ?? "—",
    };
  }, [current]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (deckQ.isLoading) {
    return (
      <AppShell title="Due Review">
        <SEOHead title="Due Review" description="SRS review across all exam tracks" />
        <div className="p-6 text-sm text-muted-foreground">Loading your due items…</div>
      </AppShell>
    );
  }

  if (total === 0) {
    return (
      <AppShell title="Due Review">
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
      </AppShell>
    );
  }

  return (
    <AppShell title="Due Review">
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
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
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
                  {current.confidence > 0 && (
                    <Badge variant="outline">
                      level {current.confidence}/5
                    </Badge>
                  )}
                </div>
              )}

              {current.kind === "flashcard" ? (
                <FlashcardCard
                  term={current.card.term}
                  definition={current.card.definition}
                  onCorrect={() => submitFlashcard(true)}
                  onIncorrect={() => submitFlashcard(false)}
                  disabled={recordReview.isPending}
                />
              ) : (
                <QuestionCard
                  prompt={current.question.prompt}
                  options={current.question.options}
                  correctIndex={current.question.correctIndex}
                  explanation={current.question.explanation}
                  difficulty={current.question.difficulty}
                  selected={selected}
                  revealed={revealed}
                  onSelect={setSelected}
                  onSubmit={submitQuestion}
                  onNext={advance}
                  isLast={index + 1 >= total}
                  disabled={recordReview.isPending}
                />
              )}
            </>
          )
        )}
      </div>
    </AppShell>
  );
}

// ─── Flashcard card ───────────────────────────────────────────────────────

function FlashcardCard({
  term,
  definition,
  onCorrect,
  onIncorrect,
  disabled,
}: {
  term: string;
  definition: string;
  onCorrect: () => void;
  onIncorrect: () => void;
  disabled?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip whenever the card changes.
  useEffect(() => {
    setFlipped(false);
  }, [term, definition]);

  // Pass 6 (build loop) — keyboard accessibility. The flashcard is
  // an interactive surface; treat it as a button so screen readers
  // and keyboard users can flip it. Space/Enter both flip.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setFlipped((f) => !f);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Definition revealed. ${definition}. Press space to flip back.`
            : `Flashcard term: ${term}. Press space or enter to reveal the definition.`
        }
        className={`min-h-[220px] cursor-pointer select-none transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          flipped ? "animate-card-flip-in" : ""
        }`}
        style={{ perspective: "600px" }}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={handleKeyDown}
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

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-400"
          onClick={onIncorrect}
          disabled={!flipped || disabled}
          aria-label="Mark this card as got it wrong"
        >
          <X className="h-4 w-4 mr-2" /> Got it wrong
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onCorrect}
          disabled={!flipped || disabled}
          aria-label="Mark this card as got it right"
        >
          <Check className="h-4 w-4 mr-2" /> Got it right
        </Button>
      </div>
      {!flipped && (
        <p className="text-[11px] text-muted-foreground text-center">
          Reveal the answer before scoring yourself.
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
  onNext,
  isLast,
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
  onNext: () => void;
  isLast: boolean;
  disabled?: boolean;
}) {
  // Pass 6 — keyboard shortcuts for the quiz: digits 1..6 select an
  // option, Enter submits or advances. Skips when focus is in a
  // text input so we don't hijack typing elsewhere on the page.
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      // Digit 1..options.length picks the option.
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < options.length && !revealed) {
          e.preventDefault();
          onSelect(idx);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!revealed && selected != null && !disabled) onSubmit();
        else if (revealed) onNext();
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [options.length, revealed, selected, disabled, onSelect, onSubmit, onNext]);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <Badge variant="outline">{difficulty}</Badge>
          <span
            className="text-[10px] text-muted-foreground hidden md:inline"
            aria-hidden
          >
            Press 1–{options.length} to choose · Enter to submit
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

        <div className="flex justify-end gap-2">
          {!revealed ? (
            <Button onClick={onSubmit} disabled={selected == null || disabled}>
              Submit answer
            </Button>
          ) : (
            <Button onClick={onNext}>
              {isLast ? "Finish" : "Next question"}
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
