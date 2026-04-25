/**
 * AudioStudyPage.tsx — Track-specific Audio Study player
 *
 * Pass 160. Full Knowledge Explorer parity: fetches ALL 7 content types
 * (definitions, formulas, cases, applications, subsections, flashcards,
 * questions) via getHandsFreeContent(trackId), plus diagrams from
 * track.examOverview. Builds comprehensive TTS scripts covering every
 * content dimension the Knowledge Explorer offers.
 *
 * Route: /learning/audio/:slug
 *
 * Content sections displayed:
 * - Chapters with subsection content
 * - Definitions / Key Terms
 * - Formulas with variable explanations
 * - Case Studies
 * - FS Applications
 * - Diagrams / Graphical Aids (from examOverview)
 * - Flashcards
 * - Practice Questions
 * - Concept Connections (from listConnections)
 */
import { useState, useMemo, useCallback } from "react";
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
  ArrowLeft, Headphones, Play, Pause,
  BookOpen, Layers, Loader2, LogIn, HelpCircle,
  Calculator, Briefcase, Lightbulb, Image as ImageIcon,
  GitBranch, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";


export default function AudioStudyPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/learning/audio/:slug");
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();

  // ── Fetch track ──
  const trackQ = trpc.learning.content.getTrackBySlug.useQuery({ slug }, { enabled: !!slug });
  const track = trackQ.data;

  // ── Fetch chapters (for chapter navigation) ──
  const chaptersQ = trpc.learning.content.listChapters.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track?.id }
  );
  const chapters = chaptersQ.data ?? [];

  // ── Fetch ALL content via getHandsFreeContent (single query, all 7 types) ──
  const contentQ = trpc.learning.content.getHandsFreeContent.useQuery(
    {
      trackId: track?.id ?? 0,
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
      // After last chapter, find the first non-chapter section header
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
      toast.success(`Playing chapter: ${ch.title} (${slice.length} segments)`);
    } else {
      toast.info("No audio content for this chapter yet.");
    }
  }, [chapters, audioItems, audio]);

  // Play a specific content section
  const playSection = useCallback((headerId: string) => {
    const startIdx = audioItems.findIndex(item => item.id === headerId);
    if (startIdx < 0) return;
    // Find next header
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
    }
  }, [audioItems, audio]);

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

          {/* Content overview bar */}
          {!isLoading && totalItems > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
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

        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-8 max-w-3xl mx-auto space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
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

              {/* Content progress */}
              {audioItems.length > 0 && audio.queueIndex > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Progress</span>
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
                >
                  <div className="space-y-1.5">
                    {chapters.map((ch: any, i: number) => {
                      const subs = subsectionsByChapter[ch.id] ?? [];
                      return (
                        <motion.div
                          key={ch.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="bg-background/50 border border-border/50 rounded-lg p-3 flex items-center gap-3"
                        >
                          <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center flex-none">
                            <span className="text-[10px] font-bold text-blue-400">{i + 1}</span>
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
                >
                  <div className="flex flex-wrap gap-1.5">
                    {content!.definitions.slice(0, 15).map((d) => (
                      <Badge key={d.id} variant="outline" className="text-[10px]">{d.term}</Badge>
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
                >
                  <div className="space-y-1.5">
                    {content!.formulas.slice(0, 6).map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-xs">
                        <Calculator className="w-3 h-3 text-emerald-400 flex-none" />
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
                >
                  <div className="space-y-1.5">
                    {content!.cases.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs">
                        <Briefcase className="w-3 h-3 text-amber-400 flex-none mt-0.5" />
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
                >
                  <div className="space-y-1.5">
                    {content!.applications.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <Lightbulb className="w-3 h-3 text-violet-400 flex-none mt-0.5" />
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
                >
                  <div className="flex flex-wrap gap-1.5">
                    {content!.flashcards.slice(0, 12).map((fc) => (
                      <Badge key={fc.id} variant="outline" className="text-[10px]">{fc.term}</Badge>
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
    </LearningShell>
  );
}

/* ── ContentSection — collapsible card with play button ── */
function ContentSection({
  title,
  icon: Icon,
  color,
  count,
  expanded,
  onToggle,
  onPlay,
  children,
}: {
  title: string;
  icon: any;
  color: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onPlay?: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-accent/30 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-none"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h3>
          <p className="text-[10px] text-muted-foreground">{count} items</p>
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
