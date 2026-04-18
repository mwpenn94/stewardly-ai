/**
 * CascadeAlertsPanel — Real-time cascade alerts, client-facing summary generator,
 * and bulk engagement letter management.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Bell, FileText, Users, AlertTriangle, CheckCircle2, ArrowRight, Zap, Shield, Clock } from "lucide-react";

export default function CascadeAlertsPanel() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const cid = parseInt(clientId) || 0;

  const alertsQ = trpc.planningHierarchy.scanCascadeAlerts.useQuery();
  const summaryQ = trpc.planningHierarchy.generateClientFacingSummary.useQuery(
    { clientId: cid, clientName: clientName || undefined },
    { enabled: cid > 0 && activeTab === "summary" }
  );
  const bulkMut = trpc.planningHierarchy.generateBulkEngagementLetters.useMutation({
    onSuccess: (data) => toast.success(`Generated ${data.generated} engagement letters`),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" /> Cascade Alerts & Client Tools
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
          ) : alertsQ.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <Card className="bg-card/60 border-red-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-400">{alertsQ.data.alerts.filter(a => a.severity === "critical").length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-amber-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Warning</p>
                    <p className="text-2xl font-bold text-amber-400">{alertsQ.data.alerts.filter(a => a.severity === "warning").length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-blue-500/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Info</p>
                    <p className="text-2xl font-bold text-blue-400">{alertsQ.data.alerts.filter(a => a.severity === "info").length}</p>
                  </CardContent>
                </Card>
              </div>

              {alertsQ.data.alerts.length === 0 ? (
                <Card className="bg-card/60 border-emerald-500/20">
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-emerald-400">All Clear</p>
                    <p className="text-[11px] text-muted-foreground">No cascade misalignments detected.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {alertsQ.data.alerts.map((alert, i) => (
                    <Card key={i} className={`bg-card/60 ${alert.severity === "critical" ? "border-red-500/30" : alert.severity === "warning" ? "border-amber-500/20" : "border-blue-500/10"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-red-400" : alert.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[8px] ${alert.severity === "critical" ? "border-red-400 text-red-400" : alert.severity === "warning" ? "border-amber-400 text-amber-400" : "border-blue-400 text-blue-400"}`}>
                                {alert.severity}
                              </Badge>
                              <span className="text-xs font-medium">{alert.type.replace(/_/g, " ")}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                <Clock className="w-3 h-3 inline mr-0.5" />
                                {new Date(alert.detectedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[11px]">{alert.description}</p>
                            <p className="text-[10px] text-accent mt-1">Suggested: {alert.suggestedAction}</p>
                            {alert.affectedClients.length > 0 && (
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                Affected clients: {alert.affectedClients.join(", ")}
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
          ) : null}
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
          ) : summaryQ.data ? (
            <Card className="bg-card/60 border-accent/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Client-Facing Planning Summary</CardTitle>
                <CardDescription className="text-[11px]">
                  Simplified view suitable for sharing with the client — strips advisor-only details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Goals Section */}
                <div>
                  <p className="text-xs font-medium mb-2">Your Financial Goals</p>
                  <div className="space-y-2">
                    {summaryQ.data.goals.map((g, i) => (
                      <div key={i} className="rounded bg-background/50 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium">{g.name}</span>
                          <Badge variant={g.status === "on_track" ? "default" : "outline"} className="text-[9px]">
                            {g.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-background/50 overflow-hidden">
                          <div className={`h-full rounded-full ${g.progress >= 70 ? "bg-emerald-500" : g.progress >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(g.progress, 100)}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">{g.progress.toFixed(0)}% toward your goal</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <p className="text-xs font-medium mb-2">Recommended Next Steps</p>
                  <div className="space-y-1">
                    {summaryQ.data.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px]">
                        <ArrowRight className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health Snapshot */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Plan Health</p>
                    <p className={`text-lg font-bold ${summaryQ.data.healthScore >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                      {summaryQ.data.healthScore}/100
                    </p>
                  </div>
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Active Goals</p>
                    <p className="text-lg font-bold">{summaryQ.data.goals.length}</p>
                  </div>
                  <div className="rounded bg-background/50 p-2">
                    <p className="text-[10px] text-muted-foreground">Next Review</p>
                    <p className="text-sm font-bold">{summaryQ.data.nextReviewDate || "TBD"}</p>
                  </div>
                </div>
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
                  {bulkMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Generated</p>
                      <p className="text-lg font-bold text-emerald-400">{bulkMut.data.generated}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Skipped</p>
                      <p className="text-lg font-bold text-amber-400">{bulkMut.data.skipped}</p>
                    </div>
                    <div className="rounded bg-background/50 p-2">
                      <p className="text-[10px] text-muted-foreground">Errors</p>
                      <p className="text-lg font-bold text-red-400">{bulkMut.data.errors}</p>
                    </div>
                  </div>
                  {bulkMut.data.letters.length > 0 && (
                    <div className="space-y-1">
                      {bulkMut.data.letters.map((l, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-background/50 p-2 text-[11px]">
                          <span>Client #{l.clientId}</span>
                          <Badge variant={l.status === "generated" ? "default" : "outline"} className="text-[9px]">
                            {l.status}
                          </Badge>
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
