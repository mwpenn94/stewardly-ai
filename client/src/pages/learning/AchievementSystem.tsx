/**
 * AchievementSystem.tsx — Milestones, streaks, and mastery tracking
 *
 * Pass 116. Gamification that reinforces learning behavior.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Flame, Crown, Award, Calendar, Zap, Star, Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { sendFeedback } from "@/lib/feedbackSpecs";
import { useAchievementToast } from "@/components/AchievementToast";
/* ── types ─────────────────────────────────────────────────────── */

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "streak" | "mastery" | "exam" | "case" | "milestone";
  progress: number;
  earnedAt?: string;
}

interface DailyGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
}

interface AchievementData {
  streak: { current: number; longest: number; todayComplete: boolean };
  dailyGoals: DailyGoal[];
  achievements: Achievement[];
  totalMastered: number;
  totalStudyMinutes: number;
  examsCompleted: number;
  casesCompleted: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  streak: Flame, mastery: Crown, exam: Award, case: Star, milestone: Star,
};

const CATEGORY_COLORS: Record<string, string> = {
  streak: "text-chart-1", mastery: "text-chart-5", exam: "text-chart-2",
  case: "text-chart-3", milestone: "text-chart-4",
};

/* ── 90-Day Activity Heatmap ─────────────────────────────────────── */

function ActivityHeatmap() {
  const heatData = useMemo(() => {
    const days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      let count = 0;
      try {
        count = Number(localStorage.getItem(`stewardly-reviews-${key}`)) || 0;
      } catch { /* noop */ }
      const level = count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4;
      days.push({ date: key, count, level });
    }
    return days;
  }, []);

  const totalActive = heatData.filter(d => d.count > 0).length;
  const totalReviews = heatData.reduce((s, d) => s + d.count, 0);

  // Group into weeks (columns of 7)
  const weeks: typeof heatData[] = [];
  for (let i = 0; i < heatData.length; i += 7) {
    weeks.push(heatData.slice(i, i + 7));
  }

  const levelColors = [
    "bg-muted/30",
    "bg-emerald-900/40",
    "bg-emerald-700/60",
    "bg-emerald-500/80",
    "bg-emerald-400",
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">90-Day Activity</h2>
        <span className="text-xs text-muted-foreground">{totalActive} active days · {totalReviews} reviews</span>
      </div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded-[2px] ${levelColors[day.level]} transition-colors`}
                title={`${day.date}: ${day.count} reviews`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 px-1">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {levelColors.map((c, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

// CBL22: Removed DEMO_DATA constant — deriveAchievements() now handles
// the empty-state case cleanly with real mastery data (0 mastered shows
// "First Steps" at 0% and real daily goal targets).

/**
 * Derives achievement data from real mastery + due-item stats.
 */
function deriveAchievements(
  summary: { total: number; mastered: number; inProgress: number; dueNow: number; masteryPct: number } | null,
  dueItems: any[] | null,
): AchievementData {
  const mastered = summary?.mastered ?? 0;
  const total = summary?.total ?? 0;
  const dueCount = summary?.dueNow ?? dueItems?.length ?? 0;

  // Derive streak from localStorage (simple daily tracker)
  let streak = { current: 0, longest: 0, todayComplete: false };
  try {
    const raw = localStorage.getItem("stewardly-learning-streak");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.current === "number") streak = parsed;
    }
  } catch { /* noop */ }

  // Track study activity for today
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayReviewed = (() => {
    try {
      return Number(localStorage.getItem(`stewardly-reviews-${todayKey}`)) || 0;
    } catch { return 0; }
  })();

  const achievements: Achievement[] = [
    { id: "first-steps", title: "First Steps", description: "Complete your first study session", category: "milestone", progress: total > 0 ? 100 : 0, earnedAt: total > 0 ? "2026-01-01" : undefined },
    { id: "week-warrior", title: "Week Warrior", description: "7-day study streak", category: "streak", progress: Math.min(100, Math.round((streak.current / 7) * 100)) },
    { id: "term-master-10", title: "Getting Started", description: "Master 10 items", category: "mastery", progress: Math.min(100, Math.round((mastered / 10) * 100)), earnedAt: mastered >= 10 ? "earned" : undefined },
    { id: "term-master-50", title: "Term Master", description: "Master 50 items", category: "mastery", progress: Math.min(100, Math.round((mastered / 50) * 100)), earnedAt: mastered >= 50 ? "earned" : undefined },
    { id: "term-master-100", title: "Century", description: "Master 100 items", category: "mastery", progress: Math.min(100, Math.round((mastered / 100) * 100)), earnedAt: mastered >= 100 ? "earned" : undefined },
    { id: "fortnight", title: "Fortnight Focus", description: "14-day study streak", category: "streak", progress: Math.min(100, Math.round((streak.current / 14) * 100)) },
    { id: "review-champ", title: "Review Champion", description: "Review 20 items in one day", category: "milestone", progress: Math.min(100, Math.round((todayReviewed / 20) * 100)), earnedAt: todayReviewed >= 20 ? todayKey : undefined },
  ];

  return {
    streak,
    dailyGoals: [
      { id: "g-reviews", label: "Review due items", current: todayReviewed, target: Math.max(10, dueCount), unit: "items" },
      { id: "g-mastery", label: "Master new items", current: mastered, target: Math.max(mastered + 5, 10), unit: "items" },
    ],
    achievements,
    totalMastered: mastered,
    totalStudyMinutes: total * 3, // rough estimate: ~3 min per item touched
    examsCompleted: 0, // would need exam history tracking
    casesCompleted: 0,
  };
}

interface Props {
  data?: AchievementData;
  onGoalTap?: (goalId: string) => void;
}

export default function AchievementSystem({ data, onGoalTap }: Props) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Fetch real mastery data when used as a page (no data prop)
  const summaryQuery = trpc.learning.mastery.summary.useQuery(undefined, {
    enabled: isAuthenticated && !data,
    retry: false,
  });
  const dueQuery = trpc.learning.mastery.dueNow.useQuery(undefined, {
    enabled: isAuthenticated && !data,
    retry: false,
  });

  const derivedData = useMemo(() => {
    if (data) return data;
    return deriveAchievements(
      summaryQuery.data as any ?? null,
      dueQuery.data as any[] ?? null,
    );
  }, [data, summaryQuery.data, dueQuery.data]);

  const d = derivedData;
  const [filter, setFilter] = useState<string>("all");

  const earned = d.achievements.filter(a => a.progress >= 100);
  const inProgress = d.achievements.filter(a => a.progress > 0 && a.progress < 100);

  // G1: Fire feedback + celebration toast when new achievements are earned
  const { showAchievement } = useAchievementToast();
  const prevEarnedRef = useRef<number>(0);
  useEffect(() => {
    if (earned.length > prevEarnedRef.current && prevEarnedRef.current > 0) {
      const newest = earned[earned.length - 1];
      sendFeedback("learning.achievement_earned", { title: newest?.title });
      if (newest?.category === "mastery") sendFeedback("learning.mastered", { title: newest?.title });
      if (newest?.category === "streak") sendFeedback("learning.streak_milestone", { streak: d.streak.current });
      // Fire KE-style celebration toast
      if (newest) {
        showAchievement(newest.title, newest.description);
      }
    }
    prevEarnedRef.current = earned.length;
  }, [earned.length]);

  const filtered = filter === "all" ? d.achievements : d.achievements.filter(a => a.category === filter);

  if (authLoading) {
    return <LearningShell><div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div></LearningShell>;
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Award className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Achievements</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to track your milestones and streaks.</p>
            <a href={getLoginUrl("/learning/achievements")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"><Award className="w-4 h-4" /> Sign In</a>
          </div>
        </div>
      </LearningShell>
    );
  }


  return (
    <LearningShell title="Achievements">
      <SEOHead title="Achievements" description="Track learning milestones, streaks, and mastery" />
    <div className="min-h-screen px-6 lg:px-10 py-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
          <Award className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Achievements</h1>
          <p className="text-xs text-muted-foreground font-mono">{earned.length} earned · {inProgress.length} in progress</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Flame className={`w-5 h-5 mx-auto mb-1 ${d.streak.current > 0 ? "text-amber-400" : "text-muted-foreground/30"}`} />
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{d.streak.current}</div>
          <div className="text-[10px] text-muted-foreground">Day Streak</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Crown className="w-5 h-5 mx-auto mb-1 text-purple-400" />
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{d.totalMastered}</div>
          <div className="text-[10px] text-muted-foreground">Mastered</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Award className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{d.examsCompleted}</div>
          <div className="text-[10px] text-muted-foreground">Exams</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-chart-3" />
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{Math.round(d.totalStudyMinutes / 60)}h</div>
          <div className="text-[10px] text-muted-foreground">Study Time</div>
        </div>
      </div>

      {/* 90-Day Activity Heatmap */}
      <ActivityHeatmap />

      {/* Daily goals */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 px-1">Today's Goals</h2>
        <div className="space-y-2">
          {d.dailyGoals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            const complete = pct >= 100;
            return (
              <button type="button" key={goal.id} onClick={() => onGoalTap?.(goal.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card/40 cursor-pointer hover:bg-card/60 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{goal.label}</span>
                    <span className={`text-xs tabular-nums ${complete ? "text-emerald-400" : "text-muted-foreground"}`}>{goal.current}/{goal.target} {goal.unit}</span>
                  </div>
                  <Progress value={pct} className="h-1" />
                </div>
                {complete && <Zap className="w-4 h-4 text-emerald-400 flex-none" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All" },
          { key: "streak", label: "Streaks" },
          { key: "mastery", label: "Mastery" },
          { key: "exam", label: "Exams" },
          { key: "case", label: "Cases" },
          { key: "milestone", label: "Milestones" },
        ].map(cat => (
          <button type="button" key={cat.key} onClick={() => setFilter(cat.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors whitespace-nowrap
              ${filter === cat.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-card/60 text-muted-foreground border border-border"}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid sm:grid-cols-2 gap-2">
        {filtered.map(achievement => {
          const isEarned = achievement.progress >= 100;
          const IconComponent = CATEGORY_ICONS[achievement.category] || Star;
          const colorClass = CATEGORY_COLORS[achievement.category] || "text-muted-foreground";
          return (
            <div key={achievement.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                ${isEarned ? "border-primary/20 bg-card/60" : "border-border bg-card/20 opacity-70"}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${isEarned ? "bg-primary/10" : "bg-muted/20"}`}>
                <IconComponent className={`w-5 h-5 ${isEarned ? colorClass : "text-muted-foreground/40"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{achievement.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{achievement.description}</div>
                {!isEarned && achievement.progress > 0 && <Progress value={achievement.progress} className="h-0.5 mt-1.5" />}
              </div>
              {isEarned && achievement.earnedAt && (
                <div className="text-[10px] text-muted-foreground/50 flex-none">
                  {new Date(achievement.earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </LearningShell>
  );
}
