/**
 * AdminLeadSources — Lead source ROI comparison table with charts.
 *
 * Wired to leadPipeline.sourcePerformance tRPC query.
 * Falls back to empty state when no source performance data exists.
 */
import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3, Loader2, XCircle, ArrowUpRight, ArrowDownRight, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AdminLeadSources({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const sourcePerf = trpc.leadPipeline.sourcePerformance.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  if (authLoading || sourcePerf.isLoading) {
    return <Shell title="Lead Sources"><SEOHead title="Lead Sources" description="Lead source ROI analytics" /><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></Shell>;
  }
  if (!user || user.role !== "admin") {
    return <Shell title="Lead Sources"><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></Shell>;
  }

  const sources = useMemo(() => {
    return ((sourcePerf.data ?? []) as any[]).map((row: any) => ({
      id: row.id,
      name: `Source #${row.leadSourceId}`,
      leads: row.leadsGenerated ?? 0,
      qualified: row.leadsQualified ?? 0,
      converted: row.leadsConverted ?? 0,
      revenue: parseFloat(row.revenueAttributed ?? "0"),
      cost: parseFloat(row.cost ?? "0"),
      roi: parseFloat(row.roi ?? "0"),
      cpl: parseFloat(row.cpl ?? "0"),
    }));
  }, [sourcePerf.data]);

  const totalLeads = sources.reduce((s, src) => s + src.leads, 0);
  const totalConverted = sources.reduce((s, src) => s + src.converted, 0);
  const totalRevenue = sources.reduce((s, src) => s + src.revenue, 0);

  return (
    <Shell title="Lead Sources">
      <div className="container max-w-6xl py-8 space-y-6">
        <SEOHead title="Lead Sources" description="Lead source ROI analytics" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Lead Source Analytics</h1>
          <p className="text-muted-foreground">Compare lead source performance and ROI</p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalLeads.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Leads</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalConverted}</p><p className="text-xs text-muted-foreground">Converted</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0.0"}%</p><p className="text-xs text-muted-foreground">Conversion Rate</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + "K" : totalRevenue.toFixed(0)}</p><p className="text-xs text-muted-foreground">Total Revenue</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Source Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium text-right">Leads</th>
                    <th className="pb-3 font-medium text-right">Converted</th>
                    <th className="pb-3 font-medium text-right">Conv. Rate</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                    <th className="pb-3 font-medium text-right">ROI</th>
                    <th className="pb-3 font-medium text-center">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sources].sort((a, b) => b.roi - a.roi).map(src => (
                    <tr key={src.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{src.name}</td>
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
          </>
        )}
      </div>
    </Shell>
  );
}
