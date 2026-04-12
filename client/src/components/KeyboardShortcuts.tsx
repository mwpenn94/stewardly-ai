/**
 * KeyboardShortcuts — Global overlay modal showing all available keyboard
 * shortcuts. Toggled with the "?" key from anywhere (except input fields).
 *
 * Categories:
 *   - Navigation (G-then-X sequences for sidebar routes)
 *   - Chat (conversation management)
 *   - General (send, new line, search, etc.)
 */
import { useEffect, useState, useCallback } from "react";
import { X, Keyboard, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // ── Navigation (G-then-X) ──
  // Pass 6 (G53): trimmed to shortcuts that are ACTUALLY wired.
  // Pass 2/v9.0 had listed G+M/G+D/G+N/G+A/G+R but none of those were
  // wired in useKeyboardShortcuts — so users saw the overlay, tried
  // them, and nothing happened. This list now matches the wired set.
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

  // ── Voice & Multisensory (Pass 6: G15 / G25 / G26) ──
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

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
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
    // Pass 8 (G68 — focus trap stack conflict): listen for an explicit
    // `toggle-help` custom event so CommandPalette can dispatch it
    // after closing its own dialog (rather than synthesizing a
    // keydown which fires while both dialogs overlap in the focus
    // trap stack and whichever mounts last wins).
    const toggleHandler = () => toggle();
    window.addEventListener("keydown", handler);
    document.addEventListener("toggle-help", toggleHandler as EventListener);
    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("toggle-help", toggleHandler as EventListener);
    };
  }, [open, toggle]);

  if (!open) return null;

  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <p className="text-[10px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">?</kbd> to toggle
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {categories.map((category, ci) => (
              <div key={category}>
                {ci > 0 && <Separator className="mb-5" />}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </h3>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground/70 border-border/60">
                    {SHORTCUTS.filter(s => s.category === category).length}
                  </Badge>
                </div>
                {CATEGORY_DESCRIPTIONS[category] && (
                  <p className="text-[10px] text-muted-foreground/60 mb-2.5">
                    {CATEGORY_DESCRIPTIONS[category]}
                  </p>
                )}
                <div className="space-y-0.5">
                  {SHORTCUTS.filter(s => s.category === category).map((shortcut, i) => (
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
            ))}
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
