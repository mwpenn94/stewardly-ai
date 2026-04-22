/**
 * CRMSync — Unified Cross-Platform CRM Sync Dashboard
 *
 * Covers all 8 platforms: Wealthbox, Salesforce, Redtail, GoHighLevel,
 * Dripify, SMS-iT, Workable, LinkedIn/Sales Navigator
 *
 * Wired to:
 * - crm.sync mutation (real sync across all providers — pull/push/bidirectional)
 * - crm.triggerOutboundSync mutation (push leads to external CRMs)
 * - crm.outboundSyncPreview query (preview leads eligible for push)
 * - crm.registerWebhooks mutation (auto-register webhook URLs)
 * - crm.webhookStatus query (webhook registration status per platform)
 * - crm.syncHistory query (crm_sync_log table)
 * - crm.providers query (aggregated provider status)
 * - crm.unifiedDashboard query (cross-platform unified view)
 * - crm.platformWebhookEvents query (per-platform webhook feed)
 */
import { useState, useMemo, useCallback } from "react";
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
  TrendingUp, Zap, Globe, Radio, XCircle, Inbox, Upload, Download,
  ArrowUpRight, Copy, CheckCheck, Link2,
} from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const ALL_PROVIDERS = [
  { value: "gohighlevel", label: "GoHighLevel", icon: "🔷", category: "crm", pushable: true },
  { value: "wealthbox", label: "Wealthbox", icon: "💼", category: "crm", pushable: true },
  { value: "salesforce", label: "Salesforce", icon: "☁️", category: "crm", pushable: true },
  { value: "redtail", label: "Redtail", icon: "🔴", category: "crm", pushable: true },
  { value: "dripify", label: "Dripify", icon: "💧", category: "marketing", pushable: false },
  { value: "smsit", label: "SMS-iT", icon: "📱", category: "messaging", pushable: true },
  { value: "workable", label: "Workable", icon: "👥", category: "recruiting", pushable: true },
  { value: "linkedin", label: "LinkedIn", icon: "🔗", category: "marketing", pushable: false },
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
  const color = s === "success" || s === "completed" || s === "connected" || s === "processed" || s === "registered"
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
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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

  // Outbound sync preview
  const outboundPreview = trpc.crm.outboundSyncPreview.useQuery(
    { provider },
    { enabled: isAuthenticated && isAdmin },
  );

  // Mutations
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
      utils.crm.outboundSyncPreview.invalidate();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const outboundSyncMut = trpc.crm.triggerOutboundSync.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Outbound sync to ${r.provider}: ${r.contactsCreated} created, ${r.contactsUpdated} updated` +
          (r.errors.length > 0 ? `, ${r.errors.length} errors` : ""),
      );
      utils.crm.syncHistory.invalidate();
      utils.crm.providers.invalidate();
      utils.crm.unifiedDashboard.invalidate();
      utils.crm.outboundSyncPreview.invalidate();
    },
    onError: (e) => toast.error(`Outbound sync failed: ${e.message}`),
  });

  const registerWebhookMut = trpc.crm.registerWebhooks.useMutation({
    onSuccess: (r) => {
      if (r.registered) {
        toast.success(`Webhook registered for ${r.provider}`);
      } else {
        toast.info(r.message || "Webhook registration attempted");
      }
    },
    onError: (e) => toast.error(`Webhook registration failed: ${e.message}`),
  });

  const handleSync = () => {
    syncMut.mutate({ provider, direction });
  };

  const handleOutboundSync = (prov: ProviderValue) => {
    outboundSyncMut.mutate({ provider: prov });
  };

  const handleRegisterWebhook = (prov: string) => {
    registerWebhookMut.mutate({
      provider: prov as any,
      baseUrl: window.location.origin,
    });
  };

  const copyWebhookUrl = useCallback((path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(path);
      toast.success("Webhook URL copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  }, []);

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
  const preview = outboundPreview.data ?? { totalLeads: 0, unsyncedLeads: 0, syncedLeads: 0 };

  const isSyncing = syncMut.isPending || outboundSyncMut.isPending;

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
              Bidirectional sync management across {ALL_PROVIDERS.length} platforms
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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pull"><Download className="h-3 w-3 inline mr-1" />Pull (Inbound)</SelectItem>
              <SelectItem value="push"><Upload className="h-3 w-3 inline mr-1" />Push (Outbound)</SelectItem>
              <SelectItem value="bidirectional"><ArrowLeftRight className="h-3 w-3 inline mr-1" />Bidirectional</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      <QueryErrorBanner query={syncHistory} label="sync history" />

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Upload className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{preview.unsyncedLeads.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Ready to Push</p>
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
                  {/* Quick push button for pushable platforms */}
                  {prov.pushable && isConnected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      disabled={outboundSyncMut.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOutboundSync(prov.value);
                      }}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Push Leads
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tabs: Outbound Sync, Webhook Feed, Sync History, Settings */}
      <Tabs defaultValue="outbound">
        <TabsList className="flex-wrap">
          <TabsTrigger value="outbound"><Upload className="h-3.5 w-3.5 mr-1" /> Outbound Sync</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1" /> Webhook Feed</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> Sync History</TabsTrigger>
          <TabsTrigger value="syncLogs"><Zap className="h-3.5 w-3.5 mr-1" /> Integration Logs</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Field Mappings</TabsTrigger>
        </TabsList>

        {/* Outbound Sync Tab */}
        <TabsContent value="outbound" className="mt-4 space-y-4">
          {/* Outbound Preview Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Outbound Sync — Push Leads to External CRMs
              </CardTitle>
              <CardDescription>
                Push contacts from your lead pipeline to connected CRM platforms. Leads originally from a platform are excluded to prevent circular sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-3xl font-bold">{preview.totalLeads.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Leads in Pipeline</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <p className="text-3xl font-bold text-cyan-400">{preview.unsyncedLeads.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Eligible for Push to {ALL_PROVIDERS.find(p => p.value === provider)?.label}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-3xl font-bold text-emerald-400">{preview.syncedLeads.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Already Synced</p>
                </div>
              </div>

              {/* Per-platform outbound controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Push to Platform</h3>
                {ALL_PROVIDERS.map((prov) => {
                  const info = platformMap[prov.value];
                  const isConnected = info?.connectionStatus === "connected";
                  return (
                    <div key={prov.value} className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/50 hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{prov.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{prov.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {isConnected ? "Connected" : "Not connected"}
                            {!prov.pushable && " · Read-only (no outbound push)"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {prov.pushable ? (
                          <Button
                            size="sm"
                            variant={isConnected ? "default" : "outline"}
                            disabled={!isConnected || outboundSyncMut.isPending}
                            onClick={() => handleOutboundSync(prov.value)}
                          >
                            {outboundSyncMut.isPending && outboundSyncMut.variables?.provider === prov.value ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                            )}
                            Push Leads
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Read-only</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                        {h.direction === "push" ? (
                          <Upload className="h-4 w-4 text-cyan-400" />
                        ) : h.direction === "bidirectional" ? (
                          <ArrowLeftRight className="h-4 w-4 text-purple-400" />
                        ) : (
                          <Download className="h-4 w-4 text-blue-400" />
                        )}
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
                  <p className="text-xs text-muted-foreground">How to handle conflicting records</p>
                </div>
                <Badge variant="outline">CRM Wins</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Default Sync Direction</p>
                  <p className="text-xs text-muted-foreground">Bidirectional sync keeps both systems updated</p>
                </div>
                <Badge variant="outline">Bidirectional</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Webhook Endpoints</p>
                  <p className="text-xs text-muted-foreground">5 webhook endpoints active for real-time push</p>
                </div>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">5 Active</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Webhook URLs Reference with Copy + Auto-Register */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Webhook URLs
              </CardTitle>
              <CardDescription>
                Configure these endpoints in each platform's webhook settings, or use auto-register to set them up programmatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { platform: "GoHighLevel", slug: "gohighlevel", path: "/api/webhooks/ghl" },
                { platform: "Dripify", slug: "dripify", path: "/api/webhooks/dripify" },
                { platform: "SMS-iT", slug: "smsit", path: "/api/webhooks/smsit" },
                { platform: "Workable", slug: "workable", path: "/api/webhooks/workable" },
                { platform: "LinkedIn", slug: "linkedin", path: "/api/webhooks/linkedin" },
              ].map(({ platform, slug, path }) => (
                <div key={path} className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{platform}</p>
                      <code className="text-xs text-muted-foreground font-mono truncate block">
                        {window.location.origin}{path}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => copyWebhookUrl(path)}
                    >
                      {copiedUrl === path ? (
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={registerWebhookMut.isPending}
                      onClick={() => handleRegisterWebhook(slug)}
                    >
                      {registerWebhookMut.isPending && registerWebhookMut.variables?.provider === slug ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1" />
                      )}
                      Auto-Register
                    </Button>
                  </div>
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
