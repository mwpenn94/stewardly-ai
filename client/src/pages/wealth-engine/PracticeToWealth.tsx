/**
 * PracticeToWealth — "Also My Client" THE WEALTH BRIDGE.
 *
 * For an advisor who is also a WealthBridge client, this page projects
 * how their practice income (BIE forward simulation) feeds personal
 * wealth (HE simulation with hasBizIncome=true). The visualization
 * pairs the BIE income trajectory with the HE liquid-wealth trajectory
 * and highlights the affiliate-track contribution as a hatched overlay.
 */

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectionChart } from "@/components/wealth-engine/ProjectionChart";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import { Loader2, Briefcase, PiggyBank } from "lucide-react";

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

  const bizProject = trpc.wealthEngine.projectBizIncome.useMutation();
  const holisticSim = trpc.wealthEngine.holisticSimulate.useMutation();

  const onRun = async () => {
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
      </div>
    </AppShell>
  );
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
