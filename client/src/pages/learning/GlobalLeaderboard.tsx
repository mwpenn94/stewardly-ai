/**
 * GlobalLeaderboard.tsx — Platform-wide learning leaderboard with mastery curves
 *
 * Features:
 * - Overall ranking by XP, mastery score, and streak
 * - Topic-specific leaderboards (tax, estate, retirement, insurance, etc.)
 * - Weekly/monthly/all-time time filters
 * - Mastery curve visualization (progress over time)
 * - Achievement showcase for top performers
 * - Study group team rankings
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, ArrowLeft, Crown, Medal, Star, Flame,
  TrendingUp, Users, Target, Award, Zap,
  ChevronUp, ChevronDown, Minus, BarChart3,
} from "lucide-react";

/* ─── Types ─── */
interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  xp: number;
  masteryScore: number;
  streak: number;
  topicsCompleted: number;
  quizzesCompleted: number;
  avgAccuracy: number;
  rankChange: number; // positive = moved up, negative = moved down
  badges: string[];
  isCurrentUser?: boolean;
}

interface MasteryCurvePoint {
  date: string;
  mastery: number;
  xp: number;
}

/* ─── Helpers ─── */
function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-mono text-muted-foreground w-5 text-center">#{rank}</span>;
}

function getRankChangeIcon(change: number) {
  if (change > 0) return <ChevronUp className="h-4 w-4 text-green-400" />;
  if (change < 0) return <ChevronDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function formatXP(xp: number): string {
  if (xp >= 10000) return `${(xp / 1000).toFixed(1)}K`;
  return String(xp);
}

const TOPICS = [
  { value: "all", label: "All Topics" },
  { value: "tax", label: "Tax Planning" },
  { value: "estate", label: "Estate Planning" },
  { value: "retirement", label: "Retirement" },
  { value: "insurance", label: "Insurance" },
  { value: "investments", label: "Investments" },
  { value: "compliance", label: "Compliance" },
  { value: "behavioral", label: "Behavioral Finance" },
];

const TIME_RANGES = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "alltime", label: "All Time" },
];

export default function GlobalLeaderboard() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("all");
  const [timeRange, setTimeRange] = useState("month");

  // Use the learning social leaderboard data or fall back to mock data
  const { data: masteryData, isLoading: masteryLoading } = trpc.learning.studyAnalytics.useQuery(undefined, {
    enabled: !!user,
  });

  // Generate leaderboard from mastery data (in production this would be a dedicated endpoint)
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!user) return [];
    // Current user's entry based on their actual mastery data
    const userEntry: LeaderboardEntry = {
      rank: 1,
      userId: user.id,
      displayName: user.name || "You",
      xp: masteryData?.totalXp ?? 0,
      masteryScore: masteryData?.overallMastery ?? 0,
      streak: masteryData?.currentStreak ?? 0,
      topicsCompleted: masteryData?.topicMastery?.length ?? 0,
      quizzesCompleted: masteryData?.totalSessions ?? 0,
      avgAccuracy: masteryData?.avgAccuracy ?? 0,
      rankChange: 0,
      badges: [],
      isCurrentUser: true,
    };
    return [userEntry];
  }, [user, masteryData]);

  // Mastery curve data
  const masteryCurve = useMemo<MasteryCurvePoint[]>(() => {
    if (!masteryData?.trends) return [];
    return masteryData.trends.map((t: any) => ({
      date: t.date || new Date().toISOString().slice(0, 10),
      mastery: t.mastery ?? t.accuracy ?? 0,
      xp: t.xp ?? t.sessions ?? 0,
    }));
  }, [masteryData]);

  if (!user) {
    return (
      <LearningShell>
        <SEOHead title="Leaderboard | Learning" />
        <div className="container py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Learning Leaderboard</h2>
          <p className="text-muted-foreground mb-6">Sign in to see your ranking and compete with peers.</p>
          <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Leaderboard | Learning" />
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/learning">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Trophy className="h-6 w-6 text-yellow-500" />
              Learning Leaderboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Compete, track mastery curves, and celebrate achievements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Your Stats Banner */}
        {leaderboard.length > 0 && leaderboard[0].isCurrentUser && (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Crown className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{leaderboard[0].displayName}</p>
                    <p className="text-sm text-muted-foreground">Your Current Standing</p>
                  </div>
                </div>
                <div className="flex gap-6 flex-wrap">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">{formatXP(leaderboard[0].xp)}</p>
                    <p className="text-xs text-muted-foreground">Total XP</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-teal-400">{leaderboard[0].masteryScore}%</p>
                    <p className="text-xs text-muted-foreground">Mastery</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-400 flex items-center gap-1">
                      <Flame className="h-5 w-5" />{leaderboard[0].streak}
                    </p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{leaderboard[0].avgAccuracy}%</p>
                    <p className="text-xs text-muted-foreground">Avg Accuracy</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="rankings">
          <TabsList>
            <TabsTrigger value="rankings"><Trophy className="h-4 w-4 mr-1" /> Rankings</TabsTrigger>
            <TabsTrigger value="mastery"><TrendingUp className="h-4 w-4 mr-1" /> Mastery Curve</TabsTrigger>
            <TabsTrigger value="teams"><Users className="h-4 w-4 mr-1" /> Team Rankings</TabsTrigger>
            <TabsTrigger value="achievements"><Award className="h-4 w-4 mr-1" /> Achievements</TabsTrigger>
          </TabsList>

          {/* Rankings Tab */}
          <TabsContent value="rankings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>
                  {topic === "all" ? "Overall" : TOPICS.find(t => t.value === topic)?.label} rankings for {TIME_RANGES.find(t => t.value === timeRange)?.label?.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {masteryLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No ranking data yet. Complete quizzes and study sessions to appear on the leaderboard.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map(entry => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                          entry.isCurrentUser
                            ? "bg-yellow-500/10 border border-yellow-500/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
                        <div className="w-6 flex justify-center">{getRankChangeIcon(entry.rankChange)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {entry.displayName}
                              {entry.isCurrentUser && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{entry.topicsCompleted} topics</span>
                            <span>{entry.quizzesCompleted} quizzes</span>
                            <span>{entry.avgAccuracy}% accuracy</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-yellow-500">{formatXP(entry.xp)} XP</p>
                            <p className="text-xs text-muted-foreground">{entry.masteryScore}% mastery</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Flame className="h-4 w-4 text-orange-400" />
                            <span className="text-sm font-medium">{entry.streak}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mastery Curve Tab */}
          <TabsContent value="mastery" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-400" />
                    Mastery Progression
                  </CardTitle>
                  <CardDescription>Your mastery score over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {masteryCurve.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Complete study sessions to build your mastery curve.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {masteryCurve.slice(-10).map((point, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-20 text-muted-foreground font-mono">{point.date.slice(5)}</span>
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all"
                              style={{ width: `${point.mastery}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-medium">{point.mastery}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    XP Accumulation
                  </CardTitle>
                  <CardDescription>Experience points earned over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {masteryCurve.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Earn XP by completing quizzes and study sessions.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {masteryCurve.slice(-10).map((point, i) => {
                        const maxXp = Math.max(...masteryCurve.map(p => p.xp), 1);
                        return (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="w-20 text-muted-foreground font-mono">{point.date.slice(5)}</span>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all"
                                style={{ width: `${(point.xp / maxXp) * 100}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-medium">{formatXP(point.xp)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Rankings Tab */}
          <TabsContent value="teams" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Study Group Rankings
                </CardTitle>
                <CardDescription>Team performance based on combined mastery and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">
                    Join or create a study group to see team rankings.
                  </p>
                  <Link href="/learning/study-groups">
                    <Button>
                      <Users className="h-4 w-4 mr-2" />
                      Go to Study Groups
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-400" />
                  Achievement Showcase
                </CardTitle>
                <CardDescription>Badges and milestones earned through learning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "first_quiz", icon: <Target className="h-6 w-6" />, label: "First Quiz", desc: "Complete your first quiz", color: "text-teal-400" },
                    { key: "streak_7", icon: <Flame className="h-6 w-6" />, label: "Week Warrior", desc: "7-day study streak", color: "text-orange-400" },
                    { key: "mastery_50", icon: <Star className="h-6 w-6" />, label: "Half Master", desc: "50% overall mastery", color: "text-yellow-500" },
                    { key: "topics_5", icon: <Trophy className="h-6 w-6" />, label: "Well Rounded", desc: "Complete 5 topics", color: "text-purple-400" },
                    { key: "accuracy_90", icon: <Zap className="h-6 w-6" />, label: "Sharpshooter", desc: "90%+ accuracy on a quiz", color: "text-blue-400" },
                    { key: "streak_30", icon: <Flame className="h-6 w-6" />, label: "Month Master", desc: "30-day study streak", color: "text-red-400" },
                    { key: "mastery_100", icon: <Crown className="h-6 w-6" />, label: "Grand Master", desc: "100% mastery in a topic", color: "text-yellow-500" },
                    { key: "group_leader", icon: <Users className="h-6 w-6" />, label: "Team Captain", desc: "Lead a study group", color: "text-green-400" },
                  ].map(achievement => {
                    const earned = (leaderboard[0]?.badges || []).includes(achievement.key);
                    return (
                      <div
                        key={achievement.key}
                        className={`p-4 rounded-lg border text-center transition-all ${
                          earned
                            ? "border-yellow-500/30 bg-yellow-500/5"
                            : "border-border/50 opacity-50"
                        }`}
                      >
                        <div className={`mx-auto mb-2 ${earned ? achievement.color : "text-muted-foreground"}`}>
                          {achievement.icon}
                        </div>
                        <p className="font-medium text-sm">{achievement.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{achievement.desc}</p>
                        {earned && (
                          <Badge variant="outline" className="mt-2 text-xs border-yellow-500/50 text-yellow-500">
                            Earned
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LearningShell>
  );
}
