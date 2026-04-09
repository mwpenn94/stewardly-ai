/**
 * AppShell — persistent sidebar navigation wrapper for all non-chat pages.
 *
 * Chat has its own full sidebar with conversation list + nav. Every other
 * authenticated page should be wrapped in AppShell so users always have
 * navigation context and never hit a dead-end.
 *
 * Both AppShell and Chat consume the same shared navigation config from
 * `lib/navigation.ts` so items never drift out of sync.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useCustomShortcuts } from "@/hooks/useCustomShortcuts";
import { prefetchRoute } from "@/lib/routePrefetch";
import { recordPageVisit } from "@/hooks/useRecentPages";
import {
  TOOLS_NAV, ADMIN_NAV, UTILITY_NAV, hasMinRole,
  NAV_SECTION_ORDER, NAV_SECTION_LABELS,
  type NavItemDef, type UserRole, type NavSection,
} from "@/lib/navigation";
import {
  MessageSquare, Zap, Brain, Package, Users, TrendingUp, FileText,
  Link2, HeartPulse, RefreshCw, Activity, Briefcase, Building2,
  BarChart3, Globe, Wrench, HelpCircle, Settings, LogIn, LogOut,
  Menu, X, ChevronDown, Keyboard, BookOpen,
  GraduationCap, Sparkles, Shield, Bot, Terminal,
  Calculator, LayoutDashboard, Users2, Database, Target, Search,
} from "lucide-react";

// ─── Icon lookup ─────────────────────────────────────────────────────────────
// Pass 83: added Calculator, LayoutDashboard, Users2, Database, Target,
// Search (used by the new Command Palette trigger at the top of the sidebar).
// Previously these fell back to the default Zap icon, which made Engine
// Dashboard / Client Dashboard / Community / Data Freshness / Lead Sources
// all show the same generic icon in the sidebar — a silent rendering bug.
const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Brain: <Brain className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Link2: <Link2 className="w-4 h-4" />,
  HeartPulse: <HeartPulse className="w-4 h-4" />,
  RefreshCw: <RefreshCw className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
  Building2: <Building2 className="w-4 h-4" />,
  BarChart3: <BarChart3 className="w-4 h-4" />,
  Globe: <Globe className="w-4 h-4" />,
  Wrench: <Wrench className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
  HelpCircle: <HelpCircle className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  GraduationCap: <GraduationCap className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Bot: <Bot className="w-4 h-4" />,
  Terminal: <Terminal className="w-4 h-4" />,
  Calculator: <Calculator className="w-4 h-4" />,
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  Users2: <Users2 className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Target: <Target className="w-4 h-4" />,
};

function getIcon(name: string): React.ReactNode {
  return ICON_MAP[name] ?? <Zap className="w-4 h-4" />;
}

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in the mobile header bar */
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useKeyboardShortcuts(); // Global shortcuts: ?, /, g+h, g+s, g+c, g+d, g+l, g+o
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("appshell-collapsed") === "true"; } catch { return false; }
  });

  // Collapsible nav sections — matching Chat sidebar pattern
  const [navExpanded, setNavExpanded] = useState(() => {
    try { const v = localStorage.getItem("appshell-nav-expanded"); return v === "true"; } catch { return false; }
  });
  const [adminExpanded, setAdminExpanded] = useState(() => {
    try { const v = localStorage.getItem("appshell-admin-expanded"); return v === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("appshell-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);
  useEffect(() => {
    try { localStorage.setItem("appshell-nav-expanded", String(navExpanded)); } catch {}
  }, [navExpanded]);
  useEffect(() => {
    try { localStorage.setItem("appshell-admin-expanded", String(adminExpanded)); } catch {}
  }, [adminExpanded]);

  // Close mobile sidebar on navigation + record page visit for command palette
  useEffect(() => {
    setMobileOpen(false);
    recordPageVisit(location);
  }, [location]);

  // ─── Mobile swipe gesture to open/close sidebar ────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const SWIPE_THRESHOLD = 50; // minimum px to count as swipe
  const EDGE_ZONE = 30; // px from left edge to start open-swipe

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    const startX = touchStartRef.current.x;
    touchStartRef.current = null;

    // Must be more horizontal than vertical and fast enough
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx) || elapsed > 500) return;

    if (dx > 0 && startX < EDGE_ZONE && !mobileOpen) {
      // Swipe right from left edge → open
      setMobileOpen(true);
    } else if (dx < 0 && mobileOpen) {
      // Swipe left while open → close
      setMobileOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    // Only attach on mobile-sized screens
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // G-then-X keyboard navigation — uses custom shortcuts from Settings
  // Default navigation targets: "/chat", "/operations", "/intelligence-hub",
  // "/advisory", "/relationships", "/market-data", "/documents",
  // "/integrations", "/settings/profile", "/help"
  const { shortcutMap } = useCustomShortcuts();
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;
      if (!isInput && !isMod && !e.shiftKey) {
        if (e.key.toLowerCase() === "g") {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => { gPressedRef.current = false; }, 800);
          return;
        }
        if (gPressedRef.current) {
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          const route = shortcutMap.get(e.key.toLowerCase());
          if (route) {
            e.preventDefault();
            navigate(route);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [navigate, shortcutMap]);

  const userRole = (user as any)?.role || "user";

  const visibleTools = TOOLS_NAV.filter(i => hasMinRole(userRole, i.minRole));
  const visibleAdmin = ADMIN_NAV.filter(i => hasMinRole(userRole, i.minRole));

  function isActive(href: string) {
    if (href === "/chat") return location === "/chat" || location.startsWith("/chat/");
    if (href === "/settings/profile") return location.startsWith("/settings");
    return location === href || location.startsWith(href + "/");
  }

  /** Render a single nav item — collapsed (icon-only with tooltip) or expanded */
  function renderNavItem(item: NavItemDef) {
    const active = isActive(item.href);
    const icon = getIcon(item.iconName);
    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate(item.href)}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              className={`flex items-center justify-center w-full p-2 rounded-lg transition-colors ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <button
        key={item.href}
        onClick={() => navigate(item.href)}
        onMouseEnter={() => prefetchRoute(item.href)}
        onFocus={() => prefetchRoute(item.href)}
        className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
          active
            ? "bg-accent/15 text-accent font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
      >
        {icon}
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  /**
   * Pass 83: render the 19-item TOOLS_NAV as 5 semantic sections
   * (Home / Work / Intelligence / Relationships / Learning). Items
   * without a section are still rendered at the top so nothing gets
   * dropped if a new nav entry is added without a section field.
   * When the sidebar is collapsed, section headers are replaced with
   * a thin divider so the icon rail stays compact.
   */
  function renderSectionedTools(items: NavItemDef[]) {
    if (collapsed) {
      // Collapsed rail: group items by section but show dividers not headers
      const out: React.ReactNode[] = [];
      const unsectioned = items.filter((i) => !i.section);
      out.push(...unsectioned.map(renderNavItem));
      for (const section of NAV_SECTION_ORDER) {
        const inSection = items.filter((i) => i.section === section);
        if (inSection.length === 0) continue;
        if (out.length > 0) out.push(<div key={`div-${section}`} className="my-1 border-t border-border/40" />);
        out.push(...inSection.map(renderNavItem));
      }
      return out;
    }
    // Expanded: render section headers between groups
    const out: React.ReactNode[] = [];
    const unsectioned = items.filter((i) => !i.section);
    out.push(...unsectioned.map(renderNavItem));
    for (const section of NAV_SECTION_ORDER) {
      const inSection = items.filter((i) => i.section === section);
      if (inSection.length === 0) continue;
      out.push(
        <div
          key={`hdr-${section}`}
          className="px-2.5 pt-3 pb-1 text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold"
        >
          {NAV_SECTION_LABELS[section as NavSection]}
        </div>,
      );
      out.push(...inSection.map(renderNavItem));
    }
    return out;
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className={`flex items-center border-b border-border shrink-0 ${collapsed ? "p-2 justify-center h-14" : "px-3 py-3 gap-2 h-14"}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 flex items-center justify-center hover:bg-accent/10 rounded-lg transition-colors shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663357378777/GaKEFERPH576tbv5NzvkMD/stewardly-logo-v3-naY7aeUkrMxcG3ificpKX6.webp"
            alt="Stewardly"
            className="h-6 w-6 rounded"
          />
        </button>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight truncate">Stewardly</span>
        )}
      </div>

      {/* Pass 83: visible Command Palette trigger — the Ctrl+K shortcut
          already opens it, but discoverable affordance is missing. Clicking
          dispatches the same `toggle-command-palette` CustomEvent the
          keyboard shortcut handler uses. Collapsed state shows just a
          search icon with tooltip; expanded state shows a button styled
          like a search field with the ⌘K hint. */}
      {collapsed ? (
        <div className="p-1 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
                aria-label="Open Command Palette"
                className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Search (⌘K)</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="px-2 pt-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
            aria-label="Open Command Palette"
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors text-[12px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="font-mono text-[10px] text-muted-foreground/70 bg-background/60 border border-border/60 rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation — collapsible sections */}
      <ScrollArea className="flex-1">
        <div className={collapsed ? "p-1 space-y-0.5" : "p-2 space-y-0.5"}>
          {/* NAVIGATE section — collapsible */}
          {!collapsed ? (
            <button
              onClick={() => setNavExpanded(!navExpanded)}
              className="flex items-center justify-between w-full px-2 pt-2 pb-1 group"
            >
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                Navigate
              </span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 ${navExpanded ? "" : "-rotate-90"}`} />
            </button>
          ) : null}
          {(collapsed || navExpanded) && renderSectionedTools(visibleTools)}

          {/* ADMIN section — collapsible */}
          {visibleAdmin.length > 0 && (
            <>
              {!collapsed ? (
                <button
                  onClick={() => setAdminExpanded(!adminExpanded)}
                  className="flex items-center justify-between w-full px-2 pt-3 pb-1 group"
                >
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                    Admin
                  </span>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 ${adminExpanded ? "" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="my-1 border-t border-border/50" />
              )}
              {(collapsed || adminExpanded) && visibleAdmin.map(renderNavItem)}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Bottom utility links — always visible */}
      <div className="border-t border-border/50 shrink-0">
        <div className={collapsed ? "p-1 space-y-0.5" : "p-2 space-y-0.5"}>
          {collapsed ? (
            <>
              {UTILITY_NAV.map(item => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                      className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {getIcon(item.iconName)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))}
            </>
          ) : (
            <>
              {UTILITY_NAV.map(item => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                    isActive(item.href)
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {getIcon(item.iconName)}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
              <div className="mt-1 px-2.5 py-1">
                <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  Press <kbd className="px-1 py-0.5 rounded bg-secondary/60 text-[9px] font-mono">?</kbd> for shortcuts
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-border shrink-0">
        {user?.authTier === "anonymous" ? (
          <div className={collapsed ? "p-2 flex justify-center" : "px-3 py-2.5"}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => window.location.href = getLoginUrl()}
                    className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign in</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => window.location.href = getLoginUrl()}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
          </div>
        ) : (
          <div className={`flex items-center ${collapsed ? "justify-center p-2" : "gap-2 px-3 py-2.5"}`}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent cursor-pointer"
                    onClick={() => setCollapsed(false)}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{user?.name || "User"}</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs truncate block">{user?.name || "User"}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{userRole}</span>
                </div>
                <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground shrink-0" title="Sign out">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — desktop: always visible, mobile: overlay */}
      <aside className={`
        fixed lg:relative z-50 h-full bg-card border-r border-border
        transition-all duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${collapsed ? "w-14" : "w-56"}
      `}>
        {/* Mobile close button */}
        <button
          className="absolute top-3 right-3 lg:hidden z-10 p-1 rounded-md hover:bg-secondary/50"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header bar */}
        <div className="lg:hidden flex items-center h-12 px-3 shrink-0 border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </Button>
          {title && <span className="text-sm font-medium truncate ml-2">{title}</span>}
        </div>

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
