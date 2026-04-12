/**
 * ClientDashboard — Holistic plan scorecard preview.
 *
 * PLACEHOLDER — pass 72 honesty pass.
 *
 * The 9-domain scorecard requires a `holisticPlan` backend (per-domain
 * scoring + action recommendation engine) that doesn't exist yet.
 * For now the DOMAINS array ships as mock data so the design is
 * visible, but a banner at the top clearly labels it as a preview.
 * Users who want live data should use `/protection-score` (fully
 * wired via `financialProtectionScore.*`), the wealth engines
 * (`/engine-dashboard`), or the advisory hub (`/advisory`).
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Shield, TrendingUp, Heart, FileText,
  DollarSign, Users, Umbrella, GraduationCap, Clock,
  CheckCircle2, ChevronRight, AlertTriangle,
} from "lucide-react";
import HonestPlaceholder from "@/components/HonestPlaceholder";
import { Link } from "wouter";

interface PlanDomain {
  id: string;
  label: string;
  icon: React.ReactNode;
  score: number;
  status: "complete" | "in-progress" | "not-started";
  actions: string[];
}

const DOMAINS: PlanDomain[] = [
  { id: "protection", label: "Protection Planning", icon: <Shield className="w-5 h-5" />, score: 85, status: "in-progress", actions: ["Review life insurance beneficiaries", "Update disability coverage"] },
  { id: "retirement", label: "Retirement Planning", icon: <TrendingUp className="w-5 h-5" />, score: 72, status: "in-progress", actions: ["Increase 401k contribution to max", "Open Roth IRA", "Review asset allocation"] },
  { id: "tax", label: "Tax Planning", icon: <DollarSign className="w-5 h-5" />, score: 60, status: "in-progress", actions: ["Implement tax-loss harvesting", "Review Roth conversion opportunity", "Maximize HSA contributions"] },
  { id: "estate", label: "Estate Planning", icon: <FileText className="w-5 h-5" />, score: 40, status: "not-started", actions: ["Create/update will", "Establish power of attorney", "Review beneficiary designations", "Consider trust structure"] },
  { id: "insurance", label: "Insurance Review", icon: <Umbrella className="w-5 h-5" />, score: 78, status: "in-progress", actions: ["Compare umbrella policy quotes", "Review auto/home coverage limits"] },
  { id: "debt", label: "Debt Management", icon: <DollarSign className="w-5 h-5" />, score: 90, status: "complete", actions: ["Maintain current payoff schedule"] },
  { id: "education", label: "Education Planning", icon: <GraduationCap className="w-5 h-5" />, score: 55, status: "not-started", actions: ["Open 529 plan", "Set monthly contribution target", "Review investment options"] },
  { id: "healthcare", label: "Healthcare Planning", icon: <Heart className="w-5 h-5" />, score: 65, status: "in-progress", actions: ["Review Medicare supplement options", "Evaluate long-term care insurance"] },
  { id: "legacy", label: "Legacy & Giving", icon: <Users className="w-5 h-5" />, score: 30, status: "not-started", actions: ["Define charitable giving strategy", "Explore donor-advised fund", "Document family values statement"] },
];

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

export default function ClientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  if (authLoading) {
    return <AppShell title="Client Dashboard"><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
      <SEOHead title="Client Dashboard" description="Client overview and activity dashboard" />
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
      <div className="container max-w-4xl py-8 space-y-6">
        <HonestPlaceholder
          willDo="Show a 9-domain holistic financial plan scorecard with per-domain scores and AI action recommendations."
          needed="Build a `holisticPlan` backend that scores Cash Flow / Debt / Investments / Insurance / Tax / Estate / Retirement / Education / Charitable. The scorecard below is mock data."
          workingAlternative={{ href: "/protection-score", label: "Protection Score (live 12-dimension scorecard)" }}
        />

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
                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${expandedDomain === domain.id ? "rotate-90" : ""}`} />
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
