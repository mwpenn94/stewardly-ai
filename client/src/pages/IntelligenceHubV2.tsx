/**
 * IntelligenceHubV2 — Hub page for all intelligence/analytics features.
 *
 * Pass 111: Consolidates Market Data, Product Intelligence, Data Pipelines,
 * Enrichment, Portal Analytics, Rebalancing, Comparables, Operations, and
 * the original Intelligence overview into a single hub with internal sidebar.
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasMinRole } from "@/lib/navigation";
import {
  Loader2, TrendingUp, Lightbulb, Database, BarChart3,
  Activity, Compass, Zap, Menu, X, Brain,
} from "lucide-react";

// Lazy-load existing page components
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

interface TabDef {
  id: IntelTab;
  label: string;
  icon: React.ElementType;
  minRole: "user" | "advisor" | "manager" | "admin";
  slug: string;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: Brain, minRole: "user", slug: "overview" },
  { id: "market-data", label: "Market Data", icon: TrendingUp, minRole: "advisor", slug: "market-data" },
  { id: "product-intelligence", label: "Product Intel", icon: Lightbulb, minRole: "advisor", slug: "product-intelligence" },
  { id: "operations", label: "Operations", icon: Activity, minRole: "user", slug: "operations" },
  { id: "comparables", label: "Comparables", icon: Compass, minRole: "advisor", slug: "comparables" },
  { id: "rebalancing", label: "Rebalancing", icon: BarChart3, minRole: "advisor", slug: "rebalancing" },
  { id: "data-pipelines", label: "Data Pipelines", icon: Database, minRole: "advisor", slug: "data-pipelines" },
  { id: "enrichment", label: "Enrichment", icon: Zap, minRole: "admin", slug: "enrichment" },
  { id: "portal-analytics", label: "Portal Analytics", icon: BarChart3, minRole: "admin", slug: "portal-analytics" },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );
}

export default function IntelligenceHubV2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/intelligence-hub/:tab");
  const userRole = (user?.role ?? "user") as "user" | "advisor" | "manager" | "admin";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleTabs = useMemo(
    () => TABS.filter(t => hasMinRole(userRole, t.minRole)),
    [userRole],
  );

  const initialTab = (matchTab && paramsTab?.tab && visibleTabs.find(t => t.slug === paramsTab.tab))
    ? (visibleTabs.find(t => t.slug === paramsTab.tab)!.id)
    : visibleTabs[0]?.id ?? "overview";

  const [activeTab, setActiveTab] = useState<IntelTab>(initialTab);

  useEffect(() => {
    const slug = TABS.find(t => t.id === activeTab)?.slug || "overview";
    navigate(`/intelligence-hub/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = visibleTabs.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <AppShell title="Intelligence">
      <SEOHead title="Intelligence" description="Market data, analytics, and operational intelligence" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.12) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold truncate">Intelligence</h1>
            <button type="button"
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs md:hidden"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
              <span className="truncate">{currentTab.label}</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex min-h-[calc(100vh-3rem)]">
          {/* Internal sidebar */}
          <aside className={`
            ${mobileNavOpen ? "block" : "hidden"} md:block
            w-full md:w-52 lg:w-56 shrink-0 border-r border-border/30
            bg-card/20 md:bg-transparent
            fixed md:relative inset-0 top-12 z-20 md:z-0
          `}>
            <div className="p-2 space-y-0.5" role="tablist" aria-label="Intelligence sections" aria-orientation="vertical">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button type="button"
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => { setActiveTab(tab.id); setMobileNavOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[13px] ${
                      activeTab === tab.id
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? "text-accent" : ""}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {mobileNavOpen && (
            <div className="fixed inset-0 top-12 z-10 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
          )}

          <main className="flex-1 min-w-0">
            <Suspense fallback={<LoadingFallback />}>
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
          </main>
        </div>
      </div>
    </AppShell>
  );
}
