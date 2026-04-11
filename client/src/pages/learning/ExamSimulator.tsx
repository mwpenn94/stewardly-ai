/**
 * ExamSimulator.tsx — Multi-mode exam simulation engine.
 *
 * Supports 4 modes:
 *   practice  — untimed, instant feedback per question
 *   timed     — countdown timer (pauses when tab is hidden)
 *   adaptive  — adjusts difficulty based on rolling accuracy
 *   audio     — reads questions aloud via AudioCompanion
 *
 * Results screen shows pass/fail, weak topics, per-question breakdown.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Clock,
  Flag,
  Volume2,
  Pause,
  Play,
  RotateCw,
  Trophy,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { useCelebration } from "@/lib/CelebrationEngine";

/* ── types ─────────────────────────────────────────────────────── */

export interface Question {
  id: string;
  text: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  moduleSlug: string;
  audioScript?: string;
}

export type ExamMode = "practice" | "timed" | "adaptive" | "audio";

export interface ExamConfig {
  mode: ExamMode;
  moduleSlug: string;
  moduleTitle: string;
  questionCount: number;
  timeLimitMinutes?: number;
}

export interface ExamResults {
  correct: number;
  total: number;
  percentage: number;
  timeSpentSeconds: number;
  perQuestion: {
    questionId: string;
    selectedKey: string;
    correct: boolean;
    timeSeconds: number;
  }[];
  weakTopics: string[];
}

interface ExamSimulatorProps {
  config?: ExamConfig;
  questionPool?: Question[];
  answerHistory?: Record<string, boolean>;
  onComplete?: (results: ExamResults) => void;
  onBack?: () => void;
}

/* ── helpers ───────────────────────────────────────────────────── */

const PASS_THRESHOLD = 70;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectAdaptiveQuestion(
  pool: Question[],
  answered: Set<string>,
  recentCorrect: boolean[],
): Question | null {
  const remaining = pool.filter((q) => !answered.has(q.id));
  if (remaining.length === 0) return null;

  const last5 = recentCorrect.slice(-5);
  const accuracy = last5.length > 0
    ? last5.filter(Boolean).length / last5.length
    : 0.5;

  let targetDifficulty: "easy" | "medium" | "hard";
  if (accuracy >= 0.8) targetDifficulty = "hard";
  else if (accuracy >= 0.5) targetDifficulty = "medium";
  else targetDifficulty = "easy";

  const matched = remaining.filter((q) => q.difficulty === targetDifficulty);
  const candidates = matched.length > 0 ? matched : remaining;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── component ─────────────────────────────────────────────────── */

const DEFAULT_CONFIG: ExamConfig = {
  mode: "practice",
  moduleSlug: "general",
  moduleTitle: "Practice Exam",
  questionCount: 10,
};

export default function ExamSimulator({
  config: configProp,
  questionPool: poolProp,
  answerHistory,
  onComplete,
  onBack,
}: ExamSimulatorProps) {
  const audio = useAudioCompanion();
  const celebrate = useCelebration();
  const [, navigate] = useLocation();
  const config = configProp ?? DEFAULT_CONFIG;
  const questionPool = poolProp ?? [];
  const handleBack = onBack ?? (() => navigate("/learning"));

  // Build the question list based on mode
  const questions = useMemo(() => {
    if (config.mode === "adaptive") {
      // Adaptive builds questions one at a time; we just need the pool
      return [];
    }
    // For non-adaptive modes, select and shuffle from pool
    let pool = [...questionPool];

    // If we have answer history, deprioritize previously correct questions
    if (answerHistory) {
      const incorrect = pool.filter((q) => answerHistory[q.id] === false);
      const unanswered = pool.filter((q) => answerHistory[q.id] === undefined);
      const correct = pool.filter((q) => answerHistory[q.id] === true);
      pool = [...shuffleArray(incorrect), ...shuffleArray(unanswered), ...shuffleArray(correct)];
    } else {
      pool = shuffleArray(pool);
    }

    return pool.slice(0, config.questionCount);
  }, [questionPool, config.questionCount, config.mode, answerHistory]);

  // Exam state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<
    { questionId: string; selectedKey: string; correct: boolean; timeSeconds: number }[]
  >([]);
  const [finished, setFinished] = useState(false);

  // Adaptive mode state
  const [adaptiveQuestions, setAdaptiveQuestions] = useState<Question[]>([]);
  const [adaptiveCorrectHistory, setAdaptiveCorrectHistory] = useState<boolean[]>([]);
  const [adaptiveAnswered, setAdaptiveAnswered] = useState<Set<string>>(new Set());

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdaptive = config.mode === "adaptive";
  const activeQuestions = isAdaptive ? adaptiveQuestions : questions;
  const currentQuestion = activeQuestions[currentIndex];
  const totalTarget = config.questionCount;
  const timeLimitSeconds = (config.timeLimitMinutes ?? 0) * 60;
  const isTimedMode = config.mode === "timed" && timeLimitSeconds > 0;
  const remainingTime = isTimedMode ? Math.max(0, timeLimitSeconds - elapsedSeconds) : 0;

  // Initialize adaptive mode's first question
  useEffect(() => {
    if (isAdaptive && adaptiveQuestions.length === 0 && questionPool.length > 0) {
      const first = selectAdaptiveQuestion(questionPool, new Set(), []);
      if (first) {
        setAdaptiveQuestions([first]);
        setAdaptiveAnswered(new Set([first.id]));
      }
    }
  }, [isAdaptive, questionPool, adaptiveQuestions.length]);

  // Timer with visibility API pause
  useEffect(() => {
    if (finished) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setTimerRunning(false);
      } else {
        setTimerRunning(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning, finished]);

  // Auto-submit when timed mode runs out
  useEffect(() => {
    if (isTimedMode && elapsedSeconds >= timeLimitSeconds && !finished) {
      finishExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, timeLimitSeconds, isTimedMode, finished]);

  // Audio mode: read question aloud when it changes
  useEffect(() => {
    if (config.mode === "audio" && currentQuestion && !revealed) {
      const script =
        currentQuestion.audioScript ??
        `${currentQuestion.text}. ${currentQuestion.options.map((o) => `${o.key}: ${o.text}`).join(". ")}`;
      audio.play({
        id: `exam-q-${currentQuestion.id}`,
        type: "quiz_question",
        title: `Question ${currentIndex + 1}`,
        script,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, config.mode, currentQuestion?.id]);

  // Keyboard shortcuts: 1-6/A-F to pick, Enter to submit/next, Esc back, F flag.
  useEffect(() => {
    if (finished || !currentQuestion) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFlag();
        return;
      }
      if (!revealed) {
        const digit = Number(e.key);
        if (Number.isFinite(digit) && digit >= 1 && digit <= currentQuestion.options.length) {
          e.preventDefault();
          setSelectedKey(currentQuestion.options[digit - 1].key);
          return;
        }
        const upper = e.key.toUpperCase();
        const letterIdx = upper.charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx < currentQuestion.options.length && upper !== e.key) {
          // Only intercept when the user actually typed a letter (not "1" → "A")
          e.preventDefault();
          setSelectedKey(currentQuestion.options[letterIdx].key);
          return;
        }
        // Match A/B/C/D exactly from the key field
        const byKey = currentQuestion.options.find(
          (o) => o.key.toUpperCase() === upper,
        );
        if (byKey) {
          e.preventDefault();
          setSelectedKey(byKey.key);
          return;
        }
        if (e.key === "Enter" && selectedKey) {
          e.preventDefault();
          submitAnswer();
        }
        return;
      }
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        advanceQuestion();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, revealed, selectedKey, finished]);

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }, [currentQuestion]);

  const submitAnswer = useCallback(() => {
    if (!selectedKey || !currentQuestion) return;
    const correct = selectedKey === currentQuestion.correctKey;
    const timeForQuestion = (Date.now() - questionStartTime) / 1000;

    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedKey,
        correct,
        timeSeconds: Math.round(timeForQuestion),
      },
    ]);

    if (isAdaptive) {
      setAdaptiveCorrectHistory((prev) => [...prev, correct]);
    }

    if (config.mode === "practice") {
      // Practice mode shows explanation inline
      setRevealed(true);
    } else {
      // Other modes advance immediately
      advanceQuestion(correct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, currentQuestion, questionStartTime, config.mode, isAdaptive]);

  const advanceQuestion = useCallback(
    (lastCorrect?: boolean) => {
      const nextIndex = currentIndex + 1;

      if (isAdaptive) {
        if (nextIndex >= totalTarget) {
          finishExam();
          return;
        }
        const history = lastCorrect !== undefined
          ? [...adaptiveCorrectHistory, lastCorrect]
          : adaptiveCorrectHistory;
        const next = selectAdaptiveQuestion(questionPool, adaptiveAnswered, history);
        if (!next) {
          finishExam();
          return;
        }
        setAdaptiveQuestions((prev) => [...prev, next]);
        setAdaptiveAnswered((prev) => { const s = new Set(Array.from(prev)); s.add(next.id); return s; });
      } else if (nextIndex >= activeQuestions.length) {
        finishExam();
        return;
      }

      setCurrentIndex(nextIndex);
      setSelectedKey(null);
      setRevealed(false);
      setQuestionStartTime(Date.now());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, isAdaptive, totalTarget, adaptiveCorrectHistory, adaptiveAnswered, questionPool, activeQuestions.length],
  );

  const finishExam = useCallback(() => {
    setFinished(true);
    setTimerRunning(false);

    const correctCount = answers.filter((a) => a.correct).length;

    // Calculate weak topics: topics where accuracy < 60%
    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const a of answers) {
      const q = [...questionPool].find((qq) => qq.id === a.questionId);
      if (!q) continue;
      if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
      topicStats[q.topic].total++;
      if (a.correct) topicStats[q.topic].correct++;
    }
    const weakTopics = Object.entries(topicStats)
      .filter(([, s]) => s.total > 0 && s.correct / s.total < 0.6)
      .map(([topic]) => topic);

    const total = answers.length;
    const results: ExamResults = {
      correct: answers.filter((a) => a.correct).length,
      total,
      percentage: total > 0 ? Math.round((answers.filter((a) => a.correct).length / total) * 100) : 0,
      timeSpentSeconds: elapsedSeconds,
      perQuestion: answers,
      weakTopics,
    };

    if (results.percentage >= PASS_THRESHOLD) {
      celebrate("medium");
    }

    onComplete?.(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, elapsedSeconds, questionPool, selectedKey, currentQuestion, revealed, onComplete, celebrate]);

  // Results screen
  if (finished) {
    const correctCount = answers.filter((a) => a.correct).length;
    const total = answers.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = pct >= PASS_THRESHOLD;

    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const a of answers) {
      const q = questionPool.find((qq) => qq.id === a.questionId);
      if (!q) continue;
      if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
      topicStats[q.topic].total++;
      if (a.correct) topicStats[q.topic].correct++;
    }

    const weakTopics = Object.entries(topicStats)
      .filter(([, s]) => s.total > 0 && s.correct / s.total < 0.6)
      .map(([topic, s]) => ({ topic, correct: s.correct, total: s.total }));

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <Card className="overflow-hidden">
          {passed && (
            <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
          )}
          <CardContent className="p-8 text-center space-y-5">
            <div
              className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                passed ? "bg-accent/15" : "bg-rose-500/15"
              }`}
            >
              {passed ? (
                <Trophy className="h-8 w-8 text-accent" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-heading font-semibold">
                {passed ? "Exam Passed" : "Keep Studying"}
              </p>
              <p className="text-sm text-muted-foreground">
                {correctCount} of {total} correct ({pct}%) &mdash; {formatTime(elapsedSeconds)} elapsed
              </p>
              <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto">
                {passed
                  ? "Excellent work. You demonstrated strong command of this material."
                  : `The passing threshold is ${PASS_THRESHOLD}%. Focus on the weak topics below and try again.`}
              </p>
            </div>

            <div className="w-full max-w-xs mx-auto">
              <Progress value={pct} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-accent">{PASS_THRESHOLD}% pass</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {weakTopics.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Weak topics
              </p>
              <ul className="space-y-2">
                {weakTopics.map(({ topic, correct: c, total: t }) => (
                  <li
                    key={topic}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{topic}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {c}/{t} ({Math.round((c / t) * 100)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm font-semibold">Question breakdown</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {answers.map((a, idx) => {
                const q = questionPool.find((qq) => qq.id === a.questionId);
                return (
                  <div
                    key={a.questionId}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-6 text-right text-muted-foreground tabular-nums">
                      {idx + 1}.
                    </span>
                    {a.correct ? (
                      <Check className="h-3 w-3 text-emerald-500 flex-none" />
                    ) : (
                      <X className="h-3 w-3 text-rose-500 flex-none" />
                    )}
                    <span className="truncate flex-1">
                      {q?.text ?? a.questionId}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {a.timeSeconds}s
                    </span>
                    {flagged.has(a.questionId) && (
                      <Flag className="h-3 w-3 text-amber-500 flex-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-center pb-8">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Exit
          </Button>
        </div>
      </motion.div>
    );
  }

  // No questions available
  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
            <p className="font-medium">No questions available</p>
            <p className="text-sm text-muted-foreground">
              The question pool is empty for this configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPct =
    totalTarget > 0 ? (currentIndex / totalTarget) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {config.mode}
          </Badge>
          {isTimedMode && (
            <Badge
              variant="outline"
              className={remainingTime < 60 ? "text-rose-600 border-rose-300" : ""}
            >
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(remainingTime)}
            </Badge>
          )}
          {!isTimedMode && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
          )}
          {!timerRunning && !finished && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <Pause className="h-3 w-3 mr-1" /> Paused
            </Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>
            Question {currentIndex + 1} of {totalTarget}
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} />
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                  <Badge variant="outline">{currentQuestion.topic}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {config.mode === "audio" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const script =
                          currentQuestion.audioScript ??
                          `${currentQuestion.text}. ${currentQuestion.options.map((o) => `${o.key}: ${o.text}`).join(". ")}`;
                        audio.play({
                          id: `exam-q-${currentQuestion.id}`,
                          type: "quiz_question",
                          title: `Question ${currentIndex + 1}`,
                          script,
                        });
                      }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFlag}
                    className={flagged.has(currentQuestion.id) ? "text-amber-500" : ""}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-base font-medium leading-relaxed">
                {currentQuestion.text}
              </p>

              <ul className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected = selectedKey === opt.key;
                  const isCorrect = opt.key === currentQuestion.correctKey;
                  const showCorrect = revealed && isCorrect;
                  const showWrong = revealed && isSelected && !isCorrect;

                  return (
                    <li key={opt.key}>
                      <button
                        type="button"
                        disabled={revealed}
                        onClick={() => setSelectedKey(opt.key)}
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
                            {opt.key}.
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {showCorrect && <Check className="h-4 w-4" />}
                          {showWrong && <X className="h-4 w-4" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {revealed && currentQuestion.explanation && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Explanation
                  </p>
                  <p className="text-sm leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    // Allow navigating back in non-adaptive modes if not yet answered
                    if (!isAdaptive && currentIndex > 0) {
                      setCurrentIndex((i) => i - 1);
                      setSelectedKey(null);
                      setRevealed(false);
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>

                <div className="flex gap-2">
                  {!revealed ? (
                    <Button onClick={submitAnswer} disabled={selectedKey === null}>
                      Submit
                    </Button>
                  ) : (
                    <Button onClick={() => advanceQuestion()}>
                      {currentIndex + 1 >= totalTarget ? (
                        <>
                          Finish <Trophy className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={finishExam}
                  className="text-muted-foreground"
                >
                  End exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Flagged questions indicator */}
      {flagged.size > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          <Flag className="h-3 w-3 inline mr-1 text-amber-500" />
          {flagged.size} question{flagged.size !== 1 ? "s" : ""} flagged for review
        </p>
      )}

      {/* Keyboard hint footer */}
      <p className="text-[11px] text-muted-foreground text-center">
        1–{currentQuestion.options.length} or A–{String.fromCharCode(64 + currentQuestion.options.length)} select
        {" · "}
        Enter submit/next · F flag · Esc back
      </p>
    </div>
  );
}
