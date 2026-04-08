/**
 * EngineDashboard — v7 Calculator Engine Dashboard
 * Integrates UWE, BIE, HE, SCUI engines with full visualization suite.
 */
import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Calculator, TrendingUp, Building2, Layers, AlertTriangle, BarChart3,
  Play, Loader2, Plus, Trash2, Download, RefreshCw, BookOpen, Target,
  Briefcase, Users, DollarSign, Shield, Sparkles,
} from "lucide-react";

import WealthProjectionChart from "@/components/WealthProjectionChart";
import type { Series } from "@/components/WealthProjectionChart";
import StrategyComparisonTable from "@/components/StrategyComparisonTable";
import IncomeStreamBreakdown from "@/components/IncomeStreamBreakdown";
import StressTestPanel from "@/components/StressTestPanel";
import MonteCarloFan from "@/components/MonteCarloFan";
import BackPlanFunnel from "@/components/BackPlanFunnel";
import ProductReferencePanel from "@/components/ProductReferencePanel";

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "", suffix = "", format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  prefix?: string; suffix?: string; format?: (v: number) => string;
}) {
  const display = format ? format(value) : `${prefix}${value.toLocaleString()}${suffix}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-foreground">{display}</span>
      </div>
      <Slider
        value={[value]} onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

const STRATEGY_COLORS = ["#C9A84C", "#3B82F6", "#8B5CF6", "#EF4444", "#22C55E", "#F59E0B"];
const COMPANY_KEYS = ["wealthbridge", "nwm", "massmutual", "guardian", "nyl", "prudential", "pacific", "transamerica", "donothing"] as const;
const ROLE_OPTIONS = ["new", "exp", "sa", "dir", "md", "rvp"] as const;

export default function EngineDashboard() {
  useAuth();
  const [activeTab, setActiveTab] = useState("holistic");

  // ─── Profile State ────────────────────────────────────────────────
  const [age, setAge] = useState(35);
  const [income, setIncome] = useState(150000);
  const [netWorth, setNetWorth] = useState(500000);
  const [savings, setSavings] = useState(100000);
  const [dependents, setDependents] = useState(2);
  const [mortgage, setMortgage] = useState(300000);
  const [debts, setDebts] = useState(25000);
  const [years, setYears] = useState(30);

  // ─── Strategy Config ──────────────────────────────────────────────
  const [strategies, setStrategies] = useState<Array<{
    id: string; name: string; companyKey: string; role: string;
    hasBizIncome: boolean; savingsRate: number; investmentReturn: number; taxRate: number;
  }>>([
    { id: "1", name: "WealthBridge", companyKey: "wealthbridge", role: "exp", hasBizIncome: true, savingsRate: 0.15, investmentReturn: 0.07, taxRate: 0.25 },
    { id: "2", name: "Do Nothing", companyKey: "donothing", role: "new", hasBizIncome: false, savingsRate: 0.05, investmentReturn: 0.05, taxRate: 0.25 },
  ]);

  // ─── BIE Back-Plan State ──────────────────────────────────────────
  const [backPlanTarget, setBackPlanTarget] = useState(250000);
  const [backPlanRole, setBackPlanRole] = useState("new");

  // ─── Simulation Results ───────────────────────────────────────────
  const [heResults, setHeResults] = useState<any[]>([]);
  const [bieResults, setBieResults] = useState<any>(null);
  const [mcResults, setMcResults] = useState<any>(null);
  const [stressResults, setStressResults] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [backPlanResult, setBackPlanResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const profile = useMemo(() => ({
    age, income, netWorth, savings, dependents, mortgage, debts,
  }), [age, income, netWorth, savings, dependents, mortgage, debts]);

  // ─── tRPC Mutations ───────────────────────────────────────────────
  const heSimulate = trpc.calculatorEngine.heSimulate.useMutation();
  const bieSimulate = trpc.calculatorEngine.bieSimulate.useMutation();
  const uweMonteCarlo = trpc.calculatorEngine.uweMonteCarlo.useMutation();
  const stressTest = trpc.calculatorEngine.stressTest.useMutation();
  const historicalBacktest = trpc.calculatorEngine.historicalBacktest.useMutation();
  const bieBackPlan = trpc.calculatorEngine.bieBackPlan.useMutation();

  // ─── Queries ──────────────────────────────────────────────────────
  const { data: references } = trpc.calculatorEngine.productReferences.useQuery();
  const { data: benchmarks } = trpc.calculatorEngine.industryBenchmarks.useQuery();
  const { data: methodology } = trpc.calculatorEngine.methodology.useQuery();

  // ─── Run All Simulations ──────────────────────────────────────────
  const runSimulations = useCallback(async () => {
    setIsRunning(true);
    try {
      // Run HE for each strategy
      const hePromises = strategies.map((s) =>
        heSimulate.mutateAsync({
          strategy: {
            name: s.name,
            hasBizIncome: s.hasBizIncome,
            bizStrategy: s.hasBizIncome ? { role: s.role, streams: { personal: true, override: true, aum: true, renewal: true, bonus: true } } as any : undefined,
            profile,
            companyKey: s.companyKey as any,
            savingsRate: s.savingsRate,
            investmentReturn: s.investmentReturn,
            taxRate: s.taxRate,
          },
          years,
        })
      );

      const heData = await Promise.all(hePromises);
      setHeResults(heData.map((d, i) => ({ ...d, name: strategies[i].name, color: STRATEGY_COLORS[i] })));

      // Run BIE for first strategy with biz income
      const bizStrategy = strategies.find((s) => s.hasBizIncome);
      if (bizStrategy) {
        const bieData = await bieSimulate.mutateAsync({
          strategy: {
            role: bizStrategy.role as any,
            streams: { personal: true, override: true, aum: true, renewal: true, bonus: true },
          },
          years,
        });
        setBieResults(bieData);
      }

      // Monte Carlo on first strategy
      if ((heData[0] as any)?.length > 0) {
        const mcData = await uweMonteCarlo.mutateAsync({
          strategy: {
            companyKey: strategies[0].companyKey,
            profile,
            products: [],
          },
          years,
          trials: 1000,
          volatility: 0.15,
        });
        setMcResults(mcData);
      }

      // Stress tests
      const stressPromises = (["dotcom", "gfc", "covid"] as const).map((key) =>
        stressTest.mutateAsync({ scenarioKey: key, startBalance: savings }).catch(() => null)
      );
      const stressData = await Promise.all(stressPromises);
      setStressResults({
        dotcom: stressData[0],
        gfc: stressData[1],
        covid: stressData[2],
      });

      // Historical backtest
      const btData = await historicalBacktest.mutateAsync({
        startBalance: savings,
        annualContribution: income * 0.15,
        horizon: years,
      });
      setBacktestResult(btData);

      toast.success("All simulations complete!");
    } catch (err: any) {
      toast.error(`Simulation error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [strategies, profile, years, savings, income]);

  // ─── Run Back-Plan ────────────────────────────────────────────────
  const runBackPlan = useCallback(async () => {
    try {
      const result = await bieBackPlan.mutateAsync({
        targetIncome: backPlanTarget,
        role: backPlanRole as any,
      });
      setBackPlanResult(result);
      toast.success("Back-plan calculated!");
    } catch (err: any) {
      toast.error(`Back-plan error: ${err.message}`);
    }
  }, [backPlanTarget, backPlanRole]);

  // ─── Build chart series from HE results ───────────────────────────
  const [chartMetric, setChartMetric] = useState("totalValue");
  const chartSeries: Series[] = useMemo(() => {
    return heResults.map((r: any) => ({
      name: r.name,
      color: r.color,
      dataKey: chartMetric,
      data: (r.snapshots || []).map((s: any) => ({ year: s.year, [chartMetric]: s[chartMetric] || 0 })),
    }));
  }, [heResults, chartMetric]);

  // ─── Build comparison data ────────────────────────────────────────
  const comparisonData = useMemo(() => {
    if (!heResults.length) return { comparison: [], winners: {} };
    const horizon = years;
    const comparison = heResults.map((r: any) => {
      const snap = r.snapshots?.find((s: any) => s.year === horizon) || r.snapshots?.[r.snapshots.length - 1] || {};
      return {
        name: r.name,
        color: r.color,
        totalValue: snap.totalValue || 0,
        netValue: snap.netValue || 0,
        roi: snap.roi || 0,
        totalLiquidWealth: snap.totalLiquidWealth || 0,
        totalProtection: snap.totalProtection || 0,
        totalTaxSavings: snap.totalTaxSavings || 0,
        bizIncome: snap.bizIncome || 0,
        totalGrossIncome: snap.totalGrossIncome || 0,
        totalCost: snap.totalCost || 0,
      };
    });

    const metrics = ["totalValue", "netValue", "roi", "totalLiquidWealth", "totalProtection", "totalTaxSavings", "totalGrossIncome"];
    const winners: Record<string, any> = {};
    for (const m of metrics) {
      const best = comparison.reduce((a, b) => ((a as any)[m] > (b as any)[m] ? a : b));
      winners[m] = { name: best.name, color: best.color, value: (best as any)[m] };
    }
    // For cost, lower is better
    const costBest = comparison.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
    winners["totalCost"] = { name: costBest.name, color: costBest.color, value: costBest.totalCost };

    return { comparison, winners };
  }, [heResults, years]);

  // ─── Strategy Management ──────────────────────────────────────────
  const addStrategy = () => {
    if (strategies.length >= 6) { toast.error("Maximum 6 strategies"); return; }
    const id = String(Date.now());
    setStrategies([...strategies, {
      id, name: `Strategy ${strategies.length + 1}`, companyKey: "wealthbridge",
      role: "new", hasBizIncome: false, savingsRate: 0.10, investmentReturn: 0.07, taxRate: 0.25,
    }]);
  };

  const removeStrategy = (id: string) => {
    if (strategies.length <= 1) { toast.error("Need at least one strategy"); return; }
    setStrategies(strategies.filter((s) => s.id !== id));
  };

  const updateStrategy = (id: string, updates: Partial<typeof strategies[0]>) => {
    setStrategies(strategies.map((s) => s.id === id ? { ...s, ...updates } : s));
  };

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-accent" />
              Engine Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              v7 Holistic Financial Twin — UWE + BIE + HE + SCUI
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runSimulations} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {isRunning ? "Running..." : "Run All Engines"}
            </Button>
          </div>
        </div>

        {/* Client Profile Panel */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Client Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <SliderInput label="Age" value={age} onChange={setAge} min={18} max={85} suffix=" yrs" />
              <SliderInput label="Income" value={income} onChange={setIncome} min={30000} max={2000000} step={10000} format={fmt} />
              <SliderInput label="Net Worth" value={netWorth} onChange={setNetWorth} min={0} max={20000000} step={50000} format={fmt} />
              <SliderInput label="Savings" value={savings} onChange={setSavings} min={0} max={5000000} step={10000} format={fmt} />
              <SliderInput label="Dependents" value={dependents} onChange={setDependents} min={0} max={10} />
              <SliderInput label="Mortgage" value={mortgage} onChange={setMortgage} min={0} max={5000000} step={10000} format={fmt} />
              <SliderInput label="Projection" value={years} onChange={setYears} min={5} max={50} suffix=" yrs" />
            </div>
          </CardContent>
        </Card>

        {/* Strategy Configuration */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4" /> Strategies ({strategies.length}/6)
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addStrategy}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {strategies.map((s, i) => (
                <div key={s.id} className="bg-secondary/30 rounded-lg p-3 space-y-2 border-l-2" style={{ borderColor: STRATEGY_COLORS[i] }}>
                  <div className="flex items-center justify-between">
                    <Input
                      value={s.name}
                      onChange={(e) => updateStrategy(s.id, { name: e.target.value })}
                      className="h-7 text-xs font-medium bg-transparent border-none p-0"
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeStrategy(s.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Company</Label>
                      <Select value={s.companyKey} onValueChange={(v) => updateStrategy(s.id, { companyKey: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPANY_KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Role</Label>
                      <Select value={s.role} onValueChange={(v) => updateStrategy(s.id, { role: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.hasBizIncome}
                        onChange={(e) => updateStrategy(s.id, { hasBizIncome: e.target.checked })}
                        className="rounded border-border"
                      />
                      Business Income
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SliderInput label="Save %" value={Math.round(s.savingsRate * 100)} onChange={(v) => updateStrategy(s.id, { savingsRate: v / 100 })} min={0} max={50} suffix="%" />
                    <SliderInput label="Return" value={Math.round(s.investmentReturn * 100)} onChange={(v) => updateStrategy(s.id, { investmentReturn: v / 100 })} min={0} max={15} suffix="%" />
                    <SliderInput label="Tax" value={Math.round(s.taxRate * 100)} onChange={(v) => updateStrategy(s.id, { taxRate: v / 100 })} min={10} max={50} suffix="%" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="holistic" className="text-xs"><Layers className="w-3 h-3 mr-1" /> Holistic</TabsTrigger>
            <TabsTrigger value="income" className="text-xs"><Briefcase className="w-3 h-3 mr-1" /> Income</TabsTrigger>
            <TabsTrigger value="montecarlo" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" /> Monte Carlo</TabsTrigger>
            <TabsTrigger value="stress" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" /> Stress</TabsTrigger>
            <TabsTrigger value="backplan" className="text-xs"><Target className="w-3 h-3 mr-1" /> Back-Plan</TabsTrigger>
            <TabsTrigger value="references" className="text-xs"><BookOpen className="w-3 h-3 mr-1" /> References</TabsTrigger>
          </TabsList>

          {/* Holistic Tab */}
          <TabsContent value="holistic" className="space-y-4 mt-4">
            {heResults.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Click "Run All Engines" to generate projections</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Metric selector */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground">Chart Metric:</Label>
                  <Select value={chartMetric} onValueChange={setChartMetric}>
                    <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totalValue">Total Value</SelectItem>
                      <SelectItem value="netValue">Net Value</SelectItem>
                      <SelectItem value="totalLiquidWealth">Liquid Wealth</SelectItem>
                      <SelectItem value="totalProtection">Protection</SelectItem>
                      <SelectItem value="totalTaxSavings">Tax Savings</SelectItem>
                      <SelectItem value="savingsBalance">Savings Balance</SelectItem>
                      <SelectItem value="totalGrossIncome">Gross Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <WealthProjectionChart
                  series={chartSeries}
                  title={`${chartMetric.replace(/([A-Z])/g, " $1").trim()} — ${years}-Year Projection`}
                  subtitle={`${strategies.length} strategies compared`}
                  milestoneYears={[5, 10, 15, 20, 25, 30]}
                />

                <StrategyComparisonTable
                  comparison={comparisonData.comparison}
                  winners={comparisonData.winners}
                  horizon={years}
                />
              </>
            )}
          </TabsContent>

          {/* Income Tab */}
          <TabsContent value="income" className="space-y-4 mt-4">
            {bieResults ? (
              <IncomeStreamBreakdown results={bieResults.yearResults || []} />
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <Briefcase className="w-8 h-8 text-accent mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Enable business income on a strategy and run simulations</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Monte Carlo Tab */}
          <TabsContent value="montecarlo" className="space-y-4 mt-4">
            {mcResults ? (
              <MonteCarloFan data={mcResults} />
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <BarChart3 className="w-8 h-8 text-accent mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Run simulations to generate Monte Carlo probability distribution</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Stress Tab */}
          <TabsContent value="stress" className="space-y-4 mt-4">
            <StressTestPanel
              stressResults={stressResults}
              backtestSummary={backtestResult}
              startBalance={savings}
            />
          </TabsContent>

          {/* Back-Plan Tab */}
          <TabsContent value="backplan" className="space-y-4 mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Income Target Back-Planning</CardTitle>
                <CardDescription className="text-xs">
                  Reverse-engineer the GDC and activity needed to hit your income target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <SliderInput label="Target Income" value={backPlanTarget} onChange={setBackPlanTarget} min={50000} max={2000000} step={10000} format={fmt} />
                  <div>
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={backPlanRole} onValueChange={setBackPlanRole}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" onClick={runBackPlan} disabled={bieBackPlan.isPending}>
                      {bieBackPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Target className="w-4 h-4 mr-1" />}
                      Calculate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            {backPlanResult && (
              <BackPlanFunnel result={backPlanResult} targetIncome={backPlanTarget} />
            )}
          </TabsContent>

          {/* References Tab */}
          <TabsContent value="references" className="space-y-4 mt-4">
            <ProductReferencePanel
              references={references ? Object.entries(references).map(([key, ref]: [string, any]) => ({
                key, src: ref.src, url: ref.url, benchmark: ref.benchmark,
              })) : undefined}
              benchmarks={benchmarks as any}
              methodology={methodology as any}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
