/**
 * StudyAnalytics.tsx — Study performance analytics dashboard
 *
 * Pass 36. Displays mastery progress, discipline breakdown, streak data,
 * and study session history with charts.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, ArrowLeft, Brain, Trophy, Clock,
  TrendingUp, Target, Flame, BookOpen, Zap,
  Calendar, CheckCircle2,
} from "lucide-react";

export default function StudyAnalytics() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, { enabled: !!isAuthenticated });
  const disciplinesQ = trpc.learning.content.listDisciplines.useQuery(undefined, { enabled: !!isAuthenticated });
  const sessionsQ = trpc.learningSocial.studySessions.list.useQuery({ limit: 50 }, { enabled: !!isAuthenticated });

  // Compute analytics from mastery data
  const analytics = useMemo(() => {
    const items = masteryQ.data ?? [];
    const summary = summaryQ.data;
    const sessions = sessionsQ.data ?? [];

    // Streak calculation
    const reviewDates = new Set<string>();
    for (const item of items) {
      if (item.lastReviewedAt) {
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

    // Accuracy
    let totalCorrect = 0;
    let totalReviews = 0;
    for (const item of items) {
      totalCorrect += item.correctCount ?? 0;
      totalReviews += (item.correctCount ?? 0) + (item.incorrectCount ?? 0);
    }
    const accuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

    // Item type breakdown
    const byType: Record<string, number> = {};
    for (const item of items) {
      const type = item.itemType ?? "unknown";
      byType[type] = (byType[type] ?? 0) + 1;
    }

    // Mastery distribution
    const levels = { beginner: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const item of items) {
      const interval = item.interval ?? 0;
      if (interval >= 21) levels.mastered++;
      else if (interval >= 7) levels.reviewing++;
      else if (interval >= 1) levels.learning++;
      else levels.beginner++;
    }

    // Study time from sessions
    let totalMinutes = 0;
    for (const s of sessions) {
      totalMinutes += s.durationMinutes ?? 0;
    }

    // Weekly activity (last 7 days)
    const weeklyActivity: { day: string; count: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const count = reviewDates.has(key) ? 1 : 0;
      weeklyActivity.push({ day: dayNames[d.getDay()], count });
    }

    return {
      totalItems: items.length,
      totalReviews,
      accuracy,
      streak,
      levels,
      byType,
      totalMinutes,
      weeklyActivity,
      masteredCount: summary?.masteredCount ?? levels.mastered,
      dueCount: summary?.dueCount ?? 0,
      newFlashcards: summary?.newFlashcards ?? 0,
      newQuestions: summary?.newQuestions ?? 0,
    };
  }, [masteryQ.data, summaryQ.data, sessionsQ.data]);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
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

  return (
    <AppShell>
      <SEOHead title="Study Analytics" description="Track your learning progress" />
      <div className="container max-w-5xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Study Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Your learning performance at a glance</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs">Streak</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.streak} days</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="h-4 w-4 text-green-500" />
                    <span className="text-xs">Accuracy</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.accuracy.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    <span className="text-xs">Total Reviews</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.totalReviews.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span className="text-xs">Study Time</span>
                  </div>
                  <div className="text-2xl font-bold">{Math.round(analytics.totalMinutes / 60)}h {analytics.totalMinutes % 60}m</div>
                </CardContent>
              </Card>
            </div>

            {/* Mastery Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" /> Mastery Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Mastered", count: analytics.levels.mastered, color: "bg-green-500", pct: analytics.totalItems > 0 ? (analytics.levels.mastered / analytics.totalItems) * 100 : 0 },
                  { label: "Reviewing", count: analytics.levels.reviewing, color: "bg-blue-500", pct: analytics.totalItems > 0 ? (analytics.levels.reviewing / analytics.totalItems) * 100 : 0 },
                  { label: "Learning", count: analytics.levels.learning, color: "bg-yellow-500", pct: analytics.totalItems > 0 ? (analytics.levels.learning / analytics.totalItems) * 100 : 0 },
                  { label: "New", count: analytics.levels.beginner, color: "bg-gray-400", pct: analytics.totalItems > 0 ? (analytics.levels.beginner / analytics.totalItems) * 100 : 0 },
                ].map((level) => (
                  <div key={level.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{level.label}</span>
                      <span className="text-muted-foreground">{level.count} ({level.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${level.color}`} style={{ width: `${level.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Weekly Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> Weekly Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-24">
                  {analytics.weeklyActivity.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t transition-all ${day.count > 0 ? "bg-primary" : "bg-muted"}`}
                        style={{ height: day.count > 0 ? "100%" : "8px" }}
                      />
                      <span className="text-xs text-muted-foreground">{day.day}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Content Type Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" /> Content Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(analytics.byType).map(([type, count]) => (
                    <div key={type} className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{type}s</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Queue Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <Trophy className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
                  <div className="text-2xl font-bold">{analytics.masteredCount}</div>
                  <div className="text-xs text-muted-foreground">Items Mastered</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <TrendingUp className="mx-auto h-8 w-8 text-blue-500 mb-2" />
                  <div className="text-2xl font-bold">{analytics.dueCount}</div>
                  <div className="text-xs text-muted-foreground">Due for Review</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-green-500 mb-2" />
                  <div className="text-2xl font-bold">{analytics.newFlashcards + analytics.newQuestions}</div>
                  <div className="text-xs text-muted-foreground">New Items Available</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
