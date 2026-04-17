/**
 * PeopleHub — Hub page for all people/relationship/CRM features.
 *
 * Pass 111: Consolidates Clients, Leads, CRM, Compliance, Email Campaigns,
 * Marketing Assets, Outreach, and other relationship-oriented features into
 * a single hub with an internal sidebar (matching the Wealth Engine pattern).
 *
 * Each "tab" lazy-loads the existing page component so there's zero duplication.
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasMinRole } from "@/lib/navigation";
import { Loader2, Users, Target, RefreshCw, ShieldCheck, Mail, FolderOpen, Zap, LayoutGrid, UserPlus, FileText, Shield, ArrowRight, DollarSign, ChevronRight, Menu, X } from "lucide-react";

// Lazy-load existing page components
const Relationships = lazy(() => import("./RelationshipsHub"));
const LeadPipeline = lazy(() => import("./LeadPipeline"));
const CRMSync = lazy(() => import("./CRMSync"));
const ComplianceAudit = lazy(() => import("./ComplianceAudit"));
const ComplianceCopilot = lazy(() => import("./ComplianceCopilot"));
const EmailCampaign = lazy(() => import("./EmailCampaign"));
const MarketingAssets = lazy(() => import("./MarketingAssets"));
const OutreachAutomation = lazy(() => import("./OutreachAutomation"));
const CommandCenter = lazy(() => import("./CommandCenter"));
const ClientOnboarding = lazy(() => import("./ClientOnboarding"));
const AnnualReview = lazy(() => import("./AnnualReview"));
const BusinessExit = lazy(() => import("./BusinessExit"));
const PremiumFinanceRates = lazy(() => import("./PremiumFinanceRates"));

type PeopleTab =
  | "relationships" | "leads" | "crm-sync" | "compliance" | "compliance-copilot"
  | "email-campaigns" | "marketing-assets" | "outreach" | "command-center"
  | "client-onboarding" | "annual-review" | "business-exit" | "premium-finance";

interface TabDef {
  id: PeopleTab;
  label: string;
  icon: React.ElementType;
  minRole: "user" | "advisor" | "manager" | "admin";
  slug: string;
}

const TABS: TabDef[] = [
  { id: "relationships", label: "Clients", icon: Users, minRole: "user", slug: "clients" },
  { id: "leads", label: "Lead Pipeline", icon: Target, minRole: "advisor", slug: "leads" },
  { id: "command-center", label: "Command Center", icon: LayoutGrid, minRole: "advisor", slug: "command-center" },
  { id: "client-onboarding", label: "Onboarding", icon: UserPlus, minRole: "user", slug: "onboarding" },
  { id: "email-campaigns", label: "Email Campaigns", icon: Mail, minRole: "advisor", slug: "email-campaigns" },
  { id: "marketing-assets", label: "Marketing Assets", icon: FolderOpen, minRole: "advisor", slug: "marketing-assets" },
  { id: "outreach", label: "Outreach", icon: Zap, minRole: "advisor", slug: "outreach" },
  { id: "crm-sync", label: "CRM Sync", icon: RefreshCw, minRole: "advisor", slug: "crm-sync" },
  { id: "compliance", label: "Compliance Audit", icon: ShieldCheck, minRole: "advisor", slug: "compliance" },
  { id: "compliance-copilot", label: "Compliance Copilot", icon: Shield, minRole: "advisor", slug: "compliance-copilot" },
  { id: "annual-review", label: "Annual Review", icon: FileText, minRole: "advisor", slug: "annual-review" },
  { id: "business-exit", label: "Business Exit", icon: ArrowRight, minRole: "advisor", slug: "business-exit" },
  { id: "premium-finance", label: "Premium Finance", icon: DollarSign, minRole: "advisor", slug: "premium-finance" },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );
}

export default function PeopleHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/people/:tab");
  const userRole = (user?.role ?? "user") as "user" | "advisor" | "manager" | "admin";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleTabs = useMemo(
    () => TABS.filter(t => hasMinRole(userRole, t.minRole)),
    [userRole],
  );

  const initialTab = (matchTab && paramsTab?.tab && visibleTabs.find(t => t.slug === paramsTab.tab))
    ? (visibleTabs.find(t => t.slug === paramsTab.tab)!.id)
    : visibleTabs[0]?.id ?? "relationships";

  const [activeTab, setActiveTab] = useState<PeopleTab>(initialTab);

  // Sync URL when tab changes
  useEffect(() => {
    const slug = TABS.find(t => t.id === activeTab)?.slug || "clients";
    navigate(`/people/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  // Sync tab when URL changes externally
  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = visibleTabs.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <AppShell title="People">
      <SEOHead title="People Hub" description="Manage clients, leads, campaigns, and compliance" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.70 0.12 250 / 0.12) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
            <Users className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold truncate">People</h1>
            {/* Mobile tab selector */}
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
            <div className="p-2 space-y-0.5" role="tablist" aria-label="People sections" aria-orientation="vertical">
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

          {/* Mobile overlay */}
          {mobileNavOpen && (
            <div className="fixed inset-0 top-12 z-10 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
          )}

          {/* Main content — render the active page component without its own AppShell */}
          <main className="flex-1 min-w-0">
            <Suspense fallback={<LoadingFallback />}>
              {activeTab === "relationships" && <Relationships embedded />}
              {activeTab === "leads" && <LeadPipeline embedded />}
              {activeTab === "command-center" && <CommandCenter embedded />}
              {activeTab === "client-onboarding" && <ClientOnboarding embedded />}
              {activeTab === "email-campaigns" && <EmailCampaign embedded />}
              {activeTab === "marketing-assets" && <MarketingAssets embedded />}
              {activeTab === "outreach" && <OutreachAutomation embedded />}
              {activeTab === "crm-sync" && <CRMSync embedded />}
              {activeTab === "compliance" && <ComplianceAudit embedded />}
              {activeTab === "compliance-copilot" && <ComplianceCopilot embedded />}
              {activeTab === "annual-review" && <AnnualReview embedded />}
              {activeTab === "business-exit" && <BusinessExit embedded />}
              {activeTab === "premium-finance" && <PremiumFinanceRates embedded />}
            </Suspense>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
