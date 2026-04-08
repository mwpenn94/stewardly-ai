/**
 * EMBA Learning — Track Detail page (pass 58).
 *
 * Before this pass `/learning/tracks/:slug` was a stub route that
 * rendered LearningHome — meaning the 366+ definitions + chapters +
 * subsections + questions + flashcards we import from
 * `mwpenn94/emba_modules` had nowhere to be displayed.
 *
 * This page is the actual track reader. A learner can:
 *   1. See the track overview (tagline, category, description)
 *   2. Browse the chapter list + drill into a chapter to read its
 *      subsections (paragraphs rendered as prose)
 *   3. Jump to the flashcard study UI (/learning/tracks/:slug/study)
 *   4. Jump to the quiz runner (/learning/tracks/:slug/quiz)
 *
 * All data comes from the existing `learning.content.*` tRPC procedures
 * which in turn read from the DB tables populated by embaImport.ts.
 */

import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
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
import {
  BookOpen,
  Layers,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Play,
  Sparkles,
  FileText,
} from "lucide-react";

export default function LearningTrackDetail() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const trackQ = trpc.learning.content.getTrackBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );
  const chaptersQ = trpc.learning.content.listChapters.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );
  const questionsQ = trpc.learning.content.listQuestions.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );
  const flashcardsQ = trpc.learning.content.listFlashcards.useQuery(
    { trackId: trackQ.data?.id ?? 0 },
    { enabled: !!trackQ.data?.id },
  );

  const track = trackQ.data;
  const chapters = chaptersQ.data ?? [];
  const questions = questionsQ.data ?? [];
  const flashcards = flashcardsQ.data ?? [];

  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(
    null,
  );

  if (trackQ.isLoading) {
    return (
      <AppShell title="Track">
        <div className="p-6 text-sm text-muted-foreground">Loading track…</div>
      </AppShell>
    );
  }

  if (!track) {
    return (
      <AppShell title="Track not found">
        <div className="mx-auto max-w-3xl p-6 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/learning")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-medium">Track not found</p>
              <p className="text-sm text-muted-foreground">
                No exam track with slug <code>{slug}</code>. An admin can
                import content from{" "}
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
    <AppShell title={track.name ?? "Track"}>
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-3"
            onClick={() => navigate("/learning")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> All tracks
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="text-4xl">{track.emoji ?? "📘"}</div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {track.title ?? track.name}
                </h1>
                {track.subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {track.subtitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{track.category}</Badge>
                  <Badge variant="outline">{chapters.length} chapters</Badge>
                  <Badge variant="outline">
                    {flashcards.length} flashcards
                  </Badge>
                  <Badge variant="outline">
                    {questions.length} practice questions
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link href={`/learning/tracks/${track.slug}/study`}>
                <Button
                  size="sm"
                  disabled={flashcards.length === 0}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" /> Study flashcards
                </Button>
              </Link>
              <Link href={`/learning/tracks/${track.slug}/quiz`}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={questions.length === 0}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" /> Take quiz
                </Button>
              </Link>
            </div>
          </div>
          {track.description && (
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {track.description}
            </p>
          )}
        </div>

        {/* Chapters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Chapters
            </CardTitle>
            <CardDescription className="text-xs">
              Click a chapter to read its subsections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chaptersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : chapters.length === 0 ? (
              <EmptyChapters />
            ) : (
              <ul className="space-y-2">
                {chapters.map((ch: any) => (
                  <ChapterRow
                    key={ch.id}
                    chapter={ch}
                    expanded={expandedChapterId === ch.id}
                    onToggle={() =>
                      setExpandedChapterId(
                        expandedChapterId === ch.id ? null : ch.id,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Practice summary */}
        {(flashcards.length > 0 || questions.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {flashcards.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" /> Flashcards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{flashcards.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    terms to memorize
                  </p>
                  <Link href={`/learning/tracks/${track.slug}/study`}>
                    <Button size="sm" variant="link" className="px-0 mt-2">
                      Start reviewing →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HelpCircle className="h-4 w-4" /> Practice Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{questions.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    multiple-choice questions with explanations
                  </p>
                  <Link href={`/learning/tracks/${track.slug}/quiz`}>
                    <Button size="sm" variant="link" className="px-0 mt-2">
                      Start quiz →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Chapter row with lazy-loaded subsections ─────────────────────────────

function ChapterRow({
  chapter,
  expanded,
  onToggle,
}: {
  chapter: { id: number; title: string; intro?: string | null };
  expanded: boolean;
  onToggle: () => void;
}) {
  const subsQ = trpc.learning.content.listSubsections.useQuery(
    { chapterId: chapter.id },
    { enabled: expanded },
  );
  const subs = subsQ.data ?? [];

  return (
    <li className="border rounded-md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/40"
      >
        <div className="flex-1">
          <p className="text-sm font-medium">{chapter.title}</p>
          {chapter.intro && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {chapter.intro}
            </p>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t p-3 space-y-3">
          {chapter.intro && (
            <p className="text-sm text-muted-foreground italic">
              {chapter.intro}
            </p>
          )}
          {subsQ.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading subsections…
            </p>
          ) : subs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No subsections in this chapter.
            </p>
          ) : (
            <div className="space-y-4">
              {subs.map((s: any) => (
                <div key={s.id} className="space-y-1.5">
                  {s.title && (
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {s.title}
                    </h3>
                  )}
                  {Array.isArray(s.paragraphs) &&
                    s.paragraphs.map((p: string, i: number) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed text-muted-foreground"
                      >
                        {p}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyChapters() {
  return (
    <div className="text-center py-8 space-y-2">
      <BookOpen className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
      <p className="text-sm text-muted-foreground">
        No chapters yet for this track.
      </p>
      <p className="text-xs text-muted-foreground">
        Admins can import content from{" "}
        <Link href="/learning/studio">
          <a className="underline">Content Studio</a>
        </Link>{" "}
        (click "Import from GitHub").
      </p>
    </div>
  );
}
