/**
 * AdminLeadSources — Lead source ROI comparison table with charts.
 *
 * PLACEHOLDER — pass 67 honesty pass.
 *
 * This page ships as a design preview only. The revenue-attribution
 * backend it would need (per-source conversion + cost + revenue
 * join) does not yet exist in any tRPC router. Until it's built,
 * the page renders `MOCK_SOURCES` with a prominent placeholder
 * banner so admins aren't misled into thinking the numbers are real.
 *
 * See REMAINING_ITEMS.md "Remaining Code Items" for the backend
 * build plan that would let this page render live data.
 */
import AppShell from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Loader2, XCircle, DollarSign,
  Users, Target, ArrowUpRight, ArrowDownRight, AlertTriangle,
} from "lucide-react";

interface LeadSource {
  name: string;
  leads: number;
  converted: number;
  revenue: number;
  cost: number;
  roi: number;
  trend: "up" | "down" | "flat";
}

const MOCK_SOURCES: LeadSource[] = [
  { name: "Calculator Embeds", leads: 342, converted: 28, revenue: 84000, cost: 2400, roi: 3400, trend: "up" },
  { name: "COI Referrals", leads: 156, converted: 22, revenue: 110000, cost: 5000, roi: 2100, trend: "up" },
  { name: "LinkedIn (Dripify)", leads: 289, converted: 15, revenue: 45000, cost: 8500, roi: 429, trend: "flat" },
  { name: "Email Campaigns", leads: 198, converted: 12, revenue: 36000, cost: 3200, roi: 1025, trend: "down" },
  { name: "Website Organic", leads: 421, converted: 18, revenue: 54000, cost: 1200, roi: 4400, trend: "up" },
  { name: "Paid Search", leads: 167, converted: 8, revenue: 24000, cost: 12000, roi: 100, trend: "down" },
  { name: "Webinar Attendees", leads: 89, converted: 11, revenue: 55000, cost: 4500, roi: 1122, trend: "up" },
];

export default function AdminLeadSources() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <AppShell><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!user || user.role !== "admin") {
    return <AppShell><div className="flex flex-col items-center justify-center h-64 gap-4"><XCircle className="w-12 h-12 text-red-500" /><p className="text-muted-foreground">Admin access required</p></div></AppShell>;
  }

  const totalLeads = MOCK_SOURCES.reduce((s, src) => s + src.leads, 0);
  const totalConverted = MOCK_SOURCES.reduce((s, src) => s + src.converted, 0);
  const totalRevenue = MOCK_SOURCES.reduce((s, src) => s + src.revenue, 0);

  return (
    <AppShell>
      <div className="container max-w-6xl py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Lead Source Analytics</h1>
          <p className="text-muted-foreground">Compare lead source performance and ROI</p>
        </div>

        {/* Pass 67: honest placeholder banner — the underlying
            revenue-attribution backend doesn't yet exist, so every
            number below is mock data. See REMAINING_ITEMS.md for
            the backend build plan. */}
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 flex items-start gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold">Design preview — not live data.</strong>{" "}
              The numbers on this page are illustrative mock values. The
              per-source revenue attribution backend has not been built yet.
              See{" "}
              <code className="font-mono text-xs">REMAINING_ITEMS.md &gt; Remaining Code Items</code>{" "}
              for the build plan.
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalLeads.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Leads</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{totalConverted}</p><p className="text-xs text-muted-foreground">Converted</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">{((totalConverted / totalLeads) * 100).toFixed(1)}%</p><p className="text-xs text-muted-foreground">Conversion Rate</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold font-mono tabular-nums">${(totalRevenue / 1000).toFixed(0)}K</p><p className="text-xs text-muted-foreground">Total Revenue</p></CardContent></Card>
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
                  {MOCK_SOURCES.sort((a, b) => b.roi - a.roi).map(src => (
                    <tr key={src.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{src.name}</td>
                      <td className="py-3 text-right">{src.leads}</td>
                      <td className="py-3 text-right">{src.converted}</td>
                      <td className="py-3 text-right">{((src.converted / src.leads) * 100).toFixed(1)}%</td>
                      <td className="py-3 text-right">${src.revenue.toLocaleString()}</td>
                      <td className="py-3 text-right">${src.cost.toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">
                        <span className={src.roi >= 1000 ? "text-emerald-500" : src.roi >= 200 ? "text-amber-500" : "text-red-500"}>
                          {src.roi}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {src.trend === "up" ? <ArrowUpRight className="w-4 h-4 text-emerald-500 inline" /> :
                         src.trend === "down" ? <ArrowDownRight className="w-4 h-4 text-red-500 inline" /> :
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
            {MOCK_SOURCES.sort((a, b) => b.roi - a.roi).map(src => {
              const maxRoi = Math.max(...MOCK_SOURCES.map(s => s.roi));
              const width = Math.min((src.roi / maxRoi) * 100, 100);
              return (
                <div key={src.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{src.name}</span>
                    <span className="font-medium">{src.roi}%</span>
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
      </div>
    </AppShell>
  );
}
