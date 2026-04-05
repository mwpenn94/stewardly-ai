import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw,
  Loader2, ArrowLeft, Zap, Shield, TrendingUp, Brain, Wifi, WifiOff,
  ChevronRight, BarChart3, History, Bot, Sparkles, Database, Play,
  Timer, Download,
} from "lucide-react";
import { Link } from "wouter";

// ─── Status helpers ────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "degraded": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "unhealthy": return <XCircle className="h-5 w-5 text-red-500" />;
    case "connected": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "error": return <XCircle className="h-5 w-5 text-red-500" />;
    case "pending": return <Clock className="h-5 w-5 text-amber-500" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    healthy: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    connected: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    degraded: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    unhealthy: "bg-red-500/10 text-red-500 border-red-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    unknown: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || variants.unknown} font-medium`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`${variants[severity] || variants.info} text-xs`}>
      {severity}
    </Badge>
  );
}

function timeAgo(date: Date | string | null) {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Main Component ────────────────────────────────────────────────────
export default function IntegrationHealth() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPipelinesRunning, setIsPipelinesRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<any[] | null>(null);
  const dashboard = trpc.integrations.getHealthDashboard.useQuery();
  const improvements = trpc.integrations.getImprovementLog.useQuery();
  const healthContext = trpc.integrations.getIntegrationHealthContext.useQuery();
  const schedulerStatus = trpc.integrations.getSchedulerStatus.useQuery();
  const economicSummary = trpc.integrations.getEconomicDataSummary.useQuery();
  const runChecks = trpc.integrations.runHealthChecks.useMutation();
  const runPipelines = trpc.integrations.runAllPipelines.useMutation();
  const utils = trpc.useUtils();

  const handleRunAllChecks = async () => {
    setIsRunning(true);
    try {
      const result = await runChecks.mutateAsync();
      const healthy = result.results.filter(r => r.status === "healthy").length;
      const total = result.results.length;
      toast.success(`Health checks complete: ${healthy}/${total} healthy`);
      utils.integrations.getHealthDashboard.invalidate();
      utils.integrations.getImprovementLog.invalidate();
      utils.integrations.getIntegrationHealthContext.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to run health checks");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunAllPipelines = async () => {
    setIsPipelinesRunning(true);
    try {
      const results = await runPipelines.mutateAsync();
      setPipelineResults(results);
      const success = results.filter((r: any) => r.status === "success").length;
      const totalRecords = results.reduce((sum: number, r: any) => sum + r.recordsFetched, 0);
      toast.success(`Data pipelines complete: ${success}/${results.length} succeeded, ${totalRecords} records fetched`);
      utils.integrations.getHealthDashboard.invalidate();
      utils.integrations.getEconomicDataSummary.invalidate();
      utils.integrations.getSchedulerStatus.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to run data pipelines");
    } finally {
      setIsPipelinesRunning(false);
    }
  };

  const data = dashboard.data;
  const ctx = healthContext.data;

  return (
    <AppShell title="Integration Health">
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/integrations">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">Integration Health Dashboard</h1>
            </div>
            <Badge variant="outline" className="ml-2 text-xs bg-primary/5 text-primary border-primary/20">
              <Brain className="h-3 w-3 mr-1" />
              AI-Monitored
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Real-time health monitoring for all connected data sources. The AI uses this to know which data it can reference.
            </p>
            <Button
              onClick={handleRunAllChecks}
              disabled={isRunning}
              size="sm"
              className="gap-2"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isRunning ? "Running Checks..." : "Run All Health Checks"}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data?.summary.totalConnections ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Connections</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground font-medium">Active</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-500">{data?.summary.activeConnections ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground font-medium">Health</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-500">{data?.summary.healthyPercent ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground font-medium">Latency</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data?.summary.avgLatencyMs ?? 0}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground font-medium">Checks</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums">{data?.summary.totalChecks ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Runs</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="connections" className="space-y-4">
          <TabsList>
            <TabsTrigger value="connections" className="gap-2">
              <Wifi className="h-4 w-4" /> Connections
            </TabsTrigger>
            <TabsTrigger value="checks" className="gap-2">
              <History className="h-4 w-4" /> Health History
            </TabsTrigger>
            <TabsTrigger value="improvements" className="gap-2">
              <Bot className="h-4 w-4" /> Improvement Agent
            </TabsTrigger>
            <TabsTrigger value="pipelines" className="gap-2">
              <Database className="h-4 w-4" /> Data Pipelines
            </TabsTrigger>
            <TabsTrigger value="ai-context" className="gap-2">
              <Brain className="h-4 w-4" /> AI Awareness
            </TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-4">
            {dashboard.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data?.connections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No connections configured</p>
                  <p className="text-sm text-muted-foreground mt-1">Connect data sources in the Integrations page to start monitoring.</p>
                  <Link href="/integrations">
                    <Button className="mt-4 gap-2">
                      <ChevronRight className="h-4 w-4" /> Go to Integrations
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {data?.connections.map(conn => (
                  <ConnectionCard key={conn.id} connection={conn} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Health History Tab */}
          <TabsContent value="checks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Health Checks</CardTitle>
                <CardDescription>Last 50 health check results across all connections</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.recentChecks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No health checks recorded yet. Run a health check to start monitoring.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data?.recentChecks.map(check => (
                      <div key={check.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <StatusIcon status={check.status} />
                          <div>
                            <p className="text-sm font-medium">{check.providerSlug}</p>
                            <p className="text-xs text-muted-foreground">{check.checkType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {check.latencyMs && (
                            <span className="text-xs text-muted-foreground">{check.latencyMs}ms</span>
                          )}
                          {check.errorMessage && (
                            <span className="text-xs text-red-400 max-w-[200px] truncate">{check.errorMessage}</span>
                          )}
                          <StatusBadge status={check.status} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(check.checkedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Improvement Agent Tab */}
          <TabsContent value="improvements" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Continuous Improvement Agent</CardTitle>
                    <CardDescription>AI-driven monitoring, detection, and recommendations for integration health</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {improvements.data?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No improvement actions yet. The agent will log events as it monitors connections.</p>
                    <p className="text-xs mt-1">Run health checks to activate the improvement agent.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {improvements.data?.map(item => (
                      <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <SeverityBadge severity={item.severity || "info"} />
                              <Badge variant="outline" className="text-xs">{item.actionType.replace(/_/g, " ")}</Badge>
                              {item.resolvedAt && (
                                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Resolved</Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            )}
                            {item.suggestedAction && (
                              <div className="mt-2 p-2 bg-primary/5 rounded text-xs text-primary border border-primary/10">
                                <strong>Suggested:</strong> {item.suggestedAction}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Pipelines Tab */}
          <TabsContent value="pipelines" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">Government Data Pipelines</CardTitle>
                      <CardDescription>Fetch live economic data from BLS, FRED, BEA, and Census Bureau APIs</CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={handleRunAllPipelines}
                    disabled={isPipelinesRunning}
                    size="sm"
                    className="gap-2"
                  >
                    {isPipelinesRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {isPipelinesRunning ? "Fetching Data..." : "Run All Pipelines"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scheduler Status */}
                {schedulerStatus.data && (
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Timer className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">Automated Scheduler</h4>
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Active
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(schedulerStatus.data.jobs || {}).map(([name, job]: [string, any]) => (
                        <div key={name} className="p-3 rounded-lg bg-background border">
                          <p className="text-xs text-muted-foreground font-medium">{name.replace(/_/g, " ")}</p>
                          <p className="text-sm font-medium mt-1">{job.intervalMinutes}m interval</p>
                          <p className="text-xs text-muted-foreground">
                            Runs: {job.runCount} &middot; Last: {job.lastRun ? timeAgo(job.lastRun) : "Never"}
                          </p>
                          {job.lastError && (
                            <p className="text-xs text-red-400 mt-1 truncate">{job.lastError}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pipeline Results */}
                {pipelineResults && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Download className="h-4 w-4" /> Latest Pipeline Results
                    </h4>
                    <div className="grid gap-3">
                      {pipelineResults.map((result: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            {result.status === "success" ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : result.status === "skipped" ? (
                              <Clock className="h-5 w-5 text-amber-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{result.pipeline}</p>
                              <p className="text-xs text-muted-foreground">{result.providerSlug}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium">{result.recordsFetched} records</p>
                              <p className="text-xs text-muted-foreground">{(result.duration / 1000).toFixed(1)}s</p>
                            </div>
                            <StatusBadge status={result.status} />
                            {result.error && (
                              <span className="text-xs text-red-400 max-w-[200px] truncate">{result.error}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium">
                        Total: {pipelineResults.reduce((s: number, r: any) => s + r.recordsFetched, 0)} records fetched
                      </p>
                    </div>
                  </div>
                )}

                {/* Economic Data Preview */}
                {economicSummary.data && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Cached Economic Data (AI Context)
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                        {economicSummary.data || "No economic data cached yet. Run pipelines to fetch data."}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      This data is automatically injected into AI conversations so the assistant can reference real economic indicators.
                    </p>
                  </div>
                )}

                {!pipelineResults && !economicSummary.data && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No pipeline data yet. Click "Run All Pipelines" to fetch live economic data.</p>
                    <p className="text-xs mt-1">The scheduler will automatically run pipelines every hour.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Awareness Tab */}
          <TabsContent value="ai-context" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">AI Self-Awareness Context</CardTitle>
                    <CardDescription>
                      This is what the AI knows about your data integrations. It uses this context to decide which data sources to reference in conversations.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {ctx ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Total Sources</p>
                        <p className="text-lg font-bold">{ctx.totalConnections}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-500/5">
                        <p className="text-xs text-emerald-600">Healthy</p>
                        <p className="text-lg font-bold text-emerald-500">{ctx.healthyCount}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/5">
                        <p className="text-xs text-amber-600">Degraded</p>
                        <p className="text-lg font-bold text-amber-500">{ctx.degradedCount}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/5">
                        <p className="text-xs text-red-600">Unhealthy</p>
                        <p className="text-lg font-bold text-red-500">{ctx.unhealthyCount}</p>
                      </div>
                    </div>

                    {/* Data sources the AI knows about */}
                    <div>
                      <h3 className="text-sm font-medium mb-2">Data Sources in AI Context</h3>
                      <div className="space-y-2">
                        {ctx.dataSources.map(ds => (
                          <div key={ds.slug} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <StatusIcon status={ds.status} />
                              <div>
                                <p className="text-sm font-medium">{ds.name}</p>
                                <p className="text-xs text-muted-foreground">{ds.dataDescription}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {ds.latencyMs && <span className="text-xs text-muted-foreground">{ds.latencyMs}ms</span>}
                              {ds.uptimePercent && <span className="text-xs text-muted-foreground">{ds.uptimePercent}%</span>}
                              <StatusBadge status={ds.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Prompt fragment preview */}
                    <div>
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Prompt Injection Preview
                      </h3>
                      <div className="bg-muted/50 rounded-lg p-4 border">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                          {ctx.promptFragment || "No prompt fragment generated yet. Run health checks to populate."}
                        </pre>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        This context is automatically injected into every AI conversation so the assistant knows which data sources are available.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Loading AI context...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────
function ConnectionCard({ connection }: { connection: any }) {
  const runCheck = trpc.integrations.runSingleHealthCheck.useMutation();
  const utils = trpc.useUtils();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await runCheck.mutateAsync({ connectionId: connection.id });
      toast.success(`${connection.providerName}: ${result.message}`);
      utils.integrations.getHealthDashboard.invalidate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  };

  const health = connection.health;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <StatusIcon status={health?.overallStatus || connection.status} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{connection.providerName}</p>
                <StatusBadge status={health?.overallStatus || connection.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {connection.providerSlug} &middot; {connection.providerCategory} &middot; Connected {timeAgo(connection.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Health metrics */}
            {health && (
              <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium text-foreground">{health.uptimePercent}%</p>
                  <p>Uptime</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{health.avgLatencyMs ?? "—"}ms</p>
                  <p>Avg Latency</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{health.checksTotal}</p>
                  <p>Checks</p>
                </div>
                <div className="text-center">
                  <p className={`font-medium ${health.consecutiveFailures > 0 ? "text-red-500" : "text-foreground"}`}>
                    {health.consecutiveFailures}
                  </p>
                  <p>Failures</p>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
              className="gap-1"
            >
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
              Check
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
