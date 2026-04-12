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
import PersonaSidebar5 from "@/components/PersonaSidebar5";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFocusOnRouteChange } from "@/hooks/useFocusOnRouteChange";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useCustomShortcuts } from "@/hooks/useCustomShortcuts";
import { recordPageVisit } from "@/hooks/useRecentPages";
// Build Loop Pass 9 (G56): the old nav import block, ICON_MAP, getIcon,
// and ~300 lines of sidebarContent / renderNavItem / renderSectionedTools
// were deleted because PersonaSidebar5 fully replaces them. AppShell now
// imports only what it actually renders (mobile header, bottom tab bar,
// skip-link, persona sidebar, bottom-banner).
import { MessageSquare, Brain, Menu, Calculator, GraduationCap } from "lucide-react";

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
  // Build Loop Pass 3 (G60 — WCAG 2.4.3 focus order): on every route
  // change, focus the #main-content element AND fire an aria-live
  // announcement of the new page name. Keyboard + SR users now get a
  // spoken "Clients" / "Compliance Audit" marker when they navigate via
  // g-chord, sidebar click, or deep link. Defers the focus call to
  // requestAnimationFrame so the new route has actually mounted.
  useFocusOnRouteChange({ mainId: "main-content" });

  // Auto-propagate title to browser tab
  useEffect(() => {
    if (title) {
      const suffix = " | Stewardly AI";
      document.title = title.includes("Stewardly") ? title : `${title}${suffix}`;
    }
  }, [title]);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("appshell-collapsed") === "true"; } catch { return false; }
  });

  // Collapsible nav sections — Pass 90: default to EXPANDED so first-time
  // users actually see the sectioned navigation. Previously these defaulted
  // to `false`, which meant new visitors saw "Navigate ▶ / Admin ▶" with
  // zero items visible — the worst of both worlds. Power users who want
  // a tighter sidebar can still collapse it; the choice persists in
  // localStorage.
  const [navExpanded, setNavExpanded] = useState(() => {
    try { const v = localStorage.getItem("appshell-nav-expanded"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [adminExpanded, setAdminExpanded] = useState(() => {
    try { const v = localStorage.getItem("appshell-admin-expanded"); return v === null ? true : v === "true"; } catch { return true; }
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
      // Pass 8 (G63): the `useKeyboardShortcuts` hook also attaches a
      // window keydown listener. Either handler can fire first; skip
      // if the other already consumed the event.
      if (e.defaultPrevented) return;
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

  // Build Loop Pass 9 (G56): `sidebarContent` / `renderNavItem` /
  // `renderSectionedTools` / `visibleTools` / `visibleAdmin` /
  // `isActive` / `ICON_MAP` / `getIcon` were all dead code after
  // Pass 136 replaced the old flat sidebar with `<PersonaSidebar5>`.
  // ~300 lines of unreachable JSX the bundler was still shipping.
  // Deleted outright in Pass 9.


  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Pass 91 (Target 7 / WCAG 2.4.1): skip-to-content link.
          Hidden visually until it receives focus, then jumps over the
          sidebar nav directly to the main content. First focusable
          element on every AppShell-wrapped page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-accent-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        Skip to main content
      </a>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Pass 136: PersonaSidebar5 — 5-layer persona navigation.
          Replaces the old flat sidebar with role-aware persona layers.
          Falls back to the old sidebarContent for the inner nav items
          while PersonaSidebar5 handles the structural shell. */}
      <PersonaSidebar5
        role={userRole === "steward" ? "admin" : (userRole as any) || "user"}
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        onNewChat={() => navigate("/chat")}
        onSearch={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
        mobileOpen={mobileOpen}
        onMobileChange={setMobileOpen}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header bar */}
        <div className="lg:hidden flex items-center h-12 px-3 shrink-0 border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </Button>
          {title && <span className="text-sm font-medium truncate ml-2">{title}</span>}
        </div>

        {/* Page content — scrollable. pb-16 lg:pb-0 reserves space for the
            mobile bottom tab bar so the last row of content isn't covered. */}
        <main id="main-content" className="flex-1 overflow-y-auto pb-16 lg:pb-0" tabIndex={-1}>
          {children}
        </main>

        {/* Pass 92 (Target 8): mobile bottom tab bar — 5 tabs max per the
            v10.0 prompt. Hidden on lg+ where the persistent sidebar is
            visible. Always-visible "Menu" tab opens the full sidebar
            sheet so every other nav item is still reachable. Touch
            targets are 44px+ tall (WCAG 2.5.5). */}
        <nav
          aria-label="Primary mobile navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-card/95 backdrop-blur-sm border-t border-border flex items-stretch"
        >
          {[
            { href: "/chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" /> },
            { href: "/calculators", label: "Tools", icon: <Calculator className="w-5 h-5" /> },
            { href: "/intelligence-hub", label: "Insights", icon: <Brain className="w-5 h-5" /> },
            { href: "/learning", label: "Learn", icon: <GraduationCap className="w-5 h-5" /> },
          ].map((tab) => {
            const active = location.startsWith(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => navigate(tab.href)}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium truncate">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open full menu"
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium truncate">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
