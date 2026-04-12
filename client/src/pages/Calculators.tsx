import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
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
  ChevronRight, Info, Heart, Scale, GraduationCap, Stethoscope,
  HandCoins, Briefcase, ListChecks, ShieldAlert, Dice5,
} from "lucide-react";
import { useState, useMemo } from "react";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";

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
  { id: "tax", label: "Tax Projector", icon: <DollarSign className="w-4 h-4" />, desc: "Multi-year tax projection & Roth analysis", color: "text-violet-400" },
  { id: "ss", label: "Social Security", icon: <Calculator className="w-4 h-4" />, desc: "Optimize claiming strategy", color: "text-cyan-400" },
  { id: "medicare", label: "Medicare", icon: <Stethoscope className="w-4 h-4" />, desc: "Navigate Medicare enrollment & costs", color: "text-rose-400" },
  { id: "hsa", label: "HSA Optimizer", icon: <Heart className="w-4 h-4" />, desc: "Health Savings Account strategy", color: "text-pink-400" },
  { id: "charitable", label: "Charitable", icon: <HandCoins className="w-4 h-4" />, desc: "Giving strategy optimization", color: "text-orange-400" },
  { id: "divorce", label: "Divorce Analysis", icon: <Scale className="w-4 h-4" />, desc: "Asset division & alimony modeling", color: "text-red-400" },
  { id: "education", label: "Education", icon: <GraduationCap className="w-4 h-4" />, desc: "529 & education funding planner", color: "text-indigo-400" },
  { id: "stress", label: "Stress Test", icon: <ShieldAlert className="w-4 h-4" />, desc: "S&P 500 backtest + crisis scenarios", color: "text-red-500" },
  { id: "montecarlo", label: "Monte Carlo", icon: <Dice5 className="w-4 h-4" />, desc: "1,000-trial probability simulation", color: "text-purple-400" },
] as const;

export default function Calculators() {
  useAuth();
  const [, navigate] = useLocation();
  const pil = usePlatformIntelligence();
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

  // Stress Test state
  const [stressBalance, setStressBalance] = useState(500000);
  const [stressContrib, setStressContrib] = useState(12000);
  const [stressCost, setStressCost] = useState(5000);
  const [stressHorizon, setStressHorizon] = useState(30);
  const [stressScenario, setStressScenario] = useState("gfc2008");
  const backtestCalc = trpc.calculatorEngine.historicalBacktest.useMutation({ onError: (e) => toast.error(e.message) });
  const stressCalc = trpc.calculatorEngine.stressTest.useMutation({ onError: (e) => toast.error(e.message) });
  const scenariosQuery = trpc.calculatorEngine.stressScenarios.useQuery();

  // Monte Carlo state
  const [mcBalance, setMcBalance] = useState(500000);
  const [mcContrib, setMcContrib] = useState(12000);
  const [mcYears, setMcYears] = useState(30);
  const [mcVolatility, setMcVolatility] = useState(15);
  const [mcTrials, setMcTrials] = useState(1000);
  const mcCalc = trpc.calculatorEngine.uweMonteCarlo.useMutation({ onError: (e) => toast.error(e.message) });

  return (
    <AppShell title="Calculators">
      <SEOHead title="Calculators" description="Financial calculators powered by the Wealth Engine" />
    <div className="min-h-screen">
      {/* Header — hidden on mobile where AppShell provides navigation */}
      <div className="hidden lg:block border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 relative">
          <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Financial Calculators</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Wealth Engine — advanced multi-engine comparison tools */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Wealth Engine</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Strategy Comparison", path: "/wealth-engine/strategy-comparison", icon: <BarChart3 className="w-4 h-4" />, desc: "Compare 7 wealth strategies" },
              { label: "Retirement Planner", path: "/wealth-engine/retirement", icon: <PiggyBank className="w-4 h-4" />, desc: "Goal, smooth, guardrails" },
              { label: "Practice to Wealth", path: "/wealth-engine/practice-to-wealth", icon: <TrendingUp className="w-4 h-4" />, desc: "Practice growth modeling" },
              { label: "Quick Quote", path: "/wealth-engine/quick-quote", icon: <Sparkles className="w-4 h-4" />, desc: "Instant client proposal" },
              { label: "Business Income", path: "/wealth-engine/business-income", icon: <DollarSign className="w-4 h-4" />, desc: "BIE practice income modeling" },
              { label: "Engine Dashboard", path: "/engine-dashboard", icon: <ListChecks className="w-4 h-4" />, desc: "Multi-engine comparison" },
            ].map(tool => (
              <button
                key={tool.path}
                onClick={() => navigate(tool.path)}
                className="card-lift p-3 rounded-lg border border-border bg-card/60 hover:bg-secondary/40 transition-colors text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent">{tool.icon}</span>
                  <span className="text-xs font-medium">{tool.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Planning & Analysis — standalone advisory tools */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Planning & Analysis</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Tax Planning", path: "/tax-planning", icon: <DollarSign className="w-4 h-4" />, desc: "Brackets, Roth, strategy" },
              { label: "Estate Planning", path: "/estate", icon: <Briefcase className="w-4 h-4" />, desc: "Documents, beneficiaries, estate tax" },
              { label: "Risk Assessment", path: "/risk-assessment", icon: <Scale className="w-4 h-4" />, desc: "Risk profile analysis" },
              { label: "Income Projection", path: "/income-projection", icon: <TrendingUp className="w-4 h-4" />, desc: "Income modeling" },
              { label: "Insurance Analysis", path: "/insurance-analysis", icon: <Heart className="w-4 h-4" />, desc: "Coverage analysis" },
              { label: "Protection Score", path: "/financial-protection-score", icon: <Calculator className="w-4 h-4" />, desc: "12-dimension scoring" },
            ].map(tool => (
              <button
                key={tool.path}
                onClick={() => navigate(tool.path)}
                className="card-lift p-3 rounded-lg border border-border bg-card/60 hover:bg-secondary/40 transition-colors text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent">{tool.icon}</span>
                  <span className="text-xs font-medium">{tool.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
              </button>
            ))}
          </div>
        </div>

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
                  onClick={() => { iulCalc.mutate({ age: iulAge, annualPremium: iulPremium, years: iulYears, illustratedRate: iulRate, deathBenefit: iulDB }); pil.giveFeedback("engine.calculation_complete"); }}
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
        {/* ─── TAX PROJECTOR ──────────────────────────────── */}
        {activeCalc === "tax" && (
          <TaxProjectorPanel />
        )}
        {/* ─── SOCIAL SECURITY ─────────────────────────────── */}
        {activeCalc === "ss" && (
          <SSOptimizerPanel />
        )}
        {/* ─── MEDICARE ───────────────────────────────────── */}
        {activeCalc === "medicare" && (
          <MedicarePanel />
        )}
        {/* ─── HSA OPTIMIZER ──────────────────────────────── */}
        {activeCalc === "hsa" && (
          <HSAOptimizerPanel />
        )}
        {/* ─── CHARITABLE GIVING ──────────────────────────── */}
        {activeCalc === "charitable" && (
          <CharitablePanel />
        )}
        {/* ─── DIVORCE ANALYSIS ───────────────────────────── */}
        {activeCalc === "divorce" && (
          <DivorcePanel />
        )}
        {/* ─── EDUCATION PLANNER ──────────────────────────── */}
        {activeCalc === "education" && (
          <EducationPanel />
        )}
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

        {/* ─── STRESS TEST (SCUI) ──────────────────────────── */}
        {activeCalc === "stress" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Stress Test & Backtest
                </CardTitle>
                <CardDescription className="text-xs">S&P 500 historical backtest (1928-2025) + crisis scenarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderInput label="Starting Balance" value={stressBalance} onChange={setStressBalance} min={10000} max={10000000} step={10000} format={fmt} />
                <SliderInput label="Annual Contribution" value={stressContrib} onChange={setStressContrib} min={0} max={200000} step={1000} format={fmt} />
                <SliderInput label="Annual Cost" value={stressCost} onChange={setStressCost} min={0} max={100000} step={500} format={fmt} />
                <SliderInput label="Horizon" value={stressHorizon} onChange={setStressHorizon} min={5} max={50} suffix=" yrs" />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Stress Scenario</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(scenariosQuery.data ?? []).map((s: any) => (
                      <button
                        key={s.key}
                        onClick={() => setStressScenario(s.key)}
                        className={`text-left p-2 rounded-md border text-[10px] transition-all ${
                          stressScenario === s.key
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-card/40 border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <span className="font-medium block">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                    onClick={() => backtestCalc.mutate({ startBalance: stressBalance, annualContribution: stressContrib, annualCost: stressCost, horizon: stressHorizon })}
                    disabled={backtestCalc.isPending}
                  >
                    {backtestCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BarChart3 className="w-4 h-4" /> Backtest</>}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-sm h-10 gap-2"
                    onClick={() => stressCalc.mutate({ scenarioKey: stressScenario, startBalance: stressBalance, annualContribution: stressContrib, annualCost: stressCost })}
                    disabled={stressCalc.isPending}
                  >
                    {stressCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldAlert className="w-4 h-4" /> Stress</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {backtestCalc.data ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatCard label="Best Period" value={fmt((backtestCalc.data as any).bestEndingValue ?? 0)} positive={true} />
                    <StatCard label="Worst Period" value={fmt((backtestCalc.data as any).worstEndingValue ?? 0)} positive={false} />
                    <StatCard label="Median" value={fmt((backtestCalc.data as any).medianEndingValue ?? 0)} />
                    <StatCard label="Success Rate" value={`${((backtestCalc.data as any).successRate ?? 0).toFixed(0)}%`} positive={((backtestCalc.data as any).successRate ?? 0) >= 80} />
                  </div>
                  {(backtestCalc.data as any).periods?.length > 0 && (
                    <Card className="bg-card/60 border-border/50 p-4">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Rolling {stressHorizon}-Year Ending Values</p>
                      <MiniBarChart data={(backtestCalc.data as any).periods} valueKey="endingValue" maxBars={20} />
                    </Card>
                  )}
                </>
              ) : stressCalc.data ? (
                <Card className="bg-card/60 border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Stress Test Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="Starting Balance" value={fmt(stressBalance)} />
                      <StatCard label="Final Value" value={fmt((stressCalc.data as any).endingValue ?? 0)} positive={((stressCalc.data as any).endingValue ?? 0) > stressBalance} />
                    </div>
                    {(stressCalc.data as any).yearByYear?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Year-by-Year During Crisis</p>
                        <MiniBarChart data={(stressCalc.data as any).yearByYear} valueKey="balance" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                    <ShieldAlert className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Run a historical backtest or stress scenario</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Uses real S&P 500 data from 1928-2025</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MONTE CARLO SIMULATION ────────────────────────── */}
        {activeCalc === "montecarlo" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Dice5 className="w-4 h-4 text-purple-400" /> Monte Carlo Simulation
                </CardTitle>
                <CardDescription className="text-xs">Probabilistic wealth projection with {mcTrials.toLocaleString()} trials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderInput label="Starting Balance" value={mcBalance} onChange={setMcBalance} min={10000} max={10000000} step={10000} format={fmt} />
                <SliderInput label="Annual Contribution" value={mcContrib} onChange={setMcContrib} min={0} max={200000} step={1000} format={fmt} />
                <SliderInput label="Years" value={mcYears} onChange={setMcYears} min={5} max={50} suffix=" yrs" />
                <SliderInput label="Volatility" value={mcVolatility} onChange={setMcVolatility} min={5} max={40} suffix="%" />
                <SliderInput label="Trials" value={mcTrials} onChange={setMcTrials} min={100} max={5000} step={100} />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                  onClick={() => {
                    const strategy = {
                      company: "wealthbridge" as const,
                      companyName: "WealthBridge",
                      color: "#16A34A",
                      profile: { age: 40, income: 120000, savings: mcBalance, monthlySavings: Math.round(mcContrib / 12), equitiesReturn: 0.07 },
                      products: [{ type: "aum" as const, initialAUM: mcBalance, annualAdd: mcContrib, feeRate: 0.008, grossReturn: 0.08, advisoryAlpha: 0.02, taxDrag: 0.005 }],
                      features: { holistic: true, taxFree: false, livingBen: false, advisor: true, estate: false, group: false, fiduciary: true, lowFees: false, insurance: false },
                      notes: "",
                    };
                    mcCalc.mutate({ strategy, years: mcYears, trials: mcTrials, volatility: mcVolatility / 100 });
                  }}
                  disabled={mcCalc.isPending}
                >
                  {mcCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Dice5 className="w-4 h-4" /> Run Simulation</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {mcCalc.data && Array.isArray(mcCalc.data) && mcCalc.data.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <StatCard label="10th Percentile" value={fmt(mcCalc.data[mcCalc.data.length - 1]?.p10 ?? 0)} positive={false} sub="Worst case" />
                    <StatCard label="25th Percentile" value={fmt(mcCalc.data[mcCalc.data.length - 1]?.p25 ?? 0)} />
                    <StatCard label="Median (50th)" value={fmt(mcCalc.data[mcCalc.data.length - 1]?.p50 ?? 0)} positive={true} sub="Most likely" />
                    <StatCard label="75th Percentile" value={fmt(mcCalc.data[mcCalc.data.length - 1]?.p75 ?? 0)} positive={true} />
                    <StatCard label="90th Percentile" value={fmt(mcCalc.data[mcCalc.data.length - 1]?.p90 ?? 0)} positive={true} sub="Best case" />
                  </div>

                  <Card className="bg-card/60 border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Probability Envelope (Median)</p>
                    <MiniBarChart data={mcCalc.data} valueKey="p50" />
                  </Card>

                  <Card className="bg-card/60 border-border/50">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px]">Year</TableHead>
                            <TableHead className="text-[10px] text-right">P10</TableHead>
                            <TableHead className="text-[10px] text-right">P25</TableHead>
                            <TableHead className="text-[10px] text-right">Median</TableHead>
                            <TableHead className="text-[10px] text-right">P75</TableHead>
                            <TableHead className="text-[10px] text-right">P90</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mcCalc.data.map((p: any, i: number) => (
                            <TableRow key={i} className="border-border/30">
                              <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-red-400">{fmt(p.p10)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.p25)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-foreground">{fmt(p.p50)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.p75)}</TableCell>
                              <TableCell className="text-xs text-right py-1.5 font-mono text-emerald-400">{fmt(p.p90)}</TableCell>
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
                    <Dice5 className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Run a Monte Carlo simulation</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">See probability ranges across {mcTrials.toLocaleString()} simulated scenarios</p>
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
    </AppShell>
  );
}

// ─── Part F Calculator Panels ──────────────────────────────────────────

function CalcPanel({ title, icon, color, children, onCalculate, isLoading, result }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode;
  onCalculate: () => void; isLoading: boolean; result: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-2 bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={color}>{icon}</span> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <Button size="sm" className="w-full" onClick={onCalculate} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Calculate
          </Button>
        </CardContent>
      </Card>
      <div className="lg:col-span-3">
        {result}
      </div>
    </div>
  );
}

function TaxProjectorPanel() {
  const [wages, setWages] = useState(150000);
  const [deductions, setDeductions] = useState(0);
  const [stateCode, setStateCode] = useState("TX");
  const taxCalc = trpc.taxProjector.project.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Tax Projector" icon={<DollarSign className="w-4 h-4" />} color="text-violet-400"
      onCalculate={() => taxCalc.mutate({ filingStatus: "mfj", wages, itemizedDeductions: deductions, stateCode })}
      isLoading={taxCalc.isPending}
      result={taxCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <p className="text-[10px] text-muted-foreground">Federal Tax</p>
                <p className="text-lg font-semibold text-violet-400">{fmt(taxCalc.data.federalTax)}</p>
              </div>
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <p className="text-[10px] text-muted-foreground">Effective Rate</p>
                <p className="text-lg font-semibold text-violet-400">{(taxCalc.data.effectiveRate * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">State Tax</p>
                <p className="text-lg font-semibold">{fmt(taxCalc.data.stateTax)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Total Tax</p>
                <p className="text-lg font-semibold">{fmt(taxCalc.data.totalTax)}</p>
              </div>
            </div>
            {taxCalc.data.bracketBreakdown?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Bracket Breakdown</p>
                {taxCalc.data.bracketBreakdown.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{b.bracket}</span>
                    <span className="font-mono">{fmt(b.taxOnBracket)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <DollarSign className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Configure tax parameters</p>
        </div>
      )}
    >
      <SliderInput label="W-2 Wages" value={wages} onChange={setWages} min={25000} max={2000000} step={5000} format={fmt} />
      <SliderInput label="Itemized Deductions" value={deductions} onChange={setDeductions} min={0} max={500000} step={1000} format={fmt} />
    </CalcPanel>
  );
}

function SSOptimizerPanel() {
  const [birthYear, setBirthYear] = useState(1963);
  const [pia, setPia] = useState(2500);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const ssCalc = trpc.ssOptimizer.optimize.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Social Security Optimizer" icon={<Calculator className="w-4 h-4" />} color="text-cyan-400"
      onCalculate={() => ssCalc.mutate({ birthYear, birthMonth: 6, earningsHistory: [], estimatedPIA: pia, filingStatus: "single", lifeExpectancy, discountRate: 0.03 })}
      isLoading={ssCalc.isPending}
      result={ssCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-[10px] text-muted-foreground">Optimal Claiming Age</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-cyan-400">{ssCalc.data.optimalAge}</p>
              <p className="text-xs text-muted-foreground mt-1">{ssCalc.data.optimalReason}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">PIA (Full Retirement)</p>
                <p className="text-sm font-semibold">{fmt(ssCalc.data.pia)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Full Retirement Age</p>
                <p className="text-sm font-semibold">{ssCalc.data.fra.toFixed(1)} yrs</p>
              </div>
            </div>
            {ssCalc.data.scenarios?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Claiming Scenarios</p>
                {ssCalc.data.scenarios.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Age {s.claimingAge} ({s.reductionOrIncrease})</span>
                    <span className="font-mono">{fmt(s.monthlyBenefit)}/mo</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <Calculator className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Enter your Social Security details</p>
        </div>
      )}
    >
      <SliderInput label="Birth Year" value={birthYear} onChange={setBirthYear} min={1940} max={1990} />
      <SliderInput label="Estimated PIA (Monthly)" value={pia} onChange={setPia} min={500} max={5000} step={50} format={fmt} />
      <SliderInput label="Life Expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={70} max={100} suffix=" yrs" />
    </CalcPanel>
  );
}

function MedicarePanel() {
  const [age, setAge] = useState(64);
  const [magi, setMagi] = useState(100000);
  const medCalc = trpc.medicareNav.navigate.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Medicare Navigator" icon={<Stethoscope className="w-4 h-4" />} color="text-rose-400"
      onCalculate={() => medCalc.mutate({ age, retirementAge: 65, magi, filingStatus: "mfj" })}
      isLoading={medCalc.isPending}
      result={medCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <p className="text-[10px] text-muted-foreground">Best Pathway</p>
              <p className="text-lg font-bold text-rose-400">{medCalc.data.bestPathway}</p>
            </div>
            {medCalc.data.pathways?.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/50">
                <div className="flex justify-between">
                  <span className="text-xs font-medium">{p.label}</span>
                  <Badge variant="outline" className="text-[10px]">{p.score}/100</Badge>
                </div>
                <p className="text-sm font-semibold mt-1">{fmt(p.totalAnnualCost)}/yr</p>
              </div>
            ))}
            {medCalc.data.enrollmentTimeline?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Enrollment Timeline</p>
                {medCalc.data.enrollmentTimeline.map((t: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t.event}</span>
                    <span>{t.deadline}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <Stethoscope className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Enter Medicare details</p>
        </div>
      )}
    >
      <SliderInput label="Age" value={age} onChange={setAge} min={60} max={75} suffix=" yrs" />
      <SliderInput label="MAGI" value={magi} onChange={setMagi} min={0} max={500000} step={5000} format={fmt} />
    </CalcPanel>
  );
}

function HSAOptimizerPanel() {
  const [age, setAge] = useState(40);
  const [contribution, setContribution] = useState(3850);
  const [medExpenses, setMedExpenses] = useState(3000);
  const hsaCalc = trpc.hsaOptimizer.optimize.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="HSA Optimizer" icon={<Heart className="w-4 h-4" />} color="text-pink-400"
      onCalculate={() => hsaCalc.mutate({ age, coverageType: "self", annualContribution: contribution, annualMedicalExpenses: medExpenses, marginalTaxRate: 0.24, stateTaxRate: 0.05, yearsToRetirement: 65 - age })}
      isLoading={hsaCalc.isPending}
      result={hsaCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <p className="text-[10px] text-muted-foreground">Best Strategy</p>
              <p className="text-lg font-bold text-pink-400">{hsaCalc.data.bestStrategy}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Max Contribution</p>
                <p className="text-sm font-semibold">{fmt(hsaCalc.data.maxContribution)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Triple Tax Savings</p>
                <p className="text-sm font-semibold text-pink-400">{fmt(hsaCalc.data.tripleAdvantage.totalLifetimeSavings)}</p>
              </div>
            </div>
            {hsaCalc.data.catchUpEligible && (
              <p className="text-xs text-pink-400">Catch-up eligible: +{fmt(hsaCalc.data.catchUpAmount)}/yr</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <Heart className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Configure HSA parameters</p>
        </div>
      )}
    >
      <SliderInput label="Age" value={age} onChange={setAge} min={18} max={64} suffix=" yrs" />
      <SliderInput label="Annual Contribution" value={contribution} onChange={setContribution} min={0} max={8550} step={50} format={fmt} />
      <SliderInput label="Annual Medical Expenses" value={medExpenses} onChange={setMedExpenses} min={0} max={50000} step={500} format={fmt} />
    </CalcPanel>
  );
}

function CharitablePanel() {
  const [donationGoal, setDonationGoal] = useState(25000);
  const [agi, setAgi] = useState(250000);
  const charCalc = trpc.charitableGiving.optimize.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Charitable Giving" icon={<HandCoins className="w-4 h-4" />} color="text-orange-400"
      onCalculate={() => charCalc.mutate({ annualDonationGoal: donationGoal, marginalTaxRate: 0.32, stateTaxRate: 0.05, age: 55, filingStatus: "mfj", agi, itemizesDeductions: true })}
      isLoading={charCalc.isPending}
      result={charCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-[10px] text-muted-foreground">Best Vehicle</p>
              <p className="text-lg font-bold text-orange-400">{charCalc.data.bestVehicle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Total Tax Savings</p>
                <p className="text-sm font-semibold text-orange-400">{fmt(charCalc.data.totalTaxSavings)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Effective Cost of Giving</p>
                <p className="text-sm font-semibold">{fmt(charCalc.data.effectiveCostOfGiving)}</p>
              </div>
            </div>
            {charCalc.data.strategies?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Strategies</p>
                {charCalc.data.strategies.slice(0, 3).map((s: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <HandCoins className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Plan your charitable giving</p>
        </div>
      )}
    >
      <SliderInput label="AGI" value={agi} onChange={setAgi} min={50000} max={2000000} step={5000} format={fmt} />
      <SliderInput label="Donation Goal" value={donationGoal} onChange={setDonationGoal} min={1000} max={500000} step={1000} format={fmt} />
    </CalcPanel>
  );
}

function DivorcePanel() {
  const [totalAssets, setTotalAssets] = useState(2000000);
  const [income1, setIncome1] = useState(150000);
  const [income2, setIncome2] = useState(80000);
  const [yearsMarried, setYearsMarried] = useState(15);
  const divCalc = trpc.divorce.analyze.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Divorce Analysis" icon={<Scale className="w-4 h-4" />} color="text-red-400"
      onCalculate={() => divCalc.mutate({
        assets: [{ name: "Primary Home", type: "real_estate", fairMarketValue: totalAssets * 0.4, classification: "marital", owner: "joint" },
                 { name: "Retirement", type: "retirement_pretax", fairMarketValue: totalAssets * 0.3, classification: "marital", owner: "joint" },
                 { name: "Brokerage", type: "brokerage", fairMarketValue: totalAssets * 0.2, classification: "marital", owner: "joint" },
                 { name: "Cash", type: "cash", fairMarketValue: totalAssets * 0.1, classification: "marital", owner: "joint" }],
        spouse1Income: income1, spouse2Income: income2, spouse1Age: 50, spouse2Age: 48,
        yearsMarried, state: "CA", marginalRate: 0.32
      })}
      isLoading={divCalc.isPending}
      result={divCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] text-muted-foreground">Total Marital Estate</p>
                <p className="text-lg font-semibold text-red-400">{fmt(divCalc.data.totalMaritalEstate)}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] text-muted-foreground">Support Cost</p>
                <p className="text-lg font-semibold text-red-400">{fmt(divCalc.data.supportAnalysis.totalSupportCost)}</p>
              </div>
            </div>
            {divCalc.data.scenarios?.slice(0, 2).map((s: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs font-medium">{s.name}</p>
                <div className="flex justify-between text-xs mt-1">
                  <span>Spouse 1: {fmt(s.spouse1Total)}</span>
                  <span>Spouse 2: {fmt(s.spouse2Total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <Scale className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Model asset division scenarios</p>
        </div>
      )}
    >
      <SliderInput label="Total Marital Assets" value={totalAssets} onChange={setTotalAssets} min={100000} max={20000000} step={50000} format={fmt} />
      <SliderInput label="Spouse 1 Income" value={income1} onChange={setIncome1} min={0} max={1000000} step={5000} format={fmt} />
      <SliderInput label="Spouse 2 Income" value={income2} onChange={setIncome2} min={0} max={1000000} step={5000} format={fmt} />
      <SliderInput label="Years Married" value={yearsMarried} onChange={setYearsMarried} min={1} max={50} suffix=" yrs" />
    </CalcPanel>
  );
}

function EducationPanel() {
  const [childAge, setChildAge] = useState(5);
  const [annualCost, setAnnualCost] = useState(40000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const eduCalc = trpc.educationPlanner.plan.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Education Planner" icon={<GraduationCap className="w-4 h-4" />} color="text-indigo-400"
      onCalculate={() => eduCalc.mutate({ childAge, annualCostToday: annualCost, monthlyContribution, marginalTaxRate: 0.24, stateTaxRate: 0.05 })}
      isLoading={eduCalc.isPending}
      result={eduCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-[10px] text-muted-foreground">Total Projected Cost</p>
                <p className="text-lg font-semibold text-indigo-400">{fmt(eduCalc.data.totalProjectedCost)}</p>
              </div>
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-[10px] text-muted-foreground">Funding Gap</p>
                <p className={`text-lg font-semibold ${eduCalc.data.fundingGap > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {eduCalc.data.fundingGap > 0 ? `-${fmt(eduCalc.data.fundingGap)}` : "Fully Funded"}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-[10px] text-muted-foreground">Best Vehicle</p>
              <p className="text-sm font-semibold">{eduCalc.data.bestVehicle}</p>
              <p className="text-xs text-muted-foreground mt-1">Monthly needed: {fmt(eduCalc.data.monthlyNeeded)}</p>
            </div>
            {eduCalc.data.strategies?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Strategies</p>
                {eduCalc.data.strategies.slice(0, 3).map((s: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <GraduationCap className="w-6 h-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Plan education funding</p>
        </div>
      )}
    >
      <SliderInput label="Child's Age" value={childAge} onChange={setChildAge} min={0} max={17} suffix=" yrs" />
      <SliderInput label="Annual Cost Today" value={annualCost} onChange={setAnnualCost} min={10000} max={100000} step={1000} format={fmt} />
      <SliderInput label="Monthly Contribution" value={monthlyContribution} onChange={setMonthlyContribution} min={100} max={5000} step={50} format={fmt} />
    </CalcPanel>
  );
}
