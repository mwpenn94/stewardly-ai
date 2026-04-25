/**
 * AudioStudyPage.tsx — Track-specific Audio Study player
 *
 * Pass 157. Fetches chapters and subsections for a specific track,
 * builds TTS-optimized scripts from the actual Knowledge Explorer
 * content (subsection paragraphs, definitions, flashcards), and
 * plays them through the AudioCompanion.
 *
 * Route: /learning/audio/:slug
 */
import { useState, useMemo, useCallback, useEffect } from "react";
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
  ArrowLeft, Headphones, Play, Pause, Volume2,
  BookOpen, Layers, Loader2, LogIn, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function AudioStudyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/learning/audio/:slug");
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();

  // Fetch track + chapters
  const trackQ = trpc.learning.content.getTrackBySlug.useQuery({ slug }, { enabled: !!slug });
  const track = trackQ.data;
  const chaptersQ = trpc.learning.content.listChapters.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const chapters = chaptersQ.data ?? [];

  // Fetch subsections for all chapters
  const [allSubsections, setAllSubsections] = useState<Record<number, any[]>>({});
  const [loadingSubsections, setLoadingSubsections] = useState(false);

  // Fetch flashcards for this track
  const flashcardsQ = trpc.learning.content.listFlashcardsForTrack.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const flashcards = flashcardsQ.data ?? [];

  // Fetch subsections for each chapter
  useEffect(() => {
    if (chapters.length === 0) return;
    setLoadingSubsections(true);
    const fetchAll = async () => {
      const results: Record<number, any[]> = {};
      // We'll fetch one by one since we can't do parallel tRPC queries in useEffect
      for (const ch of chapters) {
        try {
          const res = await fetch(`/api/trpc/learning.content.listSubsections?input=${encodeURIComponent(JSON.stringify({ chapterId: ch.id }))}`, {
            credentials: "include",
          });
          const data = await res.json();
          results[ch.id] = data?.result?.data ?? [];
        } catch {
          results[ch.id] = [];
        }
      }
      setAllSubsections(results);
      setLoadingSubsections(false);
    };
    fetchAll();
  }, [chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build audio items from actual content
  const audioItems = useMemo((): AudioItem[] => {
    const items: AudioItem[] = [];

    for (const ch of chapters) {
      // Chapter intro
      items.push({
        id: `ch-intro-${ch.id}`,
        type: "chapter",
        title: `Chapter: ${ch.title}`,
        script: `Chapter: ${ch.title}. ${ch.description || ""}. Let's explore this topic.`,
      });

      // Subsections for this chapter
      const subs = allSubsections[ch.id] ?? [];
      for (const sub of subs) {
        // Build TTS from paragraphs
        let paragraphText = "";
        if (Array.isArray(sub.paragraphs)) {
          paragraphText = sub.paragraphs
            .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
            .filter(Boolean)
            .join(". ");
        }

        if (paragraphText.length > 10) {
          items.push({
            id: `sub-${sub.id}`,
            type: "chapter",
            title: sub.title || `Section ${sub.id}`,
            script: `${sub.title || "Section"}. ${paragraphText}`,
          });
        }
      }
    }

    // Add flashcards at the end as review
    if (flashcards.length > 0) {
      items.push({
        id: "fc-intro",
        type: "definition",
        title: "Flashcard Review",
        script: `Now let's review ${flashcards.length} key terms and definitions for this track.`,
      });
      for (const fc of flashcards) {
        items.push({
          id: `fc-${fc.id}`,
          type: "definition",
          title: fc.term,
          script: `${fc.term}. ${fc.definition}`,
        });
      }
    }

    return items;
  }, [chapters, allSubsections, flashcards]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapterIdx, setCurrentChapterIdx] = useState<number | null>(null);

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
    const chapterItems = audioItems.filter(
      item => item.id.startsWith(`ch-intro-${ch.id}`) || item.id.startsWith(`sub-`)
    );
    // More precise: get items for this chapter
    const startIdx = audioItems.findIndex(item => item.id === `ch-intro-${ch.id}`);
    const nextChapter = chapters[chapterIdx + 1];
    const endIdx = nextChapter
      ? audioItems.findIndex(item => item.id === `ch-intro-${nextChapter.id}`)
      : audioItems.findIndex(item => item.id === "fc-intro");
    const slice = audioItems.slice(startIdx, endIdx > startIdx ? endIdx : undefined);

    if (slice.length > 0) {
      audio.dismiss();
      audio.enqueue(slice);
      setCurrentChapterIdx(chapterIdx);
      setIsPlaying(true);
      toast.success(`Playing chapter: ${ch.title}`);
    }
  }, [chapters, audioItems, audio]);

  // Sync playing state
  useEffect(() => {
    setIsPlaying(audio.playing);
  }, [audio.playing]);

  const isLoading = trackQ.isLoading || chaptersQ.isLoading || loadingSubsections;

  // Auth guard
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

  return (
    <LearningShell>
      <SEOHead title={`Audio Study — ${track?.title ?? track?.name ?? slug}`} description="Listen to track content" />
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
                {isLoading ? <Skeleton className="h-6 w-48" /> : `${track?.title ?? track?.name ?? slug} — Audio Study`}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {isLoading ? <Skeleton className="h-3 w-32 mt-1" /> : `${chapters.length} chapters · ${audioItems.length} segments`}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-8 max-w-3xl mx-auto space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Play All button */}
              <Button
                onClick={startFullPlayback}
                disabled={audioItems.length === 0}
                className="w-full py-3 gap-2"
                size="lg"
              >
                {audio.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {audio.playing ? "Playing..." : `Play All (${audioItems.length} segments)`}
              </Button>

              {/* Chapter list */}
              <div className="space-y-2">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <BookOpen className="w-4 h-4 text-primary" />
                  Chapters
                </h2>
                {chapters.map((ch: any, i: number) => {
                  const subs = allSubsections[ch.id] ?? [];
                  const subCount = subs.filter((s: any) => {
                    if (!Array.isArray(s.paragraphs)) return false;
                    const text = s.paragraphs.map((p: any) => typeof p === "string" ? p : p?.text ?? "").join("");
                    return text.length > 10;
                  }).length;

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
                          {subCount > 0 ? `${subCount} sections` : "No content yet"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playChapter(i)}
                        disabled={subCount === 0}
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
                    Key terms and definitions are included at the end of the full playback.
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

              {/* Empty state */}
              {audioItems.length === 0 && !isLoading && (
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
