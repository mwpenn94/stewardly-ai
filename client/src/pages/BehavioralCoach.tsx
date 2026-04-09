import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Brain, Heart, TrendingUp, TrendingDown,
  Shield, Target, AlertTriangle, CheckCircle, Lightbulb,
  DollarSign, PiggyBank, CreditCard, BarChart3,
  ChevronRight, Sparkles, Activity,
} from "lucide-react";

// ─── Financial Wellness Score (FinHealth Framework) ────────────────────
interface WellnessIndicator {
  name: string;
  pillar: "spend" | "save" | "borrow" | "plan";
  score: number; // 0-100
  description: string;
  recommendation: string;
  trend: "up" | "down" | "stable";
}

const DEFAULT_INDICATORS: WellnessIndicator[] = [
  // Spend
  { name: "Spending vs Income", pillar: "spend", score: 72, description: "You spend about 78% of your income", recommendation: "Try to reduce discretionary spending by 5% to build more savings buffer.", trend: "stable" },
  { name: "Bill Payment", pillar: "spend", score: 95, description: "All bills paid on time for 6+ months", recommendation: "Excellent track record. Consider automating remaining manual payments.", trend: "up" },
  // Save
  { name: "Emergency Fund", pillar: "save", score: 60, description: "3.2 months of expenses saved", recommendation: "Aim for 6 months. Consider automating $500/month to your emergency fund.", trend: "up" },
  { name: "Long-term Savings", pillar: "save", score: 55, description: "Saving 12% of income for retirement", recommendation: "Increase to 15% if possible. Even 1% more compounds significantly over 20+ years.", trend: "stable" },
  // Borrow
  { name: "Debt-to-Income", pillar: "borrow", score: 78, description: "DTI ratio at 28%", recommendation: "Good range. Focus on paying down highest-interest debt first.", trend: "up" },
  { name: "Credit Utilization", pillar: "borrow", score: 85, description: "Using 15% of available credit", recommendation: "Well managed. Keep utilization below 30% for optimal credit score impact.", trend: "stable" },
  // Plan
  { name: "Insurance Coverage", pillar: "plan", score: 45, description: "Missing disability insurance", recommendation: "Disability insurance protects your earning power. Consider a policy covering 60% of income.", trend: "down" },
  { name: "Estate Planning", pillar: "plan", score: 30, description: "No will or power of attorney on file", recommendation: "Basic estate documents protect your family. Start with a will and healthcare proxy.", trend: "stable" },
];

const PILLAR_CONFIG = {
  spend: { label: "Spend", icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/10" },
  save: { label: "Save", icon: PiggyBank, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  borrow: { label: "Borrow", icon: CreditCard, color: "text-amber-400", bg: "bg-amber-500/10" },
  plan: { label: "Plan", icon: Target, color: "text-purple-400", bg: "bg-purple-500/10" },
};

function getScoreClass(score: number) {
  if (score >= 80) return { label: "Healthy", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (score >= 40) return { label: "Coping", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" };
  return { label: "Vulnerable", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

// ─── Behavioral Nudges ─────────────────────────────────────────────────
interface Nudge {
  id: string;
  type: "market_downturn" | "excessive_checking" | "spending_alert" | "positive_reinforcement" | "milestone";
  title: string;
  message: string;
  severity: "info" | "gentle" | "important";
  actionLabel?: string;
  dismissed: boolean;
}

const SAMPLE_NUDGES: Nudge[] = [
  {
    id: "1", type: "market_downturn", title: "Market Perspective",
    message: "Markets dropped 3.2% this week. Historically, staying invested through downturns has led to recovery within 12-18 months on average. Your long-term plan accounts for these fluctuations.",
    severity: "info", actionLabel: "Review my plan", dismissed: false,
  },
  {
    id: "2", type: "positive_reinforcement", title: "Great Progress",
    message: "You've consistently saved above your target for 3 months straight. This habit is building real momentum toward your retirement goal.",
    severity: "info", dismissed: false,
  },
  {
    id: "3", type: "milestone", title: "Emergency Fund Milestone",
    message: "You've reached 3 months of emergency savings! You're now better prepared than 60% of Americans. Next milestone: 4 months.",
    severity: "info", actionLabel: "Set next goal", dismissed: false,
  },
  {
    id: "4", type: "excessive_checking", title: "Gentle Reminder",
    message: "You've checked your portfolio 5 times today. Research shows frequent checking can increase anxiety without improving outcomes. Consider focusing on your monthly review instead.",
    severity: "gentle", actionLabel: "View goals instead", dismissed: false,
  },
];

// ─── Habit Tracker ─────────────────────────────────────────────────────
interface Habit {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  streak: number;
  completedToday: boolean;
  category: string;
}

const SAMPLE_HABITS: Habit[] = [
  { id: "1", name: "Review budget", frequency: "weekly", streak: 4, completedToday: false, category: "Spending" },
  { id: "2", name: "Check savings goal", frequency: "monthly", streak: 6, completedToday: false, category: "Saving" },
  { id: "3", name: "Log expenses", frequency: "daily", streak: 12, completedToday: true, category: "Spending" },
  { id: "4", name: "Read financial article", frequency: "weekly", streak: 2, completedToday: false, category: "Education" },
];

// ─── Main Component ────────────────────────────────────────────────────
export default function BehavioralCoach() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [indicators] = useState(DEFAULT_INDICATORS);
  const [nudges, setNudges] = useState(SAMPLE_NUDGES);
  const [habits, setHabits] = useState(SAMPLE_HABITS);
  const [activeTab, setActiveTab] = useState("wellness");

  const overallScore = useMemo(() => {
    const avg = indicators.reduce((sum, i) => sum + i.score, 0) / indicators.length;
    return Math.round(avg);
  }, [indicators]);

  const pillarScores = useMemo(() => {
    const pillars: Record<string, number[]> = {};
    indicators.forEach(i => {
      if (!pillars[i.pillar]) pillars[i.pillar] = [];
      pillars[i.pillar].push(i.score);
    });
    return Object.entries(pillars).map(([pillar, scores]) => ({
      pillar: pillar as keyof typeof PILLAR_CONFIG,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  }, [indicators]);

  const scoreClass = getScoreClass(overallScore);

  const dismissNudge = (id: string) => {
    setNudges(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  };

  const toggleHabit = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, completedToday: !h.completedToday, streak: !h.completedToday ? h.streak + 1 : h.streak - 1 } : h));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> Behavioral Coach
            </h1>
            <p className="text-xs text-muted-foreground">Financial wellness, nudges, and habit building</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="wellness" className="gap-1.5"><Heart className="w-3.5 h-3.5" /> Wellness Score</TabsTrigger>
            <TabsTrigger value="nudges" className="gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Nudges</TabsTrigger>
            <TabsTrigger value="habits" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Habits</TabsTrigger>
          </TabsList>

          {/* ─── Wellness Score Tab ─────────────────────────────────── */}
          <TabsContent value="wellness">
            <div className="space-y-6">
              {/* Overall Score */}
              <Card className={`${scoreClass.border} ${scoreClass.bg}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Financial Wellness Score</p>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className={`text-5xl font-bold ${scoreClass.color}`}>{overallScore}</span>
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <Badge className={`mt-2 ${scoreClass.bg} ${scoreClass.color}`}>{scoreClass.label}</Badge>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-muted-foreground">FinHealth Framework</p>
                      <p className="text-xs text-muted-foreground">8 indicators · 4 pillars</p>
                      <p className="text-xs text-muted-foreground">Updated monthly</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pillar Scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {pillarScores.map(({ pillar, score }) => {
                  const config = PILLAR_CONFIG[pillar];
                  const sc = getScoreClass(score);
                  const Icon = config.icon;
                  return (
                    <Card key={pillar}>
                      <CardContent className="p-4 text-center">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${config.bg} mb-2`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <p className={`text-2xl font-bold font-mono tabular-nums ${sc.color}`}>{score}</p>
                        <p className="text-xs text-muted-foreground">{config.label}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Indicators Detail */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Detailed Indicators</h3>
                {indicators.map((ind, i) => {
                  const config = PILLAR_CONFIG[ind.pillar];
                  const sc = getScoreClass(ind.score);
                  return (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                            <span className="text-sm font-medium">{ind.name}</span>
                            {ind.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                            {ind.trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
                          </div>
                          <span className={`text-sm font-bold ${sc.color}`}>{ind.score}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{ind.description}</p>
                        <Progress value={ind.score} className="h-1.5 mb-2" />
                        <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-secondary/30">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">{ind.recommendation}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ─── Nudges Tab ─────────────────────────────────────────── */}
          <TabsContent value="nudges">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Personalized behavioral insights to help you stay on track</p>

              {nudges.filter(n => !n.dismissed).length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-medium">All caught up</p>
                    <p className="text-xs text-muted-foreground">No active nudges right now. Keep up the good work.</p>
                  </CardContent>
                </Card>
              )}

              {nudges.filter(n => !n.dismissed).map(nudge => {
                const severityConfig = {
                  info: { icon: Sparkles, color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/20" },
                  gentle: { icon: Heart, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20" },
                  important: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/20" },
                }[nudge.severity];
                const Icon = severityConfig.icon;

                return (
                  <Card key={nudge.id} className={`${severityConfig.border} ${severityConfig.bg}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${severityConfig.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium">{nudge.title}</h4>
                            <Badge variant="outline" className="text-[10px]">{nudge.type.replace(/_/g, " ")}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{nudge.message}</p>
                          <div className="flex gap-2 mt-3">
                            {nudge.actionLabel && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                {nudge.actionLabel} <ChevronRight className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => dismissNudge(nudge.id)}>
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── Habits Tab ─────────────────────────────────────────── */}
          <TabsContent value="habits">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Build positive financial habits with streak tracking</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" />
                  {habits.filter(h => h.completedToday).length}/{habits.length} today
                </div>
              </div>

              <div className="space-y-2">
                {habits.map(habit => (
                  <Card key={habit.id} className={habit.completedToday ? "border-emerald-500/20 bg-emerald-500/5" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <button
                        onClick={() => toggleHabit(habit.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          habit.completedToday
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border hover:border-emerald-500/50"
                        }`}
                      >
                        {habit.completedToday && <CheckCircle className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${habit.completedToday ? "line-through text-muted-foreground" : ""}`}>
                            {habit.name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{habit.frequency}</Badge>
                          <Badge variant="outline" className="text-[10px]">{habit.category}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold text-amber-400">{habit.streak}</span>
                          <span className="text-[10px] text-muted-foreground">streak</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Streak Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Streak Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">{Math.max(...habits.map(h => h.streak))}</p>
                      <p className="text-xs text-muted-foreground">Best Streak</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono tabular-nums text-blue-400">{habits.filter(h => h.completedToday).length}</p>
                      <p className="text-xs text-muted-foreground">Done Today</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{Math.round((habits.filter(h => h.streak > 0).length / habits.length) * 100)}%</p>
                      <p className="text-xs text-muted-foreground">Active Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
