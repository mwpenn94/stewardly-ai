/**
 * Engine Dashboard — v7 Holistic Financial Twin
 * UWE + BIE + HE + SCUI — fully wired to tRPC endpoints
 */
import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Calculator, Play, Loader2, Plus, Trash2, Users, Layers, Briefcase,
  BarChart3, AlertTriangle, Target, BookOpen, Sparkles, TrendingUp,
  ChevronDown, ChevronUp, Zap, Info, ArrowRight, DollarSign, Shield,
} from "lucide-react";

import WealthProjectionChart from "@/components/WealthProjectionChart";
import StrategyComparisonTable from "@/components/StrategyComparisonTable";
import IncomeStreamBreakdown from "@/components/IncomeStreamBreakdown";
import StressTestPanel from "@/components/StressTestPanel";
import MonteCarloFan from "@/components/MonteCarloFan";
import BackPlanFunnel from "@/components/BackPlanFunnel";
import ProductReferencePanel from "@/components/ProductReferencePanel";
import { DownloadReportButton } from "@/components/wealth-engine/DownloadReportButton";

// ─── CONSTANTS ─────────────────────────────────────────────────────
const COMPANY_OPTIONS = [
  { key: "wealthbridge", label: "WealthBridge (Holistic)", color: "#C9A84C" },
  { key: "captivemutual", label: "Captive Mutual (NWM/MassMutual)", color: "#2563EB" },
  { key: "wirehouse", label: "Wirehouse (Merrill/Morgan Stanley)", color: "#7C3AED" },
  { key: "ria", label: "Independent RIA (Fee-Only)", color: "#06B6D4" },
  { key: "communitybd", label: "Community Broker-Dealer", color: "#F59E0B" },
  { key: "diy", label: "DIY (Self-Directed)", color: "#16A34A" },
  { key: "donothing", label: "Do Nothing (Status Quo)", color: "#94A3B8" },
  { key: "bestoverall", label: "Best-of-Breed (Cherry Pick)", color: "#EC4899" },
];

const ROLE_OPTIONS = [
  { key: "new", label: "New Associate" },
  { key: "exp", label: "Experienced Pro" },
  { key: "sa", label: "Senior Associate" },
  { key: "dir", label: "Director" },
  { key: "md", label: "Managing Director" },
  { key: "rvp", label: "RVP" },
  { key: "affA", label: "Affiliate A" },
  { key: "affB", label: "Affiliate B" },
  { key: "affC", label: "Affiliate C" },
  { key: "affD", label: "Affiliate D" },
  { key: "partner", label: "Strategic Partner" },
];

const STRATEGY_COLORS = ["#C9A84C", "#2563EB", "#7C3AED", "#06B6D4", "#F59E0B", "#EC4899"];

const fmt = (n: number) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

// ─── SLIDER INPUT COMPONENT ───────────────────────────────────────
function SliderInput({ label, value, onChange, min, max, step = 1, suffix = "", format }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; suffix?: string; format?: (n: number) => string;
}) {
  return (
    <div className="relative space-y-1">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <div className="flex justify-between items-center">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</Label>
        <span className="text-xs font-medium tabular-nums">{format ? format(value) : `${value}${suffix}`}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="py-1" />
    </div>
  );
}

// ─── STRATEGY TYPE ────────────────────────────────────────────────
interface StrategyState {
  id: string;
  name: string;
  companyKey: string;
  role: string;
  hasBizIncome: boolean;
  savingsRate: number;
  investmentReturn: number;
  taxRate: number;
}

// ─── QUICK-LOAD PRESETS ───────────────────────────────────────────
const QUICK_PRESETS = [
  {
    label: "WealthBridge vs. Do Nothing",
    desc: "Compare holistic planning against status quo",
    icon: Zap,
    strategies: [
      { id: "p1", name: "WealthBridge Client", companyKey: "wealthbridge", role: "new", hasBizIncome: false, savingsRate: 0.15, investmentReturn: 0.07, taxRate: 0.25 },
      { id: "p2", name: "Do Nothing", companyKey: "donothing", role: "new", hasBizIncome: false, savingsRate: 0.062, investmentReturn: 0.035, taxRate: 0.25 },
    ],
    profile: { age: 40, income: 120000, netWorth: 350000, savings: 180000, dependents: 2, mortgage: 250000 },
  },
  {
    label: "WealthBridge Pro (Biz Income)",
    desc: "Professional with business income streams",
    icon: Briefcase,
    strategies: [
      { id: "p1", name: "WB Professional", companyKey: "wealthbridge", role: "exp", hasBizIncome: true, savingsRate: 0.20, investmentReturn: 0.07, taxRate: 0.28 },
      { id: "p2", name: "Captive Mutual", companyKey: "captivemutual", role: "exp", hasBizIncome: true, savingsRate: 0.12, investmentReturn: 0.06, taxRate: 0.28 },
    ],
    profile: { age: 35, income: 200000, netWorth: 500000, savings: 250000, dependents: 2, mortgage: 400000 },
  },
  {
    label: "4-Way Company Battle",
    desc: "WealthBridge vs Captive vs Wirehouse vs RIA",
    icon: Shield,
    strategies: [
      { id: "p1", name: "WealthBridge", companyKey: "wealthbridge", role: "new", hasBizIncome: false, savingsRate: 0.15, investmentReturn: 0.07, taxRate: 0.25 },
      { id: "p2", name: "Captive Mutual", companyKey: "captivemutual", role: "new", hasBizIncome: false, savingsRate: 0.10, investmentReturn: 0.06, taxRate: 0.25 },
      { id: "p3", name: "Wirehouse", companyKey: "wirehouse", role: "new", hasBizIncome: false, savingsRate: 0.12, investmentReturn: 0.065, taxRate: 0.25 },
      { id: "p4", name: "RIA (Fee-Only)", companyKey: "ria", role: "new", hasBizIncome: false, savingsRate: 0.12, investmentReturn: 0.065, taxRate: 0.25 },
    ],
    profile: { age: 45, income: 150000, netWorth: 600000, savings: 300000, dependents: 2, mortgage: 300000 },
  },
  {
    label: "Director Career Path",
    desc: "Director-level with full team and affiliate income",
    icon: TrendingUp,
    strategies: [
      { id: "p1", name: "WB Director", companyKey: "wealthbridge", role: "dir", hasBizIncome: true, savingsRate: 0.25, investmentReturn: 0.07, taxRate: 0.32 },
      { id: "p2", name: "Do Nothing", companyKey: "donothing", role: "new", hasBizIncome: false, savingsRate: 0.062, investmentReturn: 0.035, taxRate: 0.25 },
    ],
    profile: { age: 38, income: 250000, netWorth: 800000, savings: 400000, dependents: 3, mortgage: 500000 },
  },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function EngineDashboard() {
  const { user } = useAuth();

  // Client profile state
  const [age, setAge] = useState(40);
  const [income, setIncome] = useState(120000);
  const [netWorth, setNetWorth] = useState(350000);
  const [savings, setSavings] = useState(180000);
  const [dependents, setDependents] = useState(2);
  const [mortgage, setMortgage] = useState(250000);
  const [years, setYears] = useState(30);

  // Strategy state
  const [strategies, setStrategies] = useState<StrategyState[]>([
    { id: "1", name: "WealthBridge Client", companyKey: "wealthbridge", role: "new", hasBizIncome: false, savingsRate: 0.15, investmentReturn: 0.07, taxRate: 0.25 },
    { id: "2", name: "Do Nothing", companyKey: "donothing", role: "new", hasBizIncome: false, savingsRate: 0.062, investmentReturn: 0.035, taxRate: 0.25 },
  ]);

  // Results state
  const [heResults, setHeResults] = useState<Array<{ snapshots: any[]; name: string; color: string }>>([]);
  const [bieResults, setBieResults] = useState<any[] | null>(null);
  const [mcResults, setMcResults] = useState<any[] | null>(null);
  const [stressResults, setStressResults] = useState<Record<string, any> | null>(null);
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  const [backPlanResult, setBackPlanResult] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("holistic");
  const [chartMetric, setChartMetric] = useState("totalValue");
  const [backPlanTarget, setBackPlanTarget] = useState(200000);
  const [backPlanRole, setBackPlanRole] = useState("new");
  const [showPresets, setShowPresets] = useState(true);

  // tRPC mutations
  const heSimulate = trpc.calculatorEngine.heSimulate.useMutation();
  const uweMonteCarlo = trpc.calculatorEngine.uweMonteCarlo.useMutation();
  const scuiStress = trpc.calculatorEngine.stressTest.useMutation();
  const scuiBacktest = trpc.calculatorEngine.historicalBacktest.useMutation();
  const bieBackPlan = trpc.calculatorEngine.bieBackPlan.useMutation();
  const bieSimulate = trpc.calculatorEngine.bieSimulate.useMutation();

  // tRPC queries for references
  const { data: references } = trpc.calculatorEngine.productReferences.useQuery();
  const { data: benchmarks } = trpc.calculatorEngine.industryBenchmarks.useQuery();
  const { data: methodology } = trpc.calculatorEngine.methodology.useQuery();

  // Build profile object
  const profile = useMemo(() => ({
    age, income, netWorth, savings, dependents, mortgage, debts: 0,
  }), [age, income, netWorth, savings, dependents, mortgage]);

  // ─── RUN ALL ENGINES ──────────────────────────────────────────
  const runSimulations = useCallback(async () => {
    if (!user) { toast.error("Please log in to run simulations"); return; }
    setIsRunning(true);
    toast.info("Running all engines...");

    try {
      // Run HE simulate for each strategy
      const hePromises = strategies.map(async (s, i) => {
        const holisticStrategy = {
          name: s.name,
          color: STRATEGY_COLORS[i] || "#94A3B8",
          hasBizIncome: s.hasBizIncome,
          profile,
          companyKey: s.companyKey,
          savingsRate: s.savingsRate,
          investmentReturn: s.investmentReturn,
          taxRate: s.taxRate,
          inflationRate: 0.03,
          reinvestTaxSavings: true,
          bizStrategy: s.hasBizIncome ? {
            name: `${s.name} BIE`,
            role: s.role as any,
            streams: { personal: true, override: true, aum: true },
          } : null,
        };
        const data = await heSimulate.mutateAsync({ strategy: holisticStrategy as any, years });
        return { snapshots: data, name: s.name, color: STRATEGY_COLORS[i] || "#94A3B8" };
      });

      const heData = await Promise.all(hePromises);
      setHeResults(heData);

      // Run BIE for first strategy with biz income
      const bizStrategy = strategies.find(s => s.hasBizIncome);
      if (bizStrategy) {
        const bieData = await bieSimulate.mutateAsync({
          strategy: {
            name: `${bizStrategy.name} BIE`,
            role: bizStrategy.role as any,
            streams: { personal: true, override: true, aum: true, channels: true },
          },
          years,
        });
        setBieResults(bieData);
      } else {
        setBieResults(null);
      }

      // Run Monte Carlo for first strategy
      const firstStrategy = strategies[0];
      const mcData = await uweMonteCarlo.mutateAsync({
        strategy: {
          profile,
          companyKey: firstStrategy.companyKey,
          products: [],
        },
        years,
        trials: 1000,
        volatility: 0.15,
      });
      // Add year field since MonteCarloPercentile doesn't include it
      setMcResults(mcData.map((d: any, i: number) => ({ ...d, year: i + 1 })));

      // Run stress tests
      const stressPromises = ["dotcom", "gfc", "covid"].map(async (scenario) => {
        const data = await scuiStress.mutateAsync({
          scenarioKey: scenario,
          startBalance: savings,
          annualContribution: Math.round(income * 0.10),
          annualCost: 0,
        });
        return [scenario, data] as const;
      });
      const stressData = await Promise.all(stressPromises);
      setStressResults(Object.fromEntries(stressData));

      // Run historical backtest
      const btData = await scuiBacktest.mutateAsync({
        startBalance: savings,
        annualContribution: Math.round(income * 0.10),
        annualCost: 0,
        horizon: Math.min(years, 30),
      });
      setBacktestResult(btData);

      toast.success(`All engines complete — ${strategies.length} strategies × ${years} years`);
      setShowPresets(false);
    } catch (err: any) {
      toast.error(`Engine error: ${err.message || "Unknown error"}`);
    } finally {
      setIsRunning(false);
    }
  }, [user, strategies, profile, years, income, savings, heSimulate, uweMonteCarlo, scuiStress, scuiBacktest, bieSimulate]);

  // ─── RUN BACK-PLAN ────────────────────────────────────────────
  const runBackPlan = useCallback(async () => {
    if (!user) { toast.error("Please log in"); return; }
    try {
      const data = await bieBackPlan.mutateAsync({
        targetIncome: backPlanTarget,
        role: backPlanRole as any,
      });
      setBackPlanResult(data);
      toast.success("Back-plan calculated");
    } catch (err: any) {
      toast.error(`Back-plan error: ${err.message}`);
    }
  }, [user, backPlanTarget, backPlanRole, bieBackPlan]);

  // ─── LOAD PRESET ──────────────────────────────────────────────
  const loadPreset = useCallback((preset: typeof QUICK_PRESETS[0]) => {
    setStrategies(preset.strategies);
    if (preset.profile) {
      setAge(preset.profile.age);
      setIncome(preset.profile.income);
      setNetWorth(preset.profile.netWorth);
      setSavings(preset.profile.savings);
      setDependents(preset.profile.dependents);
      setMortgage(preset.profile.mortgage);
    }
    toast.success(`Loaded: ${preset.label}`);
  }, []);

  // ─── CHART SERIES (derived from HE results) ──────────────────
  const chartSeries = useMemo(() => {
    if (heResults.length === 0) return [];
    return heResults.map((r) => ({
      name: r.name,
      color: r.color,
      dataKey: chartMetric,
      data: r.snapshots.map((snap: any) => ({
        year: snap.year,
        [chartMetric]: snap[chartMetric] ?? 0,
      })),
    }));
  }, [heResults, chartMetric]);

  // ─── COMPARISON DATA (derived from HE results) ───────────────
  const comparisonData = useMemo(() => {
    if (heResults.length === 0) return { comparison: [], winners: {} };
    const comparison = heResults.map((r) => {
      const last = r.snapshots[r.snapshots.length - 1] || {};
      return {
        name: r.name,
        color: r.color,
        totalValue: last.totalValue || 0,
        netValue: last.netValue || 0,
        roi: last.roi || 0,
        totalLiquidWealth: last.totalLiquidWealth || 0,
        totalProtection: last.totalProtection || 0,
        totalTaxSavings: last.totalTaxSavings || 0,
        totalGrossIncome: last.totalGrossIncome || 0,
        bizIncome: last.bizIncome || 0,
        totalCost: last.totalCost || 0,
      };
    });
    const winners: Record<string, { name: string; color: string; value: number }> = {};
    const metrics = ["totalValue", "netValue", "roi", "totalLiquidWealth", "totalProtection", "totalTaxSavings", "totalGrossIncome"];
    for (const m of metrics) {
      const best = comparison.reduce((a, b) => ((a as any)[m] > (b as any)[m] ? a : b));
      winners[m] = { name: best.name, color: best.color, value: (best as any)[m] };
    }
    const costBest = comparison.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
    winners["totalCost"] = { name: costBest.name, color: costBest.color, value: costBest.totalCost };
    return { comparison, winners };
  }, [heResults]);

  // ─── REPORT PAYLOAD (for Download Report PDF) ────────────────
  // Builds the `complete_plan` payload consumed by
  // wealthEngine.generateReport → generateWealthEngineReport →
  // buildCompletePlan in server/services/wealthEngineReports.
  // Enabled only after engines have produced heResults.
  const reportPayload = useMemo(() => {
    if (heResults.length === 0) return null;
    const primary = heResults[0];
    const projection = primary.snapshots;
    if (!projection || projection.length === 0) return null;

    // Final-year Monte Carlo percentiles (if mcResults is present).
    // mcResults entries are MonteCarloPercentile objects (year-by-year).
    const mcFinal =
      mcResults && mcResults.length > 0
        ? mcResults[mcResults.length - 1]
        : null;

    // Reuse the derived comparison rows. Template only reads a subset
    // of ComparisonRow, so the partial shape is safe behind the `never`
    // cast on the tRPC boundary.
    return {
      kind: "complete_plan" as const,
      input: {
        clientName: user?.name || "WealthBridge Client",
        horizon: years,
        projection,
        monteCarloFinal: mcFinal
          ? {
              p10: mcFinal.p10,
              p25: mcFinal.p25,
              p50: mcFinal.p50,
              p75: mcFinal.p75,
              p90: mcFinal.p90,
            }
          : undefined,
        comparison: comparisonData.comparison,
        winners: comparisonData.winners,
      },
    };
  }, [heResults, mcResults, comparisonData, years, user]);

  // ─── STRATEGY MANAGEMENT ──────────────────────────────────────
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

  const updateStrategy = (id: string, updates: Partial<StrategyState>) => {
    setStrategies(strategies.map((s) => s.id === id ? { ...s, ...updates } : s));
  };

  // ─── BIE RESULTS MAPPED FOR INCOME STREAM COMPONENT ──────────
  const bieYearResults = useMemo(() => {
    if (!bieResults || !Array.isArray(bieResults)) return null;
    return bieResults.map((yr: any) => ({
      year: yr.year,
      streams: Object.fromEntries(
        Object.entries(yr.streams || {}).map(([k, v]: [string, any]) => [k, { income: v.income || 0, label: v.label || k, ...v }])
      ),
      totalIncome: yr.totalIncome || 0,
      totalCost: yr.totalCost || 0,
      netIncome: yr.netIncome || 0,
      teamSize: yr.teamSize || 0,
      aum: yr.aum || 0,
    }));
  }, [bieResults]);

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 md:w-6 md:h-6 text-[#C9A84C]" />
              Engine Dashboard
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              v7 Holistic Financial Twin — UWE + BIE + HE + SCUI
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportPayload && (
              <DownloadReportButton
                template="complete_plan"
                clientName={user?.name || "WealthBridge Client"}
                advisorName={user?.name || undefined}
                payload={reportPayload}
                disabled={isRunning}
                label="Download Report"
              />
            )}
            <Button
              onClick={runSimulations}
              disabled={isRunning}
              className="bg-[#C9A84C] hover:bg-[#B8973B] text-black font-semibold"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isRunning ? "Running Engines..." : "Run All Engines"}
            </Button>
          </div>
        </div>

        {/* Quick-Load Presets */}
        {showPresets && (
          <Card className="border-[#C9A84C]/20 bg-[#C9A84C]/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#C9A84C]" /> Quick-Load Scenarios
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPresets(false)}>
                  Hide
                </Button>
              </div>
              <CardDescription className="text-xs">Select a preset to auto-configure strategies and profile, then click Run All Engines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {QUICK_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => loadPreset(preset)}
                    className="text-left p-3 rounded-lg border border-border/50 hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/10 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <preset.icon className="w-4 h-4 text-[#C9A84C] group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold">{preset.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{preset.desc}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {preset.strategies.map((s, j) => (
                        <Badge key={j} variant="outline" className="text-[9px] px-1.5 py-0">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Profile Panel */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Client Profile
              </CardTitle>
              {!showPresets && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPresets(true)}>
                  <Zap className="w-3 h-3 mr-1" /> Presets
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
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
              <Button variant="outline" size="sm" onClick={addStrategy} className="h-7">
                <Plus className="w-3 h-3 mr-1" /> Add Strategy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {strategies.map((s, i) => (
                <div
                  key={s.id}
                  className="rounded-lg p-3 space-y-2.5 border border-border/50 bg-secondary/20"
                  style={{ borderLeftWidth: 3, borderLeftColor: STRATEGY_COLORS[i] }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={s.name}
                      onChange={(e) => updateStrategy(s.id, { name: e.target.value })}
                      className="h-7 text-xs font-semibold bg-transparent border-none p-0 focus-visible:ring-0"
                    />
                    {strategies.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => removeStrategy(s.id)}>
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Company</Label>
                      <Select value={s.companyKey} onValueChange={(v) => updateStrategy(s.id, { companyKey: v })}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPANY_OPTIONS.map((c) => (
                            <SelectItem key={c.key} value={c.key}>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Role</Label>
                      <Select value={s.role} onValueChange={(v) => updateStrategy(s.id, { role: v })}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.hasBizIncome}
                      onChange={(e) => updateStrategy(s.id, { hasBizIncome: e.target.checked })}
                      className="rounded border-border"
                    />
                    Include Business Income (BIE)
                  </label>
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
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-6 md:w-full">
              <TabsTrigger value="holistic" className="text-xs whitespace-nowrap"><Layers className="w-3 h-3 mr-1" /> Holistic</TabsTrigger>
              <TabsTrigger value="income" className="text-xs whitespace-nowrap"><Briefcase className="w-3 h-3 mr-1" /> Income</TabsTrigger>
              <TabsTrigger value="montecarlo" className="text-xs whitespace-nowrap"><BarChart3 className="w-3 h-3 mr-1" /> Monte Carlo</TabsTrigger>
              <TabsTrigger value="stress" className="text-xs whitespace-nowrap"><AlertTriangle className="w-3 h-3 mr-1" /> Stress</TabsTrigger>
              <TabsTrigger value="backplan" className="text-xs whitespace-nowrap"><Target className="w-3 h-3 mr-1" /> Back-Plan</TabsTrigger>
              <TabsTrigger value="references" className="text-xs whitespace-nowrap"><BookOpen className="w-3 h-3 mr-1" /> References</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ HOLISTIC TAB ═══ */}
          <TabsContent value="holistic" className="space-y-4 mt-4">
            {heResults.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 md:py-16 text-center">
                  <Sparkles className="w-8 h-8 text-[#C9A84C] mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No projections yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Configure your client profile and strategies above, then click "Run All Engines"</p>
                  <Button onClick={runSimulations} disabled={isRunning} className="bg-[#C9A84C] hover:bg-[#B8973B] text-black">
                    <Play className="w-4 h-4 mr-2" /> Run All Engines
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Metric selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Label className="text-xs text-muted-foreground">Chart Metric:</Label>
                  <Select value={chartMetric} onValueChange={setChartMetric}>
                    <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totalValue">Total Value</SelectItem>
                      <SelectItem value="netValue">Net Value</SelectItem>
                      <SelectItem value="totalLiquidWealth">Liquid Wealth</SelectItem>
                      <SelectItem value="totalProtection">Protection</SelectItem>
                      <SelectItem value="totalTaxSavings">Tax Savings</SelectItem>
                      <SelectItem value="savingsBalance">Savings Balance</SelectItem>
                      <SelectItem value="totalGrossIncome">Gross Income</SelectItem>
                      <SelectItem value="bizIncome">Business Income</SelectItem>
                      <SelectItem value="productCashValue">Product Cash Value</SelectItem>
                      <SelectItem value="productDeathBenefit">Death Benefit</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Summary badges */}
                  <div className="flex flex-wrap gap-2">
                    {heResults.map((r, i) => {
                      const last = r.snapshots[r.snapshots.length - 1];
                      return (
                        <Badge key={i} variant="outline" className="text-[10px]" style={{ borderColor: r.color, color: r.color }}>
                          {r.name}: {fmt(last?.[chartMetric] ?? 0)}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <StrategyComparisonTable
                  comparison={comparisonData.comparison}
                  winners={comparisonData.winners}
                  horizon={years}
                />

                <WealthProjectionChart
                  series={chartSeries}
                  title={`${chartMetric.replace(/([A-Z])/g, " $1").trim()} — ${years}-Year Projection`}
                  subtitle={`${strategies.length} strategies compared`}
                  milestoneYears={[5, 10, 15, 20, 25, 30].filter(y => y <= years)}
                />
              </>
            )}
          </TabsContent>

          {/* ═══ INCOME TAB ═══ */}
          <TabsContent value="income" className="space-y-4 mt-4">
            {bieYearResults && bieYearResults.length > 0 ? (
              <IncomeStreamBreakdown results={bieYearResults} />
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-12 md:py-16 text-center">
                  <Briefcase className="w-8 h-8 text-[#C9A84C] mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No income data</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enable "Include Business Income (BIE)" on at least one strategy, then run simulations
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Info className="w-3 h-3" />
                    <span>BIE models 13 income streams: personal GDC, overrides, affiliates A-D, AUM trail, channels, partner, renewal, bonus</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Also show holistic BIE data from HE results */}
            {heResults.some(r => r.snapshots.some((s: any) => s.bizIncome > 0)) && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Holistic Business Income Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Strategy</th>
                          <th className="text-right py-2 px-2 text-muted-foreground font-medium">Year 1</th>
                          <th className="text-right py-2 px-2 text-muted-foreground font-medium">Year 5</th>
                          <th className="text-right py-2 px-2 text-muted-foreground font-medium">Year 10</th>
                          <th className="text-right py-2 px-2 text-muted-foreground font-medium">Year 20</th>
                          <th className="text-right py-2 pl-2 text-muted-foreground font-medium">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heResults.map((r, i) => {
                          const snaps = r.snapshots;
                          const yr1 = snaps[0]?.bizIncome || 0;
                          const yr5 = snaps[4]?.bizIncome || 0;
                          const yr10 = snaps[9]?.bizIncome || 0;
                          const yr20 = snaps[19]?.bizIncome || 0;
                          const cum = snaps[snaps.length - 1]?.cumulativeBizIncome || 0;
                          if (yr1 === 0 && cum === 0) return null;
                          return (
                            <tr key={i} className="border-b border-border/20">
                              <td className="py-2 pr-4">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                                  {r.name}
                                </span>
                              </td>
                              <td className="text-right py-2 px-2 tabular-nums">{fmt(yr1)}</td>
                              <td className="text-right py-2 px-2 tabular-nums">{fmt(yr5)}</td>
                              <td className="text-right py-2 px-2 tabular-nums">{fmt(yr10)}</td>
                              <td className="text-right py-2 px-2 tabular-nums">{fmt(yr20)}</td>
                              <td className="text-right py-2 pl-2 tabular-nums font-semibold">{fmt(cum)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ MONTE CARLO TAB ═══ */}
          <TabsContent value="montecarlo" className="space-y-4 mt-4">
            {mcResults && mcResults.length > 0 ? (
              <MonteCarloFan data={mcResults} />
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-12 md:py-16 text-center">
                  <BarChart3 className="w-8 h-8 text-[#C9A84C] mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No Monte Carlo data</p>
                  <p className="text-xs text-muted-foreground">Run simulations to generate 1,000-trial probability distribution</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ STRESS TAB ═══ */}
          <TabsContent value="stress" className="space-y-4 mt-4">
            <StressTestPanel
              stressResults={stressResults ?? undefined}
              backtestSummary={backtestResult}
              startBalance={savings}
            />
          </TabsContent>

          {/* ═══ BACK-PLAN TAB ═══ */}
          <TabsContent value="backplan" className="space-y-4 mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" /> Activity Back-Plan Calculator
                </CardTitle>
                <CardDescription className="text-xs">
                  Reverse-engineer the GDC, activity funnel, and team needed to hit your income target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SliderInput label="Target Annual Income" value={backPlanTarget} onChange={setBackPlanTarget} min={50000} max={2000000} step={10000} format={fmt} />
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Role</Label>
                    <Select value={backPlanRole} onValueChange={setBackPlanRole}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={runBackPlan} disabled={bieBackPlan.isPending} className="w-full sm:w-auto bg-[#C9A84C] hover:bg-[#B8973B] text-black">
                      {bieBackPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                      Calculate Back-Plan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            {backPlanResult && (
              <BackPlanFunnel result={backPlanResult} targetIncome={backPlanTarget} />
            )}
          </TabsContent>

          {/* ═══ REFERENCES TAB ═══ */}
          <TabsContent value="references" className="space-y-4 mt-4">
            <ProductReferencePanel
              references={references?.map((r: any) => ({ key: r.key, src: r.src, url: r.url, benchmark: r.benchmark }))}
              benchmarks={benchmarks as any}
              methodology={methodology as any}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
