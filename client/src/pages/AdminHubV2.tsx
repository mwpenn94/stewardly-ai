/**
 * AdminHubV2 — Hub page for all admin/platform features.
 * Uses the exact same sidebar pattern as the Wealth Engine (Calculators.tsx).
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2, Cog, Activity, TrendingUp, DollarSign, BarChart3,
  BookOpen, Globe, Users, CreditCard, Key, Webhook,
  FileText, Zap, ShieldCheck, Scale, Shield, Bot, GitMerge,
  Settings2, Brain, PanelLeftClose, PanelLeftOpen, ChevronRight, Home,
} from "lucide-react";

const GlobalAdmin = lazy(() => import("./GlobalAdmin"));
const AdminSystemHealth = lazy(() => import("./AdminSystemHealth"));
const AdminDataFreshness = lazy(() => import("./AdminDataFreshness"));
const AdminRateManagement = lazy(() => import("./AdminRateManagement"));
const AdminLeadSources = lazy(() => import("./AdminLeadSources"));
const AdminIntelligenceDashboard = lazy(() => import("./AdminIntelligenceDashboard"));
const PlatformGuide = lazy(() => import("./PlatformGuide"));
const KnowledgeAdmin = lazy(() => import("./KnowledgeAdmin"));
const AdminIntegrations = lazy(() => import("./AdminIntegrations"));
const TeamManagement = lazy(() => import("./TeamManagement"));
const BillingPage = lazy(() => import("./BillingPage"));
const APIKeys = lazy(() => import("./APIKeys"));
const WebhookManager = lazy(() => import("./WebhookManager"));
const AdminPlatformReports = lazy(() => import("./AdminPlatformReports"));
const ImprovementEngine = lazy(() => import("./ImprovementEngine"));
const BCP = lazy(() => import("./BCP"));
const FairnessTestDashboard = lazy(() => import("./FairnessTestDashboard"));
const AdminAuditTrail = lazy(() => import("./AdminAuditTrail"));
const AgentManager = lazy(() => import("./AgentManager"));
const ConsensusPage = lazy(() => import("./Consensus"));
const AdminFeaturePermissions = lazy(() => import("./AdminFeaturePermissions"));
const AdminUsageAnalytics = lazy(() => import("./AdminUsageAnalytics"));

type AdminTab =
  | "overview" | "system-health" | "data-freshness" | "rate-management"
  | "lead-sources" | "intelligence" | "guide" | "knowledge"
  | "integrations" | "team" | "billing" | "api-keys" | "webhooks"
  | "reports" | "improvement" | "bcp" | "fairness" | "audit-trail"
  | "agents" | "consensus" | "feature-permissions" | "usage-analytics";

interface NavItem { id: AdminTab; label: string; icon: React.ElementType; slug: string; }
interface NavSection { group: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  { group: "General", items: [
    { id: "overview", label: "Overview", icon: Cog, slug: "overview" },
    { id: "system-health", label: "System Health", icon: Activity, slug: "system-health" },
    { id: "usage-analytics", label: "Usage Analytics", icon: BarChart3, slug: "usage-analytics" },
    { id: "data-freshness", label: "Data Freshness", icon: TrendingUp, slug: "data-freshness" },
    { id: "feature-permissions", label: "Feature Flags", icon: Settings2, slug: "feature-permissions" },
  ]},
  { group: "AI & Agents", items: [
    { id: "agents", label: "AI Agents", icon: Bot, slug: "agents" },
    { id: "consensus", label: "Consensus", icon: GitMerge, slug: "consensus" },
    { id: "intelligence", label: "AI Intelligence", icon: Brain, slug: "intelligence" },
    { id: "improvement", label: "Improvement Engine", icon: Zap, slug: "improvement" },
  ]},
  { group: "Operations", items: [
    { id: "rate-management", label: "Rate Management", icon: DollarSign, slug: "rate-management" },
    { id: "lead-sources", label: "Lead Sources", icon: BarChart3, slug: "lead-sources" },
    { id: "integrations", label: "Integrations", icon: Globe, slug: "integrations" },
    { id: "bcp", label: "Business Continuity", icon: ShieldCheck, slug: "bcp" },
    { id: "fairness", label: "Fairness Audit", icon: Scale, slug: "fairness" },
  ]},
  { group: "Config", items: [
    { id: "team", label: "Team", icon: Users, slug: "team" },
    { id: "billing", label: "Billing", icon: CreditCard, slug: "billing" },
    { id: "api-keys", label: "API Keys", icon: Key, slug: "api-keys" },
    { id: "webhooks", label: "Webhooks", icon: Webhook, slug: "webhooks" },
  ]},
  { group: "Knowledge", items: [
    { id: "knowledge", label: "Knowledge Base", icon: BookOpen, slug: "knowledge" },
    { id: "reports", label: "Platform Reports", icon: FileText, slug: "reports" },
    { id: "guide", label: "Platform Guide", icon: BookOpen, slug: "guide" },
    { id: "audit-trail", label: "Audit Trail", icon: Shield, slug: "audit-trail" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export default function AdminHubV2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/admin/:tab");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initialTab = (matchTab && paramsTab?.tab && ALL_ITEMS.find(t => t.slug === paramsTab.tab))
    ? ALL_ITEMS.find(t => t.slug === paramsTab.tab)!.id
    : "overview";

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  useEffect(() => {
    const slug = ALL_ITEMS.find(t => t.id === activeTab)?.slug || "overview";
    navigate(`/admin/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = ALL_ITEMS.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  return (
    <AppShell title="Admin">
      <SEOHead title="Admin" description="Platform administration and configuration" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR ─── */}
        <aside role="complementary" aria-label="Admin navigation sidebar" className={`
          fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
          w-56 shrink-0 border-r border-border bg-card flex flex-col
          max-h-[100dvh] lg:max-h-screen lg:self-start
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Cog className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Admin</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Platform Administration</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-3" role="navigation" aria-label="Admin sections">
              {NAV_SECTIONS.map(section => (
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
            <div className="text-center text-[9px] text-muted-foreground/30">Admin Hub · {ALL_ITEMS.length} tools</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="Admin content">
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
                    <Cog className="w-3 h-3" /><span>Admin</span>
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
              {activeTab === "overview" && <GlobalAdmin embedded />}
              {activeTab === "system-health" && <AdminSystemHealth embedded />}
              {activeTab === "data-freshness" && <AdminDataFreshness embedded />}
              {activeTab === "feature-permissions" && <AdminFeaturePermissions embedded />}
              {activeTab === "agents" && <AgentManager embedded />}
              {activeTab === "consensus" && <ConsensusPage embedded />}
              {activeTab === "intelligence" && <AdminIntelligenceDashboard embedded />}
              {activeTab === "improvement" && <ImprovementEngine embedded />}
              {activeTab === "rate-management" && <AdminRateManagement embedded />}
              {activeTab === "lead-sources" && <AdminLeadSources embedded />}
              {activeTab === "integrations" && <AdminIntegrations embedded />}
              {activeTab === "bcp" && <BCP embedded />}
              {activeTab === "fairness" && <FairnessTestDashboard embedded />}
              {activeTab === "team" && <TeamManagement embedded />}
              {activeTab === "billing" && <BillingPage embedded />}
              {activeTab === "api-keys" && <APIKeys embedded />}
              {activeTab === "webhooks" && <WebhookManager embedded />}
              {activeTab === "knowledge" && <KnowledgeAdmin embedded />}
              {activeTab === "reports" && <AdminPlatformReports embedded />}
              {activeTab === "guide" && <PlatformGuide embedded />}
              {activeTab === "audit-trail" && <AdminAuditTrail embedded />}
              {activeTab === "usage-analytics" && <AdminUsageAnalytics embedded />}
            </Suspense>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
