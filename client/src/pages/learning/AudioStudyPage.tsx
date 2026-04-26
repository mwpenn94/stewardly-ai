/**
 * AudioStudyPage.tsx — Track-specific Audio Study player
 *
 * Pass 162. Adds:
 * - Spaced repetition integration (SM-2 variant for audio)
 * - "Due for Review" section with priority-sorted items
 * - Post-listen rating dialog (Easy/Good/Hard)
 * - Review stats summary (due now, due today, mastered, total reviewed)
 *
 * Route: /learning/audio/:slug
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Headphones, Play, Pause,
  BookOpen, Layers, Loader2, LogIn, HelpCircle,
  Calculator, Briefcase, Lightbulb, Image as ImageIcon,
  GitBranch, ChevronDown, ChevronUp, CheckCircle2,
  Timer, Flame, Filter, RotateCcw, Brain, Zap, Star,
  Clock, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";


export default function AudioStudyPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/learning/audio/:slug");
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();

  // ── Discipline picker state ──
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | undefined>(undefined);

  // ── Fetch disciplines for the picker ──
  const disciplinesQ = trpc.learning.content.listDisciplines.useQuery(
    undefined,
    { enabled: !!isAuthenticated }
  );
  const disciplines = disciplinesQ.data ?? [];

  // ── Fetch track ──
  const trackQ = trpc.learning.content.getTrackBySlug.useQuery({ slug }, { enabled: !!slug });
  const track = trackQ.data;

  // ── Fetch chapters (for chapter navigation) ──
  const chaptersQ = trpc.learning.content.listChapters.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const chapters = chaptersQ.data ?? [];

  // ── Fetch ALL content via getHandsFreeContent (with optional discipline filter) ──
  const contentQ = trpc.learning.content.getHandsFreeContent.useQuery(
    {
      trackId: track?.id ?? 0,
      disciplineId: selectedDisciplineId,
      sections: ["definitions", "formulas", "cases", "applications", "subsections", "flashcards", "questions"],
      limit: 200,
    },
    { enabled: !!track?.id }
  );
  const content = contentQ.data;

  // ── Fetch connections (concept graph edges) ──
  const connectionsQ = trpc.learning.content.listConnections.useQuery(
    undefined,
    { enabled: !!isAuthenticated }
  );

  // ── Fetch audio study progress for this track ──
  const progressQ = trpc.learningSocial.audioProgress.getTrackProgress.useQuery(
    { trackSlug: slug },
    { enabled: !!isAuthenticated && !!slug }
  );
  const completedSegmentIds = useMemo(
    () => new Set(progressQ.data?.completedSegments ?? []),
    [progressQ.data?.completedSegments]
  );

  // ── Fetch aggregate audio study stats ──
  const statsQ = trpc.learningSocial.audioProgress.getStats.useQuery(
    undefined,
    { enabled: !!isAuthenticated }
  );

  // ── Spaced repetition: due items for this track ──
  const dueItemsQ = trpc.learningSocial.audioProgress.getDueItems.useQuery(
    { trackSlug: slug, limit: 30 },
    { enabled: !!isAuthenticated && !!slug }
  );
  const reviewStatsQ = trpc.learningSocial.audioProgress.getReviewStats.useQuery(
    { trackSlug: slug },
    { enabled: !!isAuthenticated && !!slug }
  );

  // ── Progress recording mutations ──
  const recordSegment = trpc.learningSocial.audioProgress.recordSegment.useMutation();
  const recordReview = trpc.learningSocial.audioProgress.recordReview.useMutation();
  const recordStudySession = trpc.learningSocial.studySessions.record.useMutation();
  const utils = trpc.useUtils();

  // ── Review rating dialog state ──
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingItem, setRatingItem] = useState<{
    segmentId: string; segmentTitle: string; segmentType: string; trackSlug: string;
  } | null>(null);
  const reviewStartRef = useRef<number>(0);
  const reviewQueueRef = useRef<Array<{ segmentId: string; segmentTitle: string; segmentType: string; trackSlug: string }>>([]);
  const reviewIndexRef = useRef(0);

  // ── Track session start time for duration calculation ──
  const sessionStartRef = useRef<number | null>(null);
  const segmentsPlayedRef = useRef(0);

  // ── Wire up segment completion callback ──
  useEffect(() => {
    if (!isAuthenticated || !slug) return;

    audio.onSegmentComplete((item: AudioItem, durationMs: number) => {
      // Record segment progress
      recordSegment.mutate({
        trackSlug: slug,
        segmentId: item.id,
        segmentType: item.type,
        segmentTitle: item.title.slice(0, 512),
        durationMs,
      }, {
        onSuccess: () => {
          // Invalidate progress queries to update UI
          utils.learningSocial.audioProgress.getTrackProgress.invalidate({ trackSlug: slug });
          utils.learningSocial.audioProgress.getStats.invalidate();
        },
      });

      segmentsPlayedRef.current += 1;

      // Start session timer on first segment
      if (!sessionStartRef.current) {
        sessionStartRef.current = Date.now();
      }
    });

    return () => {
      audio.onSegmentComplete(null);
      // Flush session on unmount
      if (sessionStartRef.current && segmentsPlayedRef.current > 0) {
        const durationMin = Math.round((Date.now() - sessionStartRef.current) / 60000);
        recordStudySession.mutate({
          discipline: track?.name ?? undefined,
          trackKey: slug,
          durationMinutes: Math.max(durationMin, 1),
          itemsStudied: segmentsPlayedRef.current,
          itemsMastered: 0,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, slug]);

  // ── Extract diagrams from examOverview ──
  const diagrams = useMemo(() => {
    const eo = track?.examOverview as any;
    if (eo?.diagrams && Array.isArray(eo.diagrams)) {
      return eo.diagrams as { id?: string; title: string; url: string; description?: string }[];
    }
    return [];
  }, [track]);

  // ── Content counts ──
  const counts = useMemo(() => ({
    chapters: chapters.length,
    subsections: content?.subsections?.length ?? 0,
    definitions: content?.definitions?.length ?? 0,
    formulas: content?.formulas?.length ?? 0,
    cases: content?.cases?.length ?? 0,
    applications: content?.applications?.length ?? 0,
    flashcards: content?.flashcards?.length ?? 0,
    questions: content?.questions?.length ?? 0,
    diagrams: diagrams.length,
    connections: connectionsQ.data?.length ?? 0,
  }), [chapters, content, diagrams, connectionsQ.data]);

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);

  // ── Group subsections by chapterId ──
  const subsectionsByChapter = useMemo(() => {
    const map: Record<number, Array<{ id: number; chapterId?: number; title: string; paragraphs?: any; ttsScript: string }>> = {};
    for (const s of (content?.subsections ?? [])) {
      const chId = (s as any).chapterId;
      if (chId) {
        if (!map[chId]) map[chId] = [];
        map[chId].push(s);
      }
    }
    return map;
  }, [content?.subsections]);

  // ── Build comprehensive audio items from ALL content types ──
  const audioItems = useMemo((): AudioItem[] => {
    if (!content) return [];
    const items: AudioItem[] = [];

    // 1. Chapters with subsections
    for (const ch of chapters) {
      const subs = subsectionsByChapter[ch.id] ?? [];
      const subCount = subs.length;

      items.push({
        id: `ch-intro-${ch.id}`,
        type: "chapter",
        title: `Chapter: ${ch.title}`,
        script: `Chapter: ${ch.title}. ${(ch as any).description || ""}. This chapter has ${subCount} study sections. Let's begin.`,
      });

      for (const sub of subs) {
        if (sub.ttsScript && sub.ttsScript.length > 10) {
          items.push({
            id: `sub-${sub.id}`,
            type: "chapter",
            title: sub.title || `Section ${sub.id}`,
            script: sub.ttsScript,
          });
        }
      }
    }

    // 2. Definitions
    if (content.definitions.length > 0) {
      items.push({
        id: "def-header",
        type: "definition",
        title: "Key Definitions",
        script: `Now let's review ${content.definitions.length} key definitions for this track.`,
      });
      for (const d of content.definitions) {
        items.push({
          id: `def-${d.id}`,
          type: "definition",
          title: d.term,
          script: d.ttsScript,
        });
      }
    }

    // 3. Formulas
    if (content.formulas.length > 0) {
      items.push({
        id: "formula-header",
        type: "definition",
        title: "Financial Formulas",
        script: `Next, let's cover ${content.formulas.length} important formulas.`,
      });
      for (const f of content.formulas) {
        items.push({
          id: `formula-${f.id}`,
          type: "definition",
          title: f.name,
          script: f.ttsScript,
        });
      }
    }

    // 4. Case Studies
    if (content.cases.length > 0) {
      items.push({
        id: "case-header",
        type: "chapter",
        title: "Case Studies",
        script: `Now let's examine ${content.cases.length} real-world case studies.`,
      });
      for (const c of content.cases) {
        items.push({
          id: `case-${c.id}`,
          type: "chapter",
          title: c.title,
          script: c.ttsScript,
        });
      }
    }

    // 5. FS Applications
    if (content.applications.length > 0) {
      items.push({
        id: "app-header",
        type: "chapter",
        title: "Financial Services Applications",
        script: `Let's explore ${content.applications.length} practical financial services applications.`,
      });
      for (const a of content.applications) {
        items.push({
          id: `app-${a.id}`,
          type: "chapter",
          title: a.title,
          script: a.ttsScript,
        });
      }
    }

    // 6. Diagrams (audio descriptions)
    if (diagrams.length > 0) {
      items.push({
        id: "diagram-header",
        type: "definition",
        title: "Graphical Aids",
        script: `This track includes ${diagrams.length} graphical aids and diagrams. Let me describe each one.`,
      });
      for (const d of diagrams) {
        items.push({
          id: `diagram-${d.id ?? d.title}`,
          type: "definition",
          title: d.title,
          script: `Diagram: ${d.title}. ${d.description || "A visual representation of key concepts."}`,
        });
      }
    }

    // 7. Flashcards
    if (content.flashcards.length > 0) {
      items.push({
        id: "fc-header",
        type: "definition",
        title: "Flashcard Review",
        script: `Time for flashcard review. Let's go through ${content.flashcards.length} key terms.`,
      });
      for (const fc of content.flashcards) {
        items.push({
          id: `fc-${fc.id}`,
          type: "definition",
          title: fc.term,
          script: fc.ttsScript,
        });
      }
    }

    // 8. Practice Questions
    if (content.questions.length > 0) {
      items.push({
        id: "q-header",
        type: "question",
        title: "Practice Questions",
        script: `Finally, let's test your knowledge with ${content.questions.length} practice questions.`,
      });
      for (const q of content.questions) {
        items.push({
          id: `q-${q.id}`,
          type: "question",
          title: `Q: ${q.prompt.slice(0, 60)}...`,
          script: q.ttsScript,
        });
      }
    }

    return items;
  }, [chapters, content, diagrams, subsectionsByChapter]);

  // ── Compute per-section completed counts ──
  const sectionProgress = useMemo(() => {
    const progress: Record<string, { completed: number; total: number }> = {};
    const sectionRanges: { key: string; startIdx: number; endIdx: number }[] = [];

    // Build section ranges from audioItems
    let currentKey = "chapters";
    let currentStart = 0;
    for (let i = 0; i < audioItems.length; i++) {
      const item = audioItems[i];
      if (item.id === "def-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "definitions"; currentStart = i; }
      else if (item.id === "formula-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "formulas"; currentStart = i; }
      else if (item.id === "case-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "cases"; currentStart = i; }
      else if (item.id === "app-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "applications"; currentStart = i; }
      else if (item.id === "diagram-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "diagrams"; currentStart = i; }
      else if (item.id === "fc-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "flashcards"; currentStart = i; }
      else if (item.id === "q-header") { sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: i }); currentKey = "questions"; currentStart = i; }
    }
    if (audioItems.length > 0) {
      sectionRanges.push({ key: currentKey, startIdx: currentStart, endIdx: audioItems.length });
    }

    for (const range of sectionRanges) {
      const sectionItems = audioItems.slice(range.startIdx, range.endIdx);
      const completed = sectionItems.filter(item => completedSegmentIds.has(item.id)).length;
      progress[range.key] = { completed, total: sectionItems.length };
    }

    return progress;
  }, [audioItems, completedSegmentIds]);

  const totalCompleted = useMemo(
    () => audioItems.filter(item => completedSegmentIds.has(item.id)).length,
    [audioItems, completedSegmentIds]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Start full track playback
  const startFullPlayback = useCallback(() => {
    if (audioItems.length === 0) {
      toast.error("No audio content available for this track yet.");
      return;
    }
    audio.enqueue(audioItems);
    sessionStartRef.current = Date.now();
    segmentsPlayedRef.current = 0;
    toast.success(`Started audio study: ${audioItems.length} segments`);
  }, [audioItems, audio]);

  // Play a specific chapter
  const playChapter = useCallback((chapterIdx: number) => {
    const ch = chapters[chapterIdx];
    if (!ch) return;
    const startIdx = audioItems.findIndex(item => item.id === `ch-intro-${ch.id}`);
    if (startIdx < 0) return;
    const nextChapter = chapters[chapterIdx + 1];
    let endIdx = audioItems.length;
    if (nextChapter) {
      const nextStart = audioItems.findIndex(item => item.id === `ch-intro-${nextChapter.id}`);
      if (nextStart > startIdx) endIdx = nextStart;
    } else {
      for (let i = startIdx + 1; i < audioItems.length; i++) {
        if (audioItems[i].id.endsWith("-header") && !audioItems[i].id.startsWith("ch-")) {
          endIdx = i;
          break;
        }
      }
    }
    const slice = audioItems.slice(startIdx, endIdx);
    if (slice.length > 0) {
      audio.dismiss();
      audio.enqueue(slice);
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
      toast.success(`Playing chapter: ${ch.title} (${slice.length} segments)`);
    } else {
      toast.info("No audio content for this chapter yet.");
    }
  }, [chapters, audioItems, audio]);

  // Play a specific content section
  const playSection = useCallback((headerId: string) => {
    const startIdx = audioItems.findIndex(item => item.id === headerId);
    if (startIdx < 0) return;
    let endIdx = audioItems.length;
    for (let i = startIdx + 1; i < audioItems.length; i++) {
      if (audioItems[i].id.endsWith("-header")) {
        endIdx = i;
        break;
      }
    }
    const slice = audioItems.slice(startIdx, endIdx);
    if (slice.length > 0) {
      audio.dismiss();
      audio.enqueue(slice);
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    }
  }, [audioItems, audio]);

  // ── Play a single review item and open rating dialog after ──
  const playReviewItem = useCallback((item: { segmentId: string; segmentTitle: string; segmentType: string; trackSlug: string }) => {
    // Find the matching AudioItem from the full list
    const audioItem = audioItems.find(ai => ai.id === item.segmentId);
    if (audioItem) {
      audio.dismiss();
      audio.enqueue([audioItem]);
      reviewStartRef.current = Date.now();
      // Set up the rating dialog to open when this segment completes
      reviewQueueRef.current = [item];
      reviewIndexRef.current = 0;
      setRatingItem(item);
      toast.info(`Reviewing: ${item.segmentTitle}`);
    } else {
      // Item not in current audioItems (different track or filtered out)
      toast.error("This segment is not available in the current view.");
    }
  }, [audioItems, audio]);

  // ── Start review session: enqueue all due items ──
  const startReviewSession = useCallback(() => {
    const dueItems = dueItemsQ.data?.dueItems ?? [];
    if (dueItems.length === 0) {
      toast.info("No items due for review right now.");
      return;
    }
    const reviewAudioItems = dueItems
      .map(di => audioItems.find(ai => ai.id === di.segmentId))
      .filter((ai): ai is AudioItem => !!ai);
    if (reviewAudioItems.length === 0) {
      toast.error("Due items are not available in the current content view.");
      return;
    }
    audio.dismiss();
    audio.enqueue(reviewAudioItems);
    reviewStartRef.current = Date.now();
    // Build review queue and set first item for rating
    reviewQueueRef.current = dueItems.map(di => ({
      segmentId: di.segmentId, segmentTitle: di.segmentTitle,
      segmentType: di.segmentType, trackSlug: di.trackSlug,
    }));
    reviewIndexRef.current = 0;
    setRatingItem(reviewQueueRef.current[0]);
    sessionStartRef.current = Date.now();
    segmentsPlayedRef.current = 0;
    toast.success(`Started review session: ${reviewAudioItems.length} items`);
  }, [dueItemsQ.data, audioItems, audio]);

  // ── Handle rating submission ──
  const submitRating = useCallback((rating: "easy" | "good" | "hard") => {
    if (!ratingItem) return;
    const durationMs = Date.now() - (reviewStartRef.current || Date.now());
    recordReview.mutate({
      trackSlug: ratingItem.trackSlug,
      segmentId: ratingItem.segmentId,
      segmentType: ratingItem.segmentType,
      segmentTitle: ratingItem.segmentTitle,
      durationMs,
      rating,
    }, {
      onSuccess: (result) => {
        const days = Math.round(result.intervalDays);
        const label = rating === "easy" ? "Easy" : rating === "good" ? "Good" : "Hard";
        toast.success(`Rated ${label} — next review in ${days === 0 ? "< 1" : days} day${days !== 1 ? "s" : ""}`);
        utils.learningSocial.audioProgress.getDueItems.invalidate();
        utils.learningSocial.audioProgress.getReviewStats.invalidate();
        utils.learningSocial.audioProgress.getTrackProgress.invalidate();
      },
    });
    setRatingDialogOpen(false);
    // Advance to next review item in queue
    const nextIdx = reviewIndexRef.current + 1;
    reviewIndexRef.current = nextIdx;
    if (nextIdx < reviewQueueRef.current.length) {
      setRatingItem(reviewQueueRef.current[nextIdx]);
      reviewStartRef.current = Date.now();
    } else {
      setRatingItem(null);
      reviewQueueRef.current = [];
      reviewIndexRef.current = 0;
    }
  }, [ratingItem, recordReview, utils]);

  // ── Open rating dialog when a review segment completes ──
  const audioStartedRef = useRef(false);
  useEffect(() => {
    if (!ratingItem) { audioStartedRef.current = false; return; }
    if (audio.playing) { audioStartedRef.current = true; return; }
    // Only open dialog if audio actually started and then stopped
    if (audioStartedRef.current && !audio.playing) {
      setRatingDialogOpen(true);
      audioStartedRef.current = false;
    }
  }, [ratingItem, audio.playing]);

  const isDataLoading = trackQ.isLoading || chaptersQ.isLoading;
  const isContentLoading = contentQ.isLoading;
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

  // Format duration
  const formatDuration = (ms: number) => {
    const totalMin = Math.floor(ms / 60000);
    if (totalMin < 60) return `${totalMin}m`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs}h ${mins}m`;
  };

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
            <div className="min-w-0 flex-1">
              {isDataLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {trackTitle}
                </h1>
              )}
              <div className="text-xs text-muted-foreground font-mono">
                {isDataLoading ? (
                  <Skeleton className="h-3 w-32 mt-1" />
                ) : (
                  `${audioItems.length} segments · ${totalItems} content items`
                )}
              </div>
            </div>
          </div>

          {/* Discipline filter + Content overview bar */}
          <div className="mt-3 flex flex-col gap-2">
            {/* Discipline picker */}
            {disciplines.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                <Select
                  value={selectedDisciplineId !== undefined ? String(selectedDisciplineId) : "all"}
                  onValueChange={(val) => {
                    setSelectedDisciplineId(val === "all" ? undefined : Number(val));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] max-w-[220px]" aria-label="Filter by discipline">
                    <SelectValue placeholder="All Disciplines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Disciplines</SelectItem>
                    {disciplines.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDisciplineId !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setSelectedDisciplineId(undefined)}
                  >
                    Clear
                  </Button>
                )}
                {contentQ.isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
            )}

            {/* Content badges */}
            {!isLoading && totalItems > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {counts.chapters > 0 && <Badge variant="outline" className="text-[10px] gap-1"><BookOpen className="w-2.5 h-2.5" />{counts.chapters} Chapters</Badge>}
                {counts.definitions > 0 && <Badge variant="outline" className="text-[10px] gap-1"><BookOpen className="w-2.5 h-2.5" />{counts.definitions} Definitions</Badge>}
                {counts.formulas > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Calculator className="w-2.5 h-2.5" />{counts.formulas} Formulas</Badge>}
                {counts.cases > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Briefcase className="w-2.5 h-2.5" />{counts.cases} Cases</Badge>}
                {counts.applications > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Lightbulb className="w-2.5 h-2.5" />{counts.applications} FS Apps</Badge>}
                {counts.diagrams > 0 && <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon className="w-2.5 h-2.5" />{counts.diagrams} Diagrams</Badge>}
                {counts.flashcards > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Layers className="w-2.5 h-2.5" />{counts.flashcards} Flashcards</Badge>}
                {counts.questions > 0 && <Badge variant="outline" className="text-[10px] gap-1"><HelpCircle className="w-2.5 h-2.5" />{counts.questions} Questions</Badge>}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-8 max-w-3xl mx-auto space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Study Stats Summary */}
              {(statsQ.data && (statsQ.data.totalSegments > 0 || totalCompleted > 0)) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 border border-border rounded-xl p-3 sm:p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      Audio Study Progress
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">
                        {totalCompleted}<span className="text-xs text-muted-foreground font-normal">/{audioItems.length}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">This Track</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                        <Timer className="w-3.5 h-3.5 text-blue-400" />
                        {formatDuration(statsQ.data.totalDurationMs)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Total Listen Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">
                        {statsQ.data.tracksStudied}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Tracks Studied</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {statsQ.data.streakDays}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Day Streak</div>
                    </div>
                  </div>
                  {/* Track progress bar */}
                  {audioItems.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Track Completion</span>
                        <span>{Math.round((totalCompleted / audioItems.length) * 100)}%</span>
                      </div>
                      <Progress value={(totalCompleted / audioItems.length) * 100} className="h-1.5" />
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── DUE FOR REVIEW (Spaced Repetition) ── */}
              {(dueItemsQ.data && dueItemsQ.data.totalDue > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 border border-amber-500/20 rounded-xl overflow-hidden"
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                            Due for Review
                          </h3>
                          <p className="text-[10px] text-muted-foreground">
                            {dueItemsQ.data.totalDue} item{dueItemsQ.data.totalDue !== 1 ? "s" : ""} ready to reinforce
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-[10px] h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={startReviewSession}
                        aria-label={`Start review session with ${dueItemsQ.data.totalDue} items`}
                      >
                        <Brain className="w-3 h-3" /> Start Review
                      </Button>
                    </div>
                    {/* Review stats mini-bar */}
                    {reviewStatsQ.data && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-1.5 bg-background/40 rounded-lg">
                          <div className="text-sm font-bold text-amber-400">{reviewStatsQ.data.dueNow}</div>
                          <div className="text-[9px] text-muted-foreground">Due Now</div>
                        </div>
                        <div className="text-center p-1.5 bg-background/40 rounded-lg">
                          <div className="text-sm font-bold text-orange-400">{reviewStatsQ.data.dueToday}</div>
                          <div className="text-[9px] text-muted-foreground">Due Today</div>
                        </div>
                        <div className="text-center p-1.5 bg-background/40 rounded-lg">
                          <div className="text-sm font-bold text-emerald-400">{reviewStatsQ.data.mastered}</div>
                          <div className="text-[9px] text-muted-foreground">Mastered</div>
                        </div>
                        <div className="text-center p-1.5 bg-background/40 rounded-lg">
                          <div className="text-sm font-bold text-blue-400">{reviewStatsQ.data.totalReviewed}</div>
                          <div className="text-[9px] text-muted-foreground">Reviewed</div>
                        </div>
                      </div>
                    )}
                    {/* Due items list (max 5 visible, rest behind Start Review) */}
                    <div className="space-y-1">
                      {dueItemsQ.data.dueItems.slice(0, 5).map((item, i) => {
                        const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(item.nextReviewAt!).getTime()) / 86400000));
                        return (
                          <motion.div
                            key={item.segmentId}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-2 p-2 bg-background/30 border border-border/30 rounded-lg hover:bg-background/50 transition-colors group"
                          >
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-none bg-amber-500/10">
                              <Clock className="w-3 h-3 text-amber-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium truncate">{item.segmentTitle}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {item.segmentType} · {item.repetitions} review{item.repetitions !== 1 ? "s" : ""}
                                {overdueDays > 0 && <span className="text-amber-400"> · {overdueDays}d overdue</span>}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={() => playReviewItem(item)}
                              aria-label={`Review ${item.segmentTitle}`}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        );
                      })}
                      {dueItemsQ.data.totalDue > 5 && (
                        <p className="text-[10px] text-muted-foreground text-center pt-1">
                          +{dueItemsQ.data.totalDue - 5} more — click Start Review to begin
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Play All button */}
              <Button
                onClick={startFullPlayback}
                disabled={audioItems.length === 0}
                className="w-full py-3 gap-2"
                aria-label={audio.playing ? "Pause audio playback" : `Play all ${audioItems.length} audio segments`}
                size="lg"
              >
                {audio.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {audio.playing ? "Playing..." : `Play All (${audioItems.length} segments)`}
              </Button>

              {/* Content progress */}
              {audioItems.length > 0 && audio.queueIndex > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Current Session</span>
                    <span>{audio.queueIndex} / {audioItems.length}</span>
                  </div>
                  <Progress value={(audio.queueIndex / audioItems.length) * 100} className="h-1.5" />
                </div>
              )}

              {/* ── CHAPTERS ── */}
              {chapters.length > 0 && (
                <ContentSection
                  title="Chapters"
                  icon={BookOpen}
                  color="#3B82F6"
                  count={chapters.length}
                  expanded={expandedSections["chapters"] !== false}
                  onToggle={() => toggleSection("chapters")}
                  progress={sectionProgress["chapters"]}
                >
                  <div className="space-y-1.5">
                    {chapters.map((ch: any, i: number) => {
                      const subs = subsectionsByChapter[ch.id] ?? [];
                      const chCompleted = completedSegmentIds.has(`ch-intro-${ch.id}`);
                      return (
                        <motion.div
                          key={ch.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="bg-background/50 border border-border/50 rounded-lg p-3 flex items-center gap-3"
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${chCompleted ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                            {chCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <span className="text-[10px] font-bold text-blue-400">{i + 1}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-medium truncate">{ch.title}</h4>
                            <p className="text-[10px] text-muted-foreground">
                              {subs.length} sections
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => playChapter(i)}
                            className="gap-1 text-[10px] h-7 px-2 flex-none"
                          >
                            <Play className="w-2.5 h-2.5" /> Play
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                </ContentSection>
              )}

              {/* ── DEFINITIONS ── */}
              {counts.definitions > 0 && (
                <ContentSection
                  title="Key Definitions"
                  icon={BookOpen}
                  color="#3B82F6"
                  count={counts.definitions}
                  expanded={expandedSections["definitions"] ?? false}
                  onToggle={() => toggleSection("definitions")}
                  onPlay={() => playSection("def-header")}
                  progress={sectionProgress["definitions"]}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {content!.definitions.slice(0, 15).map((d) => (
                      <Badge
                        key={d.id}
                        variant="outline"
                        className={`text-[10px] ${completedSegmentIds.has(`def-${d.id}`) ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}
                      >
                        {completedSegmentIds.has(`def-${d.id}`) && <CheckCircle2 className="w-2 h-2 text-emerald-400 mr-0.5" />}
                        {d.term}
                      </Badge>
                    ))}
                    {counts.definitions > 15 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">+{counts.definitions - 15} more</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    All definitions are included in the audio playback with clear term-definition pairs.
                  </p>
                </ContentSection>
              )}

              {/* ── FORMULAS ── */}
              {counts.formulas > 0 && (
                <ContentSection
                  title="Financial Formulas"
                  icon={Calculator}
                  color="#10B981"
                  count={counts.formulas}
                  expanded={expandedSections["formulas"] ?? false}
                  onToggle={() => toggleSection("formulas")}
                  onPlay={() => playSection("formula-header")}
                  progress={sectionProgress["formulas"]}
                >
                  <div className="space-y-1.5">
                    {content!.formulas.slice(0, 6).map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-xs">
                        {completedSegmentIds.has(`formula-${f.id}`) ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-none" />
                        ) : (
                          <Calculator className="w-3 h-3 text-emerald-400 flex-none" />
                        )}
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground font-mono text-[10px] truncate">{f.formula}</span>
                      </div>
                    ))}
                    {counts.formulas > 6 && (
                      <p className="text-[10px] text-muted-foreground">+{counts.formulas - 6} more formulas</p>
                    )}
                  </div>
                </ContentSection>
              )}

              {/* ── CASE STUDIES ── */}
              {counts.cases > 0 && (
                <ContentSection
                  title="Case Studies"
                  icon={Briefcase}
                  color="#F59E0B"
                  count={counts.cases}
                  expanded={expandedSections["cases"] ?? false}
                  onToggle={() => toggleSection("cases")}
                  onPlay={() => playSection("case-header")}
                  progress={sectionProgress["cases"]}
                >
                  <div className="space-y-1.5">
                    {content!.cases.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs">
                        {completedSegmentIds.has(`case-${c.id}`) ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-none mt-0.5" />
                        ) : (
                          <Briefcase className="w-3 h-3 text-amber-400 flex-none mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{c.title}</span>
                          <p className="text-[10px] text-muted-foreground truncate">{c.content.slice(0, 100)}...</p>
                        </div>
                      </div>
                    ))}
                    {counts.cases > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{counts.cases - 5} more cases</p>
                    )}
                  </div>
                </ContentSection>
              )}

              {/* ── FS APPLICATIONS ── */}
              {counts.applications > 0 && (
                <ContentSection
                  title="FS Applications"
                  icon={Lightbulb}
                  color="#8B5CF6"
                  count={counts.applications}
                  expanded={expandedSections["applications"] ?? false}
                  onToggle={() => toggleSection("applications")}
                  onPlay={() => playSection("app-header")}
                  progress={sectionProgress["applications"]}
                >
                  <div className="space-y-1.5">
                    {content!.applications.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        {completedSegmentIds.has(`app-${a.id}`) ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-none mt-0.5" />
                        ) : (
                          <Lightbulb className="w-3 h-3 text-violet-400 flex-none mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{a.title}</span>
                          <p className="text-[10px] text-muted-foreground truncate">{a.content.slice(0, 100)}...</p>
                        </div>
                      </div>
                    ))}
                    {counts.applications > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{counts.applications - 5} more applications</p>
                    )}
                  </div>
                </ContentSection>
              )}

              {/* ── DIAGRAMS / GRAPHICAL AIDS ── */}
              {diagrams.length > 0 && (
                <ContentSection
                  title="Graphical Aids"
                  icon={ImageIcon}
                  color="#EC4899"
                  count={diagrams.length}
                  expanded={expandedSections["diagrams"] ?? false}
                  onToggle={() => toggleSection("diagrams")}
                  onPlay={() => playSection("diagram-header")}
                  progress={sectionProgress["diagrams"]}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {diagrams.slice(0, 4).map((d, i) => (
                      <div key={d.id ?? i} className="bg-background/50 border border-border/50 rounded-lg p-2">
                        {d.url && (
                          <img
                            src={d.url}
                            alt={d.title}
                            className="w-full h-20 object-cover rounded mb-1.5"
                            loading="lazy"
                          />
                        )}
                        <p className="text-[10px] font-medium truncate">{d.title}</p>
                        {d.description && (
                          <p className="text-[9px] text-muted-foreground line-clamp-2">{d.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {diagrams.length > 4 && (
                    <p className="text-[10px] text-muted-foreground mt-2">+{diagrams.length - 4} more diagrams</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Audio descriptions of each diagram are included in the playback.
                  </p>
                </ContentSection>
              )}

              {/* ── FLASHCARDS ── */}
              {counts.flashcards > 0 && (
                <ContentSection
                  title="Flashcard Review"
                  icon={Layers}
                  color="#06B6D4"
                  count={counts.flashcards}
                  expanded={expandedSections["flashcards"] ?? false}
                  onToggle={() => toggleSection("flashcards")}
                  onPlay={() => playSection("fc-header")}
                  progress={sectionProgress["flashcards"]}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {content!.flashcards.slice(0, 12).map((fc) => (
                      <Badge
                        key={fc.id}
                        variant="outline"
                        className={`text-[10px] ${completedSegmentIds.has(`fc-${fc.id}`) ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}
                      >
                        {completedSegmentIds.has(`fc-${fc.id}`) && <CheckCircle2 className="w-2 h-2 text-emerald-400 mr-0.5" />}
                        {fc.term}
                      </Badge>
                    ))}
                    {counts.flashcards > 12 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">+{counts.flashcards - 12} more</Badge>
                    )}
                  </div>
                </ContentSection>
              )}

              {/* ── PRACTICE QUESTIONS ── */}
              {counts.questions > 0 && (
                <ContentSection
                  title="Practice Questions"
                  icon={HelpCircle}
                  color="#EF4444"
                  count={counts.questions}
                  expanded={expandedSections["questions"] ?? false}
                  onToggle={() => toggleSection("questions")}
                  onPlay={() => playSection("q-header")}
                  progress={sectionProgress["questions"]}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {counts.questions} questions with answers and detailed explanations are included in the audio playback.
                    Each question is read aloud with all options, the correct answer, and the explanation.
                  </p>
                </ContentSection>
              )}

              {/* ── CONNECTIONS ── */}
              {counts.connections > 0 && (
                <ContentSection
                  title="Concept Connections"
                  icon={GitBranch}
                  color="#6366F1"
                  count={counts.connections}
                  expanded={expandedSections["connections"] ?? false}
                  onToggle={() => toggleSection("connections")}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {counts.connections} concept connections showing how key ideas relate across disciplines.
                    <Link href="/learning/connections" className="text-primary ml-1 hover:underline">
                      View Connection Map →
                    </Link>
                  </p>
                </ContentSection>
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

      {/* ── RATING DIALOG (Spaced Repetition) ── */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Brain className="w-4 h-4 text-amber-400" />
              Rate Your Recall
            </DialogTitle>
            <DialogDescription className="text-xs">
              How well did you remember <strong>{ratingItem?.segmentTitle}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-col gap-1.5 h-auto py-4 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
              onClick={() => submitRating("hard")}
            >
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-xs font-semibold text-red-400">Hard</span>
              <span className="text-[9px] text-muted-foreground">Review soon</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col gap-1.5 h-auto py-4 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all"
              onClick={() => submitRating("good")}
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-amber-400">Good</span>
              <span className="text-[9px] text-muted-foreground">Normal pace</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col gap-1.5 h-auto py-4 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all"
              onClick={() => submitRating("easy")}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-400">Easy</span>
              <span className="text-[9px] text-muted-foreground">Extend interval</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Your rating adjusts when this content appears again for review.
          </p>
        </DialogContent>
      </Dialog>
    </LearningShell>
  );
}

/* ── ContentSection — collapsible card with play button + progress ── */
function ContentSection({
  title,
  icon: Icon,
  color,
  count,
  expanded,
  onToggle,
  onPlay,
  progress,

  children,
}: {
  title: string;
  icon: any;
  color: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onPlay?: () => void;
  progress?: { completed: number; total: number };

  children: React.ReactNode;
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isComplete = pct === 100 && progress && progress.total > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden ${isComplete ? "border-emerald-500/30" : "border-border"}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-accent/30 transition-colors"
        aria-expanded={expanded}
        aria-label={`${title} section, ${count} items${progress && progress.completed > 0 ? `, ${progress.completed} completed` : ""}`}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-none"
          style={{ backgroundColor: isComplete ? "rgba(16,185,129,0.1)" : `${color}15` }}
        >
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Icon className="w-4 h-4" style={{ color }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {title}
            </h3>
            {progress && progress.completed > 0 && (
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1.5 ${isComplete ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}`}
              >
                {progress.completed}/{progress.total}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{count} items</p>
            {progress && progress.total > 0 && pct > 0 && pct < 100 && (
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {onPlay && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="gap-1 text-[10px] h-7 px-2 flex-none"
          >
            <Play className="w-2.5 h-2.5" /> Play
          </Button>
        )}
        <div className="flex-none">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
