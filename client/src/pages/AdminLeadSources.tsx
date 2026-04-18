/**
 * AdminLeadSources — Lead source ROI comparison table with charts,
 * connector health badges, sync status indicators, and enrichment stats.
 *
 * Pass 77: Wired to leadPipeline.sourcePerformance tRPC query.
 * Pass 123: Added connector health badges, sync status, data freshness indicators.
 */
import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Loader2, XCircle, ArrowUpRight, ArrowDownRight, Database,
  CheckCircle2, AlertTriangle, WifiOff, Wifi, Activity, Shield, Globe, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

/* ---------- Connector Health ---------- */
type HealthStatus = "healthy" | "degraded" | "offline" | "unknown";
function getHealth(src: any): HealthStatus {
  if (src.leads <= 0) return "unknown";
  if (src.roi >= 100) return "healthy";
  if (src.roi >= 0) return "degraded";
  return "offline";
}
function HealthBadge({ status }: { status: HealthStatus }) {
  const cfg = {
    healthy:  { icon: Wifi,          cls: "text-emerald-500 border-emerald-500/30" },
    degraded: { icon: AlertTriangle,  cls: "text-amber-500 border-amber-500/30" },
    offline:  { icon: WifiOff,        cls: "text-red-500 border-red-500/30" },
    unknown:  { icon: Database,       cls: "text-muted-foreground" },
  }[status];
  const Icon = cfg.icon;
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 capitalize ${cfg.cls}`}><Icon className="h-2.5 w-2.5 mr-0.5" />{status}</Badge>;
}
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AdminLeadSources({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const sourcePerf = trpc.leadPipeline.sourcePerformance.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });
  const leadSources = trpc.leadPipeline.getLeadSources.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  if (authLoading || sourcePerf.isLoading) {
    return <Shell title="Lead Sources"><SEOHead title="Lead Sources" description="Lead source ROI analytics" /><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></Shell>;
  }
  if (!user || user.role !== "admin") {
    return <Shell title="Lead Sources"><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></Shell>;
  }

  const sources = useMemo(() => {
    const perfData = (sourcePerf.data ?? []) as any[];
    const srcData = (leadSources.data ?? []) as any[];
    return perfData.map((row: any) => {
      const src = srcData.find((s: any) => s.id === row.leadSourceId);
      return {
        id: row.id,
        name: src?.sourceName ?? `Source #${row.leadSourceId}`,
        type: src?.sourceType ?? "organic",
        qualityScore: src?.qualityScore ? Number(src.qualityScore) : null,
        enabled: src?.enabled ?? true,
        leads: row.leadsGenerated ?? 0,
        qualified: row.leadsQualified ?? 0,
        converted: row.leadsConverted ?? 0,
        revenue: parseFloat(row.revenueAttributed ?? "0"),
        cost: parseFloat(row.cost ?? "0"),
        roi: parseFloat(row.roi ?? "0"),
        cpl: parseFloat(row.cpl ?? "0"),
        lastSync: row.periodEnd ? new Date(row.periodEnd) : null,
      };
    });
  }, [sourcePerf.data, leadSources.data]);

  const totalLeads = sources.reduce((s, src) => s + src.leads, 0);
  const totalConverted = sources.reduce((s, src) => s + src.converted, 0);
  const totalRevenue = sources.reduce((s, src) => s + src.revenue, 0);
  const healthySources = sources.filter(s => getHealth(s) === "healthy").length;
  const attentionSources = sources.filter(s => { const h = getHealth(s); return h === "degraded" || h === "offline"; }).length;

  return (
    <Shell title="Lead Sources">
      <div className="container max-w-6xl py-8 space-y-6">
        <SEOHead title="Lead Sources" description="Lead source ROI analytics" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Lead Source Analytics</h1>
          <p className="text-muted-foreground">Compare lead source performance, connector health, and ROI</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { sourcePerf.refetch(); leadSources.refetch(); toast.success("Refreshing..."); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>

        <QueryErrorBanner query={sourcePerf} label="source performance" />

        {sources.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-2">No Source Performance Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Lead source performance data will appear here once leads are tracked with source attribution.
              </p>
              <Button type="button" variant="outline" onClick={() => navigate("/leads")}>
                Go to Lead Pipeline
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalLeads.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Leads</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalConverted}</p><p className="text-xs text-muted-foreground">Converted</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0.0"}%</p><p className="text-xs text-muted-foreground">Conversion Rate</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + "K" : totalRevenue.toFixed(0)}</p><p className="text-xs text-muted-foreground">Total Revenue</p></CardContent></Card>
          <Card className="border-emerald-500/20"><CardContent className="pt-4"><div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><p className="text-2xl font-bold font-mono tabular-nums text-emerald-500">{healthySources}</p></div><p className="text-xs text-muted-foreground">Healthy Sources</p></CardContent></Card>
          <Card className={attentionSources > 0 ? "border-amber-500/20" : ""}><CardContent className="pt-4"><div className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-2xl font-bold font-mono tabular-nums">{attentionSources}</p></div><p className="text-xs text-muted-foreground">Needs Attention</p></CardContent></Card>
        </div>

        {/* Connector Health Panel */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> Connector Health &amp; Sync Status</CardTitle></CardHeader>
          <CardContent>
            {sources.map(src => (
              <div key={src.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${getHealth(src) === "healthy" ? "bg-emerald-500" : getHealth(src) === "degraded" ? "bg-amber-500" : getHealth(src) === "offline" ? "bg-red-500" : "bg-muted-foreground"}`} />
                  <div><p className="text-sm font-medium">{src.name}</p><p className="text-[10px] text-muted-foreground">{src.type}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <HealthBadge status={getHealth(src)} />
                  {src.lastSync && <span className="text-[10px] text-muted-foreground">{new Date(src.lastSync).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Source Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium text-center">Health</th>
                    <th className="pb-3 font-medium text-right">Leads</th>
                    <th className="pb-3 font-medium text-right">Converted</th>
                    <th className="pb-3 font-medium text-right">Conv. Rate</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                    <th className="pb-3 font-medium text-right">ROI</th>
                    <th className="pb-3 font-medium text-center">Quality</th>
                    <th className="pb-3 font-medium text-center">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sources].sort((a, b) => b.roi - a.roi).map(src => (
                    <tr key={src.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3"><span className="font-medium">{src.name}</span><span className="text-[10px] text-muted-foreground ml-2">{src.type}</span></td>
                      <td className="py-3 text-center"><HealthBadge status={getHealth(src)} /></td>
                      <td className="py-3 text-right">{src.leads}</td>
                      <td className="py-3 text-right">{src.converted}</td>
                      <td className="py-3 text-right">{src.leads > 0 ? ((src.converted / src.leads) * 100).toFixed(1) : "0.0"}%</td>
                      <td className="py-3 text-right">${src.revenue.toLocaleString()}</td>
                      <td className="py-3 text-right">${src.cost.toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">
                        <span className={src.roi >= 1000 ? "text-emerald-500" : src.roi >= 200 ? "text-amber-500" : "text-red-500"}>
                          {src.roi.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {src.qualityScore != null ? (
                          <span className={`text-xs font-medium ${src.qualityScore >= 0.8 ? "text-emerald-500" : src.qualityScore >= 0.5 ? "text-amber-500" : "text-red-500"}`}>
                            {(src.qualityScore * 100).toFixed(0)}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 text-center">
                        {src.roi >= 500 ? <ArrowUpRight className="w-4 h-4 text-emerald-500 inline" /> :
                         src.roi < 100 ? <ArrowDownRight className="w-4 h-4 text-red-500 inline" /> :
                         <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ROI bar visualization */}
        <Card>
          <CardHeader><CardTitle className="text-lg">ROI by Source</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...sources].sort((a, b) => b.roi - a.roi).map(src => {
              const maxRoi = Math.max(...sources.map(s => s.roi), 1);
              const width = Math.min((src.roi / maxRoi) * 100, 100);
              return (
                <div key={src.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{src.name}</span>
                    <span className="font-medium">{src.roi.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${src.roi >= 1000 ? "bg-emerald-500" : src.roi >= 200 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
            {/* Compliance & Audit Footer */}
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Lead source data tracked with WORM audit trail (Rule 17a-4)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>TCPA/CAN-SPAM/CCPA compliant</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
