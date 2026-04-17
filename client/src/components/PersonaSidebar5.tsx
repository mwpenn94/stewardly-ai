/**
 * PersonaSidebar5.tsx — Simplified Hub Navigation
 *
 * Pass 111: Reduced from 60+ items across 5 persona layers to ~10 hub entries.
 * Each hub (People, Intelligence, Admin) has its own internal sidebar page.
 * The AppShell sidebar is now simple and delightful to navigate.
 *
 * Desktop: collapsible sidebar, Mobile: left-edge drawer (Sheet)
 */

import { useState, useMemo, useCallback } from "react";
import { useDisclosure } from "@/contexts/DisclosureContext";
import { useLocation } from "wouter";
import {
  MessageSquare, FileText, Calculator, Users, TrendingUp,
  GraduationCap, Settings, HelpCircle, Search, Plus,
  PanelLeftClose, PanelLeft, ChevronDown, Pin,
  Fingerprint, Cog, Briefcase, UserCog, Building2,
  Sparkles, Package, Star,
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

/** A sub-group nests related items under a collapsible header */
export interface NavSubGroup {
  label: string;
  icon: any;
  items: NavItem[];
  disclosureLevel?: 1 | 2 | 3 | 4;
}

export interface PersonaLayer {
  key: string;
  label: string;
  minRole: Role;
  items: NavItem[];
  subGroups?: NavSubGroup[];
}

export const ROLE_LEVEL: Record<Role, number> = {
  guest: 0, user: 1, advisor: 2, manager: 3, admin: 4,
};

/**
 * Simplified hub-based navigation.
 * Each entry is a top-level page or hub with its own internal sidebar.
 */
export const PERSONA_LAYERS: PersonaLayer[] = [
  {
    key: "core",
    label: "Core",
    minRole: "guest",
    items: [
      { label: "Chat", icon: MessageSquare, path: "/chat", match: ["/chat"] },
      { label: "Documents", icon: FileText, path: "/settings/knowledge", match: ["/settings/knowledge", "/documents"], disclosureLevel: 2 },
    ],
  },
  {
    key: "wealth",
    label: "Wealth",
    minRole: "user",
    items: [
      { label: "Financial Twin", icon: Fingerprint, path: "/financial-twin", match: ["/financial-twin"] },
      { label: "Wealth Engine", icon: Calculator, path: "/calculators", match: ["/calculators", "/wealth-engine", "/engine-dashboard", "/tax-planning", "/estate", "/financial-planning", "/risk-assessment", "/income-projection", "/insurance-analysis", "/social-security", "/medicare", "/protection-score", "/my-plan"] },
      { label: "Products", icon: Package, path: "/products", match: ["/products"], disclosureLevel: 2 },
    ],
  },
  {
    key: "professional",
    label: "Professional",
    minRole: "advisor",
    items: [
      { label: "My Work", icon: Briefcase, path: "/my-work", match: ["/my-work"] },
      { label: "People", icon: Users, path: "/people/clients", match: ["/people", "/relationships", "/leads", "/crm-sync", "/compliance-audit", "/compliance-copilot", "/email-campaigns", "/marketing-assets", "/outreach-automation", "/command-center", "/client-onboarding", "/annual-review", "/business-exit", "/premium-finance-rates", "/portal", "/client-dashboard"] },
      { label: "Intelligence", icon: TrendingUp, path: "/intelligence-hub", match: ["/intelligence-hub", "/intelligence", "/market-data", "/product-intelligence", "/data-pipelines", "/enrichment-admin", "/portal-analytics", "/rebalancing", "/insights", "/operations", "/comparables"] },
    ],
  },
  {
    key: "leadership",
    label: "Leadership",
    minRole: "manager",
    items: [
      { label: "Team", icon: UserCog, path: "/manager", match: ["/manager"], disclosureLevel: 3 },
      { label: "Organizations", icon: Building2, path: "/organizations", match: ["/organizations", "/org-branding"], disclosureLevel: 3 },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    minRole: "admin",
    items: [
      { label: "Admin", icon: Cog, path: "/admin", match: ["/admin", "/agents", "/consensus", "/admin/intelligence", "/admin/improvement", "/admin/improvement-engine", "/admin/system-health", "/admin/data-freshness", "/admin/bcp", "/admin/fairness", "/admin/rate-management", "/admin/billing", "/admin/api-keys", "/admin/webhooks", "/admin/team", "/admin/lead-sources", "/admin/platform-reports", "/admin/knowledge", "/admin/guide", "/admin/audit-trail", "/admin/integrations"], disclosureLevel: 4 },
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
  isMobile?: boolean;
}

function SidebarInner({ role, collapsed, onCollapse, onNewChat, onSearch, conversations, onNavigate, isMobile = false }: SidebarInnerProps) {
  const [location, navigate] = useLocation();
  const [showConvos, setShowConvos] = useState(true);
  const roleLevel = ROLE_LEVEL[role];
  const convoGroups = useMemo(() => groupConvos(conversations), [conversations]);
  const { level: disclosureLevel } = useDisclosure();

  // Filter layers by role AND disclosure level
  const visibleLayers = useMemo(() => {
    return PERSONA_LAYERS
      .filter(l => roleLevel >= ROLE_LEVEL[l.minRole])
      .map(l => ({
        ...l,
        items: l.items.filter(item => (item.disclosureLevel ?? 1) <= disclosureLevel),
      }))
      .filter(l => l.items.length > 0);
  }, [roleLevel, disclosureLevel]);

  const isActive = (item: NavItem) =>
    item.match.some(p => location === p || location.startsWith(p + "/"));

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    return (
      <button type="button"
        onClick={() => { navigate(item.path); onNavigate?.(); }}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={`w-full flex items-center gap-2.5 rounded-lg cursor-pointer transition-colors leading-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
          px-2.5
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
