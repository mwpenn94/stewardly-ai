/**
 * CRMSync — Unified Cross-Platform CRM Sync Dashboard
 *
 * Covers all 8 platforms: Wealthbox, Salesforce, Redtail, GoHighLevel,
 * Dripify, SMS-iT, Workable, LinkedIn/Sales Navigator
 *
 * Wired to:
 * - crm.sync mutation (real sync across all providers)
 * - crm.syncHistory query (crm_sync_log table)
 * - crm.providers query (aggregated provider status)
 * - crm.unifiedDashboard query (cross-platform unified view)
 * - crm.platformWebhookEvents query (per-platform webhook feed)
 */
import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, Database,
  ArrowLeftRight, Settings2, History, Loader2, Webhook, Activity,
  TrendingUp, Zap, Globe, Radio, XCircle, Inbox,
} from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const ALL_PROVIDERS = [
  { value: "gohighlevel", label: "GoHighLevel", icon: "🔷", category: "crm" },
  { value: "wealthbox", label: "Wealthbox", icon: "💼", category: "crm" },
  { value: "salesforce", label: "Salesforce", icon: "☁️", category: "crm" },
  { value: "redtail", label: "Redtail", icon: "🔴", category: "crm" },
  { value: "dripify", label: "Dripify", icon: "💧", category: "marketing" },
  { value: "smsit", label: "SMS-iT", icon: "📱", category: "messaging" },
  { value: "workable", label: "Workable", icon: "👥", category: "recruiting" },
  { value: "linkedin", label: "LinkedIn", icon: "🔗", category: "marketing" },
] as const;

type ProviderValue = typeof ALL_PROVIDERS[number]["value"];

function statusColor(status: string | null | undefined): string {
  if (!status) return "text-muted-foreground";
  const s = status.toLowerCase();
  if (s === "connected" || s === "success" || s === "completed" || s === "processed") return "text-emerald-400";
  if (s === "partial") return "text-amber-400";
  if (s === "failed" || s === "error" || s === "disconnected") return "text-red-400";
  if (s === "pending" || s === "running") return "text-blue-400";
  return "text-muted-foreground";
}

function statusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  const s = status.toLowerCase();
  const color = s === "success" || s === "completed" || s === "connected" || s === "processed"
    ? "text-emerald-400 border-emerald-500/30"
    : s === "failed" || s === "error" || s === "disconnected"
    ? "text-red-400 border-red-500/30"
    : s === "partial" || s === "pending"
    ? "text-amber-400 border-amber-500/30"
    : "text-blue-400 border-blue-500/30";
  return <Badge variant="outline" className={`text-xs ${color}`}>{status}</Badge>;
}

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function CRMSync({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, navigate] = useLocation();
  const [autoSync, setAutoSync] = useState(true);
  const [provider, setProvider] = useState<ProviderValue>("gohighlevel");
  const [direction, setDirection] = useState<"pull" | "push" | "bidirectional">("pull");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Unified dashboard data
  const unified = trpc.crm.unifiedDashboard.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30000,
  });

  const syncHistory = trpc.crm.syncHistory.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  const providers = trpc.crm.providers.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  // Per-platform webhook events
  const webhookEvents = trpc.crm.platformWebhookEvents.useQuery(
    { provider: selectedPlatform || "gohighlevel", limit: 50 },
    { enabled: isAuthenticated && isAdmin && !!selectedPlatform },
  );

  const syncMut = trpc.crm.sync.useMutation({
    onSuccess: (r) => {
      const contacts = r?.contactsSynced ?? 0;
      const activities = r?.activitiesSynced ?? 0;
      const errorCount = r?.errors?.length ?? 0;
      toast.success(
        `Sync completed — ${contacts} contact${contacts === 1 ? "" : "s"} + ` +
          `${activities} activit${activities === 1 ? "y" : "ies"}` +
          (errorCount > 0 ? `, ${errorCount} error${errorCount === 1 ? "" : "s"}` : ""),
      );
      utils.crm.syncHistory.invalidate();
      utils.crm.providers.invalidate();
      utils.crm.unifiedDashboard.invalidate();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const handleSync = () => {
    syncMut.mutate({ provider, direction });
  };

  // Derive data
  const historyRows = (syncHistory.data ?? []) as any[];
  const providerRows = (providers.data ?? []) as any[];
  const unifiedData = unified.data ?? { platforms: [], recentEvents: [], syncLogs: [] };

  // Build platform status map from unified data
  const platformMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of unifiedData.platforms as any[]) {
      map[p.provider] = p;
    }
    // Also merge from providers query for CRM-specific data
    for (const p of providerRows) {
      if (!map[p.provider]) {
        map[p.provider] = {
          provider: p.provider,
          providerName: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
          connectionStatus: p.lastStatus === "completed" ? "connected" : p.lastStatus,
          lastSyncAt: p.lastSync,
          lastSyncStatus: p.lastStatus,
          totalRecordsSynced: Number(p.totalSynced) || 0,
        };
      }
    }
    return map;
  }, [unifiedData.platforms, providerRows]);

  // Aggregate stats
  const totalRecords = useMemo(() => {
    return Object.values(platformMap).reduce((sum: number, p: any) => sum + (Number(p.totalRecordsSynced) || 0), 0);
  }, [platformMap]);

  const connectedCount = useMemo(() => {
    return Object.values(platformMap).filter((p: any) => p.connectionStatus === "connected").length;
  }, [platformMap]);

  const recentEvents = (unifiedData.recentEvents || []) as any[];
  const syncLogs = (unifiedData.syncLogs || []) as any[];

  return (
    <Shell title="CRM Sync">
    <div className="container max-w-6xl py-8 space-y-6">
      <SEOHead title="CRM Sync" description="Unified cross-platform CRM sync dashboard" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CRM Sync Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Unified sync management across {ALL_PROVIDERS.length} platforms
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v as ProviderValue)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.icon} {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pull">Pull</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="bidirectional">Both</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSync} disabled={syncMut.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMut.isPending ? "animate-spin" : ""}`} />
            {syncMut.isPending ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      <QueryErrorBanner query={syncHistory} label="sync history" />

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Globe className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connectedCount}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRecords.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Records Synced</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Webhook className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recentEvents.length}</p>
              <p className="text-xs text-muted-foreground">Recent Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Activity className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{syncLogs.length + historyRows.length}</p>
              <p className="text-xs text-muted-foreground">Sync Runs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Status Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4" /> Platform Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_PROVIDERS.map((prov) => {
            const info = platformMap[prov.value];
            const isConnected = info?.connectionStatus === "connected";
            const statusIcon = isConnected
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : info?.connectionStatus === "error" || info?.connectionStatus === "failed"
              ? <XCircle className="h-4 w-4 text-red-400" />
              : <Database className="h-4 w-4 text-muted-foreground" />;
            return (
              <Card
                key={prov.value}
                className={`cursor-pointer transition-all hover:border-primary/50 ${selectedPlatform === prov.value ? "border-primary ring-1 ring-primary/30" : ""}`}
                onClick={() => setSelectedPlatform(selectedPlatform === prov.value ? null : prov.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{prov.icon}</span>
                      <span className="text-sm font-medium">{prov.label}</span>
                    </div>
                    {statusIcon}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusBadge(info?.connectionStatus || "not configured")}
                    <Badge variant="outline" className="text-xs text-muted-foreground">{prov.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {info?.lastSyncAt ? `Last sync: ${timeAgo(info.lastSyncAt)}` : "No syncs recorded"}
                  </p>
                  <p className="text-lg font-bold mt-1">
                    {info ? `${Number(info.totalRecordsSynced || 0).toLocaleString()} records` : "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tabs: Webhook Feed, Sync History, Settings */}
      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1" /> Webhook Feed</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> Sync History</TabsTrigger>
          <TabsTrigger value="syncLogs"><Zap className="h-3.5 w-3.5 mr-1" /> Integration Logs</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Field Mappings</TabsTrigger>
        </TabsList>

        {/* Webhook Activity Feed */}
        <TabsContent value="webhooks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {selectedPlatform
                  ? `${ALL_PROVIDERS.find(p => p.value === selectedPlatform)?.label || selectedPlatform} Webhook Events`
                  : "All Platform Webhook Events"
                }
              </CardTitle>
              <CardDescription>
                {selectedPlatform
                  ? "Click a platform card above to filter, or click again to show all"
                  : "Showing recent events across all connected platforms"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unified.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (selectedPlatform ? (webhookEvents.data || []) : recentEvents).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No webhook events yet. Events will appear here when platforms send data.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(selectedPlatform ? (webhookEvents.data || []) : recentEvents).map((evt: any, i: number) => (
                    <div key={evt.id || i} className="flex items-center justify-between py-2 px-3 border-b border-border/50 last:border-0 rounded hover:bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-mono truncate">
                            {evt.eventType || evt.event_type || "unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {evt.provider && <span className="capitalize">{evt.provider} · </span>}
                            {evt.receivedAt ? timeAgo(evt.receivedAt) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(evt.status || (evt.isProcessed ? "processed" : "pending"))}
                        {evt.error && (
                          <span className="text-xs text-red-400 max-w-32 truncate" title={evt.error}>
                            {evt.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CRM Sync History (from crm_sync_log) */}
        <TabsContent value="history" className="mt-4">
          <div className="flex justify-end mb-2">
            <ExportDataButton
              data={historyRows}
              filename="crm-sync-history"
              columns={["crmProvider", "direction", "status", "recordsSynced", "createdAt"]}
            />
          </div>
          <Card>
            <CardContent className="p-4">
              {syncHistory.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sync history yet. Run your first sync to see results here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyRows.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between py-2 px-3 border-b border-border/50 last:border-0 rounded hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">
                            <span className="font-medium capitalize">{h.crmProvider}</span>
                            {" · "}{h.recordsSynced ?? 0} records · {h.direction}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
                          </p>
                        </div>
                      </div>
                      {statusBadge(h.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Sync Logs (from integration_sync_logs) */}
        <TabsContent value="syncLogs" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Integration Sync Logs
              </CardTitle>
              <CardDescription>Detailed sync operations from webhook and scheduled syncs</CardDescription>
            </CardHeader>
            <CardContent>
              {unified.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No integration sync logs yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {syncLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between py-2 px-3 border-b border-border/50 last:border-0 rounded hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{log.providerName || log.provider}</span>
                            {" · "}{log.syncType} · {log.direction}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.recordsCreated || 0} created · {log.recordsUpdated || 0} updated · {log.recordsFailed || 0} failed
                            {" · "}{log.triggeredBy}
                            {" · "}{log.startedAt ? timeAgo(log.startedAt) : "—"}
                          </p>
                        </div>
                      </div>
                      {statusBadge(log.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-sync</p>
                  <p className="text-xs text-muted-foreground">Automatically sync every 30 minutes</p>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Conflict Resolution</p>
                  <p className="text-xs text-muted-foreground">When records conflict between CRM and Stewardly</p>
                </div>
                <Badge variant="outline">CRM Wins</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sync Direction</p>
                  <p className="text-xs text-muted-foreground">Bidirectional sync keeps both systems updated</p>
                </div>
                <Badge variant="outline">Bidirectional</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Webhook Endpoints</p>
                  <p className="text-xs text-muted-foreground">Configure these URLs in your platform settings</p>
                </div>
                <Badge variant="outline">5 Active</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Webhook URLs Reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Webhook URLs</CardTitle>
              <CardDescription>Configure these endpoints in each platform's webhook settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { platform: "GoHighLevel", path: "/api/webhooks/ghl" },
                { platform: "Dripify", path: "/api/webhooks/dripify" },
                { platform: "SMS-iT", path: "/api/webhooks/smsit" },
                { platform: "Workable", path: "/api/webhooks/workable" },
                { platform: "LinkedIn", path: "/api/webhooks/linkedin" },
              ].map(({ platform, path }) => (
                <div key={path} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium">{platform}</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {window.location.origin}{path}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Field Mappings */}
        <TabsContent value="mappings" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {[
                  ["First Name", "first_name", "first_name"],
                  ["Last Name", "last_name", "last_name"],
                  ["Email", "email_address", "email"],
                  ["Phone", "phone_number", "phone"],
                  ["AUM", "custom_aum", "assets_under_management"],
                  ["Risk Profile", "custom_risk", "risk_tolerance"],
                  ["Company", "company", "organization"],
                  ["LinkedIn URL", "linkedin_url", "profileUrl"],
                  ["Source", "source", "lead_source"],
                  ["Status", "status", "pipeline_stage"],
                ].map(([label, stewardly, crm]) => (
                  <div key={label} className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                    <span className="w-32 text-muted-foreground">{label}</span>
                    <Badge variant="outline" className="text-xs font-mono">{stewardly}</Badge>
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs font-mono">{crm}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </Shell>
  );
}
