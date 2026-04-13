/**
 * PersonaSidebar5.tsx — 5-Layer Persona Navigation
 *
 * Pass 102. SUPERSEDES PersonaSidebar.tsx (3-layer).
 * Layers: Person → Client → Advisor → Manager → Steward
 * Desktop: collapsible sidebar, Mobile: left-edge drawer (Sheet)
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  MessageSquare, FileText, BarChart3, Volume2,
  Fingerprint, ClipboardList, Star, Terminal,
  Users, Briefcase, ShieldCheck, TrendingUp, Calculator,
  UserCog, LineChart, FileCheck, Upload, CreditCard,
  Cog, Brain, Activity, Lightbulb,
  GraduationCap, Settings, HelpCircle,
  Search, Plus, PanelLeftClose, PanelLeft,
  ChevronDown, Pin, Compass, Scale,
  Zap, Package, GitBranch, RefreshCw, Link2, Plug,
  Heart, DollarSign, Target, Shield, BookOpen,
  Key, Webhook, Bot, Building2, GitMerge,
  LayoutDashboard, UserPlus, HeartPulse, Sparkles, Mail,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type Role = "guest" | "user" | "advisor" | "manager" | "admin";

export interface NavItem {
  label: string;
  icon: any;
  path: string;
  match: string[];
}

export interface PersonaLayer {
  key: string;
  label: string;
  minRole: Role;
  items: NavItem[];
}

export const ROLE_LEVEL: Record<Role, number> = {
  guest: 0, user: 1, advisor: 2, manager: 3, admin: 4,
};

export const PERSONA_LAYERS: PersonaLayer[] = [
  {
    key: "person",
    label: "People",
    minRole: "guest",
    items: [
      { label: "Chat", icon: MessageSquare, path: "/chat", match: ["/chat"] },
      { label: "Code Chat", icon: Terminal, path: "/code-chat", match: ["/code-chat"] },
      { label: "Documents", icon: FileText, path: "/settings/knowledge", match: ["/settings/knowledge", "/documents"] },
      { label: "My Progress", icon: BarChart3, path: "/proficiency", match: ["/proficiency"] },
      { label: "Audio", icon: Volume2, path: "/settings/audio", match: ["/settings/audio"] },
    ],
  },
  {
    key: "client",
    label: "Clients",
    minRole: "user",
    items: [
      { label: "My Financial Twin", icon: Fingerprint, path: "/financial-twin", match: ["/financial-twin"] },
      { label: "Insights", icon: Star, path: "/intelligence-hub", match: ["/intelligence-hub", "/insights"] },
      { label: "Suitability", icon: ClipboardList, path: "/settings/suitability", match: ["/settings/suitability", "/suitability"] },
      { label: "Operations", icon: Zap, path: "/operations", match: ["/operations"] },
      { label: "Workflows", icon: GitBranch, path: "/workflows", match: ["/workflows"] },
      { label: "Client Onboarding", icon: UserPlus, path: "/client-onboarding", match: ["/client-onboarding"] },
      { label: "Wealth Engine", icon: Sparkles, path: "/wealth-engine", match: ["/wealth-engine"] },
      { label: "Engine Dashboard", icon: LayoutDashboard, path: "/engine-dashboard", match: ["/engine-dashboard"] },
      { label: "Calculators", icon: Calculator, path: "/calculators", match: ["/calculators"] },
      { label: "Passive Actions", icon: RefreshCw, path: "/passive-actions", match: ["/passive-actions"] },
      { label: "Protection Score", icon: Shield, path: "/protection-score", match: ["/protection-score", "/financial-protection-score"] },
      { label: "Tax Planning", icon: DollarSign, path: "/tax-planning", match: ["/tax-planning"] },
      { label: "Estate Planning", icon: Scale, path: "/estate", match: ["/estate"] },
      { label: "Financial Planning", icon: LineChart, path: "/financial-planning", match: ["/financial-planning"] },
      { label: "Risk Assessment", icon: Shield, path: "/risk-assessment", match: ["/risk-assessment"] },
      { label: "Income Projection", icon: TrendingUp, path: "/income-projection", match: ["/income-projection"] },
      { label: "Insurance Analysis", icon: Heart, path: "/insurance-analysis", match: ["/insurance-analysis"] },
      { label: "Social Security", icon: HeartPulse, path: "/social-security", match: ["/social-security"] },
      { label: "Medicare", icon: Activity, path: "/medicare", match: ["/medicare"] },
      { label: "Products", icon: Package, path: "/products", match: ["/products"] },
      { label: "Integrations", icon: Link2, path: "/integrations", match: ["/integrations"] },
      { label: "Community", icon: Users, path: "/community", match: ["/community"] },
    ],
  },
  {
    key: "advisor",
    label: "Professionals",
    minRole: "advisor",
    items: [
      { label: "My Work", icon: Briefcase, path: "/my-work", match: ["/my-work"] },
      { label: "Advisory", icon: Package, path: "/advisory", match: ["/advisory", "/advisory-execution"] },
      { label: "Clients", icon: Users, path: "/relationships", match: ["/relationships", "/portal", "/client-dashboard"] },
      { label: "Insurance & Apps", icon: FileCheck, path: "/insurance-applications", match: ["/insurance-applications", "/carrier-connector", "/suitability-panel"] },
      { label: "Lead Pipeline", icon: Target, path: "/leads", match: ["/leads"] },
      { label: "Email Campaigns", icon: Mail, path: "/email-campaigns", match: ["/email-campaigns"] },
      { label: "Import Data", icon: Upload, path: "/import", match: ["/import"] },
      { label: "Compliance", icon: ShieldCheck, path: "/compliance-audit", match: ["/compliance-audit"] },
      { label: "CRM Sync", icon: RefreshCw, path: "/crm-sync", match: ["/crm-sync"] },
      { label: "Market Data", icon: TrendingUp, path: "/market-data", match: ["/market-data"] },
      { label: "Product Intelligence", icon: Lightbulb, path: "/product-intelligence", match: ["/product-intelligence"] },
      { label: "Rebalancing", icon: Scale, path: "/rebalancing", match: ["/rebalancing"] },
      { label: "Dynamic Integrations", icon: Plug, path: "/dynamic-integrations", match: ["/dynamic-integrations"] },
      { label: "Integration Health", icon: HeartPulse, path: "/integration-health", match: ["/integration-health"] },
    ],
  },
  {
    key: "manager",
    label: "Leaders",
    minRole: "manager",
    items: [
      { label: "Team Dashboard", icon: UserCog, path: "/manager", match: ["/manager"] },
      { label: "Organizations", icon: Building2, path: "/organizations", match: ["/organizations"] },
    ],
  },
  {
    key: "steward",
    label: "Stewards",
    minRole: "admin",
    items: [
      { label: "Platform Admin", icon: Cog, path: "/admin", match: ["/admin"] },
      { label: "AI Agents", icon: Bot, path: "/agents", match: ["/agents"] },
      { label: "Consensus", icon: GitMerge, path: "/consensus", match: ["/consensus"] },
      { label: "AI Intelligence", icon: Brain, path: "/admin/intelligence", match: ["/admin/intelligence"] },
      { label: "Improvement", icon: Zap, path: "/admin/improvement", match: ["/admin/improvement"] },
      { label: "Improvement Engine", icon: Activity, path: "/admin/improvement-engine", match: ["/admin/improvement-engine", "/improvement"] },
      { label: "System Health", icon: Activity, path: "/admin/system-health", match: ["/admin/system-health"] },
      { label: "Data Freshness", icon: Activity, path: "/admin/data-freshness", match: ["/admin/data-freshness"] },
      { label: "Rate Management", icon: TrendingUp, path: "/admin/rate-management", match: ["/admin/rate-management"] },
      { label: "Billing", icon: CreditCard, path: "/admin/billing", match: ["/admin/billing"] },
      { label: "API Keys", icon: Key, path: "/admin/api-keys", match: ["/admin/api-keys"] },
      { label: "Webhooks", icon: Webhook, path: "/admin/webhooks", match: ["/admin/webhooks"] },
      { label: "Team", icon: Users, path: "/admin/team", match: ["/admin/team"] },
      { label: "BCP Dashboard", icon: ShieldCheck, path: "/admin/bcp", match: ["/admin/bcp"] },
      { label: "Fairness Audit", icon: Scale, path: "/admin/fairness", match: ["/admin/fairness"] },
      { label: "Comparables", icon: Compass, path: "/comparables", match: ["/comparables"] },
      { label: "Platform Reports", icon: FileText, path: "/admin/platform-reports", match: ["/admin/platform-reports"] },
      { label: "Knowledge Base", icon: BookOpen, path: "/admin/knowledge", match: ["/admin/knowledge"] },
      { label: "Platform Guide", icon: BookOpen, path: "/admin/guide", match: ["/admin/guide"] },
      { label: "Lead Sources", icon: Target, path: "/admin/lead-sources", match: ["/admin/lead-sources"] },
    ],
  },
];

const LEARN_ITEM: NavItem = {
  label: "Learn", icon: GraduationCap, path: "/learning",
  match: ["/learning", "/learning/tracks", "/learning/exam", "/learning/discipline", "/learning/case", "/learning/connections", "/learning/achievements", "/learning/licenses", "/learning/studio", "/learning/review", "/learning/search", "/learning/flashcards", "/learning/quiz"],
};

const FOOTER_ITEMS: NavItem[] = [
  { label: "Settings", icon: Settings, path: "/settings", match: ["/settings"] },
  { label: "Help", icon: HelpCircle, path: "/help", match: ["/help"] },
];

interface Conversation { id: string; title: string; updatedAt: string; pinned?: boolean; }

function groupConvos(convos: Conversation[]) {
  if (!convos.length) return [];
  const dayMs = 86400000;
  const todayStart = new Date(new Date().toDateString()).getTime();

  type Group = { label: string; items: Conversation[] };
  const groups: Group[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of convos) {
    if (c.pinned) { groups[0].items.push(c); continue; }
    const t = new Date(c.updatedAt).getTime();
    if (t >= todayStart) groups[1].items.push(c);
    else if (t >= todayStart - dayMs) groups[2].items.push(c);
    else if (t >= todayStart - 7 * dayMs) groups[3].items.push(c);
    else groups[4].items.push(c);
  }
  return groups.filter(g => g.items.length > 0);
}

interface SidebarInnerProps {
  role: Role;
  collapsed: boolean;
  onCollapse: () => void;
  onNewChat: () => void;
  onSearch: () => void;
  conversations: Conversation[];
  onNavigate?: () => void;
}

function SidebarInner({ role, collapsed, onCollapse, onNewChat, onSearch, conversations, onNavigate }: SidebarInnerProps) {
  const [location, navigate] = useLocation();
  const [showConvos, setShowConvos] = useState(true);
  const roleLevel = ROLE_LEVEL[role];
  const convoGroups = useMemo(() => groupConvos(conversations), [conversations]);

  const visibleLayers = PERSONA_LAYERS.filter(l => roleLevel >= ROLE_LEVEL[l.minRole]);

  const isActive = (item: NavItem) =>
    item.match.some(p => location === p || location.startsWith(p + "/"));

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    return (
      <button
        onClick={() => { navigate(item.path); onNavigate?.(); }}
        className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg cursor-pointer transition-colors text-[13px] leading-tight
          ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card/40"}
          ${collapsed ? "justify-center px-1.5" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className={`w-[17px] h-[17px] flex-none ${active ? "text-primary" : ""}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  const Label = ({ children }: { children: string }) =>
    collapsed ? null : (
      <div className="px-2.5 pt-3.5 pb-0.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] select-none">
        {children}
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-sidebar text-foreground">
      <div className="flex items-center justify-between px-2.5 py-2 flex-none border-b border-border">
        {!collapsed && (
          <span className="font-heading text-[14px] font-bold tracking-tight">Stewardly</span>
        )}
        <div className="flex items-center gap-0.5">
          {!collapsed && (
            <button onClick={onNewChat} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card/50 cursor-pointer" aria-label="New chat">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button onClick={onCollapse} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card/50 cursor-pointer" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-2 py-1.5 flex-none">
          <button onClick={onSearch} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 cursor-pointer transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="ml-auto text-[9px] px-1 py-0.5 rounded bg-card border border-border/60">⌘K</kbd>
          </button>
        </div>
      )}

      <nav aria-label="Main navigation" role="navigation" className="flex-1 overflow-y-auto px-1.5 pb-2">
        {visibleLayers.map(layer => (
          <div key={layer.key}>
            <Label>{layer.label}</Label>
            <div className="space-y-[1px]">
              {layer.items.map(item => <NavBtn key={item.path} item={item} />)}
            </div>
          </div>
        ))}

        {roleLevel >= ROLE_LEVEL.user && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <NavBtn item={LEARN_ITEM} />
          </div>
        )}

        {!collapsed && conversations.length > 0 && (
          <section aria-label="Recent conversations" className="mt-3 pt-2 border-t border-border/40">
            <button
              onClick={() => setShowConvos(!showConvos)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] cursor-pointer hover:text-muted-foreground transition-colors w-full select-none"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showConvos ? "" : "-rotate-90"}`} />
              Conversations
            </button>
            {showConvos && (
              <div className="mt-0.5 space-y-[1px] max-h-[35vh] overflow-y-auto">
                {convoGroups.map(g => (
                  <div key={g.label}>
                    <div className="px-2.5 py-1 text-[9px] text-muted-foreground/35 select-none">{g.label}</div>
                    {g.items.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { navigate(`/chat/${c.id}`); onNavigate?.(); }}
                        className={`w-full flex items-center gap-1.5 px-2.5 py-[6px] rounded-lg cursor-pointer transition-colors text-[12px] text-left truncate
                          ${location === `/chat/${c.id}` ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-card/40"}`}
                      >
                        {c.pinned && <Pin className="w-2.5 h-2.5 text-primary/60 flex-none" />}
                        <span className="truncate">{c.title || "Untitled"}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </nav>

      <div className="px-1.5 py-1.5 border-t border-border/40 flex-none space-y-[1px]">
        {FOOTER_ITEMS.map(item => <NavBtn key={item.path} item={item} />)}
      </div>
    </div>
  );
}

interface Props {
  role: Role;
  collapsed: boolean;
  onCollapse: () => void;
  onNewChat: () => void;
  onSearch: () => void;
  conversations?: Conversation[];
  mobileOpen?: boolean;
  onMobileChange?: (v: boolean) => void;
}

export default function PersonaSidebar5({
  role, collapsed, onCollapse, onNewChat, onSearch,
  conversations = [], mobileOpen = false, onMobileChange,
}: Props) {
  const inner = { role, collapsed, onCollapse, onNewChat, onSearch, conversations };

  return (
    <>
      <aside className={`hidden md:flex flex-col h-screen border-r border-border transition-all duration-200 flex-none
        ${collapsed ? "w-[48px]" : "w-[220px]"}`}>
        <SidebarInner {...inner} />
      </aside>

      {onMobileChange && (
        <Sheet open={mobileOpen} onOpenChange={onMobileChange}>
          <SheetContent side="left" className="w-[280px] p-0">
            <VisuallyHidden asChild><SheetTitle>Navigation</SheetTitle></VisuallyHidden>
            <SidebarInner {...inner} collapsed={false} onNavigate={() => onMobileChange(false)} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
