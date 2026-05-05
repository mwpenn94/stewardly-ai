/**
 * LearningTrackDetail.tsx — Track Detail (Learning Engine parity)
 *
 * Matches the reference Learning Engine track page:
 * - Tab navigation: Practice Quiz, Flashcards, Audio Study, Chapters
 * - Exam Overview cards (Disciplines, Content, Format, Focus)
 * - Chapter sidebar on left, content rendering on right
 * - Section counts and chapter metadata
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo, useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { persistTrackVisit } from "./lib/recentTracks";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Layers, HelpCircle, ArrowLeft, ChevronRight,
  Sparkles, FileText, TrendingUp, Headphones, Volume2,
  GraduationCap, BarChart3, Target, Compass,
} from "lucide-react";
import {
  buildMasteryLookup, buildTrackProgress, formatProgressPct,
  completionStatus, type ChapterProgress,
} from "./lib/trackProgress";

/* ─── Tab types ─── */
type TrackTab = "chapters" | "quiz" | "flashcards" | "audio";

export default function LearningTrackDetail() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const [activeTab, setActiveTab] = useState<TrackTab>("chapters");
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);

  // Data queries — all public
  const trackQ = trpc.learning.content.getTrackBySlug.useQuery({ slug }, { enabled: !!slug });
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
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const track = trackQ.data;
  const chapters = chaptersQ.data ?? [];
  const questions = questionsQ.data ?? [];
  const flashcards = flashcardsQ.data ?? [];

  // Record track visit
  useEffect(() => {
    if (track?.slug && track?.name) {
      persistTrackVisit(track.slug, track.name, track.emoji ?? "📘");
    }
  }, [track?.slug, track?.name, track?.emoji]);

  // Auto-select first chapter
  useEffect(() => {
    if (chapters.length > 0 && selectedChapterId === null) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  // Progress computation
  const progress = useMemo(() => {
    if (!chapters.length && !flashcards.length && !questions.length) return null;
    const lookup = buildMasteryLookup(masteryQ.data ?? []);
    return buildTrackProgress(
      chapters.map((c: any) => ({ id: c.id, title: c.title })),
      flashcards.map((f: any) => ({ id: f.id, chapterId: f.chapterId ?? null })),
      questions.map((q: any) => ({ id: q.id, chapterId: q.chapterId ?? null })),
      lookup,
    );
  }, [chapters, flashcards, questions, masteryQ.data]);

  // Compute section count from chapters
  const sectionCount = useMemo(() => {
    // We'll get actual section counts when subsections load
    return chapters.length * 3; // Estimate until we have real data
  }, [chapters]);

  // Loading state
  if (trackQ.isLoading || authLoading) {
    return (
      <LearningShell title="Track">
        <SEOHead title="Track" description="Track chapters and study materials" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-32 rounded-full" />)}
          </div>
        </div>
      </LearningShell>
    );
  }

  if (!track) {
    return (
      <LearningShell title="Track not found">
        <div className="mx-auto max-w-3xl p-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-medium">Track not found</p>
              <p className="text-sm text-muted-foreground">
                No exam track with slug <code>{slug}</code>.
              </p>
            </CardContent>
          </Card>
        </div>
      </LearningShell>
    );
  }

  // Parse exam metadata from track description/metadata
  const examMeta = parseExamMeta(track);

  return (
    <LearningShell title={track.name ?? "Track"}>
      <SEOHead title={track.title ?? track.name} description={track.subtitle ?? track.description ?? ""} />
      <div className="min-h-screen">
        {/* ─── Header ─── */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border/50">
          <div className="flex items-start gap-3 mb-3">
            <Link href="/learning/tracks">
              <button className="p-1.5 rounded-lg hover:bg-primary/50 transition-colors mt-0.5">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            </Link>
            <span className="text-3xl shrink-0">{track.emoji ?? "📘"}</span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{track.title ?? track.name}</h1>
              <p className="text-sm text-muted-foreground">
                {track.subtitle ?? track.description ?? ""}
              </p>
            </div>
          </div>

          {/* ─── Tab navigation (Learning Engine style) ─── */}
          <div className="flex items-center gap-2 flex-wrap ml-10">
            <TabButton
              active={activeTab === "quiz"}
              onClick={() => setActiveTab("quiz")}
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              label={`Practice Quiz (${questions.length})`}
              color="bg-amber-500/10 text-amber-400 border-amber-500/30"
            />
            <TabButton
              active={activeTab === "flashcards"}
              onClick={() => setActiveTab("flashcards")}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label={`Flashcards (${flashcards.length})`}
              color="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            />
            <TabButton
              active={activeTab === "audio"}
              onClick={() => setActiveTab("audio")}
              icon={<Headphones className="h-3.5 w-3.5" />}
              label="Audio Study"
              color="bg-blue-500/10 text-blue-400 border-blue-500/30"
            />
            <TabButton
              active={activeTab === "chapters"}
              onClick={() => setActiveTab("chapters")}
              icon={<BookOpen className="h-3.5 w-3.5" />}
              label={`${chapters.length} chapters · ${sectionCount} sections`}
              color="bg-muted text-muted-foreground border-border"
            />
          </div>
        </div>

        {/* ─── Tab content ─── */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === "chapters" && (
            <ChaptersView
              track={track}
              chapters={chapters}
              chaptersLoading={chaptersQ.isLoading}
              examMeta={examMeta}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
              progress={progress}
            />
          )}
          {activeTab === "quiz" && (
            <QuizView track={track} questionCount={questions.length} />
          )}
          {activeTab === "flashcards" && (
            <FlashcardsView track={track} flashcardCount={flashcards.length} />
          )}
          {activeTab === "audio" && (
            <AudioView track={track} chapters={chapters} />
          )}
        </div>
      </div>
    </LearningShell>
  );
}

/* ─── Tab Button ─── */
function TabButton({ active, onClick, icon, label, color }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all
        ${active
          ? `${color} ring-1 ring-primary/20`
          : "bg-transparent text-muted-foreground border-border/50 hover:bg-accent/30"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Chapters View (sidebar + content) ─── */
function ChaptersView({ track, chapters, chaptersLoading, examMeta, selectedChapterId, onSelectChapter, progress }: {
  track: any; chapters: any[]; chaptersLoading: boolean; examMeta: ExamMeta;
  selectedChapterId: number | null; onSelectChapter: (id: number) => void;
  progress: any;
}) {
  const selectedChapter = chapters.find((c: any) => c.id === selectedChapterId);

  return (
    <div className="space-y-6">
      {/* Exam Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard icon={<GraduationCap className="h-4 w-4" />} label="DISCIPLINES" value={examMeta.disciplines} />
        <OverviewCard icon={<BarChart3 className="h-4 w-4" />} label="CONTENT" value={examMeta.content} />
        <OverviewCard icon={<Target className="h-4 w-4" />} label="FORMAT" value={examMeta.format} />
        <OverviewCard icon={<Compass className="h-4 w-4" />} label="FOCUS" value={examMeta.focus} />
      </div>

      {/* Chapters count card */}
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">CHAPTERS</span>
        <span className="text-lg font-bold">{chapters.length}</span>
      </div>

      {/* Chapter sidebar + content split */}
      <div className="flex gap-6">
        {/* Chapter sidebar */}
        <div className="w-64 shrink-0 hidden md:block">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">CHAPTERS</h3>
          {chaptersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <nav className="space-y-0.5">
              {chapters.map((ch: any) => (
                <button
                  key={ch.id}
                  onClick={() => onSelectChapter(ch.id)}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2
                    ${selectedChapterId === ch.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                    }
                  `}
                >
                  <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${selectedChapterId === ch.id ? "rotate-90" : ""}`} />
                  <span className="line-clamp-1">{ch.title}</span>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Chapter content */}
        <div className="flex-1 min-w-0">
          {/* Mobile chapter selector */}
          <div className="md:hidden mb-4">
            <select
              value={selectedChapterId ?? ""}
              onChange={(e) => onSelectChapter(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {chapters.map((ch: any) => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          {selectedChapter ? (
            <ChapterContent chapter={selectedChapter} />
          ) : chaptersLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : chapters.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No chapters in this track yet.</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Progress card */}
      {progress && progress.trackTotal > 0 && (
        <TrackProgressCard progress={progress} />
      )}
    </div>
  );
}

/* ─── Chapter Content (with lazy-loaded subsections) ─── */
function ChapterContent({ chapter }: { chapter: any }) {
  const subsQ = trpc.learning.content.listSubsections.useQuery(
    { chapterId: chapter.id },
    { enabled: !!chapter.id },
  );
  const subs = subsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          {chapter.title}
        </h2>
        {chapter.intro && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            {chapter.intro}
          </p>
        )}
      </div>

      {subsQ.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No subsections in this chapter.</p>
      ) : (
        <div className="space-y-8">
          {subs.map((s: any) => (
            <div key={s.id} className="space-y-2">
              {s.title && (
                <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  {s.title}
                </h3>
              )}
              {Array.isArray(s.paragraphs) && s.paragraphs.map((p: string, i: number) => (
                <p key={i} className="text-sm leading-[1.8] text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Overview Card ─── */
function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </div>
      <p className="text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

/* ─── Quiz View ─── */
function QuizView({ track, questionCount }: { track: any; questionCount: number }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-12 space-y-4">
      <HelpCircle className="h-12 w-12 mx-auto text-amber-400" />
      <h2 className="text-xl font-bold">Practice Quiz</h2>
      <p className="text-sm text-muted-foreground">
        {questionCount} multiple-choice questions covering all chapters in {track.title ?? track.name}.
      </p>
      <Link href={`/learning/tracks/${track.slug}/quiz`}>
        <Button size="lg" className="mt-2">
          <HelpCircle className="h-4 w-4 mr-2" /> Start Quiz
        </Button>
      </Link>
    </div>
  );
}

/* ─── Flashcards View ─── */
function FlashcardsView({ track, flashcardCount }: { track: any; flashcardCount: number }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-12 space-y-4">
      <Sparkles className="h-12 w-12 mx-auto text-emerald-400" />
      <h2 className="text-xl font-bold">Flashcard Study</h2>
      <p className="text-sm text-muted-foreground">
        {flashcardCount} flashcards from the WealthBridge library for {track.title ?? track.name}.
      </p>
      <Link href={`/learning/tracks/${track.slug}/study`}>
        <Button size="lg" className="mt-2">
          <Sparkles className="h-4 w-4 mr-2" /> Start Studying
        </Button>
      </Link>
    </div>
  );
}

/* ─── Audio View ─── */
function AudioView({ track, chapters }: { track: any; chapters: any[] }) {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Volume2 className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-lg font-bold">{track.title ?? track.name} — Audio Study</h2>
            <p className="text-xs text-muted-foreground">Listen to chapter content with text-to-speech</p>
          </div>
        </div>
        <Link href={`/learning/audio/${track.slug}`}>
          <Button variant="outline" className="gap-2">
            <Headphones className="h-4 w-4" /> Open Audio Player
          </Button>
        </Link>
      </div>

      {/* Chapter playlist */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Chapters</h3>
        {chapters.map((ch: any, i: number) => (
          <div key={ch.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/30 transition-colors">
            <Headphones className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{ch.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Track Progress Card ─── */
function TrackProgressCard({ progress }: {
  progress: {
    trackTotal: number; trackMastered: number; trackInProgress: number;
    trackUnseen: number; trackCompletionPct: number; trackAttemptedPct: number;
    chapters: ChapterProgress[];
    unchaptered: { total: number; mastered: number; inProgress: number; unseen: number };
  };
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" /> Your Progress
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {progress.trackMastered} mastered · {progress.trackInProgress} in progress · {progress.trackUnseen} new
            </span>
            <span className="font-semibold">{formatProgressPct(progress.trackCompletionPct)} mastered</span>
          </div>
          <Progress value={progress.trackCompletionPct * 100} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Exam metadata parser ─── */
interface ExamMeta {
  disciplines: string;
  content: string;
  format: string;
  focus: string;
}

function parseExamMeta(track: any): ExamMeta {
  // Use actual examOverview data from the database if available
  const overview = track.examOverview;
  if (overview?.sections && Array.isArray(overview.sections)) {
    const sectionMap: Record<string, string> = {};
    for (const [key, value] of overview.sections) {
      sectionMap[key.toLowerCase()] = value;
    }
    return {
      disciplines: sectionMap["disciplines"] ?? track.category ?? "General",
      content: sectionMap["content"] ?? `${track.flashcardCount ?? 0} flashcards, ${track.questionCount ?? 0} questions`,
      format: sectionMap["format"] ?? "Study manual with practice materials",
      focus: sectionMap["focus"] ?? track.subtitle ?? "Comprehensive exam preparation",
    };
  }

  // Fallback for tracks without examOverview
  return {
    disciplines: track.category ?? "General",
    content: `${track.flashcardCount ?? 0} flashcards, ${track.questionCount ?? 0} questions`,
    format: "Study manual with practice materials",
    focus: track.subtitle ?? track.description ?? "Comprehensive exam preparation",
  };
}
