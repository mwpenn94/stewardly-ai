/**
 * WhatsNewModal — Changelog data + first-login-after-updates modal.
 *
 * Shows a polished Dialog on first login after new platform updates,
 * surfacing the latest release notes. Uses the popup queue system
 * to avoid stacking with consent banner or onboarding tour.
 *
 * Also exports CHANGELOG data consumed by the /changelog page and
 * ChangelogBell notification dropdown.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles, Shield, Zap, RefreshCw, Wifi, Layout,
  Keyboard, Globe, Brain, Search, Share2, Bell,
  FileText, Users, TrendingUp, Lock, Gauge,
  ChevronRight, X, ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePopupSlot, registerPopup, dismissPopup } from "@/hooks/usePopupQueue";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// ── Changelog entries — newest first ──────────────────────────────────

export const CURRENT_VERSION = "2026.04.23";

type ChangeCategory = "feature" | "fix" | "improvement" | "security";

interface ChangeEntry {
  category: ChangeCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface ChangelogRelease {
  version: string;
  date: string;
  headline: string;
  entries: ChangeEntry[];
}

export const CATEGORY_STYLES: Record<ChangeCategory, { label: string; className: string }> = {
  feature:     { label: "New",         className: "bg-primary/10 text-primary border-primary/20" },
  fix:         { label: "Fix",         className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  improvement: { label: "Improved",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  security:    { label: "Security",    className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "2026.04.23",
    date: "April 23, 2026",
    headline: "All 5 engines at 4.0+ maturity, real-time WebSocket, global search, and client portal",
    entries: [
      {
        category: "feature",
        title: "What's New modal",
        description:
          "Returning users now see a polished modal highlighting the latest platform updates on first login after changes. Participates in the popup queue so it never stacks with the consent banner or onboarding tour.",
        icon: <Bell className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Global search results page",
        description:
          "Ctrl+K command palette now links to a dedicated /search page showing full results across conversations, documents, contacts, and calculator scenarios with relevance scoring and highlighted matches.",
        icon: <Search className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Enhanced client portal",
        description:
          "The read-only shared plan view at /plan/:token now includes branded PDF export, advisor branding header, and a more polished responsive layout for client-facing presentations.",
        icon: <Share2 className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "All 5 engines at 4.0+ maturity",
        description:
          "Intelligence Engine consolidated 21 routers into 6 logical groupings. Learning Engine added global leaderboard and study groups. Data Engine added advanced caching with LRU eviction. Wealth Engine added plan sharing. People Hub added unified activity timeline.",
        icon: <Brain className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "feature",
        title: "Real-time WebSocket updates",
        description:
          "Data Engine Dashboard and Client Activity Timeline now support live mode with WebSocket-driven updates, connection status indicators, and event history.",
        icon: <Wifi className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Keyboard shortcuts expanded",
        description:
          "25 keyboard shortcuts across 4 categories with search/filter overlay. 9 new G-chord navigation shortcuts for instant page jumping.",
        icon: <Keyboard className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "11,625+ tests, 0 failures",
        description:
          "469 test files covering all engines, routers, and services. Full 7-pass convergence confirmed with comprehensive parity assessment.",
        icon: <Gauge className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.04.15",
    date: "April 15, 2026",
    headline: "Authentication system hardening and proxy-resilient token management",
    entries: [
      {
        category: "security",
        title: "Proxy-resilient authentication",
        description:
          "All auth flows (Manus OAuth, Google, LinkedIn, Email, Guest) now store session tokens in localStorage and send them via Authorization: Bearer header. This eliminates session loss caused by the reverse proxy stripping Set-Cookie headers.",
        icon: <Lock className="w-5 h-5 text-purple-400" />,
      },
      {
        category: "security",
        title: "Social OAuth HTML bridge",
        description:
          "Google and LinkedIn OAuth callbacks now use an HTML bridge page to store the session token in localStorage before redirecting, matching the Manus OAuth pattern.",
        icon: <Shield className="w-5 h-5 text-purple-400" />,
      },
      {
        category: "feature",
        title: "Silent token refresh",
        description:
          "Session tokens are automatically refreshed 5 minutes before expiry. This is user-togglable in Settings and enabled by default. Cross-tab sync ensures all open tabs stay authenticated.",
        icon: <RefreshCw className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "7,751 unit tests",
        description:
          "13 new tests covering Bearer token authentication, OAuth HTML bridge generation, and token lifecycle management. Full test suite passes in under 60 seconds.",
        icon: <Gauge className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.04.04",
    date: "April 4, 2026",
    headline: "Production hardening, bug fixes, and infrastructure upgrades",
    entries: [
      {
        category: "feature",
        title: "Sentry error tracking",
        description:
          "Production error monitoring is now active via @sentry/node. Crashes, unhandled rejections, and server errors are automatically captured and reported.",
        icon: <Shield className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "131 new database tables deployed",
        description:
          "Full schema deployment brings the database to 270 tables — unlocking CRM, guardrails, event bus, tenant context, accessible charts, and more service features.",
        icon: <Zap className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Shared navigation config",
        description:
          "Sidebar navigation is now driven by a single source of truth. Both Chat and AppShell consume the same config — no more drift between pages.",
        icon: <Layout className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Mobile swipe gestures",
        description:
          "Swipe right from the left edge to open the sidebar, swipe left to close it. Works on all pages for screens under 1024px.",
        icon: <Globe className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "Onboarding moved to notifications",
        description:
          "The Getting Started checklist has moved from the sidebar widget into the notification bell. Checklist items appear as actionable notifications that navigate to the relevant feature.",
        icon: <Sparkles className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "fix",
        title: "Notification panel visibility",
        description:
          "Fixed the notification dropdown being clipped by the sidebar. It now renders via a portal with fixed positioning, visible over all content.",
        icon: <RefreshCw className="w-5 h-5 text-amber-400" />,
      },
      {
        category: "fix",
        title: "Chat audio text rendering",
        description:
          "Fixed streamed responses showing blank text during audio playback. The AI response is now persisted directly instead of being regenerated, and TTS starts immediately.",
        icon: <RefreshCw className="w-5 h-5 text-amber-400" />,
      },
      {
        category: "security",
        title: "CORS enforcement",
        description:
          "Production CORS is now enforced via ALLOWED_ORIGINS. Only stewardly.manus.space and wealthai-gakeferp.manus.space are permitted.",
        icon: <Lock className="w-5 h-5 text-purple-400" />,
      },
    ],
  },
  {
    version: "2026.04.01",
    date: "April 1, 2026",
    headline: "Streamlined UI, removed popup clutter, consistent sidebar",
    entries: [
      {
        category: "improvement",
        title: "Consistent sidebar across all pages",
        description:
          "The sidebar navigation is now identical on every page — collapsible NAVIGATE and ADMIN sections that default to collapsed, with Help & Support and Settings always visible.",
        icon: <Layout className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "improvement",
        title: "Streamlined notifications",
        description:
          "Platform updates are now surfaced through the changelog notification bell and the /changelog page for a less intrusive experience.",
        icon: <Zap className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "improvement",
        title: "Mobile-friendly sidebar",
        description:
          "Sidebar sections default to collapsed on mobile, preventing options from being cut off. All navigation items are accessible without scrolling.",
        icon: <Globe className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.03.28b",
    date: "March 28, 2026",
    headline: "Keyboard shortcuts, expanded navigation, and more polish",
    entries: [
      {
        category: "feature",
        title: "Keyboard shortcuts overlay",
        description:
          "Press ? from anywhere to see all available keyboard shortcuts. Navigate the entire platform without touching the mouse — press G then a letter to jump to any page.",
        icon: <Keyboard className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Full keyboard navigation",
        description:
          "10 new G-then-X shortcuts let you jump to Operations (G O), Intelligence (G I), Advisory (G A), Relationships (G R), Market Data (G M), Documents (G D), and more — from any page.",
        icon: <Globe className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "Instant page transitions with prefetch",
        description:
          "Hovering over sidebar links now preloads the page in the background, making navigation feel nearly instant.",
        icon: <Gauge className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "improvement",
        title: "Smarter error recovery",
        description:
          "Retry buttons in error boundaries now invalidate stale queries and fetch fresh data. After 3 failed retries, a page-refresh fallback appears.",
        icon: <RefreshCw className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.03.28",
    date: "March 28, 2026",
    headline: "Smarter AI, resilient UI, and faster navigation",
    entries: [
      {
        category: "feature",
        title: "Multi-tool AI conversations",
        description:
          "The AI advisor can now chain up to 5 tools in a single turn — run a retirement readiness model, then a tax efficiency check, then estate planning, all without you asking separately.",
        icon: <Sparkles className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Offline detection & auto-reconnect",
        description:
          "A non-intrusive banner now appears when your connection drops and auto-dismisses when you're back online. No more silent failures.",
        icon: <Wifi className="w-5 h-5 text-primary" />,
      },
      {
        category: "improvement",
        title: "Persistent sidebar navigation",
        description:
          "Every page now has the sidebar navigation visible — no more dead-ends when navigating away from Chat.",
        icon: <Layout className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "improvement",
        title: "Smarter retry with backoff",
        description:
          "Failed requests now retry automatically with exponential backoff. If all retries fail, you'll see a toast with a one-click retry button.",
        icon: <RefreshCw className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "fix",
        title: "Integrations page stability",
        description:
          "Fixed a crash on the Integrations page caused by a data shape mismatch. Each section now has its own error boundary — one failing section won't take down the rest.",
        icon: <Shield className="w-5 h-5 text-amber-400" />,
      },
      {
        category: "improvement",
        title: "Faster page loads with code splitting",
        description:
          "50+ pages are now lazy-loaded on demand, reducing the initial bundle size and speeding up first paint.",
        icon: <Zap className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.03.20",
    date: "March 20, 2026",
    headline: "Deep intelligence, real-time data, and compliance tools",
    entries: [
      {
        category: "feature",
        title: "Intelligence Hub",
        description:
          "A new centralized hub for AI models, data insights, and analytics. View model status, run history, and data source health in one place.",
        icon: <Brain className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Real-time market data",
        description:
          "Live quotes, economic indicators from FRED, BLS, BEA, and Census data — all piped through the Market Data page with auto-refresh.",
        icon: <TrendingUp className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Document management",
        description:
          "Upload, organize, and search documents with AI-powered tagging. Supports bulk operations, version history, and client-linked filing.",
        icon: <FileText className="w-5 h-5 text-primary" />,
      },
      {
        category: "feature",
        title: "Relationship management",
        description:
          "Track client relationships, household structures, and service tiers. Integrated with the AI advisor for context-aware recommendations.",
        icon: <Users className="w-5 h-5 text-primary" />,
      },
      {
        category: "security",
        title: "Role-based access control",
        description:
          "Four-tier role hierarchy (user, advisor, manager, admin) with automatic role elevation for sensitive operations and 30-minute auto-revoke.",
        icon: <Lock className="w-5 h-5 text-purple-400" />,
      },
    ],
  },
];

// ── What's New Modal Component ────────────────────────────────────────

const STORAGE_KEY = "stewardly_whats_new_last_seen_version";

interface WhatsNewModalProps {
  /** Override for testing — force the modal open regardless of version check */
  forceOpen?: boolean;
}

export default function WhatsNewModal({ forceOpen }: WhatsNewModalProps) {
  const { user } = useAuth();
  const isGuest = !user || user.authTier === "anonymous";
  const [, navigate] = useLocation();
  const canShow = usePopupSlot("whatsNew");
  const [wantsToShow, setWantsToShow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Server-side unread count — only for authenticated users
  const unreadQuery = trpc.exponentialEngine.getUnreadChangelogCount.useQuery(undefined, {
    enabled: !isGuest,
  });
  const markAllReadMutation = trpc.exponentialEngine.markAllChangelogRead.useMutation();
  const utils = trpc.useUtils();

  // Determine if the modal should show
  useEffect(() => {
    if (forceOpen) {
      setWantsToShow(true);
      registerPopup("whatsNew");
      return;
    }

    // Check localStorage for last seen version
    const lastSeen = safeGetItem(STORAGE_KEY);
    if (lastSeen === CURRENT_VERSION) return; // Already seen this version

    // For authenticated users, also check server-side unread count
    if (!isGuest && unreadQuery.data) {
      if (unreadQuery.data.unreadCount > 0 || lastSeen !== CURRENT_VERSION) {
        setWantsToShow(true);
        registerPopup("whatsNew");
      }
    } else if (isGuest) {
      // For guests, rely purely on localStorage
      if (lastSeen !== CURRENT_VERSION) {
        // Small delay to let consent banner go first
        const timer = setTimeout(() => {
          setWantsToShow(true);
          registerPopup("whatsNew");
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [forceOpen, isGuest, unreadQuery.data]);

  // Open the dialog when the popup queue allows it
  useEffect(() => {
    if (wantsToShow && canShow) {
      setIsOpen(true);
    }
  }, [wantsToShow, canShow]);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    setWantsToShow(false);
    safeSetItem(STORAGE_KEY, CURRENT_VERSION);
    dismissPopup("whatsNew");

    // Mark all changelog entries as read on server
    if (!isGuest) {
      markAllReadMutation.mutate(undefined, {
        onSuccess: () => {
          utils.exponentialEngine.getUnreadChangelogCount.invalidate();
          utils.exponentialEngine.getChangelogFeed.invalidate();
        },
      });
    }
  }, [isGuest, markAllReadMutation, utils]);

  const handleViewAll = useCallback(() => {
    handleDismiss();
    navigate("/changelog");
  }, [handleDismiss, navigate]);

  // Get the latest release for the modal
  const latestRelease = useMemo(() => CHANGELOG[0], []);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] max-sm:max-h-[75vh] flex flex-col gap-0 p-0 overflow-hidden"
        aria-describedby="whats-new-description"
      >
        {/* Gradient header */}
        <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent shrink-0">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">What's New</DialogTitle>
                <DialogDescription id="whats-new-description" className="text-xs text-muted-foreground">
                  v{latestRelease.version} — {latestRelease.date}
                </DialogDescription>
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {latestRelease.headline}
            </p>
          </DialogHeader>
        </div>

        <Separator />

        {/* Entries list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-2.5 sm:space-y-3">
            {latestRelease.entries.map((entry, i) => {
              const style = CATEGORY_STYLES[entry.category];
              return (
                <div
                  key={i}
                  className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">{entry.icon}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entry.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${style.className}`}
                      >
                        {style.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {entry.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 flex-row justify-between sm:justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleViewAll}
          >
            View full changelog
            <ExternalLink className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            onClick={handleDismiss}
            className="gap-1.5"
          >
            Got it
            <ChevronRight className="w-3 h-3" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
