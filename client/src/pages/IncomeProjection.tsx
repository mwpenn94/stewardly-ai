/**
 * IncomeProjection — Interactive retirement income projection with configurable
 * income sources, withdrawal strategies, and sustainability analysis.
 * Wires to Social Security optimizer and calculates withdrawal sequences.
 * IncomeProjection — Interactive retirement income projection wired to
 * the real UWE engine. Users configure income sources and see a year-by-year
 * wealth sustainability projection using the 401k/roth/AUM product models.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";
import { PlanningCrossNav } from "@/components/PlanningCrossNav";
import { ArrowLeft, DollarSign, TrendingUp, PiggyBank, BarChart3, Clock, Plus, Trash2, Loader2, Play } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";
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

function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "$",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; prefix?: string;
}) {
  const display = prefix === "$" ? fmt(value) : `${value.toLocaleString()}${prefix === "" ? "" : prefix}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        aria-label={label}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

type IncomeSource = {
  id: string;
  name: string;
  type: "guaranteed" | "variable" | "semi-guaranteed";
  monthlyAmount: number;
  startAge: number;
  inflationAdjusted: boolean;
};

const DEFAULT_SOURCES: IncomeSource[] = [
  { id: "ss", name: "Social Security", type: "guaranteed", monthlyAmount: 2678, startAge: 67, inflationAdjusted: true },
  { id: "pension", name: "Pension", type: "guaranteed", monthlyAmount: 0, startAge: 65, inflationAdjusted: false },
  { id: "401k", name: "401(k) / IRA Withdrawals", type: "variable", monthlyAmount: 3000, startAge: 65, inflationAdjusted: false },
  { id: "rental", name: "Rental Income", type: "semi-guaranteed", monthlyAmount: 0, startAge: 60, inflationAdjusted: true },
];

function runMonteCarloSim(totalMonthly: number, targetMonthly: number, portfolioBalance: number, returnRate: number, inflationRate: number, yearsInRetirement: number): number {
  const trials = 1000;
  let successes = 0;
  const annualWithdrawal = (targetMonthly - totalMonthly) * 12;
  if (annualWithdrawal <= 0) return 99; // guaranteed income exceeds target

  for (let t = 0; t < trials; t++) {
    let bal = portfolioBalance;
    let failed = false;
    for (let y = 0; y < yearsInRetirement; y++) {
      // Random return: normal distribution approximation via Box-Muller
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = returnRate + 0.15 * z; // 15% stddev
      bal = bal * (1 + annualReturn) - annualWithdrawal * Math.pow(1 + inflationRate, y);
      if (bal <= 0) { failed = true; break; }
    }
    if (!failed) successes++;
  }
  return Math.round((successes / trials) * 100);
}

export default function IncomeProjection() {
  const [, navigate] = useLocation();
  const { profile, updateProfile } = useFinancialProfile("income-projection");

  // ─── Global Inputs (initialized from shared profile) ────
  const [currentAge, setCurrentAge] = useState(profileValue(profile, "currentAge", 55));
  const [retirementAge, setRetirementAge] = useState(profileValue(profile, "retirementAge", 65));
  const [lifeExpectancy, setLifeExpectancy] = useState(profileValue(profile, "lifeExpectancy", 90));
  const [targetMonthly, setTargetMonthly] = useState(10000);
  const [portfolioBalance, setPortfolioBalance] = useState(profileValue(profile, "portfolioBalance", 1_200_000));
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [inflationRate, setInflationRate] = useState(3);

  // ─── Income Sources ─────────────────────────────────────
  const [sources, setSources] = useState<IncomeSource[]>(DEFAULT_SOURCES);

  const addSource = () => {
    setSources(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: "New Source",
      type: "variable",
      monthlyAmount: 0,
      startAge: retirementAge,
      inflationAdjusted: false,
    }]);
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const updateSource = (id: string, updates: Partial<IncomeSource>) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // ─── Social Security optimizer ──────────────────────────
  const ssCalc = trpc.ssOptimizer.optimize.useMutation({ onError: (e) => toast.error(e.message) });

  const runSSOptimizer = useCallback(() => {
    const ssSrc = sources.find(s => s.id === "ss");
    if (!ssSrc) return;
    ssCalc.mutate({
      birthYear: new Date().getFullYear() - currentAge,
      estimatedPIA: ssSrc.monthlyAmount,
      filingStatus: "single",
      lifeExpectancy,
    });
  }, [sources, currentAge, lifeExpectancy, ssCalc]);

  // ─── Calculations ───────────────────────────────────────
  const activeSources = useMemo(() =>
    sources.filter(s => s.monthlyAmount > 0),
    [sources]
  );

  const totalMonthlyAtRetirement = useMemo(() =>
    activeSources
      .filter(s => s.startAge <= retirementAge)
      .reduce((sum, s) => sum + s.monthlyAmount, 0),
    [activeSources, retirementAge]
  );

  const totalMonthlyAtFull = useMemo(() =>
    activeSources.reduce((sum, s) => sum + s.monthlyAmount, 0),
    [activeSources]
  );

  const totalAnnual = totalMonthlyAtFull * 12;
  const gap = targetMonthly - totalMonthlyAtFull;
  const withdrawalNeeded = Math.max(0, gap) * 12;

  const yearsInRetirement = lifeExpectancy - retirementAge;
  const successRate = useMemo(() =>
    runMonteCarloSim(
      totalMonthlyAtFull,
      targetMonthly,
      portfolioBalance,
      expectedReturn / 100,
      inflationRate / 100,
      yearsInRetirement
    ),
    [totalMonthlyAtFull, targetMonthly, portfolioBalance, expectedReturn, inflationRate, yearsInRetirement]
  );

  // Withdrawal rate
  const withdrawalRate = portfolioBalance > 0 ? (withdrawalNeeded / portfolioBalance) * 100 : 0;

  // ─── Year-by-year projection ────────────────────────────
  const projection = useMemo(() => {
    const rows = [];
    let balance = portfolioBalance;
    for (let age = retirementAge; age <= lifeExpectancy && age <= retirementAge + 35; age++) {
      const income = activeSources
        .filter(s => s.startAge <= age)
        .reduce((sum, s) => {
          const yearsActive = age - Math.max(s.startAge, retirementAge);
          const adj = s.inflationAdjusted ? Math.pow(1 + inflationRate / 100, yearsActive) : 1;
          return sum + s.monthlyAmount * adj * 12;
        }, 0);
      const targetAnnual = targetMonthly * 12 * Math.pow(1 + inflationRate / 100, age - retirementAge);
      const withdrawal = Math.max(0, targetAnnual - income);
      const growth = balance * (expectedReturn / 100);
      balance = balance + growth - withdrawal;
      rows.push({ age, income: Math.round(income), withdrawal: Math.round(withdrawal), balance: Math.round(Math.max(0, balance)), target: Math.round(targetAnnual) });
      if (balance <= 0) break;
    }
    return rows;
  }, [activeSources, portfolioBalance, retirementAge, lifeExpectancy, targetMonthly, expectedReturn, inflationRate]);

  const depletionAge = projection.find(r => r.balance <= 0)?.age;

  const ssResult = ssCalc.data as any;
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
      <SEOHead title="Income Projection" description="Interactive retirement income projection and sustainability analysis" />

      <PlanningCrossNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Income Projection</h1>
            <p className="text-sm text-muted-foreground">Model retirement income sources and test sustainability</p>
            <p className="text-sm text-muted-foreground">Retirement income modeling powered by the Wealth Engine</p>
          </div>
        </div>
      </div>

      {/* ─── Global Inputs ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Retirement Profile</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <SliderInput label="Current Age" value={currentAge} onChange={setCurrentAge} min={25} max={75} prefix="" />
            <SliderInput label="Retirement Age" value={retirementAge} onChange={setRetirementAge} min={Math.max(55, currentAge)} max={75} prefix="" />
            <SliderInput label="Life Expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={retirementAge + 5} max={100} prefix="" />
            <SliderInput label="Monthly Target Income" value={targetMonthly} onChange={setTargetMonthly} min={2000} max={30000} step={500} />
            <SliderInput label="Portfolio Balance at Retirement" value={portfolioBalance} onChange={setPortfolioBalance} min={0} max={10_000_000} step={50000} />
            <SliderInput label="Expected Return (%)" value={expectedReturn} onChange={setExpectedReturn} min={0} max={12} step={0.5} prefix="" />
          </div>
        </CardContent>
      </Card>

      {/* ─── Income Sources ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Income Sources</CardTitle>
            <Button variant="outline" size="sm" onClick={addSource} aria-label="Add income source">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Source
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.map(src => (
            <div key={src.id} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end py-2 border-b border-border/30 last:border-0">
              <div className="space-y-1">
                <Label htmlFor={`name-${src.id}`} className="text-[10px] text-muted-foreground">Name</Label>
                <Input
                  id={`name-${src.id}`}
                  value={src.name}
                  onChange={e => updateSource(src.id, { name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`amount-${src.id}`} className="text-[10px] text-muted-foreground">Monthly Amount</Label>
                <Input
                  id={`amount-${src.id}`}
                  type="number"
                  value={src.monthlyAmount}
                  onChange={e => updateSource(src.id, { monthlyAmount: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`age-${src.id}`} className="text-[10px] text-muted-foreground">Start Age</Label>
                <Input
                  id={`age-${src.id}`}
                  type="number"
                  value={src.startAge}
                  onChange={e => updateSource(src.id, { startAge: Number(e.target.value) || 60 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Type</Label>
                <Select value={src.type} onValueChange={v => updateSource(src.id, { type: v as any })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guaranteed">Guaranteed</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="semi-guaranteed">Semi-Guaranteed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                {src.id === "ss" && (
                  <Button variant="outline" size="sm" className="text-[10px]" onClick={runSSOptimizer} disabled={ssCalc.isPending} aria-label="Optimize Social Security">
                    {ssCalc.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Optimize SS"}
                  </Button>
                )}
                {!["ss", "pension", "401k"].includes(src.id) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeSource(src.id)} aria-label={`Remove ${src.name}`}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── SS Optimizer Results ──────────────────────────── */}
      {ssResult && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Social Security Optimization</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Optimal Claiming Age</span><span className="font-mono font-medium">{ssResult.optimalAge ?? ssResult.optimalClaimingAge ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Full Retirement Age</span><span className="font-mono">{ssResult.fullRetirementAge ?? ssResult.fra ?? "—"}</span></div>
            {ssResult.reasoning && <p className="text-xs text-muted-foreground">{ssResult.reasoning}</p>}
            {Array.isArray(ssResult.scenarios ?? ssResult.claimingScenarios) && (
              <div className="mt-2 space-y-1">
                {((ssResult.scenarios ?? ssResult.claimingScenarios) as any[]).slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>Age {s.claimingAge ?? s.age}</span>
                    <span className="font-mono">{fmt(s.monthlyBenefit ?? s.monthly ?? 0)}/mo</span>
                    <span className="font-mono text-muted-foreground">Lifetime: {fmt(s.lifetimeTotal ?? s.total ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Monthly Income</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalMonthlyAtFull)}</p>
          <p className="text-[10px] text-muted-foreground">{Math.round(totalMonthlyAtFull / targetMonthly * 100)}% of target</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Income Gap</p>
          <p className={`text-lg font-semibold tabular-nums ${gap <= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {gap <= 0 ? "None" : `${fmt(gap)}/mo`}
          </p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Withdrawal Rate</p>
          <p className={`text-lg font-semibold tabular-nums ${withdrawalRate <= 4 ? "text-emerald-400" : withdrawalRate <= 5 ? "text-amber-400" : "text-red-400"}`}>{withdrawalRate.toFixed(1)}%</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Sustainability</p>
          <p className={`text-lg font-semibold tabular-nums ${successRate >= 85 ? "text-emerald-400" : successRate >= 70 ? "text-amber-400" : "text-red-400"}`}>{successRate}%</p>
          <p className="text-[10px] text-muted-foreground">Monte Carlo (1,000 trials)</p>
        </div>
      </div>

      {/* ─── Year-by-Year Projection ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Year-by-Year Projection</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-2">
              <span>Age</span>
              <span className="text-right">Income</span>
              <span className="text-right">Withdrawal</span>
              <span className="text-right">Portfolio</span>
              <span className="text-right">Target</span>
            </div>
            {projection.map(row => (
              <div key={row.age} className={`grid grid-cols-5 gap-2 text-sm py-1 border-b border-border/30 last:border-0 ${row.balance <= 0 ? "text-red-400" : ""}`}>
                <span className="font-mono">{row.age}</span>
                <span className="text-right font-mono">{fmt(row.income)}</span>
                <span className="text-right font-mono">{fmt(row.withdrawal)}</span>
                <span className={`text-right font-mono ${row.balance <= 0 ? "text-red-400" : ""}`}>{fmt(row.balance)}</span>
                <span className="text-right font-mono text-muted-foreground">{fmt(row.target)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Insights ──────────────────────────────────────── */}
      {gap <= 0 && (
        <CalculatorInsight
          title={`Income Exceeds Target by ${fmt(Math.abs(gap))}/month`}
          summary={`Projected retirement income of ${fmt(totalMonthlyAtFull)}/mo exceeds the ${fmt(targetMonthly)}/mo target. Consider directing surplus to legacy goals.`}
          detail={`The ${fmt(Math.abs(gap))}/mo surplus (${fmt(Math.abs(gap) * 12)}/yr) could fund a Roth IRA for tax-free growth, increase charitable giving via DAF, or accelerate mortgage payoff.`}
          severity="success"
          actionLabel="Optimize Surplus"
          onAction={() => navigate("/chat")}
        />
      )}
      {withdrawalRate > 4 && (
        <CalculatorInsight
          title={`Withdrawal Rate Above 4% Rule (${withdrawalRate.toFixed(1)}%)`}
          summary="Your portfolio withdrawal rate exceeds the traditional 4% safe withdrawal rate. Consider reducing spending or increasing guaranteed income."
          detail="Research suggests withdrawal rates above 4% increase the risk of portfolio depletion over a 30-year retirement. Options: delay retirement, increase Social Security by claiming later, add an annuity for guaranteed income, or reduce monthly target."
          severity="warning"
        />
      )}
      {depletionAge && (
        <CalculatorInsight
          title={`Portfolio Depletes at Age ${depletionAge}`}
          summary={`At current withdrawal rates, your portfolio runs out at age ${depletionAge}, ${lifeExpectancy - depletionAge} years before life expectancy.`}
          severity="critical"
          actionLabel="Discuss Solutions"
          onAction={() => navigate("/chat")}
        />
      )}
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
