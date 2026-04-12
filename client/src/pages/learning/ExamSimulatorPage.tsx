/**
 * ExamSimulatorPage — Route wrapper that fetches real questions from the
 * database and passes them to the ExamSimulator component.
 *
 * Route: /learning/exam/:moduleSlug
 *
 * Resolves moduleSlug → trackId via getTrackBySlug, then fetches
 * questions via listQuestions, transforms them into the ExamSimulator's
 * Question[] format, and renders the exam.
 */

import { useMemo } from "react";
import { useParams, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Loader2, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ExamSimulator, { type ExamConfig } from "./ExamSimulator";
import { transformDbQuestions } from "@/components/wealth-engine/calculatorHelpers";

export default function ExamSimulatorPage() {
  const params = useParams<{ moduleSlug: string }>();
  const [, navigate] = useLocation();
  const slug = params.moduleSlug ?? "general";

  // 1. Resolve slug → track
  const { data: track, isLoading: trackLoading } = trpc.learning.content.getTrackBySlug.useQuery(
    { slug },
    { retry: false },
  );

  // 2. Fetch questions for this track
  const trackId = track?.id;
  const { data: rawQuestions, isLoading: questionsLoading } = trpc.learning.content.listQuestions.useQuery(
    { trackId: trackId! },
    { enabled: !!trackId, retry: false },
  );

  // 3. Transform database questions into ExamSimulator format
  const questionPool = useMemo(
    () => transformDbQuestions(rawQuestions ?? [], slug, track?.name),
    [rawQuestions, slug, track?.name],
  );

  // Config for the exam
  const config = useMemo<ExamConfig>(() => ({
    mode: "practice",
    moduleSlug: slug,
    moduleTitle: track?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    questionCount: Math.min(questionPool.length, 25),
  }), [slug, track?.name, questionPool.length]);

  const isLoading = trackLoading || questionsLoading;

  if (isLoading) {
    return (
      <AppShell title="Exam Simulator">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell title="Exam Simulator">
        <div className="max-w-lg mx-auto p-6 space-y-4">
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Track &ldquo;{slug}&rdquo; not found. Make sure learning content has been imported.
              </p>
              <Button variant="outline" onClick={() => navigate("/learning")}>
                Back to Learning
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (questionPool.length === 0) {
    return (
      <AppShell title="Exam Simulator">
        <div className="max-w-lg mx-auto p-6 space-y-4">
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">No practice questions available</p>
              <p className="text-sm text-muted-foreground">
                The &ldquo;{track.name}&rdquo; track doesn&rsquo;t have published practice questions yet.
                Import content from GitHub or create questions in Content Studio.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate("/learning")}>
                  Back to Learning
                </Button>
                <Button variant="outline" onClick={() => navigate("/learning/studio")}>
                  Content Studio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <ExamSimulator
      config={config}
      questionPool={questionPool}
      onBack={() => navigate("/learning")}
    />
  );
}
