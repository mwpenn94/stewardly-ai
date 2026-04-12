/**
 * PracticeToWealth — "Also My Client" THE WEALTH BRIDGE.
 *
 * For an advisor who is also a WealthBridge client, this page projects
 * how their practice income (BIE forward simulation) feeds personal
 * wealth (HE simulation with hasBizIncome=true). The visualization
 * pairs the BIE income trajectory with the HE liquid-wealth trajectory
 * and highlights the affiliate-track contribution as a hatched overlay.
 */

import { useMemo, useState, useEffect } from "react";
import { persistCalculation } from "@/lib/calculatorContext";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { CalculatorContextBar } from "@/components/wealth-engine/CalculatorContextBar";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import {
  Loader2, Briefcase, PiggyBank, ChevronDown, ChevronUp,
  BarChart3, Users, TrendingUp,
} from "lucide-react";

const ROLES = [
  { key: "new", label: "New Associate" },
  { key: "exp", label: "Experienced Pro" },
  { key: "sa", label: "Senior Associate" },
  { key: "dir", label: "Director" },
  { key: "md", label: "Managing Director" },
  { key: "rvp", label: "Regional VP" },
] as const;

export default function PracticeToWealthPage() {
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("dir");
  const [age, setAge] = useState(38);
  const [years, setYears] = useState(25);

  const profile = useMemo(
    () => ({
      age,
      income: 250_000, // assumed practice income baseline
      netWorth: 500_000,
      savings: 250_000,
      dependents: 2,
      mortgage: 350_000,
      debts: 50_000,
      marginalRate: 0.32,
    }),
    [age],
  );

  const bizProject = trpc.wealthEngine.projectBizIncome.useMutation({ onError: (e) => toast.error(e.message) });
  const holisticSim = trpc.wealthEngine.holisticSimulate.useMutation({ onError: (e) => toast.error(e.message) });

  const onRun = async () => {
    // Log the calculator use so the Learning Home's agent recommendations
    // can surface calculator-informed study suggestions (e.g. "you recently
    // used projectBizIncome, brush up on the life_health track").
    try {
      const { recordCalculatorUse } = await import("@/lib/recentCalculators");
      recordCalculatorUse("projectBizIncome");
      recordCalculatorUse("holisticSimulate");
    } catch {
      // Dynamic import failed — localStorage disabled or SSR context; ignore.
    }

    // 1. Run BIE projection for the selected role
    bizProject.mutate({
      strategy: null,
      years,
      presetKey:
        role === "exp"
          ? "experiencedPro"
          : role === "new"
            ? "newAssociate"
            : role === "dir"
              ? "director"
              : role === "md"
                ? "md"
                : role === "rvp"
                  ? "rvp"
                  : "experiencedPro",
    });
    // 2. Holistic simulation with hasBizIncome=true (uses default biz preset)
    holisticSim.mutate({
      name: "WealthBridge Pro",
      config: {
        hasBizIncome: true,
        profile,
        companyKey: "wealthbridge" as const,
        savingsRate: 0.18,
        investmentReturn: 0.07,
        reinvestTaxSavings: true,
      },
      years,
    });
  };

  const bizYears = bizProject.data?.data ?? [];
  const holisticYears = holisticSim.data?.data ?? [];

  // ── Persist to calculator context bridge ──
  useEffect(() => {
    if (bizYears.length === 0 && holisticYears.length === 0) return;
    const lastBiz = (bizYears[bizYears.length - 1] as any);
    const lastWealth = (holisticYears[holisticYears.length - 1] as any);
    const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
    persistCalculation({
      id: `practice-to-wealth-${role}-${years}yr`,
      type: "bie",
      title: `Practice → Wealth — ${role} role, ${years}-year projection`,
      summary: `Business: Year ${years} income ${fmt(lastBiz?.totalIncome ?? 0)}. Wealth: Year ${years} total value ${fmt(lastWealth?.totalValue ?? 0)}, liquid ${fmt(lastWealth?.totalLiquidWealth ?? 0)}.`,
      inputs: { role, age, years },
      outputs: {
        finalBizIncome: lastBiz?.totalIncome ?? 0,
        finalTotalValue: lastWealth?.totalValue ?? 0,
        finalLiquidWealth: lastWealth?.totalLiquidWealth ?? 0,
        bizYearCount: bizYears.length,
        wealthYearCount: holisticYears.length,
      },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizYears.length, holisticYears.length]);

  return (
    <AppShell title="Practice → Wealth">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">The Wealth Bridge</h1>
          <p className="text-sm text-muted-foreground">
            Practice income today → personal wealth at retirement. Watch the
            two trajectories side by side.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} min={18} max={80} />
            </div>
            <div className="space-y-2">
              <Label>Years</Label>
              <Input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} min={5} max={50} />
            </div>
            <div className="flex items-end">
              <Button onClick={onRun} disabled={bizProject.isPending || holisticSim.isPending} className="w-full">
                {bizProject.isPending || holisticSim.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Briefcase className="mr-2 h-4 w-4" />
                )}
                Run Both
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Headline metrics */}
        {bizYears.length > 0 && holisticYears.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4">
            <HeadlineCard
              title="Final-year practice income"
              value={bizYears[bizYears.length - 1].totalIncome}
              icon={<Briefcase className="h-5 w-5" style={{ color: chartTokens.colors.practiceIncome }} />}
              accent={chartTokens.colors.practiceIncome}
            />
            <HeadlineCard
              title="Cumulative practice income"
              value={bizYears[bizYears.length - 1].cumulativeIncome}
              icon={<Briefcase className="h-5 w-5" style={{ color: chartTokens.colors.practiceIncome }} />}
              accent={chartTokens.colors.practiceIncome}
            />
            <HeadlineCard
              title="Liquid wealth at year N"
              value={holisticYears[holisticYears.length - 1].totalLiquidWealth}
              icon={<PiggyBank className="h-5 w-5" style={{ color: chartTokens.colors.wealthbridge }} />}
              accent={chartTokens.colors.wealthbridge}
            />
          </div>
        )}

        {/* Combined projection chart */}
        {(bizYears.length > 0 || holisticYears.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Practice income vs. Liquid wealth</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectionChart
                width={780}
                height={360}
                series={[
                  ...(bizYears.length > 0
                    ? [
                        {
                          key: "biz",
                          label: "Annual practice income",
                          color: chartTokens.colors.practiceIncome,
                          values: bizYears.map((y) => y.totalIncome),
                          isPracticeIncome: true,
                          animateOnMount: true,
                        },
                      ]
                    : []),
                  ...(holisticYears.length > 0
                    ? [
                        {
                          key: "liquid",
                          label: "Liquid wealth",
                          color: chartTokens.colors.wealthbridge,
                          values: holisticYears.map((y) => y.totalLiquidWealth),
                          animateOnMount: true,
                        },
                      ]
                    : []),
                ]}
              />
            </CardContent>
          </Card>
        )}
        {/* Income Stream Breakdown — shows which revenue streams contribute */}
        {bizYears.length > 0 && <IncomeStreamBreakdown bizYears={bizYears} />}

        {/* Guardrail warnings + benchmarks */}
        {(bizYears.length > 0 || holisticYears.length > 0) && (
          <CalculatorContextBar
            params={{ returnRate: 0.07, savingsRate: 0.18 }}
            className="space-y-3"
          />
        )}
      </div>
    </AppShell>
  );
}

// ─── Income Stream Breakdown ────────────────────────────────────
function IncomeStreamBreakdown({ bizYears }: { bizYears: any[] }) {
  const [expanded, setExpanded] = useState(false);

  // Extract final-year stream breakdown
  const finalYear = bizYears[bizYears.length - 1];
  const streams = finalYear?.streams ?? {};
  const streamEntries = Object.entries(streams)
    .map(([key, val]: [string, any]) => ({
      key,
      label: formatStreamKey(key),
      value: val?.amount ?? val?.value ?? val ?? 0,
    }))
    .filter((s) => typeof s.value === "number" && s.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalFromStreams = streamEntries.reduce((s, e) => s + e.value, 0);

  if (streamEntries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" />
            Income Stream Breakdown (Year {finalYear?.year ?? "N"})
            <Badge variant="outline" className="text-[10px] ml-1">
              {streamEntries.length} streams
            </Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {/* Stream bars */}
          {streamEntries.map((s) => {
            const pct = totalFromStreams > 0 ? (s.value / totalFromStreams) * 100 : 0;
            return (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono font-semibold">{formatCurrency(s.value)}</span>
                </div>
                <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent/70 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Year-by-year summary strip */}
          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Year-by-Year Summary
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {bizYears.filter((_, i) => i % Math.max(1, Math.floor(bizYears.length / 5)) === 0 || i === bizYears.length - 1).map((yr: any) => (
                <div key={yr.year} className="p-2 rounded bg-secondary/20 text-center">
                  <p className="text-[9px] text-muted-foreground">Yr {yr.year}</p>
                  <p className="text-xs font-mono font-semibold">{formatCurrency(yr.totalIncome)}</p>
                  {yr.teamSize > 0 && (
                    <p className="text-[8px] text-muted-foreground flex items-center justify-center gap-0.5">
                      <Users className="h-2.5 w-2.5" /> {yr.teamSize}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function formatStreamKey(key: string): string {
  const map: Record<string, string> = {
    personalWBCore: "Personal WB Core",
    expandedPlatform: "Expanded Platform",
    teamOverride: "Team Override",
    gen2Override: "Gen 2 Override",
    aumTrail: "AUM/Advisory Trail",
    affiliateA: "Affiliate Track A",
    affiliateB: "Affiliate Track B",
    affiliateC: "Affiliate Track C",
    affiliateD: "Affiliate Track D",
    channelRevenue: "Channel Revenue",
    partnerIncome: "Partner Income",
    renewalIncome: "Renewal Income",
    bonus: "Bonus",
  };
  return map[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function HeadlineCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="py-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          <div
            className="text-2xl font-extrabold mt-1"
            style={{ color: accent, fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrency(value)}
          </div>
        </div>
        <div className="rounded-full p-2" style={{ background: `${accent}15` }}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
