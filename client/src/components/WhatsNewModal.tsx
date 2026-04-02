/**
 * WhatsNewData — Changelog data for the platform.
 *
 * This file exports CHANGELOG, CURRENT_VERSION, and CATEGORY_STYLES
 * used by the Changelog page and ChangelogBell notification component.
 *
 * The modal popup has been removed — What's New content is now surfaced
 * through the ChangelogBell in the sidebar (notification-style).
 */
import {
  Sparkles, Shield, Zap, RefreshCw, Wifi, Layout,
  Keyboard, Globe, Brain,
  FileText, Users, TrendingUp, Lock, Gauge,
} from "lucide-react";

// ── Changelog entries — newest first ──────────────────────────────────
// Bump CURRENT_VERSION when adding new entries.

export const CURRENT_VERSION = "2026.04.01";

type ChangelogCategory = "feature" | "improvement" | "fix" | "security";

interface ChangelogEntry {
  category: ChangelogCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  headline: string;
  entries: ChangelogEntry[];
}

export const CATEGORY_STYLES: Record<ChangelogCategory, { label: string; className: string }> = {
  feature: { label: "New", className: "text-emerald-400 border-emerald-500/30" },
  improvement: { label: "Improved", className: "text-blue-400 border-blue-500/30" },
  fix: { label: "Fixed", className: "text-amber-400 border-amber-500/30" },
  security: { label: "Security", className: "text-purple-400 border-purple-500/30" },
};

const LS_KEY = "stewardly_whats_new_seen";

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "2026.04.01",
    date: "April 1, 2026",
    headline: "Decluttered sidebar, smarter notifications, and data export",
    entries: [
      {
        category: "feature",
        title: "Comprehensive data export",
        description:
          "Export your conversations, documents, suitability data, and settings in JSON or CSV format from the Privacy & Data settings tab.",
        icon: <FileText className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "improvement",
        title: "Streamlined sidebar",
        description:
          "Removed popup clutter — What's New and onboarding are now in the notification bell. Sidebar navigation is consistent across all pages.",
        icon: <Layout className="w-5 h-5 text-blue-400" />,
      },
      {
        category: "improvement",
        title: "Sidebar search and filter",
        description:
          "Search sidebar navigation items with debounced filtering. Works on both desktop and mobile views.",
        icon: <Globe className="w-5 h-5 text-blue-400" />,
      },
    ],
  },
  {
    version: "2026.03.30",
    date: "March 30, 2026",
    headline: "Command palette, keyboard shortcuts, and contextual help",
    entries: [
      {
        category: "feature",
        title: "Command palette (Ctrl+K)",
        description:
          "Search pages, actions, and conversations from anywhere. Fuzzy matching, recent pages, and quick actions — all keyboard-accessible.",
        icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
      },
      {
        category: "feature",
        title: "Customizable keyboard shortcuts",
        description:
          "New Settings → Keyboard Shortcuts page. Remap G-then-X navigation shortcuts to your preferred keys, with conflict detection and one-click reset.",
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

// No modal component — What's New is now surfaced through ChangelogBell
// and the /changelog page. Keeping this file as the single source of
// truth for changelog data.
export default function WhatsNewModal() {
  // No-op: modal removed. Changelog data is consumed by ChangelogBell and Changelog page.
  return null;
}
