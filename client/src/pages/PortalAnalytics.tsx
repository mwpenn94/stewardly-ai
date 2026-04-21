/**
 * PortalAnalytics — Portal engagement tracking, health metrics, and event analytics.
 * Wired to trpc.portalOptimizer.{trackEvent, engagement, healthMetrics}
 * Enhanced with Recharts real-time visualizations.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart3, Activity, Users, Eye, Clock,
  TrendingUp, Loader2, RefreshCw, Gauge,
  MousePointerClick, FileText, MessageSquare,
  Zap, Shield, LogIn, PieChart as PieChartIcon,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const CHART_COLORS = [
  "oklch(0.65 0.2 250)", // blue
  "oklch(0.72 0.18 55)",  // amber
  "oklch(0.68 0.17 155)", // emerald
  "oklch(0.62 0.2 300)",  // purple
  "oklch(0.7 0.15 195)",  // cyan
  "oklch(0.55 0.12 30)",  // warm gray
  "oklch(0.7 0.2 20)",    // coral
  "oklch(0.65 0.15 120)", // teal
];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  page_view: <Eye className="h-4 w-4 text-blue-500" />,
  feature_use: <Zap className="h-4 w-4 text-amber-500" />,
  document_access: <FileText className="h-4 w-4 text-emerald-500" />,
  tool_use: <MousePointerClick className="h-4 w-4 text-purple-500" />,
  chat_session: <MessageSquare className="h-4 w-4 text-cyan-500" />,
  login: <LogIn className="h-4 w-4 text-muted-foreground" />,
};

export default function PortalAnalytics({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const utils = trpc.useUtils();

  // ── Queries ──────────────────────────────────────────────────────
  const engagementQ = trpc.portalOptimizer.engagement.useQuery(undefined, { retry: false });
  const healthQ = trpc.portalOptimizer.healthMetrics.useQuery(undefined, { retry: false });

  // ── Mutations ────────────────────────────────────────────────────
  const trackEvent = trpc.portalOptimizer.trackEvent.useMutation({
    onSuccess: () => { utils.portalOptimizer.engagement.invalidate(); toast.success("Event tracked"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Derived metrics ──────────────────────────────────────────────
  const engagementRaw = engagementQ.data as any;
  const engagementData = (engagementRaw?.recentEvents ?? engagementRaw) as any[] | undefined;
  const engagementScore = engagementRaw?.score;
  const adoptionStage = engagementRaw?.stage;
  const recommendations = engagementRaw?.recommendations;
  const healthData = healthQ.data as any;

  const eventTypeCounts = useMemo(() => {
    if (!engagementData) return {};
    const counts: Record<string, number> = {};
    engagementData.forEach((e: any) => {
      const t = e.eventType || "unknown";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [engagementData]);

  const totalDuration = useMemo(() => {
    if (!engagementData) return 0;
    return engagementData.reduce((a: number, e: any) => a + (e.durationSeconds || 0), 0);
  }, [engagementData]);

  const topFeatures = useMemo(() => {
    if (!engagementData) return [];
    const featureCounts: Record<string, number> = {};
    engagementData.forEach((e: any) => {
      if (e.featureName) featureCounts[e.featureName] = (featureCounts[e.featureName] || 0) + 1;
    });
    return Object.entries(featureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [engagementData]);

  // ── Chart data ───────────────────────────────────────────────────
  const pieData = useMemo(() =>
    Object.entries(eventTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value })),
    [eventTypeCounts]
  );

  const barData = useMemo(() =>
    topFeatures.map(f => ({ name: f.name.length > 18 ? f.name.slice(0, 16) + "…" : f.name, uses: f.count, fullName: f.name })),
    [topFeatures]
  );

  const timelineData = useMemo(() => {
    if (!engagementData || engagementData.length === 0) return [];
    // Group events by hour (last 24h) or by day (if older)
    const buckets: Record<string, number> = {};
    engagementData.forEach((e: any) => {
      const d = e.createdAt ? new Date(e.createdAt) : new Date();
      const key = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([time, events]) => ({ time, events }));
  }, [engagementData]);

  const radarData = useMemo(() => {
    const types = ["page_view", "feature_use", "document_access", "tool_use", "chat_session", "login"];
    const total = engagementData?.length || 1;
    return types.map(t => ({
      subject: t.replace(/_/g, " "),
      value: Math.round(((eventTypeCounts[t] || 0) / total) * 100),
      fullMark: 100,
    }));
  }, [eventTypeCounts, engagementData]);

  const isLoading = engagementQ.isLoading || healthQ.isLoading;

  return (
    <div className="container max-w-7xl py-8 space-y-6">
      <SEOHead title="Portal Analytics" description="Portal engagement metrics and health analytics" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gauge className="h-8 w-8 text-primary" /> Portal Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time portal engagement, feature usage trends, and platform health metrics.
          </p>
        </div>
        <Button variant="outline" className="gap-1" onClick={() => { engagementQ.refetch(); healthQ.refetch(); }}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: healthData?.totalUsers ?? "—", icon: Users, color: "text-blue-500" },
          { label: "Total Events", value: healthData?.totalEvents ?? "—", icon: Activity, color: "text-emerald-500" },
          { label: "My Events", value: engagementData?.length ?? 0, icon: Eye, color: "text-amber-500" },
          { label: "Time Spent", value: totalDuration > 0 ? `${Math.round(totalDuration / 60)}m` : "—", icon: Clock, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="charts" className="gap-1"><PieChartIcon className="h-4 w-4" /> Charts</TabsTrigger>
          <TabsTrigger value="events" className="gap-1"><Activity className="h-4 w-4" /> Event Log</TabsTrigger>
          <TabsTrigger value="features" className="gap-1"><TrendingUp className="h-4 w-4" /> Top Features</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
              <CardDescription>Event volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : timelineData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No timeline data available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Area type="monotone" dataKey="events" stroke="oklch(0.65 0.2 250)" fill="url(#areaGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Event Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Type Distribution</CardTitle>
                <CardDescription>Breakdown of engagement events by type</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : Object.keys(eventTypeCounts).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No events recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(eventTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => {
                      const total = engagementData?.length || 1;
                      const pctVal = Math.round((count / total) * 100);
                      return (
                        <div key={type} className="flex items-center gap-3">
                          {EVENT_ICONS[type] || <Activity className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{type.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground">{count} ({pctVal}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctVal}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform Health */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Platform Health</CardTitle>
                <CardDescription>Aggregate portal metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {healthQ.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : !healthData ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">Health metrics unavailable.</p>
                ) : (
                  <div className="space-y-4">
                    {[
                      { icon: Users, label: "Total Active Users", value: healthData.totalUsers ?? 0 },
                      { icon: Activity, label: "Total Events", value: healthData.totalEvents ?? 0 },
                      { icon: TrendingUp, label: "Events per User", value: healthData.totalUsers > 0 ? (healthData.totalEvents / healthData.totalUsers).toFixed(1) : "—" },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2"><m.icon className="h-4 w-4 text-primary" /> <span className="text-sm">{m.label}</span></div>
                        <span className="text-xl font-bold">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Track Button */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Track Portal Visit</p>
                  <p className="text-xs text-muted-foreground">Record your visit to this analytics page</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => trackEvent.mutate({ eventType: "page_view", pagePath: "/portal-analytics", featureName: "Portal Analytics", durationSeconds: 0 })}
                  disabled={trackEvent.isPending}>
                  {trackEvent.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MousePointerClick className="h-3 w-3" />}
                  Track
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CHARTS TAB ─────────────────────────────────────────── */}
        <TabsContent value="charts" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pie Chart — Event Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Type Breakdown</CardTitle>
                <CardDescription>Proportional distribution of event types</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : pieData.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">No data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={100} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Radar Chart — Engagement Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Profile</CardTitle>
                <CardDescription>Radar view of engagement across event types</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : radarData.every(d => d.value === 0) ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">No engagement data to visualize.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid className="stroke-muted" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <Radar name="Engagement %" dataKey="value" stroke="oklch(0.65 0.2 250)" fill="oklch(0.65 0.2 250)" fillOpacity={0.25} strokeWidth={2} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart — Top Features */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Feature Usage Ranking</CardTitle>
                <CardDescription>Top 10 most-used features by event count</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : barData.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">No feature usage data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                        formatter={(value: any, _name: any, props: any) => [`${value} uses`, props.payload.fullName]}
                      />
                      <Bar dataKey="uses" radius={[0, 4, 4, 0]}>
                        {barData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── EVENTS TAB ──────────────────────────────────────────── */}
        <TabsContent value="events" className="space-y-4 mt-4">
          {engagementQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !engagementData?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No engagement events recorded.</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {engagementData.slice(0, 50).map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {EVENT_ICONS[e.eventType] || <Activity className="h-4 w-4" />}
                          <span className="capitalize text-sm">{(e.eventType || "unknown").replace(/_/g, " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{e.featureName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.pagePath || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.durationSeconds ? `${e.durationSeconds}s` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TOP FEATURES TAB ────────────────────────────────────── */}
        <TabsContent value="features" className="space-y-4 mt-4">
          {engagementQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : topFeatures.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No feature usage data available.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {topFeatures.map((f, i) => {
                const maxCount = topFeatures[0]?.count || 1;
                const pctVal = Math.round((f.count / maxCount) * 100);
                return (
                  <Card key={f.name}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-8">#{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{f.name}</span>
                            <span className="text-muted-foreground">{f.count} uses</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pctVal}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
