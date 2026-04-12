/**
 * RiskAssessment — Interactive risk profiling with real portfolio drift
 * analysis via the rebalancing.simulate engine. Users set holdings +
 * targets and see drift reports with rebalancing proposals.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { PropensityGauge } from "@/components/PropensityGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BarChart3, Shield, TrendingDown, AlertTriangle, Target, Loader2, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState, useMemo } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface RiskFactor {
  name: string;
  score: number;
  description: string;
}

interface AllocationRow {
  asset: string;
  ticker: string;
  valueUSD: number;
  targetPct: number;
  color: string;
}

const DEFAULT_RISK_FACTORS: RiskFactor[] = [
  { name: "Time Horizon", score: 8, description: "20+ years to retirement" },
  { name: "Income Stability", score: 7, description: "Stable W-2 employment" },
  { name: "Loss Tolerance", score: 5, description: "Moderate — uncomfortable with >15% drawdown" },
  { name: "Investment Knowledge", score: 6, description: "Intermediate understanding" },
  { name: "Liquidity Needs", score: 7, description: "6-month emergency fund in place" },
];

const DEFAULT_ALLOCATION: AllocationRow[] = [
  { asset: "US Equities", ticker: "VTI", valueUSD: 275000, targetPct: 50, color: "bg-blue-500" },
  { asset: "International", ticker: "VXUS", valueUSD: 75000, targetPct: 20, color: "bg-indigo-500" },
  { asset: "Fixed Income", ticker: "BND", valueUSD: 100000, targetPct: 22, color: "bg-emerald-500" },
  { asset: "Real Estate", ticker: "VNQ", valueUSD: 25000, targetPct: 5, color: "bg-amber-500" },
  { asset: "Cash", ticker: "CASH", valueUSD: 25000, targetPct: 3, color: "bg-gray-400" },
];

export default function RiskAssessment() {
  const [, navigate] = useLocation();
  const [riskFactors, setRiskFactors] = useState(DEFAULT_RISK_FACTORS);
  const [allocation, setAllocation] = useState(DEFAULT_ALLOCATION);

  const overallScore = Math.round(riskFactors.reduce((s, f) => s + f.score, 0) / riskFactors.length * 10);
  const totalValue = allocation.reduce((s, a) => s + a.valueUSD, 0);

  // Rebalancing drift analysis
  const holdings = useMemo(() => allocation.map(a => ({
    ticker: a.ticker,
    name: a.asset,
    valueUSD: a.valueUSD,
    costBasisUSD: a.valueUSD * 0.85, // assume 15% gain for tax awareness
    holdingPeriod: "long" as const,
  })), [allocation]);

  const targets = useMemo(() => allocation.map(a => ({
    ticker: a.ticker,
    targetPct: a.targetPct,
  })), [allocation]);

  const driftQuery = trpc.rebalancing.simulate.useQuery(
    { holdings, targets, options: { driftThreshold: 3, taxAware: true } },
    { retry: false },
  );

  function updateRisk(idx: number, score: number) {
    setRiskFactors(prev => prev.map((f, i) => i === idx ? { ...f, score } : f));
  }

  function updateAllocation(idx: number, field: "valueUSD" | "targetPct", value: number) {
    setAllocation(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  const drift = driftQuery.data;

  return (
    <AppShell title="Risk Assessment">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Risk Assessment" description="Interactive risk profiling with real portfolio drift analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Risk Assessment</h1>
            <p className="text-sm text-muted-foreground">Risk profiling + real drift analysis via the rebalancing engine</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Risk Score</p>
          <p className="text-lg font-semibold">{overallScore}</p>
          <p className="text-[10px] text-muted-foreground">Moderate Growth</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Portfolio Value</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalValue)}</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Drift Alerts</p>
          <p className={`text-lg font-semibold ${(drift as any)?.driftAlerts?.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {(drift as any)?.driftAlerts?.length ?? "—"}
          </p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Trade Proposals</p>
          <p className="text-lg font-semibold">{(drift as any)?.proposals?.length ?? "—"}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk factors */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Profile Factors</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {riskFactors.map((f, idx) => (
              <div key={f.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.name}</span>
                  <Input type="number" min={1} max={10} value={f.score}
                    onChange={e => updateRisk(idx, Number(e.target.value))}
                    className="h-6 w-14 text-xs text-center" />
                </div>
                <Progress value={f.score * 10} className="h-2" />
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-border/50 flex items-center justify-center">
              <PropensityGauge score={overallScore} label="Risk Score" size="sm" />
            </div>
          </CardContent>
        </Card>

        {/* Allocation + drift analysis */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Allocation — Current vs Target</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allocation.map((a, idx) => {
                  const currentPct = totalValue > 0 ? (a.valueUSD / totalValue * 100) : 0;
                  const driftPct = currentPct - a.targetPct;
                  return (
                    <div key={a.asset} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-sm ${a.color}`} />
                          <span className="font-medium">{a.asset}</span>
                          <span className="text-xs text-muted-foreground font-mono">{a.ticker}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={a.valueUSD} onChange={e => updateAllocation(idx, "valueUSD", Number(e.target.value))}
                            className="h-6 w-24 text-xs text-right font-mono" />
                          <Input type="number" value={a.targetPct} onChange={e => updateAllocation(idx, "targetPct", Number(e.target.value))}
                            className="h-6 w-14 text-xs text-center" min={0} max={100} />
                          <span className="text-xs text-muted-foreground w-4">%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 flex-1 bg-muted rounded-full overflow-hidden">
                          <div className={`absolute h-full ${a.color} opacity-40 rounded-full`} style={{ width: `${a.targetPct}%` }} />
                          <div className={`absolute h-full ${a.color} rounded-full`} style={{ width: `${currentPct}%` }} />
                        </div>
                        {Math.abs(driftPct) > 2 && (
                          <Badge variant="outline" className={`text-[10px] ${driftPct > 0 ? "text-amber-400 border-amber-500/30" : "text-blue-400 border-blue-500/30"}`}>
                            {driftPct > 0 ? "+" : ""}{driftPct.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Drift analysis results */}
          {driftQuery.isLoading ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : drift ? (
            <>
              {(drift as any).driftAlerts?.length > 0 && (
                <Card className="bg-card/60 border-border/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Drift Alerts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(drift as any).driftAlerts.map((alert: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                        <span className="font-mono">{alert.ticker}</span>
                        <span className="text-muted-foreground">{alert.message || `Drift: ${alert.driftPct?.toFixed(1)}%`}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(drift as any).proposals?.length > 0 && (
                <Card className="bg-card/60 border-border/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-accent" /> Rebalancing Proposals</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(drift as any).proposals.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${p.action === "buy" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}`}>
                            {p.action}
                          </Badge>
                          <span className="font-mono">{p.ticker}</span>
                        </div>
                        <span className="font-mono">{fmt(Math.abs(p.amountUSD ?? 0))}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

          <CalculatorInsight
            title="Risk Profile Summary"
            summary={`Your risk score of ${overallScore}/100 suggests a Moderate Growth profile. Suitable for 50-60% equities, 20-25% fixed income.`}
            detail="Adjust the risk factors and allocation above to see real-time drift analysis from the rebalancing engine."
            severity="info"
            actionLabel="Discuss in Chat"
            onAction={() => navigate("/chat")}
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Risk assessments are for illustrative purposes. Consult a licensed financial professional for personalized advice.
      </p>
    </div>
    </AppShell>
  );
}
