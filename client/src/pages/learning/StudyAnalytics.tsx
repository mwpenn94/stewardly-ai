/**
 * StudyAnalytics.tsx — KE-style Study Analytics Dashboard
 *
 * Pass 149. Full rewrite with recharts (AreaChart, BarChart, RadarChart),
 * KE StatCard with trend arrows, time range selector, discipline progress
 * table with color bars, SRS effectiveness gauges, and animated motion.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, ArrowLeft, Brain, Trophy, Clock,
  TrendingUp, Target, Flame, BookOpen, Zap,
  Calendar, CheckCircle2, Lightbulb, Gauge,
  Award, Activity, LogIn, ArrowUp, ArrowDown, Minus,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell,
} from "recharts";

type TimeRange = "7d" | "30d" | "90d" | "all";

/* ── GitHub-style Activity Heatmap ── */
function ActivityHeatmap() {
  const calendarQ = trpc.learning.activityCalendar.useQuery(undefined, { staleTime: 120_000 });
  const data = calendarQ.data ?? [];
  const activityMap = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>();
    for (const d of data) map.set(d.date, { count: d.count, minutes: d.minutes });
    return map;
  }, [data]);

  // Build 52-week grid (364 days ending today)
  const weeks = useMemo(() => {
    const today = new Date();
    const result: { date: Date; dateStr: string; count: number; minutes: number }[][] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 363 - start.getDay());
    let current = new Date(start);
    let week: { date: Date; dateStr: string; count: number; minutes: number }[] = [];
    while (current <= today) {
      const ds = current.toISOString().slice(0, 10);
      const entry = activityMap.get(ds);
      week.push({ date: new Date(current), dateStr: ds, count: entry?.count ?? 0, minutes: entry?.minutes ?? 0 });
      if (week.length === 7) { result.push(week); week = []; }
      current.setDate(current.getDate() + 1);
    }
    if (week.length > 0) result.push(week);
    return result;
  }, [activityMap]);

  const totalSessions = data.reduce((s, d) => s + d.count, 0);
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const activeDays = data.filter(d => d.count > 0).length;
  const maxCount = Math.max(1, ...data.map(d => d.count));

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/40";
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "bg-emerald-900/60";
    if (ratio <= 0.5) return "bg-emerald-700/70";
    if (ratio <= 0.75) return "bg-emerald-500/80";
    return "bg-emerald-400";
  };

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (calendarQ.isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-card border border-border rounded-xl p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Study Activity</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{totalSessions}</strong> sessions</span>
          <span><strong className="text-foreground">{activeDays}</strong> active days</span>
          <span><strong className="text-foreground">{Math.round(totalMinutes / 60)}</strong> hours</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0.5 min-w-fit">
          {/* Month labels */}
          <div className="flex gap-0.5 mb-1 ml-[18px]">
            {weeks.map((week, wi) => {
              const firstDay = week[0];
              if (!firstDay) return <div key={wi} className="w-[11px]" />;
              const isFirstWeekOfMonth = firstDay.date.getDate() <= 7;
              return (
                <div key={wi} className="w-[11px] text-[9px] text-muted-foreground leading-none">
                  {isFirstWeekOfMonth ? monthLabels[firstDay.date.getMonth()] : ""}
                </div>
              );
            })}
          </div>
          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => (
            <div key={dayIdx} className="flex gap-0.5 items-center">
              <div className="w-[14px] text-[9px] text-muted-foreground leading-none">
                {dayIdx === 1 ? "M" : dayIdx === 3 ? "W" : dayIdx === 5 ? "F" : ""}
              </div>
              {weeks.map((week, wi) => {
                const cell = week[dayIdx];
                if (!cell) return <div key={wi} className="w-[11px] h-[11px]" />;
                return (
                  <div
                    key={wi}
                    className={`w-[11px] h-[11px] rounded-[2px] ${getColor(cell.count)} transition-colors`}
                    title={`${cell.dateStr}: ${cell.count} sessions, ${cell.minutes} min`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3 text-[9px] text-muted-foreground">
        <span>Less</span>
        <div className="w-[11px] h-[11px] rounded-[2px] bg-muted/40" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-900/60" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-700/70" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500/80" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400" />
        <span>More</span>
      </div>
    </motion.div>
  );
}

const CHART_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#EC4899", "#14B8A6", "#F97316"];

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

/* ── KE StatCard ── */
function StatCard({ icon: Icon, label, value, sub, trend, delay = 0 }: {
  icon: any; label: string; value: string; sub?: string; trend?: "up" | "down" | "flat"; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground font-mono tracking-wider uppercase">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</span>
        {trend && (
          <span className={`text-xs flex items-center gap-0.5 mb-1 ${
            trend === "up" ? "text-green-500" : trend === "down" ? "text-red-400" : "text-muted-foreground"
          }`}>
            {trend === "up" ? <ArrowUp className="w-3 h-3" /> : trend === "down" ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

/* ── Efficiency Gauge ── */
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
          <span className="text-lg font-bold font-mono">{Math.round(pct)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── SRS Review Forecast Chart ── */
function ForecastChart() {
  const forecastQ = trpc.learning.mastery.forecast.useQuery(undefined, { staleTime: 60_000 });
  const data = forecastQ.data;
  if (!data || data.length === 0) return null;

  const maxDue = Math.max(...data.map(d => d.dueCount), 1);
  const totalUpcoming = data.reduce((s, d) => s + d.dueCount, 0);
  const peakDay = data.reduce((a, b) => b.dueCount > a.dueCount ? b : a, data[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.78 }}
      className="bg-card border border-border rounded-xl p-5 mb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Review Forecast</h3>
          <span className="text-[10px] font-mono text-muted-foreground ml-2">Next 30 days</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{totalUpcoming} upcoming</span>
          {peakDay && <span>Peak: {peakDay.label} ({peakDay.dueCount})</span>}
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              interval={Math.floor(data.length / 7)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value} items`, "Due"]}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="dueCount" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.dueCount === 0 ? "var(--muted)" : entry.dueCount >= maxDue * 0.8 ? "#EF4444" : entry.dueCount >= maxDue * 0.5 ? "#F59E0B" : "#8B5CF6"}
                  opacity={entry.dueCount === 0 ? 0.3 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#8B5CF6" }} /> Light load</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#F59E0B" }} /> Moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#EF4444" }} /> Heavy</span>
      </div>
    </motion.div>
  );
}

export default function StudyAnalytics() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, { enabled: !!isAuthenticated });
  // @ts-expect-error — overload resolution mismatch
  const sessionsQ = trpc.learningSocial.studySessions.list.useQuery({ limit: 50 }, { enabled: !!isAuthenticated });
  const [analyticsLimit] = useState(200);
  const deepAnalyticsQ = trpc.learning.studyAnalytics.useQuery(
    { limit: analyticsLimit },
    { enabled: !!isAuthenticated, staleTime: 60_000 },
  );

  /* ── Compute analytics from mastery data ── */
  const analytics = useMemo(() => {
    const items = masteryQ.data ?? [];
    const summary = summaryQ.data;
    const sessions = sessionsQ.data ?? [];

    const now = Date.now();
    const msPerDay = 86400000;
    const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    const cutoff = now - rangeDays * msPerDay;

    // Review dates for streak calculation
    const reviewDates = new Set<string>();
    for (const item of items) {
      // @ts-expect-error
      if (item.lastReviewedAt) {
        // @ts-expect-error
        const d = new Date(item.lastReviewedAt);
        reviewDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }

    // Streak
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (reviewDates.has(key)) streak++;
      else if (i > 0) break;
    }

    // Accuracy
    let totalCorrect = 0, totalReviews = 0;
    for (const item of items) {
      // @ts-expect-error
      totalCorrect += item.correctCount ?? 0;
      // @ts-expect-error
      totalReviews += (item.correctCount ?? 0) + (item.incorrectCount ?? 0);
    }
    const accuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

    // By type
    const byType: Record<string, number> = {};
    for (const item of items) {
      const type = item.itemType ?? "unknown";
      byType[type] = (byType[type] ?? 0) + 1;
    }

    // Mastery levels
    const levels = { beginner: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const item of items) {
      // @ts-expect-error
      const interval = item.interval ?? 0;
      if (interval >= 21) levels.mastered++;
      else if (interval >= 7) levels.reviewing++;
      else if (interval >= 1) levels.learning++;
      else levels.beginner++;
    }

    // Study time
    let totalMinutes = 0;
    for (const s of sessions) totalMinutes += s.durationMinutes ?? 0;

    // Daily activity data for AreaChart
    const dailyMap = new Map<string, { studied: number; mastered: number }>();
    for (const item of items) {
      // @ts-expect-error
      if (item.lastReviewedAt && new Date(item.lastReviewedAt).getTime() >= cutoff) {
        // @ts-expect-error
        const dateStr = new Date(item.lastReviewedAt).toISOString().split("T")[0];
        const existing = dailyMap.get(dateStr) || { studied: 0, mastered: 0 };
        existing.studied++;
        // @ts-expect-error
        if ((item.interval ?? 0) >= 21) existing.mastered++;
        dailyMap.set(dateStr, existing);
      }
    }
    const dailyData: Array<{ date: string; studied: number; mastered: number }> = [];
    for (let i = Math.min(rangeDays, 60) - 1; i >= 0; i--) {
      const d = new Date(now - i * msPerDay);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry = dailyMap.get(dateStr) || { studied: 0, mastered: 0 };
      dailyData.push({ date: label, ...entry });
    }

    // Confidence distribution for BarChart
    const confidenceDist = [0, 0, 0, 0, 0, 0];
    for (const item of items) {
      // @ts-expect-error
      const interval = item.interval ?? 0;
      if (interval >= 21) confidenceDist[5]++;
      else if (interval >= 14) confidenceDist[4]++;
      else if (interval >= 7) confidenceDist[3]++;
      else if (interval >= 3) confidenceDist[2]++;
      else if (interval >= 1) confidenceDist[1]++;
      else confidenceDist[0]++;
    }
    const confidenceData = confidenceDist.map((count, level) => ({
      level: `${level}`,
      count,
      label: ["New", "Low", "Fair", "Good", "Strong", "Mastered"][level],
    }));

    // Discipline breakdown for table
    const disciplineMap: Record<string, { total: number; studied: number; mastered: number; correct: number; reviews: number }> = {};
    for (const item of items) {
      // @ts-expect-error
      const disc = item.discipline || item.trackId || "General";
      if (!disciplineMap[disc]) disciplineMap[disc] = { total: 0, studied: 0, mastered: 0, correct: 0, reviews: 0 };
      disciplineMap[disc].total++;
      disciplineMap[disc].studied++;
      // @ts-expect-error
      if ((item.interval ?? 0) >= 21) disciplineMap[disc].mastered++;
      // @ts-expect-error
      disciplineMap[disc].correct += item.correctCount ?? 0;
      // @ts-expect-error
      disciplineMap[disc].reviews += (item.correctCount ?? 0) + (item.incorrectCount ?? 0);
    }
    const disciplineData = Object.entries(disciplineMap)
      .map(([name, d]) => ({
        name: name.length > 18 ? name.slice(0, 18) + "..." : name,
        fullName: name,
        total: d.total,
        studied: d.studied,
        mastered: d.mastered,
        progress: d.total > 0 ? Math.round((d.mastered / d.total) * 100) : 0,
        accuracy: d.reviews > 0 ? Math.round((d.correct / d.reviews) * 100) : 0,
        color: CHART_COLORS[Object.keys(disciplineMap).indexOf(name) % CHART_COLORS.length],
      }))
      .sort((a, b) => b.progress - a.progress);

    // Radar data
    const radarData = disciplineData.slice(0, 8).map(d => ({
      discipline: d.name,
      progress: d.progress,
      accuracy: d.accuracy,
    }));

    return {
      totalItems: items.length, totalReviews, accuracy, streak, levels, byType,
      totalMinutes, dailyData, confidenceData, disciplineData, radarData,
      // @ts-expect-error
      masteredCount: summary?.masteredCount ?? levels.mastered,
      // @ts-expect-error
      dueCount: summary?.dueCount ?? 0,
      newFlashcards: summary?.newFlashcards ?? 0,
      newQuestions: summary?.newQuestions ?? 0,
    };
  }, [masteryQ.data, summaryQ.data, sessionsQ.data, timeRange]);

  /* ── Auth guard ── */
  if (authLoading) return (
    <LearningShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-mono text-sm">Loading analytics...</div>
      </div>
    </LearningShell>
  );

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Study Analytics" description="Track your learning progress" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Study Analytics</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to view your learning analytics.</p>
            <a href={getLoginUrl("/learning/analytics")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const isLoading = summaryQ.isLoading || masteryQ.isLoading;
  const trends = deepAnalyticsQ.data?.trends;
  const efficiency = deepAnalyticsQ.data?.efficiency;
  const topicMastery = deepAnalyticsQ.data?.topicMastery ?? [];

  return (
    <LearningShell>
      <SEOHead title="Study Analytics" description="Track your learning progress and performance" />
      <div className="min-h-screen px-6 lg:px-10 py-8">
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Study Analytics
            </h1>
            <div className="ml-auto">
              <Link href="/learning/export">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export Report
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground ml-12">
            Track your learning progress, identify strengths, and optimize your study strategy.
          </p>
        </motion.div>

        {/* ── Time Range Selector ── */}
        <div className="flex gap-2 mb-6">
          {(["7d", "30d", "90d", "all"] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                timeRange === range
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "all" ? "All Time" : range}
            </button>
          ))}
          {deepAnalyticsQ.data && (
            <span className="ml-auto text-[10px] font-mono px-2 py-1.5 rounded bg-primary text-primary-foreground">
              {deepAnalyticsQ.data.sessionCount} sessions
            </span>
          )}
        </div>

        {/* ── Summary Stats ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Flame} label="Streak" delay={0.05}
              value={`${trends?.currentStreak ?? analytics.streak}d`}
              sub={trends?.longestStreak ? `Best: ${trends.longestStreak} days` : undefined}
              trend={analytics.streak > 3 ? "up" : analytics.streak > 0 ? "flat" : undefined}
            />
            <StatCard
              icon={Target} label="Accuracy" delay={0.1}
              value={`${trends ? (trends.overallAccuracy * 100).toFixed(1) : analytics.accuracy.toFixed(1)}%`}
              sub={`${analytics.totalReviews} total reviews`}
              trend={trends?.accuracyTrend != null ? (trends.accuracyTrend >= 0.01 ? "up" : trends.accuracyTrend <= -0.01 ? "down" : "flat") : undefined}
            />
            <StatCard
              icon={Clock} label="Study Time" delay={0.15}
              value={formatDuration(trends?.totalStudyMinutes ?? analytics.totalMinutes)}
              sub={trends?.avgSessionMinutes ? `Avg: ${trends.avgSessionMinutes.toFixed(0)}m/session` : `${analytics.streak} day streak`}
            />
            <StatCard
              icon={Trophy} label="Mastered" delay={0.2}
              value={`${analytics.masteredCount}`}
              sub={`${analytics.dueCount} due for review`}
              trend={analytics.masteredCount > 10 ? "up" : analytics.masteredCount > 0 ? "flat" : undefined}
            />
          </div>
        )}

        {/* ── Charts Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Study Activity AreaChart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Study Activity</h3>
            </div>
            <div className="h-[250px]">
              {analytics.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studiedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="masteredGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="studied" stroke="#8B5CF6" fill="url(#studiedGrad)" strokeWidth={2} name="Studied" />
                    <Area type="monotone" dataKey="mastered" stroke="#10B981" fill="url(#masteredGrad)" strokeWidth={2} name="Mastered" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Activity className="w-8 h-8 mr-2 opacity-30" /> Start studying to see activity trends
                </div>
              )}
            </div>
          </motion.div>

          {/* Confidence Distribution BarChart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Confidence Distribution</h3>
            </div>
            <div className="h-[250px]">
              {analytics.confidenceData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.confidenceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Items">
                      {analytics.confidenceData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Brain className="w-8 h-8 mr-2 opacity-30" /> No confidence data yet
                </div>
              )}
            </div>
          </motion.div>

          {/* Discipline Radar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Discipline Coverage</h3>
            </div>
            <div className="h-[280px]">
              {analytics.radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={analytics.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <PolarGrid stroke="var(--border)" opacity={0.3} />
                    <PolarAngleAxis dataKey="discipline" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
                    <Radar name="Progress" dataKey="progress" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={2} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={2} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Target className="w-8 h-8 mr-2 opacity-30" /> Study more to see discipline coverage
                </div>
              )}
            </div>
          </motion.div>

          {/* SRS Effectiveness */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>SRS Effectiveness</h3>
            </div>
            {efficiency ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <EfficiencyGauge label="Overall" value={efficiency.overallScore} icon={<Award className="h-6 w-6" />} />
                <EfficiencyGauge label="Time" value={efficiency.timeEfficiency} icon={<Clock className="h-6 w-6" />} />
                <EfficiencyGauge label="Accuracy" value={efficiency.accuracyEfficiency} icon={<Target className="h-6 w-6" />} />
                <EfficiencyGauge label="Consistency" value={efficiency.consistencyScore} icon={<Calendar className="h-6 w-6" />} />
              </div>
            ) : (
              <div className="space-y-5 mt-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Mastery Rate</span>
                    <span className="font-mono">{analytics.totalItems > 0 ? Math.round((analytics.levels.mastered / analytics.totalItems) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analytics.totalItems > 0 ? (analytics.levels.mastered / analytics.totalItems) * 100 : 0}%` }}
                      transition={{ delay: 0.6, duration: 0.8 }}
                      className="h-full rounded-full bg-green-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Accuracy</span>
                    <span className="font-mono">{analytics.accuracy.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analytics.accuracy}%` }}
                      transition={{ delay: 0.7, duration: 0.8 }}
                      className="h-full rounded-full bg-violet-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{analytics.totalReviews}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Total Reviews</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{analytics.dueCount}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Due Items</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Mastery Distribution ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-card border border-border rounded-xl p-5 mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Mastery Distribution</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Mastered", count: analytics.levels.mastered, color: "bg-green-500", pct: analytics.totalItems > 0 ? (analytics.levels.mastered / analytics.totalItems) * 100 : 0 },
              { label: "Reviewing", count: analytics.levels.reviewing, color: "bg-blue-500", pct: analytics.totalItems > 0 ? (analytics.levels.reviewing / analytics.totalItems) * 100 : 0 },
              { label: "Learning", count: analytics.levels.learning, color: "bg-yellow-500", pct: analytics.totalItems > 0 ? (analytics.levels.learning / analytics.totalItems) * 100 : 0 },
              { label: "New", count: analytics.levels.beginner, color: "bg-gray-400", pct: analytics.totalItems > 0 ? (analytics.levels.beginner / analytics.totalItems) * 100 : 0 },
            ].map(level => (
              <div key={level.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{level.label}</span>
                  <span className="text-muted-foreground font-mono">{level.count} ({level.pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${level.pct}%` }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className={`h-full rounded-full ${level.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Discipline Breakdown Table ── */}
        {analytics.disciplineData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card border border-border rounded-xl p-5 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Discipline Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Discipline</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Total</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Studied</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Mastered</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Progress</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Accuracy</th>
                    <th className="py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase w-32">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.disciplineData.map((d) => (
                    <tr key={d.fullName} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{d.fullName}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{d.total}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{d.studied}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-500">{d.mastered}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">{d.progress}%</td>
                      <td className="py-2.5 px-3 text-right font-mono">{d.accuracy}%</td>
                      <td className="py-2.5 px-3">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${d.progress}%`, background: d.color }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Topic Mastery Details ── */}
        {topicMastery.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-card border border-border rounded-xl p-5 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Topic Mastery Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Topic</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Sessions</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Accuracy</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Study Time</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-mono tracking-wider uppercase">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {topicMastery.map((t: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium capitalize">{t.topic}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{t.sessionsCount}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-mono ${t.accuracy >= 0.9 ? "text-green-500" : t.accuracy >= 0.7 ? "text-yellow-500" : "text-red-500"}`}>
                          {(t.accuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{t.totalStudyMinutes.toFixed(0)}m</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={t.masteryLevel === "mastered" ? "default" : t.masteryLevel === "advanced" ? "secondary" : "outline"} className="text-xs capitalize">
                          {t.masteryLevel}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Insights ── */}
        {efficiency && efficiency.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card border border-border rounded-xl p-5 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Personalized Recommendations</h3>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                Based on {deepAnalyticsQ.data?.sessionCount ?? 0} sessions
              </span>
            </div>
            <div className="space-y-3">
              {efficiency.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-accent/30">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Improvement Rate + Strongest Topic ── */}
        {trends && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Improvement Rate</h3>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Accuracy improvement</span>
                <span className={`font-bold font-mono ${trends.improvementRate >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {trends.improvementRate >= 0 ? "+" : ""}{(trends.improvementRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, 50 + trends.improvementRate * 200))}%` }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Comparing accuracy between your first and most recent quartile of sessions.
                {trends.improvementRate > 0 ? " You're improving!" : trends.improvementRate < 0 ? " Consider reviewing fundamentals." : " Holding steady."}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Strongest Topic</h3>
              </div>
              {trends.strongestTopic ? (
                <div className="text-center py-4">
                  <div className="text-3xl font-bold capitalize text-primary mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    {trends.strongestTopic}
                  </div>
                  <p className="text-sm text-muted-foreground">Your highest accuracy topic across all sessions</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Complete more sessions to identify your strongest topic.</p>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Study Activity Heatmap ── */}
        <ActivityHeatmap />
        {/* ── SRS Review Forecast ── */}
        <ForecastChart />

        {/* ── Content Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="bg-card border border-border rounded-xl p-5 mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Content Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(analytics.byType).map(([type, count]) => (
              <div key={type} className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{count}</div>
                <div className="text-xs text-muted-foreground font-mono capitalize">{type}s</div>
              </div>
            ))}
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{analytics.newFlashcards + analytics.newQuestions}</div>
              <div className="text-xs text-muted-foreground font-mono">New Available</div>
            </div>
          </div>
        </motion.div>
      </div>
    </LearningShell>
  );
}
