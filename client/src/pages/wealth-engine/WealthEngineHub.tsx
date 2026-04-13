/**
 * Wealth Engine Hub — force-multiplier landing page.
 *
 * Single destination that unifies every calculator + planning engine +
 * advisory workflow. Replaces the need to bounce between Calculators,
 * EngineDashboard, QuickQuoteFlow, StrategyComparison, FinancialPlanning,
 * Tax, Estate, Insurance, Risk, Owner Compensation, Business Valuation,
 * and multi-line Quick Bundle.
 *
 * Layout:
 *   • HERO — client snapshot + "Run all engines" CTA
 *   • ENGINES — 3 columns grouped by purpose:
 *       Plan     (Retirement, Tax, Estate, Risk, FP, Education, SS, Medicare,
 *                 HSA, Charitable, Divorce, Income Projection)
 *       Protect  (Multi-Line Quick Bundle, Insurance Analysis, Protection Score,
 *                 Quick Quote, Strategy Comparison, Premium Finance, IUL, LTC)
 *       Grow     (Engine Dashboard, Owner Comp, Business Valuation, BIE,
 *                 Practice-to-Wealth, Wealth Projection, Monte Carlo)
 *   • QUICK BUNDLE — inline 4-field form that streams live multi-line quote
 *     preview without leaving the page
 *   • GUARDRAILS — live guardrail badges from /wealthEngine.getGuardrails
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import {
  Sparkles, Calculator, PiggyBank, Shield, TrendingUp, Building2,
  Scale, Heart, GraduationCap, HandCoins, DollarSign, Stethoscope,
  BarChart3, Loader2, ArrowRight, Users, Target, FileText,
  Briefcase, Rocket, ShieldCheck, Workflow, Zap,
} from "lucide-react";

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── ENGINE MANIFEST ────────────────────────────────────────────────
// 30+ tools organized by intent. Each has a deep link so clicking
// takes the user straight to the right calculator.

type EngineTool = {
  label: string;
  desc: string;
  path: string;
  icon: React.ReactNode;
  accent: string;
  badge?: string;
};

const PLAN_TOOLS: EngineTool[] = [
  { label: "Retirement Planner", desc: "Goal + smooth + guardrails", path: "/wealth-engine/retirement", icon: <PiggyBank className="w-4 h-4" />, accent: "text-amber-400" },
  { label: "Tax Projector", desc: "Brackets + Roth + multi-year", path: "/tax-planning", icon: <DollarSign className="w-4 h-4" />, accent: "text-violet-400" },
  { label: "Estate Planning", desc: "Docs + trusts + estate tax", path: "/estate", icon: <Briefcase className="w-4 h-4" />, accent: "text-blue-400" },
  { label: "Risk Assessment", desc: "Suitability + gap analysis", path: "/risk-assessment", icon: <Scale className="w-4 h-4" />, accent: "text-red-400" },
  { label: "Income Projection", desc: "Income + debt + cash flow", path: "/income-projection", icon: <TrendingUp className="w-4 h-4" />, accent: "text-emerald-400" },
  { label: "Social Security", desc: "Claiming strategy + FRA", path: "/social-security", icon: <Calculator className="w-4 h-4" />, accent: "text-cyan-400" },
  { label: "Medicare", desc: "Plan selection + IRMAA", path: "/medicare", icon: <Stethoscope className="w-4 h-4" />, accent: "text-rose-400" },
  { label: "HSA Optimizer", desc: "Triple tax stacking", path: "/calculators", icon: <Heart className="w-4 h-4" />, accent: "text-pink-400" },
  { label: "Education Funding", desc: "529 + scholarships + aid", path: "/calculators", icon: <GraduationCap className="w-4 h-4" />, accent: "text-indigo-400" },
  { label: "Charitable Giving", desc: "DAF + CRT + bunching", path: "/calculators", icon: <HandCoins className="w-4 h-4" />, accent: "text-orange-400" },
];

const PROTECT_TOOLS: EngineTool[] = [
  { label: "Quick Bundle", desc: "Multi-line proposal in 30s", path: "/wealth-engine/quick-quote", icon: <Sparkles className="w-4 h-4" />, accent: "text-accent", badge: "New" },
  { label: "Protection Score", desc: "12-dimension gap analysis", path: "/protection-score", icon: <ShieldCheck className="w-4 h-4" />, accent: "text-emerald-400" },
  { label: "Strategy Comparison", desc: "7 strategies side-by-side", path: "/wealth-engine/strategy-comparison", icon: <BarChart3 className="w-4 h-4" />, accent: "text-violet-400" },
  { label: "Insurance Analysis", desc: "Life / DI / LTC / P&C", path: "/insurance-analysis", icon: <Shield className="w-4 h-4" />, accent: "text-rose-400" },
  { label: "IUL Projection", desc: "Illustrated rate scenarios", path: "/calculators", icon: <TrendingUp className="w-4 h-4" />, accent: "text-amber-400" },
  { label: "Premium Finance", desc: "HNW leverage analysis", path: "/calculators", icon: <Building2 className="w-4 h-4" />, accent: "text-blue-400" },
  { label: "Disability Income", desc: "Own-occ DI quoting", path: "/calculators", icon: <Heart className="w-4 h-4" />, accent: "text-red-400" },
  { label: "Long-Term Care", desc: "Hybrid vs traditional", path: "/insurance-analysis", icon: <Shield className="w-4 h-4" />, accent: "text-pink-400" },
];

const GROW_TOOLS: EngineTool[] = [
  { label: "Engine Dashboard", desc: "UWE + BIE + HE + SCUI", path: "/engine-dashboard", icon: <BarChart3 className="w-4 h-4" />, accent: "text-accent" },
  { label: "Owner Comp", desc: "S-Corp vs LLC vs C-Corp", path: "/wealth-engine/owner-comp", icon: <Building2 className="w-4 h-4" />, accent: "text-blue-400", badge: "New" },
  { label: "Business Valuation", desc: "SDE multiples + exit plan", path: "/wealth-engine/business-valuation", icon: <Rocket className="w-4 h-4" />, accent: "text-emerald-400", badge: "New" },
  { label: "Practice-to-Wealth", desc: "Producer income → HNW", path: "/wealth-engine/practice-to-wealth", icon: <Workflow className="w-4 h-4" />, accent: "text-violet-400" },
  { label: "Monte Carlo", desc: "Volatility + percentile bands", path: "/financial-twin", icon: <Zap className="w-4 h-4" />, accent: "text-amber-400" },
  { label: "Financial Twin", desc: "Personal wealth dashboard", path: "/financial-twin", icon: <Users className="w-4 h-4" />, accent: "text-cyan-400" },
  { label: "Wealth Projection", desc: "30-year UWE simulate", path: "/wealth-engine/retirement", icon: <TrendingUp className="w-4 h-4" />, accent: "text-indigo-400" },
  { label: "Workflows", desc: "5 automated playbooks", path: "/workflows", icon: <Workflow className="w-4 h-4" />, accent: "text-rose-400" },
];

// ─── ENGINE CARD ────────────────────────────────────────────────────
function EngineCard({ tool }: { tool: EngineTool }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(tool.path)}
      className="card-lift group relative text-left rounded-xl border border-border/60 bg-card/60 p-3 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 shrink-0 ${tool.accent}`}>{tool.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-medium truncate">{tool.label}</p>
            {tool.badge && (
              <Badge variant="outline" className="h-4 text-[9px] px-1 border-accent/40 text-accent">
                {tool.badge}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/75 mt-0.5 line-clamp-2">{tool.desc}</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-accent transition-colors mt-0.5" />
      </div>
    </button>
  );
}

// ─── SECTION ────────────────────────────────────────────────────────
function EngineSection({
  title, subtitle, icon, tools,
}: { title: string; subtitle: string; icon: React.ReactNode; tools: EngineTool[] }) {
  return (
    <Card className="bg-card/40 border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <CardDescription className="text-[11px]">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tools.map((tool) => <EngineCard key={tool.label + tool.path} tool={tool} />)}
      </CardContent>
    </Card>
  );
}

// ─── QUICK BUNDLE (inline) ──────────────────────────────────────────
interface BundleForm {
  age: number;
  income: number;
  dependents: number;
  isBizOwner: boolean;
  hasHome: boolean;
  netWorth: number;
  stateCode: string;
}

function InlineQuickBundle() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<BundleForm>({
    age: 35,
    income: 120_000,
    dependents: 2,
    isBizOwner: false,
    hasHome: true,
    netWorth: 250_000,
    stateCode: "TX",
  });

  const bundleMut = trpc.wealthEngine.multiLineQuickQuote.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const result = bundleMut.data?.data;
  const total = result?.totals.annualPremiumAll ?? 0;
  const critical = result?.totals.annualPremiumCritical ?? 0;
  const asPct = result?.totals.asPctOfIncome ?? 0;

  const onRun = () =>
    bundleMut.mutate({
      age: form.age,
      income: form.income,
      dependents: form.dependents,
      isBizOwner: form.isBizOwner,
      hasHome: form.hasHome,
      netWorth: form.netWorth,
      stateCode: form.stateCode,
    });

  return (
    <Card className="bg-card/60 border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <CardTitle className="text-sm">Quick Bundle</CardTitle>
          <Badge variant="outline" className="h-4 text-[9px] px-1 border-accent/40 text-accent">
            Multi-line
          </Badge>
        </div>
        <CardDescription className="text-[11px]">
          Tell us about the client — get a bundled proposal across life, DI, LTC, P&C, umbrella, and business in under a second.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Age</Label>
            <Input
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: +e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Income</Label>
            <Input
              type="number"
              value={form.income}
              onChange={(e) => setForm({ ...form, income: +e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Net Worth</Label>
            <Input
              type="number"
              value={form.netWorth}
              onChange={(e) => setForm({ ...form, netWorth: +e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Dependents</Label>
            <Input
              type="number"
              value={form.dependents}
              onChange={(e) => setForm({ ...form, dependents: +e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">State</Label>
            <Input
              value={form.stateCode}
              maxLength={2}
              onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })}
              className="h-8 text-xs uppercase"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 h-8">
            <Label className="text-[11px] cursor-pointer">Homeowner</Label>
            <Switch
              checked={form.hasHome}
              onCheckedChange={(v) => setForm({ ...form, hasHome: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 h-8">
            <Label className="text-[11px] cursor-pointer">Biz owner</Label>
            <Switch
              checked={form.isBizOwner}
              onCheckedChange={(v) => setForm({ ...form, isBizOwner: v })}
            />
          </div>
          <Button
            onClick={onRun}
            disabled={bundleMut.isPending}
            className="h-8 text-xs gap-1.5"
          >
            {bundleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Run bundle
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="pt-2 space-y-3 border-t border-border/40">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatChip label="All lines" value={fmt(total)} accent="text-foreground" />
              <StatChip label="Critical only" value={fmt(critical)} accent="text-emerald-400" />
              <StatChip label="% of income" value={pct(asPct)} accent="text-accent" />
              <StatChip label="Coverage lines" value={`${result.coverageLines.length}`} accent="text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Coverage Lines</p>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {result.coverageLines.map((line: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[11px] rounded-md border border-border/40 p-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`h-4 text-[9px] px-1 ${
                              line.priority === "critical"
                                ? "border-red-400/50 text-red-400"
                                : line.priority === "recommended"
                                  ? "border-accent/50 text-accent"
                                  : "border-border text-muted-foreground"
                            }`}
                          >
                            {line.priority}
                          </Badge>
                          <span className="truncate">{line.product}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{line.rationale}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono">{fmt(line.annualPremium)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmt(line.monthlyPremium)}/mo</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Planning Actions</p>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {result.planningActions.map((action: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] rounded-md border border-border/40 p-2">
                      <Badge
                        variant="outline"
                        className={`h-4 text-[9px] px-1 shrink-0 ${
                          action.priority === "critical"
                            ? "border-red-400/50 text-red-400"
                            : action.priority === "recommended"
                              ? "border-accent/50 text-accent"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {action.priority}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{action.action}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">{action.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => navigate("/wealth-engine/quick-quote")}
              >
                Full Quick Quote flow <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => navigate("/wealth-engine/strategy-comparison")}
              >
                Strategy comparison
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={() => navigate("/insurance-analysis")}
              >
                Insurance deep dive
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 p-2">
      <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

// ─── HERO ───────────────────────────────────────────────────────────
function HubHero({ role }: { role: string | undefined }) {
  const [, navigate] = useLocation();
  const tagline = useMemo(() => {
    if (role === "admin" || role === "manager") return "One hub. Every engine. Every client.";
    if (role === "advisor") return "Quote, plan, and protect — in a single pass.";
    return "Your complete financial plan, on demand.";
  }, [role]);

  return (
    <Card className="bg-card/60 border-accent/20 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.14) 0%, transparent 70%)",
        }}
      />
      <CardContent className="relative py-6 px-6 flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-heading font-semibold">Wealth Engine</h1>
          </div>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => navigate("/wealth-engine/quick-quote")}
          >
            <Sparkles className="w-4 h-4" /> Quick Quote
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => navigate("/engine-dashboard")}
          >
            <BarChart3 className="w-4 h-4" /> Strategy Compare
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => navigate("/wealth-engine/owner-comp")}
          >
            <Building2 className="w-4 h-4" /> Owner Comp
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5"
            onClick={() => navigate("/financial-twin")}
          >
            <Users className="w-4 h-4" /> Financial Twin
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────
export default function WealthEngineHub() {
  const { user } = useAuth();

  return (
    <AppShell title="Wealth Engine">
      <SEOHead title="Wealth Engine" description="Unified wealth planning, protection, and growth engine" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        <HubHero role={user?.role} />

        <InlineQuickBundle />

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 max-w-md">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="protect">Protect</TabsTrigger>
            <TabsTrigger value="grow">Grow</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <EngineSection
                title="Plan"
                subtitle="Retirement, tax, estate, and lifestyle projection"
                icon={<Target className="w-4 h-4" />}
                tools={PLAN_TOOLS}
              />
              <EngineSection
                title="Protect"
                subtitle="Insurance, quoting, protection score"
                icon={<Shield className="w-4 h-4" />}
                tools={PROTECT_TOOLS}
              />
              <EngineSection
                title="Grow"
                subtitle="Owner economics + practice growth + simulations"
                icon={<Rocket className="w-4 h-4" />}
                tools={GROW_TOOLS}
              />
            </div>
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PLAN_TOOLS.map((t) => <EngineCard key={t.label} tool={t} />)}
            </div>
          </TabsContent>
          <TabsContent value="protect" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PROTECT_TOOLS.map((t) => <EngineCard key={t.label} tool={t} />)}
            </div>
          </TabsContent>
          <TabsContent value="grow" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {GROW_TOOLS.map((t) => <EngineCard key={t.label} tool={t} />)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer — compliance note */}
        <p className="text-[10px] text-muted-foreground text-center pt-2">
          Outputs are illustrative and use industry-standard heuristics. For binding
          quotes, file applications through the carrier connector. For formal financial
          plans, engage a licensed advisor.
        </p>
      </div>
    </AppShell>
  );
}
