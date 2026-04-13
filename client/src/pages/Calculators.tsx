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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Calculator, TrendingUp, Building2, PiggyBank, Loader2,
  Sparkles, DollarSign, BarChart3,
  ChevronRight, Heart, Scale, GraduationCap, Stethoscope,
  HandCoins, ShieldAlert, Dice5, Target, Shield,
  Printer, MessageSquare, ArrowUpRight, ArrowDownRight,
  Info, Zap, Activity, ChevronDown, ExternalLink,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";
import { computeHolisticScore, type HolisticResult, type DomainScore, fmt, pct } from "@/lib/holisticScoring";
import {
  groupByPillar, SCENARIO_PRESETS, runScenarioComparison, projectTrajectory,
  type PillarSummary, type ScenarioResult, type YearProjection,
} from "@/lib/holisticScoringExtensions";

// ─── MINI BAR CHART ─────────────────────────────────────────────────
function MiniBarChart({ data, valueKey, maxBars = 15 }: { data: any[]; valueKey: string; maxBars?: number }) {
  if (!data.length) return null;
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

// ─── STAT CARD ──────────────────────────────────────────────────────
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

// ─── SCORE RING (SVG) ───────────────────────────────────────────────
function ScoreRing({ score, size = 64, stroke = 5, color = "var(--accent)" }: { score: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-secondary" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

// ─── PILLAR CARD ────────────────────────────────────────────────────
function PillarCard({ pillar, onClick }: { pillar: PillarSummary; onClick?: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    Target: <Target className="w-4 h-4" />,
    Shield: <Shield className="w-4 h-4" />,
    TrendingUp: <TrendingUp className="w-4 h-4" />,
  };
  const bgColors: Record<string, string> = {
    plan: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    protect: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    grow: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
  };
  const ringColors: Record<string, string> = {
    plan: "oklch(0.76 0.14 80)",
    protect: "oklch(0.65 0.15 250)",
    grow: "oklch(0.72 0.17 155)",
  };
  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border bg-gradient-to-br ${bgColors[pillar.id]} hover:shadow-md transition-all text-left group`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <ScoreRing score={pillar.score} size={52} stroke={4} color={ringColors[pillar.id]} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
            {pillar.score}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={pillar.accent}>{icons[pillar.icon]}</span>
            <span className="text-sm font-semibold">{pillar.label}</span>
          </div>
          <div className="space-y-0.5">
            {pillar.domains.map(d => (
              <div key={d.id} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${d.score === 3 ? "bg-emerald-400" : d.score === 2 ? "bg-amber-400" : d.score === 1 ? "bg-red-400" : "bg-muted-foreground/30"}`} />
                <span className="text-muted-foreground truncate">{d.label}</span>
                <span className="ml-auto font-mono text-muted-foreground/70">{d.statusLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── TRAJECTORY MINI CHART ──────────────────────────────────────────
function TrajectoryChart({ data, height = 80 }: { data: YearProjection[]; height?: number }) {
  if (!data.length) return null;
  const maxNW = Math.max(...data.map(d => d.netWorth), 1);
  const minNW = Math.min(...data.map(d => d.netWorth), 0);
  const range = maxNW - minNW || 1;
  const w = 100;
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - ((d.netWorth - minNW) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  // Find retirement age index
  const retIdx = data.findIndex(d => d.retirementIncome > 0);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" aria-label="Wealth trajectory chart">
      <defs>
        <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,${height} ${points} ${w},${height}`}
        fill="url(#traj-fill)"
      />
      {/* Line */}
      <polyline points={points} fill="none" stroke="oklch(0.76 0.14 80)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {/* Retirement marker */}
      {retIdx > 0 && (
        <line
          x1={(retIdx / Math.max(data.length - 1, 1)) * w}
          y1="0"
          x2={(retIdx / Math.max(data.length - 1, 1)) * w}
          y2={height}
          stroke="oklch(0.65 0.15 250)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// ─── SCENARIO COMPARISON BAR ────────────────────────────────────────
function ScenarioBar({ results }: { results: ScenarioResult[] }) {
  if (!results.length) return null;
  const baseline = results.find(r => r.preset.id === "baseline");
  const baseScore = baseline?.result.compositeScore ?? 0;
  return (
    <div className="space-y-1.5">
      {results.map(r => (
        <div key={r.preset.id} className="flex items-center gap-2 text-xs">
          <span className={`w-20 truncate font-medium ${r.preset.color}`}>{r.preset.label}</span>
          <div className="flex-1 h-2.5 bg-secondary/60 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                r.result.compositeScore >= baseScore ? "bg-emerald-500/70" : "bg-red-500/70"
              }`}
              style={{ width: `${Math.max(2, r.result.compositeScore)}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono tabular-nums text-muted-foreground">{r.result.compositeScore}</span>
          {r.delta !== 0 && (
            <span className={`w-10 text-right font-mono tabular-nums text-[10px] ${r.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {r.delta > 0 ? "+" : ""}{r.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CALCULATOR DEFINITIONS ─────────────────────────────────────────
const CALCULATORS = [
  { id: "iul", label: "IUL Projection", icon: <TrendingUp className="w-4 h-4" />, desc: "Indexed Universal Life illustration", color: "text-emerald-400", pillar: "protect" },
  { id: "pf", label: "Premium Finance", icon: <Building2 className="w-4 h-4" />, desc: "Leverage analysis for HNW clients", color: "text-blue-400", pillar: "protect" },
  { id: "ret", label: "Retirement", icon: <PiggyBank className="w-4 h-4" />, desc: "Wealth accumulation projection", color: "text-amber-400", pillar: "plan" },
  { id: "tax", label: "Tax Projector", icon: <DollarSign className="w-4 h-4" />, desc: "Multi-year tax projection & Roth analysis", color: "text-violet-400", pillar: "plan" },
  { id: "ss", label: "Social Security", icon: <Calculator className="w-4 h-4" />, desc: "Optimize claiming strategy", color: "text-cyan-400", pillar: "plan" },
  { id: "medicare", label: "Medicare", icon: <Stethoscope className="w-4 h-4" />, desc: "Navigate Medicare enrollment & costs", color: "text-rose-400", pillar: "plan" },
  { id: "hsa", label: "HSA Optimizer", icon: <Heart className="w-4 h-4" />, desc: "Health Savings Account strategy", color: "text-pink-400", pillar: "plan" },
  { id: "charitable", label: "Charitable", icon: <HandCoins className="w-4 h-4" />, desc: "Giving strategy optimization", color: "text-orange-400", pillar: "plan" },
  { id: "divorce", label: "Divorce Analysis", icon: <Scale className="w-4 h-4" />, desc: "Asset division & alimony modeling", color: "text-red-400", pillar: "protect" },
  { id: "education", label: "Education", icon: <GraduationCap className="w-4 h-4" />, desc: "529 & education funding planner", color: "text-indigo-400", pillar: "plan" },
  { id: "stress", label: "Stress Test", icon: <ShieldAlert className="w-4 h-4" />, desc: "S&P 500 backtest + crisis scenarios", color: "text-red-500", pillar: "grow" },
  { id: "montecarlo", label: "Monte Carlo", icon: <Dice5 className="w-4 h-4" />, desc: "1,000-trial probability simulation", color: "text-purple-400", pillar: "grow" },
] as const;

// ─── DEEP-DIVE TOOL LINKS ──────────────────────────────────────────
const DEEP_DIVE_TOOLS = [
  { label: "Holistic Comparison", path: "/wealth-engine/holistic-comparison", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { label: "Strategy Comparison", path: "/wealth-engine/strategy-comparison", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { label: "Retirement Planner", path: "/wealth-engine/retirement", icon: <PiggyBank className="w-3.5 h-3.5" /> },
  { label: "Practice to Wealth", path: "/wealth-engine/practice-to-wealth", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: "Quick Quote", path: "/wealth-engine/quick-quote", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { label: "What-If Grid", path: "/wealth-engine/what-if", icon: <Activity className="w-3.5 h-3.5" /> },
  { label: "Business Income", path: "/wealth-engine/business-income", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { label: "Wealth Configurator", path: "/wealth-engine/configurator", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { label: "Business Valuation", path: "/wealth-engine/business-valuation", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: "Tax Planning", path: "/tax-planning", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { label: "Estate Planning", path: "/estate", icon: <Scale className="w-3.5 h-3.5" /> },
  { label: "Financial Planning", path: "/financial-planning", icon: <Calculator className="w-3.5 h-3.5" /> },
  { label: "Protection Score", path: "/protection-score", icon: <Shield className="w-3.5 h-3.5" /> },
  { label: "Insurance Analysis", path: "/insurance-analysis", icon: <Heart className="w-3.5 h-3.5" /> },
  { label: "Engine Dashboard", path: "/engine-dashboard", icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Calculators() {
  useAuth();
  const [, navigate] = useLocation();
  const pil = usePlatformIntelligence();
  const { profile, hasProfile } = useFinancialProfile();
  const [activeCalc, setActiveCalc] = useState<string>("iul");
  const [showScenarios, setShowScenarios] = useState(false);

  // ─── Holistic Score (from profile) ──────────────────────────────
  const holisticResult = useMemo<HolisticResult | null>(() => {
    if (!hasProfile) return null;
    try { return computeHolisticScore(profile); } catch { return null; }
  }, [profile, hasProfile]);

  const pillars = useMemo<PillarSummary[]>(() => {
    if (!holisticResult) return [];
    return groupByPillar(holisticResult.domains);
  }, [holisticResult]);

  // ─── Scenario Comparison ────────────────────────────────────────
  const scenarioResults = useMemo<ScenarioResult[]>(() => {
    if (!hasProfile || !showScenarios) return [];
    try { return runScenarioComparison(profile); } catch { return []; }
  }, [profile, hasProfile, showScenarios]);

  // ─── Trajectory Projection ──────────────────────────────────────
  const trajectory = useMemo<YearProjection[]>(() => {
    if (!hasProfile) return [];
    try { return projectTrajectory(profile, 30); } catch { return []; }
  }, [profile, hasProfile]);

  // ─── Profile-driven defaults ────────────────────────────────────
  const pAge = profileValue(profile, "currentAge", 35);
  const pIncome = profileValue(profile, "annualIncome", 150000);
  const pSavings = profileValue(profile, "portfolioBalance", 50000);
  const pMonthly = profileValue(profile, "monthlyContribution", 1500);
  const pRetAge = profileValue(profile, "retirementAge", 65);

  // IUL state (profile-driven)
  const [iulAge, setIulAge] = useState(pAge);
  const [iulPremium, setIulPremium] = useState(Math.round(pIncome * 0.08));
  const [iulYears, setIulYears] = useState(30);
  const [iulRate, setIulRate] = useState(6.5);
  const [iulDB, setIulDB] = useState(Math.round(pIncome * 10));

  // Premium Finance state
  const [pfFace, setPfFace] = useState(5000000);
  const [pfPremium, setPfPremium] = useState(100000);
  const [pfLoanRate, setPfLoanRate] = useState(5.5);
  const [pfCreditRate, setPfCreditRate] = useState(6.5);
  const [pfYears, setPfYears] = useState(10);
  const [pfProjectionYears, setPfProjectionYears] = useState(20);
  const [pfCollateral, setPfCollateral] = useState(2.0);
  const [pfCashOutlay, setPfCashOutlay] = useState(25000);

  // Retirement state (profile-driven)
  const [retAge, setRetAge] = useState(pAge);
  const [retTarget, setRetTarget] = useState(pRetAge);
  const [retSavings, setRetSavings] = useState(pSavings);
  const [retMonthly, setRetMonthly] = useState(pMonthly);
  const [retReturn, setRetReturn] = useState(7.0);
  const [retInflation, setRetInflation] = useState(3.0);

  // Stress Test state (profile-driven)
  const [stressBalance, setStressBalance] = useState(pSavings || 500000);
  const [stressContrib, setStressContrib] = useState(pMonthly * 12 || 12000);
  const [stressCost, setStressCost] = useState(5000);
  const [stressHorizon, setStressHorizon] = useState(30);
  const [stressScenario, setStressScenario] = useState("gfc2008");

  // Monte Carlo state (profile-driven)
  const [mcBalance, setMcBalance] = useState(pSavings || 500000);
  const [mcContrib, setMcContrib] = useState(pMonthly * 12 || 12000);
  const [mcYears, setMcYears] = useState(30);
  const [mcVolatility, setMcVolatility] = useState(15);
  const [mcTrials, setMcTrials] = useState(1000);

  // tRPC mutations
  const iulCalc = trpc.calculators.iulProjection.useMutation({ onError: (e) => toast.error(e.message) });
  const pfCalc = trpc.calculators.premiumFinance.useMutation({ onError: (e) => toast.error(e.message) });
  const retCalc = trpc.calculators.retirement.useMutation({ onError: (e) => toast.error(e.message) });
  const backtestCalc = trpc.wealthEngine.historicalBacktest.useMutation({ onError: (e) => toast.error(e.message) });
  const stressCalc = trpc.wealthEngine.stressTest.useMutation({ onError: (e) => toast.error(e.message) });
  const scenariosQuery = trpc.wealthEngine.stressScenarios.useQuery();
  const mcCalc = trpc.calculatorEngine.uweMonteCarlo.useMutation({ onError: (e) => toast.error(e.message) });

  return (
    <AppShell title="Calculators">
      <SEOHead title="Calculators" description="Financial calculators powered by the Wealth Engine" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">

        {/* ═══ SECTION A: HOLISTIC SCORECARD ═══════════════════════ */}
        {holisticResult ? (
          <section aria-label="Financial Health Scorecard">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold">Financial Health Scorecard</h2>
                <Badge variant="secondary" className="text-[9px]">{holisticResult.stageLabel}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Composite</span>
                  <span className="text-lg font-bold tabular-nums text-accent">{holisticResult.compositeScore}</span>
                  <span className="text-[10px] text-muted-foreground">/100</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => navigate("/wealth-engine")}
                >
                  Full Report <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>

            {/* Pillar cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {pillars.map(p => (
                <PillarCard key={p.id} pillar={p} onClick={() => navigate("/wealth-engine")} />
              ))}
            </div>

            {/* Trajectory + Scenarios row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Trajectory */}
              {trajectory.length > 0 && (
                <Card className="bg-card/60 border-border/50">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">30-Year Wealth Trajectory</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Now: {fmt(trajectory[0]?.netWorth ?? 0)}</span>
                        <span className="text-accent font-medium">Year 30: {fmt(trajectory[trajectory.length - 1]?.netWorth ?? 0)}</span>
                      </div>
                    </div>
                    <TrajectoryChart data={trajectory} height={64} />
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
                      <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent rounded" /> Net Worth</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-400 rounded" style={{ borderStyle: "dashed" }} /> Retirement</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scenario comparison */}
              <Card className="bg-card/60 border-border/50">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">What-If Scenarios</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      onClick={() => setShowScenarios(!showScenarios)}
                    >
                      {showScenarios ? "Hide" : "Run Scenarios"}
                    </Button>
                  </div>
                  {showScenarios && scenarioResults.length > 0 ? (
                    <ScenarioBar results={scenarioResults} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-16 text-center">
                      <p className="text-[10px] text-muted-foreground/50">
                        Click "Run Scenarios" to see how market crash, inflation spike, or job loss would affect your score
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top actions strip */}
            {holisticResult.actions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mt-3 scrollbar-thin">
                {holisticResult.actions.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 1 ? "bg-red-400" : a.priority === 2 ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span className="text-muted-foreground">{a.area}:</span>
                    <span className="font-medium truncate max-w-[200px]">{a.action}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* Empty state — no profile */
          <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="pt-6 pb-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold mb-1">Complete Your Financial Profile</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Fill in your financial profile to unlock the holistic scorecard, scenario analysis, and trajectory projections.
                  Calculator inputs will also pre-populate from your profile.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => navigate("/financial-twin")} className="text-xs">
                  <Target className="w-3.5 h-3.5 mr-1" /> Set Up Profile
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/wealth-engine")} className="text-xs">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Wealth Engine
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="opacity-50" />

        {/* ═══ SECTION B: CALCULATOR SELECTOR ═════════════════════ */}
        <section aria-label="Financial Calculators">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-accent" /> Calculators
            </h2>
            <Badge variant="outline" className="text-[9px]">{CALCULATORS.length} tools</Badge>
          </div>

          {/* Calculator grid selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
            {CALCULATORS.map(calc => (
              <button
                key={calc.id}
                onClick={() => setActiveCalc(calc.id)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  activeCalc === calc.id
                    ? "bg-accent/8 border-accent/30 ring-1 ring-accent/10"
                    : "bg-card/40 border-border/50 hover:border-border"
                }`}
              >
                <div className={`mt-0.5 ${activeCalc === calc.id ? calc.color : "text-muted-foreground"}`}>
                  {calc.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${activeCalc === calc.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {calc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{calc.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* ═══ CALCULATOR PANELS ═════════════════════════════════ */}

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
                  <QuickActions title="IUL Projection" />
                </CardContent>
              </Card>

              <div className="lg:col-span-3 space-y-4">
                {iulCalc.data ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <StatCard label="Total Premiums" value={fmt(iulCalc.data.totalPremiums)} />
                      <StatCard label="Final Cash Value" value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.cashValue || 0)} positive={true} />
                      <StatCard label="Surrender Value" value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.surrenderValue || 0)} />
                      <StatCard label="Death Benefit" value={fmt(iulCalc.data.projections[iulCalc.data.projections.length - 1]?.deathBenefit || 0)} positive={true} />
                    </div>
                    <Card className="bg-card/60 border-border/50 p-4">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Cash Value Growth</p>
                      <MiniBarChart data={iulCalc.data.projections} valueKey="cashValue" />
                    </Card>
                    <Card className="bg-card/60 border-border/50">
                      <ScrollArea className="h-[300px]">
                        <div className="overflow-x-auto">
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
                        </div>
                      </ScrollArea>
                    </Card>
                  </>
                ) : (
                  <EmptyCalcState icon={<BarChart3 className="w-6 h-6" />} text="Adjust the sliders and click Calculate" sub="Results will appear here with charts and projections" />
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
                    <Building2 className="w-4 h-4 text-accent" /> Premium Finance
                  </CardTitle>
                  <CardDescription className="text-xs">Leverage analysis for high-net-worth IUL strategies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SliderInput label="Face Amount" value={pfFace} onChange={setPfFace} min={500000} max={50000000} step={250000} format={(v) => fmt(v)} />
                  <SliderInput label="Annual Premium" value={pfPremium} onChange={setPfPremium} min={5000} max={1000000} step={5000} format={(v) => fmt(v)} />
                  <SliderInput label="Cash Outlay / Year" value={pfCashOutlay} onChange={setPfCashOutlay} min={0} max={500000} step={5000} format={(v) => fmt(v)} />
                  <SliderInput label="Loan Rate" value={pfLoanRate} onChange={setPfLoanRate} min={2} max={12} step={0.25} suffix="%" />
                  <SliderInput label="Credited Rate" value={pfCreditRate} onChange={setPfCreditRate} min={3} max={12} step={0.25} suffix="%" />
                  <SliderInput label="Funding Years" value={pfYears} onChange={setPfYears} min={3} max={30} suffix=" yrs" />
                  <SliderInput label="Projection Years" value={pfProjectionYears} onChange={setPfProjectionYears} min={pfYears} max={40} suffix=" yrs" />
                  <SliderInput label="Collateral Rate" value={pfCollateral} onChange={setPfCollateral} min={0.5} max={10} step={0.25} suffix="%" />
                  <div className={`text-xs p-2 rounded border ${pfCreditRate > pfLoanRate ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
                    <span className="font-medium">Spread:</span>{" "}
                    {(pfCreditRate - pfLoanRate).toFixed(2)}%{" "}
                    {pfCreditRate > pfLoanRate ? "(positive — arbitrage opportunity)" : "(negative — loan costs exceed credited growth)"}
                  </div>
                  <Button
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-2"
                    onClick={() => pfCalc.mutate({ faceAmount: pfFace, annualPremium: pfPremium, loanRate: pfLoanRate, creditingRate: pfCreditRate, years: pfYears, projectionYears: pfProjectionYears, collateralRate: pfCollateral, cashOutlay: pfCashOutlay })}
                    disabled={pfCalc.isPending}
                  >
                    {pfCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Analysis</>}
                  </Button>
                  <QuickActions title="Premium Finance" />
                </CardContent>
              </Card>
              <div className="lg:col-span-3 space-y-4">
                {pfCalc.data ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <StatCard label="Net Equity (Final)" value={fmt(pfCalc.data.finalNetEquity)} positive={pfCalc.data.finalNetEquity >= 0} />
                      <StatCard label="DB Leverage" value={`${pfCalc.data.deathBenefitLeverage}x`} positive={pfCalc.data.deathBenefitLeverage > 1} />
                      <StatCard label="ROI on Cash Outlay" value={`${pfCalc.data.roi}%`} positive={pfCalc.data.roi > 0} />
                      <StatCard label="Breakeven Year" value={pfCalc.data.breakevenYear ? `Year ${pfCalc.data.breakevenYear}` : "Never"} positive={pfCalc.data.breakevenYear !== null} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-card/60 border border-border/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Total Cash Outlay</p>
                        <p className="text-sm font-mono font-medium mt-1">{fmt(pfCalc.data.totalCashOutlay)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">vs {fmt(pfPremium * pfYears)} if paying premiums directly</p>
                      </div>
                      <div className="bg-card/60 border border-border/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Collateral Cost</p>
                        <p className="text-sm font-mono font-medium mt-1">{fmt(pfCalc.data.totalCollateralCost)}</p>
                      </div>
                      <div className="bg-card/60 border border-border/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Death Benefit</p>
                        <p className="text-sm font-mono font-medium text-accent mt-1">{fmt(pfCalc.data.finalDeathBenefit)}</p>
                      </div>
                    </div>
                    <Card className="bg-card/60 border-border/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Arbitrage Spread Analysis</p>
                        <Badge variant={pfCalc.data.spreadPct > 0 ? "default" : "destructive"} className="text-[10px]">
                          {pfCalc.data.spreadPct > 0 ? "+" : ""}{pfCalc.data.spreadPct}% spread
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div><p className="text-lg font-mono font-bold text-red-400">{pfCalc.data.loanRate}%</p><p className="text-[10px] text-muted-foreground">Loan Rate</p></div>
                        <div><p className={`text-lg font-mono font-bold ${pfCalc.data.spreadPct > 0 ? "text-emerald-400" : "text-red-400"}`}>{pfCalc.data.spreadPct > 0 ? "+" : ""}{pfCalc.data.spreadPct}%</p><p className="text-[10px] text-muted-foreground">Net Spread</p></div>
                        <div><p className="text-lg font-mono font-bold text-accent">{pfCalc.data.creditingRate}%</p><p className="text-[10px] text-muted-foreground">Credited Rate</p></div>
                      </div>
                    </Card>
                    <Card className="bg-card/60 border-border/50 p-4">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Net Equity Over Time</p>
                      <MiniBarChart data={pfCalc.data.projections} valueKey="netEquity" />
                    </Card>
                    <Card className="bg-card/60 border-border/50">
                      <ScrollArea className="h-[350px]">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border">
                                <TableHead className="text-[10px]">Year</TableHead>
                                <TableHead className="text-[10px] text-right">Cash Outlay</TableHead>
                                <TableHead className="text-[10px] text-right">Loan Balance</TableHead>
                                <TableHead className="text-[10px] text-right">Policy Value</TableHead>
                                <TableHead className="text-[10px] text-right">Net Equity</TableHead>
                                <TableHead className="text-[10px] text-right">Death Benefit</TableHead>
                                <TableHead className="text-[10px] text-right">Leverage</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pfCalc.data.projections.map((p) => (
                                <TableRow key={p.year} className={`border-border/30 ${p.year === pfCalc.data!.breakevenYear ? "bg-emerald-500/10" : ""}`}>
                                  <TableCell className="text-xs py-1.5">
                                    {p.year}
                                    {p.year === pfCalc.data!.breakevenYear && <Badge variant="outline" className="ml-1 text-[8px] text-emerald-400 border-emerald-500/30 py-0">breakeven</Badge>}
                                  </TableCell>
                                  <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.cashOutlayThisYear)}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{fmt(p.loanBalance)}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5 font-mono">{fmt(p.policyValue)}</TableCell>
                                  <TableCell className={`text-xs text-right py-1.5 font-mono ${p.netEquity >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.netEquity)}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5 font-mono text-accent">{fmt(p.deathBenefit)}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{p.leverageRatio}x</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </ScrollArea>
                    </Card>
                    <div className="text-[10px] text-muted-foreground/50 space-y-1 p-3 bg-card/30 rounded-lg border border-border/30">
                      <p><strong>Methodology:</strong> Year-by-year simulation using the UWE engine&apos;s IUL product model with policy loan overlay.</p>
                      <p><strong>Assumptions:</strong> Level credited rate, level loan rate, collateral assignment cost is annual % of outstanding loan balance.</p>
                    </div>
                  </>
                ) : (
                  <EmptyCalcState icon={<BarChart3 className="w-6 h-6" />} text="Configure the premium finance scenario" sub="Includes leverage ratio, breakeven analysis, spread arbitrage, and year-by-year projections" />
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
                  <QuickActions title="Retirement Projection" />
                </CardContent>
              </Card>
              <div className="lg:col-span-3 space-y-4">
                {retCalc.data ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <StatCard label="Final Balance" value={fmt(retCalc.data.finalBalance)} positive={true} />
                      <StatCard label="Real Value (Today's $)" value={fmt(retCalc.data.projections[retCalc.data.projections.length - 1]?.realBalance || 0)} sub="Inflation-adjusted" />
                      <StatCard label="Monthly Income (4% Rule)" value={fmt(retCalc.data.estimatedMonthlyIncome)} positive={true} />
                    </div>
                    <Card className="bg-card/60 border-border/50 p-4">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Balance Growth (Nominal)</p>
                      <MiniBarChart data={retCalc.data.projections} valueKey="nominalBalance" />
                    </Card>
                    <Card className="bg-card/60 border-border/50">
                      <ScrollArea className="h-[300px]">
                        <div className="overflow-x-auto">
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
                        </div>
                      </ScrollArea>
                    </Card>
                  </>
                ) : (
                  <EmptyCalcState icon={<BarChart3 className="w-6 h-6" />} text="Set your retirement goals" sub="See nominal and inflation-adjusted projections" />
                )}
              </div>
            </div>
          )}

          {/* ─── TAX PROJECTOR ──────────────────────────────── */}
          {activeCalc === "tax" && <TaxProjectorPanel />}
          {/* ─── SOCIAL SECURITY ─────────────────────────────── */}
          {activeCalc === "ss" && <SSOptimizerPanel />}
          {/* ─── MEDICARE ───────────────────────────────────── */}
          {activeCalc === "medicare" && <MedicarePanel />}
          {/* ─── HSA OPTIMIZER ──────────────────────────────── */}
          {activeCalc === "hsa" && <HSAOptimizerPanel />}
          {/* ─── CHARITABLE GIVING ──────────────────────────── */}
          {activeCalc === "charitable" && <CharitablePanel />}
          {/* ─── DIVORCE ANALYSIS ───────────────────────────── */}
          {activeCalc === "divorce" && <DivorcePanel />}
          {/* ─── EDUCATION PLANNER ──────────────────────────── */}
          {activeCalc === "education" && <EducationPanel />}

          {/* ─── STRESS TEST ──────────────────────────────────── */}
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
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Stress Test Results</CardTitle></CardHeader>
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
                  <EmptyCalcState icon={<ShieldAlert className="w-6 h-6" />} text="Run a historical backtest or stress scenario" sub="Uses real S&P 500 data from 1928-2025" />
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
                        <div className="overflow-x-auto">
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
                        </div>
                      </ScrollArea>
                    </Card>
                  </>
                ) : (
                  <EmptyCalcState icon={<Dice5 className="w-6 h-6" />} text="Run a Monte Carlo simulation" sub={`See probability ranges across ${mcTrials.toLocaleString()} simulated scenarios`} />
                )}
              </div>
            </div>
          )}
        </section>

        <Separator className="opacity-50" />

        {/* ═══ SECTION C: DEEP-DIVE TOOLS ═════════════════════════ */}
        <Accordion type="single" collapsible>
          <AccordionItem value="tools" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-accent" />
                <span className="font-semibold">Deep-Dive Tools & Engines</span>
                <Badge variant="outline" className="text-[9px] ml-1">{DEEP_DIVE_TOOLS.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
                {DEEP_DIVE_TOOLS.map(tool => (
                  <button
                    key={tool.path}
                    onClick={() => navigate(tool.path)}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card/40 hover:bg-secondary/40 transition-colors text-left group"
                  >
                    <span className="text-accent shrink-0">{tool.icon}</span>
                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground truncate">{tool.label}</span>
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="text-[10px] text-muted-foreground text-center mt-4 pb-4">
          These calculators are for illustrative purposes only. Actual results will vary. Consult a licensed financial professional before making decisions.
        </p>
      </div>
    </AppShell>
  );
}

// ─── SHARED COMPONENTS ──────────────────────────────────────────────

function QuickActions({ title }: { title: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex gap-2 mt-2">
      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { window.print(); toast.success("Print dialog opened"); }}>
        <Printer className="w-3 h-3 mr-1" /> Print / Share
      </Button>
      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/chat?prefill=${encodeURIComponent(`I just ran a ${title} calculation. Can you help me interpret the results and suggest next steps?`)}`)}>
        <MessageSquare className="w-3 h-3 mr-1" /> Discuss in Chat
      </Button>
    </div>
  );
}

function EmptyCalcState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
      <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3 text-muted-foreground/30">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {sub && <p className="text-[10px] text-muted-foreground/50 mt-1">{sub}</p>}
    </div>
  );
}

// ─── CALCULATOR PANEL WRAPPER ───────────────────────────────────────
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
          <QuickActions title={title} />
        </CardContent>
      </Card>
      <div className="lg:col-span-3">
        {result}
      </div>
    </div>
  );
}

// ─── Part F Calculator Panels ──────────────────────────────────────────
function TaxProjectorPanel() {
  const { profile } = useFinancialProfile();
  const [wages, setWages] = useState(profileValue(profile, "annualIncome", 150000));
  const [deductions, setDeductions] = useState(profileValue(profile, "itemizedDeductions", 0));
  const [stateCode, setStateCode] = useState(profileValue(profile, "stateCode", "TX"));
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
        <EmptyCalcState icon={<DollarSign className="w-6 h-6" />} text="Configure tax parameters" />
      )}
    >
      <SliderInput label="W-2 Wages" value={wages} onChange={setWages} min={25000} max={2000000} step={5000} format={fmt} />
      <SliderInput label="Itemized Deductions" value={deductions} onChange={setDeductions} min={0} max={500000} step={1000} format={fmt} />
    </CalcPanel>
  );
}

function SSOptimizerPanel() {
  const { profile } = useFinancialProfile();
  const currentYear = new Date().getFullYear();
  const pAge = profileValue(profile, "currentAge", 62);
  const [birthYear, setBirthYear] = useState(currentYear - pAge);
  const [pia, setPia] = useState(profileValue(profile, "estimatedSSBenefit", 2500));
  const [lifeExpectancy, setLifeExpectancy] = useState(profileValue(profile, "lifeExpectancy", 85));
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
        <EmptyCalcState icon={<Calculator className="w-6 h-6" />} text="Enter your Social Security details" />
      )}
    >
      <SliderInput label="Birth Year" value={birthYear} onChange={setBirthYear} min={1940} max={1990} />
      <SliderInput label="Estimated PIA (Monthly)" value={pia} onChange={setPia} min={500} max={5000} step={50} format={fmt} />
      <SliderInput label="Life Expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={70} max={100} suffix=" yrs" />
    </CalcPanel>
  );
}

function MedicarePanel() {
  const { profile } = useFinancialProfile();
  const [age, setAge] = useState(profileValue(profile, "currentAge", 64));
  const [magi, setMagi] = useState(profileValue(profile, "annualIncome", 100000));
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
          </CardContent>
        </Card>
      ) : (
        <EmptyCalcState icon={<Stethoscope className="w-6 h-6" />} text="Enter Medicare parameters" />
      )}
    >
      <SliderInput label="Current Age" value={age} onChange={setAge} min={55} max={80} suffix=" yrs" />
      <SliderInput label="MAGI (Income)" value={magi} onChange={setMagi} min={20000} max={1000000} step={5000} format={fmt} />
    </CalcPanel>
  );
}

function HSAOptimizerPanel() {
  const { profile } = useFinancialProfile();
  const [age, setAge] = useState(profileValue(profile, "currentAge", 40));
  const [annualContrib, setAnnualContrib] = useState(profileValue(profile, "hsaContributions", 4000));
  const [hsaBalance, setHsaBalance] = useState(5000);
  const [medExpenses, setMedExpenses] = useState(3000);
  const hsaCalc = trpc.hsaOptimizer.optimize.useMutation({ onError: (e: any) => toast.error(e.message) });
  const retYears = Math.max(1, 65 - age);
  return (
    <CalcPanel title="HSA Optimizer" icon={<Heart className="w-4 h-4" />} color="text-pink-400"
      onCalculate={() => hsaCalc.mutate({ age, coverageType: "family", currentBalance: hsaBalance, annualContribution: annualContrib, annualMedicalExpenses: medExpenses, marginalTaxRate: 0.24, stateTaxRate: 0.05, yearsToRetirement: retYears })}
      isLoading={hsaCalc.isPending}
      result={hsaCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <p className="text-[10px] text-muted-foreground">Max Contribution</p>
                <p className="text-lg font-semibold text-pink-400">{fmt(hsaCalc.data.maxContribution)}</p>
              </div>
              <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <p className="text-[10px] text-muted-foreground">Triple Tax Savings</p>
                <p className="text-lg font-semibold text-pink-400">{fmt(hsaCalc.data.tripleAdvantage.totalLifetimeSavings)}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-[10px] text-muted-foreground">Best Strategy</p>
              <p className="text-sm font-semibold">{hsaCalc.data.bestStrategy}</p>
            </div>
            {hsaCalc.data.catchUpEligible && (
              <div className="p-3 rounded-lg bg-pink-500/5 border border-pink-500/10">
                <p className="text-[10px] text-muted-foreground">Catch-Up Eligible</p>
                <p className="text-sm font-semibold text-pink-400">+{fmt(hsaCalc.data.catchUpAmount)}/yr</p>
              </div>
            )}
            {hsaCalc.data.strategies?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Strategies Compared</p>
                {hsaCalc.data.strategies.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-mono">{fmt(s.finalBalance)} at 65</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60">{hsaCalc.data.medicareNote}</p>
          </CardContent>
        </Card>
      ) : (
        <EmptyCalcState icon={<Heart className="w-6 h-6" />} text="Optimize your HSA strategy" />
      )}
    >
      <SliderInput label="Current Age" value={age} onChange={setAge} min={18} max={70} suffix=" yrs" />
      <SliderInput label="Annual Contribution" value={annualContrib} onChange={setAnnualContrib} min={0} max={10000} step={100} format={fmt} />
      <SliderInput label="Current HSA Balance" value={hsaBalance} onChange={setHsaBalance} min={0} max={200000} step={500} format={fmt} />
      <SliderInput label="Annual Medical Expenses" value={medExpenses} onChange={setMedExpenses} min={0} max={50000} step={500} format={fmt} />
    </CalcPanel>
  );
}

function CharitablePanel() {
  const { profile } = useFinancialProfile();
  const [income, setIncome] = useState(profileValue(profile, "annualIncome", 200000));
  const [givingAmount, setGivingAmount] = useState(20000);
  const charCalc = trpc.charitableGiving.optimize.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Charitable Giving" icon={<HandCoins className="w-4 h-4" />} color="text-orange-400"
      onCalculate={() => charCalc.mutate({ annualDonationGoal: givingAmount, marginalTaxRate: 0.32, stateTaxRate: 0.05, age: profileValue(profile, "currentAge", 50), filingStatus: "mfj", agi: income, itemizesDeductions: true })}
      isLoading={charCalc.isPending}
      result={charCalc.data ? (
        <Card className="bg-card/60 border-border/50 h-full">
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-[10px] text-muted-foreground">Total Tax Savings</p>
                <p className="text-lg font-semibold text-orange-400">{fmt(charCalc.data.totalTaxSavings)}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-[10px] text-muted-foreground">Effective Cost of Giving</p>
                <p className="text-lg font-semibold text-orange-400">{fmt(charCalc.data.effectiveCostOfGiving)}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-[10px] text-muted-foreground">Best Vehicle</p>
              <p className="text-sm font-semibold">{charCalc.data.bestVehicle}</p>
            </div>
            {charCalc.data.bunchingAnalysis && (
              <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <p className="text-[10px] text-muted-foreground">Bunching Strategy</p>
                <p className="text-xs">{charCalc.data.bunchingAnalysis.recommendation}</p>
                <p className="text-xs text-muted-foreground mt-1">Bunching benefit: {fmt(charCalc.data.bunchingAnalysis.bunchingBenefit)}</p>
              </div>
            )}
            {charCalc.data.vehicles?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Vehicles Compared</p>
                {charCalc.data.vehicles.slice(0, 4).map((v: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className="font-mono">{fmt(v.taxSavings)} saved</span>
                  </div>
                ))}
              </div>
            )}
            {charCalc.data.strategies?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Recommendations</p>
                {charCalc.data.strategies.slice(0, 3).map((s: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">&#8226; {s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyCalcState icon={<HandCoins className="w-6 h-6" />} text="Plan your charitable giving" />
      )}
    >
      <SliderInput label="Annual Income (AGI)" value={income} onChange={setIncome} min={50000} max={2000000} step={5000} format={fmt} />
      <SliderInput label="Planned Giving Amount" value={givingAmount} onChange={setGivingAmount} min={1000} max={500000} step={1000} format={fmt} />
    </CalcPanel>
  );
}

function DivorcePanel() {
  const { profile } = useFinancialProfile();
  const [totalAssets, setTotalAssets] = useState(profileValue(profile, "netWorth", 1000000));
  const [income1, setIncome1] = useState(profileValue(profile, "annualIncome", 150000));
  const [income2, setIncome2] = useState(profileValue(profile, "spouseIncome", 75000));
  const [yearsMarried, setYearsMarried] = useState(15);
  const pAge = profileValue(profile, "currentAge", 45);
  const divCalc = trpc.divorce.analyze.useMutation({ onError: (e: any) => toast.error(e.message) });
  return (
    <CalcPanel title="Divorce Analysis" icon={<Scale className="w-4 h-4" />} color="text-red-400"
      onCalculate={() => divCalc.mutate({
        assets: [
          { name: "Marital Assets", type: "other" as const, fairMarketValue: totalAssets, classification: "marital" as const, owner: "joint" as const },
        ],
        spouse1Income: income1,
        spouse2Income: income2,
        spouse1Age: pAge,
        spouse2Age: pAge - 2,
        yearsMarried,
        childrenCount: 0,
        childrenAges: [],
        state: "TX",
        filingStatus: "mfj_current" as const,
        marginalRate: 0.32,
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
            {divCalc.data.lifestyleAnalysis && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs font-medium">Lifestyle Impact</p>
                <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                  <span className="text-muted-foreground">Spouse 1 Post-Divorce: {fmt(divCalc.data.lifestyleAnalysis.spouse1PostDivorceIncome)}</span>
                  <span className="text-muted-foreground">Spouse 2 Post-Divorce: {fmt(divCalc.data.lifestyleAnalysis.spouse2PostDivorceIncome)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyCalcState icon={<Scale className="w-6 h-6" />} text="Model asset division scenarios" />
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
  const { profile } = useFinancialProfile();
  const [childAge, setChildAge] = useState(5);
  const [annualCost, setAnnualCost] = useState(profileValue(profile, "educationCostPerChild", 40000));
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
            {eduCalc.data.vehicles?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Vehicles Compared</p>
                {eduCalc.data.vehicles.slice(0, 3).map((v: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className="font-mono">{fmt(v.projectedBalance)}</span>
                  </div>
                ))}
              </div>
            )}
            {eduCalc.data.strategies?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Strategies</p>
                {eduCalc.data.strategies.slice(0, 3).map((s: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">&#8226; {s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyCalcState icon={<GraduationCap className="w-6 h-6" />} text="Plan education funding" />
      )}
    >
      <SliderInput label="Child's Age" value={childAge} onChange={setChildAge} min={0} max={17} suffix=" yrs" />
      <SliderInput label="Annual Cost Today" value={annualCost} onChange={setAnnualCost} min={10000} max={100000} step={1000} format={fmt} />
      <SliderInput label="Monthly Contribution" value={monthlyContribution} onChange={setMonthlyContribution} min={100} max={5000} step={50} format={fmt} />
    </CalcPanel>
  );
}
