/**
 * PersonaSidebar5.tsx — 5-Layer Persona Navigation
 *
 * Pass 102. SUPERSEDES PersonaSidebar.tsx (3-layer).
 * Layers: Person → Client → Advisor → Manager → Steward
 * Desktop: collapsible sidebar, Mobile: left-edge drawer (Sheet)
 */

import { useState, useMemo, useCallback } from "react";
import { useDisclosure } from "@/contexts/DisclosureContext";
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
  Key, Webhook, Bot, Globe, Building2, GitMerge,
  LayoutDashboard, UserPlus, HeartPulse, Sparkles,
  Mail, Database, FolderOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type Role = "guest" | "user" | "advisor" | "manager" | "admin";

export interface NavItem {
  label: string;
  icon: any;
  path: string;
  match: string[];
  /** Minimum progressive disclosure level (1-4). Default 1 = always visible. */
  disclosureLevel?: 1 | 2 | 3 | 4;
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
      { label: "AI Studio", icon: Sparkles, path: "/ai", match: ["/ai"], disclosureLevel: 2 },
      { label: "Chat", icon: MessageSquare, path: "/chat", match: ["/chat"] },
      { label: "Code Chat", icon: Terminal, path: "/code-chat", match: ["/code-chat"], disclosureLevel: 4 },
      { label: "Documents", icon: FileText, path: "/settings/knowledge", match: ["/settings/knowledge", "/documents"] },
      { label: "My Progress", icon: BarChart3, path: "/proficiency", match: ["/proficiency"], disclosureLevel: 2 },
      { label: "Audio", icon: Volume2, path: "/settings/audio", match: ["/settings/audio"], disclosureLevel: 2 },
    ],
  },
  {
    key: "client",
    label: "Clients",
    minRole: "user",
    items: [
      { label: "My Financial Twin", icon: Fingerprint, path: "/financial-twin", match: ["/financial-twin"] },
      { label: "Insights", icon: Star, path: "/intelligence-hub", match: ["/intelligence-hub", "/insights"], disclosureLevel: 2 },
      { label: "Suitability", icon: ClipboardList, path: "/settings/suitability", match: ["/settings/suitability", "/suitability"] },
      { label: "Operations", icon: Zap, path: "/operations", match: ["/operations"], disclosureLevel: 2 },
      { label: "Workflows", icon: GitBranch, path: "/workflows", match: ["/workflows"], disclosureLevel: 3 },
      { label: "Client Onboarding", icon: UserPlus, path: "/client-onboarding", match: ["/client-onboarding"], disclosureLevel: 2 },
      { label: "Wealth Engine", icon: Calculator, path: "/calculators", match: ["/calculators", "/wealth-engine", "/engine-dashboard", "/tax-planning", "/estate", "/financial-planning", "/risk-assessment", "/income-projection", "/insurance-analysis", "/social-security", "/medicare", "/protection-score"], disclosureLevel: 2 },
      { label: "Passive Actions", icon: RefreshCw, path: "/passive-actions", match: ["/passive-actions"], disclosureLevel: 3 },
      { label: "Products", icon: Package, path: "/products", match: ["/products"], disclosureLevel: 2 },
      { label: "Integrations", icon: Link2, path: "/integrations", match: ["/integrations"], disclosureLevel: 2 },
      { label: "Community", icon: Users, path: "/community", match: ["/community"], disclosureLevel: 3 },
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
      { label: "Insurance & Apps", icon: FileCheck, path: "/insurance-applications", match: ["/insurance-applications", "/carrier-connector", "/suitability-panel"], disclosureLevel: 3 },
      { label: "Lead Pipeline", icon: Target, path: "/leads", match: ["/leads"], disclosureLevel: 3 },
      { label: "Import Data", icon: Upload, path: "/import", match: ["/import"], disclosureLevel: 3 },
      { label: "Compliance", icon: ShieldCheck, path: "/compliance-audit", match: ["/compliance-audit"], disclosureLevel: 3 },
      { label: "CRM Sync", icon: RefreshCw, path: "/crm-sync", match: ["/crm-sync"], disclosureLevel: 3 },
      { label: "Email Campaigns", icon: Mail, path: "/email-campaigns", match: ["/email-campaigns"], disclosureLevel: 3 },
      { label: "Marketing Assets", icon: FolderOpen, path: "/marketing-assets", match: ["/marketing-assets"], disclosureLevel: 3 },
      { label: "Data Pipelines", icon: Database, path: "/data-pipelines", match: ["/data-pipelines"], disclosureLevel: 3 },
      { label: "Outreach Automation", icon: Zap, path: "/outreach-automation", match: ["/outreach-automation"], disclosureLevel: 3 },
      { label: "Market Data", icon: TrendingUp, path: "/market-data", match: ["/market-data"], disclosureLevel: 2 },
      { label: "Product Intelligence", icon: Lightbulb, path: "/product-intelligence", match: ["/product-intelligence"], disclosureLevel: 3 },
      { label: "Rebalancing", icon: Scale, path: "/rebalancing", match: ["/rebalancing"], disclosureLevel: 3 },
      { label: "Dynamic Integrations", icon: Plug, path: "/dynamic-integrations", match: ["/dynamic-integrations"], disclosureLevel: 4 },
      { label: "Integration Health", icon: HeartPulse, path: "/integration-health", match: ["/integration-health"], disclosureLevel: 3 },
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
      { label: "Platform Admin", icon: Cog, path: "/admin", match: ["/admin"], disclosureLevel: 4 },
      { label: "AI Agents", icon: Bot, path: "/agents", match: ["/agents"], disclosureLevel: 4 },
      { label: "Consensus", icon: GitMerge, path: "/consensus", match: ["/consensus"], disclosureLevel: 4 },
      { label: "AI Intelligence", icon: Brain, path: "/admin/intelligence", match: ["/admin/intelligence"], disclosureLevel: 4 },
      { label: "Improvement", icon: Zap, path: "/admin/improvement", match: ["/admin/improvement"], disclosureLevel: 4 },
      { label: "Improvement Engine", icon: Activity, path: "/admin/improvement-engine", match: ["/admin/improvement-engine", "/improvement"], disclosureLevel: 4 },
      { label: "System Health", icon: Activity, path: "/admin/system-health", match: ["/admin/system-health"], disclosureLevel: 4 },
      { label: "Data Freshness", icon: Activity, path: "/admin/data-freshness", match: ["/admin/data-freshness"], disclosureLevel: 4 },
      { label: "Rate Management", icon: TrendingUp, path: "/admin/rate-management", match: ["/admin/rate-management"], disclosureLevel: 4 },
      { label: "Billing", icon: CreditCard, path: "/admin/billing", match: ["/admin/billing"], disclosureLevel: 4 },
      { label: "API Keys", icon: Key, path: "/admin/api-keys", match: ["/admin/api-keys"], disclosureLevel: 4 },
      { label: "Webhooks", icon: Webhook, path: "/admin/webhooks", match: ["/admin/webhooks"], disclosureLevel: 4 },
      { label: "Team", icon: Users, path: "/admin/team", match: ["/admin/team"], disclosureLevel: 4 },
      { label: "BCP Dashboard", icon: ShieldCheck, path: "/admin/bcp", match: ["/admin/bcp"], disclosureLevel: 4 },
      { label: "Fairness Audit", icon: Scale, path: "/admin/fairness", match: ["/admin/fairness"], disclosureLevel: 4 },
      { label: "Comparables", icon: Compass, path: "/comparables", match: ["/comparables"], disclosureLevel: 3 },
      { label: "Platform Reports", icon: FileText, path: "/admin/platform-reports", match: ["/admin/platform-reports"], disclosureLevel: 4 },
      { label: "Knowledge Base", icon: BookOpen, path: "/admin/knowledge", match: ["/admin/knowledge"], disclosureLevel: 4 },
      { label: "Platform Guide", icon: BookOpen, path: "/admin/guide", match: ["/admin/guide"], disclosureLevel: 4 },
      { label: "Lead Sources", icon: Target, path: "/admin/lead-sources", match: ["/admin/lead-sources"], disclosureLevel: 4 },
      { label: "API Docs", icon: BookOpen, path: "/api-docs", match: ["/api-docs"], disclosureLevel: 3 },
      { label: "Audit Trail", icon: Shield, path: "/admin/audit-trail", match: ["/admin/audit-trail"], disclosureLevel: 4 },
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
  /** True when rendered inside the mobile Sheet drawer */
  isMobile?: boolean;
}

function SidebarInner({ role, collapsed, onCollapse, onNewChat, onSearch, conversations, onNavigate, isMobile = false }: SidebarInnerProps) {
  const [location, navigate] = useLocation();
  const [showConvos, setShowConvos] = useState(true);
  // Pass 44 (C2 Mobile Stability): collapsible layer sections.
  // Layers with 5+ items start collapsed (except the one containing the active route).
  // "person" layer always starts expanded since it's the primary nav.
  const [collapsedLayers, setCollapsedLayers] = useState<Record<string, boolean>>({});
  const roleLevel = ROLE_LEVEL[role];
  const convoGroups = useMemo(() => groupConvos(conversations), [conversations]);
  const { level: disclosureLevel } = useDisclosure();

  // Filter layers by role AND then filter items within each layer by disclosure level
  const visibleLayers = useMemo(() => {
    return PERSONA_LAYERS
      .filter(l => roleLevel >= ROLE_LEVEL[l.minRole])
      .map(l => ({
        ...l,
        items: l.items.filter(item => (item.disclosureLevel ?? 1) <= disclosureLevel),
      }))
      .filter(l => l.items.length > 0);
  }, [roleLevel, disclosureLevel]);

  const toggleLayer = useCallback((key: string) => {
    setCollapsedLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Auto-expand the layer containing the active route
  const activeLayerKey = useMemo(() => {
    for (const layer of visibleLayers) {
      for (const item of layer.items) {
        if (item.match.some(p => location === p || location.startsWith(p + "/"))) {
          return layer.key;
        }
      }
    }
    return null;
  }, [visibleLayers, location]);

  const isLayerCollapsed = useCallback((layer: PersonaLayer) => {
    // Never collapse in icon-only mode
    if (collapsed) return false;
    // "person" layer always expanded
    if (layer.key === "person") return false;
    // Layer containing active route always expanded
    if (layer.key === activeLayerKey) return false;
    // Explicit user toggle takes precedence
    if (collapsedLayers[layer.key] !== undefined) return collapsedLayers[layer.key];
    // Default: collapse layers with 8+ items when there are 3+ visible layers
    return layer.items.length >= 8 && visibleLayers.length >= 3;
  }, [collapsed, activeLayerKey, collapsedLayers, visibleLayers]);

  const isActive = (item: NavItem) =>
    item.match.some(p => location === p || location.startsWith(p + "/"));

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    return (
      <button type="button"
        onClick={() => { navigate(item.path); onNavigate?.(); }}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={`w-full flex items-center gap-2.5 px-2.5 rounded-lg cursor-pointer transition-colors leading-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
          ${isMobile ? "py-[10px] text-[14px] min-h-[44px]" : "py-[7px] text-[13px]"}
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
            <button type="button" onClick={onNewChat} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card/50 cursor-pointer" aria-label="New chat">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onCollapse} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card/50 cursor-pointer" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-2 py-1.5 flex-none">
          <button type="button" onClick={onSearch} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 cursor-pointer transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="ml-auto text-[9px] px-1 py-0.5 rounded bg-card border border-border/60">⌘K</kbd>
          </button>
        </div>
      )}

      <nav aria-label="Main navigation" role="navigation" className="flex-1 overflow-y-auto px-1.5 pb-2">
        {visibleLayers.map(layer => {
          const layerCollapsed = isLayerCollapsed(layer);
          // Pass 107: ALL sections get identical expand/collapse behavior (nav consistency fix)
          const canCollapse = !collapsed && layer.key !== "person" && layer.items.length >= 2;
          return (
            <div key={layer.key}>
              {collapsed ? (
                <Label>{layer.label}</Label>
              ) : canCollapse ? (
                <button type="button"
                  onClick={() => toggleLayer(layer.key)}
                  className="w-full flex items-center justify-between px-2.5 pt-3.5 pb-0.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] select-none cursor-pointer hover:text-muted-foreground transition-colors"
                  aria-expanded={!layerCollapsed}
                  aria-label={`${layer.label} section`}
                >
                  <span>{layer.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${layerCollapsed ? "-rotate-90" : ""}`} />
                </button>
              ) : (
                <Label>{layer.label}</Label>
              )}
              {!layerCollapsed && (
                <div className="space-y-[1px]">
                  {layer.items.map(item => <NavBtn key={item.path} item={item} />)}
                </div>
              )}
              {layerCollapsed && (
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground/30 select-none">
                  {layer.items.length} items
                </div>
              )}
            </div>
          );
        })}

        {roleLevel >= ROLE_LEVEL.user && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <NavBtn item={LEARN_ITEM} />
          </div>
        )}

        {!collapsed && conversations.length > 0 && (
          <section aria-label="Recent conversations" className="mt-3 pt-2 border-t border-border/40">
            <button type="button"
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
                      <button type="button"
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

      {/* Pass 107: Footer items with mobile-friendly touch targets */}
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
            <SidebarInner {...inner} collapsed={false} onNavigate={() => onMobileChange(false)} isMobile />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
