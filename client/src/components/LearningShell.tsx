/**
 * LearningShell — Secondary sidebar navigation for all /learning/* pages.
 *
 * Renders INSIDE AppShell's main content area. Provides Knowledge Explorer-style
 * sidebar with grouped navigation (Overview, Mastery Modules, Exam Tracks, Quick Study)
 * plus streak/mastery stats at the bottom.
 *
 * Desktop: persistent left sidebar + content area
 * Mobile: collapsible drawer triggered by hamburger in the learning header
 */
import { useState, useMemo, useEffect } from "react";
import { useLocation, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home, Search, ClipboardCheck, Calculator, Scale, Brain,
  BookOpen, Layers, Headphones, HelpCircle, Link2,
  Flame, ChevronLeft, ChevronRight, Menu, Settings,
  GraduationCap, Beaker,
} from "lucide-react";
import {
  loadStreakFromStorage,
  summarizeStreak,
  type StreakSummary,
} from "@/pages/learning/lib/studyStreak";

/* ─── Navigation definition ─── */

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  icon: any;
  path: string;
  /** Match these path prefixes to highlight as active */
  match?: string[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: Home, path: "/learning", match: ["/learning"] },
      { label: "Search", icon: Search, path: "/learning/search", match: ["/learning/search"] },
    ],
  },
  {
    label: "MASTERY MODULES",
    items: [
      { label: "Exam Simulator", icon: ClipboardCheck, path: "/learning/cases", match: ["/learning/exam", "/learning/cases"] },
      { label: "Formula Lab", icon: Beaker, path: "/learning/formula-lab", match: ["/learning/formula-lab"] },
      { label: "Case Simulator", icon: Scale, path: "/learning/cases", match: ["/learning/case"] },
      { label: "Connection Map", icon: Brain, path: "/learning/connections", match: ["/learning/connections"] },
    ],
  },
  {
    label: "EXAM TRACKS",
    items: [
      { label: "Track Library", icon: BookOpen, path: "/learning/tracks", match: ["/learning/tracks"] },
    ],
  },
  {
    label: "QUICK STUDY",
    items: [
      { label: "Study Session", icon: Headphones, path: "/learning/hands-free", match: ["/learning/hands-free", "/learning/session"] },
      { label: "Formula Ref", icon: Calculator, path: "/learning/formulas", match: ["/learning/formulas"] },
      { label: "Quick Quiz", icon: HelpCircle, path: "/learning/ai-quiz", match: ["/learning/ai-quiz"] },
      { label: "Concept Links", icon: Link2, path: "/learning/connections-browse", match: ["/learning/connections-browse"] },
    ],
  },
];

/* ─── Sidebar content (shared between desktop and mobile) ─── */

function SidebarContent({
  location,
  collapsed,
  streak,
  mastery,
  onNavigate,
}: {
  location: string;
  collapsed: boolean;
  streak: StreakSummary;
  mastery: { studied: number; mastered: number; dueNow: number };
  onNavigate?: () => void;
}) {
  const isActive = (item: NavItem) => {
    // Exact match for /learning dashboard
    if (item.path === "/learning" && location === "/learning") return true;
    if (item.path === "/learning") return false;
    // Prefix match for other items
    return (item.match ?? [item.path]).some(
      (m) => location === m || location.startsWith(m + "/"),
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-4 border-b border-border/30">
        <Link href="/learning" onClick={onNavigate}>
          <div className="flex items-center gap-2 cursor-pointer">
            <GraduationCap className="h-5 w-5 text-primary shrink-0" />
            {!collapsed && (
              <div>
                <div className="text-sm font-semibold text-foreground">Knowledge</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Explorer</div>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Navigation sections */}
      <ScrollArea className="flex-1 px-1.5 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link key={item.path + item.label} href={item.path} onClick={onNavigate}>
                    <button
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                      } ${collapsed ? "justify-center" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* Footer — streak + mastery stats */}
      <div className="border-t border-border/30 px-3 py-3 space-y-1.5">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className={`h-3.5 w-3.5 ${streak.current > 0 ? "text-amber-500" : ""}`} />
              <span>{streak.current} streak</span>
              {mastery.dueNow > 0 && (
                <><span className="text-muted-foreground/40">·</span><span className="text-amber-500">{mastery.dueNow} due</span></>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{mastery.studied} studied · {mastery.mastered} mastered</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Flame className={`h-4 w-4 ${streak.current > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="text-[10px] text-muted-foreground">{streak.current}</span>
          </div>
        )}
      </div>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:flex border-t border-border/30 px-2 py-2">
        {/* Rendered by parent — this is a placeholder for alignment */}
      </div>
    </div>
  );
}

/* ─── Main LearningShell component ─── */

interface LearningShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function LearningShell({ children, title }: LearningShellProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load streak from localStorage
  const streak = useMemo(() => {
    const entries = loadStreakFromStorage();
    return summarizeStreak(entries);
  }, []);

  // Mastery summary from server (if authenticated)
  const { isAuthenticated } = useAuth();
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const mastery = useMemo(() => ({
    studied: summaryQ.data?.total ?? 0,
    mastered: summaryQ.data?.mastered ?? 0,
    dueNow: summaryQ.data?.dueNow ?? 0,
  }), [summaryQ.data]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <AppShell title={title}>
      <div className="flex h-full">
        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:flex flex-col border-r border-border/30 bg-card/30 shrink-0 transition-all duration-200 ${
            collapsed ? "w-14" : "w-56"
          }`}
        >
          <SidebarContent
            location={location}
            collapsed={collapsed}
            streak={streak}
            mastery={mastery}
          />
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center py-2 border-t border-border/30 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </aside>

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <VisuallyHidden><SheetTitle>Learning Navigation</SheetTitle></VisuallyHidden>
            <SidebarContent
              location={location}
              collapsed={false}
              streak={streak}
              mastery={mastery}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Mobile header with hamburger */}
          <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card/30">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileOpen(true)}
              aria-label="Open learning navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Knowledge Explorer</span>
          </div>

          {children}
        </div>
      </div>
    </AppShell>
  );
}
