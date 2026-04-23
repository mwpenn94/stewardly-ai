/**
 * DataEngineDashboard.tsx — Data Engine analytics and monitoring dashboard
 *
 * Features:
 * - Cache hit/miss analytics with visual gauges
 * - Adapter health status overview
 * - Rate limit usage monitoring
 * - Data freshness indicators
 * - Cache invalidation controls
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database, ArrowLeft, Activity, Zap, Shield,
  RefreshCw, Trash2, CheckCircle2, AlertTriangle,
  XCircle, Clock, BarChart3, HardDrive, Gauge,
  Server, Wifi, WifiOff, Radio,
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    healthy: { color: "text-green-400", icon: <CheckCircle2 className="h-3 w-3" /> },
    degraded: { color: "text-yellow-400", icon: <AlertTriangle className="h-3 w-3" /> },
    not_configured: { color: "text-muted-foreground", icon: <WifiOff className="h-3 w-3" /> },
    offline: { color: "text-red-400", icon: <XCircle className="h-3 w-3" /> },
  };
  const v = variants[status] || variants.offline;
  return (
    <span className={`flex items-center gap-1 text-xs ${v.color}`}>
      {v.icon} {status.replace("_", " ")}
    </span>
  );
}

function HitRateGauge({ rate, label }: { rate: number; label: string }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            className={color}
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>
          {pct}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function DataEngineDashboard() {
  const { user } = useAuth();
  const [liveMode, setLiveMode] = useState(false);

  const { data: cacheData, isLoading: cacheLoading, refetch: refetchCache } = trpc.financialData.cacheStats.useQuery(undefined, { enabled: !!user });
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = trpc.financialData.adapterHealth.useQuery();
  const { data: rateData, isLoading: rateLoading } = trpc.financialData.rateLimitStats.useQuery(undefined, { enabled: !!user });
  const { data: freshnessData, isLoading: freshnessLoading } = trpc.financialData.dataFreshness.useQuery(undefined, { enabled: !!user });

  // Real-time WebSocket channel for live cache stats
  const { data: liveCacheStats, connected: wsConnected, lastUpdate, eventCount } = useRealtimeChannel<any>({
    channel: "dataEngine:cacheStats",
    userId: user?.id,
    enabled: liveMode && !!user,
    onEvent: useCallback(() => {
      // Auto-refresh tRPC queries when live data arrives
      refetchCache();
      refetchHealth();
    }, [refetchCache, refetchHealth]),
  });

  const invalidateMut = trpc.financialData.invalidateCache.useMutation({
    onSuccess: (result) => {
      toast.success(`Invalidated ${result.invalidated} cache entries (${result.scope})`);
      refetchCache();
    },
    onError: () => toast.error("Failed to invalidate cache"),
  });

  if (!user) {
    return (
      <AppShell>
        <SEOHead title="Data Engine | Dashboard" />
        <div className="container py-12 text-center">
          <Database className="h-12 w-12 mx-auto text-blue-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Data Engine Dashboard</h2>
          <p className="text-muted-foreground mb-6">Sign in to monitor data engine performance.</p>
          <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Data Engine | Dashboard" />
      <div className="container py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/integration-health">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-400" />
              Data Engine Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Cache analytics, adapter health, and rate limit monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={liveMode ? "default" : "outline"}
              size="sm"
              onClick={() => setLiveMode(!liveMode)}
              className={liveMode ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Radio className={`h-4 w-4 mr-1 ${liveMode ? "animate-pulse" : ""}`} />
              {liveMode ? "Live" : "Live"}
              {wsConnected && liveMode && (
                <span className="ml-1 h-2 w-2 rounded-full bg-green-300 animate-pulse" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchCache(); refetchHealth(); }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
          {liveMode && (
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {wsConnected ? (
                <span className="text-green-400">Connected · {eventCount} updates{lastUpdate ? ` · Last: ${new Date(lastUpdate).toLocaleTimeString()}` : ""}</span>
              ) : (
                <span className="text-yellow-400">Connecting...</span>
              )}
            </div>
          )}
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">Cache Entries</span>
              </div>
              {cacheLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-bold">{cacheData?.combined?.totalEntries ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Cache Hits</span>
              </div>
              {cacheLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-bold text-green-400">{cacheData?.combined?.totalHits ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-muted-foreground">Cache Misses</span>
              </div>
              {cacheLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-bold text-yellow-400">{cacheData?.combined?.totalMisses ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-teal-400" />
                <span className="text-sm text-muted-foreground">Adapters</span>
              </div>
              {healthLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-bold">
                  {healthData?.summary?.healthy ?? 0}
                  <span className="text-sm text-muted-foreground font-normal">/{healthData?.summary?.total ?? 0}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cache">
          <TabsList>
            <TabsTrigger value="cache"><Gauge className="h-4 w-4 mr-1" /> Cache</TabsTrigger>
            <TabsTrigger value="adapters"><Server className="h-4 w-4 mr-1" /> Adapters</TabsTrigger>
            <TabsTrigger value="rates"><Activity className="h-4 w-4 mr-1" /> Rate Limits</TabsTrigger>
            <TabsTrigger value="freshness"><Clock className="h-4 w-4 mr-1" /> Freshness</TabsTrigger>
          </TabsList>

          {/* Cache Tab */}
          <TabsContent value="cache" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cache Performance</CardTitle>
                  <CardDescription>Hit rate and efficiency metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {cacheLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : (
                    <div className="flex justify-around py-4">
                      <HitRateGauge rate={cacheData?.combined?.hitRate ?? 0} label="Hit Rate" />
                      <div className="text-center">
                        <p className="text-3xl font-bold text-blue-400">{cacheData?.combined?.staleHits ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">Stale Hits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-orange-400">{cacheData?.combined?.evictions ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">Evictions</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Cache Controls</CardTitle>
                      <CardDescription>Manage cached data</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => invalidateMut.mutate({})}
                    disabled={invalidateMut.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-red-400" />
                    Clear All Cache
                  </Button>
                  {["fred", "bls", "bea", "treasury", "edgar"].map(id => (
                    <Button
                      key={id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => invalidateMut.mutate({ adapterId: id })}
                      disabled={invalidateMut.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Invalidate {id.toUpperCase()} cache
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Adapters Tab */}
          <TabsContent value="adapters" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Adapter Health Status</CardTitle>
                <CardDescription>Real-time status of all financial data adapters</CardDescription>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(healthData?.adapters ?? []).map((adapter: any) => (
                      <div key={adapter.adapterId} className="flex items-center gap-4 p-3 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{adapter.name}</span>
                            <Badge variant="outline" className="text-xs">{adapter.tier}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Last checked: {adapter.lastChecked ? new Date(adapter.lastChecked).toLocaleTimeString() : "Never"}
                          </p>
                        </div>
                        <StatusBadge status={adapter.status} />
                        <div className="flex items-center gap-1">
                          {adapter.keyConfigured ? (
                            <Shield className="h-4 w-4 text-green-400" />
                          ) : (
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Limits Tab */}
          <TabsContent value="rates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>API Rate Limit Usage</CardTitle>
                <CardDescription>Current usage against rate limit quotas</CardDescription>
              </CardHeader>
              <CardContent>
                {rateLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : rateData && typeof rateData === "object" ? (
                  <div className="space-y-4">
                    {Object.entries(rateData).map(([adapterId, stats]: [string, any]) => {
                      const usagePct = stats.limit > 0 ? (stats.used / stats.limit) * 100 : 0;
                      return (
                        <div key={adapterId} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{adapterId.toUpperCase()}</span>
                            <span className="text-muted-foreground">
                              {stats.used ?? 0} / {stats.limit ?? "∞"} calls
                            </span>
                          </div>
                          <Progress value={Math.min(usagePct, 100)} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            Resets: {stats.resetAt ? new Date(stats.resetAt).toLocaleString() : "N/A"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No rate limit data available yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Freshness Tab */}
          <TabsContent value="freshness" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Freshness</CardTitle>
                <CardDescription>How current your cached data is</CardDescription>
              </CardHeader>
              <CardContent>
                {freshnessLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(freshnessData?.adapters ?? []).map((adapter: any) => (
                      <div key={adapter.id} className="flex items-center gap-4 p-3 rounded-lg border">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{adapter.name}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Tier: {adapter.tier} | Key: {adapter.keyConfigured ? "Configured" : "Not set"}
                          </p>
                        </div>
                        <StatusBadge status={adapter.status} />
                        <span className="text-xs text-muted-foreground">
                          {adapter.lastChecked
                            ? `${Math.round((Date.now() - adapter.lastChecked) / 60000)}m ago`
                            : "Never checked"}
                        </span>
                      </div>
                    ))}
                    {freshnessData?.cache && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2">Cache Summary</p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold">{freshnessData.cache.size}</p>
                            <p className="text-xs text-muted-foreground">Cached Responses</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-400">{freshnessData.cache.hits}</p>
                            <p className="text-xs text-muted-foreground">Total Hits</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{Math.round(freshnessData.cache.hitRate * 100)}%</p>
                            <p className="text-xs text-muted-foreground">Hit Rate</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
