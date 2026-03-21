import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Link2, Unlink, RefreshCw, Search, Database, Building2, Briefcase, User,
  Globe, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight,
  Shield, Activity, Settings2, Loader2, Plus, ArrowUpDown, FileUp, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

// ─── Types ─────────────────────────────────────────────────────────────
type Provider = {
  id: string;
  name: string;
  slug: string;
  category: string;
  ownershipTier: string;
  description: string | null;
  logoUrl: string | null;
  authMethod: string;
  isActive: boolean;
};

type Connection = {
  id: string;
  providerId: string;
  status: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  recordsSynced: number | null;
  credentialsEncrypted?: string | null;
  createdAt: Date;
};

// ─── Status Badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    connected: { label: "Connected", variant: "default", icon: CheckCircle2 },
    disconnected: { label: "Disconnected", variant: "secondary", icon: Unlink },
    error: { label: "Error", variant: "destructive", icon: XCircle },
    pending: { label: "Pending", variant: "outline", icon: Clock },
    expired: { label: "Expired", variant: "destructive", icon: AlertTriangle },
  };
  const c = config[status || "disconnected"] || config.disconnected;
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

// ─── Tier Badge ────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; icon: typeof Globe; color: string }> = {
    platform: { label: "Platform", icon: Globe, color: "bg-blue-500/10 text-blue-500" },
    organization: { label: "Organization", icon: Building2, color: "bg-purple-500/10 text-purple-500" },
    professional: { label: "Professional", icon: Briefcase, color: "bg-amber-500/10 text-amber-500" },
    client: { label: "Client", icon: User, color: "bg-emerald-500/10 text-emerald-500" },
  };
  const c = config[tier] || config.client;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.color}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

// ─── Provider Card ─────────────────────────────────────────────────────
function ProviderCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  onSync,
  onTest,
}: {
  provider: Provider;
  connection?: Connection;
  onConnect: (provider: Provider) => void;
  onDisconnect: (connectionId: string) => void;
  onSync: (connectionId: string) => void;
  onTest: (connectionId: string) => void;
}) {
  const isConnected = connection?.status === "connected";
  const isPending = connection?.status === "pending" || connection?.status === "pending_api_key";
  const hasError = connection?.status === "error";
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);

  return (
    <Card className={`transition-all hover:shadow-md ${isConnected ? "border-emerald-500/30" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={provider.ownershipTier} />
                <span className="text-xs text-muted-foreground">{provider.category}</span>
              </div>
            </div>
          </div>
          {connection && <StatusBadge status={connection.status} />}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {provider.description || `Connect your ${provider.name} account to sync data automatically.`}
        </p>

        {connection && (
          <div className="mb-4 rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={connection.status} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">API Key</span>
              <span className="font-mono text-xs truncate max-w-[120px] sm:max-w-[200px]">{connection.credentialsEncrypted ? "•••• (set)" : "Not set"}</span>
            </div>
            {isConnected && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last sync</span>
                  <span>{connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Never"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Records synced</span>
                  <span>{connection.recordsSynced?.toLocaleString() || 0}</span>
                </div>
              </>
            )}
            {connection.lastSyncError && (
              <div className="flex justify-between text-xs">
                <span className="text-destructive">Error</span>
                <span className="text-destructive truncate max-w-[120px] sm:max-w-[200px]">{connection.lastSyncError}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Connected</span>
              <span>{new Date(connection.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-w-[100px]"
                onClick={() => {
                  setSyncing(true);
                  onSync(connection!.id);
                  setTimeout(() => setSyncing(false), 3000);
                }}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(connection!.id)}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Disconnect</span>
                <span className="sm:hidden">Remove</span>
              </Button>
            </>
          ) : (isPending || hasError) && connection ? (
            <>
              <Button
                size="sm"
                className="flex-1 min-w-[100px]"
                onClick={() => {
                  setTesting(true);
                  onTest(connection.id);
                  setTimeout(() => setTesting(false), 12000);
                }}
                disabled={testing}
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                {hasError ? "Retry Test" : "Verify Connection"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(connection.id)}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 min-w-[100px]"
              onClick={() => onConnect(provider)}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Connect Dialog ────────────────────────────────────────────────────
function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onSubmit,
}: {
  provider: Provider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (providerSlug: string, credentials: Record<string, string>) => void;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!provider) return null;

  // Determine required credential fields based on auth type
  const credentialFields: { key: string; label: string; type: string; placeholder: string }[] = (() => {
    switch (provider.authMethod) {
      case "oauth2":
        return [
          { key: "client_id", label: "Client ID", type: "text", placeholder: "Your OAuth client ID" },
          { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your OAuth client secret" },
        ];
      case "api_key":
        return [
          { key: "api_key", label: "API Key", type: "password", placeholder: "Your API key" },
        ];
      case "token":
        return [
          { key: "access_token", label: "Access Token", type: "password", placeholder: "Your access token" },
        ];
      default:
        return [
          { key: "api_key", label: "API Key", type: "password", placeholder: "Enter credentials" },
        ];
    }
  })();

  // Add Plaid-specific fields
  if (provider.slug === "plaid") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {provider.name}</DialogTitle>
            <DialogDescription>
              Plaid requires a Link token flow. Enter your Plaid credentials to initialize the connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Client ID</label>
              <Input
                type="text"
                placeholder="Plaid client ID"
                value={credentials.client_id || ""}
                onChange={e => setCredentials(prev => ({ ...prev, client_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Secret</label>
              <Input
                type="password"
                placeholder="Plaid secret"
                value={credentials.secret || ""}
                onChange={e => setCredentials(prev => ({ ...prev, secret: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Environment</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={credentials.environment || "sandbox"}
                onChange={e => setCredentials(prev => ({ ...prev, environment: e.target.value }))}
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="development">Development</option>
                <option value="production">Production</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your credentials at{" "}
              <a href="https://dashboard.plaid.com" target="_blank" rel="noopener" className="text-primary underline">
                dashboard.plaid.com
              </a>
            </p>
            <Button
              className="w-full"
              disabled={submitting || !credentials.client_id || !credentials.secret}
              onClick={() => {
                setSubmitting(true);
                onSubmit(provider.slug, credentials);
                setTimeout(() => {
                  setSubmitting(false);
                  onOpenChange(false);
                  setCredentials({});
                }, 1000);
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Connect Plaid
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {provider.name}</DialogTitle>
          <DialogDescription>
            Enter your {provider.name} credentials to establish a secure connection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {credentialFields.map(field => (
            <div key={field.key}>
              <label className="text-sm font-medium">{field.label}</label>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={credentials[field.key] || ""}
                onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button
            className="w-full"
            disabled={submitting || credentialFields.some(f => !credentials[f.key])}
            onClick={() => {
              setSubmitting(true);
              onSubmit(provider.slug, credentials);
              setTimeout(() => {
                setSubmitting(false);
                onOpenChange(false);
                setCredentials({});
              }, 1000);
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sync History ──────────────────────────────────────────────────────
function SyncHistory({ connectionId }: { connectionId: string }) {
  const { data: logs, isLoading } = trpc.integrations.getSyncLogs.useQuery(
    { connectionId, limit: 10 },
    { enabled: !!connectionId }
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading sync history...</div>;
  if (!logs?.length) return <div className="text-sm text-muted-foreground">No sync history yet.</div>;

  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={log.status} />
            <span className="text-muted-foreground">{log.syncType}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{log.recordsCreated || 0} records</span>
            <span>{log.startedAt ? new Date(log.startedAt).toLocaleString() : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Integrations Page ────────────────────────────────────────────
export default function Integrations() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [connectProvider, setConnectProvider] = useState<Provider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Queries
  const { data: providersData, isLoading: loadingProviders } = trpc.integrations.listProviders.useQuery(
    tierFilter === "all" ? {} : { ownershipTier: tierFilter }
  );
  const providers = providersData?.providers;
  const { data: connections, isLoading: loadingConnections, refetch: refetchConnections } = trpc.integrations.listConnections.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Mutations
  const testConnectionMutation = trpc.integrations.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`${data.message} (${data.latencyMs}ms)`);
      } else {
        toast.error(data.message);
      }
      refetchConnections();
    },
    onError: (e) => toast.error(e.message),
  });

  const createConnection = trpc.integrations.createConnection.useMutation({
    onSuccess: (data) => {
      toast.success("Connection created — verifying API key...");
      refetchConnections();
      // Auto-test the connection immediately after creation
      if (data?.id) {
        testConnectionMutation.mutate({ connectionId: data.id });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectMutation = trpc.integrations.deleteConnection.useMutation({
    onSuccess: () => {
      toast.success("Disconnected successfully");
      refetchConnections();
    },
    onError: (e) => toast.error(e.message),
  });

  const syncMutation = trpc.integrations.triggerSync.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync triggered: ${data.status}`);
      refetchConnections();
    },
    onError: (e) => toast.error(e.message),
  });

  // Build connection map: providerId -> connection
  const connectionMap = useMemo(() => {
    const map = new Map<string, Connection>();
    for (const conn of (connections || [])) {
      map.set(conn.providerId, conn as unknown as Connection);
    }
    return map;
  }, [connections]);

  // Filter providers
  const filteredProviders = useMemo(() => {
    if (!providers) return [] as Provider[];
    return (providers as unknown as Provider[]).filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [providers, search]);

  // Group by tier
  const groupedProviders = useMemo(() => {
    const groups: Record<string, Provider[]> = { platform: [], organization: [], professional: [], client: [] };
    for (const p of filteredProviders) {
      if (groups[p.ownershipTier]) groups[p.ownershipTier].push(p);
    }
    return groups;
  }, [filteredProviders]);

  const connectedCount = Array.isArray(connections) ? connections.filter((c: any) => c.status === "connected").length : 0;
  const totalRecords = Array.isArray(connections) ? connections.reduce((sum: number, c: any) => sum + (c.recordsSynced || 0), 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center gap-2 sm:gap-3 h-14">
          <Link href="/chat">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Data Integrations</h1>
          </div>
          <Link href="/integration-health">
            <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Health Dashboard</span>
              <span className="sm:hidden">Health</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="container py-6 space-y-6">
      {/* Subtitle */}
      <div>
        <p className="text-muted-foreground">
          Connect your financial accounts, CRM, and data sources to power personalized AI insights.
        </p>
      </div>

      {/* Login prompt for unauthenticated users */}
      {!user && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm">Sign in to connect integrations and view your connection status.</span>
              </div>
              <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{providers?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Available Providers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-emerald-500">{connectedCount}</div>
            <div className="text-xs text-muted-foreground">Active Connections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Records Synced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">AES-256</span>
            </div>
            <div className="text-xs text-muted-foreground">Credential Encryption</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={tierFilter} onValueChange={setTierFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="platform">Platform</TabsTrigger>
            <TabsTrigger value="organization">Org</TabsTrigger>
            <TabsTrigger value="professional">Pro</TabsTrigger>
            <TabsTrigger value="client">Client</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Provider Grid by Tier */}
      {loadingProviders ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {(["platform", "organization", "professional", "client"] as const).map(tier => {
            const tierProviders = groupedProviders[tier];
            if (!tierProviders?.length) return null;

            const tierLabels: Record<string, { label: string; desc: string }> = {
              platform: { label: "Platform Data Sources", desc: "Government and public economic data — available to all users" },
              organization: { label: "Organization Integrations", desc: "CRM, compliance, and team management tools" },
              professional: { label: "Professional Tools", desc: "Financial planning, research, and portfolio analytics" },
              client: { label: "Client Connections", desc: "Bank accounts, investments, and personal financial data" },
            };

            return (
              <div key={tier}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TierBadge tier={tier} />
                    {tierLabels[tier].label}
                  </h2>
                  <p className="text-sm text-muted-foreground">{tierLabels[tier].desc}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {tierProviders.map(provider => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      connection={connectionMap.get(provider.id)}
                      onConnect={(p) => {
                        setConnectProvider(p);
                        setConnectOpen(true);
                      }}
                      onDisconnect={(id) => {
                        if (confirm("Are you sure you want to disconnect this integration?")) {
                          disconnectMutation.mutate({ connectionId: id });
                        }
                      }}
                      onSync={(id) => {
                        syncMutation.mutate({ connectionId: id, syncType: "incremental" });
                      }}
                      onTest={(id) => {
                        testConnectionMutation.mutate({ connectionId: id });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Connections — Sync History */}
      {connectedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Sync Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {connections?.filter((c: any) => c.status === "connected").slice(0, 5).map((conn: any) => {
                const provider = (providers as unknown as Provider[] | undefined)?.find((p) => p.id === conn.providerId);
                return (
                  <div key={conn.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{provider?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {conn.lastSyncAt ? `Last sync: ${new Date(conn.lastSyncAt).toLocaleString()}` : "Never synced"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                      <span className="text-xs text-muted-foreground">{conn.recordsSynced || 0} records</span>
                      <StatusBadge status={conn.lastSyncStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect Dialog */}
      <ConnectDialog
        provider={connectProvider}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onSubmit={(slug, creds) => {
          createConnection.mutate({ providerSlug: slug, credentials: creds });
        }}
      />
      </div>{/* close container */}
    </div>
  );
}
