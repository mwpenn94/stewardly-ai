import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BarChart3,
  CheckCircle2, Clock, Gauge, Loader2, Radio, RefreshCw, Server,
  Signal, Timer, TrendingDown, TrendingUp, Wifi, Zap, XCircle,
  ArrowLeftRight, Shield, Eye,
} from "lucide-react";

// ─── Time Range Selector ─────────────────────────────────────────────
const TIME_RANGES = [
  { label: "Last 1h", value: "1h", ms: 3600000 },
  { label: "Last 24h", value: "24h", ms: 86400000 },
  { label: "Last 7d", value: "7d", ms: 7 * 86400000 },
  { label: "Last 30d", value: "30d", ms: 30 * 86400000 },
];

// ─── Latency Display ─────────────────────────────────────────────────
function LatencyDisplay({ ms, label }: { ms: number | null; label: string }) {
  if (ms === null) return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-muted-foreground">—</p>
    </div>
  );
  const color = ms < 5000 ? "text-emerald-600" : ms < 30000 ? "text-amber-600" : ms < 60000 ? "text-orange-600" : "text-red-600";
  const formatted = ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`font-mono font-bold text-lg ${color}`}>{formatted}</p>
    </div>
  );
}

// ─── Channel Metric Card ─────────────────────────────────────────────
function ChannelCard({ channel, metrics }: {
  channel: "webhook" | "polling";
  metrics: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    avgLatencyMs: number | null;
    medianLatencyMs: number | null;
    p95LatencyMs: number | null;
    minLatencyMs: number | null;
    maxLatencyMs: number | null;
    eventsLast1h: number;
    eventsLast24h: number;
    lastEventAt: number | null;
  };
}) {
  const isWebhook = channel === "webhook";
  const Icon = isWebhook ? Radio : Signal;
  const accentColor = isWebhook ? "blue" : "violet";
  const borderClass = isWebhook ? "border-blue-500/20" : "border-violet-500/20";
  const bgClass = isWebhook ? "bg-blue-500/5" : "bg-violet-500/5";
  const iconClass = isWebhook ? "text-blue-500" : "text-violet-500";

  const rateColor = metrics.successRate >= 95 ? "text-emerald-600" :
                    metrics.successRate >= 80 ? "text-amber-600" : "text-red-600";

  return (
    <Card className={`${borderClass} ${bgClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconClass}`} />
            <CardTitle className="text-base capitalize">{channel}</CardTitle>
          </div>
          <Badge variant={metrics.totalEvents > 0 ? "default" : "outline"} className="text-xs">
            {metrics.totalEvents > 0 ? "Active" : "No Data"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event Counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-md bg-background/60">
            <p className="text-xl font-bold">{metrics.totalEvents.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          <div className="text-center p-2 rounded-md bg-background/60">
            <p className={`text-xl font-bold ${rateColor}`}>{metrics.successRate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
          <div className="text-center p-2 rounded-md bg-background/60">
            <p className="text-xl font-bold text-red-600">{metrics.failedEvents}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        <Separator />

        {/* Latency Stats */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Latency Distribution</p>
          <div className="grid grid-cols-5 gap-2">
            <LatencyDisplay ms={metrics.minLatencyMs} label="Min" />
            <LatencyDisplay ms={metrics.avgLatencyMs} label="Avg" />
            <LatencyDisplay ms={metrics.medianLatencyMs} label="Median" />
            <LatencyDisplay ms={metrics.p95LatencyMs} label="P95" />
            <LatencyDisplay ms={metrics.maxLatencyMs} label="Max" />
          </div>
        </div>

        <Separator />

        {/* Activity */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Last 1h</p>
            <p className="font-mono font-medium">{metrics.eventsLast1h}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last 24h</p>
            <p className="font-mono font-medium">{metrics.eventsLast24h}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Event</p>
            <p className="font-mono text-xs">
              {metrics.lastEventAt ? new Date(metrics.lastEventAt).toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Comparison Arrow ────────────────────────────────────────────────
function ComparisonArrow({ advantage }: {
  advantage: {
    channel: string;
    differenceMs: number;
    description: string;
  };
}) {
  const isWebhook = advantage.channel === "webhook";
  const isPolling = advantage.channel === "polling";
  const isTie = advantage.channel === "tie";

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      {isTie ? (
        <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
      ) : isWebhook ? (
        <div className="flex items-center gap-1 text-blue-500">
          <ArrowDown className="h-6 w-6" />
          <Zap className="h-5 w-5" />
        </div>
      ) : (
        <div className="flex items-center gap-1 text-violet-500">
          <ArrowUp className="h-6 w-6" />
          <Signal className="h-5 w-5" />
        </div>
      )}
      <p className="text-xs text-center text-muted-foreground max-w-[200px]">
        {advantage.description}
      </p>
    </div>
  );
}

// ─── Timeline Chart (simple bar representation) ──────────────────────
function TimelineChart({ timeline }: {
  timeline: Array<{
    hour: string;
    webhookCount: number;
    pollingCount: number;
    webhookAvgLatency: number | null;
    pollingAvgLatency: number | null;
  }>;
}) {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No timeline data available yet</p>
        <p className="text-xs mt-1">Events will appear here as webhook and polling data is collected</p>
      </div>
    );
  }

  const maxCount = Math.max(
    ...timeline.map(t => Math.max(t.webhookCount, t.pollingCount)),
    1,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span>Webhook</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-violet-500" />
          <span>Polling</span>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {timeline.map((point, i) => {
          const hourLabel = point.hour.split(" ")[1] || point.hour;
          const whPct = Math.max(2, (point.webhookCount / maxCount) * 100);
          const plPct = Math.max(2, (point.pollingCount / maxCount) * 100);

          return (
            <div key={i} className="flex items-center gap-2 text-xs group">
              <span className="w-14 text-right font-mono text-muted-foreground shrink-0">{hourLabel}</span>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 rounded-sm bg-blue-500/80 transition-all"
                    style={{ width: `${whPct}%` }}
                  />
                  <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {point.webhookCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 rounded-sm bg-violet-500/80 transition-all"
                    style={{ width: `${plPct}%` }}
                  />
                  <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {point.pollingCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event Type Breakdown Table ──────────────────────────────────────
function EventTypeTable({ breakdown }: {
  breakdown: Array<{
    eventType: string;
    webhookCount: number;
    pollingCount: number;
    webhookAvgLatency: number | null;
    pollingAvgLatency: number | null;
  }>;
}) {
  if (breakdown.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No event type data available yet</p>
      </div>
    );
  }

  const fmtLatency = (ms: number | null) => {
    if (ms === null) return "—";
    return ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium">Event Type</th>
            <th className="text-right p-2 font-medium">
              <span className="text-blue-500">Webhook</span> Count
            </th>
            <th className="text-right p-2 font-medium">
              <span className="text-violet-500">Polling</span> Count
            </th>
            <th className="text-right p-2 font-medium">
              <span className="text-blue-500">WH</span> Latency
            </th>
            <th className="text-right p-2 font-medium">
              <span className="text-violet-500">PL</span> Latency
            </th>
            <th className="text-right p-2 font-medium">Faster</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row) => {
            const whFaster = row.webhookAvgLatency !== null && row.pollingAvgLatency !== null && row.webhookAvgLatency < row.pollingAvgLatency;
            const plFaster = row.webhookAvgLatency !== null && row.pollingAvgLatency !== null && row.pollingAvgLatency < row.webhookAvgLatency;
            return (
              <tr key={row.eventType} className="border-t hover:bg-muted/30">
                <td className="p-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {row.eventType.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="p-2 text-right font-mono">{row.webhookCount}</td>
                <td className="p-2 text-right font-mono">{row.pollingCount}</td>
                <td className={`p-2 text-right font-mono ${whFaster ? "text-emerald-600 font-bold" : ""}`}>
                  {fmtLatency(row.webhookAvgLatency)}
                </td>
                <td className={`p-2 text-right font-mono ${plFaster ? "text-emerald-600 font-bold" : ""}`}>
                  {fmtLatency(row.pollingAvgLatency)}
                </td>
                <td className="p-2 text-right">
                  {whFaster ? (
                    <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">Webhook</Badge>
                  ) : plFaster ? (
                    <Badge className="text-xs bg-violet-500/10 text-violet-600 border-violet-500/20">Polling</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Coverage Venn Diagram (simplified) ──────────────────────────────
function CoverageDisplay({ coverage }: {
  coverage: {
    webhookOnly: number;
    pollingOnly: number;
    bothChannels: number;
    description: string;
  };
}) {
  const total = coverage.webhookOnly + coverage.pollingOnly + coverage.bothChannels;
  if (total === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Eye className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No contact coverage data yet</p>
      </div>
    );
  }

  const whPct = Math.round((coverage.webhookOnly / total) * 100);
  const bothPct = Math.round((coverage.bothChannels / total) * 100);
  const plPct = Math.round((coverage.pollingOnly / total) * 100);

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="h-8 rounded-full overflow-hidden flex">
        {whPct > 0 && (
          <div className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${whPct}%` }}>
            {whPct > 8 ? `${whPct}%` : ""}
          </div>
        )}
        {bothPct > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${bothPct}%` }}>
            {bothPct > 8 ? `${bothPct}%` : ""}
          </div>
        )}
        {plPct > 0 && (
          <div className="bg-violet-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${plPct}%` }}>
            {plPct > 8 ? `${plPct}%` : ""}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-xs text-muted-foreground">Webhook Only</span>
          </div>
          <p className="font-mono font-bold">{coverage.webhookOnly}</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-500 to-violet-500" />
            <span className="text-xs text-muted-foreground">Both</span>
          </div>
          <p className="font-mono font-bold">{coverage.bothChannels}</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-sm bg-violet-500" />
            <span className="text-xs text-muted-foreground">Polling Only</span>
          </div>
          <p className="font-mono font-bold">{coverage.pollingOnly}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">{coverage.description}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function WebhookVsPolling() {
  const [timeRange, setTimeRange] = useState("7d");
  const since = useMemo(() => {
    const range = TIME_RANGES.find(r => r.value === timeRange);
    return Date.now() - (range?.ms ?? 7 * 86400000);
  }, [timeRange]);

  const metricsQuery = trpc.integrations.getWebhookVsPollingMetrics.useQuery(
    { since },
    { refetchInterval: 60000 },
  );
  const channelHealth = trpc.integrations.getSyncChannelHealth.useQuery(
    undefined,
    { refetchInterval: 30000 },
  );

  const comparison = metricsQuery.data?.comparison;
  const timeline = metricsQuery.data?.timeline ?? [];
  const breakdown = metricsQuery.data?.breakdown ?? [];

  const overallHealth = channelHealth.data?.overallHealth ?? "unknown";
  const healthColor = overallHealth === "healthy" ? "text-emerald-500" :
                      overallHealth === "warning" ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-blue-500" />
            Webhook vs Polling Comparison
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare sync channel performance, latency, coverage, and reliability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Gauge className={`h-4 w-4 ${healthColor}`} />
            <span className={`text-sm font-medium capitalize ${healthColor}`}>{overallHealth}</span>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { metricsQuery.refetch(); channelHealth.refetch(); }}
            disabled={metricsQuery.isRefetching}
          >
            {metricsQuery.isRefetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {metricsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !comparison ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No comparison data available</p>
            <p className="text-sm mt-1">Configure GHL webhooks and/or enable polling to start collecting metrics</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Side-by-Side Channel Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <ChannelCard channel="webhook" metrics={comparison.webhook} />
            <ComparisonArrow advantage={comparison.latencyAdvantage} />
            <ChannelCard channel="polling" metrics={comparison.polling} />
          </div>

          {/* Recommendation Banner */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Recommendation</p>
                <p className="text-sm text-muted-foreground mt-0.5">{comparison.recommendation}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Detail Views */}
          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="gap-1.5">
                <Activity className="h-4 w-4" />
                Event Types
              </TabsTrigger>
              <TabsTrigger value="coverage" className="gap-1.5">
                <Eye className="h-4 w-4" />
                Coverage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    Hourly Event Timeline
                  </CardTitle>
                  <CardDescription>
                    Event volume per hour for each sync channel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TimelineChart timeline={timeline} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-500" />
                    Event Type Breakdown
                  </CardTitle>
                  <CardDescription>
                    Per-event-type comparison of counts and average latency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EventTypeTable breakdown={breakdown} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coverage">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-5 w-5 text-emerald-500" />
                    Contact Coverage Analysis
                  </CardTitle>
                  <CardDescription>
                    How many contacts are detected by each channel vs both
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CoverageDisplay coverage={comparison.coverageComparison} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Server className="h-3 w-3" />
        <span>Metrics auto-refresh every 60s</span>
        <span>&middot;</span>
        <Timer className="h-3 w-3" />
        <span>Latency = detection time - GHL origin timestamp</span>
      </div>
    </div>
  );
}
