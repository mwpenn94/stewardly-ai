/**
 * ClientActivityTimeline.tsx — Unified client activity timeline
 *
 * Aggregates conversations, plan outcomes, data access events, and
 * association changes into a single chronological timeline view.
 * Part of the People Hub 4.0+ maturity push.
 */
import { useState, useMemo, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Activity, MessageSquare, FileText, Database,
  Users, Clock, TrendingUp, ChevronRight, Filter,
  BarChart3, Zap, Shield, CheckCircle2, Radio,
} from "lucide-react";
import { toast } from "sonner";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  conversation: <MessageSquare className="h-4 w-4 text-blue-400" />,
  plan_outcome: <FileText className="h-4 w-4 text-green-400" />,
  data_access: <Database className="h-4 w-4 text-purple-400" />,
  association: <Users className="h-4 w-4 text-orange-400" />,
};

const EVENT_COLORS: Record<string, string> = {
  conversation: "border-blue-400/30 bg-blue-400/5",
  plan_outcome: "border-green-400/30 bg-green-400/5",
  data_access: "border-purple-400/30 bg-purple-400/5",
  association: "border-orange-400/30 bg-orange-400/5",
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ClientActivityTimeline() {
  const { user } = useAuth();
  const [category, setCategory] = useState<"all" | "conversation" | "plan" | "data" | "association">("all");
  const [liveMode, setLiveMode] = useState(false);

  const utils = trpc.useUtils();

  const { data: timeline, isLoading: timelineLoading } = trpc.clientPortal.activityTimeline.useQuery(
    { category, limit: 100 },
    { enabled: !!user }
  );

  const { data: summary, isLoading: summaryLoading } = trpc.clientPortal.engagementSummary.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Real-time WebSocket channel for live activity events
  const { connected: wsConnected, lastUpdate, eventCount, data: liveEvent } = useRealtimeChannel<any>({
    channel: "activity:timeline",
    userId: user?.id,
    enabled: liveMode && !!user,
    onEvent: useCallback((event: any) => {
      if (event?.type === "connected") return; // Skip connection ack
      // Auto-refresh timeline when new events arrive
      utils.clientPortal.activityTimeline.invalidate();
      utils.clientPortal.engagementSummary.invalidate();
      if (event?.title) {
        toast.info(event.title, { description: event.description?.slice(0, 80) });
      }
    }, [utils]),
  });

  if (!user) {
    return (
      <AppShell>
        <SEOHead title="Activity Timeline" />
        <div className="container py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-blue-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Activity Timeline</h2>
          <p className="text-muted-foreground mb-6">Sign in to view your activity timeline.</p>
          <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Activity Timeline | People Hub" />
      <div className="container py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/people">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-400" />
              Activity Timeline
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Unified view of all client interactions, plans, and data access
            </p>
          </div>
          <Button
            variant={liveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
            className={liveMode ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Radio className={`h-4 w-4 mr-1 ${liveMode ? "animate-pulse" : ""}`} />
            Live
            {wsConnected && liveMode && (
              <span className="ml-1 h-2 w-2 rounded-full bg-green-300 animate-pulse" />
            )}
          </Button>
        </div>
        {liveMode && (
          <div className="text-xs text-muted-foreground mb-4 text-right">
            {wsConnected ? (
              <span className="text-green-400">Connected · {eventCount} updates{lastUpdate ? ` · Last: ${new Date(lastUpdate).toLocaleTimeString()}` : ""}</span>
            ) : (
              <span className="text-yellow-400">Connecting...</span>
            )}
          </div>
        )}

        {/* Engagement Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Conversations</span>
              </div>
              {summaryLoading ? <Skeleton className="h-7 w-12" /> : (
                <p className="text-xl font-bold">{summary?.totalConversations ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Plan Outcomes</span>
              </div>
              {summaryLoading ? <Skeleton className="h-7 w-12" /> : (
                <p className="text-xl font-bold">{summary?.totalPlans ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Data Queries</span>
              </div>
              {summaryLoading ? <Skeleton className="h-7 w-12" /> : (
                <p className="text-xl font-bold">{summary?.totalDataQueries ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-muted-foreground">Active Goals</span>
              </div>
              {summaryLoading ? <Skeleton className="h-7 w-12" /> : (
                <p className="text-xl font-bold">{summary?.activeGoals ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {(["all", "conversation", "plan", "data", "association"] as const).map(cat => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat)}
              className="shrink-0"
            >
              {cat === "all" ? "All" : cat.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
            </Button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          {timelineLoading ? (
            <div className="space-y-4 pl-12">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : timeline?.events && timeline.events.length > 0 ? (
            <div className="space-y-3">
              {timeline.events.map((event) => (
                <div key={event.id} className="relative flex gap-4 pl-2">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-background border-2 border-border shrink-0 mt-1">
                    {EVENT_ICONS[event.type] || <Activity className="h-3 w-3" />}
                  </div>

                  {/* Event card */}
                  <div className={`flex-1 p-3 rounded-lg border ${EVENT_COLORS[event.type] || "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{event.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {event.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>

                    {/* Metadata chips */}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(event.metadata).slice(0, 4).map(([key, val]) => (
                          val != null && (
                            <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                              {key}: {String(val)}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 pl-12">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No activity events yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation or run a calculator to see activity here.
              </p>
            </div>
          )}
        </div>

        {/* Total count */}
        {timeline?.total ? (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Showing {timeline.events.length} of {timeline.total} events
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
