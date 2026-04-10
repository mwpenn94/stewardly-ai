/**
 * AchievementSystem.tsx — Milestones, streaks, and mastery tracking
 *
 * Pass 116. Gamification that reinforces learning behavior.
 */

import { useState } from "react";
import {
  Flame, Crown, Award, Calendar, Zap, Star,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

const DEMO_DATA: AchievementData = {
  streak: { current: 5, longest: 12, todayComplete: true },
  dailyGoals: [
    { id: "g1", label: "Review flashcards", current: 15, target: 20, unit: "cards" },
    { id: "g2", label: "Study time", current: 25, target: 30, unit: "min" },
    { id: "g3", label: "Practice questions", current: 8, target: 10, unit: "questions" },
  ],
  achievements: [
    { id: "a1", title: "First Steps", description: "Complete your first study session", category: "milestone", progress: 100, earnedAt: "2026-03-15" },
    { id: "a2", title: "Week Warrior", description: "7-day study streak", category: "streak", progress: 100, earnedAt: "2026-03-22" },
    { id: "a3", title: "Term Master", description: "Master 50 definitions", category: "mastery", progress: 72 },
    { id: "a4", title: "Exam Ready", description: "Pass 3 practice exams", category: "exam", progress: 33 },
    { id: "a5", title: "Case Closer", description: "Complete 5 case studies", category: "case", progress: 20 },
    { id: "a6", title: "Fortnight Focus", description: "14-day study streak", category: "streak", progress: 36 },
  ],
  totalMastered: 36,
  totalStudyMinutes: 1240,
  examsCompleted: 1,
  casesCompleted: 1,
};

interface Props {
  data?: AchievementData;
  onGoalTap?: (goalId: string) => void;
}

export default function AchievementSystem({ data, onGoalTap }: Props) {
  const d = data ?? DEMO_DATA;
  const [filter, setFilter] = useState<string>("all");

  const earned = d.achievements.filter(a => a.progress >= 100);
  const inProgress = d.achievements.filter(a => a.progress > 0 && a.progress < 100);

  const filtered = filter === "all" ? d.achievements : d.achievements.filter(a => a.category === filter);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 md:pb-6">
      <h1 className="font-heading text-2xl font-bold mb-1">Achievements</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {earned.length} earned · {inProgress.length} in progress
      </p>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Flame className={`w-5 h-5 mx-auto mb-1 ${d.streak.current > 0 ? "text-amber-400" : "text-muted-foreground/30"}`} />
          <div className="text-lg font-heading font-bold">{d.streak.current}</div>
          <div className="text-[10px] text-muted-foreground">Day Streak</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Crown className="w-5 h-5 mx-auto mb-1 text-purple-400" />
          <div className="text-lg font-heading font-bold">{d.totalMastered}</div>
          <div className="text-[10px] text-muted-foreground">Mastered</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Award className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
          <div className="text-lg font-heading font-bold">{d.examsCompleted}</div>
          <div className="text-[10px] text-muted-foreground">Exams</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card/60 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-sky-400" />
          <div className="text-lg font-heading font-bold">{Math.round(d.totalStudyMinutes / 60)}h</div>
          <div className="text-[10px] text-muted-foreground">Study Time</div>
        </div>
      </div>

      {/* Daily goals */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 px-1">Today's Goals</h2>
        <div className="space-y-2">
          {d.dailyGoals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            const complete = pct >= 100;
            return (
              <button key={goal.id} onClick={() => onGoalTap?.(goal.id)}
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
          <button key={cat.key} onClick={() => setFilter(cat.key)}
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
  );
}
