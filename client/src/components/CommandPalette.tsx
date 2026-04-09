/**
 * CommandPalette — Global search & navigation overlay (Ctrl+K / Cmd+K).
 *
 * Searches across:
 *  - Pages & navigation (static list from sidebar)
 *  - Quick actions (new conversation, settings, etc.)
 *  - Recent conversations (via trpc.conversations.search)
 *
 * Uses the shadcn/ui Command (cmdk) primitives for accessible,
 * keyboard-driven interaction.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  MessageSquare, Zap, Brain, Package, Users, TrendingUp, FileText,
  Link2, HeartPulse, RefreshCw, Activity, Briefcase, Building2,
  BarChart3, Globe, Wrench, HelpCircle, Settings, Plus, Search,
  Keyboard, History, Sparkles, ArrowRight, Calculator, Shield, Clock,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { useRecentPages } from "@/hooks/useRecentPages";

// ── Static page entries ─────────────────────────────────────────────

interface PageEntry {
  label: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
  shortcut?: string;
}

const PAGES: PageEntry[] = [
  { label: "Chat", href: "/chat", icon: <MessageSquare className="w-4 h-4" />, keywords: ["conversation", "ai", "advisor", "ask"], shortcut: "G C" },
  { label: "Operations Hub", href: "/operations", icon: <Zap className="w-4 h-4" />, keywords: ["ops", "workflows", "compliance", "agentic"], shortcut: "G O" },
  { label: "Intelligence Hub", href: "/intelligence-hub", icon: <Brain className="w-4 h-4" />, keywords: ["models", "analytics", "data", "ai"], shortcut: "G I" },
  { label: "Advisory Hub", href: "/advisory", icon: <Package className="w-4 h-4" />, keywords: ["insurance", "estate", "planning", "products"], shortcut: "G A" },
  { label: "Relationships", href: "/relationships", icon: <Users className="w-4 h-4" />, keywords: ["clients", "contacts", "crm", "meetings"], shortcut: "G R" },
  { label: "Market Data", href: "/market-data", icon: <TrendingUp className="w-4 h-4" />, keywords: ["stocks", "quotes", "economic", "fred"], shortcut: "G M" },
  { label: "Documents", href: "/documents", icon: <FileText className="w-4 h-4" />, keywords: ["files", "knowledge", "upload"], shortcut: "G D" },
  { label: "Integrations", href: "/integrations", icon: <Link2 className="w-4 h-4" />, keywords: ["connect", "plaid", "snaptrade", "api"], shortcut: "G N" },
  { label: "Settings", href: "/settings/profile", icon: <Settings className="w-4 h-4" />, keywords: ["profile", "preferences", "account"], shortcut: "G S" },
  { label: "Help & Support", href: "/help", icon: <HelpCircle className="w-4 h-4" />, keywords: ["faq", "support", "guide", "tour"], shortcut: "G H" },
  { label: "Calculators", href: "/calculators", icon: <Calculator className="w-4 h-4" />, keywords: ["retirement", "mortgage", "compound", "tax"] },
  { label: "Products", href: "/products", icon: <Package className="w-4 h-4" />, keywords: ["insurance", "annuity", "fund"] },
  { label: "Integration Health", href: "/integration-health", icon: <HeartPulse className="w-4 h-4" />, keywords: ["status", "uptime", "monitoring"] },
  { label: "Passive Actions", href: "/passive-actions", icon: <RefreshCw className="w-4 h-4" />, keywords: ["automation", "background", "tasks"] },
  { label: "My Progress", href: "/proficiency", icon: <Activity className="w-4 h-4" />, keywords: ["learning", "proficiency", "skills"] },
  { label: "Portal", href: "/portal", icon: <Briefcase className="w-4 h-4" />, keywords: ["advisor", "dashboard"] },
  { label: "Organizations", href: "/organizations", icon: <Building2 className="w-4 h-4" />, keywords: ["firm", "team", "company"] },
  { label: "Manager Dashboard", href: "/manager", icon: <BarChart3 className="w-4 h-4" />, keywords: ["oversight", "reports", "team"] },
  { label: "Global Admin", href: "/admin", icon: <Globe className="w-4 h-4" />, keywords: ["admin", "system", "platform"] },
  { label: "Improvement Engine", href: "/improvement", icon: <Wrench className="w-4 h-4" />, keywords: ["improve", "feedback", "optimize"] },
  { label: "Changelog", href: "/changelog", icon: <History className="w-4 h-4" />, keywords: ["updates", "releases", "whats new", "version"] },
];

// ── Quick actions ───────────────────────────────────────────────────

interface ActionEntry {
  label: string;
  icon: React.ReactNode;
  keywords: string[];
  action: (navigate: (path: string) => void) => void;
}

const ACTIONS: ActionEntry[] = [
  {
    label: "New conversation",
    icon: <Plus className="w-4 h-4" />,
    keywords: ["create", "start", "chat", "new"],
    action: (navigate) => navigate("/chat"),
  },
  {
    label: "Search conversations",
    icon: <Search className="w-4 h-4" />,
    keywords: ["find", "history", "search"],
    action: (navigate) => navigate("/chat"),
  },
  {
    label: "Keyboard shortcuts",
    icon: <Keyboard className="w-4 h-4" />,
    keywords: ["hotkeys", "keys", "shortcuts"],
    action: () => {
      // Dispatch a "?" keypress to open the shortcuts overlay
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    },
  },
  {
    label: "AI Tuning",
    icon: <Sparkles className="w-4 h-4" />,
    keywords: ["personalize", "tune", "model", "cascade"],
    action: (navigate) => navigate("/settings/ai-tuning"),
  },
  {
    label: "Financial Profile",
    icon: <Shield className="w-4 h-4" />,
    keywords: ["suitability", "risk", "assessment"],
    action: (navigate) => navigate("/settings/suitability"),
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ───────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user && user.authTier !== "anonymous";

  // Debounce search query for conversation search
  const debouncedQuery = useDebounce(query, 250);

  // Search conversations when query is long enough
  const conversationSearch = trpc.conversations.search.useQuery(
    { query: debouncedQuery, limit: 5 },
    { enabled: isAuthenticated && debouncedQuery.length >= 2 },
  );

  // ── Keyboard listener ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    // Pass 83: custom event so a visible sidebar trigger can open the palette
    // without having to import / lift the `open` state. Any component that
    // wants to surface the palette can dispatch `toggle-command-palette`.
    const toggleHandler = () => setOpen((prev) => !prev);
    window.addEventListener("keydown", handler);
    window.addEventListener("toggle-command-palette", toggleHandler as EventListener);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("toggle-command-palette", toggleHandler as EventListener);
    };
  }, []);

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);

      // Check if it's an action
      const action = ACTIONS.find((a) => `action:${a.label}` === value);
      if (action) {
        action.action(navigate);
        return;
      }

      // Check if it's a page
      const page = PAGES.find((p) => `page:${p.href}` === value);
      if (page) {
        navigate(page.href);
        return;
      }

      // Check if it's a conversation
      if (value.startsWith("conv:")) {
        const convId = value.replace("conv:", "");
        navigate(`/chat/${convId}`);
      }
    },
    [navigate],
  );

  const conversations = conversationSearch.data ?? [];

  // Recent pages — shown when no query is entered
  const { recentPages } = useRecentPages();
  const showRecent = query.length === 0 && recentPages.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search pages, actions, and conversations"
    >
      <CommandInput
        placeholder="Search pages, actions, conversations..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Search className="w-5 h-5 text-muted-foreground/40" />
            <span className="text-muted-foreground">No results found</span>
            <span className="text-xs text-muted-foreground/60">Try a different search term</span>
          </div>
        </CommandEmpty>

        {/* Recent Pages — shown when command palette first opens with no query */}
        {showRecent && (
          <>
            <CommandGroup heading="Recent">
              {recentPages.map((rp) => {
                const pageEntry = PAGES.find((p) => p.href === rp.route);
                return (
                  <CommandItem
                    key={`recent:${rp.route}`}
                    value={`page:${rp.route}`}
                    keywords={[rp.label, "recent"]}
                    onSelect={handleSelect}
                  >
                    {pageEntry?.icon || <Clock className="w-4 h-4 text-muted-foreground" />}
                    <span>{rp.label}</span>
                    <CommandShortcut>
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatTimeAgo(rp.visitedAt)}
                      </span>
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          {ACTIONS.map((action) => (
            <CommandItem
              key={`action:${action.label}`}
              value={`action:${action.label}`}
              keywords={action.keywords}
              onSelect={handleSelect}
            >
              <span className="text-accent">{action.icon}</span>
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem
              key={`page:${page.href}`}
              value={`page:${page.href}`}
              keywords={[page.label, ...page.keywords]}
              onSelect={handleSelect}
            >
              {page.icon}
              <span>{page.label}</span>
              {page.shortcut && (
                <CommandShortcut>
                  {page.shortcut.split(" ").map((k, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-0.5 text-muted-foreground/60">then</span>}
                      <kbd className="px-1 py-0.5 rounded bg-secondary/80 border border-border/60 text-[10px] font-mono">
                        {k}
                      </kbd>
                    </span>
                  ))}
                </CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Recent Conversations */}
        {isAuthenticated && conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversations">
              {conversations.map((conv: any) => (
                <CommandItem
                  key={`conv:${conv.id}`}
                  value={`conv:${conv.id}`}
                  keywords={[conv.title || "untitled"]}
                  onSelect={handleSelect}
                >
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{conv.title || "Untitled conversation"}</span>
                  <CommandShortcut>
                    <ArrowRight className="w-3 h-3" />
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">esc</kbd>
            close
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">⌘K</kbd>
          toggle
        </span>
      </div>
    </CommandDialog>
  );
}

/** Export page list for testing */
export { PAGES, ACTIONS };
