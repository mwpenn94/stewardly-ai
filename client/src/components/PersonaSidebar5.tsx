/**
 * PersonaSidebar5.tsx — Streamlined Hub Navigation
 *
 * Pass 130: Simplified from 6 persona layers to a flat, clean sidebar.
 * Inspired by Manus/Claude: minimal top-level items, each leading to
 * a hub page with its own internal navigation.
 *
 * Removed: Capabilities section (System Status → Settings), Documents (→ Settings),
 * My Work (→ Wealth Engine overview). Products nested inside Wealth Engine.
 *
 * Desktop: collapsible sidebar, Mobile: left-edge drawer (Sheet)
 */

import { useState, useMemo } from "react";
import { useDisclosure } from "@/contexts/DisclosureContext";
import { useLocation } from "wouter";
import {
  MessageSquare, Calculator, Users, TrendingUp,
  GraduationCap, Settings, HelpCircle, Search, Plus,
  PanelLeftClose, PanelLeft, ChevronDown, Pin,
  Cog, UserCog, Building2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslation } from "react-i18next";
import { useNavBadges, formatBadgeCount, type BadgeInfo } from "@/hooks/useNavBadges";

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
 * Pass 130: Flat, streamlined navigation.
 * - Core: Chat only (Documents moved to Settings)
 * - Wealth: Wealth Engine (Financial Twin, Products, all calculators nested inside)
 * - Professional: People (CRM hub), Intelligence
 * - Leadership: Team, Organizations (progressive disclosure)
 * - Platform: Admin (progressive disclosure)
 * - Learn: standalone item
 */
export const PERSONA_LAYERS: PersonaLayer[] = [
  {
    key: "core",
    label: "",
    minRole: "guest",
    items: [
      { label: "Chat", icon: MessageSquare, path: "/chat", match: ["/chat", "/code-chat"] },
    ],
  },
  {
    key: "wealth",
    label: "Wealth",
    minRole: "user",
    items: [
      {
        label: "Wealth Engine", icon: Calculator, path: "/wealth-engine",
        match: ["/wealth-engine", "/calculators", "/engine-dashboard", "/tax-planning", "/estate", "/financial-planning", "/risk-assessment", "/income-projection", "/insurance-analysis", "/social-security", "/medicare", "/protection-score", "/my-plan", "/financial-twin", "/products", "/my-work", "/tax-projector", "/insurance-applications", "/advisory-execution", "/carrier-connector", "/suitability-panel", "/sovereign-study", "/mv-dashboard"],
      },
    ],
  },
  {
    key: "professional",
    label: "Professional",
    minRole: "advisor",
    items: [
      {
        label: "People", icon: Users, path: "/people/clients",
        match: ["/people", "/relationships", "/leads", "/crm-sync", "/compliance-audit", "/compliance-copilot", "/email-campaigns", "/marketing-assets", "/outreach-automation", "/command-center", "/client-onboarding", "/annual-review", "/business-exit", "/premium-finance-rates", "/portal", "/client-dashboard", "/passive-actions", "/proficiency", "/community", "/documents"],
      },
      {
        label: "Intelligence", icon: TrendingUp, path: "/intelligence-hub",
        match: ["/intelligence-hub", "/intelligence", "/market-data", "/product-intelligence", "/data-pipelines", "/enrichment-admin", "/portal-analytics", "/rebalancing", "/insights", "/operations", "/comparables", "/workflow-automation", "/workflows", "/dynamic-integrations", "/integration-health"],
      },
    ],
  },
  {
    key: "leadership",
    label: "Leadership",
    minRole: "manager",
    items: [
      { label: "Team", icon: UserCog, path: "/manager", match: ["/manager"], disclosureLevel: 2 },
      { label: "Organizations", icon: Building2, path: "/organizations", match: ["/organizations", "/org-branding"], disclosureLevel: 2 },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    minRole: "admin",
    items: [
      { label: "Admin", icon: Cog, path: "/admin", match: ["/admin", "/agents", "/consensus", "/admin/intelligence", "/admin/improvement", "/admin/improvement-engine", "/admin/system-health", "/admin/data-freshness", "/admin/bcp", "/admin/fairness", "/admin/rate-management", "/admin/billing", "/admin/api-keys", "/admin/webhooks", "/admin/team", "/admin/lead-sources", "/admin/platform-reports", "/admin/knowledge", "/admin/guide", "/admin/audit-trail", "/admin/integrations", "/admin-legacy", "/api-docs", "/manus-next", "/my-integrations", "/integrations", "/import"], disclosureLevel: 3 },
    ],
  },
];

const LEARN_ITEM: NavItem = {
  label: "Learn", icon: GraduationCap, path: "/learning",
  match: ["/learning", "/learning/tracks", "/learning/exam", "/learning/discipline", "/learning/case", "/learning/connections", "/learning/achievements", "/learning/licenses", "/learning/studio", "/learning/review", "/learning/search", "/learning/flashcards", "/learning/quiz", "/learning/hands-free", "/learning/ai-quiz", "/learning/formula-lab", "/learning/analytics", "/learning/export", "/learning/bookmarks", "/learning/playlists", "/learning/groups", "/learning/discovery"],
};

const FOOTER_ITEMS: NavItem[] = [
  { label: "Settings", icon: Settings, path: "/settings", match: ["/settings", "/ai-settings"] },
  { label: "Help", icon: HelpCircle, path: "/help", match: ["/help", "/changelog"] },
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
  const { t } = useTranslation();
  const badges = useNavBadges();

  /** Resolve badge for a nav item by checking its path and match paths */
  const getBadge = (item: NavItem): BadgeInfo | undefined => {
    // Direct path match
    const direct = badges.get(item.path);
    if (direct) return direct;
    // Check match paths (e.g., /learning matches /learning/review)
    for (const m of item.match) {
      const b = badges.get(m);
      if (b) return b;
    }
    return undefined;
  };

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
    const badge = getBadge(item);
    return (
      <button type="button"
        onClick={() => { navigate(item.path); onNavigate?.(); }}
        aria-current={active ? "page" : undefined}
        aria-label={badge ? `${item.label} (${badge.count} unread)` : item.label}
        className={`group w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
          ${isMobile ? "py-3 text-[14px] min-h-[44px] px-3" : "py-2 text-[13px] px-3"}
          ${active ? "bg-primary/12 text-primary font-medium border border-primary/25 shadow-sm shadow-primary/5" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-card/50 border border-transparent hover:border-border/40"}
          ${collapsed ? "justify-center px-2" : ""}`}
        title={collapsed ? (badge ? `${item.label} (${badge.count})` : item.label) : undefined}
      >
        <span className="relative flex-none">
          <item.icon className={`w-4 h-4 transition-colors duration-150 ${active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"}`} />
          {badge && collapsed && (
            <span className={`absolute -top-1 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold rounded-full
              ${badge.variant === "urgent" ? "bg-destructive text-destructive-foreground animate-pulse" : badge.variant === "count" ? "bg-primary text-primary-foreground" : "bg-muted-foreground"}
              ${badge.variant === "dot" ? "w-[7px] h-[7px] min-w-0" : "px-[3px]"}`}
              aria-hidden="true"
            >
              {badge.variant !== "dot" && formatBadgeCount(badge.count)}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {badge && (
              <span className={`flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-semibold rounded-full ml-auto flex-none
                ${badge.variant === "urgent" ? "bg-destructive text-destructive-foreground animate-pulse" : badge.variant === "count" ? "bg-primary/15 text-primary" : "bg-muted-foreground/20 text-muted-foreground"}
                ${badge.variant === "dot" ? "w-[8px] h-[8px] min-w-0 bg-muted-foreground/50" : "px-1"}`}
                aria-hidden="true"
              >
                {badge.variant !== "dot" && formatBadgeCount(badge.count)}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  const Label = ({ children }: { children: string }) =>
    !children || collapsed ? null : (
      <div className="px-3 pt-4 pb-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider select-none">
        {children}
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-[52px] flex-none border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-[16px] font-extrabold tracking-tight bg-gradient-to-r from-primary via-primary/90 to-primary/60 bg-clip-text text-transparent">Stewardly<span className="inline-block w-1.5 h-1.5 rounded-full bg-primary ml-0.5 mb-2"></span></span>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <button type="button" onClick={onNewChat} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" aria-label={t("nav.newConversation")}>
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onCollapse} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" aria-label={collapsed ? t("a11y.expandSidebar") : t("a11y.collapseSidebar")}>
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2 flex-none">
          <button type="button" onClick={onSearch} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card/40 border border-border/40 text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-card/60 hover:border-border/60 transition-all duration-200">
            <Search className="w-3.5 h-3.5 flex-none" />
            <span>{t("common.search")}</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar border border-sidebar-border font-mono">⌘K</kbd>
          </button>
        </div>
      )}

      <nav aria-label="Main navigation" role="navigation" className="flex-1 overflow-y-auto px-2 pb-2 scroll-mask">
        {visibleLayers.map(layer => (
          <div key={layer.key}>
            <Label>{layer.label}</Label>
            <div className="space-y-0.5">
              {layer.items.map(item => <NavBtn key={item.path} item={item} />)}
            </div>
          </div>
        ))}

        {roleLevel >= ROLE_LEVEL.user && (
          <div className="mt-3 pt-2 border-t border-sidebar-border/50">
            <NavBtn item={LEARN_ITEM} />
          </div>
        )}

        {!collapsed && conversations.length > 0 && (
          <section aria-label="Recent conversations" className="mt-4 pt-2 border-t border-sidebar-border/50">
            <button type="button"
              onClick={() => setShowConvos(!showConvos)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider cursor-pointer hover:text-muted-foreground transition-colors w-full select-none"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showConvos ? "" : "-rotate-90"}`} />
              Conversations
            </button>
            {showConvos && (
              <div className="mt-1 space-y-0.5 max-h-[35vh] overflow-y-auto scroll-mask">
                {convoGroups.map(g => (
                  <div key={g.label}>
                    <div className="px-3 py-1 text-[10px] text-muted-foreground/40 select-none font-medium">{g.label}</div>
                    {g.items.map(c => (
                      <button type="button"
                        key={c.id}
                        onClick={() => { navigate(`/chat/${c.id}`); onNavigate?.(); }}
                        className={`w-full flex items-center gap-1.5 px-3 py-[6px] rounded-lg transition-colors text-[12px] text-left truncate
                          ${location === `/chat/${c.id}` ? "bg-sidebar-accent text-sidebar-foreground" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
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

      <div className="px-2 py-2 border-t border-sidebar-border flex-none space-y-0.5">
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
      <aside className={`hidden md:flex flex-col h-screen border-r border-sidebar-border bg-sidebar flex-none transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[52px]" : "w-[240px]"}`}>
        <SidebarInner {...inner} />
      </aside>

      {onMobileChange && (
        <Sheet open={mobileOpen} onOpenChange={onMobileChange}>
          <SheetContent side="left" className="w-[280px] p-0 border-r border-sidebar-border">
            <VisuallyHidden asChild><SheetTitle>Navigation</SheetTitle></VisuallyHidden>
            <SidebarInner {...inner} collapsed={false} onNavigate={() => onMobileChange(false)} isMobile />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
