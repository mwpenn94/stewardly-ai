import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, GraduationCap, Sparkles, ChevronRight, Trophy, DollarSign, TrendingUp, Shield, Landmark, FileText, Umbrella, CreditCard, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";

export default function EducationCenter() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const modulesQuery = trpc.education.modules.useQuery(
    selectedCategory ? { category: selectedCategory } : undefined,
    { enabled: !!user }
  );
  const progressQuery = trpc.education.progress.useQuery(undefined, { enabled: !!user });
  const recommendedQuery = trpc.education.recommended.useQuery(undefined, { enabled: !!user });
  const moduleDetail = trpc.education.module.useQuery(
    { id: selectedModule! },
    { enabled: !!selectedModule }
  );
  const utils = trpc.useUtils();

  const startMutation = trpc.education.start.useMutation({
    onSuccess: () => utils.education.progress.invalidate(),
  });
  const completeMutation = trpc.education.complete.useMutation({
    onSuccess: () => {
      utils.education.progress.invalidate();
      utils.education.recommended.invalidate();
    },
  });

  const modules = modulesQuery.data || [];
  const progress = progressQuery.data || [];
  const recommended = recommendedQuery.data || [];
  const completedIds = new Set(progress.filter((p: any) => p.completedAt).map((p: any) => p.moduleId));
  const startedIds = new Set(progress.map((p: any) => p.moduleId));
  const completionRate = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;

  const categories: { id: string | undefined; label: string; icon: React.ReactNode }[] = [
    { id: undefined, label: "All", icon: <BookOpen className="w-4 h-4" /> },
    { id: "budgeting", label: "Budgeting", icon: <DollarSign className="w-4 h-4" /> },
    { id: "investing", label: "Investing", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "insurance", label: "Insurance", icon: <Shield className="w-4 h-4" /> },
    { id: "tax", label: "Tax", icon: <Landmark className="w-4 h-4" /> },
    { id: "estate", label: "Estate", icon: <FileText className="w-4 h-4" /> },
    { id: "retirement", label: "Retirement", icon: <Umbrella className="w-4 h-4" /> },
    { id: "debt", label: "Debt", icon: <CreditCard className="w-4 h-4" /> },
    { id: "credit", label: "Credit", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const difficultyColor = (d: string) => {
    switch (d) {
      case "beginner": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "intermediate": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "advanced": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  // Module detail view
  if (selectedModule && moduleDetail.data) {
    const mod = moduleDetail.data;
    const isCompleted = completedIds.has(mod.id);
    const isStarted = startedIds.has(mod.id);
    return (
      <div className="min-h-screen bg-background text-foreground animate-curtain-lift">
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedModule(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">{mod.title}</h1>
            </div>
            {!isCompleted && (
              <Button
                size="sm"
                onClick={() => {
                  if (!isStarted) startMutation.mutate({ moduleId: mod.id });
                  completeMutation.mutate({ moduleId: mod.id, score: 1.0 });
                }}
                disabled={completeMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>
            )}
            {isCompleted && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
              </Badge>
            )}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Badge variant="outline" className={difficultyColor(mod.difficulty || "beginner")}>
              {mod.difficulty}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {mod.estimatedMinutes} min read
            </span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{mod.content || ""}</Streamdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Chat
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">Education Center</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <Trophy className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{completionRate}%</div>
              <Progress value={completionRate} className="mt-2 h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">{completedIds.size} of {modules.length} modules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">In Progress</span>
                <BookOpen className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{startedIds.size - completedIds.size}</div>
              <p className="text-xs text-muted-foreground mt-1">modules started</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Available</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{modules.length - startedIds.size}</div>
              <p className="text-xs text-muted-foreground mt-1">new modules to explore</p>
            </CardContent>
          </Card>
        </div>

        {/* Recommended */}
        {recommended.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Recommended for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommended.map((mod: any) => (
                <Card
                  key={mod.id}
                  className="cursor-pointer hover:border-accent/50 transition-colors group"
                  onClick={() => {
                    if (!startedIds.has(mod.id)) startMutation.mutate({ moduleId: mod.id });
                    setSelectedModule(mod.id);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={difficultyColor(mod.difficulty || "beginner")}>
                        {mod.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{mod.estimatedMinutes} min</span>
                    </div>
                    <CardTitle className="text-sm">{mod.title}</CardTitle>
                    <CardDescription className="text-xs">{mod.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center text-xs text-accent group-hover:underline">
                      Start learning <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Button
              key={cat.id || "all"}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="text-xs"
            >
              {cat.icon} {cat.label}
            </Button>
          ))}
        </div>

        {/* All Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod: any) => {
            const completed = completedIds.has(mod.id);
            const started = startedIds.has(mod.id) && !completed;
            return (
              <Card
                key={mod.id}
                className={`cursor-pointer transition-colors ${completed ? "border-emerald-500/30 bg-emerald-500/5" : "hover:border-accent/50"}`}
                onClick={() => {
                  if (!startedIds.has(mod.id)) startMutation.mutate({ moduleId: mod.id });
                  setSelectedModule(mod.id);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={difficultyColor(mod.difficulty || "beginner")}>
                      {mod.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{mod.category}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{mod.estimatedMinutes} min</span>
                  </div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {mod.title}
                  </CardTitle>
                  <CardDescription className="text-xs">{mod.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center text-xs">
                    {completed ? (
                      <span className="text-emerald-500">Completed</span>
                    ) : started ? (
                      <span className="text-blue-500">In Progress</span>
                    ) : (
                      <span className="text-muted-foreground group-hover:text-accent">Start learning</span>
                    )}
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
