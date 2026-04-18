/**
 * FinancialDataHub — Unified financial data dashboard with adapter health,
 * macro snapshot, PFM import wizard, and data authorization manager.
 *
 * Pass 122: Fixed all procedure name mismatches and data shape alignment.
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
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2, Database, Activity, TrendingUp, Upload,
  Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  FileText, BarChart3, Globe, Lock, Unlock, Clock, Zap,
  DollarSign, Percent, Users, LogIn,
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
  not_configured: <Clock className="w-4 h-4 text-muted-foreground" />,
  offline: <XCircle className="w-4 h-4 text-red-400" />,
  unknown: <Clock className="w-4 h-4 text-muted-foreground" />,
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.openId?.startsWith("guest_")) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <LogIn className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Sign in to access this feature.</p>
      </div>
    );
  }
  return <>{children}</>;
}

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
        <TabsContent value="pfm"><AuthGate><PfmImportWizard /></AuthGate></TabsContent>
        <TabsContent value="auth"><AuthGate><AuthorizationManager /></AuthGate></TabsContent>
        <TabsContent value="audit"><AuthGate><AuditTrail /></AuthGate></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── ADAPTER DASHBOARD ───────────────────────────────────── */
function AdapterDashboard() {
  const healthQ = trpc.financialData.adapterHealth.useQuery(undefined, { refetchInterval: 60_000 });
  const adaptersQ = trpc.financialData.listAdapters.useQuery();

  // healthQ.data = { adapters: [...], summary: { total, healthy, degraded, notConfigured, offline } }
  const healthAdapters = healthQ.data?.adapters ?? [];
  const healthSummary = healthQ.data?.summary;
  const healthMap = new Map(healthAdapters.map((h: any) => [h.id, h]));

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
      ) : adaptersQ.isError ? (
        <div className="text-sm text-red-400">Failed to load adapters: {adaptersQ.error?.message}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(adaptersQ.data ?? []).map((adapter: any) => {
            const health = healthMap.get(adapter.id);
            const status = health?.status ?? "unknown";
            return (
              <Card key={adapter.id} className="bg-card/60 border-border/40 hover:border-accent/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusIcon[status] ?? statusIcon.unknown}
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
                    {(adapter.supportedActions ?? []).slice(0, 4).map((c: string) => (
                      <Badge key={c} variant="secondary" className="text-[9px] px-1 py-0">{c}</Badge>
                    ))}
                    {(adapter.supportedActions ?? []).length > 4 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">+{adapter.supportedActions.length - 4}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {healthSummary && (
        <div className="grid grid-cols-4 gap-3 mt-4">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Healthy</p>
              <p className="text-2xl font-bold text-emerald-400">{healthSummary.healthy}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Degraded</p>
              <p className="text-2xl font-bold text-amber-400">{healthSummary.degraded}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/10 border-border/30">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Not Configured</p>
              <p className="text-2xl font-bold text-muted-foreground">{healthSummary.notConfigured}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Offline</p>
              <p className="text-2xl font-bold text-red-400">{healthSummary.offline}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── MACRO SNAPSHOT ──────────────────────────────────────── */
/* ─── MACRO VALUE EXTRACTION ─────────────────────────────── */
function extractFredLatest(raw: any): { value: string; date: string; unit: string } | null {
  if (!raw || !raw.observations || !raw.observations.length) return null;
  const obs = raw.observations[0];
  return {
    value: typeof obs.value === "number" ? obs.value.toFixed(2) : String(obs.value),
    date: obs.date || "",
    unit: raw.units || "",
  };
}

function extractTreasuryLatest(raw: any): { value: string; date: string } | null {
  if (!raw || !Array.isArray(raw) || !raw.length) return null;
  // Find the first 10-year note
  const tenYr = raw.find((r: any) => (r.security_desc || "").toLowerCase().includes("10-year"));
  if (tenYr) return { value: parseFloat(tenYr.avg_interest_rate_amt).toFixed(2), date: tenYr.record_date };
  // Fallback to first record
  const first = raw[0];
  return { value: parseFloat(first.avg_interest_rate_amt).toFixed(2), date: first.record_date };
}

function extractBlsLatest(raw: any): { value: string; date: string } | null {
  // BLS series query returns: [{seriesId, data: [{year, period, periodName, value, ...}]}]
  if (!raw) return null;
  let series: any[] | null = null;
  if (Array.isArray(raw) && raw.length > 0 && raw[0]?.data) {
    series = raw[0].data;
  } else if (raw.data && Array.isArray(raw.data)) {
    series = raw.data;
  }
  if (!series || !series.length) return null;
  const d = series[0];
  // BLS nonfarm payrolls are in thousands
  const val = typeof d.value === "number" ? d.value : parseInt(d.value, 10);
  return {
    value: isNaN(val) ? String(d.value) : `${(val / 1000).toFixed(1)}M`,
    date: `${d.periodName} ${d.year}`,
  };
}

function MacroSnapshot() {
  const macroQ = trpc.financialData.macroSnapshot.useQuery(undefined, { staleTime: 5 * 60_000 });

  if (macroQ.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading macro indicators...</div>;
  }
  if (macroQ.isError) {
    return <div className="text-sm text-red-400 mt-4">Failed to load macro data: {macroQ.error?.message}</div>;
  }

  const data = macroQ.data as Record<string, any> | undefined;
  if (!data) return <div className="text-muted-foreground mt-4">No macro data available.</div>;

  // Extract display values from each data source
  const fedFunds = extractFredLatest(data.fedFundsRate);
  const cpi = extractFredLatest(data.cpi);
  const unemployment = extractFredLatest(data.unemployment);
  const treasury = extractTreasuryLatest(data.treasuryYields);
  const nonfarm = extractBlsLatest(data.totalNonfarmPayrolls);

  const indicators = [
    { label: "Fed Funds Rate", value: fedFunds?.value ?? "—", sub: fedFunds ? `${fedFunds.date} · ${fedFunds.unit}` : "", icon: Percent, color: "text-blue-400" },
    { label: "CPI Index", value: cpi?.value ?? "—", sub: cpi ? `${cpi.date} · ${cpi.unit}` : "", icon: TrendingUp, color: "text-amber-400" },
    { label: "Unemployment", value: unemployment?.value ? `${unemployment.value}%` : "—", sub: unemployment?.date ?? "", icon: Users, color: "text-red-400" },
    { label: "10-Yr Treasury", value: treasury?.value ? `${treasury.value}%` : "—", sub: treasury?.date ?? "", icon: BarChart3, color: "text-emerald-400" },
    { label: "Nonfarm Payrolls", value: nonfarm?.value ?? "—", sub: nonfarm?.date ?? "", icon: DollarSign, color: "text-cyan-400" },
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
              <p className="text-lg font-bold">{ind.value}</p>
              {ind.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{ind.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        Live data from FRED, US Treasury, BLS via adapter registry
      </p>
    </div>
  );
}

/* ─── PFM IMPORT WIZARD ───────────────────────────────────── */
function PfmImportWizard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFormat, setSelectedFormat] = useState("auto");
  const [uploading, setUploading] = useState(false);

  // Correct procedure name: importPfmCsv (not importPfm)
  const importMut = trpc.financialData.importPfmCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.totalTransactions} transactions (source: ${data.detectedSource})`);
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
        // Correct field name: sourceHint (not format)
        sourceHint: selectedFormat === "auto" ? undefined : selectedFormat as any,
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
                  <SelectItem value="everydollar">EveryDollar</SelectItem>
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
          ) : historyQ.isError ? (
            <p className="text-xs text-red-400">Failed to load history: {historyQ.error?.message}</p>
          ) : (historyQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No imports yet. Upload a CSV to get started.</p>
          ) : (
            <div className="space-y-2">
              {(historyQ.data ?? []).map((imp: any) => (
                <div key={imp.id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/30">
                  <div>
                    <p className="text-xs font-medium">{imp.filename || "Unknown file"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {imp.source} &middot; {imp.totalRows ?? imp.importedRows ?? "?"} rows &middot; {imp.createdAt ? new Date(imp.createdAt).toLocaleDateString() : ""}
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

  // Correct procedure names: getDataAuths, grantDataAuth, revokeDataAuth
  const authsQ = trpc.financialData.getDataAuths.useQuery(
    { clientId: cid },
    { enabled: true }
  );
  const grantMut = trpc.financialData.grantDataAuth.useMutation({
    onSuccess: () => { toast.success("Authorization granted"); authsQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMut = trpc.financialData.revokeDataAuth.useMutation({
    onSuccess: () => { toast.success("Authorization revoked"); authsQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [grantForm, setGrantForm] = useState({
    clientId: "",
    dataScope: "financial_planning",
    consentLanguage: "",
    stateJurisdiction: "",
  });

  return (
    <div className="space-y-4 mt-4">
      {/* Grant New */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" /> Grant Data Authorization
          </CardTitle>
          <CardDescription className="text-xs">
            Authorize data access for a client with defined scope and consent language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label className="text-xs">Data Scope</Label>
              <Select value={grantForm.dataScope} onValueChange={v => setGrantForm(f => ({ ...f, dataScope: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial_planning">Financial Planning</SelectItem>
                  <SelectItem value="investment_analysis">Investment Analysis</SelectItem>
                  <SelectItem value="tax_preparation">Tax Preparation</SelectItem>
                  <SelectItem value="insurance_review">Insurance Review</SelectItem>
                  <SelectItem value="estate_planning">Estate Planning</SelectItem>
                  <SelectItem value="full_access">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Consent Language (optional)</Label>
              <Input
                value={grantForm.consentLanguage}
                onChange={e => setGrantForm(f => ({ ...f, consentLanguage: e.target.value }))}
                placeholder="e.g. Client authorized via signed form"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">State Jurisdiction (optional)</Label>
              <Input
                value={grantForm.stateJurisdiction}
                onChange={e => setGrantForm(f => ({ ...f, stateJurisdiction: e.target.value }))}
                placeholder="e.g. CA, NY, TX"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const cid = parseInt(grantForm.clientId);
              if (!cid) { toast.error("Enter a valid Client ID"); return; }
              grantMut.mutate({
                clientId: cid,
                dataScope: grantForm.dataScope,
                consentLanguage: grantForm.consentLanguage || undefined,
                stateJurisdiction: grantForm.stateJurisdiction || undefined,
              });
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
          ) : authsQ.isError ? (
            <p className="text-xs text-red-400">Failed to load authorizations: {authsQ.error?.message}</p>
          ) : (authsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No authorizations found.</p>
          ) : (
            <div className="space-y-2">
              {(authsQ.data ?? []).map((auth: any) => (
                <div key={auth.id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/30">
                  <div>
                    <p className="text-xs font-medium">Client #{auth.clientId} &mdash; {auth.dataScope}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Status: {auth.status} &middot; Granted: {auth.grantedAt ? new Date(auth.grantedAt).toLocaleDateString() : "—"}
                      {auth.stateJurisdiction && ` · ${auth.stateJurisdiction}`}
                    </p>
                  </div>
                  {auth.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 text-xs"
                      onClick={() => revokeMut.mutate({ authorizationId: auth.id })}
                      disabled={revokeMut.isPending}
                    >
                      Revoke
                    </Button>
                  )}
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
      ) : auditQ.isError ? (
        <div className="text-sm text-red-400">Failed to load audit trail: {auditQ.error?.message}</div>
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
                <Badge
                  variant={entry.responseStatus === "success" ? "secondary" : "destructive"}
                  className="ml-1 text-[9px] px-1 py-0"
                >
                  {entry.responseStatus}
                </Badge>
                {entry.latencyMs != null && (
                  <span className="text-muted-foreground ml-1">{entry.latencyMs}ms</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
