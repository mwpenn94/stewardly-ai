import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  RefreshCw, ArrowLeftRight, Bell, FileBarChart, AlertTriangle, Sparkles,
  Building2, Landmark, BarChart3, Users, FileText, Shield, TrendingUp,
  Calculator, Percent, CreditCard, FileCheck, Zap, MessageSquare,
  Briefcase, BookOpen, UserSearch, PenTool, Gauge, Umbrella,
  Power, PowerOff, Activity, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Settings2, History,
} from "lucide-react";

// Icon mapping for data sources
const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Landmark, BarChart3, Users, FileText, Shield, TrendingUp,
  Calculator, Percent, CreditCard, FileCheck, Zap, MessageSquare,
  Briefcase, BookOpen, UserSearch, PenTool, Gauge, Umbrella,
};

// Icon mapping for action types
const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  RefreshCw, ArrowLeftRight, Bell, FileBarChart, AlertTriangle, Sparkles,
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  auto_refresh: RefreshCw,
  background_sync: ArrowLeftRight,
  monitoring_alerts: Bell,
  scheduled_reports: FileBarChart,
  anomaly_detection: AlertTriangle,
  smart_enrichment: Sparkles,
};

const CATEGORY_LABELS: Record<string, string> = {
  government: "Government & Economic",
  market: "Market Data",
  personal: "Personal Financial",
  professional: "Professional Tools",
  crm: "CRM & Communications",
  insurance: "Insurance",
  investment: "Investment & Brokerage",
};

const CATEGORY_ORDER = ["government", "market", "investment", "personal", "insurance", "crm", "professional"];

export default function PassiveActions() {

  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("sources");

  const { data: sourceData } = trpc.passiveActions.dataSources.useQuery(undefined, { staleTime: 5 * 60_000 });
  const { data: preferences, refetch: refetchPrefs } = trpc.passiveActions.preferences.useQuery(undefined, { staleTime: 30_000 });
  const { data: stats, refetch: refetchStats } = trpc.passiveActions.stats.useQuery(undefined, { staleTime: 30_000 });
  const { data: history } = trpc.passiveActions.history.useQuery({ limit: 50 }, { staleTime: 30_000 });

  const toggleMutation = trpc.passiveActions.toggle.useMutation({
    onSuccess: () => { refetchPrefs(); refetchStats(); },
    onError: (err) => toast.error(err.message),
  });

  const bulkSourceMutation = trpc.passiveActions.bulkToggleSource.useMutation({
    onSuccess: (data) => {
      refetchPrefs(); refetchStats();
      toast.success(`${data.toggled} actions toggled for ${data.source}`);
    },
  });

  const bulkAllMutation = trpc.passiveActions.bulkToggleAll.useMutation({
    onSuccess: (data) => {
      refetchPrefs(); refetchStats();
      toast.success(`${data.totalActions} actions across ${data.totalSources} sources`);
    },
  });

  // Build a lookup map for preferences
  const prefMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (preferences) {
      for (const p of preferences) {
        map.set(`${p.source}:${p.actionType}`, p.enabled);
      }
    }
    return map;
  }, [preferences]);

  // Group sources by category
  const groupedSources = useMemo(() => {
    if (!sourceData) return {};
    const groups: Record<string, typeof sourceData.sources> = {};
    for (const src of sourceData.sources) {
      if (!groups[src.category]) groups[src.category] = [];
      groups[src.category].push(src);
    }
    return groups;
  }, [sourceData]);

  const toggleExpand = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActionEnabled = (source: string, action: string) => prefMap.get(`${source}:${action}`) ?? false;

  const getSourceEnabledCount = (sourceId: string, supportedActions: string[]) => {
    return supportedActions.filter((a) => isActionEnabled(sourceId, a)).length;
  };

  return (
    <AppShell title="Passive Actions">
      <SEOHead title="Passive Actions" description="Automated passive actions and scheduled tasks" />
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passive Actions</h1>
          <p className="text-muted-foreground mt-1">
            Enable automated background operations for your connected data sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkAllMutation.mutate({ enabled: true })}
            disabled={bulkAllMutation.isPending}
          >
            <Power className="h-4 w-4 mr-1" />
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkAllMutation.mutate({ enabled: false })}
            disabled={bulkAllMutation.isPending}
          >
            <PowerOff className="h-4 w-4 mr-1" />
            Disable All
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.enabled}</p>
              <p className="text-xs text-muted-foreground">{stats.coverage}% coverage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Available</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.totalPossible}</p>
              <p className="text-xs text-muted-foreground">across {sourceData?.sources.length || 0} sources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Successes</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.recentSuccesses}</p>
              <p className="text-xs text-muted-foreground">recent executions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Last Run</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {stats.lastExecution
                  ? new Date(stats.lastExecution).toLocaleTimeString()
                  : "Never"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.recentFailures > 0 ? `${stats.recentFailures} failures` : "No failures"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="actions">By Action Type</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-6 mt-4">
          {CATEGORY_ORDER.map((category) => {
            const sources = groupedSources[category];
            if (!sources || sources.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <div className="space-y-2">
                  {sources.map((source) => {
                    const IconComp = ICON_MAP[source.icon] || Building2;
                    const enabledCount = getSourceEnabledCount(source.id, source.supportedActions);
                    const isExpanded = expandedSources.has(source.id);
                    const allEnabled = enabledCount === source.supportedActions.length;
                    const someEnabled = enabledCount > 0 && !allEnabled;

                    return (
                      <Card key={source.id} className={`transition-all ${enabledCount > 0 ? "border-emerald-500/30" : ""}`}>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg ${enabledCount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                <IconComp className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-sm font-medium">{source.name}</CardTitle>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {source.tier}
                                  </Badge>
                                  {enabledCount > 0 && (
                                    <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-500">
                                      {enabledCount}/{source.supportedActions.length} active
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-xs mt-0.5 truncate">
                                  {source.description}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => bulkSourceMutation.mutate({
                                        source: source.id,
                                        enabled: !allEnabled,
                                      })}
                                      disabled={bulkSourceMutation.isPending}
                                    >
                                      {allEnabled ? (
                                        <><PowerOff className="h-3 w-3 mr-1" /> All Off</>
                                      ) : (
                                        <><Power className="h-3 w-3 mr-1" /> All On</>
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {allEnabled ? "Disable all actions" : "Enable all actions"} for {source.name}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                                onClick={() => toggleExpand(source.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="pt-0 pb-3 px-4">
                            <div className="border-t pt-3 space-y-2">
                              {source.supportedActions.map((action) => {
                                const ActionIcon = ACTION_ICONS[action] || RefreshCw;
                                const meta = sourceData?.actionTypes[action];
                                const enabled = isActionEnabled(source.id, action);
                                return (
                                  <div
                                    key={action}
                                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <ActionIcon className={`h-4 w-4 ${enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
                                      <div>
                                        <p className="text-sm font-medium">{meta?.label || action}</p>
                                        <p className="text-xs text-muted-foreground">{meta?.description || ""}</p>
                                      </div>
                                    </div>
                                    <Switch
                                      checked={enabled}
                                      onCheckedChange={(checked) =>
                                        toggleMutation.mutate({
                                          source: source.id,
                                          actionType: action as any,
                                          enabled: checked,
                                        })
                                      }
                                      disabled={toggleMutation.isPending}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* By Action Type Tab */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          {sourceData && Object.entries(sourceData.actionTypes).map(([actionKey, meta]) => {
            const ActionIcon = ACTION_ICONS[actionKey] || RefreshCw;
            const supportingSources = sourceData.sources.filter((s) =>
              s.supportedActions.includes(actionKey as any)
            );
            const enabledForAction = supportingSources.filter((s) =>
              isActionEnabled(s.id, actionKey)
            );

            return (
              <Card key={actionKey}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${enabledForAction.length > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        <ActionIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">{meta.label}</CardTitle>
                        <CardDescription className="text-xs">{meta.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={enabledForAction.length > 0 ? "default" : "secondary"}>
                      {enabledForAction.length}/{supportingSources.length} sources
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {supportingSources.map((source) => {
                      const SrcIcon = ICON_MAP[source.icon] || Building2;
                      const enabled = isActionEnabled(source.id, actionKey);
                      return (
                        <div
                          key={source.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <SrcIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate">{source.name}</span>
                          </div>
                          <Switch
                            checked={enabled}
                            className="scale-75"
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                source: source.id,
                                actionType: actionKey as any,
                                enabled: checked,
                              })
                            }
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Executions
              </CardTitle>
              <CardDescription>
                Background action execution log
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!history || history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No executions yet</p>
                  <p className="text-xs mt-1">Enable some passive actions to see execution history here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md border text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {entry.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : entry.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <Activity className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{entry.source} — {entry.actionType.replace(/_/g, " ")}</p>
                          {entry.resultSummary && (
                            <p className="text-xs text-muted-foreground">{entry.resultSummary}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(entry.executedAt).toLocaleString()}</p>
                        {entry.durationMs && <p>{entry.durationMs}ms</p>}
                      </div>
                    </div>
                  ))}
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
