/**
 * Sync Dashboard — Real-time CRM sync monitoring, reconciliation controls,
 * run history, and conflict audit trail.
 *
 * Designed for continuous-scale operations. Displays aggregation stats,
 * provides manual reconciliation trigger with configurable limits,
 * and shows historical run data.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import {
  RefreshCw, Activity, Link2, Unlink, AlertTriangle, CheckCircle2,
  Clock, ArrowLeftRight, Database, TrendingUp, Loader2, Play,
  History, ChevronDown, ChevronUp, Zap, Shield, BarChart3,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(ts: string | number | null): string {
  if (!ts) return "Never";
  const d = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary" }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Activity;
  color?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{typeof value === "number" ? formatNumber(value) : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg bg-secondary/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Run History Row ──────────────────────────────────────────────────────

function RunHistoryRow({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", color: "text-emerald-400", icon: CheckCircle2 },
    running: { label: "Running", color: "text-blue-400", icon: Loader2 },
    failed: { label: "Failed", color: "text-destructive", icon: AlertTriangle },
    interrupted: { label: "Interrupted", color: "text-yellow-400", icon: Clock },
  };
  const cfg = statusConfig[run.status] || statusConfig.completed;
  const StatusIcon = cfg.icon;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-4 w-4 ${cfg.color} ${run.status === "running" ? "animate-spin" : ""}`} />
          <div>
            <span className="text-sm font-medium">{run.run_type === "scheduled" ? "Scheduled" : run.run_type === "resume" ? "Resumed" : "Manual"} Run</span>
            <span className="text-xs text-muted-foreground ml-2">
              {run.started_at ? new Date(Number(run.started_at)).toLocaleString() : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatNumber(run.ghl_total || 0)} GHL</span>
            <span>{formatNumber(run.matched || 0)} matched</span>
            <span>{formatDuration(run.duration_ms || 0)}</span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div><span className="text-muted-foreground">GHL Processed:</span> <span className="font-medium">{formatNumber(run.ghl_total || 0)}</span></div>
            <div><span className="text-muted-foreground">Stewardly Total:</span> <span className="font-medium">{formatNumber(run.stewardly_total || 0)}</span></div>
            <div><span className="text-muted-foreground">Matched:</span> <span className="font-medium">{formatNumber(run.matched || 0)}</span></div>
            <div><span className="text-muted-foreground">Created (Stewardly):</span> <span className="font-medium">{formatNumber(run.created_in_stewardly || 0)}</span></div>
            <div><span className="text-muted-foreground">Created (GHL):</span> <span className="font-medium">{formatNumber(run.created_in_ghl || 0)}</span></div>
            <div><span className="text-muted-foreground">Updated (Stewardly):</span> <span className="font-medium">{formatNumber(run.updated_in_stewardly || 0)}</span></div>
            <div><span className="text-muted-foreground">Updated (GHL):</span> <span className="font-medium">{formatNumber(run.updated_in_ghl || 0)}</span></div>
            <div><span className="text-muted-foreground">Conflicts:</span> <span className="font-medium">{run.conflicts_resolved || 0}</span></div>
            <div><span className="text-muted-foreground">Orphans Fixed:</span> <span className="font-medium">{run.orphans_fixed || 0}</span></div>
            <div><span className="text-muted-foreground">Errors:</span> <span className={`font-medium ${(run.errors || 0) > 0 ? "text-destructive" : ""}`}>{run.errors || 0}</span></div>
            <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{formatDuration(run.duration_ms || 0)}</span></div>
            <div><span className="text-muted-foreground">Complete:</span> <span className="font-medium">{run.complete ? "Yes" : "Partial"}</span></div>
          </div>
          {run.triggered_by && (
            <div className="mt-2 text-xs text-muted-foreground">Triggered by: {run.triggered_by}</div>
          )}
          {run.resume_cursor && !run.complete && (
            <div className="mt-2 text-xs text-yellow-400">Resume cursor available — can continue from where this run stopped</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function SyncDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [maxContacts, setMaxContacts] = useState("0");
  const [pushOrphans, setPushOrphans] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);

  const aggQuery = trpc.integrations.getSyncAggregation.useQuery(undefined, {
    refetchInterval: isReconciling ? 5000 : 30000,
  });
  const historyQuery = trpc.integrations.getSyncRunHistory.useQuery(undefined, {
    refetchInterval: isReconciling ? 5000 : 30000,
  });
  const reconcileMutation = trpc.integrations.reconcileGHL.useMutation({
    onSuccess: (data) => {
      setIsReconciling(false);
      aggQuery.refetch();
      historyQuery.refetch();
      toast.success(
        `Reconciliation ${data.complete ? "complete" : "partial"}: ${formatNumber(data.ghlTotal)} GHL contacts processed, ${formatNumber(data.matched)} matched, ${data.errors} errors`,
        { duration: 8000 }
      );
    },
    onError: (err) => {
      setIsReconciling(false);
      toast.error(`Reconciliation failed: ${err.message}`);
    },
  });

  const agg = aggQuery.data;
  const history = historyQuery.data || [];

  const lastRun = useMemo(() => {
    if (!agg?.lastReconcileStats) return null;
    return agg.lastReconcileStats;
  }, [agg?.lastReconcileStats]);

  const handleReconcile = () => {
    setIsReconciling(true);
    const max = parseInt(maxContacts) || 0;
    reconcileMutation.mutate({ maxGHLContacts: max, pushOrphans });
    toast.info(
      max > 0
        ? `Starting reconciliation (max ${formatNumber(max)} GHL contacts)...`
        : "Starting full reconciliation (unlimited)...",
      { duration: 3000 }
    );
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="container max-w-7xl py-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Sync Dashboard" description="CRM synchronization monitoring and reconciliation controls" />
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Sync Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bidirectional CRM synchronization monitoring and reconciliation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Activity className="h-3 w-3" />
              {agg?.lastReconcileAt ? `Last sync: ${timeAgo(agg.lastReconcileAt)}` : "No syncs yet"}
            </Badge>
          </div>
        </div>

        {/* Aggregation Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Stewardly Leads"
            value={agg?.stewardlyTotal ?? 0}
            subtitle="Total active leads"
            icon={Database}
            color="text-primary"
          />
          <StatCard
            title="GHL Linked"
            value={agg?.ghlLinked ?? 0}
            subtitle={`${agg?.linkRate ?? 0}% link rate`}
            icon={Link2}
            color="text-emerald-400"
          />
          <StatCard
            title="Unlinked"
            value={agg?.ghlUnlinked ?? 0}
            subtitle="Missing CRM connection"
            icon={Unlink}
            color={agg?.ghlUnlinked ? "text-yellow-400" : "text-muted-foreground"}
          />
          <StatCard
            title="Link Rate"
            value={`${agg?.linkRate ?? 0}%`}
            subtitle={agg?.linkRate === 100 ? "Full consistency" : "Needs reconciliation"}
            icon={agg?.linkRate === 100 ? Shield : TrendingUp}
            color={agg?.linkRate === 100 ? "text-emerald-400" : "text-primary"}
          />
        </div>

        {/* Last Run Summary */}
        {lastRun && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Last Reconciliation Summary
                </CardTitle>
                <Badge variant={lastRun.complete ? "default" : "secondary"}>
                  {lastRun.complete ? "Complete" : "Partial"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">GHL Processed</p>
                  <p className="font-semibold">{formatNumber(lastRun.ghlTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="font-semibold text-emerald-400">{formatNumber(lastRun.matched)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created (Local)</p>
                  <p className="font-semibold">{formatNumber(lastRun.createdInStewardly)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created (GHL)</p>
                  <p className="font-semibold">{formatNumber(lastRun.createdInGHL)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conflicts</p>
                  <p className={`font-semibold ${lastRun.conflictsResolved > 0 ? "text-yellow-400" : ""}`}>
                    {lastRun.conflictsResolved}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold">{formatDuration(lastRun.duration_ms)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls + Distribution */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Reconciliation Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Run Reconciliation
              </CardTitle>
              <CardDescription>
                Bidirectional sync between Stewardly and GoHighLevel. Cursor-based pagination handles unlimited contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxContacts" className="text-sm">
                  Max GHL Contacts (0 = unlimited)
                </Label>
                <Input
                  id="maxContacts"
                  type="number"
                  min="0"
                  step="1000"
                  value={maxContacts}
                  onChange={(e) => setMaxContacts(e.target.value)}
                  placeholder="0 for unlimited"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Set a limit for testing, or leave at 0 for full sync. Processes in 100-contact pages with cursor-based pagination.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="pushOrphans"
                  checked={pushOrphans}
                  onCheckedChange={setPushOrphans}
                />
                <Label htmlFor="pushOrphans" className="text-sm">
                  Push local orphans to GHL
                </Label>
              </div>

              <Button
                onClick={handleReconcile}
                disabled={isReconciling || reconcileMutation.isPending}
                className="w-full"
                size="lg"
              >
                {isReconciling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Reconciliation
                  </>
                )}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3 w-3" />
                  3-layer dedup: CRM ID → Email → Phone
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Conflict resolution: newer timestamp wins
                </p>
                <p className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" />
                  Scheduled auto-reconciliation runs daily
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Distribution Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Lead Distribution
              </CardTitle>
              <CardDescription>Breakdown by status and source</CardDescription>
            </CardHeader>
            <CardContent>
              {aggQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* By Status */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Status</p>
                    <div className="space-y-1.5">
                      {Object.entries(agg?.byStatus || {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${
                              status === "converted" ? "bg-emerald-400" :
                              status === "new" ? "bg-blue-400" :
                              status === "contacted" ? "bg-yellow-400" :
                              status === "qualified" ? "bg-primary" :
                              status === "disqualified" ? "bg-destructive" :
                              "bg-muted-foreground"
                            }`} />
                            <span className="capitalize">{status}</span>
                          </div>
                          <span className="font-medium tabular-nums">{formatNumber(count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Source (top 8) */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Sources</p>
                    <div className="space-y-1.5">
                      {Object.entries(agg?.bySource || {}).slice(0, 8).map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[180px]">{source}</span>
                          <span className="font-medium tabular-nums">{formatNumber(count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conflict Log */}
        {agg?.recentConflicts && agg.recentConflicts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Recent Conflicts ({agg.recentConflicts.length})
              </CardTitle>
              <CardDescription>Field-level conflicts resolved during the last reconciliation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">Field</th>
                      <th className="text-left py-2 pr-4">Stewardly Value</th>
                      <th className="text-left py-2 pr-4">GHL Value</th>
                      <th className="text-left py-2 pr-4">Resolution</th>
                      <th className="text-left py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.recentConflicts.slice(0, 20).map((c, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 pr-4 font-medium">{c.field}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.stewardlyValue || "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.ghlValue || "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {c.resolution === "stewardly_wins" ? "Stewardly" : c.resolution === "ghl_wins" ? "GHL" : "Merged"}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Run History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Run History
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => historyQuery.refetch()}
                disabled={historyQuery.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${historyQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <CardDescription>Last 50 reconciliation runs with full audit trail</CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No reconciliation runs yet</p>
                <p className="text-xs mt-1">Run your first reconciliation above to see history here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((run: any) => (
                  <RunHistoryRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Webhook Configuration
            </CardTitle>
            <CardDescription>Inbound webhook for real-time GHL event processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Webhook Endpoint</p>
                  <code className="text-xs text-muted-foreground font-mono mt-0.5 block">
                    /api/webhooks/ghl
                  </code>
                </div>
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  Ready
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Supported events: ContactCreate, ContactUpdate, ContactDelete, OpportunityCreate, OpportunityStatusUpdate</p>
                <p>Register this webhook in GHL: Settings → Webhooks → Add Webhook</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
