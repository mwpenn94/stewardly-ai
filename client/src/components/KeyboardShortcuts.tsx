import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Chat
  { keys: ["Ctrl", "Shift", "N"], description: "New conversation", category: "Chat" },
  { keys: ["Ctrl", "Shift", "S"], description: "Toggle sidebar", category: "Chat" },
  { keys: ["Ctrl", "K"], description: "Search conversations", category: "Chat" },
  { keys: ["/"], description: "Focus chat input", category: "Chat" },
  { keys: ["Esc"], description: "Close menus / cancel", category: "Chat" },

  // Navigation
  { keys: ["G", "then", "C"], description: "Go to Chat", category: "Navigation" },
  { keys: ["G", "then", "S"], description: "Go to Settings", category: "Navigation" },
  { keys: ["G", "then", "H"], description: "Go to Help", category: "Navigation" },

  // General
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General" },
  { keys: ["Ctrl", "Enter"], description: "Send message", category: "General" },
  { keys: ["Shift", "Enter"], description: "New line in message", category: "General" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <p className="text-[10px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">?</kbd> to toggle</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5 max-h-[calc(80vh-4rem)]">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {category}
              </h3>
              <div className="space-y-1">
                {SHORTCUTS.filter(s => s.category === category).map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        key === "then" ? (
                          <span key={ki} className="text-[10px] text-muted-foreground mx-0.5">then</span>
                        ) : (
                          <kbd
                            key={ki}
                            className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-secondary border border-border text-[11px] font-mono font-medium text-foreground shadow-sm"
                          >
                            {key}
                          </kbd>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/50">
          <p className="text-[10px] text-muted-foreground text-center">
            On macOS, use <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">⌘</kbd> instead of <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">Ctrl</kbd>
          </p>
        </div>
      </div>
    </div>
  );
}
