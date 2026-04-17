/**
 * PeopleHub — Hub page for all people/relationship/CRM features.
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
  Loader2, Users, Target, RefreshCw, ShieldCheck, Mail, FolderOpen, Zap,
  LayoutGrid, UserPlus, FileText, Shield, ArrowRight, DollarSign,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

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

interface NavItem { id: PeopleTab; label: string; icon: React.ElementType; minRole: "user"|"advisor"|"manager"|"admin"; slug: string; }
interface NavSection { group: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  { group: "Clients", items: [
    { id: "relationships", label: "Clients", icon: Users, minRole: "user", slug: "clients" },
    { id: "leads", label: "Lead Pipeline", icon: Target, minRole: "advisor", slug: "leads" },
    { id: "client-onboarding", label: "Onboarding", icon: UserPlus, minRole: "user", slug: "onboarding" },
    { id: "annual-review", label: "Annual Review", icon: FileText, minRole: "advisor", slug: "annual-review" },
  ]},
  { group: "Outreach", items: [
    { id: "command-center", label: "Command Center", icon: LayoutGrid, minRole: "advisor", slug: "command-center" },
    { id: "email-campaigns", label: "Email Campaigns", icon: Mail, minRole: "advisor", slug: "email-campaigns" },
    { id: "marketing-assets", label: "Marketing Assets", icon: FolderOpen, minRole: "advisor", slug: "marketing-assets" },
    { id: "outreach", label: "Outreach Automation", icon: Zap, minRole: "advisor", slug: "outreach" },
  ]},
  { group: "Compliance", items: [
    { id: "compliance", label: "Compliance Audit", icon: ShieldCheck, minRole: "advisor", slug: "compliance" },
    { id: "compliance-copilot", label: "Compliance Copilot", icon: Shield, minRole: "advisor", slug: "compliance-copilot" },
  ]},
  { group: "Advanced", items: [
    { id: "crm-sync", label: "CRM Sync", icon: RefreshCw, minRole: "advisor", slug: "crm-sync" },
    { id: "business-exit", label: "Business Exit", icon: ArrowRight, minRole: "advisor", slug: "business-exit" },
    { id: "premium-finance", label: "Premium Finance", icon: DollarSign, minRole: "advisor", slug: "premium-finance" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export default function PeopleHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/people/:tab");
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
    : visibleItems[0]?.id ?? "relationships";

  const [activeTab, setActiveTab] = useState<PeopleTab>(initialTab);

  useEffect(() => {
    const slug = ALL_ITEMS.find(t => t.id === activeTab)?.slug || "clients";
    navigate(`/people/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = visibleItems.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  return (
    <AppShell title="People">
      <SEOHead title="People Hub" description="Manage clients, leads, campaigns, and compliance" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR ─── */}
        <aside role="complementary" aria-label="People navigation sidebar" className={`
          fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
          w-56 shrink-0 border-r border-border bg-card flex flex-col
          max-h-[100dvh] lg:max-h-screen lg:self-start
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">People</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Relationships & Outreach</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-3" role="navigation" aria-label="People sections">
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
            <div className="text-center text-[9px] text-muted-foreground/30">People Hub · {visibleItems.length} sections</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="People content">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* ─── TOOLBAR ─── */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground">{ALL_ITEMS.find(t => t.id === activeTab)?.label}</span>
              </div>
            </div>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>}>
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
          </div>
        </main>
      </div>
    </AppShell>
  );
}
