/**
 * EMBA Learning — Flashcard Study page (pass 58).
 *
 * Renders the flashcard deck for a given track and wires "Correct" /
 * "Incorrect" responses into the existing SRS scheduler:
 *   `learning.mastery.recordReview({ itemKey, itemType: "flashcard", correct })`
 *
 * That endpoint calls `upsertMastery` which uses the pure
 * `scheduleNextReview` helper (tested in mastery.test.ts) — so every
 * review actually moves the learner's confidence forward on the 0-5
 * ladder and updates the "due now" count on the Learning Home.
 *
 * Before this pass the flashcards imported from mwpenn94/emba_modules
 * had no consumer UI. Admins could click "Import from GitHub" but
 * learners could never see the cards.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
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
  Sparkles,
  Trophy,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { useCelebration } from "@/lib/CelebrationEngine";
import { recordStudyEvent } from "@/lib/dailyStreak";
import { KeyboardHelpOverlay } from "@/components/learning/KeyboardHelpOverlay";

const FLASHCARD_SHORTCUTS = [
  { keys: "Space", label: "Flip the card", group: "Flashcard" },
  { keys: "1  /  W", label: "Mark wrong", group: "Flashcard" },
  { keys: "2  /  R", label: "Mark right", group: "Flashcard" },
  { keys: "Esc", label: "Exit to track", group: "Navigation" },
  { keys: "?", label: "Toggle this help", group: "Navigation" },
];

export default function LearningFlashcardStudy() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const trackQ = trpc.learning.content.getTrackBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );
  const flashcardsQ = trpc.learning.content.listFlashcards.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const track = trackQ.data;
  const cards = flashcardsQ.data ?? [];

  // Session state
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [complete, setComplete] = useState(false);

  // Reset when the deck changes.
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setComplete(false);
  }, [trackQ.data?.id]);

  const current = cards[index];
  const total = cards.length;
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  const mark = useCallback(
    (correct: boolean) => {
      if (!current) return;
      // Bump the persistent daily streak — this is per-device and
      // survives across sessions, separate from the in-session
      // streak counter above. Idempotent same-day, so calling it on
      // every card is safe.
      recordStudyEvent();
      // Fire-and-forget SRS update — if it fails we still advance, but we
      // surface the error via toast so learners know their progress may
      // not have been saved (e.g. DB unavailable).
      recordReview
        .mutateAsync({
          itemKey: `flashcard:${current.id}`,
          itemType: "flashcard",
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

      if (index + 1 >= total) {
        setComplete(true);
      } else {
        setIndex((i) => i + 1);
        setFlipped(false);
      }
    },
    // recordReview mutation identity is stable within a session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, index, total],
  );

  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setComplete(false);
  };

  // Keyboard shortcuts: Space to flip, 1/W wrong, 2/R right, Esc to exit.
  useEffect(() => {
    if (complete || !current) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        navigate(`/learning/tracks/${slug}`);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (!flipped) return;
      if (e.key === "1" || e.key.toLowerCase() === "w") {
        e.preventDefault();
        mark(false);
      } else if (e.key === "2" || e.key.toLowerCase() === "r") {
        e.preventDefault();
        mark(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [complete, current, flipped, mark, navigate, slug]);

  if (trackQ.isLoading || flashcardsQ.isLoading) {
    return (
      <AppShell title="Flashcards">
        <div className="p-6 text-sm text-muted-foreground">Loading deck…</div>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell title="Flashcards">
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/learning")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Track not found.
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (total === 0) {
    return (
      <AppShell title={`${track.name} · Flashcards`}>
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/learning/tracks/${track.slug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to {track.name}
          </Button>
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="font-medium">No flashcards yet</p>
              <p className="text-sm text-muted-foreground">
                Admins can import flashcards from{" "}
                <Link href="/learning/studio">
                  <a className="underline">Content Studio</a>
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`${track.name} · Flashcards`}>
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/learning/tracks/${track.slug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to {track.name}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {streak >= 3 && (
              <Badge
                variant="outline"
                className="text-accent border-accent/50 animate-pulse"
                aria-label={`Streak: ${streak} in a row`}
              >
                <Flame className="h-3 w-3 mr-1" /> {streak}
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

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              Card {Math.min(index + 1, total)} of {total}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {complete ? (
          <CompletionCard
            correct={correctCount}
            incorrect={incorrectCount}
            bestStreak={bestStreak}
            onRestart={restart}
            trackSlug={track.slug}
          />
        ) : (
          current && (
            <div className="space-y-4">
              <Card
                className={`min-h-[220px] cursor-pointer select-none transition-transform duration-200 ${flipped ? "animate-card-flip-in" : ""}`}
                style={{ perspective: "600px" }}
                onClick={() => setFlipped((f) => !f)}
              >
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[220px] text-center">
                  {flipped ? (
                    <>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Definition
                      </p>
                      <p className="text-base leading-relaxed">
                        {current.definition}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Term
                      </p>
                      <p className="text-xl font-semibold">{current.term}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Click the card to reveal
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-400"
                  onClick={() => mark(false)}
                  disabled={!flipped || recordReview.isPending}
                >
                  <X className="h-4 w-4 mr-2" /> Got it wrong
                  <span className="ml-1 text-[10px] opacity-70">(1)</span>
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => mark(true)}
                  disabled={!flipped || recordReview.isPending}
                >
                  <Check className="h-4 w-4 mr-2" /> Got it right
                  <span className="ml-1 text-[10px] opacity-70">(2)</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                {flipped
                  ? "Space to flip · 1 wrong · 2 right · Esc to exit"
                  : "Reveal the answer before scoring yourself (Space)"}
              </p>
            </div>
          )
        )}
      </div>
      <KeyboardHelpOverlay shortcuts={FLASHCARD_SHORTCUTS} title="Flashcard shortcuts" />
    </AppShell>
  );
}

function CompletionCard({
  correct,
  incorrect,
  bestStreak,
  onRestart,
  trackSlug,
}: {
  correct: number;
  incorrect: number;
  bestStreak: number;
  onRestart: () => void;
  trackSlug: string;
}) {
  const celebrate = useCelebration();
  const total = correct + incorrect;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const isGreat = pct >= 80;
  const isGood = pct >= 60;

  useEffect(() => {
    if (isGreat) celebrate(pct === 100 ? "heavy" : "medium");
  }, [isGreat, pct, celebrate]);

  const getMessage = () => {
    if (pct === 100) return "Perfect session! Every single one correct.";
    if (isGreat) return "Excellent work — you're building real mastery here.";
    if (isGood) return "Solid progress. The ones you missed will come back for review.";
    return "Every session makes you stronger. The spaced repetition system will help these stick.";
  };

  return (
    <Card className="overflow-hidden">
      {/* Warm gold celebration glow for great scores */}
      {isGreat && (
        <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
      )}
      <CardContent className="p-8 text-center space-y-5">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
          isGreat ? "bg-accent/15" : isGood ? "bg-emerald-500/15" : "bg-muted"
        }`} style={{ animation: "page-enter 0.5s ease-out" }}>
          <Trophy className={`h-8 w-8 ${
            isGreat ? "text-accent" : isGood ? "text-emerald-500" : "text-muted-foreground"
          }`} />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold">
            {pct === 100 ? "Flawless!" : isGreat ? "Great session!" : "Session complete"}
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
          <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto">
            {getMessage()}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={onRestart} variant="outline">
            <RotateCw className="h-4 w-4 mr-2" /> Study again
          </Button>
          <Link href={`/learning/tracks/${trackSlug}`}>
            <Button>Back to track</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
