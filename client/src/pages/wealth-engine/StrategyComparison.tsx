/**
 * StrategyComparison — the SCUI v7 panel ported to React.
 *
 * Lets the user pick a client profile, then runs the holistic compare
 * across the WealthBridge plan plus a peer set (Do Nothing, DIY, RIA,
 * Wirehouse, Captive Mutual, Community BD). Renders one StrategyCard
 * per result with winner badges sourced from `findWinners`.
 *
 * tRPC chain:
 *  1. wealthEngine.holisticCompare → server-side HE.compareAt + findWinners
 *  2. ProjectionChart visualizes per-strategy snapshot trajectories
 *  3. (Future Phase 5) "Generate report" button calls the PDF templates
 */

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StrategyCard } from "@/components/wealth-engine/StrategyCard";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { DownloadReportButton } from "@/components/wealth-engine/DownloadReportButton";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import { Loader2, PlayCircle, Award } from "lucide-react";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import { useRunTimeline } from "@/hooks/useRunTimeline";
import type { FinancialProfile } from "@/stores/financialProfile";

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

export default function StrategyComparisonPage() {
  const { profile: savedProfile, setProfile: setSavedProfile, hasProfile } =
    useFinancialProfile();
  const { recordRun } = useRunTimeline();

  // ── Client profile inputs ──
  const [age, setAge] = useState(savedProfile.age ?? 40);
  const [income, setIncome] = useState(savedProfile.income ?? 120_000);
  const [netWorth, setNetWorth] = useState(savedProfile.netWorth ?? 350_000);
  const [savings, setSavings] = useState(savedProfile.savings ?? 180_000);
  const [dependents, setDependents] = useState(savedProfile.dependents ?? 2);
  const [horizon, setHorizon] = useState(30);

  // Late hydration via a one-shot ref guard — seeds the 5 input
  // states from the saved profile once.
  const didHydrateRef = useRef(hasProfile);
  useEffect(() => {
    if (didHydrateRef.current) return;
    if (!hasProfile) return;
    didHydrateRef.current = true;
    if (savedProfile.age !== undefined) setAge(savedProfile.age);
    if (savedProfile.income !== undefined) setIncome(savedProfile.income);
    if (savedProfile.netWorth !== undefined) setNetWorth(savedProfile.netWorth);
    if (savedProfile.savings !== undefined) setSavings(savedProfile.savings);
    if (savedProfile.dependents !== undefined)
      setDependents(savedProfile.dependents);
  }, [hasProfile, savedProfile]);

  const handlePrefill = (p: FinancialProfile) => {
    if (p.age !== undefined) setAge(p.age);
    if (p.income !== undefined) setIncome(p.income);
    if (p.netWorth !== undefined) setNetWorth(p.netWorth);
    if (p.savings !== undefined) setSavings(p.savings);
    if (p.dependents !== undefined) setDependents(p.dependents);
  };

  const profile = useMemo(
    () => ({
      age,
      income,
      netWorth,
      savings,
      dependents,
      mortgage: savedProfile.mortgage ?? 250_000,
      debts: savedProfile.debts ?? 30_000,
      marginalRate: savedProfile.marginalRate ?? 0.25,
    }),
    [age, income, netWorth, savings, dependents, savedProfile],
  );

  const persistToProfile = () => {
    setSavedProfile(
      { age, income, netWorth, savings, dependents },
      "user",
    );
  };

  const compare = trpc.wealthEngine.holisticCompare.useMutation();

  const onRunCompare = () => {
    persistToProfile();
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

  const result = compare.data;
  const rows = result?.data?.compareRows ?? [];
  const winners = result?.data?.winners ?? {};

  // Record the run to the timeline once the comparison completes.
  useEffect(() => {
    if (rows.length === 0) return;
    const topRow = rows[0] as { liquidWealth?: number } | undefined;
    const topValue = topRow?.liquidWealth ?? 0;
    recordRun({
      tool: "he.compareAt",
      label: `HE: ${PEER_SET.length}-strategy comparison`,
      inputSummary: `age ${age}, income ${formatCurrency(income)}, ${horizon}y horizon`,
      outputSummary: topValue > 0 ? `Top strategy: ${formatCurrency(topValue)}` : `${rows.length} strategies`,
      route: "/wealth-engine/strategy-comparison",
      confidence: 0.8,
      inputs: { age, income, netWorth, savings, dependents, horizon },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  return (
    <AppShell title="Strategy Comparison">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Strategy Comparison</h1>
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

        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FinancialProfileBanner
              onPrefill={handlePrefill}
              usesFields={["age", "income", "netWorth", "savings", "dependents"]}
            />
            <div className="grid md:grid-cols-3 gap-4">
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
            </div>
          </CardContent>
        </Card>

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
            {rows.map((row) => (
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

        {compare.isError && (
          <p className="text-sm text-red-600">
            {compare.error?.message || "Comparison failed"}
          </p>
        )}
      </div>
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
