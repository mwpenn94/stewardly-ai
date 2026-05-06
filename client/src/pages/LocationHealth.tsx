import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Database, Heart,
  Loader2, MapPin, RefreshCw, Server, Shield, Signal, TrendingDown,
  TrendingUp, Wifi, WifiOff, XCircle, Zap, BarChart3, Timer,
} from "lucide-react";

// ─── Health Status Badge ──────────────────────────────────────────────
function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2; label: string }> = {
    healthy: { variant: "default", icon: CheckCircle2, label: "Healthy" },
    warning: { variant: "secondary", icon: AlertTriangle, label: "Warning" },
    critical: { variant: "destructive", icon: XCircle, label: "Critical" },
    unknown: { variant: "outline", icon: Clock, label: "Unknown" },
  };
  const c = config[status] || config.unknown;
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

// ─── Sync Lag Display ─────────────────────────────────────────────────
function SyncLagDisplay({ minutes }: { minutes: number | null }) {
  if (minutes === null) return <span className="text-muted-foreground text-sm">Never synced</span>;
  const color = minutes <= 10 ? "text-emerald-500" : minutes <= 30 ? "text-amber-500" : minutes <= 60 ? "text-orange-500" : "text-red-500";
  const label = minutes < 1 ? "< 1 min ago" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`;
  return <span className={`font-mono text-sm font-medium ${color}`}>{label}</span>;
}

// ─── Polling Status Card ──────────────────────────────────────────────
function PollingStatusCard() {
  const pollingStatus = trpc.integrations.getPollingStatus.useQuery(undefined, { refetchInterval: 30000 });
  const triggerPoll = trpc.integrations.triggerPollCycle.useMutation({
    onSuccess: (result) => {
      // @ts-expect-error — property access on loosely typed object
      toast.success(`Poll cycle complete: ${result.locationsPolled} location(s), ${result.contactsFound} contact(s), ${result.changesDetected} change(s)`);
      pollingStatus.refetch();
    },
    onError: (err) => toast.error(`Poll failed: ${err.message}`),
  });
  const setConfig = trpc.integrations.setPollingConfig.useMutation({
    onSuccess: () => { pollingStatus.refetch(); toast.success("Polling config updated"); },
  });

  const ps = pollingStatus.data;
  if (!ps) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Signal className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">GHL Polling Service</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch
                checked={ps.isActive}
                onCheckedChange={(active) => setConfig.mutate({ active })}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => triggerPoll.mutate()}
              disabled={triggerPoll.isPending}
            >
              {triggerPoll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Poll Now
            </Button>
          </div>
        </div>
        <CardDescription>
          Polls GHL API every {Math.round(ps.intervalMs / 60000)} minutes for contact/opportunity changes as a webhook fallback
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="flex items-center gap-1.5">
              {ps.isActive ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium text-sm">{ps.isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Cycles</p>
            <p className="font-mono font-medium text-sm">{(ps as any).totalCycles}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Changes</p>
            <p className="font-mono font-medium text-sm">{(ps as any).totalChangesDetected}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Locations Monitored</p>
            <p className="font-mono font-medium text-sm">{ps.locationsMonitored}</p>
          </div>
        </div>

        {ps.lastCycleResult && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Last Cycle Result</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={(ps.lastCycleResult as any).status === "success" ? "default" : "destructive"} className="text-xs">
                    {(ps.lastCycleResult as any).status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Locations: </span>
                  <span className="font-mono">{(ps.lastCycleResult as any).locationsPolled}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contacts: </span>
                  <span className="font-mono">{(ps.lastCycleResult as any).contactsFound}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Changes: </span>
                  <span className="font-mono font-medium text-emerald-600">{(ps.lastCycleResult as any).changesDetected}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration: </span>
                  <span className="font-mono">{(ps.lastCycleResult as any).durationMs}ms</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function LocationHealth() {
  const [historyDays, setHistoryDays] = useState(7);

  const healthQuery = trpc.integrations.getLocationHealth.useQuery(undefined, { refetchInterval: 30000 });
  const historyQuery = trpc.integrations.getHealthHistory.useQuery({ days: historyDays }, { refetchInterval: 60000 });
  const thresholdAlertsQuery = trpc.integrations.evaluateAlertThresholds.useQuery(undefined, { refetchInterval: 60000 });

  const locations = healthQuery.data?.locations || [];
  const legacyAlerts = healthQuery.data?.alerts || [];
  const thresholdAlerts = thresholdAlertsQuery.data?.alerts || [];
  const history = historyQuery.data?.history || [];

  // Merge legacy alerts and threshold-based alerts into a unified list
  const allAlerts = useMemo(() => {
    const merged: Array<{
      severity: "warning" | "critical";
      message: string;
      locationName: string;
      metricName: string;
      source: "health" | "threshold";
      currentValue?: number;
      threshold?: number;
    }> = [];
    // Legacy alerts from getLocationHealth
    for (const a of legacyAlerts) {
      merged.push({
        severity: a.severity as "warning" | "critical",
        message: a.message,
        locationName: a.locationName || "Unknown",
        metricName: a.type || "health",
        source: "health",
      });
    }
    // Threshold-based alerts from evaluateAlertThresholds
    for (const a of thresholdAlerts) {
      // Avoid duplicates by checking if a similar message already exists
      const isDuplicate = merged.some(m => m.message === a.message);
      if (!isDuplicate) {
        merged.push({
          severity: a.severity,
          message: a.message,
          locationName: a.locationName,
          metricName: a.metricName,
          source: "threshold",
          currentValue: a.currentValue,
          threshold: a.severity === "critical" ? a.criticalThreshold : a.warningThreshold,
        });
      }
    }
    // Sort: critical first, then warning
    merged.sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));
    return merged;
  }, [legacyAlerts, thresholdAlerts]);

  // Summary stats
  const stats = useMemo(() => {
    const healthy = locations.filter(l => l.healthStatus === "healthy").length;
    const warning = locations.filter(l => l.healthStatus === "warning").length;
    const critical = locations.filter(l => l.healthStatus === "critical").length;
    const unknown = locations.filter(l => l.healthStatus === "unknown").length;
    const avgLag = locations.filter(l => l.syncLagMinutes !== null).reduce((sum, l) => sum + (l.syncLagMinutes || 0), 0) / Math.max(1, locations.filter(l => l.syncLagMinutes !== null).length);
    const totalContacts = locations.reduce((sum, l) => sum + (l.totalContacts || 0), 0);
    const totalLinked = locations.reduce((sum, l) => sum + (l.linkedContacts || 0), 0);
    return { healthy, warning, critical, unknown, avgLag: Math.round(avgLag), totalContacts, totalLinked };
  }, [locations]);

  // History stats
  const historyStats = useMemo(() => {
    const successful = history.filter(h => h.status === "success" || h.status === "completed").length;
    const failed = history.filter(h => h.status === "failed" || h.status === "error").length;
    const totalSynced = history.reduce((sum, h) => sum + (h.recordsSynced || 0), 0);
    const totalFailed = history.reduce((sum, h) => sum + (h.recordsFailed || 0), 0);
    const successRate = history.length > 0 ? Math.round((successful / history.length) * 100) : 0;
    return { successful, failed, totalSynced, totalFailed, successRate, total: history.length };
  }, [history]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            Location Health Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time sync health, data freshness, and error monitoring across all GHL locations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { healthQuery.refetch(); historyQuery.refetch(); }}
          disabled={healthQuery.isRefetching}
        >
          {healthQuery.isRefetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.healthy}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.unknown}</p>
            <p className="text-xs text-muted-foreground">Unknown</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Timer className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.avgLag}<span className="text-sm font-normal text-muted-foreground">m</span></p>
            <p className="text-xs text-muted-foreground">Avg Lag</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Database className="h-5 w-5 text-violet-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-5 w-5 text-cyan-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalLinked.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Linked</p>
          </CardContent>
        </Card>
      </div>

      {/* Polling Status */}
      <PollingStatusCard />

      {/* Active Alerts — unified from health checks + threshold evaluation */}
      {allAlerts.length > 0 && (
        <Card className={allAlerts.some(a => a.severity === "critical") ? "border-red-500/30 bg-red-500/[0.02]" : "border-amber-500/30 bg-amber-500/[0.02]"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${allAlerts.some(a => a.severity === "critical") ? "text-red-500" : "text-amber-500"}`} />
                <CardTitle className="text-base">Active Alerts ({allAlerts.length})</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {allAlerts.filter(a => a.severity === "critical").length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {allAlerts.filter(a => a.severity === "critical").length} Critical
                  </Badge>
                )}
                {allAlerts.filter(a => a.severity === "warning").length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {allAlerts.filter(a => a.severity === "warning").length} Warning
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${
                    alert.severity === "critical"
                      ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                      : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                  }`}
                >
                  <Badge
                    variant={alert.severity === "critical" ? "destructive" : "secondary"}
                    className="text-xs shrink-0 uppercase"
                  >
                    {alert.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.locationName} &middot; {alert.metricName.replace(/_/g, " ")}
                      {alert.source === "threshold" && alert.currentValue !== undefined && (
                        <> &middot; Current: <span className="font-mono">{alert.currentValue}</span> / Threshold: <span className="font-mono">{alert.threshold}</span></>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {alert.source === "threshold" ? "Threshold" : "Health"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Location Status</CardTitle>
          </div>
          <CardDescription>Per-location sync health, data freshness, and configuration</CardDescription>
        </CardHeader>
        <CardContent>
          {healthQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active locations found</p>
              <p className="text-xs mt-1">Connect GHL locations in the Sync Dashboard to start monitoring</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                    {/* Name + Region */}
                    <div className="md:col-span-2">
                      <p className="font-medium text-sm truncate">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.region || "No region"} &middot; {loc.locationId.slice(0, 8)}...</p>
                    </div>
                    {/* Health Status */}
                    <div>
                      <HealthBadge status={loc.healthStatus} />
                    </div>
                    {/* Sync Lag */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Last Sync</p>
                      <SyncLagDisplay minutes={loc.syncLagMinutes} />
                    </div>
                    {/* Contacts */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Contacts</p>
                      <p className="font-mono text-sm">
                        {(loc.linkedContacts || 0).toLocaleString()}/{(loc.totalContacts || 0).toLocaleString()}
                      </p>
                    </div>
                    {/* Config */}
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{loc.syncDirection || "bidirectional"}</Badge>
                      <Badge variant="outline" className="text-xs">{loc.syncFrequency || "realtime"}</Badge>
                      <Badge variant="outline" className="text-xs">{loc.conflictPolicy || "ghl_wins"}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              <CardTitle className="text-base">Sync History</CardTitle>
            </div>
            <Select value={String(historyDays)} onValueChange={(v) => setHistoryDays(Number(v))}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription>
            Sync operation history with success rates and record counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* History Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <p className="text-lg font-bold">{historyStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Syncs</p>
            </div>
            <div className="p-2 rounded-md bg-emerald-500/10 text-center">
              <p className="text-lg font-bold text-emerald-600">{historyStats.successful}</p>
              <p className="text-xs text-muted-foreground">Successful</p>
            </div>
            <div className="p-2 rounded-md bg-red-500/10 text-center">
              <p className="text-lg font-bold text-red-600">{historyStats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="p-2 rounded-md bg-blue-500/10 text-center">
              <p className="text-lg font-bold text-blue-600">{historyStats.totalSynced.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Records Synced</p>
            </div>
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <div className="flex items-center justify-center gap-1">
                {historyStats.successRate >= 90 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <p className="text-lg font-bold">{historyStats.successRate}%</p>
              </div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </div>

          {/* History Table */}
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sync history in the selected period</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Time</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-right p-2 font-medium">Synced</th>
                    <th className="text-right p-2 font-medium">Failed</th>
                    <th className="text-right p-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 100).map((h) => {
                    const duration = h.startedAt && h.completedAt ? Math.round((h.completedAt - h.startedAt) / 1000) : null;
                    const isSuccess = h.status === "success" || h.status === "completed";
                    return (
                      <tr key={h.id} className="border-t hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">
                          {h.startedAt ? new Date(h.startedAt).toLocaleString() : "—"}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">{h.syncType || "sync"}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant={isSuccess ? "default" : "destructive"} className="text-xs">
                            {h.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono">{h.recordsSynced || 0}</td>
                        <td className="p-2 text-right font-mono text-red-500">{h.recordsFailed || 0}</td>
                        <td className="p-2 text-right font-mono text-xs">
                          {duration !== null ? `${duration}s` : "—"}
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

      {/* System Info Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Server className="h-3 w-3" />
        <span>Auto-refreshes every 30s</span>
        <span>&middot;</span>
        <Shield className="h-3 w-3" />
        <span>Threshold-based alerting active &middot; Configure at Platform &gt; Alert Thresholds</span>
      </div>
    </div>
  );
}
