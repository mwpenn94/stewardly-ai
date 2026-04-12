/**
 * OwnerCompPage — Entity optimization + retirement stacking + QBI.
 *
 * Lets a business owner (or advisor working with one) compare the
 * tax burden under Sole Prop / LLC / S-Corp / C-Corp entity choices,
 * see the recommended owner salary, QBI deduction, self-employment
 * tax, retirement plan stack, and net take-home — all in a single
 * pass through the `wealthEngine.ownerCompCompareEntities` tRPC
 * mutation.
 */

import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Loader2, DollarSign, TrendingUp, Sparkles, Shield,
  PiggyBank, ArrowLeft, BarChart3, Info,
} from "lucide-react";
import { useLocation } from "wouter";

type Entity = "sole_prop" | "llc" | "s_corp" | "c_corp";

const ENTITY_LABELS: Record<Entity, string> = {
  sole_prop: "Sole Proprietor",
  llc: "LLC / Partnership",
  s_corp: "S-Corporation",
  c_corp: "C-Corporation",
};

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function OwnerCompPage() {
  const [, navigate] = useLocation();
  const [profit, setProfit] = useState(250_000);
  const [filing, setFiling] = useState<"single" | "mfj" | "hoh">("single");
  const [age, setAge] = useState(42);
  const [stateRate, setStateRate] = useState(0.05);
  const [isSstb, setIsSstb] = useState(false);
  const [hasEmployees, setHasEmployees] = useState(false);
  const [targetYears, setTargetYears] = useState(20);

  const compareMut = trpc.wealthEngine.ownerCompCompareEntities.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const run = () =>
    compareMut.mutate({
      netBusinessProfit: profit,
      filingStatus: filing,
      age,
      stateRate,
      isSstb,
      hasEmployees,
      targetYearsToRetire: targetYears,
    });

  const result = compareMut.data?.data;
  const best = useMemo(() => {
    if (!result) return null;
    return result.results.find((r: { entity: string }) => r.entity === result.recommended) ?? result.results[0];
  }, [result]);

  return (
    <AppShell title="Owner Compensation">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/wealth-engine")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h1 className="text-lg font-heading font-semibold">Owner Compensation</h1>
              <Badge variant="outline" className="h-4 text-[9px] border-accent/40 text-accent px-1">
                New
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Compare entity structures, QBI, retirement stacking, and net take-home — all in one pass.
            </p>
          </div>
        </div>

        {/* Input form */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Business inputs</CardTitle>
            <CardDescription className="text-[11px]">
              Engine compares all 4 entities and ranks them by net take-home.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Net Profit</Label>
              <Input
                type="number"
                value={profit}
                onChange={(e) => setProfit(+e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Filing</Label>
              <select
                value={filing}
                onChange={(e) => setFiling(e.target.value as "single" | "mfj" | "hoh")}
                className="h-8 text-xs w-full rounded-md bg-background border border-border px-2"
              >
                <option value="single">Single</option>
                <option value="mfj">Married Jointly</option>
                <option value="hoh">Head of Household</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Age</Label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(+e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">State Rate</Label>
              <Input
                type="number"
                step={0.005}
                value={stateRate}
                onChange={(e) => setStateRate(+e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Years to Retire</Label>
              <Input
                type="number"
                value={targetYears}
                onChange={(e) => setTargetYears(+e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 h-8 col-span-1">
              <Label className="text-[11px] cursor-pointer">SSTB</Label>
              <Switch checked={isSstb} onCheckedChange={setIsSstb} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 h-8 col-span-1">
              <Label className="text-[11px] cursor-pointer">Has Employees</Label>
              <Switch checked={hasEmployees} onCheckedChange={setHasEmployees} />
            </div>
            <Button
              onClick={run}
              disabled={compareMut.isPending}
              className="h-8 text-xs gap-1.5 col-span-1"
            >
              {compareMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Compare entities
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <>
            {/* Recommendation banner */}
            <Card className="bg-accent/5 border-accent/30">
              <CardContent className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    Recommended
                  </p>
                  <p className="text-lg font-heading font-semibold text-accent">
                    {ENTITY_LABELS[result.recommended as Entity] ?? result.recommended}
                  </p>
                  <p className="text-xs text-muted-foreground">
                      Saves {fmt(result.savings ?? 0)} vs worst-case entity
                  </p>
                </div>
                {best && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Net take-home</p>
                      <p className="text-base font-semibold text-emerald-400 tabular-nums">{fmt(best.netTakeHome)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Effective rate</p>
                      <p className="text-base font-semibold tabular-nums">{pct(best.effectiveRate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">QBI deduction</p>
                      <p className="text-base font-semibold text-accent tabular-nums">{fmt(best.qbi.deduction)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entity comparison grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {result.results.map((snap: (typeof result.results)[number]) => {
                const isBest = snap.entity === result.recommended;
                return (
                  <Card
                    key={snap.entity}
                    className={
                      isBest
                        ? "bg-accent/5 border-accent/40"
                        : "bg-card/60 border-border/50"
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{ENTITY_LABELS[snap.entity as Entity] ?? snap.entity}</CardTitle>
                        {isBest && (
                          <Badge variant="outline" className="h-4 text-[9px] border-accent/50 text-accent px-1">
                            Best
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-xs">
                      <Row label="Owner salary" value={fmt(snap.ownerSalary)} />
                      <Row label="Self-employment tax" value={fmt(snap.selfEmploymentTax)} />
                      <Row label="Payroll tax (ee + er)" value={fmt(snap.employeePayrollTax + snap.employerPayrollTax)} />
                      <Row label="Federal income tax" value={fmt(snap.federalIncomeTax)} />
                      <Row label="State tax" value={fmt(snap.stateTax)} />
                      <Row label="QBI deduction" value={fmt(snap.qbi.deduction)} accent="text-emerald-400" />
                      <Row label="Retirement stack" value={fmt(snap.retirementPlan.total)} accent="text-accent" />
                      <div className="border-t border-border/30 my-1" />
                      <Row label="Total taxes" value={fmt(snap.totalTaxes)} bold />
                      <Row label="Net take-home" value={fmt(snap.netTakeHome)} bold accent="text-emerald-400" />
                      <Row label="Effective rate" value={pct(snap.effectiveRate)} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recommended entity deep dive */}
            {best && (
              <Tabs defaultValue="retirement" className="w-full">
                <TabsList className="grid grid-cols-3 max-w-md">
                  <TabsTrigger value="retirement">Retirement</TabsTrigger>
                  <TabsTrigger value="qbi">QBI</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="retirement" className="mt-3">
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-amber-400" />
                        <CardTitle className="text-sm">Retirement stack</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <p className="text-muted-foreground">{(best.retirementPlan as any).reasoning ?? "Retirement plan analysis"}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                        <StatChip label="Plan" value={((best.retirementPlan as any).plan ?? "401k").replace("_", " ")} />
                        <StatChip label="Employee" value={fmt((best.retirementPlan as any).employeeContribution ?? 0)} />
                        <StatChip label="Employer" value={fmt((best.retirementPlan as any).employerContribution ?? 0)} />
                        <StatChip label="Total" value={fmt(best.retirementPlan.total)} accent="text-accent" />
                        <StatChip label="After-tax save" value={fmt((best.retirementPlan as any).afterTaxSavings ?? 0)} accent="text-emerald-400" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="qbi" className="mt-3">
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-accent" />
                        <CardTitle className="text-sm">§ 199A QBI deduction</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <StatChip label="Deduction" value={fmt(best.qbi.deduction)} accent="text-emerald-400" />
                        <StatChip label="Phase-out" value={(best.qbi as any).phaseoutApplied ? "Yes" : "No"} />
                        <StatChip label="Reason" value={((best.qbi as any).reason ?? "eligible").replace(/-/g, " ")} />
                      </div>
                      <div className="flex gap-2 text-[11px] text-muted-foreground pt-2">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <p>
                          QBI is 20% of qualified business income, subject to taxable income caps and
                          SSTB / W-2 wage / UBIA limitations. C-Corporations do not qualify.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="mt-3">
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Engine notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-xs">
                      {((best as any).notes ?? [] as string[]).map((n: string, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-muted-foreground/50 tabular-nums">{i + 1}.</span>
                          <span className="text-muted-foreground">{n}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {/* Secondary CTAs */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => navigate("/wealth-engine/business-valuation")}
              >
                <TrendingUp className="w-3 h-3" /> Business valuation
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => navigate("/engine-dashboard")}
              >
                <BarChart3 className="w-3 h-3" /> Engine dashboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => navigate("/tax-planning")}
              >
                <DollarSign className="w-3 h-3" /> Multi-year tax plan
              </Button>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-2">
          April 2026 tax constants. Illustrative only — engage a CPA before filing.
        </p>
      </div>
    </AppShell>
  );
}

function Row({
  label, value, bold, accent = "",
}: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-mono ${bold ? "font-semibold" : ""} ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function StatChip({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 p-2">
      <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
