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

import { useEffect, useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Layers,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Play,
  Sparkles,
  FileText,
  Check,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  getTrackReadState,
  recordChapterRead,
  isChapterRead,
  chaptersReadCount,
  lastReadChapter,
  trackProgressPct,
} from "@/lib/trackReadState";
import { useAudioCompanion } from "@/components/AudioCompanion";

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

  // Load per-device read state ONCE per mount so the list + cursor don't
  // thrash every render. We intentionally do NOT re-pull localStorage on
  // every chapter toggle — the `markChapterRead` call writes through, so
  // the derived counts + `readSet` below stay in sync with what's on disk.
  const [readState, setReadState] = useState(() => getTrackReadState());
  const trackKey = track?.id ?? track?.slug ?? "";

  const readSet = useMemo(() => {
    if (!trackKey) return new Set<number>();
    const entry = readState[String(trackKey)];
    return new Set<number>(entry?.chapterIds ?? []);
  }, [readState, trackKey]);
  const readCount = trackKey ? chaptersReadCount(readState, trackKey) : 0;
  const totalChapters = chapters.length;
  const progressPct = trackKey ? trackProgressPct(readState, trackKey, totalChapters) : 0;
  const lastRead = trackKey ? lastReadChapter(readState, trackKey) : null;

  // Expand the most-recently-read chapter on mount (Resume where you
  // left off). Falls back to the first chapter when there's no cursor
  // so first-time visitors still see a chapter open.
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (expandedChapterId != null) return;
    if (chapters.length === 0) return;
    // Guard against a stale cursor. If the last-read chapter id was
    // deleted (e.g. embaImport re-ran and regenerated chapter rows),
    // fall back to the first chapter instead of setting a dead id.
    const lastReadIsLive =
      lastRead != null && chapters.some((c: any) => c.id === lastRead);
    const target = lastReadIsLive ? lastRead : chapters[0]?.id ?? null;
    if (target != null) setExpandedChapterId(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters.length, lastRead]);

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

          {/* Read-progress bar — only renders once chapters are loaded AND
              at least one chapter has been read. First-time visitors see a
              clean header without a visually empty 0% bar. */}
          {totalChapters > 0 && readCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-500" />
                  {readCount} of {totalChapters} chapter{totalChapters === 1 ? "" : "s"} read
                </span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>
          )}
        </div>

        {/* Chapters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Chapters
            </CardTitle>
            <CardDescription className="text-xs">
              {lastRead != null && readCount > 0 ? (
                <>
                  <span className="text-accent">Resumed</span> at your last read
                  chapter. Click any other chapter to jump.
                </>
              ) : (
                "Click a chapter to read its subsections."
              )}
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
                    read={readSet.has(ch.id)}
                    onToggle={() => {
                      const willOpen = expandedChapterId !== ch.id;
                      setExpandedChapterId(willOpen ? ch.id : null);
                      if (willOpen && trackKey) {
                        recordChapterRead(trackKey, ch.id);
                        setReadState(getTrackReadState());
                      }
                    }}
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
  read,
  onToggle,
}: {
  chapter: { id: number; title: string; intro?: string | null };
  expanded: boolean;
  read: boolean;
  onToggle: () => void;
}) {
  const subsQ = trpc.learning.content.listSubsections.useQuery(
    { chapterId: chapter.id },
    { enabled: expanded },
  );
  const subs = subsQ.data ?? [];

  return (
    <li className={`border rounded-md ${read ? "border-emerald-500/30" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/40"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {read ? (
            <Check
              className="h-4 w-4 text-emerald-500 shrink-0"
              aria-label="Read"
            />
          ) : (
            <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" aria-hidden />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{chapter.title}</p>
            {chapter.intro && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {chapter.intro}
              </p>
            )}
          </div>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
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
                <SubsectionView key={s.id} subsection={s} chapterTitle={chapter.title} />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Subsection view with optional audio narration ───────────────────────

function SubsectionView({
  subsection,
  chapterTitle,
}: {
  subsection: { id: number; title?: string | null; paragraphs?: unknown };
  chapterTitle: string;
}) {
  const audio = useAudioCompanion();
  const paragraphs: string[] = Array.isArray(subsection.paragraphs)
    ? (subsection.paragraphs as unknown[]).filter((p): p is string => typeof p === "string")
    : [];

  // Narration script = subsection title (if any) + every paragraph joined.
  const script = useMemo(() => {
    const title = subsection.title ? `${subsection.title}. ` : "";
    return `${title}${paragraphs.join(" ")}`.trim();
  }, [subsection.title, paragraphs]);

  const isThisItem = audio.currentItem?.id === `subsection-${subsection.id}`;
  const playing = isThisItem && audio.playing;

  const toggle = () => {
    if (playing) {
      audio.pause();
      return;
    }
    if (!script) return;
    audio.play({
      id: `subsection-${subsection.id}`,
      type: "chapter",
      title: subsection.title ?? chapterTitle,
      script,
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {subsection.title && (
          <h3 className="text-sm font-semibold flex items-center gap-1.5 flex-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            {subsection.title}
          </h3>
        )}
        {script.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 shrink-0"
            onClick={toggle}
            aria-label={playing ? "Stop narration" : "Play narration"}
          >
            {playing ? (
              <>
                <VolumeX className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px]">Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px]">Listen</span>
              </>
            )}
          </Button>
        )}
      </div>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
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
