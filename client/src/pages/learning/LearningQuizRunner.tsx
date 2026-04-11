/**
 * EMBA Learning — Quiz Runner page (pass 58).
 *
 * Renders practice questions for a track as a multiple-choice quiz.
 * Each answer is marked through the SRS via
 * `learning.mastery.recordReview({ itemKey, itemType: "question", correct })`
 * so that repeated quizzing actually moves confidence on the 0-5 ladder
 * used by the Learning Home "due now" counter.
 *
 * Before this pass `/learning/quiz` was a stub route pointing at
 * LearningHome — none of the practice questions imported from
 * mwpenn94/emba_modules could actually be answered.
 */

import { useEffect, useMemo, useState } from "react";
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
  Trophy,
  HelpCircle,
  Shuffle,
  ListOrdered,
  TrendingDown,
} from "lucide-react";
import { useCelebration } from "@/lib/CelebrationEngine";
import { toast } from "sonner";
import {
  buildStudyDeck,
  buildMasteryLookup,
  formatSessionLabel,
  type StudyMode,
} from "./lib/deckBuilder";

export default function LearningQuizRunner() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const trackQ = trpc.learning.content.getTrackBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );
  const questionsQ = trpc.learning.content.listQuestions.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const track = trackQ.data;
  const rawQuestions = questionsQ.data ?? [];

  // ── Session config (pass 3 — shuffle + size + weakest first) ──
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<StudyMode>("shuffle");
  const [limit, setLimit] = useState<number>(20);
  const [sessionSeed, setSessionSeed] = useState<string>(
    () => `q-${Date.now()}`,
  );

  const questions = useMemo(() => {
    const lookup = buildMasteryLookup(masteryQ.data ?? []);
    return buildStudyDeck(rawQuestions, {
      mode,
      limit,
      seed: sessionSeed,
      masteryLookup: lookup,
      itemKeyOf: (q: any) => `question:${q.id}`,
    });
  }, [rawQuestions, mode, limit, sessionSeed, masteryQ.data]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setComplete(false);
  }, [trackQ.data?.id, sessionSeed]);

  const current = questions[index];
  const total = questions.length;
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  const submit = async () => {
    if (selected == null || !current) return;
    setRevealed(true);
    const correct = selected === current.correctIndex;
    if (correct) setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);

    recordReview
      .mutateAsync({
        itemKey: `question:${current.id}`,
        itemType: "question",
        correct,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
  };

  const next = () => {
    if (index + 1 >= total) {
      setComplete(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  };

  const restart = () => {
    setSessionSeed(`q-${Date.now()}`);
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setComplete(false);
    setStarted(true);
  };

  if (trackQ.isLoading || questionsQ.isLoading) {
    return (
      <AppShell title="Quiz">
        <div className="p-6 text-sm text-muted-foreground">Loading quiz…</div>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell title="Quiz">
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

  if (rawQuestions.length === 0) {
    return (
      <AppShell title={`${track.name} · Quiz`}>
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
              <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="font-medium">No practice questions yet</p>
              <p className="text-sm text-muted-foreground">
                Admins can import questions from{" "}
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

  // Pre-session configure card (pass 3) — pick deck size + ordering.
  if (!started) {
    return (
      <AppShell title={`${track.name} · Quiz`}>
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
                  <HelpCircle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">Start practice quiz</p>
                  <p className="text-xs text-muted-foreground">
                    {rawQuestions.length} questions available in this track
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Quiz length
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 20, 50, rawQuestions.length].map((n, i) => {
                      const isAll = i === 3;
                      const label = isAll ? "All" : String(n);
                      const val = isAll
                        ? rawQuestions.length
                        : Math.min(n, rawQuestions.length);
                      const active = limit === val;
                      if (!isAll && n > rawQuestions.length) return null;
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
                    Question order
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
                          ? "Lowest-confidence questions first"
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
                  {formatSessionLabel(rawQuestions.length, limit, mode)}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setStarted(true)}
                disabled={total === 0}
              >
                Start quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const options: string[] = Array.isArray(current?.options)
    ? (current.options as string[])
    : [];

  return (
    <AppShell title={`${track.name} · Quiz`}>
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
              Question {Math.min(index + 1, total)} of {total}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {complete ? (
          <CompletionCard
            correct={correctCount}
            total={total}
            onRestart={restart}
            trackSlug={track.slug}
          />
        ) : (
          current && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{current.difficulty}</Badge>
                </div>
                <p className="text-base font-medium leading-relaxed">
                  {current.prompt}
                </p>

                <ul className="space-y-2">
                  {options.map((opt, i) => {
                    const isSelected = selected === i;
                    const isCorrect = i === current.correctIndex;
                    const showCorrect = revealed && isCorrect;
                    const showWrong = revealed && isSelected && !isCorrect;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          disabled={revealed}
                          onClick={() => setSelected(i)}
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

                {revealed && current.explanation && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Explanation
                    </p>
                    <p className="text-sm leading-relaxed">
                      {current.explanation}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {!revealed ? (
                    <Button
                      onClick={submit}
                      disabled={selected == null || recordReview.isPending}
                    >
                      Submit answer
                    </Button>
                  ) : (
                    <Button onClick={next}>
                      {index + 1 >= total ? "Finish" : "Next question"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </AppShell>
  );
}

function CompletionCard({
  correct,
  total,
  onRestart,
  trackSlug,
}: {
  correct: number;
  total: number;
  onRestart: () => void;
  trackSlug: string;
}) {
  const celebrate = useCelebration();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const isGreat = pct >= 80;
  const isGood = pct >= 60;

  useEffect(() => {
    if (isGreat) celebrate(pct === 100 ? "heavy" : "medium");
  }, [isGreat, pct, celebrate]);

  const getMessage = () => {
    if (pct === 100) return "Perfect score! You've mastered this material.";
    if (isGreat) return "Excellent — you clearly know this well. Keep building on it.";
    if (isGood) return "Good foundation. Review the ones you missed and try again when ready.";
    return "Learning takes repetition. Each attempt strengthens your understanding.";
  };

  return (
    <Card className="overflow-hidden">
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
            {pct === 100 ? "Flawless!" : isGreat ? "Great quiz!" : "Quiz complete"}
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
            <RotateCw className="h-4 w-4 mr-2" /> Try again
          </Button>
          <Link href={`/learning/tracks/${trackSlug}`}>
            <Button>Back to track</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
