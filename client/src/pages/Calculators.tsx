import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Calculator, TrendingUp, Building2, PiggyBank, Loader2,
  Sparkles, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
  ChevronRight, Info,
} from "lucide-react";
import { useState, useMemo } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

// ─── MINI BAR CHART ─────────────────────────────────────────────────
function MiniBarChart({ data, valueKey, maxBars = 15 }: { data: any[]; valueKey: string; maxBars?: number }) {
  if (!data.length) return null;
  // Sample evenly if too many bars
  const sampled = data.length > maxBars
    ? Array.from({ length: maxBars }, (_, i) => data[Math.floor(i * (data.length - 1) / (maxBars - 1))])
    : data;
  const max = Math.max(...sampled.map((d: any) => Math.abs(d[valueKey])));
  return (
    <div className="flex items-end gap-[2px] h-16">
      {sampled.map((d: any, i: number) => {
        const val = d[valueKey];
        const height = max > 0 ? Math.max(2, (Math.abs(val) / max) * 100) : 2;
        const isNeg = val < 0;
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-all ${isNeg ? "bg-red-400/60" : "bg-accent/60"}`}
            style={{ height: `${height}%` }}
            title={`Year ${d.year || i + 1}: ${fmt(val)}`}
          />
        );
      })}
    </div>
  );
}

// ─── SUMMARY STAT CARD ──────────────────────────────────────────────
function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── SLIDER INPUT ───────────────────────────────────────────────────
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
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

// ─── CALCULATOR CARD WRAPPER ────────────────────────────────────────
const CALCULATORS = [
  { id: "iul", label: "IUL Projection", icon: <TrendingUp className="w-4 h-4" />, desc: "Indexed Universal Life illustration", color: "text-emerald-400" },
  { id: "pf", label: "Premium Finance", icon: <Building2 className="w-4 h-4" />, desc: "Leverage analysis for HNW clients", color: "text-blue-400" },
  { id: "ret", label: "Retirement", icon: <PiggyBank className="w-4 h-4" />, desc: "Wealth accumulation projection", color: "text-amber-400" },
] as const;

export default function Calculators() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [activeCalc, setActiveCalc] = useState<string>("iul");

  // IUL state
  const [iulAge, setIulAge] = useState(35);
  const [iulPremium, setIulPremium] = useState(12000);
  const [iulYears, setIulYears] = useState(30);
  const [iulRate, setIulRate] = useState(6.5);
  const [iulDB, setIulDB] = useState(500000);

  // Premium Finance state
  const [pfFace, setPfFace] = useState(5000000);
  const [pfPremium, setPfPremium] = useState(100000);
  const [pfLoanRate, setPfLoanRate] = useState(5.5);
  const [pfYears, setPfYears] = useState(10);
  const [pfCollateral, setPfCollateral] = useState(2.0);

  // Retirement state
  const [retAge, setRetAge] = useState(35);
  const [retTarget, setRetTarget] = useState(65);
  const [retSavings, setRetSavings] = useState(50000);
  const [retMonthly, setRetMonthly] = useState(1500);
  const [retReturn, setRetReturn] = useState(7.0);
  const [retInflation, setRetInflation] = useState(3.0);

  const iulCalc = trpc.calculators.iulProjection.useMutation({ onError: (e) => toast.error(e.message) });
  const pfCalc = trpc.calculators.premiumFinance.useMutation({ onError: (e) => toast.error(e.message) });
  const retCalc = trpc.calculators.retirement.useMutation({ onError: (e) => toast.error(e.message) });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Financial Calculators</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Calculator selector cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {CALCULATORS.map(calc => (
            <button
              key={calc.id}
              onClick={() => setActiveCalc(calc.id)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                activeCalc === calc.id
                  ? "bg-accent/8 border-accent/30 ring-1 ring-accent/10"
                  : "bg-card/40 border-border/50 hover:border-border"
              }`}
            >
              <div className={`mt-0.5 ${activeCalc === calc.id ? calc.color : "text-muted-foreground"}`}>
                {calc.icon}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${activeCalc === calc.id ? "text-foreground" : "text-muted-foreground"}`}>
                  {calc.label}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{calc.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ─── IUL CALCULATOR ─────────────────────────────────── */}
        {activeCalc === "iul" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> IUL Projection
                </CardTitle>
                <CardDescription className="text-xs">Adjust parameters to see projected values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderInput label="Current Age" value={iulAge} onChange={setIulAge} min={18} max={70} suffix=" yrs" />
                <SliderInput label="Annual Premium" value={iulPremium} onChange={setIulPremium} min={1000} max={100000} step={500} format={(v) => fmt(v)} />
                <SliderInput label="Projection Years" value={iulYears} onChange={setIulYears} min={5} max={50} suffix=" yrs" />
                <SliderInput label="Illustrated Rate" value={iulRate} onChange={setIulRate} min={0} max={12} step={0.5} suffix="%" />
                <SliderInput label="Death Benefit" value={iulDB} onChange={setIulDB} min={50000} max={10000000} step={25000} format={(v) => fmt(v)} />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                  onClick={() => iulCalc.mutate({ age: iulAge, annualPremium: iulPremium, years: iulYears, illustratedRate: iulRate, deathBenefit: iulDB })}
                  disabled={iulCalc.isPending}
                >
                  {iulCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Projection</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {iulCalc.data ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatCard label="Total Premiums" value={fmt(iulCalc.data.totalPremiums)} />
                    <StatCard
                      label="Final Cash Value"
                      value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.cashValue || 0)}
                      positive={true}
                    />
                    <StatCard
                      label="Surrender Value"
                      value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.surrenderValue || 0)}
                    />
                    <StatCard
                      label="Death Benefit"
                      value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.deathBenefit || 0)}
                      positive={true}
                    />
                  </div>

                  {/* Mini chart */}
                  <Card className="bg-card/60 border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Cash Value Growth</p>
                    <MiniBarChart data={iulCalc.data.projections} valueKey="cashValue" />
                  </Card>

                  {/* Table */}
                  <Card className="bg-card/60 border-border/50">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px]">Year</TableHead>
                            <TableHead className="text-[10px]">Age</TableHead>
                            <TableHead className="text-[10px] text-right">Cash Value</TableHead>
                            <TableHead className="text-[10px] text-right">Surrender</TableHead>
                            <TableHead className="text-[10px] text-right">Death Benefit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {iulCalc.data.projections.map((p) => (
                            <TableRow key={p.year} className="border-border/30">
                              <TableCell className="text-xs py-1.5">{p.year}</TableCell>
                              <TableCell className="text-xs py-1.5">{p.age}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(p.cashValue)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.surrenderValue)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-emerald-400">{fmt(p.deathBenefit)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                    <BarChart3 className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Adjust the sliders and click Calculate</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Results will appear here with charts and projections</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── PREMIUM FINANCE CALCULATOR ─────────────────────── */}
        {activeCalc === "pf" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" /> Premium Finance
                </CardTitle>
                <CardDescription className="text-xs">Leverage analysis for high-net-worth strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderInput label="Face Amount" value={pfFace} onChange={setPfFace} min={500000} max={50000000} step={250000} format={(v) => fmt(v)} />
                <SliderInput label="Annual Premium" value={pfPremium} onChange={setPfPremium} min={5000} max={1000000} step={5000} format={(v) => fmt(v)} />
                <SliderInput label="Loan Rate" value={pfLoanRate} onChange={setPfLoanRate} min={2} max={12} step={0.25} suffix="%" />
                <SliderInput label="Years" value={pfYears} onChange={setPfYears} min={3} max={30} suffix=" yrs" />
                <SliderInput label="Collateral Rate" value={pfCollateral} onChange={setPfCollateral} min={0.5} max={10} step={0.25} suffix="%" />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                  onClick={() => pfCalc.mutate({ faceAmount: pfFace, annualPremium: pfPremium, loanRate: pfLoanRate, years: pfYears, collateralRate: pfCollateral })}
                  disabled={pfCalc.isPending}
                >
                  {pfCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Analysis</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {pfCalc.data ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <StatCard label="Total Collateral Cost" value={fmt(pfCalc.data.totalCollateralCost)} />
                    <StatCard
                      label="Net Equity (Final)"
                      value={fmt(pfCalc.data.projections[pfCalc.data.projections.length - 1]?.netEquity || 0)}
                      positive={(pfCalc.data.projections[pfCalc.data.projections.length - 1]?.netEquity || 0) >= 0}
                    />
                    <StatCard label="ROI" value={`${pfCalc.data.roi}%`} positive={pfCalc.data.roi > 0} />
                  </div>

                  <Card className="bg-card/60 border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Net Equity Over Time</p>
                    <MiniBarChart data={pfCalc.data.projections} valueKey="netEquity" />
                  </Card>

                  <Card className="bg-card/60 border-border/50">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px]">Year</TableHead>
                            <TableHead className="text-[10px] text-right">Loan Balance</TableHead>
                            <TableHead className="text-[10px] text-right">Policy Value</TableHead>
                            <TableHead className="text-[10px] text-right">Net Equity</TableHead>
                            <TableHead className="text-[10px] text-right">Death Benefit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pfCalc.data.projections.map((p) => (
                            <TableRow key={p.year} className="border-border/30">
                              <TableCell className="text-xs py-1.5">{p.year}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.loanBalance)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(p.policyValue)}</TableCell>
                              <TableCell className={`text-xs text-right py-1.5 font-mono ${p.netEquity >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.netEquity)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-blue-400">{fmt(p.deathBenefit)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                    <BarChart3 className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Configure the premium finance scenario</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">See leverage analysis with equity projections</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── RETIREMENT CALCULATOR ──────────────────────────── */}
        {activeCalc === "ret" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-amber-400" /> Retirement Projection
                </CardTitle>
                <CardDescription className="text-xs">Wealth accumulation with inflation adjustment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderInput label="Current Age" value={retAge} onChange={setRetAge} min={18} max={70} suffix=" yrs" />
                <SliderInput label="Retirement Age" value={retTarget} onChange={setRetTarget} min={50} max={85} suffix=" yrs" />
                <SliderInput label="Current Savings" value={retSavings} onChange={setRetSavings} min={0} max={5000000} step={5000} format={(v) => fmt(v)} />
                <SliderInput label="Monthly Contribution" value={retMonthly} onChange={setRetMonthly} min={0} max={20000} step={100} format={(v) => fmt(v)} />
                <SliderInput label="Expected Return" value={retReturn} onChange={setRetReturn} min={1} max={15} step={0.5} suffix="%" />
                <SliderInput label="Inflation Rate" value={retInflation} onChange={setRetInflation} min={0} max={8} step={0.5} suffix="%" />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                  onClick={() => retCalc.mutate({ currentAge: retAge, retirementAge: retTarget, currentSavings: retSavings, monthlyContribution: retMonthly, expectedReturn: retReturn, inflationRate: retInflation })}
                  disabled={retCalc.isPending}
                >
                  {retCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Projection</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {retCalc.data ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <StatCard label="Final Balance" value={fmt(retCalc.data.finalBalance)} positive={true} />
                    <StatCard
                      label="Real Value (Today's $)"
                      value={fmt(retCalc.data.projections[retCalc.data.projections.length - 1]?.realBalance || 0)}
                      sub="Inflation-adjusted"
                    />
                    <StatCard
                      label="Monthly Income (4% Rule)"
                      value={fmt(retCalc.data.estimatedMonthlyIncome)}
                      positive={true}
                    />
                  </div>

                  <Card className="bg-card/60 border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Balance Growth (Nominal)</p>
                    <MiniBarChart data={retCalc.data.projections} valueKey="nominalBalance" />
                  </Card>

                  <Card className="bg-card/60 border-border/50">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px]">Year</TableHead>
                            <TableHead className="text-[10px]">Age</TableHead>
                            <TableHead className="text-[10px] text-right">Contributed</TableHead>
                            <TableHead className="text-[10px] text-right">Nominal</TableHead>
                            <TableHead className="text-[10px] text-right">Real (Today's $)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {retCalc.data.projections.map((p) => (
                            <TableRow key={p.year} className="border-border/30">
                              <TableCell className="text-xs py-1.5">{p.year}</TableCell>
                              <TableCell className="text-xs py-1.5">{p.age}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.totalContributed)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(p.nominalBalance)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-amber-400">{fmt(p.realBalance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                    <BarChart3 className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Set your retirement goals</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">See nominal and inflation-adjusted projections</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          These calculators are for illustrative purposes only. Actual results will vary. Consult a licensed financial professional before making decisions.
        </p>
      </div>
    </div>
  );
}
