/**
 * AudioStudyPage.tsx — Track-specific Audio Study player
 *
 * Pass 158. Exhaustive content pipeline: fetches chapters, subsections,
 * flashcards, AND practice questions for a specific track. Groups all
 * content by chapter so even chapters with 0 subsections still have
 * flashcard and question audio. Builds TTS-optimized scripts from the
 * actual Knowledge Explorer content.
 *
 * Route: /learning/audio/:slug
 *
 * Fixes from 157b:
 * - Chapters with 0 subsections no longer stuck on "Loading..."
 * - Chapters with 0 subsections now show flashcard/question counts
 * - TTS scripts include subsection paragraphs + flashcard definitions + question explanations
 * - Breadcrumb shows track title instead of raw slug
 * - Play button enabled for chapters that have any content (not just subsections)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useAudioCompanion, type AudioItem } from "@/components/AudioCompanion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Headphones, Play, Pause,
  BookOpen, Layers, Loader2, LogIn, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

/* ── TTS script builders (same logic as HandsFreeStudy) ── */
function buildSubsectionTts(title: string | null, paragraphs: any): string {
  let text = "";
  if (Array.isArray(paragraphs)) {
    text = paragraphs
      .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
      .filter(Boolean)
      .join(". ");
  }
  if (text.length < 10) return "";
  return `${title || "Section"}. ${text}`;
}

function buildFlashcardTts(term: string, definition: string): string {
  const cleanDef = definition?.replace(/\t.*/g, "").trim() ?? "";
  return `Key term: ${term}. ${cleanDef}`;
}

function buildQuestionTts(prompt: string, options: string[], correctIndex: number, explanation: string | null): string {
  const optionLetters = ["A", "B", "C", "D", "E", "F"];
  let script = `Practice question. ${prompt} `;
  options.forEach((opt, i) => {
    script += `${optionLetters[i]}: ${opt}. `;
  });
  const correctLetter = optionLetters[correctIndex] ?? "A";
  script += `The correct answer is ${correctLetter}: ${options[correctIndex] ?? ""}. `;
  if (explanation) {
    script += explanation;
  }
  return script;
}

export default function AudioStudyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/learning/audio/:slug");
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();

  // ── Fetch track + chapters ──
  const trackQ = trpc.learning.content.getTrackBySlug.useQuery({ slug }, { enabled: !!slug });
  const track = trackQ.data;
  const chaptersQ = trpc.learning.content.listChapters.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const chapters = chaptersQ.data ?? [];

  // ── Fetch flashcards for the track (grouped by chapterId) ──
  const flashcardsQ = trpc.learning.content.listFlashcards.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const flashcards = flashcardsQ.data ?? [];

  // ── Fetch practice questions for the track ──
  const questionsQ = trpc.learning.content.listQuestions.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const questions = questionsQ.data ?? [];

  // ── Group flashcards and questions by chapterId ──
  const flashcardsByChapter = useMemo(() => {
    const map: Record<number, typeof flashcards> = {};
    for (const fc of flashcards) {
      const chId = (fc as any).chapterId;
      if (chId) {
        if (!map[chId]) map[chId] = [];
        map[chId].push(fc);
      }
    }
    return map;
  }, [flashcards]);

  const questionsByChapter = useMemo(() => {
    const map: Record<number, typeof questions> = {};
    for (const q of questions) {
      const chId = (q as any).chapterId;
      if (chId) {
        if (!map[chId]) map[chId] = [];
        map[chId].push(q);
      }
    }
    return map;
  }, [questions]);

  // ── Fetch subsections for all chapters via raw fetch ──
  const [allSubsections, setAllSubsections] = useState<Record<number, any[]>>({});
  const [subsectionsLoaded, setSubsectionsLoaded] = useState(false);
  const fetchedChapterIdsRef = useRef<string>("");

  useEffect(() => {
    if (chapters.length === 0) return;
    const chapterIdKey = chapters.map(c => c.id).sort().join(",");
    if (fetchedChapterIdsRef.current === chapterIdKey) return;
    fetchedChapterIdsRef.current = chapterIdKey;

    const fetchAll = async () => {
      const results: Record<number, any[]> = {};
      for (const ch of chapters) {
        try {
          const inputPayload = JSON.stringify({ json: { chapterId: ch.id } });
          const res = await fetch(
            `/api/trpc/learning.content.listSubsections?input=${encodeURIComponent(inputPayload)}`,
            { credentials: "include" }
          );
          const data = await res.json();
          const subs = data?.result?.data?.json ?? data?.result?.data ?? [];
          results[ch.id] = Array.isArray(subs) ? subs : [];
        } catch {
          results[ch.id] = [];
        }
      }
      setAllSubsections(results);
      setSubsectionsLoaded(true);
    };
    fetchAll();
  }, [chapters]);

  // ── Content counts per chapter ──
  const chapterContentCounts = useMemo(() => {
    const counts: Record<number, { subsections: number; flashcards: number; questions: number; total: number }> = {};
    for (const ch of chapters) {
      const subs = (allSubsections[ch.id] ?? []).filter((s: any) => {
        if (!Array.isArray(s.paragraphs)) return false;
        const text = s.paragraphs.map((p: any) => typeof p === "string" ? p : p?.text ?? "").join("");
        return text.length > 10;
      });
      const fcs = flashcardsByChapter[ch.id] ?? [];
      const qs = questionsByChapter[ch.id] ?? [];
      counts[ch.id] = {
        subsections: subs.length,
        flashcards: fcs.length,
        questions: qs.length,
        total: subs.length + fcs.length + qs.length,
      };
    }
    return counts;
  }, [chapters, allSubsections, flashcardsByChapter, questionsByChapter]);

  // ── Build audio items from ALL content types ──
  const audioItems = useMemo((): AudioItem[] => {
    const items: AudioItem[] = [];

    for (const ch of chapters) {
      const counts = chapterContentCounts[ch.id];
      if (!counts || counts.total === 0) {
        // Still add chapter intro even if empty
        items.push({
          id: `ch-intro-${ch.id}`,
          type: "chapter",
          title: `Chapter: ${ch.title}`,
          script: `Chapter: ${ch.title}. ${(ch as any).description || (ch as any).intro || "This chapter is being developed."}`,
        });
        continue;
      }

      // Chapter intro with content summary
      const parts: string[] = [];
      if (counts.subsections > 0) parts.push(`${counts.subsections} study sections`);
      if (counts.flashcards > 0) parts.push(`${counts.flashcards} key terms`);
      if (counts.questions > 0) parts.push(`${counts.questions} practice questions`);
      const summary = parts.join(", ");

      items.push({
        id: `ch-intro-${ch.id}`,
        type: "chapter",
        title: `Chapter: ${ch.title}`,
        script: `Chapter: ${ch.title}. ${(ch as any).description || ""}. This chapter contains ${summary}. Let's begin.`,
      });

      // Subsections with paragraph content
      const subs = allSubsections[ch.id] ?? [];
      for (const sub of subs) {
        const script = buildSubsectionTts(sub.title, sub.paragraphs);
        if (script) {
          items.push({
            id: `sub-${sub.id}`,
            type: "chapter",
            title: sub.title || `Section ${sub.id}`,
            script,
          });
        }
      }

      // Flashcards for this chapter
      const chFlashcards = flashcardsByChapter[ch.id] ?? [];
      if (chFlashcards.length > 0) {
        items.push({
          id: `fc-header-${ch.id}`,
          type: "definition",
          title: `Key Terms — ${ch.title}`,
          script: `Now let's review ${chFlashcards.length} key terms for ${ch.title}.`,
        });
        for (const fc of chFlashcards) {
          items.push({
            id: `fc-${fc.id}`,
            type: "definition",
            title: fc.term,
            script: buildFlashcardTts(fc.term, fc.definition),
          });
        }
      }

      // Practice questions for this chapter
      const chQuestions = questionsByChapter[ch.id] ?? [];
      if (chQuestions.length > 0) {
        items.push({
          id: `q-header-${ch.id}`,
          type: "question",
          title: `Practice Questions — ${ch.title}`,
          script: `Now let's test your knowledge with ${chQuestions.length} practice questions for ${ch.title}.`,
        });
        for (const q of chQuestions) {
          items.push({
            id: `q-${q.id}`,
            type: "question",
            title: `Q: ${q.prompt.slice(0, 60)}...`,
            script: buildQuestionTts(q.prompt, (q as any).options ?? [], (q as any).correctIndex ?? 0, q.explanation),
          });
        }
      }
    }

    // Unassigned questions (chapterId is null) at the end
    const unassignedQs = questions.filter(q => !(q as any).chapterId);
    if (unassignedQs.length > 0) {
      items.push({
        id: "unassigned-q-header",
        type: "question",
        title: "General Practice Questions",
        script: `Finally, let's cover ${unassignedQs.length} general practice questions for this track.`,
      });
      for (const q of unassignedQs) {
        items.push({
          id: `q-${q.id}`,
          type: "question",
          title: `Q: ${q.prompt.slice(0, 60)}...`,
          script: buildQuestionTts(q.prompt, (q as any).options ?? [], (q as any).correctIndex ?? 0, q.explanation),
        });
      }
    }

    return items;
  }, [chapters, allSubsections, flashcardsByChapter, questionsByChapter, questions, chapterContentCounts]);

  const [isPlaying, setIsPlaying] = useState(false);

  // Start full track playback
  const startFullPlayback = useCallback(() => {
    if (audioItems.length === 0) {
      toast.error("No audio content available for this track yet.");
      return;
    }
    audio.enqueue(audioItems);
    setIsPlaying(true);
    toast.success(`Started audio study: ${audioItems.length} segments`);
  }, [audioItems, audio]);

  // Play a specific chapter
  const playChapter = useCallback((chapterIdx: number) => {
    const ch = chapters[chapterIdx];
    if (!ch) return;
    const startIdx = audioItems.findIndex(item => item.id === `ch-intro-${ch.id}`);
    if (startIdx < 0) return;
    const nextChapter = chapters[chapterIdx + 1];
    let endIdx = -1;
    if (nextChapter) {
      endIdx = audioItems.findIndex(item => item.id === `ch-intro-${nextChapter.id}`);
    } else {
      // Last chapter — check for unassigned questions section
      endIdx = audioItems.findIndex(item => item.id === "unassigned-q-header");
    }
    const slice = audioItems.slice(startIdx, endIdx > startIdx ? endIdx : undefined);

    if (slice.length > 0) {
      audio.dismiss();
      audio.enqueue(slice);
      setIsPlaying(true);
      toast.success(`Playing chapter: ${ch.title} (${slice.length} segments)`);
    } else {
      toast.info("No audio content for this chapter yet.");
    }
  }, [chapters, audioItems, audio]);

  // Sync playing state
  useEffect(() => {
    setIsPlaying(audio.playing);
  }, [audio.playing]);

  const isDataLoading = trackQ.isLoading || chaptersQ.isLoading;
  const isContentLoading = !subsectionsLoaded && chapters.length > 0;
  const isLoading = isDataLoading || isContentLoading;

  // ── Auth guard ──
  if (authLoading) {
    return <LearningShell><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></LearningShell>;
  }
  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Audio Study" description="Track audio study" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Headphones className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Audio Study</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to listen to track content.</p>
            <a href={getLoginUrl(`/learning/audio/${slug}`)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const trackTitle = track?.title ?? track?.name ?? slug.replace(/_/g, " ");

  // ── Render ──
  return (
    <LearningShell title={`${trackTitle} — Audio Study`}>
      <SEOHead title={`Audio Study — ${trackTitle}`} description={`Listen to ${trackTitle} study content`} />
      <div className="min-h-screen pb-36">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href={`/learning/tracks/${slug}`}>
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                {isDataLoading ? <Skeleton className="h-6 w-48" /> : trackTitle}
              </h1>
              <span className="text-xs text-muted-foreground font-mono block">
                {isDataLoading ? <Skeleton className="h-3 w-32 mt-1" /> : `${chapters.length} chapters · ${audioItems.length} segments`}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-8 max-w-3xl mx-auto space-y-6">
          {isDataLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Play All button */}
              <Button
                onClick={startFullPlayback}
                disabled={audioItems.length === 0 && subsectionsLoaded}
                className="w-full py-3 gap-2"
                size="lg"
              >
                {audio.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {audio.playing ? "Playing..." : isContentLoading ? "Loading content..." : `Play All (${audioItems.length} segments)`}
              </Button>

              {/* Chapter list */}
              <div className="space-y-2">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <BookOpen className="w-4 h-4 text-primary" />
                  Chapters
                </h2>
                {chapters.map((ch: any, i: number) => {
                  const counts = chapterContentCounts[ch.id];
                  const hasContent = counts && counts.total > 0;
                  const isChapterLoading = !subsectionsLoaded;

                  // Build description parts
                  const descParts: string[] = [];
                  if (counts?.subsections) descParts.push(`${counts.subsections} sections`);
                  if (counts?.flashcards) descParts.push(`${counts.flashcards} terms`);
                  if (counts?.questions) descParts.push(`${counts.questions} questions`);
                  const desc = descParts.length > 0 ? descParts.join(" · ") : "No content yet";

                  return (
                    <motion.div
                      key={ch.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-none">
                        <span className="text-xs font-bold text-blue-400">{i + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium truncate">{ch.title}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {isChapterLoading ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading content...
                            </span>
                          ) : desc}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playChapter(i)}
                        disabled={isChapterLoading || !hasContent}
                        className="gap-1 text-xs flex-none"
                      >
                        <Play className="w-3 h-3" /> Play
                      </Button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Flashcards section */}
              {flashcards.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Flashcard Review ({flashcards.length} terms)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Key terms are included within each chapter's audio playback.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {flashcards.slice(0, 12).map((fc: any) => (
                      <Badge key={fc.id} variant="outline" className="text-[10px]">{fc.term}</Badge>
                    ))}
                    {flashcards.length > 12 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">+{flashcards.length - 12} more</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Practice questions section */}
              {questions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    Practice Questions ({questions.length} questions)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Questions with answers and explanations are included within each chapter's audio playback.
                  </p>
                </div>
              )}

              {/* Empty state */}
              {audioItems.length === 0 && subsectionsLoaded && (
                <div className="text-center py-12">
                  <Headphones className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No audio content available for this track yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Content will appear once chapters and sections are populated.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LearningShell>
  );
}
