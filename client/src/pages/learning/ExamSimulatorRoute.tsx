/**
 * EMBA Learning — ExamSimulator route wrapper (Pass 1 — learning experience).
 *
 * Before this wrapper existed, `/learning/exam/:moduleSlug` mounted
 * `<ExamSimulator />` with NO props — meaning the question pool was
 * always empty and the simulator rendered its "No questions available"
 * empty state for every user who clicked the Practice Exam tile on the
 * Learning Home.
 *
 * This wrapper resolves the URL slug into a real track via
 * `learning.content.getTrackBySlug`, fetches the track's practice
 * questions via `learning.content.listQuestions`, converts them into
 * the `Question` shape ExamSimulator expects, and renders a mode
 * picker (practice / timed / adaptive) before mounting the simulator
 * with real data.
 *
 * Results from the simulator are fed back into the SRS via
 * `learning.mastery.recordReview` so repeated exam practice moves the
 * learner's 0-5 confidence ladder forward for each question.
 */

import { useMemo, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Sparkles, Volume2, BookOpen } from "lucide-react";
import ExamSimulator, { type ExamConfig, type ExamResults, type Question, type ExamMode } from "./ExamSimulator";
import { toast } from "sonner";

/** Convert a learning_practice_questions row into the shape ExamSimulator wants. */
function toExamQuestion(
  row: {
    id: number;
    prompt: string;
    options: unknown;
    correctIndex: number | null;
    explanation: string | null;
    difficulty: "easy" | "medium" | "hard";
    tags: unknown;
  },
  moduleSlug: string,
): Question | null {
  const options: string[] = Array.isArray(row.options) ? (row.options as string[]) : [];
  if (options.length < 2) return null;
  const idx = row.correctIndex ?? 0;
  if (idx < 0 || idx >= options.length) return null;

  const tags: string[] = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  const topic = tags[0] ?? "General";
  const keyFor = (i: number) => String.fromCharCode(65 + i); // "A", "B", ...

  return {
    id: `q${row.id}`,
    text: row.prompt,
    options: options.map((text, i) => ({ key: keyFor(i), text })),
    correctKey: keyFor(idx),
    explanation: row.explanation ?? "",
    topic,
    difficulty: row.difficulty,
    moduleSlug,
    audioScript: `${row.prompt}. ${options.map((o, i) => `${keyFor(i)}: ${o}`).join(". ")}`,
  };
}

// ─── Mode picker helpers ─────────────────────────────────────────────────

const MODES: { mode: ExamMode; label: string; icon: React.ReactNode; desc: string; timeLimit?: number }[] = [
  {
    mode: "practice",
    label: "Practice",
    icon: <BookOpen className="h-4 w-4" />,
    desc: "Untimed. Explanations revealed after each answer.",
  },
  {
    mode: "timed",
    label: "Timed",
    icon: <Clock className="h-4 w-4" />,
    desc: "60-minute countdown. Auto-submits on expiry.",
    timeLimit: 60,
  },
  {
    mode: "adaptive",
    label: "Adaptive",
    icon: <Sparkles className="h-4 w-4" />,
    desc: "Adjusts difficulty based on rolling accuracy.",
  },
  {
    mode: "audio",
    label: "Audio",
    icon: <Volume2 className="h-4 w-4" />,
    desc: "Reads each question aloud via AudioCompanion.",
  },
];

export default function ExamSimulatorRoute() {
  const params = useParams<{ moduleSlug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.moduleSlug ?? "";

  const trackQ = trpc.learning.content.getTrackBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );
  const questionsQ = trpc.learning.content.listQuestions.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const [mode, setMode] = useState<ExamMode | null>(null);
  const [questionCount, setQuestionCount] = useState(10);

  const questionPool: Question[] = useMemo(() => {
    const rows = (questionsQ.data ?? []) as Array<Parameters<typeof toExamQuestion>[0]>;
    return rows
      .map((row) => toExamQuestion(row, slug))
      .filter((q): q is Question => q !== null);
  }, [questionsQ.data, slug]);

  const track = trackQ.data;

  if (trackQ.isLoading) {
    return (
      <AppShell title="Exam">
        <div className="p-6 text-sm text-muted-foreground">Loading exam…</div>
      </AppShell>
    );
  }

  // Pass 7 adversarial fix: if the track query errored, surface the
  // failure instead of rendering "Exam not found" (which would imply
  // the track was deleted). A DB error and a missing row look the
  // same to the caller without this branch.
  if (trackQ.isError) {
    return (
      <AppShell title="Exam">
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="font-medium">Couldn&rsquo;t load the exam</p>
              <p className="text-sm text-muted-foreground">
                {trackQ.error?.message ?? "The server returned an error."}
              </p>
              <Button onClick={() => trackQ.refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell title="Exam not found">
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <p className="font-medium">Exam not found</p>
              <p className="text-sm text-muted-foreground">
                No track with slug <code>{slug}</code>.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Empty pool — admin needs to import questions
  if (!questionsQ.isLoading && questionPool.length === 0) {
    return (
      <AppShell title={`${track.name} · Exam`}>
        <div className="mx-auto max-w-2xl p-6 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/learning/tracks/${slug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to {track.name}
          </Button>
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="font-medium">No practice questions yet</p>
              <p className="text-sm text-muted-foreground">
                An admin can import questions for this track from{" "}
                <Link href="/learning/studio">
                  <a className="underline">Content Studio</a>
                </Link>
                . Once imported, the exam will be available here.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Mode picker: not yet selected
  if (!mode) {
    const maxQ = Math.min(50, questionPool.length);
    const suggested = Math.min(10, maxQ);
    return (
      <AppShell title={`${track.name} · Exam`}>
        <div className="mx-auto max-w-3xl p-6 space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/learning/tracks/${slug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to {track.name}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {track.emoji ?? "📝"} Practice Exam
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {questionPool.length} question{questionPool.length === 1 ? "" : "s"} available · 70% passing threshold
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {MODES.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => {
                      setMode(m.mode);
                      if (questionCount === 10) {
                        setQuestionCount(Math.min(suggested, maxQ));
                      }
                    }}
                    className="group flex flex-col items-start gap-1 p-4 rounded-md border text-left hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{m.icon}</span>
                      <span className="font-semibold">{m.label}</span>
                      {m.timeLimit && (
                        <Badge variant="outline" className="text-[10px]">
                          {m.timeLimit}m
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t">
                <label className="text-xs text-muted-foreground">
                  Questions in this exam: {questionCount}
                </label>
                <input
                  type="range"
                  min={5}
                  max={maxQ}
                  step={1}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-primary"
                  aria-label="Number of questions"
                />
                <p className="text-[11px] text-muted-foreground">
                  The simulator will pick {questionCount} question{questionCount === 1 ? "" : "s"}
                  {questionPool.length > questionCount
                    ? ` from the pool of ${questionPool.length}`
                    : ""}
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Build final config + render the simulator
  const selectedMode = MODES.find((m) => m.mode === mode)!;
  const config: ExamConfig = {
    mode,
    moduleSlug: slug,
    moduleTitle: track.name,
    questionCount: Math.min(questionCount, questionPool.length),
    timeLimitMinutes: selectedMode.timeLimit,
  };

  const handleComplete = (results: ExamResults) => {
    // Persist every answered question back into the SRS. Fire-and-forget per
    // item with a single aggregate toast on failure so the user isn't
    // bombarded with N individual error messages on a network hiccup.
    let failed = 0;
    for (const a of results.perQuestion) {
      const rawId = a.questionId.replace(/^q/, "");
      const numericId = Number(rawId);
      if (!Number.isFinite(numericId)) continue;
      recordReview
        .mutateAsync({
          itemKey: `question:${numericId}`,
          itemType: "question",
          correct: a.correct,
        })
        .catch(() => {
          failed += 1;
        });
    }
    if (failed > 0) {
      toast.error(`${failed} answer${failed === 1 ? "" : "s"} not saved to SRS`);
    }
  };

  return (
    <AppShell title={`${track.name} · Exam`}>
      <div className="mx-auto max-w-3xl p-6">
        <ExamSimulator
          config={config}
          questionPool={questionPool}
          onBack={() => setMode(null)}
          onComplete={handleComplete}
        />
      </div>
    </AppShell>
  );
}
