/**
 * Learning Engine — Comprehensive dashboard with Knowledge Explorer design system.
 *
 * Tab structure:
 *   Overview  — KPIs + Learning Plan + Recommendations (what you see first)
 *   Study     — Exam tracks + Study tools (the doing)
 *   Reference — Deep dive, case studies, concept map, study buddy (the learning)
 *   Manage    — Licenses, achievements, content studio, regulatory (the tracking)
 *
 * Design system inherited from Knowledge Explorer (The Atelier):
 * - Animated card entries with framer-motion spring physics
 * - Color accent bars on cards (2px top border)
 * - Mastery progress bars with animated width
 * - Module cards with icon badges and hover reveal
 * - Quick action rows with arrow indicators
 * - Cross-track reference sections
 * - font-display on all headings
 * - font-mono on metadata/counts
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, GraduationCap, Shield, Sparkles, TrendingUp, Brain, Award,
  ClipboardCheck, Scale, Flame, Search, ChevronDown, AlertTriangle, Layers,
  HelpCircle, Users, RotateCcw, Settings, FolderOpen, Home, ChevronRight,
  Calculator, FileText, BarChart3, Bookmark, ListMusic, FileDown, History,
  ArrowRight, Trophy, Target, Zap, PlayCircle, Clock, Headphones,
  Network, GitBranch, Map, Beaker, Library, ScrollText, Download,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  loadStreakFromStorage,
  summarizeStreak,
  type StreakSummary,
} from "./lib/studyStreak";
import {
  loadRecentTracks,
  getRecentTracks,
  type RecentTrack,
} from "./lib/recentTracks";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { BenchmarkGrid } from "@/components/InlineBenchmark";
import { CascadeFlowIndicator, type CascadeStage } from "@/components/CascadeFlowIndicator";
import { DisclosureSection } from "@/components/DisclosureSection";

/* ─── Category metadata (matches TracksIndex) ─── */
const CATEGORY_META: Record<string, { label: string; description: string; icon: string; color: string }> = {
  mba: { label: "MBA Curriculum", description: "8 core disciplines and specializations with integrated financial services applications.", icon: "🎓", color: "#8B5CF6" },
  securities: { label: "Securities Licenses", description: "FINRA securities licensing — SIE, Series 7, and Series 66 exam preparation.", icon: "🛡️", color: "#4F46E5" },
  planning: { label: "Financial Planning", description: "CFP, ChFC, and comprehensive financial planning designation tracks.", icon: "📋", color: "#059669" },
  insurance: { label: "Insurance & Risk", description: "Insurance licensing, risk management, and actuarial exam preparation.", icon: "🔒", color: "#D97706" },
  wealth: { label: "Wealth Management", description: "Advanced wealth management, estate planning, and fiduciary practice.", icon: "💎", color: "#0891B2" },
  compliance: { label: "Compliance & Ethics", description: "Regulatory compliance, ethics, and anti-money laundering certification.", icon: "⚖️", color: "#DC2626" },
  custom: { label: "Additional Tracks", description: "Custom and imported study tracks for specialized topics.", icon: "📚", color: "#7C3AED" },
};
const CATEGORY_ORDER = ["mba", "securities", "planning", "insurance", "wealth", "compliance", "custom"];

/* ─── Tab definitions ─── */
type LearningTab = "overview" | "study" | "reference" | "manage";

const TABS: { id: LearningTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "overview", label: "Overview", icon: Home, description: "Progress & plan" },
  { id: "study", label: "Study", icon: BookOpen, description: "Tracks & practice" },
  { id: "reference", label: "Reference", icon: Brain, description: "Deep learning" },
  { id: "manage", label: "Manage", icon: Settings, description: "Licenses & admin" },
];

export default function LearningHome() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Tab state
  const [activeTab, setActiveTab] = useState<LearningTab>("overview");

  // All hooks MUST be called before any conditional returns
  const meQ = trpc.auth.me.useQuery(undefined, { enabled: !!isAuthenticated });
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const licensesQ = trpc.learning.licenses.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const alertsQ = trpc.learning.licenses.alerts.useQuery(undefined, { enabled: !!isAuthenticated });
  const recsQ = trpc.learning.recommendations.forMe.useQuery(undefined, { enabled: !!isAuthenticated });
  const tracksQ = trpc.learning.content.listTracks.useQuery(undefined);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      summaryQ.refetch(),
      licensesQ.refetch(),
      alertsQ.refetch(),
      recsQ.refetch(),
      tracksQ.refetch(),
    ]);
  }, [summaryQ, licensesQ, alertsQ, recsQ, tracksQ]);
  const { pullRef, isRefreshing, pullProgress, pullDistance } = usePullToRefresh({ onRefresh: handlePullRefresh });

  const [streak, setStreak] = useState<StreakSummary>({
    current: 0, longest: 0, lastDay: null, status: "none",
  });
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  useEffect(() => {
    const read = () => {
      setStreak(summarizeStreak(loadStreakFromStorage(), new Date()));
      setRecentTracks(getRecentTracks(loadRecentTracks(), 4));
    };
    read();
    const onFocus = () => read();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }
  const isGuest = !isAuthenticated;

  const role = meQ.data?.role ?? "user";
  const isAdvisorPlus = isAuthenticated && (role === "advisor" || role === "manager" || role === "admin");
  const isAdmin = isAuthenticated && role === "admin";

  const summary = summaryQ.data;
  const licenses = licensesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const recs = recsQ.data ?? [];
  const tracks = tracksQ.data ?? [];

  const hasError = isAuthenticated && (summaryQ.isError || licensesQ.isError || tracksQ.isError);
  const activeLicenses = licenses.filter((l: any) => l.status === "active").length;
  const expiringSoon = alerts.filter((a: any) => a.alertType === "expiration_warning").length;

  // Aggregate stats
  const stats = useMemo(() => {
    let chapters = 0, questions = 0, flashcards = 0;
    tracks.forEach((t: any) => {
      chapters += t.chapterCount ?? 0;
      questions += t.questionCount ?? 0;
      flashcards += t.flashcardCount ?? 0;
    });
    return { tracks: tracks.length, chapters, questions, flashcards };
  }, [tracks]);

  return (
    <LearningShell title="Learning">
      <SEOHead title="Learning & Licensing" description="Track exam mastery, manage licenses, and access study tools" />
      <div ref={pullRef as any} className="min-h-screen">
        <PullToRefreshIndicator pullDistance={pullDistance} pullProgress={pullProgress} isRefreshing={isRefreshing} />

        {/* ─── GUEST SIGN-IN CTA ─── */}
        {isGuest && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 sm:mx-6 lg:mx-8 mt-4">
            <div className="relative p-5 rounded-xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/20 shrink-0">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Welcome to the Learning Engine</h2>
                  <p className="text-xs text-muted-foreground mt-1">Browse exam tracks and content freely. Sign in to track progress, take quizzes, and unlock personalized study tools.</p>
                </div>
                <a href={getLoginUrl("/learning")}>
                  <Button size="sm" className="gap-1.5 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                    Sign in to unlock
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── HEADER with stats ─── */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 border-b border-border/50">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                <Home className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <GraduationCap className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>
              Learning Engine
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12 leading-relaxed max-w-2xl">
            {stats.tracks > 0 ? (
              <>
                <span className="font-medium text-foreground">{stats.tracks} licensed tracks</span>
                {" · "}{stats.chapters} chapters{" · "}{stats.questions.toLocaleString()} practice questions{" · "}{stats.flashcards.toLocaleString()} flashcards.
                {isAuthenticated && (
                  <span className="text-muted-foreground/70">
                    {" · "}{summary?.masteryPct ?? 0}% mastery{" · "}{activeLicenses} licenses
                  </span>
                )}
              </>
            ) : "Loading track library…"}
          </p>

          {/* Overall progress bar (authenticated) */}
          {isAuthenticated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-3 max-w-md ml-12">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{summary?.total ?? 0} studied · {summary?.mastered ?? 0} mastered</span>
                <span className="font-mono">{summary?.masteryPct ?? 0}%</span>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${summary?.masteryPct ?? 0}%` }}
                  transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Error banner */}
        {hasError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4">
            <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-foreground/90">Some data failed to load.</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { summaryQ.refetch(); licensesQ.refetch(); tracksQ.refetch(); }}>Retry</Button>
            </div>
          </div>
        )}

        {/* ─── TAB BAR ─── */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex gap-1 p-1 bg-card rounded-xl border border-border overflow-x-auto scrollbar-none" role="tablist">
            {TABS.filter(tab => !isGuest || tab.id === "overview" || tab.id === "study" || tab.id === "reference").map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-background hover:text-foreground border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{tab.label}</span>
                  <span className="hidden lg:inline text-[10px] text-muted-foreground/60">{tab.description}</span>
                </button>
              );
            })}

            {/* Quick actions in tab bar — hidden on small screens to save space */}
            <div className="ml-auto hidden sm:flex items-center gap-1.5 shrink-0">
              <Link href="/learning/search">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Search className="h-3.5 w-3.5" />Search</Button>
              </Link>
              {isAdvisorPlus && (
                <Link href="/learning/studio">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Sparkles className="h-3.5 w-3.5" />Studio</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="px-4 sm:px-6 lg:px-8 py-6" role="tabpanel">
          {activeTab === "overview" && (
            isGuest ? (
              <GuestOverviewTab tracks={tracks} tracksLoading={tracksQ.isLoading} stats={stats} />
            ) : (
              <OverviewTab
                summary={summary}
                streak={streak}
                activeLicenses={activeLicenses}
                expiringSoon={expiringSoon}
                recs={recs}
                tracks={tracks}
                recentTracks={recentTracks}
                stats={stats}
              />
            )
          )}
          {activeTab === "study" && (
            <StudyTab tracks={tracks} tracksLoading={tracksQ.isLoading} isAdmin={isAdmin} recentTracks={recentTracks} summary={summary} stats={stats} />
          )}
          {activeTab === "reference" && (
            <ReferenceTab tracks={tracks} />
          )}
          {activeTab === "manage" && (
            <ManageTab
              activeLicenses={activeLicenses}
              expiringSoon={expiringSoon}
              isAdvisorPlus={isAdvisorPlus}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </LearningShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GUEST OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function GuestOverviewTab({ tracks, tracksLoading, stats }: { tracks: any[]; tracksLoading: boolean; stats: any }) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    tracks.forEach((t: any) => {
      const cat = t.category ?? "custom";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return CATEGORY_ORDER.filter(c => map[c]?.length).map(c => ({ key: c, tracks: map[c] }));
  }, [tracks]);

  return (
    <div className="space-y-10">
      {/* Track grid by category */}
      {tracksLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 rounded-xl bg-card/50 animate-pulse border border-border/30" />
          ))}
        </div>
      ) : (
        grouped.map(({ key: cat, tracks: list }, ci) => {
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.custom;
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  <span className="text-lg">{meta.icon}</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>{meta.label}</h2>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <span className="ml-auto text-xs font-mono text-muted-foreground">{list.length} {list.length === 1 ? "track" : "tracks"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {list.map((track: any, i: number) => (
                  <TrackCard key={track.id} track={track} color={meta.color} index={i} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Industry Benchmarks */}
      <DisclosureSection minLevel={1} label="Industry Benchmarks">
        <BenchmarkGrid
          title="Licensing & CE Context"
          items={[
            { label: "SIE Pass Rate", value: "74%", source: "FINRA SIE Exam Statistics 2024", status: "neutral" },
            { label: "Series 7 Pass Rate", value: "72%", source: "FINRA Series 7 Exam Statistics 2024", status: "neutral" },
            { label: "Series 66 Pass Rate", value: "73%", source: "NASAA Series 66 Statistics 2024", status: "neutral" },
            { label: "CFP Pass Rate", value: "67%", source: "CFP Board Exam Statistics 2024", status: "warning" },
          ]}
        />
      </DisclosureSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB — KPIs + Learning Plan + Recommendations + Continue Studying
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewTab({ summary, streak, activeLicenses, expiringSoon, recs, tracks, recentTracks, stats }: {
  summary: any;
  streak: StreakSummary;
  activeLicenses: number;
  expiringSoon: number;
  recs: any[];
  tracks: any[];
  recentTracks: RecentTrack[];
  stats: any;
}) {
  const todayAction = (() => {
    if ((summary?.dueNow ?? 0) > 0) return { label: `Review ${summary.dueNow} due items`, href: "/learning/review", icon: RotateCcw, urgency: "high" as const };
    if (expiringSoon > 0) return { label: `${expiringSoon} license(s) expiring soon`, href: "/learning/licenses", icon: AlertTriangle, urgency: "high" as const };
    if (streak.status === "at-risk") return { label: "Study today to keep your streak", href: "/learning/review", icon: Flame, urgency: "medium" as const };
    if (recentTracks.length > 0) return { label: `Continue: ${recentTracks[0].name}`, href: `/learning/tracks/${recentTracks[0].slug}`, icon: BookOpen, urgency: "low" as const };
    if (tracks.length > 0) return { label: "Start your first exam track", href: `/learning/tracks/${tracks[0]?.slug ?? ""}`, icon: GraduationCap, urgency: "low" as const };
    return { label: "Explore available tracks", href: "/learning/search", icon: Search, urgency: "low" as const };
  })();

  return (
    <div className="space-y-8">
      {/* ─── TODAY'S PRIORITY ACTION ─── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href={todayAction.href}>
          <div className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer group overflow-hidden ${
            todayAction.urgency === "high" ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10" :
            todayAction.urgency === "medium" ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10" :
            "border-primary/30 bg-primary/5 hover:bg-primary/10"
          }`}>
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${
              todayAction.urgency === "high" ? "bg-red-500" :
              todayAction.urgency === "medium" ? "bg-amber-500" :
              "bg-primary"
            }`} />
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                todayAction.urgency === "high" ? "bg-red-500/20" :
                todayAction.urgency === "medium" ? "bg-amber-500/20" :
                "bg-primary/20"
              }`}>
                <todayAction.icon className={`w-6 h-6 ${
                  todayAction.urgency === "high" ? "text-red-500" :
                  todayAction.urgency === "medium" ? "text-amber-500" :
                  "text-primary"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Today's Priority</p>
                <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-bold)" }}>{todayAction.label}</h3>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mastery" value={`${summary?.masteryPct ?? 0}%`} detail={`${summary?.mastered ?? 0} mastered / ${summary?.total ?? 0} tracked`} progress={summary?.masteryPct ?? 0} color="#8B5CF6" icon={Target} delay={0.05} />
        <StreakStatCard streak={streak} delay={0.1} />
        <StatCard label="Due Now" value={String(summary?.dueNow ?? 0)} detail="items ready for review" color="#F59E0B" icon={Clock} delay={0.15} action={summary?.dueNow ? { label: "Start review", href: "/learning/review" } : undefined} />
        <StatCard label="Licenses" value={String(activeLicenses)} detail={expiringSoon > 0 ? `${expiringSoon} expiring soon` : "all healthy"} detailWarning={expiringSoon > 0} color="#059669" icon={Shield} delay={0.2} action={{ label: "View tracker", href: "/learning/licenses" }} />
      </div>

      {/* Weekly Progress */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="p-5 rounded-xl border border-border bg-card"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-bold)" }}>Weekly Study Goal</span>
          <span className="text-xs font-mono text-muted-foreground">{Math.min(streak.current, 7)}/7 days</span>
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((streak.current / 7) * 100, 100)}%` }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-primary"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
          {streak.current >= 7 ? "Goal met! Keep the momentum going." :
           streak.current > 0 ? `${7 - Math.min(streak.current, 7)} more days to hit your weekly goal` :
           "Start studying to build your weekly streak"}
        </p>
      </motion.div>

      {/* Learning Plan */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>My Learning Plan</h2>
        </div>
        <LearningPlanSteps summary={summary} tracks={tracks} activeLicenses={activeLicenses} expiringSoon={expiringSoon} streak={streak} />
      </section>

      {/* Continue Studying */}
      {recentTracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Continue Studying</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentTracks.map((rt, i) => {
              const age = Math.round((Date.now() - rt.lastVisited) / 60000);
              const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
              return (
                <Link key={rt.slug} href={`/learning/tracks/${rt.slug}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2 }}
                    className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                    <div className="text-2xl mb-2">{rt.emoji}</div>
                    <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-bold)" }}>{rt.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{ageStr}</p>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Industry Benchmarks */}
      <DisclosureSection minLevel={1} label="Industry Benchmarks">
        <BenchmarkGrid
          title="Licensing & CE Context"
          items={[
            { label: "SIE Pass Rate", value: "74%", source: "FINRA SIE Exam Statistics 2024", status: "neutral" },
            { label: "Series 7 Pass Rate", value: "72%", source: "FINRA Series 7 Exam Statistics 2024", status: "neutral" },
            { label: "Series 66 Pass Rate", value: "73%", source: "NASAA Series 66 Statistics 2024", status: "neutral" },
            { label: "CFP Pass Rate", value: "67%", source: "CFP Board Exam Statistics 2024", status: "warning" },
            { label: "Avg CE Hours/Year", value: "25 hrs", source: "FINRA Regulatory Element + State CE requirements", status: "neutral" },
            { label: "Ethics CE Required", value: "3-6 hrs", source: "Most state insurance departments require 3-6 ethics CE hours biennially", status: "neutral" },
            { label: "Avg Study Hours", value: "80-120 hrs", source: "Kaplan Financial Education 2024 — recommended study time per FINRA exam", status: "neutral" },
            { label: "Designation Premium", value: "+15-25%", source: "Kitces Research 2024 — advisors with CFP earn 15-25% more than non-credentialed peers", status: "positive" },
          ]}
        />
      </DisclosureSection>

      {/* Recommendations */}
      {recs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Personalized Recommendations</h2>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">{recs.length} suggestions</Badge>
          </div>
          <div className="space-y-2">
            {recs.map((r: any, idx: number) => {
              const priorityColors: Record<number, { bg: string; border: string; icon: string; badge: string }> = {
                1: { bg: "bg-red-500/5", border: "border-red-500/20 hover:border-red-500/40", icon: "text-red-500", badge: "bg-red-500/10 text-red-600 dark:text-red-400" },
                2: { bg: "bg-amber-500/5", border: "border-amber-500/20 hover:border-amber-500/40", icon: "text-amber-500", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                3: { bg: "bg-blue-500/5", border: "border-blue-500/20 hover:border-blue-500/40", icon: "text-blue-500", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
              };
              const pc = priorityColors[r.priority] ?? { bg: "bg-muted/30", border: "border-border hover:border-primary/30", icon: "text-muted-foreground", badge: "bg-muted text-muted-foreground" };
              const PriorityIcon = r.priority === 1 ? AlertTriangle : r.priority === 2 ? Clock : Sparkles;
              const actionHref = r.trackSlug ? `/learning/tracks/${r.trackSlug}` : r.priority === 1 ? "/learning/review" : "/learning";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${pc.border} ${pc.bg} transition-all`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${pc.badge}`}>
                    <PriorityIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${pc.badge}`}>
                        {r.priority === 1 ? "URGENT" : r.priority === 2 ? "IMPORTANT" : r.priority <= 4 ? "SUGGESTED" : "OPTIONAL"}
                      </span>
                      {r.estimatedMinutes && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{r.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-bold)" }}>{r.reason}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.action}</div>
                    <Link href={actionHref}>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary">
                        {r.priority === 1 ? "Start Review" : r.trackSlug ? "Open Track" : "Take Action"}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STUDY TAB — KE-style with Mastery Modules + Category-grouped tracks
   ═══════════════════════════════════════════════════════════════════════════ */

function StudyTab({ tracks, tracksLoading, isAdmin, recentTracks, summary, stats }: {
  tracks: any[];
  tracksLoading: boolean;
  isAdmin: boolean;
  recentTracks: RecentTrack[];
  summary: any;
  stats: any;
}) {
  // Group tracks by category
  const categorized = useMemo(() => {
    const map: Record<string, any[]> = {};
    tracks.forEach((t: any) => {
      const cat = t.category ?? "custom";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return CATEGORY_ORDER.filter(c => map[c]?.length).map(c => ({ key: c, tracks: map[c] }));
  }, [tracks]);

  return (
    <div className="space-y-10">

      {/* ─── DUE ITEMS BANNER ─── */}
      {(summary?.dueNow ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/learning/review">
            <div className="relative p-5 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer group overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/20">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-bold)" }}>
                    {summary.dueNow} items due for review
                  </h3>
                  <p className="text-xs text-muted-foreground">Spaced repetition keeps knowledge fresh. Start a review session now.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* ─── MASTERY MODULES (KE-style ModuleCards) ─── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Mastery Modules</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Interactive modules for deep learning, practice, and application.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard href="/learning/exam/sie" icon={GraduationCap} label="Exam Simulator" desc="Scenario-based questions with timed modes, adaptive difficulty, and performance analytics." accent="#8B5CF6" delay={0.05} badge="Practice" />
          <ModuleCard href="/learning/formula-lab" icon={Calculator} label="Formula Calculator Lab" desc="Interactive calculators for NPV, WACC, Breakeven, Amortization, Premium Financing, and more." accent="#10B981" delay={0.1} badge="6 Calcs" />
          <ModuleCard href="/learning/cases" icon={GitBranch} label="Case Study Simulator" desc="Branching decision scenarios with framework advisor sidebar and consequence modeling." accent="#F59E0B" delay={0.15} badge="Cases" />
          <ModuleCard href="/learning/connections" icon={Map} label="Connection Map" desc="Interactive concept graph showing how key concepts connect across disciplines." accent="#3B82F6" delay={0.2} badge="Visual" />
          <ModuleCard href="/learning/fs-toolkit" icon={Shield} label="FS Practice Toolkit" desc="Client Discovery, Case Design, Compliance, Recruiting ROI, Practice Dashboard, and Meeting Prep." accent="#EF4444" delay={0.25} badge="6 Tools" />
          <ModuleCard href="/learning/search" icon={Search} label="Universal Search" desc="Full-text search across all definitions, formulas, cases, and flashcards." accent="#6366F1" delay={0.3} />
        </div>
      </section>

      {/* ─── CONTINUE STUDYING ─── */}
      {recentTracks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <PlayCircle className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Continue Where You Left Off</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentTracks.map((rt, i) => {
              const age = Math.round((Date.now() - rt.lastVisited) / 60000);
              const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
              return (
                <Link key={rt.slug} href={`/learning/tracks/${rt.slug}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2 }}
                    className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                    <div className="text-2xl mb-2">{rt.emoji}</div>
                    <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-bold)" }}>{rt.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{ageStr}</p>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── EXAM & LEARNING TRACKS (category-grouped, KE-style cards) ─── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Exam & Learning Tracks</h2>
          </div>
          <Link href="/learning/tracks">
            <span className="text-xs font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer">
              Browse all <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          {stats.tracks} licensed tracks · {stats.chapters} chapters · {stats.questions.toLocaleString()} practice questions · {stats.flashcards.toLocaleString()} flashcards
        </p>

        {tracksLoading ? (
          <div className="space-y-8">
            {[1, 2].map(i => (
              <div key={i} className="space-y-4">
                <div className="h-6 w-48 rounded bg-muted/50 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(j => <div key={j} className="h-48 rounded-xl bg-card/50 animate-pulse border border-border/30" />)}
                </div>
              </div>
            ))}
          </div>
        ) : categorized.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No tracks available yet.{isAdmin && " Run the admin seed from the Learning Studio."}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categorized.map(({ key: cat, tracks: list }, ci) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.custom;
              return (
                <motion.section
                  key={cat}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.08 }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <span className="text-lg">{meta.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>{meta.label}</h3>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                    <span className="ml-auto text-xs font-mono text-muted-foreground">{list.length} {list.length === 1 ? "track" : "tracks"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {list.map((track: any, i: number) => (
                      <TrackCard key={track.id} track={track} color={meta.color} index={i} />
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── QUICK STUDY ACTIONS (KE-style) ─── */}
      <section>
        <h2 className="text-lg font-semibold mb-4 tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Quick Study</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction href="/learning/hands-free" icon={Headphones} label="Hands-Free Study" desc="Auto-play TTS through discipline content" delay={0.05} />
          <QuickAction href="/learning/formulas" icon={Calculator} label="Formula Reference" desc="Browse all financial formulas with examples" delay={0.1} />
          <QuickAction href="/learning/ai-quiz" icon={Sparkles} label="AI Quiz" desc="Dynamic questions generated by AI" delay={0.15} />
          <QuickAction href="/learning/connections-browse" icon={Network} label="Concept Links" desc="Cross-discipline connections" delay={0.2} />
          <QuickAction href="/learning/review" icon={RotateCcw} label="Due Review" desc="Spaced repetition session" delay={0.25} />
          <QuickAction href="/learning/study-buddy" icon={Users} label="Study Buddy" desc="AI-powered study partner" delay={0.3} />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFERENCE TAB — Deep learning tools (KE-style ModuleCards)
   ═══════════════════════════════════════════════════════════════════════════ */

function ReferenceTab({ tracks }: { tracks: any[] }) {
  return (
    <div className="space-y-10">
      {/* Reference Tools */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Reference & Deep Learning</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Explore concepts, formulas, and connections across all disciplines.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.length > 0 && (
            <ModuleCard href={`/learning/discipline/${tracks[0]?.slug ?? ""}`} icon={BookOpen} label="Deep Dive" desc="Explore definitions, formulas, and detailed explanations by track." accent="#8B5CF6" delay={0.05} badge={`${tracks.length} tracks`} />
          )}
          <ModuleCard href="/learning/connections" icon={Brain} label="Concept Map" desc="Visual graph of interconnected concepts across all tracks." accent="#3B82F6" delay={0.1} badge="Visual" />
          <ModuleCard href="/learning/formulas" icon={Calculator} label="Formulas" desc="Browse all financial formulas by discipline with examples and audio." accent="#10B981" delay={0.15} />
          <ModuleCard href="/learning/fs-toolkit" icon={FileText} label="FS Toolkit" desc="Financial statement applications checklist and analysis tools." accent="#EF4444" delay={0.2} badge="6 Tools" />
          <ModuleCard href="/learning/connections-browse" icon={Layers} label="Connections" desc="Browse cross-discipline connections and see how concepts relate." accent="#F59E0B" delay={0.25} />
          <ModuleCard href="/learning/tracks" icon={GraduationCap} label="All Tracks" desc="Browse all exam tracks organized by discipline with progress." accent="#6366F1" delay={0.3} badge={`${tracks.length}`} />
        </div>
      </section>

      {/* Case Studies & Study Buddy */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Applied Learning</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard href="/learning/cases" icon={Scale} label="Cases Library" desc="Browse all case studies with difficulty ratings and discipline tags." accent="#D97706" delay={0.05} badge="Cases" />
          <ModuleCard href="/learning/study-buddy" icon={Users} label="Study Buddy" desc="AI-powered study partner for interactive learning sessions." accent="#8B5CF6" delay={0.1} />
          {tracks.length > 0 && tracks.slice(0, 4).map((t: any, i: number) => (
            <Link key={t.slug} href={`/learning/case/${t.slug}`}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                whileHover={{ y: -2 }}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all cursor-pointer"
              >
                <span className="text-xl shrink-0">{t.emoji ?? "📘"}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-bold)" }}>{t.name}</h4>
                  <p className="text-[10px] text-muted-foreground">Case studies</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </motion.div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGE TAB — KE-style QuickAction rows
   ═══════════════════════════════════════════════════════════════════════════ */

function ManageTab({ activeLicenses, expiringSoon, isAdvisorPlus, isAdmin }: {
  activeLicenses: number;
  expiringSoon: number;
  isAdvisorPlus: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-10">
      {/* License Overview */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>License & Compliance</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-bold)" }}>{activeLicenses}</div>
                <div className="text-xs text-muted-foreground">active licenses</div>
              </div>
              {expiringSoon > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-600/5 ml-auto text-[10px] font-mono">
                  {expiringSoon} expiring soon
                </Badge>
              )}
            </div>
            <Link href="/learning/licenses">
              <Button variant="outline" size="sm" className="gap-1.5">Manage Licenses <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Personal Learning */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>My Learning</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction href="/learning/achievements" icon={Trophy} label="Achievements" desc="Streaks, goals, and milestones earned through study" delay={0.05} />
          <QuickAction href="/learning/analytics" icon={BarChart3} label="Study Analytics" desc="Track study time, mastery trends, and performance" delay={0.1} />
          <QuickAction href="/learning/export" icon={Download} label="Progress Report" desc="Export your study progress and CE credits as PDF or CSV" delay={0.15} />
          <QuickAction href="/learning/bookmarks" icon={Bookmark} label="Bookmarks" desc="Saved flashcards, definitions, and study items" delay={0.2} />
          <QuickAction href="/learning/playlists" icon={ListMusic} label="Study Playlists" desc="Curated study playlists you've created or saved" delay={0.25} />
          <QuickAction href="/learning/groups" icon={Users} label="Study Groups" desc="Join or create study groups for collaborative prep" delay={0.3} />
          <QuickAction href="/learning/discovery" icon={History} label="Discovery Log" desc="Your learning journey — recently viewed concepts" delay={0.35} />
        </div>
      </section>

      {/* Admin Tools */}
      {(isAdvisorPlus || isAdmin) && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-bold)" }}>Administration</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isAdvisorPlus && (
              <QuickAction href="/learning/studio" icon={Sparkles} label="Content Studio" desc="Create and manage learning content for your team" delay={0.05} />
            )}
            {isAdmin && (
              <QuickAction href="/learning/studio/review" icon={TrendingUp} label="Regulatory Pipeline" desc="Review pending regulatory updates and compliance items" delay={0.1} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS — KE Design System
   ═══════════════════════════════════════════════════════════════════════════ */

/** ModuleCard — KE-style card with color accent bar, icon badge, and hover reveal */
function ModuleCard({ href, icon: Icon, label, desc, accent, delay, badge }: {
  href: string; icon: any; label: string; desc: string; accent: string; delay: number; badge?: string;
}) {
  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 overflow-hidden h-full cursor-pointer"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accent }} />
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accent}20` }}>
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </div>
          {badge && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground">{badge}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-bold)" }}>{label}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Launch</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </motion.div>
    </Link>
  );
}

/** QuickAction — KE-style horizontal action row */
function QuickAction({ href, icon: Icon, label, desc, delay }: {
  href: string; icon: any; label: string; desc: string; delay: number;
}) {
  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, type: "spring", stiffness: 200 }}
        whileHover={{ x: 4 }}
        className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all cursor-pointer h-full"
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-accent/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold" style={{ fontFamily: "var(--font-bold)" }}>{label}</h4>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </motion.div>
    </Link>
  );
}

/** TrackCard — KE-style with color accent bar, mastery progress, and pill buttons */
function TrackCard({ track, color, index }: { track: any; color: string; index: number }) {
  const sections = track.sectionCount ?? (track.chapterCount ?? 0) * 3;
  const totalItems = (track.flashcardCount ?? 0) + (track.questionCount ?? 0);
  // Placeholder mastery — will be replaced with real per-track mastery
  const pct = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 overflow-hidden h-full flex flex-col"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />

      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl" aria-hidden>{track.emoji ?? "📘"}</span>
        {(track.questionCount ?? 0) > 0 && (
          <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
            {track.questionCount} questions
          </span>
        )}
      </div>

      <Link href={`/learning/tracks/${track.slug}`}>
        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors cursor-pointer" style={{ fontFamily: "var(--font-bold)" }}>
          {track.title ?? track.name}
        </h3>
      </Link>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
        {track.subtitle ?? track.description ?? ""}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground mb-3">
        <div className="flex flex-col">
          <span className="text-foreground font-semibold">{track.chapterCount ?? 0}</span>
          <span>chapters</span>
        </div>
        <div className="flex flex-col">
          <span className="text-foreground font-semibold">{sections}</span>
          <span>sections</span>
        </div>
        <div className="flex flex-col">
          <span className="text-foreground font-semibold">{track.flashcardCount ?? 0}</span>
          <span>cards</span>
        </div>
      </div>

      {/* Mastery progress */}
      {totalItems > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>0/{totalItems} mastered</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="flex items-center gap-1 text-[11px] mt-auto pt-1">
        <Link href={`/learning/tracks/${track.slug}`}>
          <span className="px-2 py-1 rounded-md bg-accent/10 text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1 cursor-pointer">
            <BookOpen className="w-3 h-3" /> Study
          </span>
        </Link>
        {(track.questionCount ?? 0) > 0 && (
          <Link href={`/learning/tracks/${track.slug}/quiz`}>
            <span className="px-2 py-1 rounded-md bg-accent/10 text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1 cursor-pointer">
              <Brain className="w-3 h-3" /> Quiz
            </span>
          </Link>
        )}
        {(track.flashcardCount ?? 0) > 0 && (
          <Link href={`/learning/tracks/${track.slug}/study`}>
            <span className="px-2 py-1 rounded-md bg-accent/10 text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1 cursor-pointer">
              <ListMusic className="w-3 h-3" /> Cards
            </span>
          </Link>
        )}
        <Link href={`/learning/tracks/${track.slug}`} className="ml-auto">
          <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>
    </motion.div>
  );
}

/** StatCard — KE-style stat card with color accent and animated progress */
function StatCard({ label, value, detail, detailWarning, progress, color, icon: Icon, delay, action }: {
  label: string;
  value: string;
  detail: string;
  detailWarning?: boolean;
  progress?: number;
  color: string;
  icon: any;
  delay: number;
  action?: { label: string; href: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="relative bg-card border border-border rounded-xl p-4 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-bold)" }}>{value}</div>
      {progress !== undefined && (
        <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ delay: delay + 0.3, duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      )}
      <div className={`text-[10px] mt-1.5 font-mono ${detailWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
        {detail}
      </div>
      {action && (
        <Link href={action.href}>
          <span className="text-[10px] text-primary hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer">
            {action.label} <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </Link>
      )}
    </motion.div>
  );
}

/** StreakStatCard — specialized stat card for streak */
function StreakStatCard({ streak, delay }: { streak: StreakSummary; delay: number }) {
  const isActive = streak.status === "active";
  const isAtRisk = streak.status === "at-risk";
  const isBroken = streak.status === "broken";
  const color = isActive ? "#F59E0B" : isAtRisk ? "#F59E0B" : "#6B7280";
  const label = streak.status === "none" ? "Start a streak" : isActive ? "day streak" : isAtRisk ? "study today to keep it" : "last session";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="relative bg-card border border-border rounded-xl p-4 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Flame className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Streak</span>
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-bold)", color }}>{streak.current}</div>
      <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">{label}</div>
      {streak.longest > 0 && (
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          longest {streak.longest}{streak.lastDay && isBroken && ` · last ${streak.lastDay}`}
        </div>
      )}
      {isAtRisk && (
        <Link href="/learning/review">
          <span className="text-[10px] text-amber-600 hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer">
            Save streak <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </Link>
      )}
    </motion.div>
  );
}

/** LearningPlanSteps — visual step tracker */
function LearningPlanSteps({ summary, tracks, activeLicenses, expiringSoon, streak }: {
  summary: any; tracks: any[]; activeLicenses: number; expiringSoon: number; streak: StreakSummary;
}) {
  const masteryPct = summary?.masteryPct ?? 0;
  const completedTracks = tracks.filter((t: any) => t.completionPct >= 100).length;

  const steps = [
    {
      label: "Build Core Mastery",
      status: masteryPct >= 80 ? "done" as const : masteryPct > 0 ? "active" as const : "upcoming" as const,
      detail: masteryPct >= 80 ? `${masteryPct}% mastered` : masteryPct > 0 ? `${masteryPct}% — review ${summary?.dueNow ?? 0} due items` : "Start with flashcard review",
      href: "/learning/review",
      color: "#8B5CF6",
    },
    {
      label: "Complete Exam Tracks",
      status: completedTracks >= tracks.length && tracks.length > 0 ? "done" as const : completedTracks > 0 ? "active" as const : "upcoming" as const,
      detail: tracks.length > 0 ? `${completedTracks}/${tracks.length} tracks completed` : "No tracks enrolled yet",
      href: "/learning/search",
      color: "#3B82F6",
    },
    {
      label: "Maintain Licenses",
      status: activeLicenses > 0 && expiringSoon === 0 ? "done" as const : activeLicenses > 0 ? "active" as const : "upcoming" as const,
      detail: activeLicenses > 0 ? `${activeLicenses} active${expiringSoon > 0 ? `, ${expiringSoon} expiring soon` : ""}` : "Add your first license",
      href: "/learning/licenses",
      color: "#059669",
    },
    {
      label: "Build Study Habit",
      status: streak.current >= 7 ? "done" as const : streak.current > 0 ? "active" as const : "upcoming" as const,
      detail: streak.current > 0 ? `${streak.current}-day streak (longest: ${streak.longest})` : "Start a daily study streak",
      href: "/learning/review",
      color: "#F59E0B",
    },
  ];

  return (
    <div className="space-y-2">
      {steps.map((item, idx) => (
        <Link key={idx} href={item.href}>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            whileHover={{ x: 4 }}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
              item.status === "done" ? "border-emerald-500/20 bg-emerald-500/5" :
              item.status === "active" ? "border-primary/20 bg-primary/5" :
              "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-none ${
              item.status === "done" ? "bg-emerald-500/20 text-emerald-500" :
              item.status === "active" ? "bg-primary/20 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {item.status === "done" ? "✓" : idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.status === "done" ? "line-through text-muted-foreground" : ""}`} style={{ fontFamily: "var(--font-bold)" }}>{item.label}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{item.detail}</p>
            </div>
            <Badge variant="outline" className={`text-[9px] font-mono h-5 shrink-0 ${
              item.status === "done" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
              item.status === "active" ? "bg-primary/10 text-primary border-primary/20" : ""
            }`}>
              {item.status === "done" ? "Complete" : item.status === "active" ? "In Progress" : "Upcoming"}
            </Badge>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}
