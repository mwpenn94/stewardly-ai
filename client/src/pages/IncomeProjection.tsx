/**
 * IncomeProjection — Retirement income projection dashboard.
 * Shows income sources, withdrawal strategies, and sustainability analysis.
 */
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, DollarSign, TrendingUp, PiggyBank, BarChart3, Clock } from "lucide-react";
import { useLocation } from "wouter";

const INCOME_SOURCES = [
  { source: "Social Security", monthly: 2678, annual: 32136, startAge: 67, type: "Guaranteed", color: "bg-blue-500" },
  { source: "Pension", monthly: 1500, annual: 18000, startAge: 65, type: "Guaranteed", color: "bg-emerald-500" },
  { source: "401(k) Withdrawals", monthly: 3200, annual: 38400, startAge: 65, type: "Variable", color: "bg-amber-500" },
  { source: "IRA Distributions", monthly: 1800, annual: 21600, startAge: 67, type: "Variable", color: "bg-purple-500" },
  { source: "Rental Income", monthly: 2100, annual: 25200, startAge: 60, type: "Semi-Guaranteed", color: "bg-indigo-500" },
];

export default function IncomeProjection() {
  const [, navigate] = useLocation();
  const totalMonthly = INCOME_SOURCES.reduce((s, i) => s + i.monthly, 0);
  const totalAnnual = INCOME_SOURCES.reduce((s, i) => s + i.annual, 0);
  const targetMonthly = 10000;

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Income Projection" description="Retirement income projection and sustainability analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Income Projection</h1>
            <p className="text-sm text-muted-foreground">Retirement income sources and sustainability analysis</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Projected Monthly" value={`$${totalMonthly.toLocaleString()}`} icon={DollarSign} trend="up" trendValue={`${Math.round(totalMonthly / targetMonthly * 100)}% of target`} />
        <FinancialScoreCard title="Annual Income" value={`$${totalAnnual.toLocaleString()}`} icon={TrendingUp} />
        <FinancialScoreCard title="Income Gap" value={totalMonthly >= targetMonthly ? "None" : `$${(targetMonthly - totalMonthly).toLocaleString()}/mo`} icon={PiggyBank} trend={totalMonthly >= targetMonthly ? "up" : "down"} trendValue={totalMonthly >= targetMonthly ? "Fully funded" : "Shortfall"} />
        <FinancialScoreCard title="Sustainability" value="94%" icon={BarChart3} trend="up" trendValue="Monte Carlo" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Income Sources Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {INCOME_SOURCES.map(src => (
              <div key={src.source} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-sm ${src.color}`} />
                    <span className="font-medium">{src.source}</span>
                    <Badge variant="outline" className="text-[10px]">{src.type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Age {src.startAge}</span>
                    <span className="font-mono">${src.monthly.toLocaleString()}/mo</span>
                  </div>
                </div>
                <Progress value={Math.round(src.monthly / totalMonthly * 100)} className="h-2" />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-medium">Total Projected Income</span>
            <span className="text-lg font-bold">${totalMonthly.toLocaleString()}/mo</span>
          </div>
        </CardContent>
      </Card>

      <CalculatorInsight
        title="Income Exceeds Target by $1,278/month"
        summary="Projected retirement income of $11,278/mo exceeds the $10,000/mo target. Consider directing surplus to legacy goals."
        detail="The $1,278/mo surplus ($15,336/yr) could fund a Roth IRA for tax-free growth, increase charitable giving via DAF, or accelerate mortgage payoff. The 94% Monte Carlo success rate accounts for market volatility and inflation."
        severity="success"
        actionLabel="Optimize Surplus"
        onAction={() => navigate("/chat")}
      />

      <CalculatorInsight
        title="Withdrawal Sequence Strategy"
        summary="Optimal withdrawal order: taxable accounts first (60–67), then tax-deferred (67–72), then Roth (72+)."
        detail="This sequence minimizes lifetime taxes by filling lower brackets with tax-deferred withdrawals during the 'gap years' before Social Security and RMDs begin. Estimated tax savings: $45,000 over 20 years vs proportional withdrawal."
        severity="info"
      />
    </div>
  );
}
