/**
 * TracksIndex.tsx — Exam & Learning Tracks (Learning Engine parity)
 *
 * Matches the reference Learning Engine Track Library:
 * - Aggregate stats header (tracks, chapters, questions, flashcards)
 * - Category-grouped track cards with rich metadata
 * - Section counts, mastery progress bars, quick action buttons
 * - Public access (no auth gate for browsing)
 */
import { useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, BookOpen, GraduationCap, Sparkles, HelpCircle,
  Layers, ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

/* ─── Category metadata ─── */
const CATEGORY_META: Record<string, { label: string; description: string; icon: string; color: string }> = {
  mba: {
    label: "MBA Curriculum",
    description: "Comprehensive MBA curriculum covering 8 core disciplines and specializations with integrated financial services applications.",
    icon: "🎓",
    color: "#8B5CF6",
  },
  securities: {
    label: "Securities Licenses",
    description: "FINRA securities licensing tracks including SIE, Series 7, and Series 66 exam preparation.",
    icon: "🛡️",
    color: "#4F46E5",
  },
  planning: {
    label: "Financial Planning",
    description: "CFP, ChFC, and comprehensive financial planning designation tracks.",
    icon: "📋",
    color: "#059669",
  },
  insurance: {
    label: "Insurance & Risk",
    description: "Insurance licensing, risk management, and actuarial exam preparation.",
    icon: "🔒",
    color: "#D97706",
  },
  wealth: {
    label: "Wealth Management",
    description: "Advanced wealth management, estate planning, and fiduciary practice tracks.",
    icon: "💎",
    color: "#0891B2",
  },
  compliance: {
    label: "Compliance & Ethics",
    description: "Regulatory compliance, ethics, and anti-money laundering certification tracks.",
    icon: "⚖️",
    color: "#DC2626",
  },
  custom: {
    label: "Additional Tracks",
    description: "Custom and imported study tracks for specialized topics.",
    icon: "📚",
    color: "#7C3AED",
  },
};

const CATEGORY_ORDER = ["mba", "securities", "planning", "insurance", "wealth", "compliance", "custom"];

/* ─── Section count helper (from DB subsections) ─── */
function computeSectionCount(track: any): number {
  // Use sectionCount if available from the API, otherwise estimate from chapters
  return track.sectionCount ?? (track.chapterCount ?? 0) * 3;
}

export default function TracksIndex() {
  const { isAuthenticated } = useAuth();
  // Public procedure — no auth required
  const tracksQ = trpc.learning.content.listTracks.useQuery();
  // Per-track mastery for authenticated users
  const masteryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: isAuthenticated });

  const tracks = tracksQ.data ?? [];

  // Aggregate stats
  const stats = useMemo(() => {
    let chapters = 0, questions = 0, flashcards = 0, sections = 0;
    tracks.forEach((t: any) => {
      chapters += t.chapterCount ?? 0;
      questions += t.questionCount ?? 0;
      flashcards += t.flashcardCount ?? 0;
      sections += computeSectionCount(t);
    });
    return { tracks: tracks.length, chapters, questions, flashcards, sections };
  }, [tracks]);

  // Group by category
  const categorized = useMemo(() => {
    const map: Record<string, any[]> = {};
    tracks.forEach((t: any) => {
      const cat = t.category ?? "custom";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return CATEGORY_ORDER
      .filter((cat) => map[cat]?.length)
      .map((cat) => ({ key: cat, tracks: map[cat] }));
  }, [tracks]);

  return (
    <LearningShell>
      <SEOHead title="Exam & Learning Tracks" description="Browse all exam tracks, study modules, and learning content" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 border-b border-border/50">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Exam & Learning Tracks</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12 leading-relaxed max-w-2xl">
            {stats.tracks > 0 ? (
              <>
                <span className="font-medium text-foreground">{stats.tracks} licensed tracks</span>
                {" · "}
                {stats.chapters} chapters
                {" · "}
                {stats.questions} practice questions
                {" · "}
                {stats.flashcards} flashcards.{" "}
                <span className="text-muted-foreground/70">
                  Sourced from the WealthBridge Library and the Master Study Manual.
                </span>
              </>
            ) : (
              "Loading track library…"
            )}
          </p>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-10">
          {tracksQ.isLoading ? (
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((j) => <Skeleton key={j} className="h-48 rounded-xl" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : categorized.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No tracks available yet.</p>
            </div>
          ) : (
            categorized.map(({ key: cat, tracks: list }, ci) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.custom;
              return (
                <motion.section
                  key={cat}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.08 }}
                >
                  {/* Category header */}
                  <div className="flex items-start gap-3 mb-5">
                    <span className="text-2xl" aria-hidden>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">{meta.label}</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground shrink-0 mt-1">
                      {list.length} {list.length === 1 ? "track" : "tracks"}
                    </span>
                  </div>

                  {/* Track cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((track: any, i: number) => (
                      <TrackCard key={track.id} track={track} meta={meta} index={i} masteryPct={masteryQ.data?.masteryPct ?? 0} />
                    ))}
                  </div>
                </motion.section>
              );
            })
          )}
        </div>
      </div>
    </LearningShell>
  );
}

/* ─── Track Card (matches Learning Engine reference) ─── */
function TrackCard({ track, meta, index, masteryPct }: { track: any; meta: any; index: number; masteryPct: number }) {
  const sections = computeSectionCount(track);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all h-full flex flex-col">
        {/* Color accent bar */}
        <div className="h-[3px]" style={{ background: meta.color }} />

        {/* Card content */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Header: emoji + question count badge */}
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xl" aria-hidden>{track.emoji ?? "📘"}</span>
            {(track.questionCount ?? 0) > 0 && (
              <Badge variant="outline" className="text-[9px] font-mono">
                {track.questionCount} QUESTIONS
              </Badge>
            )}
          </div>

          {/* Title + subtitle */}
          <Link href={`/learning/tracks/${track.slug}`}>
            <h3 className="text-sm font-semibold mb-0.5 group-hover:text-primary transition-colors cursor-pointer">
              {track.title ?? track.name}
            </h3>
          </Link>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {track.subtitle ?? track.description ?? ""}
          </p>

          {/* Stats row: chapters / sections / cards */}
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{track.chapterCount ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">chapters</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{sections}</div>
              <div className="text-[10px] text-muted-foreground">sections</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{track.flashcardCount ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">cards</div>
            </div>
          </div>

          {/* Mastery progress */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-muted-foreground">{Math.round(masteryPct * ((track.flashcardCount ?? 0) + (track.questionCount ?? 0)) / 100)}/{(track.flashcardCount ?? 0) + (track.questionCount ?? 0)} mastered</span>
            <Progress value={masteryPct} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground">{masteryPct}%</span>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <Link href={`/learning/tracks/${track.slug}`}>
              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 gap-1">
                <Layers className="h-3 w-3" /> Study
              </Button>
            </Link>
            {(track.questionCount ?? 0) > 0 && (
              <Link href={`/learning/tracks/${track.slug}/quiz`}>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 gap-1">
                  <HelpCircle className="h-3 w-3" /> Quiz
                </Button>
              </Link>
            )}
            {(track.flashcardCount ?? 0) > 0 && (
              <Link href={`/learning/tracks/${track.slug}/study`}>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 gap-1">
                  <Sparkles className="h-3 w-3" /> Cards
                </Button>
              </Link>
            )}
            <Link href={`/learning/tracks/${track.slug}`} className="ml-auto">
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
