import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Sparkles, Loader2, Shield, TrendingUp, DollarSign,
  Users, CreditCard, Calendar, AlertTriangle, CheckCircle, Clock,
  Eye, X, ChevronRight, Zap, RefreshCw,
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  compliance: { icon: <Shield className="w-4 h-4" />, label: "Compliance", color: "text-red-400 bg-red-500/10" },
  portfolio: { icon: <TrendingUp className="w-4 h-4" />, label: "Portfolio", color: "text-blue-400 bg-blue-500/10" },
  tax: { icon: <DollarSign className="w-4 h-4" />, label: "Tax", color: "text-amber-400 bg-amber-500/10" },
  engagement: { icon: <Users className="w-4 h-4" />, label: "Engagement", color: "text-emerald-400 bg-emerald-500/10" },
  spending: { icon: <CreditCard className="w-4 h-4" />, label: "Spending", color: "text-purple-400 bg-purple-500/10" },
  life_event: { icon: <Calendar className="w-4 h-4" />, label: "Life Event", color: "text-cyan-400 bg-cyan-500/10" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string; bgColor: string }> = {
  critical: { color: "text-red-400", label: "Critical", bgColor: "bg-red-500/10 border-red-500/30" },
  high: { color: "text-amber-400", label: "High", bgColor: "bg-amber-500/10 border-amber-500/30" },
  medium: { color: "text-blue-400", label: "Medium", bgColor: "bg-blue-500/10 border-blue-500/30" },
  low: { color: "text-zinc-400", label: "Low", bgColor: "bg-zinc-500/10 border-zinc-500/30" },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  new: { icon: <Zap className="w-3 h-3" />, label: "New" },
  viewed: { icon: <Eye className="w-3 h-3" />, label: "Viewed" },
  acted: { icon: <CheckCircle className="w-3 h-3" />, label: "Acted" },
  dismissed: { icon: <X className="w-3 h-3" />, label: "Dismissed" },
  snoozed: { icon: <Clock className="w-3 h-3" />, label: "Snoozed" },
};

export default function Insights() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const insightsList = trpc.insights.list.useQuery(undefined, { staleTime: 30_000 });
  const stats = trpc.insights.stats.useQuery(undefined, { staleTime: 30_000 });
  const generateInsights = trpc.insights.generate.useMutation({
    onSuccess: () => {
      insightsList.refetch();
      stats.refetch();
    },
  });
  const updateStatus = trpc.insights.updateStatus.useMutation({
    onSuccess: () => {
      insightsList.refetch();
      stats.refetch();
    },
  });

  const filtered = useMemo(() => {
    if (!insightsList.data) return [];
    if (activeCategory === "all") return insightsList.data;
    return (Array.isArray(insightsList.data) ? insightsList.data : []).filter((i: any) => i.category === activeCategory);
  }, [insightsList.data, activeCategory]);

  // Guest session auto-provisions a user, so this is a fallback for edge cases
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border/50">
          <CardContent className="p-8 text-center space-y-4">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading Proactive Insights...</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back to Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap relative">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Proactive Insights</h1>
              <p className="text-xs text-muted-foreground">AI-generated alerts, opportunities, and action items</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => generateInsights.mutate()}
            disabled={generateInsights.isPending}
            className="gap-1.5"
          >
            {generateInsights.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Insights
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        {stats.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums">{stats.data.total}</p>
                <p className="text-xs text-muted-foreground">Total Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">{stats.data.newCount}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-red-400">{stats.data.byPriority?.critical || 0}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{stats.data.byPriority?.high || 0}</p>
                <p className="text-xs text-muted-foreground">High Priority</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setActiveCategory("all")}
          >
            All ({insightsList.data?.length || 0})
          </Button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = insightsList.data?.filter((i: any) => i.category === key).length || 0;
            if (count === 0 && activeCategory !== key) return null;
            return (
              <Button
                key={key}
                variant={activeCategory === key ? "default" : "outline"}
                size="sm"
                className="text-xs gap-1"
                onClick={() => setActiveCategory(key)}
              >
                {config.icon} {config.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Insights List */}
        {insightsList.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card/50 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-medium mb-1">No insights yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Generate Insights" to get AI-powered alerts and opportunities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((insight: any) => {
              const cat = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.portfolio;
              const pri = PRIORITY_CONFIG[insight.priority] || PRIORITY_CONFIG.medium;
              const isExpanded = expandedId === insight.id;

              return (
                <Card
                  key={insight.id}
                  className={`transition-all cursor-pointer hover:bg-accent/20 ${
                    insight.status === "new" ? `border-l-2 ${pri.bgColor}` : ""
                  } ${insight.status === "acted" ? "opacity-60" : ""}`}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : insight.id);
                    if (insight.status === "new") {
                      updateStatus.mutate({ id: insight.id, status: "viewed" });
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${cat.color}`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{insight.title}</span>
                          {insight.status === "new" && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400">New</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className={`text-[10px] ${pri.color}`}>{pri.label}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
                          <span>{new Date(insight.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            {insight.description && (
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                            )}
                            {insight.suggestedAction && (
                              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                                <p className="text-xs font-medium text-primary mb-1">Suggested Action</p>
                                <p className="text-sm">{insight.suggestedAction}</p>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="text-xs gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: insight.id, status: "acted" });
                                }}
                              >
                                <CheckCircle className="w-3 h-3" /> Act
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: insight.id, status: "snoozed", snoozeDays: 7 });
                                }}
                              >
                                <Clock className="w-3 h-3" /> Snooze 7d
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1 text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: insight.id, status: "dismissed" });
                                }}
                              >
                                <X className="w-3 h-3" /> Dismiss
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground/40 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
