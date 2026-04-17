/**
 * AdminHubV2 — Hub page for all admin/platform features.
 *
 * Pass 111: Consolidates Global Admin, System Health, Data Freshness,
 * Rate Management, Lead Sources, AI Intelligence, Platform Guide,
 * Knowledge Admin, Integrations, Team, Billing, API Keys, Webhooks,
 * Reports, Improvement Engine, BCP, Fairness, Audit Trail, Agents,
 * and Consensus into a single hub with internal sidebar.
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2, Cog, Activity, TrendingUp, DollarSign, BarChart3,
  Sparkles, BookOpen, Globe, Users, CreditCard, Key, Webhook,
  FileText, Zap, ShieldCheck, Scale, Shield, Bot, GitMerge,
  Menu, X, Settings2, Brain,
} from "lucide-react";

// Lazy-load existing page components
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

type AdminTab =
  | "overview" | "system-health" | "data-freshness" | "rate-management"
  | "lead-sources" | "intelligence" | "guide" | "knowledge"
  | "integrations" | "team" | "billing" | "api-keys" | "webhooks"
  | "reports" | "improvement" | "bcp" | "fairness" | "audit-trail"
  | "agents" | "consensus" | "feature-permissions";

interface TabDef {
  id: AdminTab;
  label: string;
  icon: React.ElementType;
  group: string;
  slug: string;
}

const TABS: TabDef[] = [
  // Overview
  { id: "overview", label: "Overview", icon: Cog, group: "General", slug: "overview" },
  { id: "system-health", label: "System Health", icon: Activity, group: "General", slug: "system-health" },
  { id: "data-freshness", label: "Data Freshness", icon: TrendingUp, group: "General", slug: "data-freshness" },
  { id: "feature-permissions", label: "Feature Flags", icon: Settings2, group: "General", slug: "feature-permissions" },
  // AI & Agents
  { id: "agents", label: "AI Agents", icon: Bot, group: "AI & Agents", slug: "agents" },
  { id: "consensus", label: "Consensus", icon: GitMerge, group: "AI & Agents", slug: "consensus" },
  { id: "intelligence", label: "AI Intelligence", icon: Brain, group: "AI & Agents", slug: "intelligence" },
  { id: "improvement", label: "Improvement Engine", icon: Zap, group: "AI & Agents", slug: "improvement" },
  // Operations
  { id: "rate-management", label: "Rate Management", icon: DollarSign, group: "Operations", slug: "rate-management" },
  { id: "lead-sources", label: "Lead Sources", icon: BarChart3, group: "Operations", slug: "lead-sources" },
  { id: "integrations", label: "Integrations", icon: Globe, group: "Operations", slug: "integrations" },
  { id: "bcp", label: "Business Continuity", icon: ShieldCheck, group: "Operations", slug: "bcp" },
  { id: "fairness", label: "Fairness Audit", icon: Scale, group: "Operations", slug: "fairness" },
  // Config
  { id: "team", label: "Team", icon: Users, group: "Config", slug: "team" },
  { id: "billing", label: "Billing", icon: CreditCard, group: "Config", slug: "billing" },
  { id: "api-keys", label: "API Keys", icon: Key, group: "Config", slug: "api-keys" },
  { id: "webhooks", label: "Webhooks", icon: Webhook, group: "Config", slug: "webhooks" },
  // Knowledge
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen, group: "Knowledge", slug: "knowledge" },
  { id: "reports", label: "Platform Reports", icon: FileText, group: "Knowledge", slug: "reports" },
  { id: "guide", label: "Platform Guide", icon: BookOpen, group: "Knowledge", slug: "guide" },
  { id: "audit-trail", label: "Audit Trail", icon: Shield, group: "Knowledge", slug: "audit-trail" },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );
}

export default function AdminHubV2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/admin/:tab");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const initialTab = (matchTab && paramsTab?.tab && TABS.find(t => t.slug === paramsTab.tab))
    ? (TABS.find(t => t.slug === paramsTab.tab)!.id)
    : "overview";

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  useEffect(() => {
    const slug = TABS.find(t => t.id === activeTab)?.slug || "overview";
    navigate(`/admin/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = TABS.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const currentTab = TABS.find(t => t.id === activeTab)!;

  // Group tabs for sidebar sections
  const groups = useMemo(() => {
    const g: Record<string, TabDef[]> = {};
    for (const t of TABS) {
      if (!g[t.group]) g[t.group] = [];
      g[t.group].push(t);
    }
    return Object.entries(g);
  }, []);

  return (
    <AppShell title="Admin">
      <SEOHead title="Admin" description="Platform administration and configuration" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.12) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
            <Cog className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold truncate">Admin</h1>
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
          {/* Internal sidebar with grouped sections */}
          <aside className={`
            ${mobileNavOpen ? "block" : "hidden"} md:block
            w-full md:w-52 lg:w-56 shrink-0 border-r border-border/30
            bg-card/20 md:bg-transparent
            fixed md:relative inset-0 top-12 z-20 md:z-0
            overflow-y-auto
          `}>
            <div className="p-2" role="tablist" aria-label="Admin sections" aria-orientation="vertical">
              {groups.map(([groupName, tabs]) => (
                <div key={groupName} className="mb-2">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] select-none">
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {tabs.map((tab) => {
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
                </div>
              ))}
            </div>
          </aside>

          {mobileNavOpen && (
            <div className="fixed inset-0 top-12 z-10 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
          )}

          <main className="flex-1 min-w-0">
            <Suspense fallback={<LoadingFallback />}>
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
            </Suspense>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
