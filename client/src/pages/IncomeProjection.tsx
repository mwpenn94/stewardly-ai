/**
 * IncomeProjection — Interactive retirement income projection wired to
 * the real UWE engine. Users configure income sources and see a year-by-year
 * wealth sustainability projection using the 401k/roth/AUM product models.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, DollarSign, TrendingUp, PiggyBank, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface IncomeSource {
  id: string;
  source: string;
  monthly: number;
  startAge: number;
  type: "Guaranteed" | "Variable" | "Semi-Guaranteed";
}

const DEFAULT_SOURCES: IncomeSource[] = [
  { id: "ss", source: "Social Security", monthly: 2678, startAge: 67, type: "Guaranteed" },
  { id: "401k", source: "401(k) Withdrawals", monthly: 3200, startAge: 65, type: "Variable" },
  { id: "ira", source: "IRA Distributions", monthly: 1800, startAge: 67, type: "Variable" },
];

const TYPE_COLORS = { Guaranteed: "bg-emerald-500", Variable: "bg-amber-500", "Semi-Guaranteed": "bg-blue-500" };

export default function IncomeProjection() {
  const [, navigate] = useLocation();
  const [sources, setSources] = useState<IncomeSource[]>(DEFAULT_SOURCES);
  const [currentAge, setCurrentAge] = useState(55);
  const [retireAge, setRetireAge] = useState(65);
  const [currentSavings, setCurrentSavings] = useState(800000);
  const [targetMonthly, setTargetMonthly] = useState(10000);

  const totalMonthly = sources.reduce((s, i) => s + i.monthly, 0);
  const totalAnnual = totalMonthly * 12;

  // UWE simulation for portfolio sustainability
  const simMutation = trpc.calculatorEngine.uweSimulate.useMutation();
  // Monte Carlo for probability analysis
  const mcMutation = trpc.calculatorEngine.uweMonteCarlo.useMutation();

  function runProjection() {
    const years = 95 - currentAge; // project to age 95
    const annualWithdrawal = sources
      .filter(s => s.type === "Variable")
      .reduce((sum, s) => sum + s.monthly * 12, 0);

    const strategy = {
      company: "wealthbridge" as const,
      companyName: "WealthBridge",
      color: "#16A34A",
      profile: {
        age: currentAge,
        income: totalAnnual,
        savings: currentSavings,
        monthlySavings: currentAge < retireAge ? 1500 : 0,
        equitiesReturn: 0.07,
      },
      products: [
        { type: "401k" as const, initialBalance: currentSavings * 0.6, annualContrib: currentAge < retireAge ? 23500 : 0, employerMatch: currentAge < retireAge ? 0.047 : 0, grossReturn: 0.07 },
        { type: "roth" as const, initialBalance: currentSavings * 0.2, annualContrib: currentAge < retireAge ? 7000 : 0, grossReturn: 0.08 },
        { type: "aum" as const, initialAUM: currentSavings * 0.2, annualAdd: currentAge < retireAge ? 12000 : 0, feeRate: 0.008, grossReturn: 0.07, advisoryAlpha: 0.02, taxDrag: 0.005 },
      ],
      features: { holistic: true, taxFree: true, livingBen: false, advisor: true, estate: false, group: false, fiduciary: true, lowFees: false, insurance: false },
      notes: "",
    };
    simMutation.mutate({ strategy, years });
    mcMutation.mutate({ strategy, years, trials: 1000, volatility: 0.15 });
  }

  function addSource() {
    setSources(prev => [...prev, {
      id: `src-${Date.now()}`,
      source: "New Source",
      monthly: 0,
      startAge: 65,
      type: "Variable",
    }]);
  }

  function updateSource(id: string, field: keyof IncomeSource, value: string | number) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id));
  }

  // Monte Carlo success rate
  const mcLast = mcMutation.data && Array.isArray(mcMutation.data) ? mcMutation.data[mcMutation.data.length - 1] : null;

  return (
    <AppShell title="Income Projection">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Income Projection" description="Retirement income projection and sustainability analysis" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Income Projection</h1>
            <p className="text-sm text-muted-foreground">Retirement income modeling powered by the Wealth Engine</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Projected Monthly</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalMonthly)}</p>
          <p className="text-[10px] text-muted-foreground">{Math.round(totalMonthly / targetMonthly * 100)}% of target</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Annual Income</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalAnnual)}</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Income Gap</p>
          <p className={`text-lg font-semibold tabular-nums ${totalMonthly >= targetMonthly ? "text-emerald-400" : "text-red-400"}`}>
            {totalMonthly >= targetMonthly ? "Surplus " + fmt(totalMonthly - targetMonthly) : "Gap " + fmt(targetMonthly - totalMonthly)}
          </p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Monte Carlo</p>
          <p className="text-lg font-semibold tabular-nums">
            {mcLast ? `${((mcLast as any).successRate ?? 0).toFixed(0)}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Run projection to compute</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income sources editor */}
        <div className="space-y-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Income Sources
                <Button variant="ghost" size="sm" onClick={addSource} className="h-6 px-2">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sources.map(src => (
                <div key={src.id} className="space-y-1.5 p-2 rounded border border-border/50 bg-card/30">
                  <div className="flex items-center justify-between">
                    <Input value={src.source} onChange={e => updateSource(src.id, "source", e.target.value)} className="h-7 text-xs font-medium flex-1 mr-2" />
                    <Button variant="ghost" size="sm" onClick={() => removeSource(src.id)} className="h-6 w-6 p-0" aria-label="Remove source">
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Monthly</Label>
                      <Input type="number" value={src.monthly} onChange={e => updateSource(src.id, "monthly", Number(e.target.value))} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Start Age</Label>
                      <Input type="number" value={src.startAge} onChange={e => updateSource(src.id, "startAge", Number(e.target.value))} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Portfolio Settings</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] text-muted-foreground">Current Age</Label>
                  <Input type="number" value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} className="h-7 text-xs" /></div>
                <div><Label className="text-[10px] text-muted-foreground">Retire Age</Label>
                  <Input type="number" value={retireAge} onChange={e => setRetireAge(Number(e.target.value))} className="h-7 text-xs" /></div>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Current Savings</Label>
                <Input type="number" value={currentSavings} onChange={e => setCurrentSavings(Number(e.target.value))} className="h-7 text-xs" /></div>
              <div><Label className="text-[10px] text-muted-foreground">Target Monthly Income</Label>
                <Input type="number" value={targetMonthly} onChange={e => setTargetMonthly(Number(e.target.value))} className="h-7 text-xs" /></div>
              <Button className="w-full h-9 text-sm mt-2" onClick={runProjection} disabled={simMutation.isPending || mcMutation.isPending}>
                {(simMutation.isPending || mcMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                Run Projection
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Income breakdown */}
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Income Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sources.map(src => (
                  <div key={src.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-sm ${TYPE_COLORS[src.type]}`} />
                        <span className="font-medium">{src.source}</span>
                        <Badge variant="outline" className="text-[10px]">{src.type}</Badge>
                      </div>
                      <span className="font-mono text-sm">{fmt(src.monthly)}/mo</span>
                    </div>
                    <Progress value={totalMonthly > 0 ? Math.round(src.monthly / totalMonthly * 100) : 0} className="h-2" />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-border flex justify-between text-sm font-medium">
                <span>Total</span>
                <span className="font-mono">{fmt(totalMonthly)}/mo ({fmt(totalAnnual)}/yr)</span>
              </div>
            </CardContent>
          </Card>

          {/* UWE Simulation results */}
          {simMutation.data && Array.isArray(simMutation.data) && simMutation.data.length > 0 && (
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Portfolio Sustainability (UWE Engine)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {simMutation.data
                  .filter((_: any, i: number) => i % 5 === 4 || i === 0 || i === simMutation.data!.length - 1)
                  .map((s: any) => (
                    <div key={s.year} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground">Age {s.age}</span>
                      <div className="flex gap-4">
                        <span className="font-mono">{fmt(s.totalWealth)}</span>
                        <Badge variant="outline" className="text-[10px]">ROI {s.roi}x</Badge>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Monte Carlo percentiles */}
          {mcLast && (
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Monte Carlo Probability (1,000 trials)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Worst (P10)", value: (mcLast as any).p10, color: "text-red-400" },
                    { label: "P25", value: (mcLast as any).p25, color: "text-muted-foreground" },
                    { label: "Median", value: (mcLast as any).p50, color: "text-foreground" },
                    { label: "P75", value: (mcLast as any).p75, color: "text-muted-foreground" },
                    { label: "Best (P90)", value: (mcLast as any).p90, color: "text-emerald-400" },
                  ].map(p => (
                    <div key={p.label} className="p-2 rounded bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground">{p.label}</p>
                      <p className={`text-sm font-mono font-semibold ${p.color}`}>{fmt(p.value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!simMutation.data && !simMutation.isPending && (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
              <PiggyBank className="w-6 h-6 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Configure income sources and click Run Projection</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">See portfolio sustainability + Monte Carlo probability</p>
            </div>
          )}

          <CalculatorInsight
            title="Withdrawal Sequence Strategy"
            summary="Optimal order: taxable accounts first (60–67), then tax-deferred (67–72), then Roth (72+)."
            detail="This sequence minimizes lifetime taxes by filling lower brackets with tax-deferred withdrawals during the gap years before Social Security and RMDs."
            severity="info"
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Projections are for illustrative purposes. Consult a licensed financial professional for advice.
      </p>
    </div>
    </AppShell>
  );
}
