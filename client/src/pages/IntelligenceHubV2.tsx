/**
 * IntelligenceHubV2 — Hub page for all intelligence/analytics features.
 * Uses the exact same sidebar pattern as the Wealth Engine (Calculators.tsx).
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasMinRole } from "@/lib/navigation";
import {
  Loader2, TrendingUp, Lightbulb, Database, BarChart3,
  Activity, Compass, Zap, Brain, PanelLeftClose, PanelLeftOpen, ChevronRight, Home,
} from "lucide-react";

const IntelligenceOverview = lazy(() => import("./IntelligenceHub"));
const MarketData = lazy(() => import("./MarketData"));
const ProductIntelligence = lazy(() => import("./ProductIntelligence"));
const DataPipelines = lazy(() => import("./DataPipelines"));
const EnrichmentAdmin = lazy(() => import("./EnrichmentAdmin"));
const PortalAnalytics = lazy(() => import("./PortalAnalytics"));
const Rebalancing = lazy(() => import("./Rebalancing"));
const Comparables = lazy(() => import("./Comparables"));
const OperationsHub = lazy(() => import("./OperationsHub"));

type IntelTab =
  | "overview" | "market-data" | "product-intelligence" | "data-pipelines"
  | "enrichment" | "portal-analytics" | "rebalancing" | "comparables" | "operations";

interface NavItem { id: IntelTab; label: string; icon: React.ElementType; minRole: "user"|"advisor"|"manager"|"admin"; slug: string; }
interface NavSection { group: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  { group: "Overview", items: [
    { id: "overview", label: "Intelligence Hub", icon: Brain, minRole: "user", slug: "overview" },
    { id: "operations", label: "Operations", icon: Activity, minRole: "user", slug: "operations" },
  ]},
  { group: "Market", items: [
    { id: "market-data", label: "Market Data", icon: TrendingUp, minRole: "advisor", slug: "market-data" },
    { id: "product-intelligence", label: "Product Intel", icon: Lightbulb, minRole: "advisor", slug: "product-intelligence" },
    { id: "comparables", label: "Comparables", icon: Compass, minRole: "advisor", slug: "comparables" },
    { id: "rebalancing", label: "Rebalancing", icon: BarChart3, minRole: "advisor", slug: "rebalancing" },
  ]},
  { group: "Data", items: [
    { id: "data-pipelines", label: "Data Pipelines", icon: Database, minRole: "advisor", slug: "data-pipelines" },
    { id: "enrichment", label: "Enrichment", icon: Zap, minRole: "admin", slug: "enrichment" },
    { id: "portal-analytics", label: "Portal Analytics", icon: BarChart3, minRole: "admin", slug: "portal-analytics" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export default function IntelligenceHubV2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/intelligence-hub/:tab");
  const userRole = (user?.role ?? "user") as "user"|"advisor"|"manager"|"admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleSections = useMemo(() =>
    NAV_SECTIONS.map(s => ({ ...s, items: s.items.filter(i => hasMinRole(userRole, i.minRole)) }))
      .filter(s => s.items.length > 0),
    [userRole],
  );
  const visibleItems = visibleSections.flatMap(s => s.items);

  const initialTab = (matchTab && paramsTab?.tab && visibleItems.find(t => t.slug === paramsTab.tab))
    ? visibleItems.find(t => t.slug === paramsTab.tab)!.id
    : visibleItems[0]?.id ?? "overview";

  const [activeTab, setActiveTab] = useState<IntelTab>(initialTab);

  useEffect(() => {
    const slug = ALL_ITEMS.find(t => t.id === activeTab)?.slug || "overview";
    navigate(`/intelligence-hub/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = visibleItems.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  return (
    <AppShell title="Intelligence">
      <SEOHead title="Intelligence" description="Market data, analytics, and operational intelligence" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR ─── */}
        <aside role="complementary" aria-label="Intelligence navigation sidebar" className={`
          fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
          w-56 shrink-0 border-r border-border bg-card flex flex-col
          max-h-[100dvh] lg:max-h-screen lg:self-start
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Intelligence</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Data & Analytics</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-3" role="navigation" aria-label="Intelligence sections">
              {visibleSections.map(section => (
                <div key={section.group} role="group" aria-label={section.group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                  <div role="list">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <button type="button" key={item.id} role="listitem"
                          onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                          aria-current={activeTab === item.id ? 'page' : undefined}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                            activeTab === item.id
                              ? 'bg-primary/10 text-primary border border-primary/30'
                              : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                          }`}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>
          <div className="p-3 border-t border-border/50 bg-background">
            <div className="text-center text-[9px] text-muted-foreground/30">Intelligence Hub · {visibleItems.length} sections</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="Intelligence content">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Home className="w-3 h-3" /><span className="hidden sm:inline">Home</span>
                  </button>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <button type="button" onClick={() => setActiveTab("overview")} className={`transition-colors flex items-center gap-1 ${activeTab === "overview" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                    <Brain className="w-3 h-3" /><span>Intelligence</span>
                  </button>
                  {activeTab !== "overview" && (() => {
                    const currentItem = ALL_ITEMS.find(t => t.id === activeTab);
                    const currentSection = NAV_SECTIONS.find(s => s.items.some(i => i.id === activeTab));
                    if (!currentItem) return null;
                    const Icon = currentItem.icon;
                    return (<>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-muted-foreground/60 hidden sm:inline">{currentSection?.group}</span>
                      {currentSection && <ChevronRight className="w-3 h-3 text-muted-foreground/50 hidden sm:inline" />}
                      <span className="text-foreground font-medium flex items-center gap-1"><Icon className="w-3 h-3" />{currentItem.label}</span>
                    </>);
                  })()}
                </nav>
              </div>
            </div>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              {activeTab === "overview" && <IntelligenceOverview embedded />}
              {activeTab === "market-data" && <MarketData embedded />}
              {activeTab === "product-intelligence" && <ProductIntelligence embedded />}
              {activeTab === "operations" && <OperationsHub embedded />}
              {activeTab === "comparables" && <Comparables embedded />}
              {activeTab === "rebalancing" && <Rebalancing embedded />}
              {activeTab === "data-pipelines" && <DataPipelines embedded />}
              {activeTab === "enrichment" && <EnrichmentAdmin embedded />}
              {activeTab === "portal-analytics" && <PortalAnalytics embedded />}
            </Suspense>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
