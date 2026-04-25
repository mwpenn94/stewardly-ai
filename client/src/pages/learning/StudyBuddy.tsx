/**
 * StudyBuddy.tsx — AI-powered study companion hub (Pass 103).
 *
 * Unified entry point for all study features:
 *   - Quick-start study session (AI generates flashcards from any topic)
 *   - Spaced repetition review queue
 *   - Exam prep shortcuts (Series 6/7/63/65/66, Life & Health)
 *   - Study analytics (streak, mastery, weak areas)
 *   - Document-based study (upload PDF/notes → AI generates questions)
 */
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Brain, GraduationCap, Sparkles, Target, Clock,
  Flame, Trophy, ArrowRight, ArrowLeft, Search, FileText, Upload,
  Zap, BarChart3, Shield, Award, ChevronRight, Play,
  RefreshCw, Lightbulb, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  loadStreakFromStorage,
  summarizeStreak,
  type StreakSummary,
} from "./lib/studyStreak";

// ─── Exam Prep Tracks ────────────────────────────────────────────────────────
const EXAM_TRACKS = [
  { slug: "series-6", name: "Series 6", desc: "Investment Company Products", icon: "📊", questions: 100, timeMin: 135, passRate: 70 },
  { slug: "series-7", name: "Series 7", desc: "General Securities Representative", icon: "📈", questions: 125, timeMin: 225, passRate: 72 },
  { slug: "series-63", name: "Series 63", desc: "Uniform Securities Agent", icon: "⚖️", questions: 60, timeMin: 75, passRate: 72 },
  { slug: "series-65", name: "Series 65", desc: "Investment Adviser Representative", icon: "🎯", questions: 130, timeMin: 180, passRate: 72 },
  { slug: "series-66", name: "Series 66", desc: "Uniform Combined State Law", icon: "📋", questions: 100, timeMin: 150, passRate: 73 },
  { slug: "life-health", name: "Life & Health", desc: "Insurance License Exam", icon: "❤️", questions: 150, timeMin: 120, passRate: 70 },
  { slug: "sie", name: "SIE", desc: "Securities Industry Essentials", icon: "🏛️", questions: 75, timeMin: 105, passRate: 70 },
  { slug: "series-24", name: "Series 24", desc: "General Securities Principal", icon: "👔", questions: 150, timeMin: 210, passRate: 70 },
];

// ─── Quick Study Topics ──────────────────────────────────────────────────────
const QUICK_TOPICS = [
  { label: "IUL Mechanics", category: "Products" },
  { label: "Estate Planning Basics", category: "Planning" },
  { label: "Tax-Loss Harvesting", category: "Strategies" },
  { label: "Fiduciary Duty", category: "Compliance" },
  { label: "Roth Conversion", category: "Retirement" },
  { label: "Premium Financing", category: "Advanced" },
  { label: "Annuity Types", category: "Products" },
  { label: "Risk Tolerance", category: "Planning" },
];

export default function StudyBuddy() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [quickTopic, setQuickTopic] = useState("");
  const [studyMode, setStudyMode] = useState<"flashcards" | "quiz" | "deep-dive">("flashcards");

  // Queries
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const dueQ = trpc.learning.mastery.dueItems.useQuery(undefined, { enabled: !!isAuthenticated });
  const tracksQ = trpc.learning.content.listTracks.useQuery(undefined, { enabled: !!isAuthenticated });

  // Streak
  const streak = useMemo(() => summarizeStreak(loadStreakFromStorage(), new Date()), []);

  // Stats
  const mastery = summaryQ.data;
  const dueCount = dueQ.data?.length ?? 0;
  const trackCount = tracksQ.data?.length ?? 0;

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Study Buddy" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Study Buddy</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to access your AI-powered study companion.</p>
            <a href={getLoginUrl("/learning/study-buddy")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"><Brain className="w-4 h-4" /> Sign In</a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const pageLoading = summaryQ.isLoading || dueQ.isLoading || tracksQ.isLoading;
  if (pageLoading) {
    return (
      <LearningShell>
        <SEOHead title="Study Buddy" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading study data...</div>
        </div>
      </LearningShell>
    );
  }

  const handleQuickStudy = (topic: string) => {
    if (!topic.trim()) {
      toast.error("Enter a topic to study");
      return;
    }
    // Navigate to chat with study focus pre-selected
    navigate(`/chat?focus=study&prompt=${encodeURIComponent(`Help me study: ${topic}. Create flashcards and quiz questions.`)}`);
  };

  return (
    <LearningShell>
      <SEOHead title="Study Buddy — AI Study Companion" />
      <div className="min-h-screen px-6 lg:px-10 py-8 max-w-6xl mx-auto space-y-6">
        {/* Header — KE pattern */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <div className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Brain className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Study Buddy</h1>
              <p className="text-xs text-muted-foreground font-mono">AI-powered study companion</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/learning">
                <BookOpen className="h-4 w-4 mr-1.5" />
                Learning Hub
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/learning/review">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Review Due ({dueCount})
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Flame className={`h-6 w-6 mx-auto mb-1 ${streak.current > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              <div className="text-2xl font-bold">{streak.current}</div>
              <div className="text-xs text-muted-foreground">Day Streak</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{(mastery as any)?.masteryPct ?? 0}%</div>
              <div className="text-xs text-muted-foreground">Mastery</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-1 text-amber-500" />
              <div className="text-2xl font-bold">{dueCount}</div>
              <div className="text-xs text-muted-foreground">Due Now</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
              <div className="text-2xl font-bold">{trackCount}</div>
              <div className="text-xs text-muted-foreground">Tracks</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Study */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Quick Study Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter any topic to study (e.g., 'IUL cash value mechanics')"
                value={quickTopic}
                onChange={(e) => setQuickTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickStudy(quickTopic)}
                className="flex-1"
              />
              <Button onClick={() => handleQuickStudy(quickTopic)} disabled={!quickTopic.trim()}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Study
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map((t) => (
                <Button
                  key={t.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleQuickStudy(t.label)}
                >
                  {t.label}
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">{t.category}</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exam Prep Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Exam Prep
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {EXAM_TRACKS.map((exam) => (
              <Card key={exam.slug} className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{exam.icon}</span>
                    <Badge variant="outline" className="text-[10px]">{exam.passRate}% pass</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{exam.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">{exam.desc}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{exam.questions} questions</span>
                    <span>{exam.timeMin} min</span>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => navigate(`/learning/exam/${exam.slug}`)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Practice
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleQuickStudy(`${exam.name} exam preparation`)}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Study
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Study Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/learning/review")}>
            <CardContent className="p-5 text-center">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold">Spaced Repetition</h3>
              <p className="text-xs text-muted-foreground mt-1">Review items at optimal intervals for long-term retention.</p>
              {dueCount > 0 && (
                <Badge className="mt-2 bg-blue-500/10 text-blue-500">{dueCount} due now</Badge>
              )}
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/learning/search")}>
            <CardContent className="p-5 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <h3 className="font-semibold">Search & Explore</h3>
              <p className="text-xs text-muted-foreground mt-1">Find specific topics across all study materials and tracks.</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/learning/connections")}>
            <CardContent className="p-5 text-center">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <h3 className="font-semibold">Concept Map</h3>
              <p className="text-xs text-muted-foreground mt-1">Visualize connections between topics for deeper understanding.</p>
            </CardContent>
          </Card>
        </div>

        {/* Document Study */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              Study from Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Upload study materials and let AI generate flashcards, summaries, and practice questions.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/settings/knowledge")}>
                <Upload className="h-4 w-4 mr-1.5" />
                Upload Documents
              </Button>
              <Button variant="outline" onClick={() => handleQuickStudy("Generate study materials from my uploaded documents")}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                AI Generate from Docs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Achievements
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/learning/achievements">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Flame, label: "7-Day Streak", unlocked: streak.current >= 7, color: "text-orange-500" },
            { icon: Trophy, label: "First Exam", unlocked: ((mastery as any)?.totalReviews ?? 0) > 0, color: "text-amber-500" },
            { icon: Brain, label: "50% Mastery", unlocked: ((mastery as any)?.masteryPct ?? 0) >= 50, color: "text-purple-500" },
            { icon: Shield, label: "License Ready", unlocked: false, color: "text-emerald-500" },
          ].map((ach) => (
            <Card key={ach.label} className={`${ach.unlocked ? "" : "opacity-50"}`}>
              <CardContent className="p-3 text-center">
                <ach.icon className={`h-6 w-6 mx-auto mb-1 ${ach.unlocked ? ach.color : "text-muted-foreground"}`} />
                <div className="text-xs font-medium">{ach.label}</div>
                {ach.unlocked ? (
                  <CheckCircle2 className="h-3 w-3 mx-auto mt-1 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mx-auto mt-1 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LearningShell>
  );
}
