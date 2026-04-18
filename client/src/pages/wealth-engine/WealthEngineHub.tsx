/**
 * Wealth Engine Hub — sidebar-driven hub page.
 *
 * Uses the exact same sidebar pattern as PeopleHub, SettingsHub, AdminHubV2,
 * and IntelligenceHubV2 for a consistent navigation experience.
 *
 * The sidebar groups 30+ tools into Plan / Protect / Grow / Quick Tools.
 * "Overview" is the default tab showing the hero + score strip + quick bundle.
 * All other tabs navigate to their standalone routes.
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
import Tier0InstantCard from "@/components/wealth-engine/Tier0InstantCard";
import {
  Sparkles, Calculator, PiggyBank, Shield, TrendingUp, Building2,
  Scale, Heart, GraduationCap, HandCoins, DollarSign, Stethoscope,
  BarChart3, Loader2, ArrowRight, Users, Target, FileText,
  Briefcase, Rocket, ShieldCheck, Workflow, Zap, Gauge,
  PanelLeftClose, PanelLeftOpen, LayoutGrid, ChevronRight, Home, Layers,
  Database,
} from "lucide-react";

// ─── FORMATTING HELPERS ────────────────────────────────────────────
const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── NAV DEFINITION ────────────────────────────────────────────────
type WETab =
  | "overview"
  | "retirement" | "tax" | "estate" | "risk" | "income" | "social-security" | "medicare" | "calculators"
  | "quick-bundle" | "protection-score" | "strategy-comparison" | "insurance-analysis"
  | "engine-dashboard" | "owner-comp" | "business-valuation" | "practice-to-wealth" | "financial-twin" | "workflows"
  | "configurator" | "sensitivity" | "what-if" | "references" | "team-builder" | "holistic-comparison"
  | "quick-quote-hub" | "business-income"
  | "advanced-workflows"
  | "strategy-archetypes" | "unified-client-plan" | "firm-comparison" | "cascade-alerts"
  | "financial-data-hub";

interface NavItem {
  id: WETab;
  label: string;
  icon: React.ElementType;
  slug: string;
  /** If set, clicking navigates to this external route instead of embedding */
  externalPath?: string;
  badge?: string;
}
interface NavSection { group: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  { group: "Overview", items: [
    { id: "overview", label: "Overview", icon: LayoutGrid, slug: "overview" },
  ]},
  { group: "Plan", items: [
    { id: "planning-hierarchy" as WETab, label: "Planning Hierarchy", icon: Layers, slug: "planning-hierarchy", badge: "New" },
    { id: "retirement", label: "Retirement Planner", icon: PiggyBank, slug: "retirement" },
    { id: "tax", label: "Tax Projector", icon: DollarSign, slug: "tax", externalPath: "/tax-planning" },
    { id: "estate", label: "Estate Planning", icon: Briefcase, slug: "estate", externalPath: "/estate" },
    { id: "risk", label: "Risk Assessment", icon: Scale, slug: "risk", externalPath: "/risk-assessment" },
    { id: "income", label: "Income Projection", icon: TrendingUp, slug: "income", externalPath: "/income-projection" },
    { id: "social-security", label: "Social Security", icon: Calculator, slug: "social-security", externalPath: "/social-security" },
    { id: "medicare", label: "Medicare", icon: Stethoscope, slug: "medicare", externalPath: "/medicare" },
    { id: "calculators", label: "All Calculators", icon: Calculator, slug: "calculators", externalPath: "/calculators" },
  ]},
  { group: "Protect", items: [
    { id: "quick-bundle", label: "Quick Bundle", icon: Sparkles, slug: "quick-bundle", badge: "New" },
    { id: "protection-score", label: "Protection Score", icon: ShieldCheck, slug: "protection-score", externalPath: "/protection-score" },
    { id: "strategy-comparison", label: "Strategy Comparison", icon: BarChart3, slug: "strategy-comparison" },
    { id: "insurance-analysis", label: "Insurance Analysis", icon: Shield, slug: "insurance-analysis", externalPath: "/insurance-analysis" },
    { id: "quick-quote-hub", label: "Quick Quote Hub", icon: Zap, slug: "quick-quote-hub" },
    { id: "holistic-comparison", label: "Holistic Comparison", icon: Target, slug: "holistic-comparison" },
  ]},
  { group: "Grow", items: [
    { id: "engine-dashboard", label: "Engine Dashboard", icon: BarChart3, slug: "engine-dashboard", externalPath: "/engine-dashboard" },
    { id: "owner-comp", label: "Owner Comp", icon: Building2, slug: "owner-comp", badge: "New" },
    { id: "business-valuation", label: "Business Valuation", icon: Rocket, slug: "business-valuation", badge: "New" },
    { id: "business-income", label: "Business Income", icon: DollarSign, slug: "business-income" },
    { id: "practice-to-wealth", label: "Practice-to-Wealth", icon: Workflow, slug: "practice-to-wealth" },
    { id: "financial-twin", label: "Financial Twin", icon: Users, slug: "financial-twin", externalPath: "/financial-twin" },
    { id: "workflows", label: "Workflows", icon: Workflow, slug: "workflows", externalPath: "/workflows" },
  ]},
  { group: "Tools", items: [
    { id: "configurator", label: "Configurator", icon: Gauge, slug: "configurator" },
    { id: "sensitivity", label: "Sensitivity", icon: BarChart3, slug: "sensitivity" },
    { id: "what-if", label: "What-If Analysis", icon: Zap, slug: "what-if" },
    { id: "team-builder", label: "Team Builder", icon: Users, slug: "team-builder" },
    { id: "references", label: "Reference Hub", icon: FileText, slug: "references" },
  ]},
  { group: "Advisory", items: [
    { id: "advanced-workflows" as WETab, label: "Advanced Workflows", icon: Shield, slug: "advanced-workflows", badge: "New" },
    { id: "strategy-archetypes" as WETab, label: "Strategy Archetypes", icon: Target, slug: "strategy-archetypes", badge: "New" },
    { id: "unified-client-plan" as WETab, label: "Unified Client Plan", icon: Layers, slug: "unified-client-plan", badge: "New" },
    { id: "firm-comparison" as WETab, label: "Firm Comparison", icon: BarChart3, slug: "firm-comparison", badge: "New" },
    { id: "cascade-alerts" as WETab, label: "Cascade Alerts", icon: Zap, slug: "cascade-alerts" },
  ]},
  { group: "Data", items: [
    { id: "financial-data-hub" as WETab, label: "Financial Data Hub", icon: Database, slug: "financial-data-hub", badge: "New" },
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
const WeBusinessIncomeQuickQuote = lazy(() => import("./BusinessIncomeQuickQuote"));
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

// ─── INLINE QUICK BUNDLE ───────────────────────────────────────────
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
          <div><Label className="text-[10px]">Age</Label><Input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: +e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">Income</Label><Input type="number" value={form.income} onChange={e => setForm(p => ({ ...p, income: +e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">Dependents</Label><Input type="number" value={form.dependents} onChange={e => setForm(p => ({ ...p, dependents: +e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">Net Worth</Label><Input type="number" value={form.netWorth} onChange={e => setForm(p => ({ ...p, netWorth: +e.target.value }))} className="h-8 text-xs" /></div>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-1.5 text-[11px]"><Switch checked={form.isBizOwner} onCheckedChange={v => setForm(p => ({ ...p, isBizOwner: v }))} className="scale-75" /> Business Owner</label>
          <label className="flex items-center gap-1.5 text-[11px]"><Switch checked={form.hasHome} onCheckedChange={v => setForm(p => ({ ...p, hasHome: v }))} className="scale-75" /> Homeowner</label>
        </div>
        <Button size="sm" onClick={onRun} disabled={bundleMut.isPending} className="gap-1.5">
          {bundleMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Run Quick Bundle
        </Button>
        {result && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-background/50 p-2"><p className="text-[10px] text-muted-foreground">Total Annual</p><p className="text-sm font-bold text-accent">{fmt(total)}</p></div>
            <div className="rounded-lg bg-background/50 p-2"><p className="text-[10px] text-muted-foreground">Critical Only</p><p className="text-sm font-bold">{fmt(critical)}</p></div>
            <div className="rounded-lg bg-background/50 p-2"><p className="text-[10px] text-muted-foreground">% of Income</p><p className="text-sm font-bold">{pct(asPct)}</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── HERO + SCORE STRIP (Overview tab) ─────────────────────────────
function HubHero({ role }: { role?: string }) {
  const [, navigate] = useLocation();
  return (
    <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Gauge className="w-5 h-5 text-accent" /> Wealth Engine
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              30+ planning, protection, and growth tools — unified in one hub.
            </p>
          </div>
          <div className="flex gap-2">
            <ShareButton contentType="wealth-engine" contentId="wealth-analysis" contentTitle="Wealth Analysis" variant="ghost" size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Tier0ScoreStrip() {
  const scoreQ = trpc.wealthEngine.getGuardrails.useQuery(undefined, { retry: 1 });
  if (!scoreQ.data) return null;
  const g = scoreQ.data;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        { label: "Protection", value: g.protectionScore ?? "—", color: "text-emerald-400" },
        { label: "Growth", value: g.growthScore ?? "—", color: "text-blue-400" },
        { label: "Tax Efficiency", value: g.taxScore ?? "—", color: "text-violet-400" },
        { label: "Overall", value: g.overallScore ?? "—", color: "text-accent" },
      ].map(s => (
        <Card key={s.label} className="bg-card/40 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── OVERVIEW CONTENT ──────────────────────────────────────────────
function OverviewContent() {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <ServiceDegradedFallback serviceId="llm" degradedMessage="AI-powered analysis may be slower or unavailable. Calculator tools still work normally.">
        <></>
      </ServiceDegradedFallback>
      <HubHero role={user?.role} />
      <Tier0ScoreStrip />
      <DisclosureSection minLevel={2} label="Quick Bundle Calculator" showTeaser>
        <InlineQuickBundle />
      </DisclosureSection>
      <Tier0InstantCard />
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

  const initialTab: WETab = (matchTab && paramsTab?.tab && ALL_ITEMS.find(t => t.slug === paramsTab.tab))
    ? ALL_ITEMS.find(t => t.slug === paramsTab.tab)!.id
    : "overview";
  const [activeTab, setActiveTab] = useState<WETab>(initialTab);

  // Sync URL ↔ tab
  useEffect(() => {
    const item = ALL_ITEMS.find(t => t.id === activeTab);
    if (!item) return;
    // For external paths, navigate away
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

  return (
    <AppShell title="Wealth Engine">
      <SEOHead title="Wealth Engine" description="Unified wealth planning, protection, and growth engine" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR ─── */}
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
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Plan · Protect · Grow</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-3" role="navigation" aria-label="Wealth Engine sections">
              {NAV_SECTIONS.map(section => (
                <div key={section.group} role="group" aria-label={section.group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                  <div role="list">
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
                </div>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-3 border-t border-border/50 bg-background">
            <div className="text-center text-[9px] text-muted-foreground/30">Wealth Engine · {ALL_ITEMS.length} tools</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="Wealth Engine content">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* ─── BREADCRUMB + TOOLBAR ─── */}
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
                    const currentSection = NAV_SECTIONS.find(s => s.items.some(i => i.id === activeTab));
                    if (!currentItem) return null;
                    return (
                      <>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-muted-foreground/60 hidden sm:inline">{currentSection?.group}</span>
                        {currentSection && <ChevronRight className="w-3 h-3 text-muted-foreground/50 hidden sm:inline" />}
                        <span className="text-foreground font-medium flex items-center gap-1">
                          {(() => { const Icon = currentItem.icon; return <Icon className="w-3 h-3" />; })()}
                          {currentItem.label}
                        </span>
                      </>
                    );
                  })()}
                </nav>
              </div>
            </div>

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
          </div>
        </main>
      </div>
    </AppShell>
  );
}
