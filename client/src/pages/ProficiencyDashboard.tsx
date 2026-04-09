import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowLeft, Brain, ChevronRight, Flame, Layers, Lightbulb,
  Sparkles, Target, TrendingUp, Zap, CheckCircle, Circle,
  BarChart3, BookOpen, Shield, Users, Globe, Briefcase, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// ─── Layer Visual Config ──────────────────────────────────────────────────
const LAYER_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  platform: { icon: <Globe className="w-4 h-4" />, color: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30" },
  organization: { icon: <Briefcase className="w-4 h-4" />, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  manager: { icon: <Users className="w-4 h-4" />, color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30" },
  professional: { icon: <Shield className="w-4 h-4" />, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  client: { icon: <Brain className="w-4 h-4" />, color: "text-accent", bgColor: "bg-accent/10", borderColor: "border-accent/30" },
};

const PROFICIENCY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  expert: { bg: "bg-violet-500/20", text: "text-violet-300", label: "Expert" },
  proficient: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Proficient" },
  familiar: { bg: "bg-accent/20", text: "text-accent/80", label: "Familiar" },
  novice: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Novice" },
  undiscovered: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Undiscovered" },
};

const OVERALL_LABELS: Record<string, { label: string; color: string }> = {
  new_user: { label: "New User", color: "text-gray-400" },
  beginner: { label: "Beginner", color: "text-amber-400" },
  intermediate: { label: "Intermediate", color: "text-accent" },
  advanced: { label: "Advanced", color: "text-emerald-400" },
  power_user: { label: "Power User", color: "text-violet-400" },
};

const FEATURE_ROUTES: Record<string, string> = {
  chat: "/chat", voice_mode: "/chat", focus_mode: "/chat",
  suitability: "/suitability", style_profile: "/settings/profile",
  intelligence_hub: "/intelligence-hub", advisory_hub: "/advisory",
  relationships_hub: "/relationships", operations_hub: "/operations",
  documents: "/documents", calculators: "/calculators",
  integrations: "/integrations", ai_settings: "/ai-settings",
  ai_layers: "/ai-settings", knowledge_base: "/admin/knowledge",
  admin_users: "/admin", admin_organizations: "/organizations",
  admin_compliance: "/operations", improvement_engine: "/improvement",
  manager_dashboard: "/manager", portal: "/portal", market_data: "/market-data",
};

/** Read guest session events from localStorage */
function getGuestSessionEvents(): { featureKey: string; eventType: string; count: number; durationMs: number; lastUsed: number }[] {
  try {
    const raw = localStorage.getItem("stewardly_guest_events");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function ProficiencyDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const isGuest = !user || user.authTier === "anonymous";

  // Stabilize guest session events for query input
  const [guestEvents] = useState(() => getGuestSessionEvents());

  const proficiency = trpc.exponentialEngine.getProficiency.useQuery(
    isGuest ? { sessionEvents: guestEvents } : undefined,
    { staleTime: 30_000 },
  );
  const insights = trpc.exponentialEngine.getInsights.useQuery(
    isGuest ? { sessionEvents: guestEvents } : undefined,
    { staleTime: 60_000 },
  );

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  const prof = proficiency.data;
  const ins = insights.data;
  const overallInfo = OVERALL_LABELS[prof?.overallProficiency || "new_user"] || OVERALL_LABELS.new_user;

  return (
    <AppShell title="My Progress">
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 relative">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-heading font-semibold">Proficiency Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {isGuest ? "Guest session — sign in to save progress" : "Your platform mastery across all 5 layers"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {prof && (
              <Badge variant="outline" className={`${overallInfo.color} border-current/30`}>
                <Sparkles className="w-3 h-3 mr-1" />
                {overallInfo.label}
              </Badge>
            )}
            {isGuest && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">
                Guest
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Guest CTA Banner */}
        {isGuest && (
          <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-violet-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <LogIn className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Your progress is session-based</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign in to persist your proficiency data, unlock all 5 layers, and get personalized AI recommendations that improve over time.
                </p>
              </div>
              <Button size="sm" onClick={() => window.location.href = getLoginUrl()} className="shrink-0">
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Row */}
        {proficiency.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : prof && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Target className="w-4 h-4 text-accent" />}
              label="Features Explored"
              value={`${prof.featuresExplored}/${prof.featuresTotal}`}
              sub={`${Math.round((prof.featuresExplored / Math.max(prof.featuresTotal, 1)) * 100)}% coverage`}
            />
            <StatCard
              icon={<Zap className="w-4 h-4 text-amber-400" />}
              label="Total Interactions"
              value={prof.totalInteractions.toLocaleString()}
              sub="across all features"
            />
            <StatCard
              icon={<Flame className="w-4 h-4 text-orange-400" />}
              label="Usage Streak"
              value={`${prof.streak} day${prof.streak !== 1 ? "s" : ""}`}
              sub={isGuest ? "Sign in to track streaks" : prof.streak > 3 ? "Keep it going!" : "Build momentum"}
            />
            <StatCard
              icon={<Layers className="w-4 h-4 text-violet-400" />}
              label="Active Layer"
              value={prof.userLayer.layerLabel}
              sub={isGuest ? "Client layer (guest)" : `${prof.userLayer.accessibleLayers.length} layers accessible`}
            />
          </div>
        )}

        {/* AI Insights Card */}
        {ins && (
          <Card className="border-accent/20 bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" />
                AI Insights
                {isGuest && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    Guest Preview
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm">{ins.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Next Steps */}
              {ins.nextSteps.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recommended Next Steps</h4>
                  <div className="space-y-2">
                    {ins.nextSteps.map((step, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (step.action.includes("Create an account") || step.action.includes("Sign in")) {
                            window.location.href = getLoginUrl();
                          } else {
                            navigate(FEATURE_ROUTES[step.feature] || "/chat");
                          }
                        }}
                        className="w-full flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:border-accent/30 hover:bg-card transition-all text-left group"
                      >
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-accent">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium group-hover:text-accent transition-colors">{step.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.reason}</p>
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                            {step.layer} layer
                          </Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors mt-1 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Growth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ins.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Strengths</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {ins.strengths.map(s => (
                        <Badge key={s} variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {ins.growthAreas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Growth Areas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {ins.growthAreas.map(g => (
                        <Badge key={g} variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" /> {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5-Layer Progress Map */}
        {ins?.layerProgress && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                5-Layer Exploration Map
              </CardTitle>
              <CardDescription>
                {isGuest
                  ? "Guest access is limited to the Client layer — sign in to unlock all 5 layers"
                  : "Your progress across each platform layer"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ins.layerProgress.map(lp => {
                  const layerKey = lp.layer.toLowerCase();
                  const config = LAYER_CONFIG[layerKey] || LAYER_CONFIG.client;
                  const isActive = prof?.userLayer.activeLayer === layerKey;

                  return (
                    <div key={lp.layer} className={`p-3 rounded-lg border ${isActive ? `${config.borderColor} ${config.bgColor}` : "border-border/50 bg-card/30"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}>
                            {config.icon}
                          </div>
                          <div>
                            <span className="text-sm font-medium">{lp.layer}</span>
                            {isActive && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 border-accent/30 text-accent">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground">
                          {lp.explored}/{lp.total}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            lp.percentage >= 80 ? "bg-emerald-500" :
                            lp.percentage >= 50 ? "bg-accent" :
                            lp.percentage >= 20 ? "bg-amber-500" :
                            "bg-gray-500"
                          }`}
                          style={{ width: `${Math.max(lp.percentage, 2)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{lp.percentage}% explored</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feature Grid by Layer */}
        {prof && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Feature Proficiency
              </CardTitle>
              <CardDescription>All features you've explored and their mastery levels</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Explored Features */}
              {prof.exploredFeatures.length > 0 && (
                <div className="space-y-2 mb-4">
                  {prof.exploredFeatures
                    .sort((a, b) => b.score - a.score)
                    .map(f => {
                      const pConfig = PROFICIENCY_COLORS[f.level] || PROFICIENCY_COLORS.undiscovered;
                      const lConfig = LAYER_CONFIG[f.layer] || LAYER_CONFIG.client;
                      return (
                        <div key={f.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                          <div className={`w-6 h-6 rounded ${lConfig.bgColor} flex items-center justify-center ${lConfig.color} shrink-0`}>
                            {lConfig.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{f.label}</span>
                              <Badge className={`${pConfig.bg} ${pConfig.text} text-[10px] px-1.5 py-0 border-0`}>
                                {pConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-1.5 flex-1 bg-secondary/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    f.score >= 80 ? "bg-violet-500" :
                                    f.score >= 55 ? "bg-emerald-500" :
                                    f.score >= 30 ? "bg-accent" :
                                    "bg-amber-500"
                                  }`}
                                  style={{ width: `${f.score}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{f.score}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Undiscovered Features */}
              {prof.undiscoveredFeatures.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Undiscovered ({prof.undiscoveredFeatures.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {prof.undiscoveredFeatures.map(f => {
                      const lConfig = LAYER_CONFIG[f.layer] || LAYER_CONFIG.client;
                      return (
                        <Tooltip key={f.key}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 border border-dashed border-border/50 opacity-60 hover:opacity-100 transition-opacity cursor-help">
                              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{f.label}</span>
                              <Badge variant="outline" className={`ml-auto text-[9px] px-1 py-0 ${lConfig.color} shrink-0`}>
                                {f.layer}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">{f.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {prof?.recentActivity && prof.recentActivity.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {prof.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/30 transition-colors">
                    <span className="text-sm">{a.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.daysAgo === 0 ? "Today" : a.daysAgo === 1 ? "Yesterday" : `${a.daysAgo}d ago`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
    </AppShell>
  );
}

// ─── Stat Card Component ────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-heading font-bold">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 relative">
          <Skeleton className="w-8 h-8 rounded" />
          <div className="flex-1">
            <Skeleton className="w-48 h-5 mb-1" />
            <Skeleton className="w-64 h-3" />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </main>
    </div>
  );
}
