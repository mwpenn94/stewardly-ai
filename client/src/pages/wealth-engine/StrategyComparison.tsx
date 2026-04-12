/**
 * StrategyComparison — the SCUI v7 panel ported to React.
 *
 * Lets the user pick a client profile, then runs the holistic compare
 * across the WealthBridge plan plus a peer set (Do Nothing, DIY, RIA,
 * Wirehouse, Captive Mutual, Community BD). Renders one StrategyCard
 * per result with winner badges sourced from `findWinners`.
 *
 * Enriched with:
 *  - Year-by-year detail table from milestones
 *  - Stress test results (3 scenarios) for the winner strategy
 *  - Historical backtest survival rate
 *  - Industry benchmarks context strip
 *  - Inline guardrail warnings on inputs
 *
 * tRPC chain:
 *  1. wealthEngine.holisticCompare → server-side HE.compareAt + findWinners
 *  2. calculatorEngine.stressTest / historicalBacktest / industryBenchmarks / stressScenarios
 *  3. ProjectionChart visualizes per-strategy snapshot trajectories
 */

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrategyCard } from "@/components/wealth-engine/StrategyCard";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { DownloadReportButton } from "@/components/wealth-engine/DownloadReportButton";
import { CalculatorContextBar } from "@/components/wealth-engine/CalculatorContextBar";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import {
  Loader2, PlayCircle, Award, ChevronDown, ChevronUp,
  AlertTriangle, TrendingDown, History, BarChart3,
  Shield, Info, CheckCircle2,
} from "lucide-react";

const PEER_SET = [
  "wealthbridgeClient",
  "doNothing",
  "diy",
  "wirehouse",
  "ria",
  "captivemutual",
  "communitybd",
] as const;

const PRESET_LABELS: Record<(typeof PEER_SET)[number], string> = {
  wealthbridgeClient: "WealthBridge Plan",
  doNothing: "Do Nothing",
  diy: "DIY / Robo-Advisor",
  wirehouse: "Traditional Wirehouse",
  ria: "Independent RIA",
  captivemutual: "Captive Mutual",
  communitybd: "Community Broker-Dealer",
};

const PRESET_COLORS: Record<(typeof PEER_SET)[number], string> = {
  wealthbridgeClient: chartTokens.colors.strategies.wealthbridge,
  doNothing: chartTokens.colors.strategies.donothing,
  diy: chartTokens.colors.strategies.diy,
  wirehouse: chartTokens.colors.strategies.wirehouse,
  ria: chartTokens.colors.strategies.ria,
  captivemutual: chartTokens.colors.strategies.captivemutual,
  communitybd: chartTokens.colors.strategies.communitybd,
};

type CompanyKey =
  | "wealthbridge"
  | "donothing"
  | "diy"
  | "wirehouse"
  | "ria"
  | "captivemutual"
  | "communitybd";

const COMPANY_KEY: Record<(typeof PEER_SET)[number], CompanyKey> = {
  wealthbridgeClient: "wealthbridge",
  doNothing: "donothing",
  diy: "diy",
  wirehouse: "wirehouse",
  ria: "ria",
  captivemutual: "captivemutual",
  communitybd: "communitybd",
};

// ─── Guardrail check helper ──────────────────────────────────────
function checkInputGuardrails(savingsRate: number, investReturn: number) {
  const warnings: string[] = [];
  if (investReturn > 0.12)
    warnings.push("Return rates above 12% are historically rare for diversified portfolios (Morningstar 2025).");
  if (savingsRate > 0.50)
    warnings.push("Savings rates above 50% may not be sustainable long-term.");
  return warnings;
}

export default function StrategyComparisonPage() {
  // ── Client profile inputs ──
  const [age, setAge] = useState(40);
  const [income, setIncome] = useState(120_000);
  const [netWorth, setNetWorth] = useState(350_000);
  const [savings, setSavings] = useState(180_000);
  const [dependents, setDependents] = useState(2);
  const [horizon, setHorizon] = useState(30);
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [showStressTest, setShowStressTest] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const profile = useMemo(
    () => ({
      age,
      income,
      netWorth,
      savings,
      dependents,
      mortgage: 250_000,
      debts: 30_000,
      marginalRate: 0.25,
    }),
    [age, income, netWorth, savings, dependents],
  );

  const guardrailWarnings = useMemo(() => checkInputGuardrails(0.15, 0.07), []);

  const compare = trpc.wealthEngine.holisticCompare.useMutation({
    onError: () => toast.error("Strategy comparison failed — please try again"),
  });

  const [showProductRefs, setShowProductRefs] = useState(false);

  // Enrichment queries — load reference data eagerly
  const benchmarks = trpc.calculatorEngine.industryBenchmarks.useQuery(undefined, { staleTime: 300_000 });
  const stressScenarios = trpc.calculatorEngine.stressScenarios.useQuery(undefined, { staleTime: 300_000 });
  const productRefs = trpc.calculatorEngine.productReferences.useQuery(undefined, { staleTime: 300_000 });

  // Stress test + backtest — fire after comparison completes
  const onStressError = () => toast.error("Stress test failed — results may be incomplete");
  const onBacktestError = () => toast.error("Backtest failed — historical data unavailable");
  const stressDotcom = trpc.calculatorEngine.stressTest.useMutation({ onError: onStressError });
  const stressGfc = trpc.calculatorEngine.stressTest.useMutation({ onError: onStressError });
  const stressCovid = trpc.calculatorEngine.stressTest.useMutation({ onError: onStressError });
  const backtest = trpc.calculatorEngine.historicalBacktest.useMutation({ onError: onBacktestError });

  const result = compare.data;
  const rows = result?.data?.compareRows ?? [];
  const winners = result?.data?.winners ?? {};

  // After comparison runs, auto-fire stress tests + backtest for the winning strategy
  useEffect(() => {
    if (!rows.length || !winners.totalValue) return;
    const winnerRow = rows.find((r: any) => r.name === winners.totalValue?.name);
    if (!winnerRow) return;

    const startBal = savings;
    const annualContrib = income * 0.15; // savingsRate
    const annualCost = winnerRow.totalValue > 0
      ? (winnerRow.totalValue - winnerRow.netValue) / horizon
      : 0;

    stressDotcom.mutate({ scenarioKey: "dotcom", startBalance: startBal, annualContribution: annualContrib, annualCost });
    stressGfc.mutate({ scenarioKey: "gfc", startBalance: startBal, annualContribution: annualContrib, annualCost });
    stressCovid.mutate({ scenarioKey: "covid", startBalance: startBal, annualContribution: annualContrib, annualCost });
    backtest.mutate({ startBalance: startBal, annualContribution: annualContrib, annualCost, horizon });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, winners.totalValue?.name]);

  const onRunCompare = () => {
    const strategies = PEER_SET.map((preset) => ({
      name: PRESET_LABELS[preset],
      config: {
        color: PRESET_COLORS[preset],
        hasBizIncome: false,
        profile,
        companyKey: COMPANY_KEY[preset],
        savingsRate: 0.15,
        investmentReturn: 0.07,
        reinvestTaxSavings: preset === "wealthbridgeClient" || preset === "ria",
      },
    }));
    compare.mutate({ strategies, horizon });
  };

  return (
    <AppShell title="Strategy Comparison">
      <SectionErrorBoundary sectionName="Strategy Comparison">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading">Strategy Comparison</h1>
            <p className="text-sm text-muted-foreground">
              Run the WealthBridge plan side-by-side against the peer set at
              your chosen horizon. Winner badges highlight the leading strategy
              per metric.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <DownloadReportButton
                template="complete_plan"
                clientName="WealthBridge Client"
                payload={{
                  kind: "complete_plan",
                  input: {
                    clientName: "WealthBridge Client",
                    horizon,
                    projection: [],
                    comparison: rows,
                    winners,
                  },
                }}
              />
            )}
            <Button
              onClick={onRunCompare}
              disabled={compare.isPending}
              size="lg"
            >
              {compare.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Run Comparison
            </Button>
          </div>
        </div>

        {/* Guardrail warnings */}
        {guardrailWarnings.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-200/80 space-y-1">
              {guardrailWarnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          </div>
        )}

        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <ProfileNumberField label="Age" value={age} onChange={setAge} min={18} max={85} />
            <ProfileNumberField
              label="Annual Income"
              value={income}
              onChange={setIncome}
              min={0}
              step={5000}
              format="currency"
            />
            <ProfileNumberField
              label="Net Worth"
              value={netWorth}
              onChange={setNetWorth}
              min={0}
              step={10000}
              format="currency"
            />
            <ProfileNumberField
              label="Savings"
              value={savings}
              onChange={setSavings}
              min={0}
              step={5000}
              format="currency"
            />
            <ProfileNumberField
              label="Dependents"
              value={dependents}
              onChange={setDependents}
              min={0}
              max={10}
            />
            <div className="space-y-2">
              <Label>Planning Horizon: {horizon} years</Label>
              <Slider
                min={5}
                max={50}
                step={1}
                value={[horizon]}
                onValueChange={(v) => setHorizon(v[0])}
              />
            </div>
          </CardContent>
        </Card>

        {/* Industry Benchmarks Context Strip */}
        {benchmarks.data && rows.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowBenchmarks(b => !b)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" /> Industry Benchmarks & Context
                </CardTitle>
                {showBenchmarks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showBenchmarks && (
              <CardContent className="pt-0">
                <BenchmarkGrid data={benchmarks.data} />
              </CardContent>
            )}
          </Card>
        )}

        {/* Headline winner card */}
        {winners.totalValue && (
          <Card className="border-2" style={{ borderColor: chartTokens.colors.gold }}>
            <CardContent className="flex items-center gap-4 py-6">
              <Award className="h-10 w-10" style={{ color: chartTokens.colors.gold }} />
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">
                  Highest projected value at year {horizon}
                </div>
                <div className="text-xl font-bold">
                  {winners.totalValue.name}
                </div>
                <div className="text-2xl font-extrabold" style={{ color: chartTokens.colors.gold, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(winners.totalValue.value)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strategy cards grid */}
        {rows.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((row: any) => (
              <StrategyCard
                key={row.name}
                name={row.name}
                color={row.color}
                totalValue={row.totalValue}
                netValue={row.netValue}
                totalLiquidWealth={row.totalLiquidWealth}
                totalProtection={row.totalProtection}
                totalTaxSavings={row.totalTaxSavings}
                roi={row.roi}
                isWinnerTotalValue={winners.totalValue?.name === row.name}
                isWinnerProtection={winners.totalProtection?.name === row.name}
                isWinnerROI={winners.roi?.name === row.name}
              />
            ))}
          </div>
        )}

        {/* Trajectory chart from milestones */}
        {result && result.data?.milestones && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trajectory by Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <TrajectoryChart milestones={result.data.milestones} />
            </CardContent>
          </Card>
        )}

        {/* Year-by-Year Detail Table */}
        {result?.data?.milestones && result.data.milestones.length > 0 && (
          <Card>
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowDetailTable(t => !t)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-accent" /> Year-by-Year Detail
                  <Badge variant="outline" className="text-[10px] ml-1">{result.data.milestones.length} snapshots</Badge>
                </CardTitle>
                {showDetailTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showDetailTable && (
              <CardContent className="pt-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-[10px] sticky left-0 bg-card z-10">Year</TableHead>
                        {result.data.milestones[0]?.strategies?.map((s: any) => (
                          <TableHead key={s.name} className="text-[10px] text-right">{s.name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.data.milestones.map((m: any) => (
                        <TableRow key={m.year} className="border-border/30">
                          <TableCell className="text-xs font-mono sticky left-0 bg-card z-10">Yr {m.year}</TableCell>
                          {m.strategies.map((s: any) => (
                            <TableCell key={s.name} className="text-xs text-right font-mono tabular-nums">
                              <span style={{ color: s.color }}>{formatCurrency(s.totalValue)}</span>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        )}

        {/* Stress Test Results */}
        {rows.length > 0 && (
          <Card>
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowStressTest(t => !t)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" /> Stress Test & Historical Backtest
                  {backtest.data && (
                    <Badge variant={backtest.data.survivalRate >= 0.9 ? "default" : "destructive"} className="text-[10px] ml-1">
                      {(backtest.data.survivalRate * 100).toFixed(0)}% survival
                    </Badge>
                  )}
                </CardTitle>
                {showStressTest ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showStressTest && (
              <CardContent className="pt-0 space-y-4">
                {/* Stress scenarios */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <StressScenarioCard
                    label="Dot-Com Crash (2000-02)"
                    description="Tech bubble burst. S&P 500 fell 49% peak-to-trough."
                    result={stressDotcom.data}
                    isPending={stressDotcom.isPending}
                  />
                  <StressScenarioCard
                    label="Financial Crisis (2007-09)"
                    description="Housing/credit crisis. S&P 500 fell 57%. Lehman collapsed."
                    result={stressGfc.data}
                    isPending={stressGfc.isPending}
                  />
                  <StressScenarioCard
                    label="COVID Crash (2020)"
                    description="Pandemic shock. S&P 500 fell 34% in 23 trading days."
                    result={stressCovid.data}
                    isPending={stressCovid.isPending}
                  />
                </div>

                {/* Historical Backtest */}
                {backtest.data && (
                  <div className="p-4 rounded-lg border border-border/50 bg-secondary/20">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Historical Backtest ({horizon}-Year Windows, 1928-2025)</p>
                          <Badge variant={backtest.data.survivalRate >= 0.9 ? "default" : "destructive"}>
                            {(backtest.data.survivalRate * 100).toFixed(1)}% survival rate
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tested your plan against every {horizon}-year rolling window in S&P 500 history.
                          {backtest.data.survivalRate >= 0.95
                            ? " Your plan survives the vast majority of historical market conditions."
                            : backtest.data.survivalRate >= 0.8
                            ? " Your plan withstands most historical conditions but has some stress scenarios."
                            : " Consider adjusting savings rate or horizon — plan has meaningful downside risk."}
                        </p>
                        <div className="grid grid-cols-3 gap-3 pt-1">
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Best Case</p>
                            <p className="text-sm font-semibold text-emerald-400">{formatCurrency(backtest.data.best?.final ?? 0)}</p>
                            <p className="text-[9px] text-muted-foreground">Starting {backtest.data.best?.year ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Median</p>
                            <p className="text-sm font-semibold">{formatCurrency(backtest.data.medianFinal ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Worst Case</p>
                            <p className="text-sm font-semibold text-red-400">{formatCurrency(backtest.data.worst?.final ?? 0)}</p>
                            <p className="text-[9px] text-muted-foreground">Starting {backtest.data.worst?.year ?? "—"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Methodology footnote */}
                <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Stress tests apply historical S&P 500 returns to your starting balance and contribution schedule.
                  Backtest uses rolling {horizon}-year windows across 98 years of market data.
                  Past performance does not guarantee future results.
                </p>
              </CardContent>
            )}
          </Card>
        )}

        {/* Product References */}
        {productRefs.data && rows.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowProductRefs(r => !r)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-accent" /> Product References & Citations
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {(productRefs.data as any[]).length} products
                  </Badge>
                </CardTitle>
                {showProductRefs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showProductRefs && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(productRefs.data as any[]).map((ref: any) => (
                    <div key={ref.key} className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold uppercase">{ref.key}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{ref.benchmark}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">{ref.src}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
        {/* Guardrail warnings + benchmarks */}
        {rows.length > 0 && (
          <CalculatorContextBar
            params={{ returnRate: 0.07, savingsRate: 0.15 }}
            showBenchmarks
            className="space-y-3"
          />
        )}

        {compare.isError && (
          <p className="text-sm text-red-600">
            {compare.error?.message || "Comparison failed"}
          </p>
        )}
      </div>
      </SectionErrorBoundary>
    </AppShell>
  );
}

function ProfileNumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: "currency";
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {format === "currency" && (
        <div className="text-xs text-muted-foreground">
          {formatCurrency(value)}
        </div>
      )}
    </div>
  );
}

// ─── Benchmark Labels ────────────────────────────────────────────
const BENCHMARK_LABELS: Record<string, string> = {
  savingsRate: "National Savings Rate",
  investorBehaviorGap: "Investor Behavior Gap",
  lifeInsuranceGap: "Life Insurance Gap",
  retirementReadiness: "Retirement Readiness",
  estatePlanningGap: "Estate Planning Gap",
  advisorAlpha: "Advisor Alpha",
  avgAdvisoryFee: "Avg Advisory Fee",
  avgWealthGrowth: "Avg Wealth Growth",
};

function formatBenchmarkValue(key: string, data: any): string {
  if (data.national != null) return `${(data.national * 100).toFixed(1)}%`;
  if (data.gap != null) return `${(data.gap * 100).toFixed(1)}%/yr`;
  if (data.pct != null) return `${(data.pct * 100).toFixed(0)}%`;
  if (data.value != null) return key.includes("Fee") ? `${(data.value * 100).toFixed(2)}%` : `${(data.value * 100).toFixed(0)}%/yr`;
  if (data.sp500 != null) return `S&P: ${(data.sp500 * 100).toFixed(1)}%`;
  return "—";
}

function BenchmarkGrid({ data }: { data: any }) {
  const entries = Object.entries(data || {});
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {entries.map(([key, val]: [string, any]) => (
        <div key={key} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
            {BENCHMARK_LABELS[key] || key}
          </p>
          <p className="text-sm font-semibold mt-0.5">{formatBenchmarkValue(key, val)}</p>
          <p className="text-[9px] text-muted-foreground mt-1">{val.source || ""}</p>
        </div>
      ))}
    </div>
  );
}

function StressScenarioCard({
  label, description, result, isPending,
}: {
  label: string; description: string; result: any; isPending: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-card/60">
      <p className="text-xs font-semibold mb-0.5">{label}</p>
      <p className="text-[9px] text-muted-foreground mb-2">{description}</p>
      {isPending ? (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Simulating...
        </div>
      ) : result ? (
        <div className="space-y-1.5">
          {result.scenario?.returns && (
            <div className="flex items-end gap-[2px] h-8">
              {(result.scenario.returns as number[]).map((ret: number, i: number) => {
                const h = Math.max(3, Math.abs(ret) * 200);
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${ret < 0 ? "bg-red-400/70" : "bg-emerald-400/70"}`}
                    style={{ height: `${Math.min(h, 100)}%` }}
                    title={`Year ${i + 1}: ${(ret * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-muted-foreground/70 uppercase">Drawdown</p>
              <p className="text-xs font-mono text-red-400">
                {result.maxDrawdown != null ? `${(result.maxDrawdown * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/70 uppercase">Final Balance</p>
              <p className={`text-xs font-mono ${(result.finalBalance ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(result.finalBalance ?? 0)}
              </p>
            </div>
          </div>
          {result.recoveryYears != null && result.recoveryYears > 0 && (
            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              Est. recovery: {result.recoveryYears} year{result.recoveryYears !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/50">Run comparison first</p>
      )}
    </div>
  );
}

function TrajectoryChart({
  milestones,
}: {
  milestones: Array<{
    year: number;
    strategies: Array<{ name: string; color: string; totalValue: number }>;
  }>;
}) {
  // Reshape: per-strategy series of totalValue across milestone years
  const byStrategy = new Map<
    string,
    { color: string; values: number[] }
  >();
  for (const m of milestones) {
    for (const s of m.strategies) {
      const entry = byStrategy.get(s.name) ?? { color: s.color, values: [] };
      entry.values.push(s.totalValue);
      byStrategy.set(s.name, entry);
    }
  }
  const series = Array.from(byStrategy.entries()).map(([name, data]) => ({
    key: name,
    label: name,
    color: data.color,
    values: data.values,
    animateOnMount: true,
  }));
  return <ProjectionChart series={series} width={780} height={360} />;
}
