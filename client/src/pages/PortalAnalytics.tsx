/**
 * PortalAnalytics — Portal engagement tracking, health metrics, and event analytics.
 * Wired to trpc.portalOptimizer.{trackEvent, engagement, healthMetrics}
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
  Zap, Shield, LogIn,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  page_view: <Eye className="h-4 w-4 text-blue-500" />,
  feature_use: <Zap className="h-4 w-4 text-amber-500" />,
  document_access: <FileText className="h-4 w-4 text-emerald-500" />,
  tool_use: <MousePointerClick className="h-4 w-4 text-purple-500" />,
  chat_session: <MessageSquare className="h-4 w-4 text-cyan-500" />,
  login: <LogIn className="h-4 w-4 text-muted-foreground" />,
};

export default function PortalAnalytics() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const utils = trpc.useUtils();

  // ── Queries ──────────────────────────────────────────────────────
  const engagementQ = trpc.portalOptimizer.engagement.useQuery(undefined, { retry: false });
  const healthQ = trpc.portalOptimizer.healthMetrics.useQuery(undefined, { retry: false });

  // ── Mutations ────────────────────────────────────────────────────
  const trackEvent = trpc.portalOptimizer.trackEvent.useMutation({
    onSuccess: () => { utils.portalOptimizer.engagement.invalidate(); toast.success("Event tracked"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Derived metrics ──────────────────────────────────────────────
  const engagementData = engagementQ.data as any[] | undefined;
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

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <SEOHead title="Portal Analytics" description="Portal engagement metrics and health analytics" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gauge className="h-8 w-8 text-primary" /> Portal Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor portal engagement, track feature usage, and review platform health metrics.
          </p>
        </div>
        <Button variant="outline" className="gap-1" onClick={() => { engagementQ.refetch(); healthQ.refetch(); }}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: healthData?.totalUsers ?? "—", icon: Users },
          { label: "Total Events", value: healthData?.totalEvents ?? "—", icon: Activity },
          { label: "My Events", value: engagementData?.length ?? 0, icon: Eye },
          { label: "Time Spent", value: totalDuration > 0 ? `${Math.round(totalDuration / 60)}m` : "—", icon: Clock },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground" />
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
          <TabsTrigger value="events" className="gap-1"><Activity className="h-4 w-4" /> Event Log</TabsTrigger>
          <TabsTrigger value="features" className="gap-1"><TrendingUp className="h-4 w-4" /> Top Features</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Type Distribution</CardTitle>
                <CardDescription>Breakdown of engagement events by type</CardDescription>
              </CardHeader>
              <CardContent>
                {engagementQ.isLoading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : Object.keys(eventTypeCounts).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No events recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(eventTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => {
                      const total = engagementData?.length || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={type} className="flex items-center gap-3">
                          {EVENT_ICONS[type] || <Activity className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{type.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Platform Health</CardTitle>
                <CardDescription>Aggregate portal metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {healthQ.isLoading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : !healthData ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">Health metrics unavailable.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> <span className="text-sm">Total Active Users</span></div>
                      <span className="text-xl font-bold">{healthData.totalUsers ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> <span className="text-sm">Total Events</span></div>
                      <span className="text-xl font-bold">{healthData.totalEvents ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> <span className="text-sm">Events per User</span></div>
                      <span className="text-xl font-bold">
                        {healthData.totalUsers > 0 ? (healthData.totalEvents / healthData.totalUsers).toFixed(1) : "—"}
                      </span>
                    </div>
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
                      <TableCell className="text-sm">{e.featureName || e.pagePath || "—"}</TableCell>
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
                const pct = Math.round((f.count / maxCount) * 100);
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
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
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
