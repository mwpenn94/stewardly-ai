/**
 * Command Center — Restructured into workflow tabs with progressive disclosure.
 *
 * Tab structure:
 *   Pipeline    — Dashboard overview + Leads + Clients + Onboarding + Annual Review (the funnel)
 *   Marketing   — Campaigns + Assets + Automation (the outreach)
 *   Compliance  — Audit + AI Copilot (the governance)
 *   Operations  — CRM Sync + Business Exit + Premium Finance (the infrastructure)
 *
 * All existing functionality preserved via lazy-loaded panels, just reorganized
 * into a coherent workflow instead of 13 separate sidebar items.
 */
import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasMinRole } from "@/lib/navigation";
import {
  Loader2, Users, Target, RefreshCw, ShieldCheck, Mail, FolderOpen, Zap,
  LayoutGrid, UserPlus, FileText, Shield, ArrowRight, DollarSign,
  ChevronRight, Home, ChevronDown,
} from "lucide-react";

/* ─── Lazy-loaded panels (all existing panels preserved) ─── */
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

/* ─── Tab definitions ─── */
type HubTab = "pipeline" | "marketing" | "compliance" | "operations";

interface SubPanel {
  id: string;
  label: string;
  icon: React.ElementType;
  minRole: "user" | "advisor" | "manager" | "admin";
}

interface TabDef {
  id: HubTab;
  label: string;
  icon: React.ElementType;
  description: string;
  panels: SubPanel[];
}

const TAB_DEFS: TabDef[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    icon: Target,
    description: "Leads → Clients → Growth",
    panels: [
      { id: "command-center", label: "Dashboard", icon: LayoutGrid, minRole: "user" },
      { id: "leads", label: "Lead Pipeline", icon: Target, minRole: "advisor" },
      { id: "relationships", label: "Clients", icon: Users, minRole: "user" },
      { id: "client-onboarding", label: "Onboarding", icon: UserPlus, minRole: "user" },
      { id: "annual-review", label: "Annual Review", icon: FileText, minRole: "advisor" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Mail,
    description: "Campaigns & outreach",
    panels: [
      { id: "email-campaigns", label: "Campaigns", icon: Mail, minRole: "advisor" },
      { id: "marketing-assets", label: "Assets", icon: FolderOpen, minRole: "advisor" },
      { id: "outreach", label: "Automation", icon: Zap, minRole: "advisor" },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    description: "Audit & governance",
    panels: [
      { id: "compliance", label: "Compliance Audit", icon: ShieldCheck, minRole: "advisor" },
      { id: "compliance-copilot", label: "Compliance AI", icon: Shield, minRole: "advisor" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: RefreshCw,
    description: "Infrastructure & tools",
    panels: [
      { id: "crm-sync", label: "CRM Sync", icon: RefreshCw, minRole: "advisor" },
      { id: "business-exit", label: "Business Exit", icon: ArrowRight, minRole: "advisor" },
      { id: "premium-finance", label: "Premium Finance", icon: DollarSign, minRole: "advisor" },
    ],
  },
];

const Fallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 animate-spin text-accent" />
  </div>
);

export default function PeopleHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/people/:tab");
  const userRole = (user?.role ?? "user") as "user" | "advisor" | "manager" | "admin";

  // Filter tabs and panels by role
  const visibleTabs = useMemo(() =>
    TAB_DEFS.map(tab => ({
      ...tab,
      panels: tab.panels.filter(p => hasMinRole(userRole, p.minRole)),
    })).filter(tab => tab.panels.length > 0),
    [userRole],
  );

  // Active tab + active panel within tab
  const [activeTab, setActiveTab] = useState<HubTab>("pipeline");
  const [activePanel, setActivePanel] = useState<string>("command-center");

  // URL sync
  useEffect(() => {
    navigate(`/people/${activePanel}`, { replace: true });
  }, [activePanel, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const slug = paramsTab.tab;
      // Find which tab contains this panel
      for (const tab of visibleTabs) {
        const panel = tab.panels.find(p => p.id === slug);
        if (panel) {
          setActiveTab(tab.id);
          setActivePanel(panel.id);
          return;
        }
      }
    }
  }, [matchTab, paramsTab?.tab, visibleTabs]);

  const currentTab = visibleTabs.find(t => t.id === activeTab) ?? visibleTabs[0];
  const currentPanel = currentTab?.panels.find(p => p.id === activePanel);

  return (
    <AppShell title="People">
      <SEOHead title="Command Center" description="Manage your pipeline, marketing, compliance, and operations" />
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">

        {/* ─── HEADER ─── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" />
              Command Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Pipeline · Marketing · Compliance · Operations
            </p>
          </div>
        </header>

        {/* ─── TAB BAR ─── */}
        <div className="flex gap-1 p-1 bg-card rounded-lg border border-border overflow-x-auto" role="tablist">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab.id);
                  setActivePanel(tab.panels[0]?.id ?? "command-center");
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-background hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="hidden sm:inline text-[10px] text-muted-foreground/60">{tab.description}</span>
              </button>
            );
          })}
        </div>

        {/* ─── SUB-PANEL SELECTOR (progressive disclosure within each tab) ─── */}
        {currentTab && currentTab.panels.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {currentTab.panels.map(panel => {
              const Icon = panel.icon;
              const isActive = activePanel === panel.id;
              return (
                <button
                  key={panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "text-muted-foreground hover:bg-background hover:text-foreground border border-border/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {panel.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── PANEL CONTENT ─── */}
        <Suspense fallback={<Fallback />}>
          {activePanel === "command-center" && <CommandCenter embedded />}
          {activePanel === "leads" && <LeadPipeline embedded />}
          {activePanel === "relationships" && <Relationships embedded />}
          {activePanel === "client-onboarding" && <ClientOnboarding embedded />}
          {activePanel === "annual-review" && <AnnualReview embedded />}
          {activePanel === "email-campaigns" && <EmailCampaign embedded />}
          {activePanel === "marketing-assets" && <MarketingAssets embedded />}
          {activePanel === "outreach" && <OutreachAutomation embedded />}
          {activePanel === "compliance" && <ComplianceAudit embedded />}
          {activePanel === "compliance-copilot" && <ComplianceCopilot embedded />}
          {activePanel === "crm-sync" && <CRMSync embedded />}
          {activePanel === "business-exit" && <BusinessExit embedded />}
          {activePanel === "premium-finance" && <PremiumFinanceRates embedded />}
        </Suspense>
      </div>
    </AppShell>
  );
}
