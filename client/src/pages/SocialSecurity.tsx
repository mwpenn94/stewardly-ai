/**
 * SocialSecurity — Social Security claiming strategy optimizer.
 * Shows benefit projections at different claiming ages and spousal strategies.
 */
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, DollarSign, TrendingUp, Users, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const CLAIMING_AGES = [
  { age: 62, monthly: 1875, annual: 22500, reduction: "-30%", breakeven: "N/A", cumulative80: 405000 },
  { age: 65, monthly: 2250, annual: 27000, reduction: "-13.3%", breakeven: "77", cumulative80: 405000 },
  { age: 67, monthly: 2678, annual: 32136, reduction: "0% (FRA)", breakeven: "—", cumulative80: 417768 },
  { age: 70, monthly: 3321, annual: 39852, reduction: "+24%", breakeven: "82", cumulative80: 398520 },
];

export default function SocialSecurity() {
  const [, navigate] = useLocation();

  return (
    <AppShell title="Social Security">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Social Security" description="Social Security claiming strategy optimization" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Social Security Optimizer</h1>
            <p className="text-sm text-muted-foreground">Claiming strategy analysis and benefit projections</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="FRA Benefit" value="$2,678/mo" icon={DollarSign} />
        <FinancialScoreCard title="Full Retirement Age" value="67" format="number" icon={Calendar} />
        <FinancialScoreCard title="Max Benefit (70)" value="$3,321/mo" icon={TrendingUp} trend="up" trendValue="+24% vs FRA" />
        <FinancialScoreCard title="Spousal Benefit" value="$1,339/mo" icon={Users} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Claiming Age Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Age</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Monthly</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Annual</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">vs FRA</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Break-even</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Cumulative @80</th>
                </tr>
              </thead>
              <tbody>
                {CLAIMING_AGES.map(c => (
                  <tr key={c.age} className={`border-b border-border/50 ${c.age === 67 ? "bg-primary/5" : ""}`}>
                    <td className="py-3 font-medium">{c.age} {c.age === 67 && <Badge variant="outline" className="text-[10px] ml-1">FRA</Badge>}</td>
                    <td className="text-right font-mono">${c.monthly.toLocaleString()}</td>
                    <td className="text-right font-mono">${c.annual.toLocaleString()}</td>
                    <td className="text-right">
                      <span className={c.reduction.startsWith("+") ? "text-emerald-400" : c.reduction.startsWith("-") ? "text-red-400" : ""}>
                        {c.reduction}
                      </span>
                    </td>
                    <td className="text-right text-muted-foreground">{c.breakeven}</td>
                    <td className="text-right font-mono">${c.cumulative80.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CalculatorInsight
        title="Recommended: Delay to Age 70"
        summary="Given your health, longevity expectations, and other income sources, delaying to 70 maximizes lifetime benefits by an estimated $48,000."
        detail="With pension income and IRA withdrawals covering expenses from 67–70, delaying Social Security provides a guaranteed 8%/year increase. If you live past 82 (the break-even age), every additional year adds $39,852 in benefits vs $32,136 at FRA. Spousal strategy: your spouse claims at FRA (67) while you delay to 70."
        severity="success"
        actionLabel="Run Full Analysis"
        onAction={() => navigate("/chat")}
      />

      <CalculatorInsight
        title="Spousal Coordination Strategy"
        summary="Lower-earning spouse claims at FRA while higher earner delays to 70 — maximizes survivor benefit."
        detail="If the higher earner predeceases, the surviving spouse receives the higher benefit ($3,321/mo at 70 vs $2,678 at FRA). This 'claim and delay' strategy provides $643/mo more in survivor benefits."
        severity="info"
      />
    </div>
    </AppShell>
  );
}
