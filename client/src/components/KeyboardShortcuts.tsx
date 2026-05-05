/**
 * KeyboardShortcuts — Global overlay modal showing all available keyboard
 * shortcuts. Toggled with the "?" key from anywhere (except input fields).
 *
 * Features:
 *   - Categorized display (Navigation, Voice, Chat, General)
 *   - Search/filter for quick discovery (25+ shortcuts)
 *   - Focus trap for accessibility
 *   - macOS ⌘ hint in footer
 */
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { X, Keyboard, Command, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // ── Navigation (G-then-X) ──
  { keys: ["G", "then", "C"], description: "Go to Chat", category: "Navigation" },
  { keys: ["G", "then", "H"], description: "Go to Home (Chat)", category: "Navigation" },
  { keys: ["G", "then", "S"], description: "Go to Settings", category: "Navigation" },
  { keys: ["G", "then", "I"], description: "Go to Intelligence Hub", category: "Navigation" },
  { keys: ["G", "then", "L"], description: "Go to Lead Pipeline", category: "Navigation" },
  { keys: ["G", "then", "O"], description: "Go to Operations", category: "Navigation" },
  { keys: ["G", "then", "A"], description: "Go to Advisory", category: "Navigation" },
  { keys: ["G", "then", "R"], description: "Go to Relationships", category: "Navigation" },
  { keys: ["G", "then", "M"], description: "Go to Market Data", category: "Navigation" },
  { keys: ["G", "then", "D"], description: "Go to Documents", category: "Navigation" },
  { keys: ["G", "then", "N"], description: "Go to Integrations", category: "Navigation" },
  { keys: ["G", "then", "P"], description: "Go to Help", category: "Navigation" },
  { keys: ["G", "then", "W"], description: "Go to Wealth Engine", category: "Navigation" },
  { keys: ["G", "then", "E"], description: "Go to People Hub", category: "Navigation" },
  { keys: ["G", "then", "T"], description: "Go to Learning", category: "Navigation" },

  // ── Voice & Multisensory ──
  { keys: ["Shift", "V"], description: "Toggle hands-free voice mode", category: "Voice & Audio" },
  { keys: ["Shift", "R"], description: "Read current page aloud", category: "Voice & Audio" },
  { keys: ["Say", "stop"], description: "Voice: abort streaming response", category: "Voice & Audio" },
  { keys: ["Say", "send"], description: "Voice: send the current prompt", category: "Voice & Audio" },

  // ── Chat ──
  { keys: ["/"], description: "Focus chat input", category: "Chat" },
  { keys: ["Enter"], description: "Send message", category: "Chat" },
  { keys: ["Shift", "Enter"], description: "New line in message", category: "Chat" },

  // ── General ──
  { keys: ["Ctrl", "K"], description: "Open command palette", category: "General" },
  { keys: ["?"], description: "Show this shortcuts panel", category: "General" },
  { keys: ["Esc"], description: "Close menus / modals / cancel", category: "General" },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Navigation: "Press G, then a letter to jump to a page",
  "Voice & Audio": "Multisensory shortcuts — work from any page",
  Chat: "Available on the Chat page",
  General: "Available everywhere",
};

const CATEGORY_ORDER = ["Navigation", "Voice & Audio", "Chat", "General"];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Auto-focus search when opening
  useEffect(() => {
    if (open) {
      // Small delay to let focus trap settle
      const t = setTimeout(() => searchRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const toggleHandler = () => toggle();
    window.addEventListener("keydown", handler);
    document.addEventListener("toggle-help", toggleHandler as EventListener);
    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("toggle-help", toggleHandler as EventListener);
    };
  }, [open, toggle]);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Filter shortcuts by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return SHORTCUTS;
    const q = search.toLowerCase();
    return SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(filtered.map((s) => s.category)));
    return CATEGORY_ORDER.filter((c) => cats.includes(c));
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div ref={focusTrapRef} className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <p className="text-[10px] text-muted-foreground">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 mr-1 text-muted-foreground/70 border-border/60">
                  {SHORTCUTS.length}
                </Badge>
                shortcuts — press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">?</kbd> to toggle
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter shortcuts..."
              className="h-8 pl-8 text-sm bg-secondary/30 border-border/40"
              aria-label="Filter keyboard shortcuts"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {search && (
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 ml-0.5">
              {filtered.length} of {SHORTCUTS.length} shortcuts match
            </p>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <Keyboard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/60">No shortcuts match "{search}"</p>
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              categories.map((category, ci) => (
                <div key={category}>
                  {ci > 0 && <Separator className="mb-5" />}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </h3>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground/70 border-border/60">
                      {filtered.filter(s => s.category === category).length}
                    </Badge>
                  </div>
                  {CATEGORY_DESCRIPTIONS[category] && (
                    <p className="text-[10px] text-muted-foreground/60 mb-2.5">
                      {CATEGORY_DESCRIPTIONS[category]}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {filtered.filter(s => s.category === category).map((shortcut, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors group"
                      >
                        <span className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          {shortcut.keys.map((key, ki) =>
                            key === "then" ? (
                              <span key={ki} className="text-[10px] text-muted-foreground/50 mx-0.5">
                                then
                              </span>
                            ) : (
                              <kbd
                                key={ki}
                                className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-mono font-medium text-foreground/80 shadow-sm"
                              >
                                {key}
                              </kbd>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/50 shrink-0">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Command className="w-3 h-3" />
            <span>On macOS, use</span>
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">⌘</kbd>
            <span>instead of</span>
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">Ctrl</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Expose the shortcut list for testing */
export { SHORTCUTS };
