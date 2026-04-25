/**
 * ClientDashboard — Holistic plan scorecard.
 *
 * Wired to financialProfile.get for real profile data.
 * Derives domain scores from profile completeness + links to live tools.
 */
import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Shield, TrendingUp, Heart, FileText,
  DollarSign, Users, Umbrella, GraduationCap, Clock,
  CheckCircle2, ChevronRight, AlertTriangle, ArrowRight,
  MessageSquare, BookOpen, Activity, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";

interface PlanDomain {
  id: string;
  label: string;
  icon: React.ReactNode;
  score: number;
  status: "complete" | "in-progress" | "not-started";
  actions: string[];
  href: string;
}

// DOMAINS is now computed via useMemo inside the component based on real profile data

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function statusBadge(status: PlanDomain["status"]) {
  switch (status) {
    case "complete": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Complete</Badge>;
    case "in-progress": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">In Progress</Badge>;
    case "not-started": return <Badge variant="outline">Not Started</Badge>;
  }
}

/** Compact CRM Sync Health Summary Widget */
function SyncHealthWidget() {
  const [, navigate] = useLocation();
  const summary = trpc.crm.timelineSummary.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const connections = trpc.crm.getConnectionStatus.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });

  const data = summary.data;
  const conns = connections.data || [];
  const activeConns = conns.filter((c: any) => c.status === "active").length;
  const totalConns = conns.length;

  if (summary.isLoading && connections.isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lastSync = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString()
    : "Never";

  return (
    <Card
      className="cursor-pointer hover:bg-muted/30 transition-colors border-l-4 border-l-primary/60"
      onClick={() => navigate("/crm-sync")}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            CRM Sync Health
          </CardTitle>
          <Badge
            variant="outline"
            className={activeConns > 0
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            }
          >
            {activeConns > 0 ? (
              <><Wifi className="w-3 h-3 mr-1" /> {activeConns}/{totalConns} Connected</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> No Connections</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="text-sm font-medium tabular-nums">{lastSync}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Contacts Synced</p>
            <p className="text-sm font-medium tabular-nums">{data?.totalContactsSynced?.toLocaleString() ?? "0"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className={`text-sm font-medium tabular-nums ${
              (data?.successRate ?? 0) >= 90 ? "text-emerald-600" :
              (data?.successRate ?? 0) >= 70 ? "text-amber-600" : "text-red-600"
            }`}>{data?.successRate ?? 0}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Errors</p>
            <p className={`text-sm font-medium tabular-nums ${
              (data?.totalErrors ?? 0) === 0 ? "text-emerald-600" : "text-red-600"
            }`}>{data?.totalErrors ?? 0}</p>
          </div>
        </div>
        {data && Object.keys(data.eventsByProvider).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.eventsByProvider).map(([provider, count]) => (
              <Badge key={provider} variant="secondary" className="text-xs">
                {provider}: {String(count)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const profile = trpc.financialProfile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  // @ts-expect-error — strict mode fix
  const conversations = trpc.conversations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const learningProgress = trpc.learning.mastery.summary.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // G40: Pull-to-refresh for mobile
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      profile.refetch(),
      conversations.refetch(),
      learningProgress.refetch(),
    ]);
  }, [profile, conversations, learningProgress]);
  const { pullRef, isRefreshing, pullProgress, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Derive domain scores from profile data presence
  const DOMAINS = useMemo(() => {
    const p = (profile.data ?? {}) as any;
    const has = (field: string) => p[field] != null && p[field] !== "" && p[field] !== 0;
    return [
      { id: "protection", label: "Protection Planning", icon: <Shield className="w-5 h-5" />, score: has("lifeInsurance") || has("disabilityInsurance") ? 75 : 20, status: has("lifeInsurance") ? "in-progress" as const : "not-started" as const, actions: ["Review life insurance beneficiaries", "Update disability coverage"], href: "/protection-score" },
      { id: "retirement", label: "Retirement Planning", icon: <TrendingUp className="w-5 h-5" />, score: has("retirementSavings") ? 70 : 15, status: has("retirementSavings") ? "in-progress" as const : "not-started" as const, actions: ["Maximize 401k contributions", "Review asset allocation"], href: "/engine/retirement" },
      { id: "tax", label: "Tax Planning", icon: <DollarSign className="w-5 h-5" />, score: has("taxBracket") ? 60 : 10, status: has("taxBracket") ? "in-progress" as const : "not-started" as const, actions: ["Implement tax-loss harvesting", "Review Roth conversion"], href: "/financial-planning" },
      { id: "estate", label: "Estate Planning", icon: <FileText className="w-5 h-5" />, score: has("estateDocuments") ? 50 : 5, status: has("estateDocuments") ? "in-progress" as const : "not-started" as const, actions: ["Create/update will", "Establish power of attorney"], href: "/estate-planning" },
      { id: "insurance", label: "Insurance Review", icon: <Umbrella className="w-5 h-5" />, score: has("homeInsurance") || has("autoInsurance") ? 78 : 20, status: has("homeInsurance") ? "in-progress" as const : "not-started" as const, actions: ["Compare umbrella policy quotes", "Review coverage limits"], href: "/insurance-analysis" },
      { id: "debt", label: "Debt Management", icon: <DollarSign className="w-5 h-5" />, score: has("totalDebt") ? (p.totalDebt < 10000 ? 90 : 50) : 30, status: has("totalDebt") && p.totalDebt < 10000 ? "complete" as const : "in-progress" as const, actions: ["Maintain payoff schedule"], href: "/financial-planning" },
      { id: "education", label: "Education Planning", icon: <GraduationCap className="w-5 h-5" />, score: has("educationFund") ? 55 : 10, status: has("educationFund") ? "in-progress" as const : "not-started" as const, actions: ["Open 529 plan", "Set contribution target"], href: "/learning" },
      { id: "healthcare", label: "Healthcare Planning", icon: <Heart className="w-5 h-5" />, score: has("healthInsurance") ? 65 : 15, status: has("healthInsurance") ? "in-progress" as const : "not-started" as const, actions: ["Review Medicare options", "Evaluate LTC insurance"], href: "/medicare" },
      { id: "legacy", label: "Legacy & Giving", icon: <Users className="w-5 h-5" />, score: has("charitableGiving") ? 40 : 5, status: has("charitableGiving") ? "in-progress" as const : "not-started" as const, actions: ["Define charitable strategy", "Explore donor-advised fund"], href: "/estate-planning" },
    ];
  }, [profile.data]);

  if (authLoading || profile.isLoading) {
    return <AppShell title="Client Dashboard"><SEOHead title="Client Dashboard" description="Your holistic financial plan scorecard" /><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
  }

  if (!user) {
    return (
      <AppShell title="Client Dashboard">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Shield className="w-12 h-12 text-primary" />
          <p className="text-muted-foreground">Sign in to view your financial plan dashboard</p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const overallScore = Math.round(DOMAINS.reduce((s, d) => s + d.score, 0) / DOMAINS.length);
  const completedCount = DOMAINS.filter(d => d.status === "complete").length;
  const totalActions = DOMAINS.reduce((s, d) => s + d.actions.length, 0);

  return (
    <AppShell title="Client Dashboard">
      <div ref={pullRef} className="container max-w-4xl py-8 space-y-6">
        <PullToRefreshIndicator pullDistance={pullDistance} pullProgress={pullProgress} isRefreshing={isRefreshing} />
        <QueryErrorBanner query={profile} label="financial profile" />

        <div className="flex justify-end">
          <ExportDataButton
            data={DOMAINS.map(d => ({
              domain: d.label,
              score: String(d.score),
              status: d.status,
              actions: d.actions.join("; "),
            }))}
            filename="client-dashboard"
            columns={["domain", "score", "status", "actions"]}
            headers={["Domain", "Score", "Status", "Actions"]}
          />
        </div>

        {/* Overall score */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className={`text-4xl font-bold ${scoreColor(overallScore)}`}>{overallScore}</span>
          </div>
          <h1 className="text-2xl font-bold">Your Financial Plan</h1>
          <p className="text-muted-foreground">
            {completedCount} of {DOMAINS.length} domains complete &middot; {totalActions} action items
          </p>
        </div>

        {/* Cross-module activity summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/")}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{conversations.data?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/learning")}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{learningProgress.data?.mastered ?? 0}</p>
                <p className="text-xs text-muted-foreground">Topics Mastered</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/my-work")}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{DOMAINS.filter(d => d.status !== "complete").length}</p>
                <p className="text-xs text-muted-foreground">Active Domains</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CRM Sync Health Summary */}
        <SyncHealthWidget />

        {/* Domain cards */}
        <div className="space-y-3">
          {DOMAINS.map(domain => (
            <Card
              key={domain.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {domain.icon}
                    </div>
                    <div>
                      <p className="font-medium">{domain.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {statusBadge(domain.status)}
                        <span className={`text-sm font-medium ${scoreColor(domain.score)}`}>{domain.score}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); navigate(domain.href); }}>
                      Open <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                    <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${expandedDomain === domain.id ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {/* Progress bar */}
                <Progress value={domain.score} className="h-2 mt-3" />

                {/* Expanded actions */}
                {expandedDomain === domain.id && (
                  <div className="mt-4 space-y-2 pl-13">
                    <p className="text-sm font-medium text-muted-foreground">Action Items:</p>
                    {domain.actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                        {domain.status === "complete" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" /> Implementation Timeline
            </CardTitle>
            <CardDescription>Recommended order of priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DOMAINS
                .filter(d => d.status !== "complete")
                .sort((a, b) => a.score - b.score)
                .map((domain, i) => (
                  <div key={domain.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{domain.label}</p>
                      <p className="text-xs text-muted-foreground">{domain.actions.length} action items</p>
                    </div>
                    <span className={`text-sm font-medium ${scoreColor(domain.score)}`}>{domain.score}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
