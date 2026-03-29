/**
 * WhatsNewModal — Shows recent platform updates to users on first visit
 * after a new version is deployed. Uses localStorage to track the last
 * seen version and only shows when there are new entries.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Shield, Zap, RefreshCw, Wifi, Layout,
  ArrowRight, CheckCircle2, Keyboard, Globe, Brain,
  FileText, Users, TrendingUp, Lock, Gauge,
} from "lucide-react";

// ── Changelog entries — newest first ──────────────────────────────────
// Bump CURRENT_VERSION when adding new entries so the modal re-appears.

export const CURRENT_VERSION = "2026.03.28b";
const LS_KEY = "stewardly-whats-new-seen";

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

const CATEGORY_STYLES: Record<ChangeCategory, { label: string; className: string }> = {
  feature:     { label: "New",         className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  fix:         { label: "Fix",         className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  improvement: { label: "Improved",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  security:    { label: "Security",    className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export const CHANGELOG: ChangelogRelease[] = [
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

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    try {
      const seen = localStorage.getItem(LS_KEY);
      if (seen !== CURRENT_VERSION) {
        // Small delay so the app finishes rendering first
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(LS_KEY, CURRENT_VERSION);
    } catch {}
  }, []);

  const latest = CHANGELOG[0];
  if (!latest) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <DialogTitle className="text-lg">What's New</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {latest.headline}
          </DialogDescription>
          <p className="text-xs text-muted-foreground/60">{latest.date} · v{latest.version}</p>
        </DialogHeader>

        <Separator />

        {/* Entries */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {latest.entries.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 mt-0.5">{entry.icon}</div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{entry.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${CATEGORY_STYLES[entry.category].className}`}
                    >
                      {CATEGORY_STYLES[entry.category].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {entry.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between">
          <button
            className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
            onClick={() => { handleDismiss(); navigate("/changelog"); }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            View all releases
          </button>
          <Button size="sm" onClick={handleDismiss} className="gap-1.5">
            Got it <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
