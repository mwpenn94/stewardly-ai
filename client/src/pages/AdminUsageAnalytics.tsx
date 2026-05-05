/**
 * Admin Usage Analytics Dashboard — Pass 11
 *
 * Aggregates platform engagement metrics:
 * - Overview KPIs (users, conversations, messages, model runs)
 * - Chat volume over time (line chart)
 * - Conversation mode distribution (donut)
 * - User engagement trend (DAU)
 * - Feature adoption (bar chart)
 * - Top users leaderboard
 * - Feedback summary
 * - Meeting stats
 * - Notification workflow stats
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, MessageSquare, Bot, Activity, TrendingUp, BarChart3,
  ThumbsUp, ThumbsDown, Calendar, Bell, Zap, RefreshCw, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props { embedded?: boolean; }

// ─── Sparkline Mini Chart ───────────────────────────────────────────────────
function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 120, h = 32;
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block ml-2 opacity-70">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string | number; icon: React.ElementType;
  trend?: string; color?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/30">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <Icon className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <div className="text-2xl font-bold" style={{ color: color || "var(--foreground)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {trend && <span className="text-xs text-muted-foreground">{trend}</span>}
      </CardContent>
    </Card>
  );
}

// ─── Bar Chart (simple) ─────────────────────────────────────────────────────
function SimpleBarChart({ data, labelKey, valueKey, maxBars = 10 }: {
  data: Record<string, any>[]; labelKey: string; valueKey: string; maxBars?: number;
}) {
  const items = data.slice(0, maxBars);
  const max = Math.max(...items.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-muted-foreground">{String(item[labelKey]).replace(/_/g, " ")}</span>
            <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-muted-foreground">{val}</span>
          </div>
        );
      })}
      {data.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-4">No data yet</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AdminUsageAnalytics({ embedded }: Props) {
  const [days, setDays] = useState(30);

  const overview = trpc.usageAnalytics.overview.useQuery();
  const chatVolume = trpc.usageAnalytics.chatVolume.useQuery({ days });
  const modeDistribution = trpc.usageAnalytics.modeDistribution.useQuery();
  const engagementTrend = trpc.usageAnalytics.engagementTrend.useQuery({ days });
  const featureAdoption = trpc.usageAnalytics.featureAdoption.useQuery({ days });
  const feedbackSummary = trpc.usageAnalytics.feedbackSummary.useQuery({ days });
  const meetingStats = trpc.usageAnalytics.meetingStats.useQuery({ days });
  const topUsers = trpc.usageAnalytics.topUsers.useQuery({ limit: 10 });
  const roleDistribution = trpc.usageAnalytics.roleDistribution.useQuery();

  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.usageAnalytics.overview.invalidate(),
      utils.usageAnalytics.chatVolume.invalidate(),
      utils.usageAnalytics.modeDistribution.invalidate(),
      utils.usageAnalytics.engagementTrend.invalidate(),
      utils.usageAnalytics.featureAdoption.invalidate(),
      utils.usageAnalytics.feedbackSummary.invalidate(),
      utils.usageAnalytics.meetingStats.invalidate(),
      utils.usageAnalytics.topUsers.invalidate(),
      utils.usageAnalytics.roleDistribution.invalidate(),
    ]);
    setRefreshing(false);
  };

  // Aggregate chat volume for sparkline
  const chatSparkline = useMemo(() => {
    if (!chatVolume.data) return [];
    const byDate = new Map<string, number>();
    for (const row of chatVolume.data) {
      byDate.set(row.date, (byDate.get(row.date) || 0) + row.count);
    }
    return Array.from(byDate.values());
  }, [chatVolume.data]);

  // Engagement sparkline
  const engagementSparkline = useMemo(() => {
    if (!engagementTrend.data) return [];
    return engagementTrend.data.map(r => r.activeUsers);
  }, [engagementTrend.data]);

  const o = overview.data;
  const fb = feedbackSummary.data;

  const Wrapper = embedded ? "div" : ScrollArea;

  return (
    <Wrapper className={embedded ? "p-0" : "h-full"}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Usage Analytics
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform engagement metrics and adoption tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* KPI Grid */}
        {overview.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Total Users" value={o?.totalUsers ?? 0} icon={Users} trend={`${o?.activeUsersToday ?? 0} active today`} />
            <KPICard label="Active (7d)" value={o?.activeUsersWeek ?? 0} icon={Activity} color="oklch(0.75 0.18 145)" />
            <KPICard label="Conversations" value={o?.totalConversations ?? 0} icon={MessageSquare} trend={<Sparkline data={chatSparkline} /> as any} />
            <KPICard label="Messages" value={o?.totalMessages ?? 0} icon={MessageSquare} trend={`~${o?.avgMessagesPerConversation ?? 0}/conv`} />
            <KPICard label="Model Runs" value={o?.totalModelRuns ?? 0} icon={Bot} />
            <KPICard label="Active (30d)" value={o?.activeUsersMonth ?? 0} icon={TrendingUp} />
            <KPICard label="WS Connections" value={o?.wsConnections ?? 0} icon={Zap} color="oklch(0.75 0.15 60)" />
            <KPICard label="Workflow Rules" value={o?.workflowRules ?? 0} icon={Bell} />
          </div>
        )}

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Engagement Trend */}
          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
              <CardDescription className="text-xs">Unique users sending messages per day</CardDescription>
            </CardHeader>
            <CardContent>
              {engagementTrend.isLoading ? (
                <Skeleton className="h-40" />
              ) : engagementTrend.data?.length ? (
                <div className="space-y-1">
                  {engagementTrend.data.slice(-14).map((row, i) => {
                    const max = Math.max(...(engagementTrend.data?.slice(-14).map(r => r.activeUsers) || [1]));
                    const pct = (row.activeUsers / Math.max(max, 1)) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-muted-foreground font-mono">{row.date.slice(5)}</span>
                        <div className="flex-1 h-3 bg-muted/20 rounded overflow-hidden">
                          <div className="h-full bg-primary/50 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right font-mono text-muted-foreground">{row.activeUsers}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 text-center py-8">No engagement data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Mode Distribution */}
          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Conversation Modes</CardTitle>
              <CardDescription className="text-xs">Distribution of chat mode usage</CardDescription>
            </CardHeader>
            <CardContent>
              {modeDistribution.isLoading ? (
                <Skeleton className="h-40" />
              ) : modeDistribution.data?.length ? (
                <div className="space-y-3 pt-2">
                  {(() => {
                    const total = modeDistribution.data.reduce((s, r) => s + r.count, 0);
                    const colors: Record<string, string> = {
                      client: "bg-blue-500/60", coach: "bg-emerald-500/60", manager: "bg-violet-500/60",
                    };
                    return modeDistribution.data.map((row, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize font-medium">{row.mode}</span>
                          <span className="text-muted-foreground">{row.count} ({Math.round(row.count / Math.max(total, 1) * 100)}%)</span>
                        </div>
                        <div className="h-3 bg-muted/20 rounded overflow-hidden">
                          <div className={`h-full rounded ${colors[row.mode] || "bg-primary/50"}`}
                            style={{ width: `${(row.count / Math.max(total, 1)) * 100}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 text-center py-8">No mode data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feature Adoption + Top Users */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Feature Adoption</CardTitle>
              <CardDescription className="text-xs">Most-used features (from audit trail)</CardDescription>
            </CardHeader>
            <CardContent>
              {featureAdoption.isLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <SimpleBarChart data={featureAdoption.data || []} labelKey="action" valueKey="count" maxBars={8} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Users</CardTitle>
              <CardDescription className="text-xs">Most active by message count</CardDescription>
            </CardHeader>
            <CardContent>
              {topUsers.isLoading ? (
                <Skeleton className="h-40" />
              ) : topUsers.data?.length ? (
                <div className="space-y-1.5">
                  {topUsers.data.map((user, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-muted-foreground/50 font-mono">#{i + 1}</span>
                      <span className="flex-1 truncate">{user.userName || `User ${user.userId}`}</span>
                      <Badge variant="secondary" className="text-[10px]">{user.messageCount} msgs</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 text-center py-8">No user data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feedback + Meetings + Roles */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" /> Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feedbackSummary.isLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-emerald-400">{fb?.rate ?? 0}%</span>
                    <span className="text-xs text-muted-foreground">satisfaction rate</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400"><ThumbsUp className="w-3 h-3" />{fb?.positive ?? 0}</span>
                    <span className="flex items-center gap-1 text-red-400"><ThumbsDown className="w-3 h-3" />{fb?.negative ?? 0}</span>
                    <span className="text-muted-foreground">{fb?.total ?? 0} total</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetingStats.isLoading ? (
                <Skeleton className="h-20" />
              ) : meetingStats.data?.length ? (
                <div className="space-y-1.5">
                  {meetingStats.data.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-[10px] capitalize">{row.status}</Badge>
                      <span className="font-mono">{row.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 text-center py-4">No meetings yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roleDistribution.isLoading ? (
                <Skeleton className="h-20" />
              ) : roleDistribution.data?.length ? (
                <div className="space-y-1.5">
                  {roleDistribution.data.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-[10px] capitalize">{row.role}</Badge>
                      <span className="font-mono">{row.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 text-center py-4">No role data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Wrapper>
  );
}
