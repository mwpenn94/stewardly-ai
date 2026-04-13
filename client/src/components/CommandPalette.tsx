/**
 * CommandPalette — Global search & navigation overlay (Ctrl+K / Cmd+K).
 *
 * Build Loop Pass 7 (G14 / G33 / G52 / G67):
 *
 * Before: PAGES was a 21-entry hardcoded list that drifted from
 * navigation.ts by ~15 routes. Users searching for "Code Chat",
 * "Workflows", "Financial Twin", "Consensus", "Achievements",
 * "My Work", "Learning", or any /settings/* sub-route found nothing —
 * even though the routes existed in the app. The list also didn't
 * filter by role so regular users saw "Global Admin" and "Manager
 * Dashboard" entries that led to 403 pages.
 *
 * After:
 *   1. PAGES is derived from TOOLS_NAV + ADMIN_NAV + UTILITY_NAV + a
 *      small set of "extra" entries for routes that don't have a
 *      sidebar entry (audio settings, consensus, achievements, etc.).
 *   2. hasMinRole() filters entries so users only see what they can
 *      actually access.
 *   3. Shortcut hints only render for routes that match the 6 wired
 *      g-chords in useKeyboardShortcuts.ts (G C, G H, G S, G I, G L,
 *      G O). G53 fix: no more lies about G R / G M / G D / G N / G A.
 *   4. Recent pages still surface at the top when the query is empty.
 *
 * Uses the shadcn/ui Command (cmdk) primitives for accessible,
 * keyboard-driven interaction.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePushToTalk } from "@/hooks/usePushToTalk";
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
  MessageSquare,
  Zap,
  Brain,
  Package,
  Users,
  TrendingUp,
  FileText,
  Link2,
  HeartPulse,
  RefreshCw,
  Activity,
  Briefcase,
  Building2,
  BarChart3,
  Globe,
  Wrench,
  HelpCircle,
  Settings,
  Plus,
  Search,
  Keyboard,
  Mic,
  MicOff,
  Sparkles,
  ArrowRight,
  Calculator,
  Shield,
  Clock,
  AudioLines,
  Fingerprint,
  Award,
  GitBranch,
  LayoutDashboard,
  Users2,
  Database,
  Target,
  GraduationCap,
  BookOpen,
  Bot,
  Terminal,
  Mail,
  Plug,
  Link,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { useRecentPages } from "@/hooks/useRecentPages";
import { hasMinRole, type UserRole } from "@/lib/navigation";
import { playEarconById } from "@/lib/earcons";
import {
  buildPages,
  type PageEntry,
} from "./commandPaletteData";

/** All pages — built once at module level for testing and reuse */
const PAGES = buildPages();

// ── Icon mapping (shared with AppShell's ICON_MAP) ──────────────────

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
  Fingerprint: <Fingerprint className="w-4 h-4" />,
  Award: <Award className="w-4 h-4" />,
  GitBranch: <GitBranch className="w-4 h-4" />,
  Mail: <Mail className="w-4 h-4" />,
  Plug: <Plug className="w-4 h-4" />,
  Link: <Link className="w-4 h-4" />,
};

function iconFor(name?: string): React.ReactNode {
  return (name && ICON_MAP[name]) || <Zap className="w-4 h-4" />;
}

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
    keywords: ["hotkeys", "keys", "shortcuts", "help"],
    action: () => {
      // Pass 8 (G68 — focus trap stack conflict): dispatch a dedicated
      // `toggle-help` event instead of synthesizing a `?` keypress.
      // CommandPalette's onSelect handler already calls setOpen(false)
      // synchronously before running this action, so by the time the
      // browser mounts KeyboardShortcutsOverlay the palette's focus
      // trap has fully unwound and no two dialogs compete for focus.
      // Defer to a microtask so the palette's close animation starts
      // first — even a 0ms timeout is enough for the focus-trap stack
      // to unwind.
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("toggle-help"));
      }, 0);
    },
  },
  // Pass 7 (G5 extension): multisensory actions exposed in the palette
  // so keyboard-only users can trigger them without memorizing hotkeys.
  {
    label: "Toggle hands-free voice",
    icon: <AudioLines className="w-4 h-4" />,
    keywords: ["voice", "mic", "handsfree", "listen", "shift v"],
    action: () => {
      const onChat = typeof window !== "undefined" && window.location?.pathname?.startsWith("/chat");
      window.dispatchEvent(
        new CustomEvent(onChat ? "chat:toggle-handsfree" : "pil:toggle-handsfree"),
      );
    },
  },
  {
    label: "Read current page aloud",
    icon: <AudioLines className="w-4 h-4" />,
    keywords: ["tts", "narrate", "read", "speak", "shift r"],
    action: () => window.dispatchEvent(new CustomEvent("pil:read-page")),
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
  const userRole = (user?.role as UserRole) || "user";

  // Pass 7 (G33 / G67): build pages from navigation.ts + filter by role.
  // useMemo so the filter runs only when the role changes, not on every
  // keystroke.
  const pages = useMemo<PageEntry[]>(() => {
    const all = buildPages();
    return all.filter((p) => hasMinRole(userRole, p.minRole));
  }, [userRole]);

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
    // without having to import / lift the `open` state.
    const toggleHandler = () => setOpen((prev) => !prev);
    window.addEventListener("keydown", handler);
    window.addEventListener("toggle-command-palette", toggleHandler as EventListener);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("toggle-command-palette", toggleHandler as EventListener);
    };
  }, []);

  // Pass 12 (G42): earcon on open/close so keyboard + SR users get a
  // confirmation tone when they invoke the palette. Fires on state
  // transitions only (not re-renders).
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current !== open) {
      playEarconById(open ? "palette_open" : "palette_close");
      prevOpenRef.current = open;
    }
  }, [open]);

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Pass 13 (G17): push-to-talk voice input for the palette query.
  // Hold the mic button (or Shift+Space while palette is open) to
  // capture a spoken search term that populates the input as if the
  // user typed it. No continuous listening — single-shot per press,
  // works on Safari iOS + every full-support browser.
  const voiceInput = usePushToTalk({
    onTranscript: (text) => {
      if (!text) return;
      setQuery(text);
    },
    onInterim: (text) => {
      // Show live interim as the query so filter results animate
      // with the user's speech. Final onTranscript replaces it
      // with the clean transcript.
      if (text) setQuery(text);
    },
  });

  // Pass 13 (G17): Shift+Space inside the palette triggers voice capture.
  // Release to commit. Only active while palette is open + SR caps permit.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " && e.shiftKey && !e.repeat && !voiceInput.isActive) {
        e.preventDefault();
        voiceInput.start();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      if (e.key === " " && voiceInput.isActive) {
        e.preventDefault();
        voiceInput.release();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleUp);
    };
  }, [open, voiceInput]);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);

      // Check if it's an action
      const action = ACTIONS.find((a) => `action:${a.label}` === value);
      if (action) {
        action.action(navigate);
        return;
      }

      // Check if it's a page — any entry (including recents)
      if (value.startsWith("page:")) {
        const href = value.replace("page:", "");
        navigate(href);
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

  // Recent pages — shown when no query is entered.
  // Pass 7 (G34): role-filter recent pages too so users don't see an
  // admin page in their history if they're suddenly demoted.
  const { recentPages } = useRecentPages();
  const allowedHrefs = useMemo(() => new Set(pages.map((p) => p.href)), [pages]);
  const recentPagesFiltered = useMemo(
    () => recentPages.filter((rp) => allowedHrefs.has(rp.route)),
    [recentPages, allowedHrefs],
  );
  const showRecent = query.length === 0 && recentPages.length > 0 && recentPagesFiltered.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search pages, actions, and conversations"
    >
      {/* Pass 13 (G17): wrap the CommandInput + mic button in a flex
          row so the mic affordance sits alongside the input. The
          cmdk primitive handles focus management on its own input
          so we only render the mic as a sibling — clicking it
          doesn't steal palette focus. */}
      <div className="flex items-center border-b border-border px-3">
        <div className="flex-1">
          <CommandInput
            placeholder={
              voiceInput.isActive
                ? "Listening…"
                : voiceInput.capabilities.mode === "unsupported"
                  ? "Search pages, actions, conversations…"
                  : "Search pages, actions… or hold 🎙 / Shift+Space to speak"
            }
            value={query}
            onValueChange={setQuery}
            aria-describedby="palette-voice-hint"
          />
        </div>
        {voiceInput.isAvailable && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); voiceInput.start(); }}
            onTouchStart={(e) => { e.preventDefault(); voiceInput.start(); }}
            onMouseUp={() => voiceInput.release()}
            onTouchEnd={() => voiceInput.release()}
            onMouseLeave={() => voiceInput.isActive && voiceInput.cancel()}
            aria-label={voiceInput.isActive ? "Release to search" : "Hold to speak your search"}
            aria-pressed={voiceInput.isActive}
            className={`shrink-0 ml-2 min-w-[36px] min-h-[36px] rounded-full border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              voiceInput.isActive
                ? "border-accent bg-accent/20 text-accent animate-pulse-glow"
                : "border-border bg-secondary/30 text-muted-foreground hover:text-accent"
            }`}
          >
            {voiceInput.isActive ? (
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {/* sr-only description that the aria-describedby above references */}
      <span id="palette-voice-hint" className="sr-only">
        Hold Shift and Space to search by voice, or use the microphone button.
      </span>
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Search className="w-5 h-5 text-muted-foreground/40" aria-hidden="true" />
            <span className="text-muted-foreground">No results found</span>
            <span className="text-xs text-muted-foreground/60">Try a different search term</span>
          </div>
        </CommandEmpty>

        {/* Recent Pages — shown when command palette first opens with no query */}
        {showRecent && (
          <>
            <CommandGroup heading="Recent">
              {recentPagesFiltered.map((rp) => {
                // Reuse page icons from PAGES list for recent items
                const pageEntry = PAGES.find((p) => p.href === rp.route) ?? pages.find((p) => p.href === rp.route);
                const _icon = pageEntry?.iconName;
                return (
                  <CommandItem
                    key={`recent:${rp.route}`}
                    value={`page:${rp.route}`}
                    keywords={[rp.label, "recent"]}
                    onSelect={handleSelect}
                  >
                    {pageEntry ? (
                      iconFor(pageEntry.iconName)
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
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

        {/* Pages — derived from navigation.ts + EXTRA_PAGES (Pass 7) */}
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={`page:${page.href}`}
              value={`page:${page.href}`}
              keywords={[page.label, ...page.keywords]}
              onSelect={handleSelect}
            >
              {iconFor(page.iconName)}
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

/** Export quick actions for testing */
export { PAGES, ACTIONS };
