/**
 * §P0-5 Daily Practice Streak Widget
 * Shows current streak, longest streak, and daily practice status.
 * Can be embedded in dashboard, learning home, or sidebar.
 */
import { trpc } from "@/lib/trpc";
import { Flame, Trophy, Calendar, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useMemo } from "react";

interface StreakWidgetProps {
  compact?: boolean;
  className?: string;
}

export function StreakWidget({ compact = false, className = "" }: StreakWidgetProps) {
  const [, navigate] = useLocation();
  const streakQ = trpc.learning.streaks.get.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });

  const streak = streakQ.data;
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  // @ts-expect-error — property access on loosely typed object
  const todayComplete = streak?.todayComplete ?? false;
  // @ts-expect-error — property access on loosely typed object
  const weeklyGoal = streak?.weeklyGoal ?? 5;
  // @ts-expect-error — property access on loosely typed object
  const weeklyProgress = streak?.weeklyProgress ?? 0;

  const streakEmoji = useMemo(() => {
    if (currentStreak >= 30) return "🔥";
    if (currentStreak >= 7) return "⚡";
    if (currentStreak >= 3) return "✨";
    return "💪";
  }, [currentStreak]);

  if (streakQ.isLoading) {
    return compact ? (
      <div className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm animate-pulse ${className}`}>
        <Flame className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    ) : (
      <Card className={`border-border/50 bg-card/80 backdrop-blur animate-pulse ${className}`}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Loading streak...</CardTitle></CardHeader>
      </Card>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => navigate("/learning")}
        className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-accent/50 ${className}`}
      >
        <Flame className={`h-4 w-4 ${todayComplete ? "text-orange-400" : "text-muted-foreground"}`} />
        <span className="font-medium">{currentStreak} day streak</span>
        {todayComplete && (
          <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">Done</span>
        )}
      </button>
    );
  }

  return (
    <Card className={`border-border/50 bg-card/80 backdrop-blur ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-5 w-5 text-orange-400" />
          Daily Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-center gap-1 py-2">
          <span className="text-3xl font-bold">{currentStreak}</span>
          <span className="text-lg text-muted-foreground">days {streakEmoji}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <Trophy className="mx-auto h-4 w-4 text-yellow-400" />
            <p className="text-sm font-bold">{longestStreak}</p>
            <p className="text-[10px] text-muted-foreground">Best</p>
          </div>
          <div>
            <Calendar className="mx-auto h-4 w-4 text-blue-400" />
            <p className="text-sm font-bold">{weeklyProgress}/{weeklyGoal}</p>
            <p className="text-[10px] text-muted-foreground">This Week</p>
          </div>
          <div>
            <Target className="mx-auto h-4 w-4 text-green-400" />
            <p className="text-sm font-bold">{todayComplete ? "✓" : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </div>
        </div>

        {/* Weekly progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Weekly Goal</span>
            <span>{Math.round((weeklyProgress / weeklyGoal) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
              style={{ width: `${Math.min((weeklyProgress / weeklyGoal) * 100, 100)}%` }}
            />
          </div>
        </div>

        {!todayComplete && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate("/learning")}
          >
            Start Today's Practice
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
