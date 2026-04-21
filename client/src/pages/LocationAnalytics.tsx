/**
 * Cross-Location Analytics Dashboard
 * 
 * Leadership-level view aggregating sync health, lead conversion rates,
 * pipeline velocity, and lead volume across all locations with drill-down.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, Activity, Globe, RefreshCw, MapPin,
  ArrowUpRight, ArrowDownRight, Minus, Shield, Zap, Users, Target,
  Search, Download, ChevronRight
} from "lucide-react";

// ─── Date Range Presets ─────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: "Last 7 Days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "Last 30 Days", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "Last 90 Days", value: "90d", ms: 90 * 24 * 60 * 60 * 1000 },
  { label: "Last 365 Days", value: "365d", ms: 365 * 24 * 60 * 60 * 1000 },
  { label: "All Time", value: "all", ms: 10 * 365 * 24 * 60 * 60 * 1000 },
];

// ─── Stat Card Component ────────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, trend, trendLabel, accent = false,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: any; trend?: "up" | "down" | "flat"; trendLabel?: string; accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold font-heading">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && trendLabel && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
            {trend === "flat" && <Minus className="h-3 w-3 text-muted-foreground" />}
            <span className={trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}>
              {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LocationAnalytics() {
  // toast imported from sonner at top level
  const [dateRange, setDateRange] = useState("30d");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const rangeMs = DATE_RANGES.find(r => r.value === dateRange)?.ms ?? 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const locationDbId = selectedLocation !== "all" ? Number(selectedLocation) : undefined;

  const { data: analytics, isLoading, refetch } = trpc.integrations.getCrossLocationAnalytics.useQuery({
    locationDbId,
    dateRangeStart: now - rangeMs,
    dateRangeEnd: now,
  });

  const { data: locations } = trpc.integrations.listLocations.useQuery();

  const discoverMutation = trpc.integrations.discoverLocations.useMutation({
    onSuccess: (data) => {
      toast.success(`Discovery Complete: Found ${data.total} locations (${data.created} new, ${data.existing} existing)`);
      refetch();
    },
    onError: (err) => toast.error(`Discovery Failed: ${err.message}`),
  });

  const { data: provisionLog } = trpc.integrations.getProvisioningLog.useQuery({});

  // Derived metrics
  const totals = analytics?.totals as any || {};
  const conversions = (analytics?.conversions || []) as any[];
  const syncHealth = (analytics?.syncHealth || []) as any[];
  const timeSeries = (analytics?.timeSeries || []) as any[];
  const statusBreakdown = (analytics?.statusBreakdown || []) as any[];
  const velocity = (analytics?.velocity || []) as any[];

  // Aggregate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of statusBreakdown) {
      const s = row.status || "unknown";
      counts[s] = (counts[s] || 0) + Number(row.count);
    }
    return counts;
  }, [statusBreakdown]);

  const statusColors: Record<string, string> = {
    new: "bg-blue-500",
    qualified: "bg-emerald-500",
    converted: "bg-primary",
    proposal: "bg-amber-500",
    negotiation: "bg-orange-500",
    disqualified: "bg-red-500/60",
    nurturing: "bg-violet-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Cross-Location Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leadership view — pipeline performance, sync health, and conversion metrics across all locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(locations || []).map((loc: any) => (
                <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Leads" value={Number(totals.totalLeads || 0).toLocaleString()}
          icon={Users} accent
          subtitle={`${totals.locationCount || 0} locations`}
        />
        <StatCard
          title="Qualified" value={Number(totals.totalQualified || 0).toLocaleString()}
          icon={Target}
          subtitle={`${totals.qualificationRate || "0.0"}% rate`}
        />
        <StatCard
          title="Converted" value={Number(totals.totalConverted || 0).toLocaleString()}
          icon={TrendingUp}
          subtitle={`${totals.conversionRate || "0.0"}% rate`}
        />
        <StatCard
          title="Locations" value={syncHealth.length}
          icon={Globe}
          subtitle={`${syncHealth.filter((s: any) => s.is_active).length} active`}
        />
        <StatCard
          title="Linked Leads" value={syncHealth.reduce((s: number, r: any) => s + Number(r.linked_leads || 0), 0).toLocaleString()}
          icon={Shield}
          subtitle="CRM synced"
        />
        <StatCard
          title="Sync Health"
          value={`${syncHealth.filter((s: any) => Number(s.failed_syncs || 0) === 0).length}/${syncHealth.length}`}
          icon={Zap}
          subtitle="No failures"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Location Breakdown</TabsTrigger>
          <TabsTrigger value="sync">Sync Health</TabsTrigger>
          <TabsTrigger value="provisioning">Auto-Provisioning</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Pipeline Status Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Pipeline Status Distribution</CardTitle>
              <CardDescription>Lead count by pipeline stage across all locations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statusCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-medium capitalize text-muted-foreground">{status}</div>
                      <div className="flex-1">
                        <ProgressBar
                          value={count}
                          max={Number(totals.totalLeads) || 1}
                          color={statusColors[status] || "bg-muted-foreground"}
                        />
                      </div>
                      <div className="w-16 text-xs font-mono text-right">{count.toLocaleString()}</div>
                      <div className="w-12 text-xs text-muted-foreground text-right">
                        {totals.totalLeads ? ((count / Number(totals.totalLeads)) * 100).toFixed(1) : "0"}%
                      </div>
                    </div>
                  ))}
              </div>
              {Object.keys(statusCounts).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No lead data in selected range</p>
              )}
            </CardContent>
          </Card>

          {/* Time Series - Leads Created Per Day */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Lead Volume Over Time</CardTitle>
              <CardDescription>New leads created per day</CardDescription>
            </CardHeader>
            <CardContent>
              {timeSeries.length > 0 ? (
                <div className="space-y-1">
                  {/* Simple text-based chart */}
                  {(() => {
                    const byDate: Record<string, number> = {};
                    for (const row of timeSeries) {
                      const d = String(row.date).slice(0, 10);
                      byDate[d] = (byDate[d] || 0) + Number(row.leads_created);
                    }
                    const entries = Object.entries(byDate).slice(-14); // Last 14 days
                    const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                    return entries.map(([date, count]) => (
                      <div key={date} className="flex items-center gap-2">
                        <div className="w-20 text-xs text-muted-foreground font-mono">{date.slice(5)}</div>
                        <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded transition-all"
                            style={{ width: `${(count / maxVal) * 100}%` }}
                          />
                        </div>
                        <div className="w-10 text-xs font-mono text-right">{count}</div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No time series data</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Breakdown Tab */}
        <TabsContent value="locations" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Location Performance Comparison</CardTitle>
              <CardDescription>Pipeline metrics per location with conversion rates</CardDescription>
            </CardHeader>
            <CardContent>
              {conversions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4">Location</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-right py-2 px-2">Qualified</th>
                        <th className="text-right py-2 px-2">Converted</th>
                        <th className="text-right py-2 px-2">Qual. Rate</th>
                        <th className="text-right py-2 px-2">Conv. Rate</th>
                        <th className="text-right py-2 px-2">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((row: any, i: number) => {
                        const total = Number(row.total_leads);
                        const qual = Number(row.qualified);
                        const conv = Number(row.converted);
                        const qualRate = total > 0 ? (qual / total * 100).toFixed(1) : "0.0";
                        const convRate = total > 0 ? (conv / total * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{row.location_name || "Unassigned"}</span>
                              </div>
                            </td>
                            <td className="text-right py-2.5 px-2 font-mono">{total.toLocaleString()}</td>
                            <td className="text-right py-2.5 px-2 font-mono text-emerald-500">{qual.toLocaleString()}</td>
                            <td className="text-right py-2.5 px-2 font-mono text-primary">{conv.toLocaleString()}</td>
                            <td className="text-right py-2.5 px-2">
                              <Badge variant="outline" className="text-xs font-mono">{qualRate}%</Badge>
                            </td>
                            <td className="text-right py-2.5 px-2">
                              <Badge variant="outline" className="text-xs font-mono">{convRate}%</Badge>
                            </td>
                            <td className="text-right py-2.5 px-2 font-mono text-muted-foreground">
                              {row.avg_propensity != null ? Number(row.avg_propensity).toFixed(0) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No location data in selected range</p>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Velocity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Pipeline Velocity</CardTitle>
              <CardDescription>Average lead lifecycle duration by location</CardDescription>
            </CardHeader>
            <CardContent>
              {velocity.length > 0 ? (
                <div className="space-y-3">
                  {velocity.map((row: any, i: number) => {
                    const avgMs = Number(row.avg_lifecycle_ms || 0);
                    const avgDays = avgMs > 0 ? (avgMs / (24 * 60 * 60 * 1000)).toFixed(1) : "—";
                    const maxMs = Math.max(...velocity.map((v: any) => Number(v.avg_lifecycle_ms || 0)), 1);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-36 text-xs font-medium truncate">{row.location_name || "Unassigned"}</div>
                        <div className="flex-1">
                          <ProgressBar value={avgMs} max={maxMs} color="bg-amber-500/70" />
                        </div>
                        <div className="w-20 text-xs font-mono text-right">
                          {avgDays === "—" ? "—" : `${avgDays}d`}
                        </div>
                        <div className="w-16 text-xs text-muted-foreground text-right">
                          {Number(row.total_leads).toLocaleString()} leads
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No velocity data</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Health Tab */}
        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Sync Health by Location</CardTitle>
              <CardDescription>CRM link status, sync runs, and failure tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {syncHealth.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4">Location</th>
                        <th className="text-right py-2 px-2">Linked</th>
                        <th className="text-right py-2 px-2">Unlinked</th>
                        <th className="text-right py-2 px-2">Link Rate</th>
                        <th className="text-right py-2 px-2">Syncs</th>
                        <th className="text-right py-2 px-2">Failures</th>
                        <th className="text-center py-2 px-2">Direction</th>
                        <th className="text-right py-2 px-2">Last Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHealth.map((row: any, i: number) => {
                        const linked = Number(row.linked_leads || 0);
                        const unlinked = Number(row.unlinked_leads || 0);
                        const total = linked + unlinked;
                        const linkRate = total > 0 ? (linked / total * 100).toFixed(1) : "—";
                        const failures = Number(row.failed_syncs || 0);
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${failures > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
                                <span className="font-medium">{row.location_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground ml-4">{row.ghl_location_id}</div>
                            </td>
                            <td className="text-right py-2.5 px-2 font-mono text-emerald-500">{linked.toLocaleString()}</td>
                            <td className="text-right py-2.5 px-2 font-mono text-amber-500">{unlinked.toLocaleString()}</td>
                            <td className="text-right py-2.5 px-2">
                              <Badge variant={linkRate === "100.0" ? "default" : "outline"} className="text-xs font-mono">
                                {linkRate}%
                              </Badge>
                            </td>
                            <td className="text-right py-2.5 px-2 font-mono">{Number(row.completed_syncs || 0)}</td>
                            <td className="text-right py-2.5 px-2">
                              {failures > 0 ? (
                                <Badge variant="destructive" className="text-xs font-mono">{failures}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="text-center py-2.5 px-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {(row.sync_direction || "—").replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="text-right py-2.5 px-2 text-xs text-muted-foreground">
                              {row.last_sync_at ? new Date(row.last_sync_at).toLocaleDateString() : "Never"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No locations configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Provisioning Tab */}
        <TabsContent value="provisioning" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Discovery */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Location Discovery</CardTitle>
                <CardDescription>Scan GHL API for new sub-accounts and auto-provision them</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Discovers all GHL sub-accounts via API, creates location records for any new ones,
                  and auto-assigns admin users. Safe to run multiple times — skips existing locations.
                </p>
                <Button
                  onClick={() => discoverMutation.mutate({})}
                  disabled={discoverMutation.isPending}
                  className="w-full"
                >
                  {discoverMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Discovering...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Discover & Provision Locations</>
                  )}
                </Button>
                {discoverMutation.data && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Total found:</span><span className="font-mono">{discoverMutation.data.total}</span></div>
                    <div className="flex justify-between"><span>Newly created:</span><span className="font-mono text-emerald-500">{discoverMutation.data.created}</span></div>
                    <div className="flex justify-between"><span>Already existed:</span><span className="font-mono">{discoverMutation.data.existing}</span></div>
                    <div className="flex justify-between"><span>Reactivated:</span><span className="font-mono text-amber-500">{discoverMutation.data.reactivated}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto-Provision Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading">Webhook Auto-Provisioning</CardTitle>
                <CardDescription>Automatic location creation from inbound webhooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium mb-1">
                    <Zap className="h-4 w-4" /> Active
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When a webhook arrives from an unknown GHL location, the system automatically
                    creates a location record, fetches the location name from GHL API, and assigns
                    all admin users. No manual setup required.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Default sync direction: <strong>bidirectional</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Default conflict policy: <strong>newest wins</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Admin users auto-assigned to new locations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Idempotent — safe to process duplicate events</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Provisioning Audit Log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Provisioning Audit Log</CardTitle>
              <CardDescription>History of auto-provisioned locations</CardDescription>
            </CardHeader>
            <CardContent>
              {(provisionLog || []).length > 0 ? (
                <div className="space-y-2">
                  {(provisionLog as any[]).map((entry: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge variant={entry.value?.action === "created" ? "default" : "outline"} className="text-xs">
                          {entry.value?.action || "unknown"}
                        </Badge>
                        <div>
                          <span className="text-sm font-medium">{entry.value?.name || entry.key}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {entry.value?.usersAssigned || 0} users assigned
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.value?.timestamp ? new Date(entry.value.timestamp).toLocaleString() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No provisioning events yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
