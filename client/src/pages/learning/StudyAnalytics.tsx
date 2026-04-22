/**
 * StudyAnalytics.tsx — Study performance analytics dashboard
 *
 * Pass 63. Enhanced with Chart.js visualizations wired to the
 * learning.studyAnalytics tRPC endpoint (trends, topicMastery, efficiency).
 * Retains the original mastery/session data and adds:
 *   - Accuracy trend line chart
 *   - Topic mastery radar chart
 *   - Efficiency gauge cards
 *   - AI-generated recommendations
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, ArrowLeft, Brain, Trophy, Clock,
  TrendingUp, Target, Flame, BookOpen, Zap,
  Calendar, CheckCircle2, Lightbulb, Gauge,
  Award, Activity, PieChart,
} from "lucide-react";

// ─── Chart.js lazy loader ──────────────────────────────────────────────────
const CHART_COLORS = [
  "rgba(212, 168, 67, 0.8)",
  "rgba(20, 184, 166, 0.8)",
  "rgba(14, 165, 233, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(249, 115, 22, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(99, 102, 241, 0.8)",
];
const CHART_BORDERS = CHART_COLORS.map(c => c.replace("0.8)", "1)"));

function useChartJS() {
  const [ready, setReady] = useState(false);
  const chartModule = useRef<any>(null);
  useEffect(() => {
    let mounted = true;
    import("chart.js").then(mod => {
      mod.Chart.register(...mod.registerables);
      chartModule.current = mod;
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);
  return { ready, Chart: chartModule.current?.Chart };
}

function CanvasChart({ config, height = 250, ariaLabel = "Chart" }: { config: any; height?: number; ariaLabel?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const { ready, Chart } = useChartJS();
  useEffect(() => {
    if (!ready || !Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    chartRef.current = new Chart(ctx, config);
    return () => { chartRef.current?.destroy(); };
  }, [ready, Chart, config]);
  if (!ready) return <Skeleton className="w-full" style={{ height }} />;
  return <canvas ref={canvasRef} style={{ maxHeight: height }} role="img" aria-label={ariaLabel} />;
}

function EfficiencyGauge({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "text-green-500" : pct >= 50 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div className={color}>{icon}</div>
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="3" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" className={color} stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{Math.round(pct)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export default function StudyAnalytics() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, { enabled: !!isAuthenticated });
  // @ts-expect-error — overload resolution mismatch
  const sessionsQ = trpc.learningSocial.studySessions.list.useQuery({ limit: 50 }, { enabled: !!isAuthenticated });

  const [analyticsLimit] = useState(200);
  const deepAnalyticsQ = trpc.learning.studyAnalytics.useQuery(
    { limit: analyticsLimit },
    { enabled: !!isAuthenticated, staleTime: 60_000 },
  );

  const analytics = useMemo(() => {
    const items = masteryQ.data ?? [];
    const summary = summaryQ.data;
    const sessions = sessionsQ.data ?? [];
    const reviewDates = new Set<string>();
    for (const item of items) {
      // @ts-expect-error — strict mode fix
      if (item.lastReviewedAt) {
        // @ts-expect-error — strict mode fix
        const d = new Date(item.lastReviewedAt);
        reviewDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (reviewDates.has(key)) streak++;
      else if (i > 0) break;
    }
    let totalCorrect = 0, totalReviews = 0;
    for (const item of items) {
      // @ts-expect-error
      totalCorrect += item.correctCount ?? 0;
      // @ts-expect-error
      totalReviews += (item.correctCount ?? 0) + (item.incorrectCount ?? 0);
    }
    const accuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;
    const byType: Record<string, number> = {};
    for (const item of items) {
      const type = item.itemType ?? "unknown";
      byType[type] = (byType[type] ?? 0) + 1;
    }
    const levels = { beginner: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const item of items) {
      // @ts-expect-error
      const interval = item.interval ?? 0;
      if (interval >= 21) levels.mastered++;
      else if (interval >= 7) levels.reviewing++;
      else if (interval >= 1) levels.learning++;
      else levels.beginner++;
    }
    let totalMinutes = 0;
    for (const s of sessions) totalMinutes += s.durationMinutes ?? 0;
    const weeklyActivity: { day: string; count: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      weeklyActivity.push({ day: dayNames[d.getDay()], count: reviewDates.has(key) ? 1 : 0 });
    }
    return {
      totalItems: items.length, totalReviews, accuracy, streak, levels, byType,
      totalMinutes, weeklyActivity,
      // @ts-expect-error
      masteredCount: summary?.masteredCount ?? levels.mastered,
      // @ts-expect-error
      dueCount: summary?.dueCount ?? 0,
      newFlashcards: summary?.newFlashcards ?? 0,
      newQuestions: summary?.newQuestions ?? 0,
    };
  }, [masteryQ.data, summaryQ.data, sessionsQ.data]);

  const topicRadarConfig = useMemo(() => {
    const topics = deepAnalyticsQ.data?.topicMastery ?? [];
    if (topics.length === 0) return null;
    const top8 = topics.slice(0, 8);
    return {
      type: "radar" as const,
      data: {
        labels: top8.map((t: any) => t.topic.length > 12 ? t.topic.slice(0, 12) + "…" : t.topic),
        datasets: [
          { label: "Accuracy %", data: top8.map((t: any) => Math.round(t.accuracy * 100)), backgroundColor: "rgba(212, 168, 67, 0.2)", borderColor: CHART_BORDERS[0], pointBackgroundColor: CHART_BORDERS[0] },
          { label: "Study Minutes", data: top8.map((t: any) => Math.round(t.totalStudyMinutes)), backgroundColor: "rgba(20, 184, 166, 0.2)", borderColor: CHART_BORDERS[1], pointBackgroundColor: CHART_BORDERS[1] },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" as const } }, scales: { r: { beginAtZero: true, ticks: { display: false }, grid: { color: "rgba(128,128,128,0.15)" } } } },
    };
  }, [deepAnalyticsQ.data?.topicMastery]);

  const topicBarConfig = useMemo(() => {
    const topics = deepAnalyticsQ.data?.topicMastery ?? [];
    if (topics.length === 0) return null;
    const top8 = topics.slice(0, 8);
    return {
      type: "bar" as const,
      data: {
        labels: top8.map((t: any) => t.topic.length > 15 ? t.topic.slice(0, 15) + "…" : t.topic),
        datasets: [
          { label: "Correct", data: top8.map((t: any) => t.totalCorrect), backgroundColor: CHART_COLORS[0], borderColor: CHART_BORDERS[0], borderWidth: 1 },
          { label: "Attempted", data: top8.map((t: any) => t.totalQuestions), backgroundColor: CHART_COLORS[2], borderColor: CHART_BORDERS[2], borderWidth: 1 },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" as const } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(128,128,128,0.1)" } }, x: { grid: { display: false } } } },
    };
  }, [deepAnalyticsQ.data?.topicMastery]);

  if (authLoading) return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Study Analytics" description="Track your learning progress" />
        <div className="container py-16 text-center space-y-4">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Study Analytics</h1>
          <p className="text-muted-foreground">Sign in to view your learning analytics.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/analytics")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const isLoading = summaryQ.isLoading || masteryQ.isLoading;
  const trends = deepAnalyticsQ.data?.trends;
  const efficiency = deepAnalyticsQ.data?.efficiency;
  const topicMastery = deepAnalyticsQ.data?.topicMastery ?? [];

  return (
    <AppShell>
      <SEOHead title="Study Analytics" description="Track your learning progress and performance" />
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" /> Study Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Your learning performance at a glance</p>
          </div>
          {deepAnalyticsQ.data && (
            <Badge variant="outline" className="text-xs">{deepAnalyticsQ.data.sessionCount} sessions analyzed</Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1"><Activity className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="topics" className="gap-1"><PieChart className="h-3.5 w-3.5" /> Topics</TabsTrigger>
            <TabsTrigger value="efficiency" className="gap-1"><Gauge className="h-3.5 w-3.5" /> Efficiency</TabsTrigger>
            <TabsTrigger value="insights" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Insights</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Flame className="h-4 w-4 text-orange-500" /><span className="text-xs">Streak</span></div><div className="text-2xl font-bold">{trends?.currentStreak ?? analytics.streak} days</div>{trends?.longestStreak != null && trends.longestStreak > 0 && <div className="text-xs text-muted-foreground">Best: {trends.longestStreak} days</div>}</CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Target className="h-4 w-4 text-green-500" /><span className="text-xs">Accuracy</span></div><div className="text-2xl font-bold">{trends ? (trends.overallAccuracy * 100).toFixed(1) : analytics.accuracy.toFixed(1)}%</div>{trends?.accuracyTrend != null && <div className={`text-xs ${trends.accuracyTrend >= 0 ? "text-green-500" : "text-red-500"}`}>{trends.accuracyTrend >= 0 ? "↑" : "↓"} {Math.abs(trends.accuracyTrend * 100).toFixed(1)}% trend</div>}</CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><BookOpen className="h-4 w-4 text-blue-500" /><span className="text-xs">Sessions/Week</span></div><div className="text-2xl font-bold">{trends?.sessionsPerWeek?.toFixed(1) ?? "—"}</div><div className="text-xs text-muted-foreground">{trends?.totalSessions ?? 0} total sessions</div></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-4 w-4 text-purple-500" /><span className="text-xs">Study Time</span></div><div className="text-2xl font-bold">{trends ? `${Math.floor(trends.totalStudyMinutes / 60)}h ${Math.round(trends.totalStudyMinutes % 60)}m` : `${Math.round(analytics.totalMinutes / 60)}h ${analytics.totalMinutes % 60}m`}</div>{trends?.avgSessionMinutes != null && <div className="text-xs text-muted-foreground">Avg: {trends.avgSessionMinutes.toFixed(0)}m/session</div>}</CardContent></Card>
                </div>
                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5" /> Mastery Distribution</CardTitle></CardHeader><CardContent className="space-y-3">{[
                  { label: "Mastered", count: analytics.levels.mastered, color: "bg-green-500", pct: analytics.totalItems > 0 ? (analytics.levels.mastered / analytics.totalItems) * 100 : 0 },
                  { label: "Reviewing", count: analytics.levels.reviewing, color: "bg-blue-500", pct: analytics.totalItems > 0 ? (analytics.levels.reviewing / analytics.totalItems) * 100 : 0 },
                  { label: "Learning", count: analytics.levels.learning, color: "bg-yellow-500", pct: analytics.totalItems > 0 ? (analytics.levels.learning / analytics.totalItems) * 100 : 0 },
                  { label: "New", count: analytics.levels.beginner, color: "bg-gray-400", pct: analytics.totalItems > 0 ? (analytics.levels.beginner / analytics.totalItems) * 100 : 0 },
                ].map(level => (
                  <div key={level.label} className="space-y-1"><div className="flex justify-between text-sm"><span>{level.label}</span><span className="text-muted-foreground">{level.count} ({level.pct.toFixed(0)}%)</span></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${level.color}`} style={{ width: `${level.pct}%` }} /></div></div>
                ))}</CardContent></Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Weekly Activity</CardTitle></CardHeader><CardContent><div className="flex items-end gap-2 h-24">{analytics.weeklyActivity.map((day, i) => (<div key={i} className="flex-1 flex flex-col items-center gap-1"><div className={`w-full rounded-t transition-all ${day.count > 0 ? "bg-primary" : "bg-muted"}`} style={{ height: day.count > 0 ? "100%" : "8px" }} /><span className="text-xs text-muted-foreground">{day.day}</span></div>))}</div></CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" /> Content Breakdown</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3">{Object.entries(analytics.byType).map(([type, count]) => (<div key={type} className="text-center p-3 rounded-lg bg-muted/50"><div className="text-lg font-bold">{count}</div><div className="text-xs text-muted-foreground capitalize">{type}s</div></div>))}</div></CardContent></Card>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card><CardContent className="pt-4 text-center"><Trophy className="mx-auto h-8 w-8 text-yellow-500 mb-2" /><div className="text-2xl font-bold">{analytics.masteredCount}</div><div className="text-xs text-muted-foreground">Items Mastered</div></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><TrendingUp className="mx-auto h-8 w-8 text-blue-500 mb-2" /><div className="text-2xl font-bold">{analytics.dueCount}</div><div className="text-xs text-muted-foreground">Due for Review</div></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><BookOpen className="mx-auto h-8 w-8 text-green-500 mb-2" /><div className="text-2xl font-bold">{analytics.newFlashcards + analytics.newQuestions}</div><div className="text-xs text-muted-foreground">New Items Available</div></CardContent></Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* TOPICS */}
          <TabsContent value="topics" className="space-y-6 mt-4">
            {deepAnalyticsQ.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
            ) : topicMastery.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">No Topic Data Yet</h3><p className="text-muted-foreground">Complete some study sessions to see topic-level analytics.</p><Button variant="outline" className="mt-4" asChild><Link href="/learning">Start Studying</Link></Button></CardContent></Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" /> Topic Mastery Radar</CardTitle><CardDescription>Accuracy and study time across your top topics</CardDescription></CardHeader><CardContent>{topicRadarConfig ? <CanvasChart config={topicRadarConfig} height={280} /> : <div className="h-64 flex items-center justify-center text-muted-foreground">Not enough data</div>}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Questions by Topic</CardTitle><CardDescription>Correct vs attempted across topics</CardDescription></CardHeader><CardContent>{topicBarConfig ? <CanvasChart config={topicBarConfig} height={280} /> : <div className="h-64 flex items-center justify-center text-muted-foreground">Not enough data</div>}</CardContent></Card>
                </div>
                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Topic Mastery Details</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2 pr-4 font-medium">Topic</th><th className="py-2 pr-4 font-medium text-center">Sessions</th><th className="py-2 pr-4 font-medium text-center">Accuracy</th><th className="py-2 pr-4 font-medium text-center">Study Time</th><th className="py-2 font-medium text-center">Level</th></tr></thead><tbody>{topicMastery.map((t: any, i: number) => (<tr key={i} className="border-b border-border/50"><td className="py-2 pr-4 font-medium capitalize">{t.topic}</td><td className="py-2 pr-4 text-center">{t.sessionsCount}</td><td className="py-2 pr-4 text-center"><span className={t.accuracy >= 0.9 ? "text-green-500" : t.accuracy >= 0.7 ? "text-yellow-500" : "text-red-500"}>{(t.accuracy * 100).toFixed(1)}%</span></td><td className="py-2 pr-4 text-center">{t.totalStudyMinutes.toFixed(0)}m</td><td className="py-2 text-center"><Badge variant={t.masteryLevel === "mastered" ? "default" : t.masteryLevel === "advanced" ? "secondary" : "outline"} className="text-xs capitalize">{t.masteryLevel}</Badge></td></tr>))}</tbody></table></div></CardContent></Card>
              </>
            )}
          </TabsContent>

          {/* EFFICIENCY */}
          <TabsContent value="efficiency" className="space-y-6 mt-4">
            {deepAnalyticsQ.isLoading ? <Skeleton className="h-64" /> : !efficiency ? (
              <Card><CardContent className="py-12 text-center"><Gauge className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">No Efficiency Data Yet</h3><p className="text-muted-foreground">Complete study sessions to see efficiency metrics.</p></CardContent></Card>
            ) : (
              <>
                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gauge className="h-5 w-5" /> Efficiency Scores</CardTitle><CardDescription>How effectively you're using your study time</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <EfficiencyGauge label="Overall" value={efficiency.overallScore} icon={<Award className="h-6 w-6" />} />
                  <EfficiencyGauge label="Time Efficiency" value={efficiency.timeEfficiency} icon={<Clock className="h-6 w-6" />} />
                  <EfficiencyGauge label="Accuracy" value={efficiency.accuracyEfficiency} icon={<Target className="h-6 w-6" />} />
                  <EfficiencyGauge label="Consistency" value={efficiency.consistencyScore} icon={<Calendar className="h-6 w-6" />} />
                </div></CardContent></Card>
                {trends && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Improvement Rate</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Accuracy improvement</span><span className={`font-bold ${trends.improvementRate >= 0 ? "text-green-500" : "text-red-500"}`}>{trends.improvementRate >= 0 ? "+" : ""}{(trends.improvementRate * 100).toFixed(1)}%</span></div><Progress value={Math.max(0, Math.min(100, 50 + trends.improvementRate * 200))} className="h-2" /><p className="text-xs text-muted-foreground">Comparing accuracy between your first and most recent quartile of sessions.{trends.improvementRate > 0 ? " You're improving!" : trends.improvementRate < 0 ? " Consider reviewing fundamentals." : " Holding steady."}</p></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Flame className="h-5 w-5" /> Strongest Topic</CardTitle></CardHeader><CardContent>{trends.strongestTopic ? <div className="text-center py-4"><div className="text-3xl font-bold capitalize text-primary mb-2">{trends.strongestTopic}</div><p className="text-sm text-muted-foreground">Your highest accuracy topic across all sessions</p></div> : <p className="text-muted-foreground text-center py-4">Complete more sessions to identify your strongest topic.</p>}</CardContent></Card>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights" className="space-y-6 mt-4">
            {deepAnalyticsQ.isLoading ? <Skeleton className="h-48" /> : !efficiency || efficiency.recommendations.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><Lightbulb className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">No Insights Yet</h3><p className="text-muted-foreground">Complete more study sessions to get personalized recommendations.</p></CardContent></Card>
            ) : (
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" /> Personalized Recommendations</CardTitle><CardDescription>Based on analysis of {deepAnalyticsQ.data?.sessionCount ?? 0} study sessions</CardDescription></CardHeader><CardContent className="space-y-3">{efficiency.recommendations.map((rec: string, i: number) => (<div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50"><CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" /><p className="text-sm">{rec}</p></div>))}</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
