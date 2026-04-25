/**
 * Learning Engine — Restructured into workflow tabs with progressive disclosure.
 *
 * Tab structure:
 *   Overview  — KPIs + Learning Plan + Recommendations (what you see first)
 *   Study     — Exam tracks + Study tools (the doing)
 *   Reference — Deep dive, case studies, concept map, study buddy (the learning)
 *   Manage    — Licenses, achievements, content studio, regulatory (the tracking)
 *
 * All existing functionality preserved, just reorganized into a coherent workflow.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Calculator, FileText,
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
import { BenchmarkGrid } from "@/components/InlineBenchmark";
import { CascadeFlowIndicator, type CascadeStage } from "@/components/CascadeFlowIndicator";
import { DisclosureSection } from "@/components/DisclosureSection";

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

  return (
    <LearningShell title="Learning">
      <SEOHead title="Learning & Licensing" description="Track exam mastery, manage licenses, and access study tools" />
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">

        {/* ─── GUEST SIGN-IN CTA ─── */}
        {isGuest && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="py-4 flex flex-col sm:flex-row items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-semibold text-foreground">Welcome to the Learning Engine</p>
                <p className="text-xs text-muted-foreground mt-0.5">Browse exam tracks and content freely. Sign in to track progress, take quizzes, and unlock personalized study tools.</p>
              </div>
              <a href={getLoginUrl("/learning")}>
                <Button size="sm" className="gap-1.5 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  Sign in to unlock
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* ─── BREADCRUMB BAR — matches Wealth Engine pattern ─── */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-lg border border-border px-3 py-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
            <Link href="/">
              <span className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                <Home className="w-3 h-3" />
                <span className="hidden sm:inline">Home</span>
              </span>
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-foreground font-medium flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Learning Engine
            </span>
            {activeTab !== "overview" && (
              <>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-foreground font-medium">
                  {TABS.find(t => t.id === activeTab)?.label ?? activeTab}
                </span>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {tracks.length} tracks{isAuthenticated ? ` · ${activeLicenses} licenses · ${summary?.masteryPct ?? 0}% mastery` : ""}
            </span>
            <Link href="/learning/search">
              <Button variant="ghost" size="sm" className="h-7 text-xs"><Search className="h-3.5 w-3.5 mr-1" />Search</Button>
            </Link>
            {isAdvisorPlus && (
              <Link href="/learning/studio">
                <Button variant="ghost" size="sm" className="h-7 text-xs"><Sparkles className="h-3.5 w-3.5 mr-1" />Studio</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Error banner */}
        {hasError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-foreground/90">Some data failed to load.</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { summaryQ.refetch(); licensesQ.refetch(); tracksQ.refetch(); }}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── TAB BAR ─── */}
        <div className="flex gap-1 p-1 bg-card rounded-lg border border-border overflow-x-auto" role="tablist">
          {TABS.filter(tab => !isGuest || tab.id === "overview" || tab.id === "study" || tab.id === "reference").map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-background hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="hidden sm:inline text-[10px] text-muted-foreground/60">{tab.description}</span>
              </button>
            );
          })}
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="space-y-4" role="tabpanel">
          {activeTab === "overview" && (
            isGuest ? (
              <GuestOverviewTab tracks={tracks} tracksLoading={tracksQ.isLoading} />
            ) : (
              <OverviewTab
                summary={summary}
                streak={streak}
                activeLicenses={activeLicenses}
                expiringSoon={expiringSoon}
                recs={recs}
                tracks={tracks}
                recentTracks={recentTracks}
              />
            )
          )}
          {activeTab === "study" && (
            <StudyTab tracks={tracks} tracksLoading={tracksQ.isLoading} isAdmin={isAdmin} recentTracks={recentTracks} summary={summary} />
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
   GUEST OVERVIEW TAB — Public preview with tracks + benchmarks
   ═══════════════════════════════════════════════════════════════════════════ */

function GuestOverviewTab({ tracks, tracksLoading }: { tracks: any[]; tracksLoading: boolean }) {
  // Group tracks by category
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tracks) {
      const cat = t.category ?? "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <Card className="border-primary/20">
        <CardContent className="py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Explore Exam Tracks</h2>
              <p className="text-xs text-muted-foreground">Browse {tracks.length} exam tracks covering securities, insurance, and financial planning</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-card border border-border/50">
              <div className="text-xl font-bold text-foreground">{tracks.length}</div>
              <div className="text-[10px] text-muted-foreground">Exam Tracks</div>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border/50">
              <div className="text-xl font-bold text-foreground">{grouped.length}</div>
              <div className="text-[10px] text-muted-foreground">Categories</div>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border/50">
              <div className="text-xl font-bold text-foreground">
                {tracks.reduce((sum: number, t: any) => sum + (t.questionCount ?? 0), 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Questions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Track grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" />
            Available Tracks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracksLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-lg bg-card/50 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([category, catTracks]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {catTracks.map((t: any) => (
                      <Link key={t.id} href={`/learning/tracks/${t.slug}`}>
                        <Card className="card-lift cursor-pointer h-full">
                          <CardContent className="p-3">
                            <div className="text-xl">{t.emoji ?? "📘"}</div>
                            <div className="font-semibold text-sm mt-1.5">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.subtitle ?? t.description ?? ""}</div>
                            <div className="flex items-center gap-1.5 mt-2">
                              <Badge variant="outline" className="text-[9px]">{t.chapterCount ?? 0} sections</Badge>
                              {(t.questionCount ?? 0) > 0 && (
                                <Badge variant="outline" className="text-[9px]">{t.questionCount} Q</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

function OverviewTab({ summary, streak, activeLicenses, expiringSoon, recs, tracks, recentTracks }: {
  summary: any;
  streak: StreakSummary;
  activeLicenses: number;
  expiringSoon: number;
  recs: any[];
  tracks: any[];
  recentTracks: RecentTrack[];
}) {
  /* Compute today's priority action */
  const todayAction = (() => {
    if ((summary?.dueNow ?? 0) > 0) return { label: `Review ${summary.dueNow} due items`, href: "/learning/review", icon: RotateCcw, urgency: "high" as const };
    if (expiringSoon > 0) return { label: `${expiringSoon} license(s) expiring soon`, href: "/learning/licenses", icon: AlertTriangle, urgency: "high" as const };
    if (streak.status === "at-risk") return { label: "Study today to keep your streak", href: "/learning/review", icon: Flame, urgency: "medium" as const };
    if (recentTracks.length > 0) return { label: `Continue: ${recentTracks[0].name}`, href: `/learning/tracks/${recentTracks[0].slug}`, icon: BookOpen, urgency: "low" as const };
    if (tracks.length > 0) return { label: "Start your first exam track", href: `/learning/tracks/${tracks[0]?.slug ?? ""}`, icon: GraduationCap, urgency: "low" as const };
    return { label: "Explore available tracks", href: "/learning/search", icon: Search, urgency: "low" as const };
  })();

  return (
    <div className="space-y-4">
      {/* ─── TODAY'S PRIORITY ACTION ─── */}
      <Card className={`border-l-4 ${
        todayAction.urgency === "high" ? "border-l-red-500 bg-red-500/5" :
        todayAction.urgency === "medium" ? "border-l-amber-500 bg-amber-500/5" :
        "border-l-primary bg-primary/5"
      }`}>
        <CardContent className="py-3 flex items-center gap-3">
          <todayAction.icon className={`w-5 h-5 shrink-0 ${
            todayAction.urgency === "high" ? "text-red-500" :
            todayAction.urgency === "medium" ? "text-amber-500" :
            "text-primary"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today's Priority</p>
            <p className="text-sm font-medium text-foreground">{todayAction.label}</p>
          </div>
          <Link href={todayAction.href}>
            <Button size="sm" className="gap-1.5 shrink-0">
              <ChevronRight className="w-3.5 h-3.5" />
              Go
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Mastery"
          value={`${summary?.masteryPct ?? 0}%`}
          detail={`${summary?.mastered ?? 0} mastered / ${summary?.total ?? 0} tracked`}
          progress={summary?.masteryPct ?? 0}
        />
        <StreakCard streak={streak} />
        <KPICard
          label="Due Now"
          value={String(summary?.dueNow ?? 0)}
          detail="items ready for review"
          action={summary?.dueNow ? { label: "Start review", href: "/learning/review" } : undefined}
        />
        <KPICard
          label="Licenses"
          value={String(activeLicenses)}
          detail={expiringSoon > 0 ? `${expiringSoon} expiring soon` : "all healthy"}
          detailWarning={expiringSoon > 0}
          action={{ label: "View tracker", href: "/learning/licenses" }}
        />
      </div>

      {/* Weekly Progress Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Weekly Study Goal</span>
            <span className="text-xs text-muted-foreground">{Math.min(streak.current, 7)}/7 days</span>
          </div>
          <Progress value={Math.min((streak.current / 7) * 100, 100)} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {streak.current >= 7 ? "Goal met! Keep the momentum going." :
             streak.current > 0 ? `${7 - Math.min(streak.current, 7)} more days to hit your weekly goal` :
             "Start studying to build your weekly streak"}
          </p>
        </CardContent>
      </Card>

      {/* Learning Plan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" />
            My Learning Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LearningPlanSteps summary={summary} tracks={tracks} activeLicenses={activeLicenses} expiringSoon={expiringSoon} streak={streak} />
        </CardContent>
      </Card>

      {/* Continue Studying */}
      {recentTracks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              Continue Studying
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentTracks.map((rt) => {
                const age = Math.round((Date.now() - rt.lastVisited) / 60000);
                const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
                return (
                  <Link key={rt.slug} href={`/learning/tracks/${rt.slug}`}>
                    <Card className="card-lift cursor-pointer min-w-[140px] flex-shrink-0">
                      <CardContent className="p-3">
                        <div className="text-2xl">{rt.emoji}</div>
                        <div className="font-medium text-sm mt-1 line-clamp-1">{rt.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{ageStr}</div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── INDUSTRY BENCHMARKS — exam pass rates, CE requirements ─── */}
      <DisclosureSection minLevel={1} label="Industry Benchmarks">
        <BenchmarkGrid
          title="Licensing & CE Context"
          items={[
            {
              label: "SIE Pass Rate",
              value: "74%",
              source: "FINRA SIE Exam Statistics 2024",
              status: "neutral",
            },
            {
              label: "Series 7 Pass Rate",
              value: "72%",
              source: "FINRA Series 7 Exam Statistics 2024",
              status: "neutral",
            },
            {
              label: "Series 66 Pass Rate",
              value: "73%",
              source: "NASAA Series 66 Statistics 2024",
              status: "neutral",
            },
            {
              label: "CFP Pass Rate",
              value: "67%",
              source: "CFP Board Exam Statistics 2024",
              status: "warning",
            },
            {
              label: "Avg CE Hours/Year",
              value: "25 hrs",
              source: "FINRA Regulatory Element + State CE requirements",
              status: "neutral",
            },
            {
              label: "Ethics CE Required",
              value: "3-6 hrs",
              source: "Most state insurance departments require 3-6 ethics CE hours biennially",
              status: "neutral",
            },
            {
              label: "Avg Study Hours",
              value: "80-120 hrs",
              source: "Kaplan Financial Education 2024 — recommended study time per FINRA exam",
              status: "neutral",
            },
            {
              label: "Designation Premium",
              value: "+15-25%",
              source: "Kitces Research 2024 — advisors with CFP earn 15-25% more than non-credentialed peers",
              status: "positive",
            },
          ]}
        />
      </DisclosureSection>

      {/* Recommendations */}
      {recs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recs.map((r, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 rounded-md border">
                  <Badge variant="outline" className="text-[10px]">P{r.priority}</Badge>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.reason}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.action}{r.estimatedMinutes ? ` · ${r.estimatedMinutes} min` : ""}{r.trackSlug ? ` · ${r.trackSlug}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STUDY TAB — Exam tracks + Study tools (the doing)
   ═══════════════════════════════════════════════════════════════════════════ */

function StudyTab({ tracks, tracksLoading, isAdmin, recentTracks, summary }: {
  tracks: any[];
  tracksLoading: boolean;
  isAdmin: boolean;
  recentTracks: RecentTrack[];
  summary: any;
}) {
  return (
    <div className="space-y-4">
      {/* ─── PROMINENT QUICK ACTIONS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {summary?.dueNow > 0 && (
          <Link href="/learning/review">
            <Card className="card-lift cursor-pointer border-primary/30 bg-primary/5 h-full">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <RotateCcw className="h-5 w-5 text-primary" />
                <div className="text-sm font-bold text-primary">{summary.dueNow}</div>
                <div className="text-[10px] text-muted-foreground">Items due for review</div>
              </CardContent>
            </Card>
          </Link>
        )}
        {recentTracks.length > 0 && (
          <Link href={`/learning/tracks/${recentTracks[0].slug}`}>
            <Card className="card-lift cursor-pointer h-full">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <BookOpen className="h-5 w-5 text-primary" />
                <div className="text-xs font-medium">Continue</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{recentTracks[0].name}</div>
              </CardContent>
            </Card>
          </Link>
        )}
        <Link href="/learning/search">
          <Card className="card-lift cursor-pointer h-full">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
              <Search className="h-5 w-5 text-primary" />
              <div className="text-xs font-medium">Find Tracks</div>
              <div className="text-[10px] text-muted-foreground">Browse all content</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/learning/review">
          <Card className="card-lift cursor-pointer h-full">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
              <Brain className="h-5 w-5 text-primary" />
              <div className="text-xs font-medium">Review</div>
              <div className="text-[10px] text-muted-foreground">Spaced repetition</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Continue studying — recent tracks */}
      {recentTracks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Continue Where You Left Off</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentTracks.map((rt) => {
                const age = Math.round((Date.now() - rt.lastVisited) / 60000);
                const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
                return (
                  <Link key={rt.slug} href={`/learning/tracks/${rt.slug}`}>
                    <Card className="card-lift cursor-pointer min-w-[130px] flex-shrink-0">
                      <CardContent className="p-3">
                        <div className="text-xl">{rt.emoji}</div>
                        <div className="font-medium text-xs mt-1 line-clamp-1">{rt.name}</div>
                        <div className="text-[10px] text-muted-foreground">{ageStr}</div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exam Tracks Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" />
            Exam Tracks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracksLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-lg bg-card/50 animate-pulse" />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No tracks available yet.{isAdmin && " Run the admin seed from the Learning Studio."}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tracks.map((t: any) => (
                <Link key={t.id} href={`/learning/tracks/${t.slug}`}>
                  <Card className="card-lift cursor-pointer h-full">
                    <CardContent className="p-3">
                      <div className="text-xl">{t.emoji ?? "📘"}</div>
                      <div className="font-semibold text-sm mt-1.5">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.subtitle ?? t.description ?? ""}</div>
                      <Badge variant="outline" className="mt-2 text-[9px]">{t.category}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Study Tools */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5" />
            Study Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tracks.length > 0 && (
              <ToolCardWithTrackPicker icon={<ClipboardCheck className="h-5 w-5 text-primary" />} title="Practice Exam" description="Timed, adaptive, or audio" tracks={tracks} buildHref={(slug) => `/learning/exam/${slug}`} />
            )}
            {tracks.length > 0 && (
              <ToolCardWithTrackPicker icon={<Layers className="h-5 w-5 text-primary" />} title="Flashcards" description="Spaced repetition cards" tracks={tracks} buildHref={(slug) => `/learning/tracks/${slug}/study`} />
            )}
            {tracks.length > 0 && (
              <ToolCardWithTrackPicker icon={<HelpCircle className="h-5 w-5 text-primary" />} title="Quiz" description="Test your knowledge" tracks={tracks} buildHref={(slug) => `/learning/tracks/${slug}/quiz`} />
            )}
            <Link href="/learning/review">
              <Card className="card-lift cursor-pointer h-full">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <div className="text-sm font-medium">Due Review</div>
                  <div className="text-[10px] text-muted-foreground">Spaced repetition</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFERENCE TAB — Deep learning tools (concept exploration)
   ═══════════════════════════════════════════════════════════════════════════ */

function ReferenceTab({ tracks }: { tracks: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deep Dive */}
        {tracks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Deep Dive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Explore definitions, formulas, and detailed explanations by track.</p>
              <div className="space-y-1">
                {tracks.slice(0, 6).map((t: any) => (
                  <Link key={t.slug} href={`/learning/discipline/${t.slug}`}>
                    <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent/10 transition-colors flex items-center gap-2">
                      <span>{t.emoji ?? "📘"}</span>
                      <span>{t.name}</span>
                    </button>
                  </Link>
                ))}
                {tracks.length > 6 && (
                  <Link href="/learning/search">
                    <button className="w-full text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent/10 transition-colors">
                      View all {tracks.length} tracks →
                    </button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Case Studies */}
        {tracks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-5 w-5" />
                Case Studies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Branching scenario decisions to test applied knowledge.</p>
              <div className="space-y-1">
                {tracks.slice(0, 6).map((t: any) => (
                  <Link key={t.slug} href={`/learning/case/${t.slug}`}>
                    <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent/10 transition-colors flex items-center gap-2">
                      <span>{t.emoji ?? "📘"}</span>
                      <span>{t.name}</span>
                    </button>
                  </Link>
                ))}
                {tracks.length > 6 && (
                  <Link href="/learning/search">
                    <button className="w-full text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent/10 transition-colors">
                      View all {tracks.length} tracks →
                    </button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Concept Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-5 w-5" />
              Concept Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Visual graph of interconnected concepts across all tracks.</p>
            <Link href="/learning/connections">
              <Button variant="outline" size="sm">Open Concept Map →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Formulas Reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-5 w-5" />
              Formulas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Browse all financial formulas by discipline with examples and audio.</p>
            <Link href="/learning/formulas">
              <Button variant="outline" size="sm">Browse Formulas →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* FS Toolkit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              FS Toolkit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Financial statement applications checklist and analysis tools.</p>
            <Link href="/learning/fs-toolkit">
              <Button variant="outline" size="sm">Open FS Toolkit →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Cross-Discipline Connections */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5" />
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Browse cross-discipline connections and see how concepts relate.</p>
            <Link href="/learning/connections-browse">
              <Button variant="outline" size="sm">Browse Connections →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* All Tracks Index */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5" />
              All Tracks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Browse all exam tracks organized by discipline with progress.</p>
            <Link href="/learning/tracks">
              <Button variant="outline" size="sm">Browse Tracks →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Cases Browse */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5" />
              Cases Library
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Browse all case studies with difficulty ratings and discipline tags.</p>
            <Link href="/learning/cases">
              <Button variant="outline" size="sm">Browse Cases →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Study Buddy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Study Buddy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">AI-powered study partner for interactive learning sessions.</p>
            <Link href="/learning/study-buddy">
              <Button variant="outline" size="sm">Start Session →</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGE TAB — Licenses, achievements, content studio, regulatory
   ═══════════════════════════════════════════════════════════════════════════ */

function ManageTab({ activeLicenses, expiringSoon, isAdvisorPlus, isAdmin }: {
  activeLicenses: number;
  expiringSoon: number;
  isAdvisorPlus: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* License Tracker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              License Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="text-2xl font-semibold">{activeLicenses}</div>
                <div className="text-xs text-muted-foreground">active licenses</div>
              </div>
              {expiringSoon > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-600/5">
                  {expiringSoon} expiring soon
                </Badge>
              )}
            </div>
            <Link href="/learning/licenses">
              <Button variant="outline" size="sm">Manage Licenses →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Streaks, goals, and milestones earned through study.</p>
            <Link href="/learning/achievements">
              <Button variant="outline" size="sm">View Achievements →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Content Studio (advisor+) */}
        {isAdvisorPlus && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5" />
                Content Studio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Create and manage learning content for your team.</p>
              <Link href="/learning/studio">
                <Button variant="outline" size="sm">Open Studio →</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Regulatory Pipeline (admin) */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5" />
                Regulatory Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Review pending regulatory updates and compliance items.</p>
              <Link href="/learning/studio/review">
                <Button variant="outline" size="sm">Review Queue →</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function KPICard({ label, value, detail, detailWarning, progress, action }: {
  label: string;
  value: string;
  detail: string;
  detailWarning?: boolean;
  progress?: number;
  action?: { label: string; href: string };
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {progress !== undefined && <Progress value={progress} className="mt-1.5 h-1.5" />}
        <div className={`text-[11px] mt-1.5 ${detailWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          {detail}
        </div>
        {action && (
          <Link href={action.href}>
            <Button variant="link" size="sm" className="px-0 mt-0.5 h-auto text-xs">{action.label} →</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function StreakCard({ streak }: { streak: StreakSummary }) {
  const isActive = streak.status === "active";
  const isAtRisk = streak.status === "at-risk";
  const isNone = streak.status === "none";
  const isBroken = streak.status === "broken";

  const tone = isActive ? "text-accent" : isAtRisk ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  const label = isNone ? "Start a streak" : isActive ? "day streak" : isAtRisk ? "study today to keep it" : "last session";

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Flame className={`h-3.5 w-3.5 ${tone}`} />Streak
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${tone}`}>{streak.current}</div>
        <div className="text-[11px] text-muted-foreground mt-1.5">{label}</div>
        {streak.longest > 0 && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            longest {streak.longest}{streak.lastDay && isBroken && ` · last ${streak.lastDay}`}
          </div>
        )}
        {isAtRisk && (
          <Link href="/learning/review">
            <Button variant="link" size="sm" className="px-0 mt-0.5 h-auto text-xs text-amber-600">Save streak →</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

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
    },
    {
      label: "Complete Exam Tracks",
      status: completedTracks >= tracks.length && tracks.length > 0 ? "done" as const : completedTracks > 0 ? "active" as const : "upcoming" as const,
      detail: tracks.length > 0 ? `${completedTracks}/${tracks.length} tracks completed` : "No tracks enrolled yet",
      href: "/learning/search",
    },
    {
      label: "Maintain Licenses",
      status: activeLicenses > 0 && expiringSoon === 0 ? "done" as const : activeLicenses > 0 ? "active" as const : "upcoming" as const,
      detail: activeLicenses > 0 ? `${activeLicenses} active${expiringSoon > 0 ? `, ${expiringSoon} expiring soon` : ""}` : "Add your first license",
      href: "/learning/licenses",
    },
    {
      label: "Build Study Habit",
      status: streak.current >= 7 ? "done" as const : streak.current > 0 ? "active" as const : "upcoming" as const,
      detail: streak.current > 0 ? `${streak.current}-day streak (longest: ${streak.longest})` : "Start a daily study streak",
      href: "/learning/review",
    },
  ];

  return (
    <div className="space-y-1.5">
      {steps.map((item, idx) => (
        <Link key={idx} href={item.href}>
          <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors hover:bg-accent/5 ${
            item.status === "done" ? "border-emerald-500/20 bg-emerald-500/5" :
            item.status === "active" ? "border-primary/20 bg-primary/5" :
            "border-border/40"
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-none ${
              item.status === "done" ? "bg-emerald-500/20 text-emerald-500" :
              item.status === "active" ? "bg-primary/20 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {item.status === "done" ? "✓" : idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.detail}</p>
            </div>
            <Badge variant="outline" className={`text-[9px] h-5 ${
              item.status === "done" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
              item.status === "active" ? "bg-primary/10 text-primary border-primary/20" : ""
            }`}>
              {item.status === "done" ? "Complete" : item.status === "active" ? "In Progress" : "Upcoming"}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ToolCardWithTrackPicker({ icon, title, description, tracks, buildHref }: {
  icon: ReactNode;
  title: string;
  description: string;
  tracks: { slug: string; name: string; emoji?: string | null }[];
  buildHref: (slug: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="card-lift cursor-pointer h-full" role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}>
      <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
        {icon}
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        {open && (
          <div className="w-full mt-1 space-y-0.5 text-left" onClick={(e) => e.stopPropagation()}>
            {tracks.map(t => (
              <Link key={t.slug} href={buildHref(t.slug)}>
                <button type="button" className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-secondary/60 transition-colors truncate">
                  {t.emoji && <span className="mr-1">{t.emoji}</span>}{t.name}
                </button>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
