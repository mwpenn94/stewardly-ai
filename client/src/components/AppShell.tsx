/**
 * AppShell — persistent sidebar navigation wrapper for all non-chat pages.
 *
 * Chat has its own full sidebar with conversation list + nav. Every other
 * authenticated page should be wrapped in AppShell so users always have
 * navigation context and never hit a dead-end.
 *
 * The sidebar mirrors the same nav items from Chat's "Tools" and "Admin"
 * sections, plus Help and Settings links.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { prefetchRoute } from "@/lib/routePrefetch";
import {
  MessageSquare, Zap, Brain, Package, Users, TrendingUp, FileText,
  Link2, HeartPulse, RefreshCw, Activity, Briefcase, Building2,
  BarChart3, Globe, Wrench, HelpCircle, Settings, LogIn, LogOut,
  Menu, X, ChevronLeft, ChevronRight, PanelLeftClose, Keyboard,
} from "lucide-react";

type UserRole = "user" | "advisor" | "manager" | "admin";
const ROLE_HIERARCHY: Record<UserRole, number> = { user: 0, advisor: 1, manager: 2, admin: 3 };
function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole as UserRole ?? "user"] >= ROLE_HIERARCHY[minRole];
}

type NavItem = { icon: React.ReactNode; label: string; href: string; minRole: UserRole };

const TOOLS_NAV: NavItem[] = [
  { icon: <MessageSquare className="w-4 h-4" />, label: "Chat", href: "/chat", minRole: "user" },
  { icon: <Zap className="w-4 h-4" />, label: "Operations", href: "/operations", minRole: "user" },
  { icon: <Brain className="w-4 h-4" />, label: "Intelligence", href: "/intelligence-hub", minRole: "user" },
  { icon: <Package className="w-4 h-4" />, label: "Advisory", href: "/advisory", minRole: "user" },
  { icon: <Users className="w-4 h-4" />, label: "Relationships", href: "/relationships", minRole: "user" },
  { icon: <TrendingUp className="w-4 h-4" />, label: "Market Data", href: "/market-data", minRole: "user" },
  { icon: <FileText className="w-4 h-4" />, label: "Documents", href: "/documents", minRole: "user" },
  { icon: <Link2 className="w-4 h-4" />, label: "Integrations", href: "/integrations", minRole: "user" },
  { icon: <HeartPulse className="w-4 h-4" />, label: "Integration Health", href: "/integration-health", minRole: "advisor" },
  { icon: <RefreshCw className="w-4 h-4" />, label: "Passive Actions", href: "/passive-actions", minRole: "user" },
  { icon: <Activity className="w-4 h-4" />, label: "My Progress", href: "/proficiency", minRole: "user" },
];

const ADMIN_NAV: NavItem[] = [
  { icon: <Briefcase className="w-4 h-4" />, label: "Portal", href: "/portal", minRole: "advisor" },
  { icon: <Building2 className="w-4 h-4" />, label: "Organizations", href: "/organizations", minRole: "advisor" },
  { icon: <BarChart3 className="w-4 h-4" />, label: "Manager Dashboard", href: "/manager", minRole: "manager" },
  { icon: <Globe className="w-4 h-4" />, label: "Global Admin", href: "/admin", minRole: "admin" },
  { icon: <Wrench className="w-4 h-4" />, label: "Improvement Engine", href: "/improvement", minRole: "advisor" },
];

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in the mobile header bar */
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("appshell-collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("appshell-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [location]);

  // G-then-X keyboard navigation (mirrors Chat.tsx shortcuts)
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
          const k = e.key.toLowerCase();
          if (k === "c") { e.preventDefault(); navigate("/chat"); return; }
          if (k === "o") { e.preventDefault(); navigate("/operations"); return; }
          if (k === "i") { e.preventDefault(); navigate("/intelligence-hub"); return; }
          if (k === "a") { e.preventDefault(); navigate("/advisory"); return; }
          if (k === "r") { e.preventDefault(); navigate("/relationships"); return; }
          if (k === "m") { e.preventDefault(); navigate("/market-data"); return; }
          if (k === "d") { e.preventDefault(); navigate("/documents"); return; }
          if (k === "n") { e.preventDefault(); navigate("/integrations"); return; }
          if (k === "s") { e.preventDefault(); navigate("/settings/profile"); return; }
          if (k === "h") { e.preventDefault(); navigate("/help"); return; }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [navigate]);

  const userRole = (user as any)?.role || "user";

  const visibleTools = TOOLS_NAV.filter(i => hasMinRole(userRole, i.minRole));
  const visibleAdmin = ADMIN_NAV.filter(i => hasMinRole(userRole, i.minRole));

  function isActive(href: string) {
    if (href === "/chat") return location === "/chat" || location.startsWith("/chat/");
    return location === href || location.startsWith(href + "/");
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

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className={collapsed ? "p-1 space-y-0.5" : "p-2 space-y-0.5"}>
          {/* Tools section */}
          {!collapsed && (
            <p className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Navigate
            </p>
          )}
          {visibleTools.map(item => {
            const active = isActive(item.href);
            return collapsed ? (
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
                    {item.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                  active
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Admin section */}
          {visibleAdmin.length > 0 && (
            <>
              <Separator className="my-2" />
              {!collapsed && (
                <p className="px-2 pt-1 pb-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                  Admin
                </p>
              )}
              {visibleAdmin.map(item => {
                const active = isActive(item.href);
                return collapsed ? (
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
                        {item.icon}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                      active
                        ? "bg-accent/15 text-accent font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Utility links */}
          <Separator className="my-2" />
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => navigate("/help")} onMouseEnter={() => prefetchRoute("/help")} onFocus={() => prefetchRoute("/help")} className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Help & Support</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => navigate("/settings/profile")} onMouseEnter={() => prefetchRoute("/settings/profile")} onFocus={() => prefetchRoute("/settings/profile")} className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button onClick={() => navigate("/help")} onMouseEnter={() => prefetchRoute("/help")} onFocus={() => prefetchRoute("/help")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                <HelpCircle className="w-4 h-4" /> Help & Support
              </button>
              <button onClick={() => navigate("/settings/profile")} onMouseEnter={() => prefetchRoute("/settings/profile")} onFocus={() => prefetchRoute("/settings/profile")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <div className="mt-1 px-2.5 py-1.5">
                <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  Press <kbd className="px-1 py-0.5 rounded bg-secondary/60 text-[9px] font-mono">?</kbd> for shortcuts
                </p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

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
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)}>
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
