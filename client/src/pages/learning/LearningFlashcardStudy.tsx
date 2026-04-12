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

import { useMemo, useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";
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
  Shuffle,
  ListOrdered,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { useCelebration } from "@/lib/CelebrationEngine";
import {
  buildStudyDeck,
  buildMasteryLookup,
  formatSessionLabel,
  type StudyMode,
} from "./lib/deckBuilder";
import { recordStudyNow } from "./lib/studyStreak";
import { sendFeedback } from "@/lib/feedbackSpecs";

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
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const recordReview = trpc.learning.mastery.recordReview.useMutation();
  const pil = usePlatformIntelligence();

  const track = trackQ.data;
  const rawCards = flashcardsQ.data ?? [];

  // ── Deck config (pass 3 — shuffle + session size + weakest-first) ──
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<StudyMode>("shuffle");
  const [limit, setLimit] = useState<number>(20);
  const [sessionSeed, setSessionSeed] = useState<string>(
    () => `fc-${Date.now()}`,
  );

  // Compose the deck pure-function-style so tests can lock in ordering.
  const cards = useMemo(() => {
    const masteryLookup = buildMasteryLookup(masteryQ.data ?? []);
    return buildStudyDeck(rawCards, {
      mode,
      limit,
      seed: sessionSeed,
      masteryLookup,
      itemKeyOf: (f: any) => `flashcard:${f.id}`,
    });
  }, [rawCards, mode, limit, sessionSeed, masteryQ.data]);

  // Session state
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [complete, setComplete] = useState(false);

  // Reset when the deck changes OR the user restarts.
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setComplete(false);
  }, [trackQ.data?.id, sessionSeed]);

  const current = cards[index];
  const total = cards.length;
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  const mark = async (correct: boolean) => {
    if (!current) return;
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

    // Pass 7 — streak-day tracker (idempotent per-day).
    recordStudyNow();

    // Pass 16 — PIL feedback dispatch (G1/G8).
    sendFeedback(correct ? "learning.answer_correct" : "learning.answer_incorrect");

    if (correct) setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);
    if (correct) {
      setCorrectCount((c) => c + 1);
      pil.giveFeedback("learning.answer_correct");
    } else {
      setIncorrectCount((c) => c + 1);
      pil.giveFeedback("learning.answer_incorrect");
    }

    if (index + 1 >= total) {
      setComplete(true);
      pil.giveFeedback("learning.exam_complete");
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  };

  const restart = () => {
    // Bump the seed so a fresh shuffle runs on restart.
    setSessionSeed(`fc-${Date.now()}`);
    setIndex(0);
    setFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setComplete(false);
    setStarted(true);
  };

  if (trackQ.isLoading || flashcardsQ.isLoading) {
    return (
      <AppShell title="Flashcards">
      <SEOHead title="Flashcards" description="Study flashcards with spaced repetition" />
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

  if (rawCards.length === 0) {
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

  // Pre-session configure card — lets the learner pick a deck size +
  // ordering mode before the runner starts. Hidden once started.
  if (!started) {
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
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">Start flashcard session</p>
                  <p className="text-xs text-muted-foreground">
                    {rawCards.length} cards available in this track
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Session size
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 20, 50, rawCards.length].map((n, i) => {
                      const isAll = i === 3;
                      const label = isAll ? "All" : String(n);
                      const val = isAll ? rawCards.length : Math.min(n, rawCards.length);
                      const active = limit === val;
                      // Skip duplicates (e.g. if track has only 7 cards)
                      if (!isAll && n > rawCards.length) return null;
                      return (
                        <Button
                          key={`${label}-${val}`}
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLimit(val)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Order
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={mode === "shuffle" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode("shuffle")}
                      className="h-auto py-2 flex flex-col items-center gap-1"
                    >
                      <Shuffle className="h-4 w-4" />
                      <span className="text-xs">Shuffle</span>
                    </Button>
                    <Button
                      variant={mode === "weakest" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode("weakest")}
                      className="h-auto py-2 flex flex-col items-center gap-1"
                      disabled={!(masteryQ.data && masteryQ.data.length > 0)}
                      title={
                        masteryQ.data && masteryQ.data.length > 0
                          ? "Lowest-confidence items first"
                          : "Needs prior study history"
                      }
                    >
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-xs">Weakest</span>
                    </Button>
                    <Button
                      variant={mode === "sequential" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode("sequential")}
                      className="h-auto py-2 flex flex-col items-center gap-1"
                    >
                      <ListOrdered className="h-4 w-4" />
                      <span className="text-xs">In order</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-2 text-xs text-muted-foreground text-center">
                  {formatSessionLabel(rawCards.length, limit, mode)}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setStarted(true)}
                disabled={total === 0}
              >
                Start studying
              </Button>
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
            onRestart={restart}
            trackSlug={track.slug}
          />
        ) : (
          current && (
            <div className="space-y-4">
              <Card
                role="button"
                tabIndex={0}
                aria-pressed={flipped}
                aria-label={
                  flipped
                    ? `Definition revealed. ${current.definition}. Press space to flip back.`
                    : `Flashcard term: ${current.term}. Press space or enter to reveal the definition.`
                }
                className={`min-h-[220px] cursor-pointer select-none transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${flipped ? "animate-card-flip-in" : ""}`}
                style={{ perspective: "600px" }}
                onClick={() => { setFlipped((f) => !f); sendFeedback("learning.flashcard_flip"); }}
                onClick={() => { setFlipped((f) => !f); pil.giveFeedback("learning.flashcard_flip"); }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setFlipped((f) => !f);
                    sendFeedback("learning.flashcard_flip");
                  }
                }}
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
                  onClick={() => mark(false)}
                  disabled={!flipped || recordReview.isPending}
                  aria-label="Mark this card as got it wrong"
                >
                  <X className="h-4 w-4 mr-2" /> Got it wrong
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => mark(true)}
                  disabled={!flipped || recordReview.isPending}
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
          )
        )}
      </div>
    </AppShell>
  );
}

function CompletionCard({
  correct,
  incorrect,
  onRestart,
  trackSlug,
}: {
  correct: number;
  incorrect: number;
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
