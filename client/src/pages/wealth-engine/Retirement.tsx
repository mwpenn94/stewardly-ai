/**
 * Retirement — three-mode wealth-engine retirement panel.
 *
 * Replicates the v7 "v-retire" panel:
 *  - Mode A: Goal (build a target balance projection)
 *  - Mode B: Smooth (consumption smoothing — backplan via tRPC backPlanHolistic)
 *  - Mode C: Guardrails (current vs upper/lower thresholds with the gauge)
 *
 * tRPC chain:
 *  1. wealthEngine.runPreset → HE.simulate(wealthbridgeClient, profile)
 *  2. wealthEngine.backPlanHolistic → required income for a target value
 *  3. The guardrail thresholds are derived locally from the projection's
 *     final-year totalLiquidWealth ± a 15% band (matches v7 default).
 */

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { sendFeedback } from "@/lib/feedbackSpecs";
import { GuardrailsGauge } from "@/components/wealth-engine/GuardrailsGauge";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { DownloadReportButton } from "@/components/wealth-engine/DownloadReportButton";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import {
  Loader2, Target, Sliders, ShieldCheck, TrendingDown, Shield,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";

export default function RetirementPage() {
  const [age, setAge] = useState(40);
  const [retirementAge, setRetirementAge] = useState(65);
  const [income, setIncome] = useState(120_000);
  const [savings, setSavings] = useState(180_000);
  const [targetValue, setTargetValue] = useState(2_000_000);

  const horizon = retirementAge - age;

  const profile = useMemo(
    () => ({
      age,
      income,
      netWorth: 350_000,
      savings,
      dependents: 2,
      mortgage: 250_000,
      debts: 30_000,
      marginalRate: 0.25,
    }),
    [age, income, savings],
  );

  const [showRiskContext, setShowRiskContext] = useState(false);

  const runPreset = trpc.wealthEngine.runPreset.useMutation({ onSuccess: () => sendFeedback("calculator.result") });
  const backPlan = trpc.wealthEngine.backPlanHolistic.useMutation({ onSuccess: () => sendFeedback("calculator.result") });

  // Risk context — auto-fire after goal projection runs
  const stressGfc = trpc.calculatorEngine.stressTest.useMutation();
  const backtestRun = trpc.calculatorEngine.historicalBacktest.useMutation();
  const benchmarks = trpc.calculatorEngine.industryBenchmarks.useQuery(undefined, { staleTime: 300_000 });

  const onRunGoal = () => {
    runPreset.mutate({
      preset: "wealthbridgeClient",
      profile,
      years: horizon,
    });
  };

  const onRunBackPlan = () => {
    backPlan.mutate({
      targetValue,
      targetYear: horizon,
      baseStrategy: {
        name: "WealthBridge Plan",
        config: {
          companyKey: "wealthbridge" as const,
          profile,
          savingsRate: 0.15,
          investmentReturn: 0.07,
          reinvestTaxSavings: true,
          hasBizIncome: false,
        },
      },
    });
  };

  const projection = runPreset.data?.data ?? [];
  const finalSnap = projection[projection.length - 1];
  const liquidValues = projection.map((s) => s.totalLiquidWealth);

  // Auto-run risk context when goal projection completes
  useEffect(() => {
    if (!finalSnap) return;
    const annualContrib = income * 0.15;
    stressGfc.mutate({ scenarioKey: "gfc", startBalance: savings, annualContribution: annualContrib, annualCost: 0 });
    backtestRun.mutate({ startBalance: savings, annualContribution: annualContrib, annualCost: 0, horizon });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSnap?.totalLiquidWealth]);

  // Guardrail thresholds: ±15% of final liquid wealth (placeholder until
  // Phase 7 wires in the consumption-smoothing engine)
  const lowerThreshold = finalSnap ? finalSnap.totalLiquidWealth * 0.85 : 0;
  const upperThreshold = finalSnap ? finalSnap.totalLiquidWealth * 1.15 : 0;

  return (
    <AppShell title="Retirement">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Planning</h1>
          <p className="text-sm text-muted-foreground">
            Three modes — pick a goal target, smooth consumption, or check
            current portfolio against guardrails.
          </p>
        </div>

        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Inputs</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <NumberInput label="Current Age" value={age} onChange={setAge} min={18} max={80} />
            <NumberInput label="Retirement Age" value={retirementAge} onChange={setRetirementAge} min={age + 1} max={90} />
            <NumberInput label="Annual Income" value={income} onChange={setIncome} step={5000} />
            <NumberInput label="Current Savings" value={savings} onChange={setSavings} step={5000} />
          </CardContent>
        </Card>

        {/* Mode tabs */}
        <Tabs defaultValue="goal" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="goal">
              <Target className="mr-2 h-4 w-4" /> Goal
            </TabsTrigger>
            <TabsTrigger value="smooth">
              <Sliders className="mr-2 h-4 w-4" /> Smooth
            </TabsTrigger>
            <TabsTrigger value="guard">
              <ShieldCheck className="mr-2 h-4 w-4" /> Guardrails
            </TabsTrigger>
          </TabsList>

          {/* GOAL */}
          <TabsContent value="goal" className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={onRunGoal} disabled={runPreset.isPending}>
                {runPreset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                Run Goal Projection ({horizon} yrs)
              </Button>
              {finalSnap && (
                <DownloadReportButton
                  template="executive_summary"
                  clientName="WealthBridge Client"
                  payload={{
                    kind: "executive_summary",
                    input: {
                      clientName: "WealthBridge Client",
                      horizon,
                      finalSnapshot: finalSnap,
                      winners: {},
                      topStrategies: [],
                    },
                  }}
                />
              )}
            </div>
            {projection.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Projected liquid wealth at age {finalSnap?.age}
                    <span
                      className="ml-3 font-extrabold text-2xl"
                      style={{ color: chartTokens.colors.wealthbridge, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCurrency(finalSnap?.totalLiquidWealth ?? 0)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectionChart
                    width={780}
                    height={320}
                    series={[
                      {
                        key: "liquid",
                        label: "Liquid Wealth",
                        color: chartTokens.colors.wealthbridge,
                        values: liquidValues,
                        animateOnMount: true,
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SMOOTH (back-plan) */}
          <TabsContent value="smooth" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <Label>Target value at retirement: {formatCurrency(targetValue)}</Label>
                <Slider
                  min={500_000}
                  max={10_000_000}
                  step={100_000}
                  value={[targetValue]}
                  onValueChange={(v) => setTargetValue(v[0])}
                />
                <Button onClick={onRunBackPlan} disabled={backPlan.isPending}>
                  {backPlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sliders className="mr-2 h-4 w-4" />}
                  Solve required income
                </Button>
                {backPlan.data && (
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-4">
                    <div className="text-xs uppercase text-muted-foreground tracking-wide">
                      Required annual income to hit target by year {horizon}
                    </div>
                    <div
                      className="text-2xl font-extrabold"
                      style={{ color: chartTokens.colors.wealthbridge, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCurrency(backPlan.data.data.requiredIncome)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Solved in {backPlan.data.data.iterations} iterations
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GUARDRAILS */}
          <TabsContent value="guard" className="space-y-4">
            {!finalSnap && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Run the Goal projection first to populate the guardrail
                  thresholds.
                </CardContent>
              </Card>
            )}
            {finalSnap && (
              <Card>
                <CardContent className="flex flex-col md:flex-row items-center gap-6 py-6">
                  <GuardrailsGauge
                    currentValue={finalSnap.totalLiquidWealth}
                    lowerThreshold={lowerThreshold}
                    upperThreshold={upperThreshold}
                    targetValue={targetValue}
                  />
                  <div className="flex-1 space-y-2 text-sm">
                    <h3 className="text-base font-semibold">Guardrail Status</h3>
                    <p className="text-muted-foreground">
                      Lower threshold:{" "}
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(lowerThreshold)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Upper threshold:{" "}
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(upperThreshold)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      The gauge animates to your projected liquid wealth at
                      retirement. Inside the green band = on track.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Risk Context Panel — only shows after goal projection */}
        {finalSnap && (
          <Card>
            <CardHeader className="py-3 cursor-pointer" onClick={() => setShowRiskContext(v => !v)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" /> Risk Context & Historical Backtest
                  {backtestRun.data && (
                    <Badge variant={backtestRun.data.survivalRate >= 0.9 ? "default" : "destructive"} className="text-[10px] ml-1">
                      {(backtestRun.data.survivalRate * 100).toFixed(0)}% survival
                    </Badge>
                  )}
                </CardTitle>
                {showRiskContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showRiskContext && (
              <CardContent className="pt-0 space-y-4">
                {/* 2008 Stress Test */}
                {stressGfc.data && (
                  <div className="p-3 rounded-lg border border-border/40 bg-card/60">
                    <p className="text-xs font-semibold mb-1">If 2008 Happened Again</p>
                    <p className="text-[9px] text-muted-foreground mb-2">
                      {stressGfc.data.scenario?.description}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[9px] text-muted-foreground/70 uppercase">Max Drawdown</p>
                        <p className="text-sm font-mono text-red-400">
                          {(stressGfc.data.maxDrawdown * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground/70 uppercase">Final Balance</p>
                        <p className="text-sm font-mono">
                          {formatCurrency(stressGfc.data.finalBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground/70 uppercase">Est. Recovery</p>
                        <p className="text-sm font-mono">
                          {stressGfc.data.recoveryYears} year{stressGfc.data.recoveryYears !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Historical Backtest */}
                {backtestRun.data && (
                  <div className="p-4 rounded-lg border border-border/50 bg-secondary/20">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-semibold">
                          Historical Backtest ({horizon}-Year Windows, 1928-2025)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tested your retirement plan against every {horizon}-year rolling window in S&P 500 history.
                          {backtestRun.data.survivalRate >= 0.95
                            ? " Your plan survives the vast majority of historical conditions."
                            : backtestRun.data.survivalRate >= 0.8
                            ? " Plan withstands most conditions but has some stress scenarios."
                            : " Consider increasing contributions or extending timeline."}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Best Case</p>
                            <p className="text-sm font-semibold text-emerald-400">{formatCurrency(backtestRun.data.best?.final ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Median</p>
                            <p className="text-sm font-semibold">{formatCurrency(backtestRun.data.medianFinal ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/70 uppercase">Worst Case</p>
                            <p className="text-sm font-semibold text-red-400">{formatCurrency(backtestRun.data.worst?.final ?? 0)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Benchmark context */}
                {benchmarks.data && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(benchmarks.data as any[]).slice(0, 4).map((b: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-secondary/20 border border-border/20">
                        <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{b.label}</p>
                        <p className="text-xs font-semibold mt-0.5">{b.value}</p>
                        <p className="text-[8px] text-muted-foreground">{b.source}</p>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Past performance does not guarantee future results. All projections are hypothetical.
                </p>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
    </div>
  );
}
