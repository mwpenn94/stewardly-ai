/**
 * FinancialDataHub — Unified financial data dashboard with adapter health,
 * macro snapshot, PFM import wizard, and data authorization manager.
 */
import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2, Database, Activity, TrendingUp, TrendingDown, Upload,
  Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  FileText, BarChart3, Globe, Lock, Unlock, Clock, Zap,
  DollarSign, Percent, Users, ArrowRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

/* ─── HELPERS ─────────────────────────────────────────────── */
const tierColor: Record<string, string> = {
  free: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  freemium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  paid: "bg-red-500/20 text-red-400 border-red-500/30",
};
const statusIcon: Record<string, React.ReactNode> = {
  healthy: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  degraded: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  down: <XCircle className="w-4 h-4 text-red-400" />,
  unknown: <Clock className="w-4 h-4 text-muted-foreground" />,
};

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
export default function FinancialDataHub() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" /> Financial Data Hub
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Unified access to 12+ financial data sources, PFM imports, and macro indicators.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="dashboard" className="gap-1 text-xs"><Activity className="w-3 h-3" /> Dashboard</TabsTrigger>
          <TabsTrigger value="macro" className="gap-1 text-xs"><Globe className="w-3 h-3" /> Macro Snapshot</TabsTrigger>
          <TabsTrigger value="pfm" className="gap-1 text-xs"><Upload className="w-3 h-3" /> PFM Import</TabsTrigger>
          <TabsTrigger value="auth" className="gap-1 text-xs"><Shield className="w-3 h-3" /> Authorizations</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1 text-xs"><FileText className="w-3 h-3" /> Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><AdapterDashboard /></TabsContent>
        <TabsContent value="macro"><MacroSnapshot /></TabsContent>
        <TabsContent value="pfm"><PfmImportWizard /></TabsContent>
        <TabsContent value="auth"><AuthorizationManager /></TabsContent>
        <TabsContent value="audit"><AuditTrail /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── ADAPTER DASHBOARD ───────────────────────────────────── */
function AdapterDashboard() {
  const healthQ = trpc.financialData.adapterHealth.useQuery(undefined, { refetchInterval: 60_000 });
  const adaptersQ = trpc.financialData.listAdapters.useQuery();

  const healthMap = new Map((healthQ.data ?? []).map(h => [h.id, h]));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Data Sources</h3>
        <Button variant="ghost" size="sm" onClick={() => healthQ.refetch()} disabled={healthQ.isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${healthQ.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {adaptersQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading adapters...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(adaptersQ.data ?? []).map(adapter => {
            const health = healthMap.get(adapter.id);
            const status = health?.status ?? "unknown";
            return (
              <Card key={adapter.id} className="bg-card/60 border-border/40 hover:border-accent/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon[status]}
                      <span className="font-medium text-sm">{adapter.name}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${tierColor[adapter.tier] ?? ""}`}>
                      {adapter.tier}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{adapter.description}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {adapter.requiresKey ? (
                      <span className="flex items-center gap-0.5"><Lock className="w-3 h-3" /> API Key Required</span>
                    ) : (
                      <span className="flex items-center gap-0.5"><Unlock className="w-3 h-3" /> No Key Needed</span>
                    )}
                    {health?.latencyMs != null && (
                      <span className="flex items-center gap-0.5"><Zap className="w-3 h-3" /> {health.latencyMs}ms</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {adapter.capabilities.slice(0, 4).map(c => (
                      <Badge key={c} variant="secondary" className="text-[9px] px-1 py-0">{c}</Badge>
                    ))}
                    {adapter.capabilities.length > 4 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">+{adapter.capabilities.length - 4}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {healthQ.data && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Healthy</p>
              <p className="text-2xl font-bold text-emerald-400">
                {healthQ.data.filter(h => h.status === "healthy").length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Degraded</p>
              <p className="text-2xl font-bold text-amber-400">
                {healthQ.data.filter(h => h.status === "degraded").length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Down</p>
              <p className="text-2xl font-bold text-red-400">
                {healthQ.data.filter(h => h.status === "down").length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── MACRO SNAPSHOT ──────────────────────────────────────── */
function MacroSnapshot() {
  const macroQ = trpc.financialData.macroSnapshot.useQuery(undefined, { staleTime: 5 * 60_000 });

  if (macroQ.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading macro indicators...</div>;
  }

  const data = macroQ.data;
  if (!data) return <div className="text-muted-foreground mt-4">No macro data available.</div>;

  const indicators = [
    { label: "Fed Funds Rate", value: data.fedFundsRate, suffix: "%", icon: Percent, color: "text-blue-400" },
    { label: "CPI (YoY)", value: data.cpiYoY, suffix: "%", icon: TrendingUp, color: "text-amber-400" },
    { label: "Unemployment", value: data.unemploymentRate, suffix: "%", icon: Users, color: "text-red-400" },
    { label: "10Y Treasury", value: data.treasury10Y, suffix: "%", icon: BarChart3, color: "text-emerald-400" },
    { label: "GDP Growth", value: data.gdpGrowth, suffix: "%", icon: DollarSign, color: "text-purple-400" },
    { label: "Nonfarm Payrolls", value: data.nonfarmPayrolls, suffix: "K", icon: Users, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Key Economic Indicators</h3>
        <Button variant="ghost" size="sm" onClick={() => macroQ.refetch()} disabled={macroQ.isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${macroQ.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {indicators.map(ind => (
          <Card key={ind.label} className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ind.icon className={`w-4 h-4 ${ind.color}`} />
                <span className="text-xs text-muted-foreground">{ind.label}</span>
              </div>
              <p className="text-xl font-bold">
                {ind.value != null ? `${ind.value}${ind.suffix}` : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.lastUpdated && (
        <p className="text-[10px] text-muted-foreground text-right">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ─── PFM IMPORT WIZARD ───────────────────────────────────── */
function PfmImportWizard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFormat, setSelectedFormat] = useState("auto");
  const [uploading, setUploading] = useState(false);

  const importMut = trpc.financialData.importPfm.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.rowsImported} transactions from ${data.detectedFormat}`);
      historyQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const historyQ = trpc.financialData.pfmHistory.useQuery();

  const handleUpload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Please select a CSV file"); return; }
    if (!file.name.endsWith(".csv")) { toast.error("Only CSV files are supported"); return; }

    setUploading(true);
    try {
      const text = await file.text();
      await importMut.mutateAsync({
        csvContent: text,
        filename: file.name,
        format: selectedFormat === "auto" ? undefined : selectedFormat,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [selectedFormat, importMut]);

  return (
    <div className="space-y-4 mt-4">
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-accent" /> Import Transactions
          </CardTitle>
          <CardDescription className="text-xs">
            Upload CSV exports from Mint, Empower, Monarch, YNAB, or any standard format.
            The system auto-detects the format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CSV File</Label>
              <Input ref={fileRef} type="file" accept=".csv" className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Format (optional)</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="mint">Mint</SelectItem>
                  <SelectItem value="empower">Empower (Personal Capital)</SelectItem>
                  <SelectItem value="monarch">Monarch Money</SelectItem>
                  <SelectItem value="ynab">YNAB</SelectItem>
                  <SelectItem value="quicken">Quicken</SelectItem>
                  <SelectItem value="generic">Generic CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading || importMut.isPending} size="sm">
            {(uploading || importMut.isPending) ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Importing...</>
            ) : (
              <><Upload className="w-3 h-3 mr-1" /> Import</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (historyQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No imports yet. Upload a CSV to get started.</p>
          ) : (
            <div className="space-y-2">
              {(historyQ.data ?? []).map((imp: any) => (
                <div key={imp.id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/30">
                  <div>
                    <p className="text-xs font-medium">{imp.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {imp.detectedFormat} &middot; {imp.rowCount} rows &middot; {new Date(imp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={imp.status === "completed" ? "default" : imp.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                    {imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AUTHORIZATION MANAGER ───────────────────────────────── */
function AuthorizationManager() {
  const [clientId, setClientId] = useState("");
  const cid = parseInt(clientId) || undefined;

  const authsQ = trpc.financialData.listAuthorizations.useQuery({ clientId: cid });
  const grantMut = trpc.financialData.grantAuthorization.useMutation({
    onSuccess: () => { toast.success("Authorization granted"); authsQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMut = trpc.financialData.revokeAuthorization.useMutation({
    onSuccess: () => { toast.success("Authorization revoked"); authsQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [grantForm, setGrantForm] = useState({ clientId: "", adapterId: "", scope: "read" });

  return (
    <div className="space-y-4 mt-4">
      {/* Grant New */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" /> Grant Data Authorization
          </CardTitle>
          <CardDescription className="text-xs">
            Authorize a client to access specific data sources with defined scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Client ID</Label>
              <Input
                value={grantForm.clientId}
                onChange={e => setGrantForm(f => ({ ...f, clientId: e.target.value }))}
                placeholder="e.g. 42"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Adapter ID</Label>
              <Input
                value={grantForm.adapterId}
                onChange={e => setGrantForm(f => ({ ...f, adapterId: e.target.value }))}
                placeholder="e.g. fred"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Scope</Label>
              <Select value={grantForm.scope} onValueChange={v => setGrantForm(f => ({ ...f, scope: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="write">Read + Write</SelectItem>
                  <SelectItem value="admin">Full Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const cid = parseInt(grantForm.clientId);
              if (!cid || !grantForm.adapterId) { toast.error("Fill all fields"); return; }
              grantMut.mutate({ clientId: cid, adapterId: grantForm.adapterId, scope: grantForm.scope });
            }}
            disabled={grantMut.isPending}
          >
            {grantMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
            Grant Authorization
          </Button>
        </CardContent>
      </Card>

      {/* Active Authorizations */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Active Authorizations</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Filter by client ID"
                className="w-32 text-xs h-7"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {authsQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (authsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No authorizations found.</p>
          ) : (
            <div className="space-y-2">
              {(authsQ.data ?? []).map((auth: any) => (
                <div key={auth.id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/30">
                  <div>
                    <p className="text-xs font-medium">Client #{auth.clientId} &rarr; {auth.adapterId}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Scope: {auth.scope} &middot; Granted: {new Date(auth.grantedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 text-xs"
                    onClick={() => revokeMut.mutate({ authorizationId: auth.id })}
                    disabled={revokeMut.isPending}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AUDIT TRAIL ─────────────────────────────────────────── */
function AuditTrail() {
  const auditQ = trpc.financialData.auditTrail.useQuery({ limit: 50 });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Data Access Audit Trail</h3>
        <Button variant="ghost" size="sm" onClick={() => auditQ.refetch()} disabled={auditQ.isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${auditQ.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {auditQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading audit trail...</div>
      ) : (auditQ.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No audit entries yet. Data access events will appear here.</p>
      ) : (
        <div className="space-y-1">
          {(auditQ.data ?? []).map((entry: any) => (
            <div key={entry.id} className="flex items-center gap-3 p-2 rounded bg-background/50 border border-border/30 text-xs">
              <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{entry.adapterId}</span>
                <span className="text-muted-foreground"> &middot; {entry.action}</span>
                {entry.statusCode && (
                  <Badge variant={entry.statusCode < 400 ? "secondary" : "destructive"} className="ml-1 text-[9px] px-1 py-0">
                    {entry.statusCode}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
