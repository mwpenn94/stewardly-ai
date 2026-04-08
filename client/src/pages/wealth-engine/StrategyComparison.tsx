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

import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StrategyCard } from "@/components/wealth-engine/StrategyCard";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import { Loader2, PlayCircle, Award } from "lucide-react";

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
  // ── Client profile inputs ──
  const [age, setAge] = useState(40);
  const [income, setIncome] = useState(120_000);
  const [netWorth, setNetWorth] = useState(350_000);
  const [savings, setSavings] = useState(180_000);
  const [dependents, setDependents] = useState(2);
  const [horizon, setHorizon] = useState(30);

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

  const compare = trpc.wealthEngine.holisticCompare.useMutation();

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

  const result = compare.data;
  const rows = result?.data?.compareRows ?? [];
  const winners = result?.data?.winners ?? {};

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
