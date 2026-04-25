/**
 * DataPipelines — Integration status dashboard with pipeline management.
 *
 * Pass 82. Wired to real tRPC integrations.listConnections + integrations.listProviders.
 * Shows connected integrations as live pipelines, plus a registry of available-but-unconfigured
 * pipelines so users see the full data roadmap.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Database, Plus, RefreshCw, Play, Pause, Settings, ArrowRight,
  AlertTriangle, CheckCircle2, Clock, Search, Filter, Loader2, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/SEOHead";
import AppShell from "@/components/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

/* ─── Pipeline registry: known integrations that appear even if not connected ─── */
const PIPELINE_REGISTRY: {
  providerSlug: string;
  name: string;
  source: string;
  destination: string;
  schedule: string;
  description: string;
  webhookUrl?: string;
  setupNote?: string;
}[] = [
  { providerSlug: "redtail", name: "CRM Contact Sync", source: "Redtail CRM", destination: "WealthBridge DB", schedule: "Every 15 min", description: "Bidirectional sync of contacts, activities, and opportunities between Redtail CRM and WealthBridge." },
  { providerSlug: "fred", name: "Market Data Feed", source: "FRED API", destination: "Analytics Engine", schedule: "Daily at 6:00 AM", description: "Federal Reserve economic data including interest rates, GDP, CPI, and employment figures." },
  { providerSlug: "plaid", name: "Plaid Account Sync", source: "Plaid API", destination: "Client Accounts", schedule: "Every 4 hours", description: "Syncs linked bank accounts, balances, and transaction history via Plaid." },
  { providerSlug: "snaptrade", name: "SnapTrade Portfolio Sync", source: "SnapTrade API", destination: "Investment Portfolios", schedule: "Every 30 min", description: "Syncs brokerage account positions, trades, and performance data via SnapTrade." },
  { providerSlug: "email-service", name: "Email Campaign Analytics", source: "Email Service", destination: "Campaign Dashboard", schedule: "Hourly", description: "Aggregates open rates, click rates, bounces, and unsubscribes from email campaigns." },
  { providerSlug: "sec-edgar", name: "SEC EDGAR Filings", source: "EDGAR API", destination: "Compliance DB", schedule: "Daily at 8:00 PM", description: "Pulls SEC filings, 13F reports, and regulatory disclosures for compliance monitoring." },
  { providerSlug: "ghl", name: "GHL Webhook Receiver", source: "GoHighLevel", destination: "Lead Pipeline", schedule: "Real-time (webhook)", description: "Receives webhook events from GoHighLevel for new leads, form submissions, and appointment bookings.", webhookUrl: "/api/trpc/ghlWebhook.ingest", setupNote: "In GHL Settings > Webhooks, add this URL as the endpoint." },
  { providerSlug: "census", name: "Census Bureau Data", source: "Census API", destination: "Market Analysis", schedule: "Weekly (Monday)", description: "Demographic and economic data from the US Census Bureau for market analysis and segmentation." },
  { providerSlug: "gleif", name: "GLEIF LEI Lookup", source: "GLEIF API", destination: "Entity Registry", schedule: "Daily at 7:00 AM", description: "Global Legal Entity Identifier Foundation — LEI lookups for entity verification, counterparty risk, and KYC compliance." },
  { providerSlug: "openfigi", name: "OpenFIGI Instrument Mapping", source: "OpenFIGI API", destination: "Securities DB", schedule: "Daily at 6:30 AM", description: "Maps tickers, CUSIPs, and ISINs to Financial Instrument Global Identifiers." },
  { providerSlug: "naic", name: "NAIC Insurance Data", source: "NAIC CIS", destination: "Carrier Intelligence", schedule: "Weekly (Wednesday)", description: "NAIC — complaint ratios, financial strength data, and carrier comparisons." },
  { providerSlug: "ffiec", name: "FFIEC Banking Data", source: "FFIEC API", destination: "Banking Analytics", schedule: "Monthly (1st)", description: "HMDA data, CRA ratings, and banking institution demographics." },
  { providerSlug: "bls", name: "BLS Employment Data", source: "BLS API", destination: "Economic Indicators", schedule: "Monthly (first Friday)", description: "Bureau of Labor Statistics — employment, unemployment, CPI, PPI, and wage data." },
  { providerSlug: "bea", name: "BEA GDP & Income", source: "BEA API", destination: "Economic Indicators", schedule: "Quarterly", description: "Bureau of Economic Analysis — GDP, personal income, consumer spending." },
  { providerSlug: "dripify", name: "Dripify CSV Import", source: "Dripify", destination: "Lead Pipeline", schedule: "On upload", description: "Imports LinkedIn outreach results from Dripify CSV exports." },
  { providerSlug: "linkedin-sales-nav", name: "LinkedIn Sales Navigator", source: "LinkedIn Sales Nav", destination: "Lead Pipeline", schedule: "On upload", description: "Parses Sales Navigator CSV exports for prospecting pipeline." },
  { providerSlug: "workable", name: "Workable ATS Sync", source: "Workable", destination: "Recruiting Pipeline", schedule: "Every 2 hours", description: "Syncs candidate applications, interview stages, and hiring pipeline data from Workable ATS." },
  { providerSlug: "ghl-crm", name: "GoHighLevel Contact Sync", source: "GoHighLevel CRM", destination: "CRM Contacts", schedule: "Every 15 min", description: "Bidirectional sync of contacts, tags, opportunities, and custom fields." },
];

type PipelineStatus = "connected" | "disconnected" | "error" | "pending" | "expired" | "available" | "paused" | "syncing";

const statusConfig: Record<PipelineStatus, { label: string; color: string; icon: any }> = {
  connected: { label: "Active", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Pause },
  error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertTriangle },
  pending: { label: "Configuring", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Settings },
  expired: { label: "Expired", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: Clock },
  available: { label: "Available", color: "bg-muted text-muted-foreground border-border", icon: Plus },
  paused: { label: "Paused", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: Pause },
  syncing: { label: "Syncing", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", icon: RefreshCw },
};

interface MergedPipeline {
  id: string;
  name: string;
  source: string;
  destination: string;
  status: PipelineStatus;
  schedule: string;
  lastRun: string;
  recordsProcessed: number;
  description: string;
  webhookUrl?: string;
  setupNote?: string;
  providerSlug: string;
  isLive: boolean; // true = from DB, false = from registry
}

function timeAgo(iso: string) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DataPipelines({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Real data from integrations backend
  const connectionsQ = trpc.integrations.listConnections.useQuery(
    undefined,
    { enabled: !!isAuthenticated, staleTime: 30_000 },
  );
  const providersQ = trpc.integrations.listProviders.useQuery(
    undefined,
    { enabled: !!isAuthenticated, staleTime: 60_000 },
  );

  /* Pipeline pause / resume helpers */
  const pause = (id: string) => {
    toast.info("Pipeline paused");
  };
  const resume = (id: string) => {
    toast.info("Pipeline resumed");
    triggerSync.mutate({ connectionId: id });
  };

  const triggerSync = trpc.integrations.triggerSync.useMutation({
    onSuccess: () => {
      toast.success("Sync triggered");
      connectionsQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Merge real connections with registry
  const pipelines = useMemo<MergedPipeline[]>(() => {
    const connections = connectionsQ.data ?? [];
    const providers = providersQ.data ?? [];
    const providerMap = new Map(providers.map((p: any) => [p.slug, p]));

    // Build live pipelines from connections
    const live: MergedPipeline[] = connections.map((c: any) => {
      const provider = c.provider || providerMap.get(c.providerId);
      const registryEntry = PIPELINE_REGISTRY.find(r => r.providerSlug === provider?.slug);
      return {
        id: c.id,
        name: registryEntry?.name ?? provider?.name ?? "Unknown Integration",
        source: registryEntry?.source ?? provider?.name ?? "External",
        destination: registryEntry?.destination ?? "WealthBridge",
        status: (c.status ?? "pending") as PipelineStatus,
        schedule: registryEntry?.schedule ?? "Manual",
        lastRun: c.lastSyncAt ?? "",
        recordsProcessed: c.recordsSynced ?? 0,
        description: registryEntry?.description ?? provider?.description ?? "",
        webhookUrl: registryEntry?.webhookUrl,
        setupNote: registryEntry?.setupNote,
        providerSlug: provider?.slug ?? "",
        isLive: true,
      };
    });

    // Add registry entries that don't have a live connection
    const liveSlugs = new Set(live.map(l => l.providerSlug));
    const available: MergedPipeline[] = PIPELINE_REGISTRY
      .filter(r => !liveSlugs.has(r.providerSlug))
      .map(r => ({
        id: `reg-${r.providerSlug}`,
        name: r.name,
        source: r.source,
        destination: r.destination,
        status: "available" as PipelineStatus,
        schedule: r.schedule,
        lastRun: "",
        recordsProcessed: 0,
        description: r.description,
        webhookUrl: r.webhookUrl,
        setupNote: r.setupNote,
        providerSlug: r.providerSlug,
        isLive: false,
      }));

    return [...live, ...available];
  }, [connectionsQ.data, providersQ.data]);

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const matchesSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.source.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && p.status === "connected")
        || (statusFilter === "error" && p.status === "error")
        || (statusFilter === "pending" && (p.status === "pending" || p.status === "expired"))
        || (statusFilter === "available" && p.status === "available")
        || (statusFilter === "disconnected" && p.status === "disconnected");
      return matchesSearch && matchesStatus;
    });
  }, [pipelines, search, statusFilter]);

  const stats = useMemo(() => ({
    total: pipelines.length,
    active: pipelines.filter(p => p.status === "connected").length,
    totalRecords: pipelines.reduce((sum, p) => sum + p.recordsProcessed, 0),
    errors: pipelines.filter(p => p.status === "error").length,
  }), [pipelines]);

  const isLoading = connectionsQ.isLoading || providersQ.isLoading;

  if (!isAuthenticated) {
    return (
      <Shell>
        <SEOHead title="Data Pipelines" description="Integration status and data pipeline management" />
        <div className="container max-w-4xl py-12 text-center">
          <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Data Pipelines</h1>
          <p className="text-muted-foreground mb-6">Sign in to view your integration pipelines and sync status.</p>
          <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <SEOHead title="Data Pipelines" description="Integration status and data pipeline management" />
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Data Pipelines</h1>
            <p className="text-sm text-muted-foreground mt-1">Integrations, ingestion, and sync status</p>
          </div>
          <Button onClick={() => navigate("/integrations")} className="gap-2">
            <Plus className="w-4 h-4" /> Connect Integration
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <CardContent className="py-4">
              {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : <p className="text-2xl font-bold text-foreground">{stats.total}</p>}
              <p className="text-xs text-muted-foreground">Total Pipelines</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : <p className="text-2xl font-bold text-green-400">{stats.active}</p>}
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : <p className="text-2xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>}
              <p className="text-xs text-muted-foreground">Records Synced</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : <p className="text-2xl font-bold text-red-400">{stats.errors}</p>}
              <p className="text-xs text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search pipelines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", "active", "error", "pending", "available", "disconnected"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize whitespace-nowrap"
              >
                {status === "all" ? "All" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Pipeline Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((pipeline) => {
              const statusCfg = statusConfig[pipeline.status];
              const StatusIcon = statusCfg.icon;

              return (
                <Card
                  key={pipeline.id}
                  className={cn(
                    "hover:border-primary/30 transition-colors",
                    !pipeline.isLive && "opacity-60 hover:opacity-80",
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("p-2 rounded-lg flex-shrink-0", pipeline.isLive ? "bg-primary/10" : "bg-muted")}>
                          <Database className={cn("w-5 h-5", pipeline.isLive ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-foreground">{pipeline.name}</h3>
                            <Badge variant="outline" className={cn("text-[10px]", statusCfg.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusCfg.label}
                            </Badge>
                            {!pipeline.isLive && (
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                                Not Connected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="truncate">{pipeline.source}</span>
                            <ArrowRight className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{pipeline.destination}</span>
                          </div>
                          {pipeline.webhookUrl && pipeline.isLive && (
                            <div className="mt-1.5 text-xs">
                              <span className="text-muted-foreground">Endpoint: </span>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{window.location.origin}{pipeline.webhookUrl}</code>
                            </div>
                          )}
                          {pipeline.setupNote && pipeline.isLive && (
                            <p className="mt-1 text-[11px] text-muted-foreground/70 italic">{pipeline.setupNote}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6">
                        {pipeline.isLive && (
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-foreground">{pipeline.recordsProcessed.toLocaleString()} records</p>
                            <p className="text-xs text-muted-foreground">{pipeline.schedule}</p>
                          </div>
                        )}
                        {pipeline.isLive && (
                          <div className="text-xs text-muted-foreground sm:text-right">
                            <p>Last sync</p>
                            <p>{timeAgo(pipeline.lastRun)}</p>
                          </div>
                        )}
                        {pipeline.isLive && pipeline.status === "connected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={triggerSync.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerSync.mutate({ connectionId: pipeline.id });
                            }}
                            aria-label={`Sync ${pipeline.name}`}
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", triggerSync.isPending && "animate-spin")} />
                            <span className="hidden sm:inline">Sync</span>
                          </Button>
                        ) : !pipeline.isLive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/integrations");
                            }}
                            aria-label={`Connect ${pipeline.name}`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Connect</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/integrations");
                            }}
                            aria-label={`Configure ${pipeline.name}`}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Configure</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search || statusFilter !== "all" ? "No pipelines match your filters" : "No pipelines configured yet"}</p>
              <Button className="mt-4" onClick={() => navigate("/integrations")}>Connect Your First Integration</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}
