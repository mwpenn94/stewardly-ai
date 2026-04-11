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
  Trophy,
  HelpCircle,
  Flame,
} from "lucide-react";
import { useCelebration } from "@/lib/CelebrationEngine";
import { toast } from "sonner";

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
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const track = trackQ.data;
  const questions = questionsQ.data ?? [];

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setComplete(false);
  }, [trackQ.data?.id]);

  const current = questions[index];
  const total = questions.length;
  const progress = total > 0 ? ((index + (complete ? 1 : 0)) / total) * 100 : 0;

  const submit = useCallback(() => {
    if (selected == null || !current) return;
    setRevealed(true);
    const correct = selected === current.correctIndex;
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

    recordReview
      .mutateAsync({
        itemKey: `question:${current.id}`,
        itemType: "question",
        correct,
      })
      .catch((err) => {
        toast.error(`Review not saved: ${err.message ?? "network error"}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current]);

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setComplete(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }, [index, total]);

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setComplete(false);
  };

  // Keyboard shortcuts: 1-6 select, Enter submit/advance, Esc exit.
  useEffect(() => {
    if (complete || !current) return;
    const options: string[] = Array.isArray(current?.options)
      ? (current.options as string[])
      : [];
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
      if (!revealed) {
        const digit = Number(e.key);
        if (Number.isFinite(digit) && digit >= 1 && digit <= options.length) {
          e.preventDefault();
          setSelected(digit - 1);
          return;
        }
        if (e.key === "Enter" && selected != null) {
          e.preventDefault();
          submit();
        }
        return;
      }
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [complete, current, revealed, selected, submit, next, navigate, slug]);

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

  if (total === 0) {
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
            bestStreak={bestStreak}
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
                      <span className="ml-1 text-[10px] opacity-70">(⏎)</span>
                    </Button>
                  ) : (
                    <Button onClick={next}>
                      {index + 1 >= total ? "Finish" : "Next question"}
                      <span className="ml-1 text-[10px] opacity-70">(⏎)</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        )}
        {!complete && (
          <p className="text-[11px] text-muted-foreground text-center">
            1–{Math.max(4, Array.isArray(current?.options) ? (current!.options as string[]).length : 4)} select
            · Enter submit/next · Esc exit
          </p>
        )}
      </div>
    </AppShell>
  );
}

function CompletionCard({
  correct,
  total,
  bestStreak,
  onRestart,
  trackSlug,
}: {
  correct: number;
  total: number;
  bestStreak: number;
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
