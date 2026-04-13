import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity, Gauge, Brain, TrendingUp, DollarSign, ArrowLeft,
  Play, CheckCircle2, XCircle, Clock, AlertTriangle, Zap,
  BarChart3, Database, Globe, RefreshCw, Shield, Target,
} from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

export default function AdminIntelligenceDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("rate-management");

  if (user?.role !== "admin") {
    return (
      <div className="container py-12 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground">This dashboard is restricted to administrators.</p>
      </div>
    );
  }

  return (
    <AppShell title="Intelligence Dashboard">
      <SEOHead title="Intelligence Dashboard" description="AI model performance and intelligence metrics" />
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="hidden lg:flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" aria-label="Back to admin"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            AI-driven rate management, extraction planning, and data value optimization
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsOverview />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="rate-management" className="text-xs gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Rate Management
          </TabsTrigger>
          <TabsTrigger value="extraction-plans" className="text-xs gap-1.5">
            <Database className="h-3.5 w-3.5" /> Extraction Plans
          </TabsTrigger>
          <TabsTrigger value="data-value" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Data Value
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="text-xs gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Integration Onboarding
          </TabsTrigger>
          <TabsTrigger value="sofr" className="text-xs gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> SOFR / PF Rates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rate-management"><RateManagementTab /></TabsContent>
        <TabsContent value="extraction-plans"><ExtractionPlansTab /></TabsContent>
        <TabsContent value="data-value"><DataValueTab /></TabsContent>
        <TabsContent value="onboarding"><OnboardingTab /></TabsContent>
        <TabsContent value="sofr"><SOFRTab /></TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}

// ─── Stats Overview ─────────────────────────────────────────────────────

function StatsOverview() {
  const stats = trpc.adminIntelligence.getStats.useQuery(undefined, {
    retry: false,
    refetchInterval: 30000,
  });

  const data = stats.data || { totalProbes: 0, pendingRecommendations: 0, activePlans: 0, highValueRecords: 0 };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Activity className="h-4 w-4 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data.totalProbes}</p>
              <p className="text-xs text-muted-foreground">Rate Probes</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-4 w-4 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data.pendingRecommendations}</p>
              <p className="text-xs text-muted-foreground">Pending Reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><Zap className="h-4 w-4 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data.activePlans}</p>
              <p className="text-xs text-muted-foreground">Active Plans</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Target className="h-4 w-4 text-purple-500" /></div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data.highValueRecords}</p>
              <p className="text-xs text-muted-foreground">High-Value Records</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 1: Rate Management ─────────────────────────────────────────────

function RateManagementTab() {
  const profiles = trpc.adminIntelligence.getRateProfiles.useQuery(undefined, { retry: false });
  const recommendations = trpc.adminIntelligence.getRecommendations.useQuery(undefined, { retry: false });
  const applyRec = trpc.adminIntelligence.applyRecommendation.useMutation({
    onSuccess: () => {
      toast.success("Recommendation applied");
      recommendations.refetch();
      profiles.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const dismissRec = trpc.adminIntelligence.dismissRecommendation.useMutation({
    onSuccess: () => {
      toast.success("Recommendation dismissed");
      recommendations.refetch();
    },
  });

  return (
    <div className="space-y-6">
      {/* Pending Recommendations */}
      {(recommendations.data || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Pending Rate Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(recommendations.data || []).map((rec: any) => {
                const recData = rec.recommendationJson || {};
                return (
                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{rec.provider}</p>
                      <p className="text-xs text-muted-foreground">{recData.reason || "Rate adjustment suggested"}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{recData.currentRpm || "?"} RPM</Badge>
                        <span>→</span>
                        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">{recData.suggestedRpm || "?"} RPM</Badge>
                        <Badge variant="outline">Confidence: {rec.confidence || "N/A"}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => applyRec.mutate({ id: rec.id })} disabled={applyRec.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Apply
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => dismissRec.mutate({ id: rec.id })}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" /> Active Rate Profiles
          </CardTitle>
          <CardDescription>Current rate limits and usage for all providers</CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading profiles...</div>
          ) : (profiles.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No rate profiles configured yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Current RPM</th>
                    <th className="pb-2 font-medium">Max RPM</th>
                    <th className="pb-2 font-medium">Daily Budget</th>
                    <th className="pb-2 font-medium">Daily Used</th>
                    <th className="pb-2 font-medium">Success Rate</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(profiles.data || []).map((p: any) => {
                    const usagePct = p.dailyBudget > 0 ? ((p.dailyUsed || 0) / p.dailyBudget * 100) : 0;
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.provider}</td>
                        <td className="py-2">{p.currentRpm}</td>
                        <td className="py-2">{p.staticMaximum}</td>
                        <td className="py-2">{p.dailyBudget?.toLocaleString()}</td>
                        <td className="py-2">
                          <span className={usagePct > 80 ? "text-red-500" : ""}>{(p.dailyUsed || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground ml-1 text-xs">({usagePct.toFixed(0)}%)</span>
                        </td>
                        <td className="py-2">{p.successRate || "100.00"}%</td>
                        <td className="py-2">
                          <Badge variant="outline" className={
                            p.isGovernment ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
                          }>
                            {p.isGovernment ? "Gov" : "Active"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 2: Extraction Plans ────────────────────────────────────────────

function ExtractionPlansTab() {
  const plans = trpc.adminIntelligence.getExtractionPlans.useQuery(undefined, { retry: false });

  const statusIcon = (status: string) => {
    switch (status) {
      case "running": return <Play className="h-3.5 w-3.5 text-blue-500" />;
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "paused": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Extraction Plans
          </CardTitle>
          <CardDescription>AI-generated data extraction strategies and their execution status</CardDescription>
        </CardHeader>
        <CardContent>
          {plans.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading plans...</div>
          ) : (plans.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No extraction plans created yet. Plans are auto-generated when new integrations are onboarded.
            </div>
          ) : (
            <div className="space-y-3">
              {(plans.data || []).map((plan: any) => (
                <div key={plan.id} className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusIcon(plan.status)}
                      <span className="font-medium text-sm">{plan.planName}</span>
                      <Badge variant="outline" className="text-xs">{plan.planType}</Badge>
                    </div>
                    <Badge className={
                      plan.status === "completed" ? "bg-green-500/10 text-green-500" :
                      plan.status === "running" ? "bg-blue-500/10 text-blue-500" :
                      plan.status === "failed" ? "bg-red-500/10 text-red-500" :
                      "bg-muted text-muted-foreground"
                    }>{plan.status}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Records: {plan.recordsCompleted || 0}/{plan.totalRecords || 0}</span>
                    <span>Duration: {plan.estimatedDurationHours || "?"}h</span>
                    {plan.recordsFailed > 0 && <span className="text-red-500">Failed: {plan.recordsFailed}</span>}
                  </div>
                  {plan.totalRecords > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5 transition-all"
                        style={{ width: `${Math.min(100, ((plan.recordsCompleted || 0) / plan.totalRecords) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 3: Data Value Scoring ──────────────────────────────────────────

function DataValueTab() {
  const queue = trpc.adminIntelligence.getRefreshQueue.useQuery(undefined, { retry: false });

  const priorityColor = (p: string) => {
    switch (p) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "normal": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Data Refresh Priority Queue
          </CardTitle>
          <CardDescription>
            Records ranked by usage frequency, user breadth, staleness, and feature dependency
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading queue...</div>
          ) : (queue.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No high-priority records in the refresh queue. Data value scores are computed automatically as data is accessed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Record</th>
                    <th className="pb-2 font-medium">Score</th>
                    <th className="pb-2 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {(queue.data || []).map((item: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{item.provider}</td>
                      <td className="py-2 text-muted-foreground">{item.recordId}</td>
                      <td className="py-2">{item.score || "0"}</td>
                      <td className="py-2">
                        <Badge className={priorityColor(item.refreshPriority || "normal")}>
                          {item.refreshPriority || "normal"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 4: Integration Onboarding ──────────────────────────────────────

function OnboardingTab() {
  const [provider, setProvider] = useState("");
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("government");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = trpc.adminIntelligence.analyzeIntegration.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      setAnalyzing(false);
      toast.success("Analysis complete");
    },
    onError: (e: any) => {
      setAnalyzing(false);
      toast.error(e.message);
    },
  });

  const handleAnalyze = () => {
    if (!provider || !domain) {
      toast.error("Provider name and domain are required");
      return;
    }
    setAnalyzing(true);
    analyze.mutate({ provider, domain, category });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" /> AI Integration Onboarding
          </CardTitle>
          <CardDescription>
            Analyze a new API provider to get optimal configuration recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Provider Name</Label>
              <Input placeholder="e.g., Census Bureau" value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input placeholder="e.g., api.census.gov" value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="financial">Financial Data</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="enrichment">Enrichment</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            {analyzing ? "Analyzing..." : "Analyze Integration"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Results: {result.provider}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Suggested RPM</p>
                <p className="text-lg font-bold">{result.suggestedRpm}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Daily Budget</p>
                <p className="text-lg font-bold">{result.suggestedDailyBudget?.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Value Score</p>
                <p className="text-lg font-bold">{result.estimatedValueScore}/100</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Risk Level</p>
                <Badge className={
                  result.riskLevel === "low" ? "bg-green-500/10 text-green-500" :
                  result.riskLevel === "high" ? "bg-red-500/10 text-red-500" :
                  "bg-amber-500/10 text-amber-500"
                }>{result.riskLevel}</Badge>
              </div>
            </div>

            <div>
              <p className="font-medium text-sm mb-2">Recommendations</p>
              <ul className="space-y-1">
                {(result.recommendations || []).map((r: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {(result.complianceNotes || []).length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">Compliance Notes</p>
                <ul className="space-y-1">
                  {result.complianceNotes.map((n: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Shield className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 5: SOFR / Premium Finance ──────────────────────────────────────

function SOFRTab() {
  const sofrData = trpc.adminIntelligence.getSOFRRates.useQuery(undefined, { retry: false });
  const pfRates = trpc.adminIntelligence.getPremiumFinanceRates.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      {/* Current SOFR Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> SOFR Rate History
          </CardTitle>
          <CardDescription>Secured Overnight Financing Rate — sourced from FRED</CardDescription>
        </CardHeader>
        <CardContent>
          {sofrData.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading SOFR data...</div>
          ) : (
            <div className="space-y-4">
              {(sofrData.data || []).length > 0 && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold font-mono tabular-nums">{(sofrData.data as any)?.[0]?.rate || "N/A"}%</p>
                    <p className="text-sm text-muted-foreground">
                      Current SOFR as of {(sofrData.data as any)?.[0]?.date || "N/A"}
                    </p>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Rate</th>
                      <th className="pb-2 font-medium">25th Pctl</th>
                      <th className="pb-2 font-medium">75th Pctl</th>
                      <th className="pb-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sofrData.data || []).map((r: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5">{r.date}</td>
                        <td className="py-1.5 font-medium">{r.rate}%</td>
                        <td className="py-1.5">{r.percentile25}%</td>
                        <td className="py-1.5">{r.percentile75}%</td>
                        <td className="py-1.5">
                          <Badge variant="outline" className="text-xs">{r.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Premium Finance Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Premium Finance Rates
          </CardTitle>
          <CardDescription>Current premium financing rates based on SOFR + provider spread</CardDescription>
        </CardHeader>
        <CardContent>
          {pfRates.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading rates...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(pfRates.data || []).map((rate: any, i: number) => (
                <div key={i} className="p-4 rounded-lg border bg-card space-y-2">
                  <p className="font-medium">{rate.provider}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Base (SOFR)</p>
                      <p className="font-medium">{rate.baseRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spread</p>
                      <p className="font-medium">+{rate.spread}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Effective Rate</p>
                      <p className="font-bold text-primary">{rate.effectiveRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max LTV</p>
                      <p className="font-medium">{(rate.maxLtv * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Min Loan: ${rate.minLoan?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
