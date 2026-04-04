/**
 * WhatsNewData — Changelog data for the platform.
 * The modal popup has been removed; changelog entries are now surfaced
 * through the ChangelogBell notification and the /changelog page.
 *
 * This file is kept as the single source of truth for changelog data.
 */
import {
  Sparkles, Shield, Zap, RefreshCw, Wifi, Layout,
  Keyboard, Globe, Brain,
  FileText, Users, TrendingUp, Lock, Gauge,
} from "lucide-react";

// ── Changelog entries — newest first ──────────────────────────────────

export const CURRENT_VERSION = "2026.04.04";

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
  feature:     { label: "New",         className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  fix:         { label: "Fix",         className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  improvement: { label: "Improved",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  security:    { label: "Security",    className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export const CHANGELOG: ChangelogRelease[] = [
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
        icon: <Shield className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "131 new database tables deployed",
        description:
          "Full schema deployment brings the database to 270 tables — unlocking CRM, guardrails, event bus, tenant context, accessible charts, and more service features.",
        icon: <Zap className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Shared navigation config",
        description:
          "Sidebar navigation is now driven by a single source of truth. Both Chat and AppShell consume the same config — no more drift between pages.",
        icon: <Layout className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Mobile swipe gestures",
        description:
          "Swipe right from the left edge to open the sidebar, swipe left to close it. Works on all pages for screens under 1024px.",
        icon: <Globe className="w-5 h-5 text-emerald-400" />,
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
        title: "Removed popup clutter",
        description:
          "Guided tour and What's New modal have been removed. Platform updates are now surfaced through the changelog notification bell and the /changelog page.",
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
        icon: <Keyboard className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Full keyboard navigation",
        description:
          "10 new G-then-X shortcuts let you jump to Operations (G O), Intelligence (G I), Advisory (G A), Relationships (G R), Market Data (G M), Documents (G D), and more — from any page.",
        icon: <Globe className="w-5 h-5 text-emerald-400" />,
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
        icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Offline detection & auto-reconnect",
        description:
          "A non-intrusive banner now appears when your connection drops and auto-dismisses when you're back online. No more silent failures.",
        icon: <Wifi className="w-5 h-5 text-emerald-400" />,
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
        icon: <Brain className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Real-time market data",
        description:
          "Live quotes, economic indicators from FRED, BLS, BEA, and Census data — all piped through the Market Data page with auto-refresh.",
        icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Document management",
        description:
          "Upload, organize, and search documents with AI-powered tagging. Supports bulk operations, version history, and client-linked filing.",
        icon: <FileText className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Relationship management",
        description:
          "Track client relationships, household structures, and service tiers. Integrated with the AI advisor for context-aware recommendations.",
        icon: <Users className="w-5 h-5 text-emerald-400" />,
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
