import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Link2, Unlink, RefreshCw, Search, Database, Building2, Briefcase, User,
  Globe, CheckCircle2, XCircle, Clock, AlertTriangle,
  Shield, Activity, Loader2, ArrowLeft,
  TrendingUp, TrendingDown, ArrowLeftRight,
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

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

  // SnapTrade platform credentials: admin enters clientId + consumerKey
  // The SnapTrade Connection Portal (for end-users) is in SnapTradeBrokerageSection
  if (provider.slug === "snaptrade") {
    const snapFields = [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Your SnapTrade Client ID" },
      { key: "consumerKey", label: "Consumer Key", type: "password", placeholder: "Your SnapTrade Consumer Key" },
    ];
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Configure SnapTrade Platform Credentials
            </DialogTitle>
            <DialogDescription>
              Enter your SnapTrade developer API credentials. These power the brokerage Connection Portal for all users.
              Get your credentials at{" "}
              <a href="https://snaptrade.com" target="_blank" rel="noopener" className="text-primary underline">snaptrade.com</a>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {snapFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium">{field.label}</label>
                <Input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                Once configured, users can connect their brokerages (Fidelity, Schwab, Alpaca, etc.) via the SnapTrade Connection Portal in the Client Connections section below. Free tier supports 5 brokerage connections per platform.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={submitting || !credentials.clientId || !credentials.consumerKey}
              onClick={() => {
                setSubmitting(true);
                onSubmit(provider.slug, credentials);
                setTimeout(() => setSubmitting(false), 3000);
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Save Platform Credentials
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
function _SyncHistory({ connectionId }: { connectionId: string }) {
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

// ─── SnapTrade Connect Dialog ─────────────────────────────────────────
function _SnapTradeConnectDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const getPortalUrl = trpc.integrations.snapTradeGetPortalUrl.useMutation({
    onSuccess: (data) => {
      // Open Connection Portal in new window
      window.open(data.redirectUrl, "_blank", "width=500,height=700");
      onOpenChange(false);
      toast.success("Connection Portal opened — complete the brokerage connection in the new window.");
    },
    onError: (e) => {
      toast.error(e.message);
      setLoading(false);
    },
  });

  const stStatus = trpc.integrations.snapTradeStatus.useQuery(undefined, { enabled: !!user });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Connect Brokerage via SnapTrade
          </DialogTitle>
          <DialogDescription>
            Link your brokerage account to sync portfolio data, positions, and balances automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!stStatus.data?.platformConfigured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>SnapTrade platform credentials not yet configured. An admin must first connect SnapTrade with a clientId + consumerKey.</span>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <h4 className="text-sm font-medium">How it works</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Click "Open Connection Portal" below</li>
              <li>Select your brokerage (Fidelity, Schwab, Alpaca, etc.)</li>
              <li>Log in securely through SnapTrade's portal</li>
              <li>Your accounts and positions will sync automatically</li>
            </ol>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Shield className="h-3.5 w-3.5" />
              <span>Your brokerage credentials are never stored by Stewardly — SnapTrade handles authentication securely.</span>
            </div>
          </div>

          {stStatus.data?.registered && stStatus.data.connectionsCount > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>You have {stStatus.data.connectionsCount} active connection(s) and {stStatus.data.accountsCount} account(s).</span>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={loading || !stStatus.data?.platformConfigured}
            onClick={() => {
              setLoading(true);
              getPortalUrl.mutate({ redirectUrl: window.location.origin + "/integrations?snaptrade_callback=true" });
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Open Connection Portal
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Free tier: 5 brokerage connections per platform.
            <br />
            Powered by{" "}
            <a href="https://snaptrade.com" target="_blank" rel="noopener" className="text-primary underline">
              SnapTrade
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SnapTrade Brokerage Section (user-facing Connection Portal + connected accounts) ───
function SnapTradeBrokerageSection() {
  const { user } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);
  const stStatus = trpc.integrations.snapTradeStatus.useQuery(undefined, { enabled: !!user });
  const stConnections = trpc.integrations.snapTradeConnections.useQuery(undefined, { enabled: !!user && !!stStatus.data?.registered });
  const stAccounts = trpc.integrations.snapTradeAccounts.useQuery(undefined, { enabled: !!user && !!stStatus.data?.registered });
  const syncData = trpc.integrations.snapTradeSyncData.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.accounts} accounts and ${data.positions} positions`);
      stConnections.refetch();
      stAccounts.refetch();
      stStatus.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeConn = trpc.integrations.snapTradeRemoveConnection.useMutation({
    onSuccess: () => {
      toast.success("Brokerage connection removed");
      stConnections.refetch();
      stAccounts.refetch();
      stStatus.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const getPortalUrl = trpc.integrations.snapTradeGetPortalUrl.useMutation({
    onSuccess: (data) => {
      window.open(data.redirectUrl, "_blank", "width=500,height=700");
      toast.success("Connection Portal opened — complete the brokerage connection in the new window.");
      setPortalLoading(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setPortalLoading(false);
    },
  });

  // Don't show if platform credentials aren't configured or user isn't logged in
  if (!user || !stStatus.data?.platformConfigured) return null;

  // Loading skeleton while SnapTrade data resolves
  if (stConnections.isLoading || stAccounts.isLoading) {
    return (
      <Card className="border-emerald-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-44" />
              </div>
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-7 w-14 rounded-md" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeConns = stStatus.data?.registered
    ? (stConnections.data || []).filter((c: any) => c.status !== "deleted")
    : [];
  const accounts = stStatus.data?.registered ? (stAccounts.data || []) : [];

  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-5 w-5 text-emerald-500" />
              Brokerage Connections
            </CardTitle>
            <CardDescription>Connect your brokerage via SnapTrade to sync portfolio data automatically.</CardDescription>
          </div>
          <Button
            size="sm"
            disabled={portalLoading}
            onClick={() => {
              setPortalLoading(true);
              getPortalUrl.mutate({ redirectUrl: window.location.origin + "/integrations?snaptrade_callback=true" });
            }}
          >
            {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
            Connect Brokerage
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeConns.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No brokerage accounts connected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Connect Brokerage" above to link your Fidelity, Schwab, Alpaca, or other brokerage account.</p>
          </div>
        )}
        {activeConns.map((conn: any) => (
          <div key={conn.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{conn.brokerageName || "Brokerage"}</span>
                <Badge variant={conn.status === "active" ? "default" : "secondary"} className="text-xs">
                  {conn.status}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => syncData.mutate()}
                  disabled={syncData.isPending}
                >
                  {syncData.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Remove this brokerage connection?")) {
                      removeConn.mutate({ connectionId: conn.id });
                    }
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {conn.lastSyncAt && (
              <div className="text-xs text-muted-foreground">
                Last synced: {new Date(conn.lastSyncAt).toLocaleString()}
              </div>
            )}
            {/* Show accounts under this connection */}
            {accounts.filter((a: any) => a.connectionId === conn.id).map((acct: any) => (
              <div key={acct.id} className="ml-6 rounded-md bg-muted/50 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{acct.accountName || acct.accountNumber || "Account"}</span>
                  <span className="text-xs text-muted-foreground">{acct.accountType || ""}</span>
                </div>
                {(acct.totalValue || acct.marketValue || acct.cashBalance) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {acct.totalValue ? `Total: $${Number(acct.totalValue).toLocaleString()}` :
                     acct.marketValue ? `Market Value: $${Number(acct.marketValue).toLocaleString()}` :
                     `Cash: $${Number(acct.cashBalance).toLocaleString()}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── SOFR / Premium Finance Rate Dashboard ─────────────────────────────
function SOFRDashboard() {
  const latestRates = trpc.verification.getLatestRates.useQuery(undefined, { retry: 2, retryDelay: (i: number) => Math.min(1000 * 2 ** i, 8000) });
  const rateHistory = trpc.verification.getRateHistory.useQuery({ days: 30 }, { retry: 2, retryDelay: (i: number) => Math.min(1000 * 2 ** i, 8000) });
  const refreshRates = trpc.verification.refreshRates.useMutation({
    onSuccess: () => { toast.success("Rates refreshed"); latestRates.refetch(); rateHistory.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  // Loading skeleton while rate data resolves
  if (latestRates.isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-44" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-lg border p-3 text-center space-y-2">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-6 w-14 mx-auto" />
              </div>
            ))}
          </div>
          <Skeleton className="h-16 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const rates = latestRates.data;
  const history = rateHistory.data || [];
  const sofrHistory = history.map((r: any) => parseFloat(r.sofr || "0")).filter((v: number) => v > 0);
  const maxSofr = Math.max(...sofrHistory, 0.01);
  const minSofr = Math.min(...sofrHistory, 0);
  const range = maxSofr - minSofr || 0.01;
  const rateCards = [
    { label: "SOFR", value: rates?.sofr, icon: TrendingUp },
    { label: "SOFR 30-Day", value: rates?.sofr30, icon: TrendingUp },
    { label: "SOFR 90-Day", value: rates?.sofr90, icon: TrendingUp },
    { label: "10Y Treasury", value: rates?.treasury10y, icon: Activity },
    { label: "30Y Treasury", value: rates?.treasury30y, icon: Activity },
    { label: "Prime Rate", value: rates?.primeRate, icon: TrendingDown },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Premium Finance Rates</CardTitle>
          <CardDescription>SOFR and benchmark rates for premium financing calculations</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshRates.mutate()} disabled={refreshRates.isPending}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshRates.isPending ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {!rates ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No rate data yet. Click Refresh to fetch latest rates.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {rateCards.map((rc) => {
                const Icon = rc.icon;
                return (
                  <div key={rc.label} className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Icon className="h-3 w-3" />{rc.label}</div>
                    <div className="text-lg font-bold">{rc.value ? `${parseFloat(rc.value).toFixed(2)}%` : "—"}</div>
                  </div>
                );
              })}
            </div>
            {sofrHistory.length > 1 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">SOFR 30-Day Trend</div>
                <div className="flex items-end gap-[2px] h-16">
                  {sofrHistory.map((v: number, i: number) => (
                    <div key={i} className="flex-1 bg-primary/70 rounded-t-sm hover:bg-primary transition-colors" style={{ height: `${Math.max(4, ((v - minSofr) / range) * 100)}%` }} title={`${v.toFixed(4)}%`} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{minSofr.toFixed(2)}%</span><span>{maxSofr.toFixed(2)}%</span>
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-3">Last updated: {rates.fetchedAt ? new Date(rates.fetchedAt).toLocaleString() : "Unknown"}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CRM Sync Status Panel ──────────────────────────────────────────────
function CRMSyncPanel() {
  const syncStats = trpc.operations.crm.stats.useQuery(undefined, { retry: 2, retryDelay: (i: number) => Math.min(1000 * 2 ** i, 8000) });
  const crmConns = trpc.operations.crm.connections.useQuery(undefined, { retry: 2, retryDelay: (i: number) => Math.min(1000 * 2 ** i, 8000) });
  // Loading skeleton while CRM data resolves
  if (syncStats.isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-lg border p-3 text-center space-y-2">
                <Skeleton className="h-3 w-14 mx-auto" />
                <Skeleton className="h-7 w-10 mx-auto" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = syncStats.data;
  const conns = crmConns.data || [];
  const providerColors: Record<string, string> = {
    salesforce: "bg-blue-500", hubspot: "bg-orange-500", dynamics: "bg-indigo-500", zoho: "bg-red-500", custom: "bg-gray-500",
  };
  const statusIcons: Record<string, typeof CheckCircle2> = {
    connected: CheckCircle2, disconnected: Unlink, error: XCircle, syncing: RefreshCw,
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> CRM Sync Status</CardTitle>
        <CardDescription>Bidirectional CRM synchronization overview</CardDescription>
      </CardHeader>
      <CardContent>
        {!stats || stats.totalConnections === 0 ? (
          <div className="text-center py-6">
            <ArrowLeftRight className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No CRM connections configured yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Connect Salesforce, HubSpot, or other CRMs from the Org Admin panel.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{stats.totalConnections}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Active</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-green-600">{stats.activeConnections}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Records Synced</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{stats.totalRecordsSynced.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Errors</div>
                <div className={`text-2xl font-bold font-mono tabular-nums ${stats.totalErrors > 0 ? "text-red-500" : ""}`}>{stats.totalErrors}</div>
              </div>
            </div>
            <div className="space-y-2">
              {conns.map((conn: any) => {
                const StatusIcon = statusIcons[conn.status] || Clock;
                return (
                  <div key={conn.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${providerColors[conn.provider] || "bg-gray-400"}`} />
                      <div>
                        <div className="text-sm font-medium capitalize">{conn.provider}</div>
                        <div className="text-xs text-muted-foreground">{conn.syncDirection} · {conn.syncFrequency}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{conn.recordsSynced} records</span>
                      <StatusIcon className={`h-4 w-4 ${conn.status === "connected" ? "text-green-500" : conn.status === "error" ? "text-red-500" : "text-muted-foreground"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Client Account Connections (Plaid Link + Canopy Connect) ────────────
function ClientAccountConnections() {
  const { user } = useAuth();
  const connections = trpc.integrations.listConnections.useQuery(undefined, { enabled: !!user });
  const providers = trpc.integrations.listProviders.useQuery();

  // Find Plaid and Canopy providers
  const providersList = Array.isArray(providers.data) ? providers.data : (providers.data as any)?.providers;
  const connectionsList = Array.isArray(connections.data) ? connections.data : [];
  const plaidProvider = (providersList as Provider[] | undefined)?.find(p => p.slug === "plaid");
  const canopyProvider = (providersList as Provider[] | undefined)?.find(p => p.slug === "canopy-connect");
  const plaidConn = (connectionsList as Connection[] | undefined)?.find((c: any) => c.providerId === plaidProvider?.id);
  const canopyConn = (connectionsList as Connection[] | undefined)?.find((c: any) => c.providerId === canopyProvider?.id);

  // Loading skeleton while queries resolve
  if (providers.isLoading || connections.isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="flex items-center gap-1.5">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!user) return null;

  const accounts = [
    {
      key: "plaid",
      name: "Plaid",
      description: "Link bank accounts, credit cards, and investment accounts to sync transactions and balances automatically.",
      icon: <Briefcase className="h-5 w-5 text-blue-500" />,
      color: "border-blue-500/20",
      features: ["Transaction history", "Account balances", "Investment holdings", "Income verification"],
      connection: plaidConn,
      provider: plaidProvider,
      setupUrl: "https://dashboard.plaid.com",
      howItWorks: [
        "Your organization admin configures Plaid credentials",
        "You click \"Link Account\" and select your bank",
        "Log in securely through Plaid's portal",
        "Transactions and balances sync automatically",
      ],
    },
    {
      key: "canopy",
      name: "Canopy Connect",
      description: "Aggregate insurance policy data across carriers for a complete view of your coverage.",
      icon: <Shield className="h-5 w-5 text-purple-500" />,
      color: "border-purple-500/20",
      features: ["Policy aggregation", "Coverage verification", "Premium tracking", "Renewal alerts"],
      connection: canopyConn,
      provider: canopyProvider,
      setupUrl: "https://www.usecanopy.com",
      howItWorks: [
        "Your organization admin configures Canopy Connect credentials",
        "You click \"Connect Policies\" and select your carriers",
        "Authorize access to your policy data",
        "All your insurance policies appear in one dashboard",
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5 text-emerald-500" />
          Client Account Connections
        </CardTitle>
        <CardDescription>
          Link your personal financial accounts to enable AI-powered insights, automated tracking, and comprehensive financial planning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.map(acct => {
          const isConnected = acct.connection?.status === "connected";
          const isPending = acct.connection?.status === "pending";
          const providerConfigured = !!acct.provider;

          return (
            <div key={acct.key} className={`rounded-lg border ${acct.color} p-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {acct.icon}
                  <div>
                    <h4 className="text-sm font-semibold">{acct.name}</h4>
                    <p className="text-xs text-muted-foreground max-w-md">{acct.description}</p>
                  </div>
                </div>
                {isConnected ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : isPending ? (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Unlink className="h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2">
                {acct.features.map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className={`h-3 w-3 ${isConnected ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                    {f}
                  </div>
                ))}
              </div>

              {/* How it works */}
              {!isConnected && (
                <div className="rounded-md bg-muted/50 p-3 space-y-2">
                  <h5 className="text-xs font-medium">How it works</h5>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    {acct.howItWorks.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Connection status details */}
              {isConnected && acct.connection && (
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <span>Last synced: {acct.connection.lastSyncAt ? new Date(acct.connection.lastSyncAt).toLocaleString() : "Never"}</span>
                  <span>{acct.connection.recordsSynced || 0} records synced</span>
                </div>
              )}

              {/* Action button */}
              {!providerConfigured ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>Not yet configured by your organization admin. Contact your advisor to enable {acct.name}.</span>
                  </div>
                </div>
              ) : !isConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.info(`${acct.name} Link flow coming soon. Your organization admin needs to complete the setup first.`)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  {acct.key === "plaid" ? "Link Bank Account" : "Connect Insurance Policies"}
                </Button>
              ) : null}

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                <Shield className="h-3 w-3" />
                <span>Your credentials are never stored by Stewardly — {acct.name} handles authentication securely.</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Main Integrations Page ────────────────────────────────────────────
export default function Integrations() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [connectProvider, setConnectProvider] = useState<Provider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [_selectedConnection, _setSelectedConnection] = useState<string | null>(null);

  // Queries
  const { data: providersData, isLoading: loadingProviders } = trpc.integrations.listProviders.useQuery(
    tierFilter === "all" ? {} : { ownershipTier: tierFilter }
  );
  const providers = providersData?.providers;
  const { data: connections, isLoading: _loadingConnections, refetch: refetchConnections } = trpc.integrations.listConnections.useQuery(
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
    <AppShell title="Integrations">
      <SEOHead title="Integrations" description="Connect external services and data sources" />
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center gap-2 sm:gap-3 h-14">
          <Link href="/chat">
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to chat">
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
            <div className="text-2xl font-bold font-mono tabular-nums">{providers?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Available Providers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-500">{connectedCount}</div>
            <div className="text-xs text-muted-foreground">Active Connections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold font-mono tabular-nums">{totalRecords.toLocaleString()}</div>
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
              platform: { label: "Platform Data Sources", desc: "Government economic data and brokerage infrastructure — configured by admins" },
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

      {/* Client Account Connections (Plaid Link + Canopy Connect) */}
      <SectionErrorBoundary
        sectionName="Client Account Connections"
        onRetry={() => {
          utils.integrations.listProviders.invalidate();
          utils.integrations.listConnections.invalidate();
        }}
      >
        <ClientAccountConnections />
      </SectionErrorBoundary>

      {/* SnapTrade Brokerage Connections */}
      <SectionErrorBoundary
        sectionName="SnapTrade Brokerage"
        onRetry={() => {
          utils.integrations.snapTradeStatus.invalidate();
          utils.integrations.snapTradeConnections.invalidate();
          utils.integrations.snapTradeAccounts.invalidate();
        }}
      >
        <SnapTradeBrokerageSection />
      </SectionErrorBoundary>

      {/* Premium Finance Rates / SOFR Dashboard */}
      <SectionErrorBoundary
        sectionName="Premium Finance Rates"
        onRetry={() => {
          utils.verification.getLatestRates.invalidate();
          utils.verification.getRateHistory.invalidate();
        }}
      >
        <SOFRDashboard />
      </SectionErrorBoundary>

      {/* CRM Sync Status Panel */}
      <SectionErrorBoundary
        sectionName="CRM Sync"
        onRetry={() => {
          utils.operations.crm.stats.invalidate();
          utils.operations.crm.connections.invalidate();
        }}
      >
        <CRMSyncPanel />
      </SectionErrorBoundary>

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
    </AppShell>
  );
}
