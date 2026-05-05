/**
 * CascadeAlertsPanel — Real-time cascade alerts, client-facing summary generator,
 * and bulk engagement letter management.
 *
 * Data shapes (from cascadeNotifications.ts):
 *   scanCascadeAlerts → CascadeAlert[] (array, NOT wrapped in { alerts })
 *   generateClientFacingSummary → ClientFacingSummary { clientName, overallHealth, overallScore, sections[], recommendations[], milestones[] }
 *   generateBulkEngagementLetters → BulkEngagementResult { totalClients, generated, failed, skipped, results[] }
 */
import { useState, useMemo } from "react";
import { useWealthEngine } from "@/contexts/WealthEngineContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2, Bell, FileText, Users, AlertTriangle, CheckCircle2,
  ArrowRight, Clock, Shield, TrendingUp, Calculator, Scroll, Rocket
} from "lucide-react";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  sunset: <Clock className="w-4 h-4 text-amber-400" />,
  shield: <Shield className="w-4 h-4 text-blue-400" />,
  calculator: <Calculator className="w-4 h-4 text-emerald-400" />,
  scroll: <Scroll className="w-4 h-4 text-purple-400" />,
  "trending-up": <TrendingUp className="w-4 h-4 text-cyan-400" />,
  rocket: <Rocket className="w-4 h-4 text-primary" />,
};

export default function CascadeAlertsPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("alerts");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const cid = parseInt(clientId) || 0;

  // Only query if authenticated — these are protectedProcedures
  const alertsQ = trpc.planningHierarchy.scanCascadeAlerts.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const summaryQ = trpc.planningHierarchy.generateClientFacingSummary.useQuery(
    { clientId: cid, clientName: clientName || undefined },
    { enabled: !!user && cid > 0 && activeTab === "summary", retry: false }
  );
  const bulkMut = trpc.planningHierarchy.generateBulkEngagementLetters.useMutation({
    onSuccess: (data) => toast.success(`Generated ${data.generated} engagement letters`),
    onError: (e) => toast.error(e.message),
  });

  // Backend returns CascadeAlert[] directly (not { alerts: [...] })
  const dbAlerts = Array.isArray(alertsQ.data) ? alertsQ.data : [];

  // ─── Cascade context from Wealth Engine (live calculator data) ───
  const we = useWealthEngine();
  const localAlerts = useMemo(() => {
    const la: typeof dbAlerts = [];
    if (we.scorecard.pctScore > 0 && we.scorecard.pctScore < 50) {
      la.push({
        id: 'local-low-health', severity: 'warning' as const, category: 'planning_gap' as const,
        title: 'Low Health Score in Active Session',
        description: `Current calculator session shows a health score of ${Math.round(we.scorecard.pctScore)}%. Multiple planning domains need attention.`,
        affectedNodes: we.scorecard.domains.filter(d => d.score < 2).map(d => d.name),
        suggestedAction: 'Review the flagged domains in Client Planning to improve the overall health score.',
        detectedAt: we.lastUpdated,
      });
    }
    if (we.cfResult.emergencyGap > 0) {
      la.push({
        id: 'local-emergency-gap', severity: 'warning' as const, category: 'planning_gap' as const,
        title: 'Emergency Fund Gap Detected',
        description: `Client has a $${Math.round(we.cfResult.emergencyGap).toLocaleString()} emergency fund gap (${we.cfResult.emergencyMonths.toFixed(1)} months vs 6-month target).`,
        affectedNodes: ['cash_flow', 'protection'],
        suggestedAction: 'Recommend building emergency reserves before pursuing growth strategies.',
        detectedAt: we.lastUpdated,
      });
    }
    if (we.prResult.gap > 0) {
      la.push({
        id: 'local-protection-gap', severity: we.prResult.gap > 500000 ? 'critical' as const : 'warning' as const,
        category: 'planning_gap' as const,
        title: 'Protection Gap Identified',
        description: `Client has a $${Math.round(we.prResult.gap).toLocaleString()} life insurance gap based on current needs analysis.`,
        affectedNodes: ['protection', 'estate', 'recommendations'],
        suggestedAction: 'Review protection panel and consider term or permanent life insurance recommendations.',
        detectedAt: we.lastUpdated,
      });
    }
    if (we.rtResult.gap > 0) {
      la.push({
        id: 'local-retirement-gap', severity: we.rtResult.gap > 2000 ? 'critical' as const : 'warning' as const,
        category: 'planning_gap' as const,
        title: 'Retirement Income Gap',
        description: `Client faces a $${Math.round(we.rtResult.gap).toLocaleString()}/mo retirement income gap. Current replacement rate: ${Math.round(we.rtResult.replacementRate)}%.`,
        affectedNodes: ['retirement', 'growth', 'social_security'],
        suggestedAction: 'Increase savings rate or consider IUL/FIA accumulation strategies to close the gap.',
        detectedAt: we.lastUpdated,
      });
    }
    if (we.esResult.estateTax > 0) {
      la.push({
        id: 'local-estate-tax', severity: we.esResult.estateTax > 100000 ? 'critical' as const : 'info' as const,
        category: 'opportunity' as const,
        title: 'Estate Tax Exposure',
        description: `Estimated estate tax of $${Math.round(we.esResult.estateTax).toLocaleString()} at ${(we.esResult.effectiveRate * 100).toFixed(1)}% effective rate.`,
        affectedNodes: ['estate', 'trust_engineering', 'ilit'],
        suggestedAction: 'Consider ILIT, gifting strategies, or trust structures to reduce estate tax exposure.',
        detectedAt: we.lastUpdated,
      });
    }
    if (we.txResult.totalSavings > 5000) {
      la.push({
        id: 'local-tax-opportunity', severity: 'info' as const, category: 'opportunity' as const,
        title: 'Tax Optimization Opportunity',
        description: `Identified $${Math.round(we.txResult.totalSavings).toLocaleString()} in potential annual tax savings across ${we.txResult.strategies.length} strategies.`,
        affectedNodes: ['tax', 'growth', 'retirement'],
        suggestedAction: 'Review Tax Planning panel strategies and implement high-impact items first.',
        detectedAt: we.lastUpdated,
      });
    }
    return la;
  }, [we]);

  const alerts = useMemo(() => {
    const combined = [...dbAlerts, ...localAlerts];
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    combined.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));
    return combined;
  }, [dbAlerts, localAlerts]);

  if (!user) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Cascade Alerts & Client Tools
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time cascade misalignment alerts, client-facing planning summaries,
            and bulk engagement letter generation.
          </p>
        </div>
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-8 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Sign in to access Cascade Alerts</p>
            <p className="text-xs text-muted-foreground mt-1">
              This feature requires authentication to scan your client data for misalignments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Cascade Alerts & Client Tools
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time cascade misalignment alerts, client-facing planning summaries,
          and bulk engagement letter generation.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="alerts" className="gap-1 text-xs"><Bell className="w-3 h-3" /> Cascade Alerts</TabsTrigger>
          <TabsTrigger value="summary" className="gap-1 text-xs"><FileText className="w-3 h-3" /> Client Summary</TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1 text-xs"><Users className="w-3 h-3" /> Bulk Letters</TabsTrigger>
        </TabsList>

        {/* ── CASCADE ALERTS TAB ── */}
        <TabsContent value="alerts" className="space-y-4">
          {alertsQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Scanning for alerts...</div>
          ) : alertsQ.isError ? (
            <Card className="bg-card/60 border-red-500/20">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">Failed to load alerts</p>
                <p className="text-xs text-muted-foreground mt-1">{alertsQ.error?.message}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => alertsQ.refetch()}>Retry</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <Card className="bg-card/60 border-red-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-400">{alerts.filter(a => a.severity === "critical").length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-amber-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Warning</p>
                    <p className="text-2xl font-bold text-amber-400">{alerts.filter(a => a.severity === "warning").length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-blue-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Info</p>
                    <p className="text-2xl font-bold text-blue-400">{alerts.filter(a => a.severity === "info").length}</p>
                  </CardContent>
                </Card>
              </div>

              {localAlerts.length > 0 && (
                <Card className="bg-card/60 border-primary/15">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-primary font-medium mb-1">Live Session Alerts ({localAlerts.length})</p>
                    <p className="text-[9px] text-muted-foreground">These alerts are generated from the active calculator session data and update in real-time as you modify client inputs.</p>
                  </CardContent>
                </Card>
              )}

              {alerts.length === 0 ? (
                <Card className="bg-card/60 border-emerald-500/20">
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-emerald-400">All Clear</p>
                    <p className="text-[11px] text-muted-foreground">No cascade misalignments detected across your client base.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <Card key={alert.id || i} className={`bg-card/60 ${alert.severity === "critical" ? "border-red-500/30" : alert.severity === "warning" ? "border-amber-500/20" : "border-blue-500/10"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-red-400" : alert.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="outline" className={`text-[8px] ${alert.severity === "critical" ? "border-red-400 text-red-400" : alert.severity === "warning" ? "border-amber-400 text-amber-400" : "border-blue-400 text-blue-400"}`}>
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[8px] border-muted-foreground/30">
                                {alert.category?.replace(/_/g, " ") || "alert"}
                              </Badge>
                              <span className="text-xs font-medium">{alert.title}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                <Clock className="w-3 h-3 inline mr-0.5" />
                                {new Date(alert.detectedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[11px]">{alert.description}</p>
                            <p className="text-[10px] text-primary mt-1">Suggested: {alert.suggestedAction}</p>
                            {alert.clientName && (
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                Client: {alert.clientName}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── CLIENT SUMMARY TAB ── */}
        <TabsContent value="summary" className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Client ID"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-32 h-8 text-xs"
            />
            <Input
              placeholder="Client Name (optional)"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="w-48 h-8 text-xs"
            />
          </div>

          {summaryQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Generating summary...</div>
          ) : summaryQ.isError ? (
            <Card className="bg-card/60 border-red-500/20">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">Failed to generate summary</p>
                <p className="text-xs text-muted-foreground mt-1">{summaryQ.error?.message}</p>
              </CardContent>
            </Card>
          ) : summaryQ.data ? (
            <Card className="bg-card/60 border-primary/15">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Client-Facing Planning Summary
                  <Badge variant={
                    summaryQ.data.overallHealth === "excellent" ? "default" :
                    summaryQ.data.overallHealth === "good" ? "default" :
                    "outline"
                  } className={`text-[9px] ${
                    summaryQ.data.overallHealth === "excellent" ? "bg-emerald-500/20 text-emerald-400" :
                    summaryQ.data.overallHealth === "good" ? "bg-blue-500/20 text-blue-400" :
                    summaryQ.data.overallHealth === "needs_attention" ? "bg-amber-500/20 text-amber-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {summaryQ.data.overallHealth?.replace(/_/g, " ")}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Simplified view for {summaryQ.data.clientName || "client"} — strips advisor-only details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Health Snapshot */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Plan Health</p>
                    <p className={`text-lg font-bold ${(summaryQ.data.overallScore ?? 0) >= 80 ? "text-emerald-400" : (summaryQ.data.overallScore ?? 0) >= 60 ? "text-blue-400" : "text-amber-400"}`}>
                      {summaryQ.data.overallScore ?? 0}/100
                    </p>
                  </div>
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Planning Areas</p>
                    <p className="text-lg font-bold">{summaryQ.data.sections?.length ?? 0}</p>
                  </div>
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Milestones</p>
                    <p className="text-lg font-bold">{summaryQ.data.milestones?.length ?? 0}</p>
                  </div>
                </div>

                {/* Sections */}
                {summaryQ.data.sections && summaryQ.data.sections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Planning Areas</p>
                    <div className="space-y-2">
                      {summaryQ.data.sections.map((sec, i) => (
                        <div key={i} className="rounded bg-background/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium flex items-center gap-1.5">
                              {SECTION_ICONS[sec.icon] || <FileText className="w-4 h-4 text-muted-foreground" />}
                              {sec.title}
                            </span>
                            <Badge variant={sec.status === "on_track" ? "default" : "outline"} className={`text-[9px] ${
                              sec.status === "on_track" ? "bg-emerald-500/20 text-emerald-400" :
                              sec.status === "needs_review" ? "bg-amber-500/20 text-amber-400" :
                              sec.status === "action_needed" ? "bg-red-500/20 text-red-400" :
                              ""
                            }`}>
                              {sec.status?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-1.5">{sec.summary}</p>
                          <div className="w-full h-1.5 rounded-full bg-background/50 overflow-hidden">
                            <div className={`h-full rounded-full ${sec.progress >= 70 ? "bg-emerald-500" : sec.progress >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(sec.progress, 100)}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-1">{sec.progress}% complete</p>
                          {sec.nextSteps && sec.nextSteps.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {sec.nextSteps.map((step, j) => (
                                <div key={j} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                  <ArrowRight className="w-2.5 h-2.5 text-primary mt-0.5 shrink-0" />
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {sec.keyMetrics && sec.keyMetrics.length > 0 && (
                            <div className="flex gap-3 mt-1.5">
                              {sec.keyMetrics.map((m, j) => (
                                <span key={j} className="text-[9px]">
                                  <span className="text-muted-foreground">{m.label}:</span>{" "}
                                  <span className="font-medium">{m.value}</span>
                                  {m.trend === "up" && " ↑"}
                                  {m.trend === "down" && " ↓"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {summaryQ.data.recommendations && summaryQ.data.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Recommended Next Steps</p>
                    <div className="space-y-2">
                      {summaryQ.data.recommendations.map((r, i) => (
                        <div key={i} className="rounded bg-background/50 p-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className={`text-[8px] ${
                              r.priority === "high" ? "border-red-400 text-red-400" :
                              r.priority === "medium" ? "border-amber-400 text-amber-400" :
                              "border-blue-400 text-blue-400"
                            }`}>{r.priority}</Badge>
                            <span className="text-[11px] font-medium">{r.title}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{r.description}</p>
                          <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                            <span>Impact: {r.estimatedImpact}</span>
                            <span>Timeline: {r.timeframe}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {summaryQ.data.milestones && summaryQ.data.milestones.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Milestones</p>
                    <div className="space-y-1">
                      {summaryQ.data.milestones.map((m, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-background/50 p-2 text-[11px]">
                          <span>{m.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground">{m.targetDate}</span>
                            <Badge variant={m.status === "completed" ? "default" : "outline"} className="text-[8px]">
                              {m.status?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : cid > 0 ? null : (
            <Card className="bg-card/60 border-accent/10">
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Enter a Client ID to generate their planning summary.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── BULK ENGAGEMENT LETTERS TAB ── */}
        <TabsContent value="bulk" className="space-y-4">
          <Card className="bg-card/60 border-accent/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bulk Engagement Letter Generation</CardTitle>
              <CardDescription className="text-[11px]">
                Generate, review, and send engagement letters for multiple clients during annual renewal periods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => bulkMut.mutate({ renewalOnly: true })}
                  disabled={bulkMut.isPending}
                  className="gap-1"
                >
                  {bulkMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                  Generate Renewal Letters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkMut.mutate({})}
                  disabled={bulkMut.isPending}
                  className="gap-1"
                >
                  Generate All Letters
                </Button>
              </div>

              {bulkMut.data && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Total Clients</p>
                      <p className="text-lg font-bold">{bulkMut.data.totalClients}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Generated</p>
                      <p className="text-lg font-bold text-emerald-400">{bulkMut.data.generated}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Skipped</p>
                      <p className="text-lg font-bold text-amber-400">{bulkMut.data.skipped}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Failed</p>
                      <p className="text-lg font-bold text-red-400">{bulkMut.data.failed}</p>
                    </div>
                  </div>
                  {bulkMut.data.results && bulkMut.data.results.length > 0 && (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {bulkMut.data.results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-background/50 p-2 text-[11px]">
                          <span>{r.clientName || `Client #${r.clientId}`}</span>
                          <div className="flex items-center gap-2">
                            {r.reason && <span className="text-[9px] text-muted-foreground">{r.reason}</span>}
                            <Badge variant={r.status === "generated" ? "default" : "outline"} className={`text-[9px] ${
                              r.status === "generated" ? "bg-emerald-500/20 text-emerald-400" :
                              r.status === "skipped" ? "bg-amber-500/20 text-amber-400" :
                              "bg-red-500/20 text-red-400"
                            }`}>
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
