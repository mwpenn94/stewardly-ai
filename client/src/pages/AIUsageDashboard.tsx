import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Zap, DollarSign, Clock, Activity, TrendingUp,
  BarChart3, Shield, CheckCircle, AlertTriangle, RefreshCw,
} from "lucide-react";

/* ─── Helpers ─── */
function fmt$(n: number) { return `$${n.toFixed(4)}`; }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n); }
function fmtMs(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`; }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function AIUsageDashboard() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: costSummary, isLoading: costLoading, refetch: refetchCost } = trpc.intelligenceEngine.costSummary.useQuery(
    { sinceDaysAgo: parseInt(timeRange) }
  );
  const { data: requests, isLoading: reqLoading } = trpc.intelligenceEngine.recentRequests.useQuery({ limit: 50 });
  const { data: health } = trpc.intelligenceEngine.health.useQuery();
  const { data: rateLimit } = trpc.intelligenceEngine.rateLimitStatus.useQuery();
  const { data: prompts } = trpc.intelligenceEngine.listPrompts.useQuery();

  const topModels = useMemo(() => {
    if (!costSummary?.byModel) return [];
    return Object.entries(costSummary.byModel)
      .sort(([, a], [, b]) => b.costUsd - a.costUsd)
      .slice(0, 5);
  }, [costSummary]);

  const topOperations = useMemo(() => {
    if (!costSummary?.byOperation) return [];
    return Object.entries(costSummary.byOperation)
      .sort(([, a], [, b]) => b.requests - a.requests)
      .slice(0, 8);
  }, [costSummary]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-400" />
            Intelligence Engine
          </h2>
          <p className="text-muted-foreground mt-1">
            AI usage analytics, cost tracking, and operational health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchCost()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Engine Health Banner */}
      {health && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500 text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                {health.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                v{health.version} · {health.consolidatedRouters} routers → {health.logicalGroupings} logical groups
              </span>
            </div>
            <div className="flex items-center gap-2">
              {health.features.map(f => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" /> Estimated Cost
            </div>
            <p className="text-2xl font-bold mt-1">
              {costLoading ? "..." : fmt$(costSummary?.totalCostUsd ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {costSummary?.totalRequests ?? 0} requests
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" /> Tokens Used
            </div>
            <p className="text-2xl font-bold mt-1">
              {costLoading ? "..." : fmtK((costSummary?.totalInputTokens ?? 0) + (costSummary?.totalOutputTokens ?? 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              In: {fmtK(costSummary?.totalInputTokens ?? 0)} · Out: {fmtK(costSummary?.totalOutputTokens ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" /> Avg Latency
            </div>
            <p className="text-2xl font-bold mt-1">
              {costLoading ? "..." : fmtMs(costSummary?.avgDurationMs ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shield className="h-4 w-4" /> Success Rate
            </div>
            <p className="text-2xl font-bold mt-1">
              {costLoading ? "..." : pct(costSummary?.successRate ?? 1)}
            </p>
            {rateLimit && (
              <p className="text-xs text-muted-foreground mt-1">
                Rate limit: {rateLimit.allowed ? (
                  <span className="text-green-400">Available</span>
                ) : (
                  <span className="text-red-400">Limited</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="models">
        <TabsList>
          <TabsTrigger value="models"><BarChart3 className="h-4 w-4 mr-1" /> By Model</TabsTrigger>
          <TabsTrigger value="operations"><Activity className="h-4 w-4 mr-1" /> By Operation</TabsTrigger>
          <TabsTrigger value="daily"><TrendingUp className="h-4 w-4 mr-1" /> Daily Trend</TabsTrigger>
          <TabsTrigger value="requests"><Zap className="h-4 w-4 mr-1" /> Recent Requests</TabsTrigger>
          <TabsTrigger value="prompts"><Brain className="h-4 w-4 mr-1" /> Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Model</CardTitle>
              <CardDescription>Breakdown of AI spending by model family</CardDescription>
            </CardHeader>
            <CardContent>
              {topModels.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No AI usage data yet. Start using AI features to see analytics.</p>
              ) : (
                <div className="space-y-3">
                  {topModels.map(([model, data]) => {
                    const maxCost = topModels[0]?.[1]?.costUsd || 1;
                    return (
                      <div key={model} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{model}</span>
                          <span className="text-muted-foreground">
                            {data.requests} req · {fmtK(data.tokens)} tokens · {fmt$(data.costUsd)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${(data.costUsd / maxCost) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Operation</CardTitle>
              <CardDescription>Which AI operations are used most frequently</CardDescription>
            </CardHeader>
            <CardContent>
              {topOperations.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No operation data yet.</p>
              ) : (
                <div className="space-y-3">
                  {topOperations.map(([op, data]) => {
                    const maxReq = topOperations[0]?.[1]?.requests || 1;
                    return (
                      <div key={op} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{op}</span>
                          <span className="text-muted-foreground">
                            {data.requests} requests · {fmt$(data.costUsd)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(data.requests / maxReq) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
              <CardDescription>AI spending over time</CardDescription>
            </CardHeader>
            <CardContent>
              {!costSummary?.dailyCosts?.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No daily data yet.</p>
              ) : (
                <div className="space-y-1">
                  {costSummary.dailyCosts.slice(-14).map(day => {
                    const maxCost = Math.max(...costSummary.dailyCosts.map(d => d.costUsd), 0.001);
                    return (
                      <div key={day.date} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-muted-foreground font-mono">{day.date.slice(5)}</span>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded transition-all"
                            style={{ width: `${(day.costUsd / maxCost) * 100}%` }}
                          />
                        </div>
                        <span className="w-20 text-right">{fmt$(day.costUsd)}</span>
                        <span className="w-16 text-right text-muted-foreground">{day.requests} req</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent AI Requests</CardTitle>
              <CardDescription>Last 50 AI operations with status and timing</CardDescription>
            </CardHeader>
            <CardContent>
              {reqLoading ? (
                <p className="text-muted-foreground text-sm py-4">Loading...</p>
              ) : !requests?.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No recent requests.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {requests.map(req => (
                    <div key={req.id} className="flex items-center gap-3 py-2 border-b border-border/50 text-sm">
                      {req.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      ) : req.status === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin shrink-0" />
                      )}
                      <span className="font-medium w-32 truncate">{req.operation}</span>
                      <Badge variant="outline" className="text-xs">{req.model}</Badge>
                      <span className="text-muted-foreground flex-1 truncate">
                        {req.inputPreview || "—"}
                      </span>
                      <span className="text-muted-foreground w-16 text-right">
                        {req.endTime ? fmtMs(req.endTime - req.startTime) : "..."}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Registry</CardTitle>
              <CardDescription>Versioned prompt templates for AI operations</CardDescription>
            </CardHeader>
            <CardContent>
              {!prompts?.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No registered prompts yet. Prompts are registered as AI features are used.</p>
              ) : (
                <div className="space-y-2">
                  {prompts.map(p => (
                    <div key={p.name} className="flex items-center gap-3 py-2 border-b border-border/50 text-sm">
                      <Brain className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="font-medium flex-1">{p.name}</span>
                      <Badge variant="secondary">v{p.activeVersion}</Badge>
                      <span className="text-muted-foreground text-xs">{p.totalVersions} versions</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
