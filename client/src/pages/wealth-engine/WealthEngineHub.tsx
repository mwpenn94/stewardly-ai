/**
 * Wealth Engine Hub — Consolidated holistic planning hub.
 *
 * Pass 132: Restructured from 34 separate nav items into 3 cascading workflow
 * stages inspired by the Practice Management flow (Business Income → Owner Comp
 * → Valuation → Practice-to-Wealth).
 *
 * Structure:
 *   1. PLAN — Unified planning: goals, hierarchy, retirement, tax, estate, income
 *      (merges "My Plan" + "Personal Planning" into one cascading workflow)
 *   2. PROTECT & ANALYZE — Protection + analysis: bundle, insurance, strategies,
 *      sensitivity, what-if, comparisons
 *      (merges "Protection" + "Strategy & Tools" into one analysis workflow)
 *   3. PRACTICE — Practice management: business income, owner comp, valuation,
 *      practice-to-wealth (already a good cascading flow — preserved)
 *
 * Each stage has:
 *   - A stage overview card showing KPIs and quick actions
 *   - Embedded panels that flow into each other (not separate tabs)
 *   - Progressive disclosure: summary → detail → deep-dive
 */

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShareButton } from "@/components/sharing/ShareKit";
import { DisclosureSection } from "@/components/DisclosureSection";
import ServiceDegradedFallback from "@/components/ServiceDegradedFallback";
import { WealthEngineProvider, DEFAULT_DATA, type WealthEngineData } from "@/contexts/WealthEngineContext";
import { BenchmarkGrid } from "@/components/InlineBenchmark";
import { CascadeFlowIndicator, type CascadeStage } from "@/components/CascadeFlowIndicator";
import {
  PROTECTION_BENCHMARKS,
  RETIREMENT_BENCHMARKS,
  PRACTICE_BENCHMARKS,
  PLANNING_BENCHMARKS,
  TAX_BENCHMARKS,
  ESTATE_BENCHMARKS,
} from "@/pages/calculators/industryBenchmarks";
import {
  Sparkles, Calculator, PiggyBank, Shield, TrendingUp, Building2,
  Scale, Heart, GraduationCap, HandCoins, DollarSign, Stethoscope,
  BarChart3, Loader2, ArrowRight, Users, Target, FileText,
  Briefcase, Rocket, ShieldCheck, Workflow, Zap, Gauge,
  PanelLeftClose, PanelLeftOpen, LayoutGrid, ChevronRight, Home, Layers,
  Database, ChevronDown, ChevronUp, Eye, Play,
} from "lucide-react";
import { fmt, pct } from '@/lib/format';
// ─── CONSOLIDATED NAV — 3 WORKFLOW STAGES ──────────────────────────
type WETab =
  | "overview"
  // Plan stage
  | "retirement" | "tax" | "estate" | "risk" | "income" | "social-security" | "medicare" | "calculators"
  | "planning-hierarchy" | "unified-client-plan" | "financial-twin"
  // Protect & Analyze stage
  | "quick-bundle" | "protection-score" | "strategy-comparison" | "insurance-analysis"
  | "holistic-comparison" | "quick-quote-hub"
  | "configurator" | "sensitivity" | "what-if" | "references"
  | "strategy-archetypes" | "advanced-workflows" | "firm-comparison" | "cascade-alerts" | "financial-data-hub"
  // Practice stage
  | "engine-dashboard" | "business-income" | "owner-comp" | "business-valuation" | "practice-to-wealth"
  | "workflows" | "team-builder";

interface NavItem {
  id: WETab;
  label: string;
  icon: React.ElementType;
  slug: string;
  externalPath?: string;
  badge?: string;
  /** Brief description for the stage overview cards */
  desc?: string;
}
interface NavSection { group: string; icon: React.ElementType; desc: string; items: NavItem[]; }

/**
 * Pass 132: 3 workflow stages that cascade like Practice Management.
 *
 * PLAN: Goals → Hierarchy → Retirement → Tax → Estate → Income → SS → Medicare
 *   (Executive summary: "Where am I now? Where do I want to be?")
 *
 * PROTECT & ANALYZE: Bundle → Insurance → Strategies → Sensitivity → What-If → Comparisons
 *   (Executive summary: "What gaps exist? How do strategies compare?")
 *
 * PRACTICE: Business Income → Owner Comp → Valuation → Practice-to-Wealth → Team
 *   (Executive summary: "How does my practice feed my personal wealth?")
 */
const NAV_SECTIONS: NavSection[] = [
  { group: "Plan", icon: Target, desc: "Goals, hierarchy, and personal financial planning", items: [
    { id: "overview", label: "Dashboard", icon: LayoutGrid, slug: "overview", desc: "Holistic overview of all planning dimensions" },
    { id: "unified-client-plan", label: "Goals & Plan", icon: Layers, slug: "unified-client-plan", desc: "Set and track financial goals across all categories" },
    { id: "planning-hierarchy", label: "Planning Tree", icon: Workflow, slug: "planning-hierarchy", desc: "Cascading hierarchy — roll up/down across all dimensions" },
    { id: "retirement", label: "Retirement", icon: PiggyBank, slug: "retirement", desc: "Retirement projections and income planning" },
    { id: "tax", label: "Tax", icon: DollarSign, slug: "tax", externalPath: "/tax-planning", desc: "Tax optimization strategies" },
    { id: "estate", label: "Estate", icon: Briefcase, slug: "estate", externalPath: "/estate", desc: "Estate and legacy planning" },
    { id: "income", label: "Income", icon: TrendingUp, slug: "income", externalPath: "/income-projection", desc: "Income projections and sources" },
    { id: "social-security", label: "Social Security", icon: Calculator, slug: "social-security", externalPath: "/social-security", desc: "SS benefit optimization" },
    { id: "medicare", label: "Medicare", icon: Stethoscope, slug: "medicare", externalPath: "/medicare", desc: "Medicare planning" },
    { id: "risk", label: "Risk", icon: Scale, slug: "risk", externalPath: "/risk-assessment", desc: "Risk tolerance assessment" },
    { id: "financial-twin", label: "Digital Twin", icon: Users, slug: "financial-twin", externalPath: "/financial-twin", desc: "AI-powered financial twin" },
    { id: "calculators", label: "All Calculators", icon: Calculator, slug: "calculators", externalPath: "/calculators", desc: "Full calculator library" },
  ]},
  { group: "Protect & Analyze", icon: Shield, desc: "Insurance, strategies, and scenario analysis", items: [
    { id: "quick-bundle", label: "Quick Bundle", icon: Sparkles, slug: "quick-bundle", desc: "Multi-line protection proposal in 30 seconds" },
    { id: "protection-score", label: "Protection Score", icon: ShieldCheck, slug: "protection-score", externalPath: "/protection-score", desc: "Overall protection gap analysis" },
    { id: "insurance-analysis", label: "Insurance", icon: Shield, slug: "insurance-analysis", externalPath: "/insurance-analysis", desc: "Detailed insurance analysis" },
    { id: "strategy-comparison", label: "Strategies", icon: BarChart3, slug: "strategy-comparison", desc: "Compare wealth strategies side-by-side" },
    { id: "holistic-comparison", label: "Holistic Compare", icon: Target, slug: "holistic-comparison", desc: "Cross-domain holistic comparison" },
    { id: "strategy-archetypes", label: "Archetypes", icon: Target, slug: "strategy-archetypes", desc: "Pre-built strategy templates" },
    { id: "sensitivity", label: "Sensitivity", icon: BarChart3, slug: "sensitivity", desc: "Monte Carlo and sensitivity analysis" },
    { id: "portfolio-risk", label: "Portfolio Risk", icon: Scale, slug: "portfolio-risk", externalPath: "/portfolio-risk", desc: "Risk metrics & efficient frontier analysis" },
    { id: "what-if", label: "What-If", icon: Zap, slug: "what-if", desc: "Scenario modeling and stress testing" },
    { id: "quick-quote-hub", label: "Quick Quotes", icon: Zap, slug: "quick-quote-hub", desc: "Instant insurance quotes" },
    { id: "configurator", label: "Configurator", icon: Gauge, slug: "configurator", desc: "Engine configuration and assumptions" },
    { id: "advanced-workflows", label: "Workflows", icon: Workflow, slug: "advanced-workflows", desc: "Advanced multi-step workflows" },
    { id: "firm-comparison", label: "Firm Compare", icon: BarChart3, slug: "firm-comparison", desc: "Compare across firms" },
    { id: "cascade-alerts", label: "Alerts", icon: Zap, slug: "cascade-alerts", desc: "Cascade change alerts" },
    { id: "references", label: "References", icon: FileText, slug: "references", desc: "Industry data and reference materials" },
    { id: "financial-data-hub", label: "Data Hub", icon: Database, slug: "financial-data-hub", desc: "Financial data integrations" },
  ]},
  { group: "Practice", icon: Building2, desc: "Business income, valuation, and practice-to-wealth flow", items: [
    { id: "engine-dashboard", label: "Practice Dashboard", icon: BarChart3, slug: "engine-dashboard", externalPath: "/engine-dashboard", desc: "Practice management overview" },
    { id: "business-income", label: "Business Income", icon: DollarSign, slug: "business-income", desc: "Revenue modeling and projections" },
    { id: "owner-comp", label: "Owner Comp", icon: Building2, slug: "owner-comp", desc: "Owner compensation optimization" },
    { id: "business-valuation", label: "Valuation", icon: Rocket, slug: "business-valuation", desc: "Business valuation analysis" },
    { id: "practice-to-wealth", label: "Practice → Wealth", icon: Workflow, slug: "practice-to-wealth", desc: "Bridge practice income to personal wealth" },
    { id: "team-builder", label: "Team Builder", icon: Users, slug: "team-builder", desc: "Team structure and compensation" },
    { id: "workflows", label: "Workflows", icon: Workflow, slug: "workflows", externalPath: "/workflows", desc: "Practice workflows" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

// ─── LAZY EMBEDDED PAGES ───────────────────────────────────────────
const WeRetirement = lazy(() => import("./Retirement"));
const WeStrategyComparison = lazy(() => import("./StrategyComparison"));
const WePracticeToWealth = lazy(() => import("./PracticeToWealth"));
const WeQuickQuote = lazy(() => import("./QuickQuoteFlow"));
const WeTeamBuilder = lazy(() => import("./TeamBuilder"));
const WeSensitivity = lazy(() => import("./Sensitivity"));
const WeWhatIfSensitivity = lazy(() => import("./WhatIfSensitivity"));
const WeReferenceHub = lazy(() => import("./ReferenceHub"));
const WeBusinessIncome = lazy(() => import("./BusinessIncome"));
const WeWealthConfigurator = lazy(() => import("./WealthConfigurator"));
const WeBusinessValuation = lazy(() => import("./BusinessValuationPage"));
const WeOwnerComp = lazy(() => import("./OwnerCompPage"));
const WeQuickQuoteHub = lazy(() => import("./QuickQuoteHub"));
const WeHolisticComparison = lazy(() => import("./HolisticComparison"));
const WePlanningHierarchy = lazy(() => import("./PlanningHierarchyPanel"));
const WeAdvancedWorkflows = lazy(() => import("./AdvancedWorkflowsPanel"));
const WeStrategyArchetypes = lazy(() => import("./StrategyArchetypesPanel"));
const WeUnifiedClientPlan = lazy(() => import("./UnifiedClientPlanPanel"));
const WeFirmComparison = lazy(() => import("./FirmComparisonPanel"));
const WeCascadeAlerts = lazy(() => import("./CascadeAlertsPanel"));
const WeFinancialDataHub = lazy(() => import("./FinancialDataHub"));

// ─── GOAL CATEGORY ICONS ──────────────────────────────────────────
const GOAL_ICONS: Record<string, React.ElementType> = {
  retirement: PiggyBank, protection: Shield, estate: Briefcase,
  tax: DollarSign, education: GraduationCap, healthcare: Stethoscope,
  business: Building2, growth: TrendingUp, income: HandCoins,
};

// ─── INLINE QUICK BUNDLE ──────────────────────────────────────────
interface BundleForm {
  age: number; income: number; dependents: number;
  isBizOwner: boolean; hasHome: boolean; netWorth: number; stateCode: string;
}

function InlineQuickBundle() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<BundleForm>({
    age: 35, income: 120_000, dependents: 2,
    isBizOwner: false, hasHome: true, netWorth: 250_000, stateCode: "TX",
  });
  const bundleMut = trpc.wealthEngine.multiLineQuickQuote.useMutation({
    onError: (e: any) => toast.error(e.message),
  });
  const result = bundleMut.data?.data;
  const total = result?.totals.annualPremiumAll ?? 0;
  const critical = result?.totals.annualPremiumCritical ?? 0;
  const asPct = result?.totals.asPctOfIncome ?? 0;

  const onRun = () => bundleMut.mutate({
    age: form.age, income: form.income, dependents: form.dependents,
    isBizOwner: form.isBizOwner, hasHome: form.hasHome, netWorth: form.netWorth, stateCode: form.stateCode,
  });

  return (
    <Card className="bg-card/60 border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <CardTitle className="text-sm">Quick Bundle</CardTitle>
          <Badge variant="outline" className="h-4 text-[9px] px-1 border-accent/40 text-accent">Multi-Line</Badge>
        </div>
        <CardDescription className="text-[11px]">Generate a multi-line protection proposal in 30 seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Age", key: "age" as const, type: "number" },
            { label: "Annual Income", key: "income" as const, type: "number" },
            { label: "Dependents", key: "dependents" as const, type: "number" },
            { label: "Net Worth", key: "netWorth" as const, type: "number" },
          ].map(f => (
            <div key={f.key}>
              <Label className="text-[10px]">{f.label}</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Switch checked={form.isBizOwner} onCheckedChange={v => setForm(p => ({ ...p, isBizOwner: v }))} />
            <Label className="text-[10px]">Business Owner</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.hasHome} onCheckedChange={v => setForm(p => ({ ...p, hasHome: v }))} />
            <Label className="text-[10px]">Homeowner</Label>
          </div>
          <div>
            <Label className="text-[10px]">State</Label>
            <Input className="h-7 text-xs w-16 ml-1 inline-block" value={form.stateCode}
              onChange={e => setForm(p => ({ ...p, stateCode: e.target.value.toUpperCase().slice(0, 2) }))} />
          </div>
        </div>
        <Button size="sm" onClick={onRun} disabled={bundleMut.isPending} className="w-full">
          {bundleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          Generate Bundle
        </Button>
        {result && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-[9px] text-muted-foreground">Total Annual</p>
              <p className="text-sm font-bold text-accent">{fmt(total)}</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-[9px] text-muted-foreground">Critical Only</p>
              <p className="text-sm font-bold">{fmt(critical)}</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-[9px] text-muted-foreground">% of Income</p>
              <p className="text-sm font-bold">{pct(asPct)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── OVERVIEW CONTENT — HOLISTIC CASCADING DASHBOARD ──────────────
function OverviewContent() {
  const [, navigate] = useLocation();
  // @ts-expect-error — property access on loosely typed object
  const goalsQ = trpc.wealthEngine.getAdvisorGoals.useQuery(undefined, { retry: false });
  const treeQ = trpc.planningHierarchy.getFullTree.useQuery(undefined, { retry: false });
  // @ts-expect-error — property access on loosely typed object
  const assumptionsQ = trpc.wealthEngine.getAssumptions.useQuery(undefined, { retry: false });
  const latestUWE = trpc.wealthEngine.getLatestRun.useQuery({ tool: "uwe.simulate" }, { retry: false });
  const latestMC = trpc.wealthEngine.getLatestRun.useQuery({ tool: "montecarlo.simulate" }, { retry: false });
  const latestHE = trpc.wealthEngine.getLatestRun.useQuery({ tool: "he.simulate" }, { retry: false });

  // ─── CASCADE FLOW STAGES — shows data flow between Plan → Protect → Practice ───
  const cascadeStages: CascadeStage[] = useMemo(() => {
    const hasGoals = (goalsQ.data ?? []).length > 0;
    const hasTree = (treeQ.data ?? []).length > 0;
    const hasSims = [latestUWE.data, latestMC.data, latestHE.data].filter(Boolean).length > 0;
    return [
      {
        label: "Plan",
        icon: Target,
        status: hasGoals && hasTree ? "complete" : hasGoals || hasTree ? "active" : "pending",
        flowLabel: "Goals & assumptions",
        count: (goalsQ.data ?? []).length,
      },
      {
        label: "Protect & Analyze",
        icon: Shield,
        status: hasSims ? "complete" : hasGoals ? "active" : "pending",
        flowLabel: "Strategies & scenarios",
        count: [latestUWE.data, latestMC.data, latestHE.data].filter(Boolean).length,
      },
      {
        label: "Practice",
        icon: Building2,
        status: hasSims && hasGoals ? "active" : "pending",
        flowLabel: undefined,
        count: undefined,
      },
    ];
  }, [goalsQ.data, treeQ.data, latestUWE.data, latestMC.data, latestHE.data]);

  const goals = goalsQ.data ?? [];
  const tree = treeQ.data ?? [];
  const assumptions = assumptionsQ.data;

  const goalsByCategory = useMemo(() => {
    const map: Record<string, { total: number; onTrack: number; atRisk: number; totalTarget: number; totalCurrent: number }> = {};
    for (const g of goals) {
      const cat = (g as any).goalCategory ?? "other";
      if (!map[cat]) map[cat] = { total: 0, onTrack: 0, atRisk: 0, totalTarget: 0, totalCurrent: 0 };
      map[cat].total++;
      const status = (g as any).goalStatus ?? "identified";
      if (["on_track", "achieved"].includes(status)) map[cat].onTrack++;
      if (["at_risk"].includes(status)) map[cat].atRisk++;
      map[cat].totalTarget += parseFloat((g as any).targetAmount ?? "0") || 0;
      map[cat].totalCurrent += parseFloat((g as any).currentAmount ?? "0") || 0;
    }
    return map;
  }, [goals]);

  const treeSummary = useMemo(() => {
    let totalNodes = 0, activeNodes = 0;
    function walk(nodes: any[]) {
      for (const n of nodes) {
        totalNodes++;
        if (n.nodeStatus === "active") activeNodes++;
        if (n.children?.length) walk(n.children);
      }
    }
    walk(tree);
    return { totalNodes, activeNodes };
  }, [tree]);

  const totalGoals = goals.length;
  const onTrackGoals = goals.filter((g: any) => ["on_track", "achieved"].includes(g.goalStatus)).length;
  const atRiskGoals = goals.filter((g: any) => g.goalStatus === "at_risk").length;
  const isLoading = goalsQ.isLoading || treeQ.isLoading;

  return (
    <div className="space-y-6">
      <ServiceDegradedFallback serviceId="llm" degradedMessage="AI-powered analysis may be slower. Calculator tools still work normally.">
        <></>
      </ServiceDegradedFallback>

      {/* ─── CASCADE FLOW INDICATOR — shows data flow between stages ─── */}
      <div className="rounded-lg border border-border/30 bg-card/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Cascade Data Flow</h4>
          <span className="text-[9px] text-muted-foreground/50">Plan data feeds Protect; both feed Practice</span>
        </div>
        <CascadeFlowIndicator stages={cascadeStages} />
      </div>

      {/* ─── INDUSTRY BENCHMARKS — cited context for planning ─── */}
      <DisclosureSection minLevel={1} label="Industry Benchmarks">
        <BenchmarkGrid
          title="Industry Context"
          items={[
            {
              label: "Savings Rate",
              value: `${(RETIREMENT_BENCHMARKS.readiness.notConfident * 100).toFixed(0)}% not confident`,
              source: "EBRI Retirement Confidence Survey 2024",
              status: "warning",
            },
            {
              label: "Insurance Gap",
              value: `${(PROTECTION_BENCHMARKS.ownershipRates.adequateCoverage * 100).toFixed(0)}% adequate`,
              source: "LIMRA 2024 — only 22% have adequate life insurance",
              status: "warning",
            },
            {
              label: "Estate Planning",
              value: `${(ESTATE_BENCHMARKS.completionRates.hasCompletePlan * 100).toFixed(0)}% complete`,
              source: "WealthCounsel 2024 — only 12% have a complete estate plan",
              status: "warning",
            },
            {
              label: "Advisor Alpha",
              value: "~3%/yr added",
              source: "Vanguard Advisor Alpha Study 2025",
              url: "https://advisors.vanguard.com",
              status: "positive",
            },
            {
              label: "Avg Advisory Fee",
              value: "1.02%",
              source: "Kitces 2025 Advisory Fee Benchmarking Study",
              url: "https://www.kitces.com",
              status: "neutral",
            },
            {
              label: "Plan Completion",
              value: `${(PLANNING_BENCHMARKS.completionRates.implementationComplete * 100).toFixed(0)}%`,
              source: "Only 48% of plans reach full implementation",
              status: "warning",
            },
            {
              label: "Avg Effective Tax",
              value: `${(TAX_BENCHMARKS.effectiveRates[3].effectiveRate * 100).toFixed(1)}%`,
              source: `IRS SOI 2023 — ${TAX_BENCHMARKS.effectiveRates[3].income} bracket`,
              status: "neutral",
            },
            {
              label: "Top Quartile Rev/Advisor",
              value: `$${(PRACTICE_BENCHMARKS.revenuePerAdvisor.ria / 1000).toFixed(0)}K`,
              source: "Cerulli 2024 — RIA channel",
              status: "positive",
            },
          ]}
        />
      </DisclosureSection>

      {/* ─── WORKFLOW STAGE CARDS — the cascading overview ─── */}
      <div className="space-y-3">
        {NAV_SECTIONS.map((section) => {
          const SIcon = section.icon;
          // Compute stage-specific KPIs
          const stageKpis = section.group === "Plan" ? [
            { label: "Goals", value: isLoading ? "…" : totalGoals, color: "text-blue-400" },
            { label: "On Track", value: isLoading ? "…" : onTrackGoals, color: "text-emerald-400" },
            { label: "At Risk", value: isLoading ? "…" : atRiskGoals, color: atRiskGoals > 0 ? "text-red-400" : "text-emerald-400" },
            { label: "Plan Nodes", value: isLoading ? "…" : treeSummary.totalNodes, color: "text-violet-400" },
          ] : section.group === "Protect & Analyze" ? [
            { label: "Simulations", value: [latestUWE.data, latestMC.data, latestHE.data].filter(Boolean).length, color: "text-blue-400" },
            { label: "Strategies", value: "Compare", color: "text-violet-400" },
            { label: "Quotes", value: "Generate", color: "text-emerald-400" },
          ] : [
            { label: "Revenue", value: "Model", color: "text-blue-400" },
            { label: "Valuation", value: "Analyze", color: "text-violet-400" },
            { label: "P→W Bridge", value: "Plan", color: "text-emerald-400" },
          ];

          // Top 4 items for quick access
          const quickItems = section.items.filter(i => !i.externalPath).slice(0, 4);

          return (
            <Card key={section.group} className="border-border/40 hover:border-primary/20 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <SIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{section.group}</CardTitle>
                      <CardDescription className="text-[11px]">{section.desc}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {stageKpis.map(k => (
                      <div key={k.label} className="text-center px-2">
                        <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-[8px] text-muted-foreground">{k.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {quickItems.map(item => {
                    const IIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/wealth-engine/${item.slug}`)}
                        className="flex items-center gap-2 rounded-md bg-background/50 hover:bg-background/80 p-2 text-left transition-colors group"
                      >
                        <IIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium truncate">{item.label}</p>
                          {item.desc && <p className="text-[9px] text-muted-foreground truncate">{item.desc}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {section.items.length > 4 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/wealth-engine/${section.items[0].slug}`)}
                    className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    + {section.items.length - 4} more tools <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── GOAL CATEGORIES — real data ─── */}
      {totalGoals > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Financial Goals by Category</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/wealth-engine/unified-client-plan")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(goalsByCategory).map(([cat, data]) => {
                const Icon = GOAL_ICONS[cat] ?? Target;
                return (
                  <div key={cat} className="flex items-center gap-3 rounded-lg bg-background/50 p-2.5 hover:bg-background/80 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-none">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium capitalize truncate">{cat.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{data.total} goal{data.total !== 1 ? "s" : ""}</span>
                        {data.onTrack > 0 && <Badge variant="outline" className="h-4 text-[8px] px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{data.onTrack} on track</Badge>}
                        {data.atRisk > 0 && <Badge variant="outline" className="h-4 text-[8px] px-1 bg-red-500/10 text-red-400 border-red-500/20">{data.atRisk} at risk</Badge>}
                      </div>
                      {data.totalTarget > 0 && (
                        <div className="mt-1">
                          <div className="flex justify-between text-[9px] text-muted-foreground">
                            <span>{fmt(data.totalCurrent)}</span>
                            <span>{fmt(data.totalTarget)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-border/50 mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all ${data.totalCurrent >= data.totalTarget ? "bg-emerald-500" : "bg-accent"}`}
                              style={{ width: `${Math.min(100, data.totalTarget > 0 ? (data.totalCurrent / data.totalTarget) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── EMPTY STATE — no goals yet ─── */}
      {!isLoading && totalGoals === 0 && (
        <Card className="border-border/40 border-dashed">
          <CardContent className="p-6 text-center">
            <Target className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">Start your financial plan</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Create goals to track progress, or use the Quick Bundle to identify protection gaps instantly.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Button size="sm" variant="outline" onClick={() => navigate("/wealth-engine/unified-client-plan")}>
                <Layers className="w-3.5 h-3.5 mr-1.5" /> Create Goals
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/wealth-engine/quick-bundle")}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Quick Bundle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── PLANNING ASSUMPTIONS — shared defaults ─── */}
      {assumptions && (
        <DisclosureSection minLevel={2} label="Planning Assumptions" showTeaser>
          <Card className="border-border/40">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Inflation", value: assumptions.inflationRate ? pct(parseFloat(assumptions.inflationRate)) : "3.0%" },
                  { label: "Equity Return", value: assumptions.equityReturn ? pct(parseFloat(assumptions.equityReturn)) : "7.0%" },
                  { label: "Bond Return", value: assumptions.bondReturn ? pct(parseFloat(assumptions.bondReturn)) : "4.0%" },
                  { label: "Risk-Free Rate", value: assumptions.riskFreeRate ? pct(parseFloat(assumptions.riskFreeRate)) : "4.3%" },
                ].map(a => (
                  <div key={a.label} className="rounded-lg bg-background/50 p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">{a.label}</p>
                    <p className="text-sm font-medium">{a.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => navigate("/wealth-engine/configurator")}>
                  Edit Assumptions <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </DisclosureSection>
      )}

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Outputs are illustrative and use industry-standard heuristics. For binding
        quotes, file applications through the carrier connector. For formal financial
        plans, engage a licensed advisor.
      </p>
    </div>
  );
}

// ─── MAIN HUB ──────────────────────────────────────────────────────
export default function WealthEngineHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/wealth-engine/:tab");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_SECTIONS.map(s => [s.group, true]))
  );

  const initialTab: WETab = (matchTab && paramsTab?.tab && ALL_ITEMS.find(t => t.slug === paramsTab.tab))
    ? ALL_ITEMS.find(t => t.slug === paramsTab.tab)!.id
    : "overview";
  const [activeTab, setActiveTab] = useState<WETab>(initialTab);

  // Sync URL ↔ tab
  useEffect(() => {
    const item = ALL_ITEMS.find(t => t.id === activeTab);
    if (!item) return;
    if (item.externalPath) {
      navigate(item.externalPath);
      return;
    }
    const slug = item.slug || "overview";
    navigate(`/wealth-engine/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = ALL_ITEMS.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const handleTabClick = (item: NavItem) => {
    if (item.externalPath) {
      navigate(item.externalPath);
    } else {
      setActiveTab(item.id);
    }
    setSidebarOpen(false);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Find which stage the active tab belongs to
  const activeSection = NAV_SECTIONS.find(s => s.items.some(i => i.id === activeTab));

  return (
    <AppShell title="Wealth Engine">
      <SEOHead title="Wealth Engine" description="Unified wealth planning, protection, and growth engine" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR — 3 collapsible workflow stages ─── */}
        <aside role="complementary" aria-label="Wealth Engine navigation sidebar" className={`
          fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
          w-56 shrink-0 border-r border-border bg-card flex flex-col
          max-h-[100dvh] lg:max-h-screen lg:self-start
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Wealth Engine</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Plan · Protect · Practice</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-1" role="navigation" aria-label="Wealth Engine sections">
              {NAV_SECTIONS.map(section => {
                const SIcon = section.icon;
                const isExpanded = expandedGroups[section.group] ?? true;
                const hasActiveItem = section.items.some(i => i.id === activeTab);
                return (
                  <div key={section.group} role="group" aria-label={section.group}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(section.group)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs font-semibold transition-colors ${
                        hasActiveItem ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-background"
                      }`}
                    >
                      <SIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left">{section.group}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isExpanded && (
                      <div role="list" className="ml-2 mt-0.5 space-y-0.5">
                        {section.items.map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id && !item.externalPath;
                          return (
                            <button type="button" key={item.id} role="listitem"
                              onClick={() => handleTabClick(item)}
                              aria-current={isActive ? 'page' : undefined}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                isActive
                                  ? 'bg-primary/10 text-primary border border-primary/30'
                                  : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                              }`}>
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <Badge variant="outline" className="ml-auto h-4 text-[8px] px-1 border-accent/40 text-accent shrink-0">
                                  {item.badge}
                                </Badge>
                              )}
                              {item.externalPath && (
                                <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/40 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>

          <div className="p-3 border-t border-border/50 bg-background">
            <div className="text-center text-[9px] text-muted-foreground/30">Wealth Engine</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="Wealth Engine content">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* ─── BREADCRUMB — shows workflow stage ─── */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    <span className="hidden sm:inline">Home</span>
                  </button>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <button type="button" onClick={() => setActiveTab("overview")} className={`transition-colors flex items-center gap-1 ${
                    activeTab === "overview" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}>
                    <Gauge className="w-3 h-3" />
                    <span>Wealth Engine</span>
                  </button>
                  {activeTab !== "overview" && (() => {
                    const currentItem = ALL_ITEMS.find(t => t.id === activeTab);
                    if (!currentItem || !activeSection) return null;
                    return (
                      <>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-muted-foreground/60 hidden sm:inline">{activeSection.group}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50 hidden sm:inline" />
                        <span className="text-foreground font-medium flex items-center gap-1">
                          {(() => { const Icon = currentItem.icon; return <Icon className="w-3 h-3" />; })()}
                          {currentItem.label}
                        </span>
                      </>
                    );
                  })()}
                </nav>
              </div>
              <ShareButton contentType="wealth-engine" contentId="wealth-analysis" contentTitle="Wealth Analysis" variant="ghost" size="sm" />
            </div>

            <WealthEngineProvider value={DEFAULT_DATA}>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
              {activeTab === "overview" && <OverviewContent />}
              {activeTab === "retirement" && <WeRetirement embedded />}
              {activeTab === "strategy-comparison" && <WeStrategyComparison embedded />}
              {activeTab === "quick-bundle" && <InlineQuickBundle />}
              {activeTab === "practice-to-wealth" && <WePracticeToWealth embedded />}
              {activeTab === "owner-comp" && <WeOwnerComp embedded />}
              {activeTab === "business-valuation" && <WeBusinessValuation embedded />}
              {activeTab === "business-income" && <WeBusinessIncome embedded />}
              {activeTab === "configurator" && <WeWealthConfigurator embedded />}
              {activeTab === "sensitivity" && <WeSensitivity embedded />}
              {activeTab === "what-if" && <WeWhatIfSensitivity embedded />}
              {activeTab === "team-builder" && <WeTeamBuilder embedded />}
              {activeTab === "references" && <WeReferenceHub embedded />}
              {activeTab === "quick-quote-hub" && <WeQuickQuoteHub embedded />}
              {activeTab === "holistic-comparison" && <WeHolisticComparison embedded />}
              {activeTab === "planning-hierarchy" && <WePlanningHierarchy />}
              {activeTab === "advanced-workflows" && <WeAdvancedWorkflows />}
              {activeTab === "strategy-archetypes" && <WeStrategyArchetypes />}
              {activeTab === "unified-client-plan" && <WeUnifiedClientPlan />}
              {activeTab === "firm-comparison" && <WeFirmComparison />}
              {activeTab === "cascade-alerts" && <WeCascadeAlerts />}
              {activeTab === "financial-data-hub" && <WeFinancialDataHub />}
            </Suspense>
            </WealthEngineProvider>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
