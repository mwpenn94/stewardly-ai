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
  ArrowUpRight, Copy, CheckCheck, Link2, Sparkles, Timer, Info,
  ChevronDown, ChevronRight, Power, PlayCircle, PauseCircle,
  BarChart3, Key, ShieldCheck, TestTube2, Eye, EyeOff,
  GitMerge, AlertCircle, ExternalLink, Unlink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [enrichEmail, setEnrichEmail] = useState("");
  const [enrichName, setEnrichName] = useState("");
  const [expandedInstructions, setExpandedInstructions] = useState<string | null>(null);
  const [credForms, setCredForms] = useState<Record<string, Record<string, string>>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(null);

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

  // Auto-sync status
  const autoSyncStatus = trpc.crm.autoSyncStatus.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 60000,
  });

  // Connection instructions
  const connectionInstructions = trpc.crm.connectionInstructions.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    staleTime: 300000,
  });

  // Sync analytics query
  const syncAnalytics = trpc.crm.syncAnalytics.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    staleTime: 60000,
  });

  // Connection status query
  const connectionStatus = trpc.crm.getConnectionStatus.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    staleTime: 30000,
  });

  // Save credentials mutation
  const saveCredsMut = trpc.crm.saveCredentials.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Credentials ${r.status} successfully`);
      utils.crm.getConnectionStatus.invalidate();
    },
    onError: (e: any) => toast.error(`Failed to save credentials: ${e.message}`),
  });

  // Test connection mutation
  const testConnMut = trpc.crm.testConnection.useMutation({
    onSuccess: (r: any) => {
      if (r.success) toast.success(`${r.provider}: ${r.message}`);
      else toast.error(`${r.provider}: ${r.message}`);
    },
    onError: (e: any) => toast.error(`Connection test failed: ${e.message}`),
  });

  // Webhook verify mutation
  const webhookVerifyMut = trpc.crm.webhookVerify.useMutation({
    onSuccess: (r: any) => {
      setVerifyingProvider(null);
      if (r.success) toast.success(`Webhook verified! Event ID: ${r.eventId}`);
      else toast.error(r.message || "Webhook verification failed");
    },
    onError: (e: any) => {
      setVerifyingProvider(null);
      toast.error(`Verification failed: ${e.message}`);
    },
  });

  // LinkedIn enrichment mutation
  const linkedinEnrichMut = trpc.crm.linkedinEnrich.useMutation({
    onSuccess: (r) => {
      if (r.enriched) {
        toast.success(`LinkedIn enrichment successful — ${r.profileUrl || 'profile found'}`);
      } else {
        toast.info(r.error || 'No LinkedIn profile found');
      }
    },
    onError: (e) => toast.error(`Enrichment failed: ${e.message}`),
  });

  // Auto-sync toggle mutation
  const toggleAutoSyncMut = trpc.crm.toggleAutoSync.useMutation({
    onSuccess: (r) => {
      toast.success(r.success ? 'Auto-sync toggled' : 'Toggle failed');
      utils.crm.autoSyncStatus.invalidate();
    },
    onError: (e) => toast.error(`Toggle failed: ${e.message}`),
  });

  // Refresh auto-sync mutation
  const refreshAutoSyncMut = trpc.crm.refreshAutoSync.useMutation({
    onSuccess: (r) => {
      toast.success(`Auto-sync refreshed — ${r.jobsRegistered} jobs registered`);
      utils.crm.autoSyncStatus.invalidate();
    },
    onError: (e) => toast.error(`Refresh failed: ${e.message}`),
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

  // Timeline queries
  const [timelineFilter, setTimelineFilter] = useState<{ provider?: string; eventType?: string }>({});
  const timeline = trpc.crm.timeline.useQuery(
    { provider: timelineFilter.provider, eventType: timelineFilter.eventType, limit: 100 },
    { enabled: isAuthenticated && isAdmin, refetchInterval: 30000 },
  );
  const timelineSummary = trpc.crm.timelineSummary.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    staleTime: 60000,
  });
  const liveSyncTestMut = trpc.crm.liveSyncTest.useMutation({
    onSuccess: (r: any) => {
      toast.success(
        `Live sync test: ${r.ghlContactsFetched} contacts fetched, ${r.conflictsDetected} conflicts detected`,
      );
      utils.crm.timeline.invalidate();
      utils.crm.timelineSummary.invalidate();
      utils.crm.syncHistory.invalidate();
    },
    onError: (e: any) => toast.error(`Live sync test failed: ${e.message}`),
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
  // Alias for provider card derivation
  const providerMap = platformMap;
  // Sync history loading state
  const syncHistoryLoading = syncHistory.isLoading;
  // Empty state message for sync history
  const emptySyncMessage = historyRows.length === 0 ? "No sync history yet" : null;
  // Aggregate statss
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
          <TabsTrigger value="analytics"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="credentials"><Key className="h-3.5 w-3.5 mr-1" /> Credentials</TabsTrigger>
          <TabsTrigger value="outbound"><Upload className="h-3.5 w-3.5 mr-1" /> Outbound Sync</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1" /> Webhook Feed</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="syncLogs"><Zap className="h-3.5 w-3.5 mr-1" /> Integration Logs</TabsTrigger>
          <TabsTrigger value="liveTest"><Activity className="h-3.5 w-3.5 mr-1" /> Live Test</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="conflicts"><GitMerge className="h-3.5 w-3.5 mr-1" /> Conflicts</TabsTrigger>
          <TabsTrigger value="ghlConnect"><ExternalLink className="h-3.5 w-3.5 mr-1" /> GHL Connect</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Field Mappings</TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          {syncAnalytics.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          ) : !syncAnalytics.data ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No analytics data yet. Sync events will populate metrics here.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Channel Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["webhook", "polling"].map((ch) => {
                  const m = ch === "webhook" ? syncAnalytics.data!.comparison.webhook : syncAnalytics.data!.comparison.polling;
                  const isWinner = syncAnalytics.data!.comparison.latencyAdvantage.channel === ch;
                  return (
                    <Card key={ch} className={isWinner ? "border-emerald-500/30 ring-1 ring-emerald-500/20" : ""}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 capitalize">
                          {ch === "webhook" ? <Webhook className="h-4 w-4 text-purple-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}
                          {ch} Channel
                          {isWinner && <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Faster</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 rounded bg-muted/30">
                            <p className="text-xl font-bold">{m.totalEvents.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Total Events</p>
                          </div>
                          <div className="text-center p-2 rounded bg-emerald-500/5">
                            <p className="text-xl font-bold text-emerald-400">{m.successRate.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Success Rate</p>
                          </div>
                          <div className="text-center p-2 rounded bg-blue-500/5">
                            <p className="text-xl font-bold text-blue-400">{m.avgLatencyMs != null ? `${Math.round(m.avgLatencyMs)}ms` : "\u2014"}</p>
                            <p className="text-xs text-muted-foreground">Avg Latency</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between p-2 rounded bg-muted/20">
                            <span className="text-muted-foreground">Last 1h</span>
                            <span className="font-medium">{m.eventsLast1h}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted/20">
                            <span className="text-muted-foreground">Last 24h</span>
                            <span className="font-medium">{m.eventsLast24h}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted/20">
                            <span className="text-muted-foreground">P95 Latency</span>
                            <span className="font-medium">{m.p95LatencyMs != null ? `${Math.round(m.p95LatencyMs)}ms` : "\u2014"}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted/20">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-medium text-red-400">{m.failedEvents}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Recommendation */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Recommendation</p>
                      <p className="text-sm text-muted-foreground">{syncAnalytics.data.comparison.recommendation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center p-3 rounded bg-purple-500/5 border border-purple-500/20">
                      <p className="text-lg font-bold text-purple-400">{syncAnalytics.data.comparison.coverageComparison.webhookOnly}</p>
                      <p className="text-xs text-muted-foreground">Webhook Only</p>
                    </div>
                    <div className="text-center p-3 rounded bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-lg font-bold text-emerald-400">{syncAnalytics.data.comparison.coverageComparison.bothChannels}</p>
                      <p className="text-xs text-muted-foreground">Both Channels</p>
                    </div>
                    <div className="text-center p-3 rounded bg-blue-500/5 border border-blue-500/20">
                      <p className="text-lg font-bold text-blue-400">{syncAnalytics.data.comparison.coverageComparison.pollingOnly}</p>
                      <p className="text-xs text-muted-foreground">Polling Only</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hourly Timeline */}
              {syncAnalytics.data.timeline.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Hourly Sync Timeline (Last 24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-32 overflow-x-auto">
                      {syncAnalytics.data.timeline.map((pt: any, i: number) => {
                        const maxCount = Math.max(...syncAnalytics.data!.timeline.map((t: any) => t.webhookCount + t.pollingCount), 1);
                        const total = pt.webhookCount + pt.pollingCount;
                        const height = Math.max((total / maxCount) * 100, 4);
                        const webhookPct = total > 0 ? (pt.webhookCount / total) * 100 : 50;
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 min-w-[24px]" title={`${pt.hour}: ${pt.webhookCount} webhook, ${pt.pollingCount} polling`}>
                            <div className="w-5 rounded-t overflow-hidden" style={{ height: `${height}%` }}>
                              <div className="bg-purple-500/70 w-full" style={{ height: `${webhookPct}%` }} />
                              <div className="bg-blue-500/70 w-full" style={{ height: `${100 - webhookPct}%` }} />
                            </div>
                            {i % 4 === 0 && (
                              <span className="text-[9px] text-muted-foreground rotate-45 origin-left">
                                {pt.hour.split(" ")[1] || pt.hour.slice(-5)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500/70" /> Webhook</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500/70" /> Polling</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Event Type Breakdown */}
              {syncAnalytics.data.breakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" /> Event Type Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {syncAnalytics.data.breakdown.map((evt: any) => {
                        const total = evt.webhookCount + evt.pollingCount;
                        const maxTotal = Math.max(...syncAnalytics.data!.breakdown.map((e: any) => e.webhookCount + e.pollingCount), 1);
                        return (
                          <div key={evt.eventType} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-mono text-xs">{evt.eventType}</span>
                              <span className="text-muted-foreground text-xs">{total} events</span>
                            </div>
                            <div className="flex h-4 rounded overflow-hidden bg-muted/30">
                              <div className="bg-purple-500/60 transition-all" style={{ width: `${(evt.webhookCount / maxTotal) * 100}%` }} />
                              <div className="bg-blue-500/60 transition-all" style={{ width: `${(evt.pollingCount / maxTotal) * 100}%` }} />
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Webhook: {evt.webhookCount} {evt.webhookAvgLatency != null ? `(${Math.round(evt.webhookAvgLatency)}ms)` : ""}</span>
                              <span>Polling: {evt.pollingCount} {evt.pollingAvgLatency != null ? `(${Math.round(evt.pollingAvgLatency)}ms)` : ""}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Credentials Tab */}
        <TabsContent value="credentials" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" /> Platform API Credentials
              </CardTitle>
              <CardDescription>
                Enter API keys and tokens for each platform. Credentials are encrypted at rest and never exposed after saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { prov: "gohighlevel", label: "GoHighLevel", icon: "\uD83D\uDD37", fields: [
                  { key: "apiToken", label: "API Key (PIT)", placeholder: "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
                  { key: "locationId", label: "Location ID", placeholder: "xxxxxxxxxx" },
                ]},
                { prov: "smsit", label: "SMS-iT", icon: "\uD83D\uDCF1", fields: [
                  { key: "apiToken", label: "API Key", placeholder: "smsit-api-key-here" },
                ]},
                { prov: "dripify", label: "Dripify", icon: "\uD83D\uDCA7", fields: [
                  { key: "apiToken", label: "API Key", placeholder: "dripify-api-key" },
                ]},
                { prov: "workable", label: "Workable", icon: "\uD83D\uDC65", fields: [
                  { key: "apiToken", label: "API Token", placeholder: "workable-api-token" },
                  { key: "subdomain", label: "Subdomain", placeholder: "your-company" },
                ]},
                { prov: "wealthbox", label: "Wealthbox", icon: "\uD83D\uDCBC", fields: [
                  { key: "apiToken", label: "Access Token", placeholder: "wealthbox-access-token" },
                ]},
                { prov: "salesforce", label: "Salesforce", icon: "\u2601\uFE0F", fields: [
                  { key: "clientId", label: "Consumer Key", placeholder: "3MVG9..." },
                  { key: "clientSecret", label: "Consumer Secret", placeholder: "xxxxxxxx" },
                  { key: "instanceUrl", label: "Instance URL", placeholder: "https://yourorg.salesforce.com" },
                ]},
                { prov: "redtail", label: "Redtail CRM", icon: "\uD83D\uDD34", fields: [
                  { key: "apiToken", label: "API Key", placeholder: "redtail-api-key" },
                ]},
              ].map(({ prov, label, icon, fields }) => {
                const connStatus = (connectionStatus.data || []).find((c: any) => c.provider === prov);
                const isConnected = connStatus?.status === "connected";
                const form = credForms[prov] || {};
                const showPw = showPasswords[prov] || false;

                return (
                  <div key={prov} className="p-4 rounded-lg border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <span className="font-medium">{label}</span>
                        {isConnected ? (
                          <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Not configured</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={testConnMut.isPending}
                          onClick={() => testConnMut.mutate({ provider: prov, credentials: Object.keys(form).length > 0 ? form : undefined })}
                        >
                          {testConnMut.isPending && testConnMut.variables?.provider === prov ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <TestTube2 className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={saveCredsMut.isPending || Object.keys(form).length === 0}
                          onClick={() => saveCredsMut.mutate({ provider: prov, credentials: form })}
                        >
                          {saveCredsMut.isPending && saveCredsMut.variables?.provider === prov ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fields.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{f.label}</Label>
                          <div className="relative">
                            <Input
                              type={showPw ? "text" : "password"}
                              placeholder={f.placeholder}
                              value={form[f.key] || ""}
                              onChange={(e) => setCredForms(prev => ({
                                ...prev,
                                [prov]: { ...(prev[prov] || {}), [f.key]: e.target.value },
                              }))}
                              className="pr-8 text-sm font-mono"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPasswords(prev => ({ ...prev, [prov]: !prev[prov] }))}
                            >
                              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {connStatus?.lastSyncAt && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {timeAgo(connStatus.lastSyncAt)} \u00b7 {connStatus.recordsSynced || 0} records synced
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

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

        {/* Unified Sync Timeline */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Summary Cards */}
          {timelineSummary.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{timelineSummary.data.totalEvents}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{timelineSummary.data.totalContactsSynced}</p>
                <p className="text-xs text-muted-foreground">Contacts Synced</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{timelineSummary.data.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{timelineSummary.data.totalErrors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent></Card>
            </div>
          )}
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={timelineFilter.provider || "all"} onValueChange={(v) => setTimelineFilter(f => ({ ...f, provider: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Providers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="gohighlevel">GoHighLevel</SelectItem>
                <SelectItem value="dripify">Dripify</SelectItem>
                <SelectItem value="smsit">SMS-iT</SelectItem>
                <SelectItem value="workable">Workable</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timelineFilter.eventType || "all"} onValueChange={(v) => setTimelineFilter(f => ({ ...f, eventType: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pull">Pull (Inbound)</SelectItem>
                <SelectItem value="push">Push (Outbound)</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="auto_sync">Auto Sync</SelectItem>
                <SelectItem value="manual_sync">Manual Sync</SelectItem>
              </SelectContent>
            </Select>
            <ExportDataButton
              data={timeline.data ?? []}
              filename="sync-timeline"
              columns={["eventType", "provider", "direction", "status", "contactCount", "timestamp"]}
            />
          </div>
          {/* Timeline */}
          <Card>
            <CardContent className="p-4">
              {timeline.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !timeline.data?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sync events yet. Run your first sync to see the timeline.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {(timeline.data as any[]).map((evt: any) => {
                      const iconMap: Record<string, React.ReactNode> = {
                        pull: <Download className="h-3.5 w-3.5 text-blue-400" />,
                        push: <Upload className="h-3.5 w-3.5 text-cyan-400" />,
                        webhook: <Webhook className="h-3.5 w-3.5 text-green-400" />,
                        auto_sync: <Zap className="h-3.5 w-3.5 text-amber-400" />,
                        manual_sync: <Activity className="h-3.5 w-3.5 text-purple-400" />,
                        conflict_resolved: <GitMerge className="h-3.5 w-3.5 text-orange-400" />,
                      };
                      const statusColors: Record<string, string> = {
                        success: "bg-green-500/20 text-green-400 border-green-500/30",
                        partial: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        failed: "bg-red-500/20 text-red-400 border-red-500/30",
                        pending: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                      };
                      return (
                        <div key={evt.id} className="relative pl-12 py-2 group">
                          {/* Timeline dot */}
                          <div className="absolute left-3 top-3 w-4 h-4 rounded-full bg-background border-2 border-border flex items-center justify-center z-10">
                            {iconMap[evt.eventType] || <Activity className="h-3 w-3" />}
                          </div>
                          <div className="flex items-start justify-between gap-2 p-2 rounded hover:bg-muted/30 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm capitalize">{evt.provider}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColors[evt.status] || ""}`}>
                                  {evt.status}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {evt.eventType.replace("_", " ")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {evt.contactCount > 0 && `${evt.contactCount} contact${evt.contactCount !== 1 ? "s" : ""}`}
                                {evt.contactsCreated > 0 && ` (${evt.contactsCreated} new)`}
                                {evt.contactsUpdated > 0 && ` (${evt.contactsUpdated} updated)`}
                                {evt.errorCount > 0 && <span className="text-red-400"> · {evt.errorCount} error{evt.errorCount !== 1 ? "s" : ""}</span>}
                                {evt.durationMs && ` · ${evt.durationMs}ms`}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(evt.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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

        {/* Live Sync Test */}
        <TabsContent value="liveTest" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Live Sync Test
              </CardTitle>
              <CardDescription>
                Pull real contacts from GHL, compare with lead_pipeline, and detect field conflicts. Read-only test.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => liveSyncTestMut.mutate()} disabled={liveSyncTestMut.isPending} className="w-full">
                {liveSyncTestMut.isPending ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Running...</>) : (<><Zap className="h-4 w-4 mr-2" /> Run Live Sync Test</>)}
              </Button>
              {liveSyncTestMut.data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{liveSyncTestMut.data.ghlContactsFetched}</p><p className="text-xs text-muted-foreground">GHL Fetched</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-green-400">{liveSyncTestMut.data.realContacts}</p><p className="text-xs text-muted-foreground">Real Contacts</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-muted-foreground">{liveSyncTestMut.data.testContacts}</p><p className="text-xs text-muted-foreground">Test Contacts</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-400">{liveSyncTestMut.data.conflictsDetected}</p><p className="text-xs text-muted-foreground">Conflicts</p></CardContent></Card>
                  </div>
                  {liveSyncTestMut.data.sampleContacts?.length > 0 && (
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Sample Real Contacts</CardTitle></CardHeader><CardContent><div className="space-y-1 max-h-60 overflow-y-auto">{liveSyncTestMut.data.sampleContacts.map((c: any) => (<div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 text-sm"><div><span className="font-medium">{c.name || 'No Name'}</span><span className="text-muted-foreground ml-2">{c.email}</span></div><span className="text-xs text-muted-foreground">{c.city}{c.state ? `, ${c.state}` : ''}</span></div>))}</div></CardContent></Card>
                  )}
                  {liveSyncTestMut.data.conflictDetails?.length > 0 && (
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-orange-400">Field Conflicts</CardTitle></CardHeader><CardContent><div className="space-y-2 max-h-60 overflow-y-auto">{liveSyncTestMut.data.conflictDetails.map((c: any, i: number) => (<div key={i} className="p-2 rounded border border-border/50 text-sm"><p className="font-medium">{c.contactName} \u2014 <span className="text-muted-foreground">{c.field}</span></p><div className="flex gap-4 mt-1 text-xs"><span className="text-blue-400">GHL: {c.ghlValue}</span><span className="text-cyan-400">Stewardly: {c.stewardlyValue}</span></div></div>))}</div></CardContent></Card>
                  )}
                  <p className="text-xs text-muted-foreground text-center">Test at {new Date(liveSyncTestMut.data.timestamp).toLocaleString()}</p>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      disabled={webhookVerifyMut.isPending}
                      onClick={() => {
                        setVerifyingProvider(slug);
                        webhookVerifyMut.mutate({ provider: slug });
                      }}
                    >
                      {verifyingProvider === slug && webhookVerifyMut.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <TestTube2 className="h-3 w-3 mr-1" />
                      )}
                      Verify
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Conflict Resolution */}
        <TabsContent value="conflicts" className="mt-4 space-y-4">
          <ConflictResolutionPanel />
        </TabsContent>

        {/* GHL OAuth Connect */}
        <TabsContent value="ghlConnect" className="mt-4 space-y-4">
          <GHLConnectPanel />
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

// ─── Conflict Resolution Panel ──────────────────────────────────────────────

function ConflictResolutionPanel() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "all">("pending");
  const conflicts = trpc.crm.getSyncConflicts.useQuery({ status: statusFilter, limit: 50 });
  const resolveConflict = trpc.crm.resolveConflict.useMutation({
    onSuccess: () => { conflicts.refetch(); toast.success("Conflict resolved"); },
    onError: (e) => toast.error(e.message),
  });
  const bulkResolve = trpc.crm.bulkResolveConflicts.useMutation({
    onSuccess: (d) => { conflicts.refetch(); toast.success(`${d.resolved} conflicts resolved`); },
    onError: (e) => toast.error(e.message),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mergeValues, setMergeValues] = useState<Record<string, string>>({});

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-orange-500" /> Sync Conflict Resolution
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Review and resolve data conflicts between Stewardly and external CRMs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          {conflicts.data && conflicts.data.pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkResolve.mutate({ resolution: "newest_wins" })}
              disabled={bulkResolve.isPending}
            >
              {bulkResolve.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Resolve All (Newest Wins)
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {conflicts.data && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-orange-500">{conflicts.data.pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-500">{conflicts.data.resolvedCount}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{conflicts.data.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conflict List */}
      {conflicts.isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !conflicts.data?.conflicts.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h4 className="font-medium">No Conflicts</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === "pending" ? "All sync conflicts have been resolved" : "No conflicts found with this filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conflicts.data.conflicts.map((conflict) => {
            const isExpanded = expandedId === conflict.id;
            return (
              <Card key={conflict.id} className={`transition-all ${conflict.status === "resolved" ? "opacity-60" : ""}`}>
                <CardContent className="p-3">
                  {/* Conflict Header */}
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : conflict.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${conflict.status === "pending" ? "bg-orange-500" : "bg-green-500"}`} />
                      <div>
                        <span className="font-medium text-sm">{conflict.field}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{conflict.resolution || "unresolved"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{conflict.detectedAt ? new Date(conflict.detectedAt).toLocaleString() : ""}</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded Diff View */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {/* Visual Diff */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                          <div className="flex items-center gap-1 text-xs font-medium text-blue-500 mb-1">
                            <Database className="h-3 w-3" /> Stewardly Value
                          </div>
                          <div className="font-mono text-sm bg-background/50 rounded p-2 min-h-[2rem]">
                            {conflict.stewardlyValue || <span className="text-muted-foreground italic">empty</span>}
                          </div>
                        </div>
                        <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-3">
                          <div className="flex items-center gap-1 text-xs font-medium text-purple-500 mb-1">
                            <Globe className="h-3 w-3" /> GHL Value
                          </div>
                          <div className="font-mono text-sm bg-background/50 rounded p-2 min-h-[2rem]">
                            {conflict.ghlValue || <span className="text-muted-foreground italic">empty</span>}
                          </div>
                        </div>
                      </div>

                      {/* Merge Input */}
                      <div>
                        <Label className="text-xs">Custom Merged Value (optional)</Label>
                        <Input
                          placeholder="Enter custom merged value..."
                          value={mergeValues[conflict.id] || ""}
                          onChange={(e) => setMergeValues(prev => ({ ...prev, [conflict.id]: e.target.value }))}
                          className="h-8 text-sm mt-1"
                        />
                      </div>

                      {/* Resolution Actions */}
                      {conflict.status === "pending" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                            disabled={resolveConflict.isPending}
                            onClick={() => resolveConflict.mutate({
                              conflictId: conflict.id,
                              resolution: "stewardly_wins",
                              field: conflict.field,
                            })}
                          >
                            <Database className="h-3 w-3 mr-1" /> Keep Stewardly
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
                            disabled={resolveConflict.isPending}
                            onClick={() => resolveConflict.mutate({
                              conflictId: conflict.id,
                              resolution: "ghl_wins",
                              field: conflict.field,
                            })}
                          >
                            <Globe className="h-3 w-3 mr-1" /> Keep GHL
                          </Button>
                          {mergeValues[conflict.id] && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                              disabled={resolveConflict.isPending}
                              onClick={() => resolveConflict.mutate({
                                conflictId: conflict.id,
                                resolution: "merged",
                                mergedValue: mergeValues[conflict.id],
                                field: conflict.field,
                              })}
                            >
                              <GitMerge className="h-3 w-3 mr-1" /> Use Merged
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={resolveConflict.isPending}
                            onClick={() => resolveConflict.mutate({
                              conflictId: conflict.id,
                              resolution: "skip",
                              field: conflict.field,
                            })}
                          >
                            Skip
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── GHL Connect Panel (OAuth Marketplace App) ─────────────────────────────

function GHLConnectPanel() {
  const connectionStatus = trpc.crm.ghlConnectionStatus.useQuery();
  const oauthUrl = trpc.crm.ghlOAuthUrl.useQuery({ origin: window.location.origin });
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/ghl`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Webhook URL copied");
  };

  const status = connectionStatus.data;

  return (
    <>
      {/* Connection Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" /> GoHighLevel Connection
          </CardTitle>
          <CardDescription>Connect via OAuth Marketplace App for full webhook support, or use PIT token for polling-only sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionStatus.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : status ? (
            <>
              {/* Connection Method */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg border p-3 ${status.method === "oauth" ? "border-green-500/50 bg-green-500/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className={`h-4 w-4 ${status.oauthConfigured ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">OAuth App</span>
                    {status.oauthConfigured && <Badge className="bg-green-500/20 text-green-500 text-xs">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {status.oauthConfigured ? "Full access with webhooks" : "Not configured — requires Marketplace App"}
                  </p>
                  {status.tokenExpiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Token expires: {new Date(status.tokenExpiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className={`rounded-lg border p-3 ${status.method === "pit" ? "border-blue-500/50 bg-blue-500/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Key className={`h-4 w-4 ${status.pitConfigured ? "text-blue-500" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">PIT Token</span>
                    {status.pitConfigured && <Badge className="bg-blue-500/20 text-blue-500 text-xs">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {status.pitConfigured ? "Polling sync only (no webhooks)" : "Not configured"}
                  </p>
                  {status.contactCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {status.contactCount.toLocaleString()} contacts accessible
                    </p>
                  )}
                </div>
              </div>

              {/* Location Info */}
              {status.locationName && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>Location: <strong>{status.locationName}</strong></span>
                </div>
              )}

              {/* Webhook Status */}
              <div className={`rounded-lg border p-3 ${status.webhooksActive ? "border-green-500/30 bg-green-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
                <div className="flex items-center gap-2">
                  {status.webhooksActive ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm font-medium">
                    {status.webhooksActive ? "Webhooks Active" : "Webhooks Inactive"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {status.webhooksActive
                    ? "Real-time events from GHL are being received via your Marketplace App"
                    : "PIT tokens cannot receive webhooks. Connect a GHL Marketplace App for real-time sync, or use polling (already active)."}
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* OAuth Connect Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connect GHL Marketplace App</CardTitle>
          <CardDescription>
            Create a private Marketplace App at{" "}
            <a href="https://marketplace.gohighlevel.com" target="_blank" rel="noopener" className="text-primary underline">
              marketplace.gohighlevel.com
            </a>
            , then add Client ID and Secret in the Credentials tab
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Setup Steps */}
          <div className="space-y-3">
            {[
              { step: 1, text: "Create a Private App at GHL Marketplace Developer Portal", detail: "Go to marketplace.gohighlevel.com → My Apps → Create App → choose 'Private'", link: "https://marketplace.gohighlevel.com/apps", done: false },
              { step: 2, text: "Add scopes: contacts.readonly, contacts.write, webhooks.write", detail: "In your app settings → Scopes tab → enable these 3 scopes minimum. Add opportunities.readonly and opportunities.write for deal sync.", done: false },
              { step: 3, text: `Set redirect URL to: ${window.location.origin}/api/ghl/oauth/callback`, detail: "In your app settings → Auth tab → add this exact URL as an authorized redirect URI", done: false },
              { step: 4, text: `Set webhook URL to: ${webhookUrl}`, detail: "In your app settings → Webhooks tab → add this URL and select ContactCreate, ContactUpdate, ContactDelete events", done: false },
              { step: 5, text: "Copy Client ID & Secret → Credentials tab → ghl_oauth", detail: "From your app's Auth tab, copy Client ID and Client Secret. Go to Stewardly Credentials tab → select 'ghl_oauth' → paste both values", done: oauthUrl.data?.configured || false },
              { step: 6, text: "Click 'Connect GHL' below to authorize", detail: "This redirects you to GHL to approve the app. After approval, webhooks are automatically registered.", done: status?.oauthConfigured || false },
            ].map(({ step, text, detail, link, done }) => (
              <div key={step} className={`rounded-lg border p-3 ${done ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${done ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary'}`}>
                    {done ? '✓' : step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{text}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    {link && !done && (
                      <a href={link} target="_blank" rel="noopener" className="text-xs text-primary underline mt-1 inline-block">Open GHL Marketplace →</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Webhook URL Copy */}
          <div className="flex items-center gap-2 mt-3">
            <Input value={webhookUrl} readOnly className="font-mono text-xs h-8" />
            <Button size="sm" variant="outline" onClick={copyUrl} className="h-8">
              {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>

          {/* Connect Button */}
          {oauthUrl.data?.configured ? (
            <Button
              className="w-full"
              onClick={() => {
                if (oauthUrl.data?.url) {
                  window.open(oauthUrl.data.url, "_blank", "noopener,noreferrer");
                  toast.info("Redirecting to GHL authorization...");
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Connect GHL via OAuth
            </Button>
          ) : (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 inline mr-1" />
              Add GHL Marketplace App credentials in the <strong>Credentials</strong> tab first (provider: ghl_oauth, fields: clientId, clientSecret)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Polling Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Polling Sync (Active)
          </CardTitle>
          <CardDescription>
            Polling sync runs automatically via the PIT token — no webhook required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Method</span>
              <Badge variant="outline">API Polling via PIT Token</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span>Every 5 minutes (auto-sync scheduler)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-green-500/20 text-green-500">Running</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Contacts Accessible</span>
              <span>{status?.contactCount?.toLocaleString() || "Loading..."}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
