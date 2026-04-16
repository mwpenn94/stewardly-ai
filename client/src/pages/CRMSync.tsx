/**
 * CRMSync — CRM integration dashboard.
 *
 * Wired to:
 * - crm.sync mutation (real Wealthbox/Salesforce/Redtail sync)
 * - crm.syncHistory query (real sync log from crm_sync_log table)
 * - crm.providers query (aggregated provider status from sync log)
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, Database, ArrowLeftRight, Settings2, History, Loader2 } from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

export default function CRMSync() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, navigate] = useLocation();
  const [autoSync, setAutoSync] = useState(true);
  const [provider, setProvider] = useState<"wealthbox" | "salesforce" | "redtail">("wealthbox");
  const [direction, setDirection] = useState<"pull" | "push" | "bidirectional">("pull");

  const utils = trpc.useUtils();

  const syncHistory = trpc.crm.syncHistory.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  const providers = trpc.crm.providers.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

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
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const handleSync = () => {
    syncMut.mutate({ provider, direction });
  };

  const historyRows = (syncHistory.data ?? []) as any[];
  const providerRows = (providers.data ?? []) as any[];

  // Derive provider cards from real data, with fallback display
  const providerMap: Record<string, { status: string; lastSync: string; totalSynced: number }> = {};
  for (const p of providerRows) {
    providerMap[p.provider] = {
      status: p.lastStatus ?? "unknown",
      lastSync: p.lastSync ? new Date(p.lastSync).toLocaleString() : "Never",
      totalSynced: Number(p.totalSynced) || 0,
    };
  }

  return (
    <AppShell title="CRM Sync">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="CRM Sync" description="Manage CRM integration and data synchronization" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CRM Sync</h1>
            <p className="text-sm text-muted-foreground">Wealthbox, Salesforce, and Redtail integration management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wealthbox">Wealthbox</SelectItem>
              <SelectItem value="salesforce">Salesforce</SelectItem>
              <SelectItem value="redtail">Redtail</SelectItem>
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

      {/* Provider status cards — derived from real sync log data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["wealthbox", "salesforce", "redtail"] as const).map((prov) => {
          const info = providerMap[prov];
          const statusIcon = info?.status === "completed"
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : info?.status === "failed"
            ? <AlertTriangle className="h-4 w-4 text-red-400" />
            : <Database className="h-4 w-4 text-muted-foreground" />;
          return (
            <Card key={prov}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {statusIcon}
                  <span className="text-sm font-medium capitalize">{prov}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {info ? `Last sync: ${info.lastSync}` : "No syncs recorded"}
                </p>
                <p className="text-lg font-bold mt-1">
                  {info ? `${info.totalSynced} records` : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="mappings"><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Field Mappings</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
        </TabsList>

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
            </CardContent>
          </Card>
        </TabsContent>

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
                <div className="space-y-3">
                  {historyRows.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">
                            {h.recordsSynced ?? 0} records • {h.direction} • {h.crmProvider}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.status === "failed" ? (
                          <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Failed</Badge>
                        ) : h.status === "completed" ? (
                          <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">Clean</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">{h.status}</Badge>
                        )}
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
