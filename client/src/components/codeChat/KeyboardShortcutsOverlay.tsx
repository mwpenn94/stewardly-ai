/**
 * KeyboardShortcutsOverlay — discoverable ⌘/ or `?` help modal
 * (Pass 209).
 *
 * Lists every keyboard shortcut + slash command the Code Chat
 * supports so new users can see what's available without hunting
 * through docs. Opened by pressing `?` (when the chat input is
 * empty) or the keyboard icon in the config bar.
 */

import { X } from "lucide-react";
import { BUILT_IN_COMMANDS } from "./slashCommands";

export interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in input" },
  { keys: ["↑"], description: "Previous prompt from history (empty input)" },
  { keys: ["↓"], description: "Newer prompt from history" },
  { keys: ["Ctrl", "R"], description: "Reverse-search command history" },
  { keys: ["Esc"], description: "Abort a running ReAct loop", context: "while executing" },
  { keys: ["/"], description: "Open slash command picker", context: "at start of input" },
  { keys: ["@"], description: "Open file mention picker", context: "anywhere in input" },
  { keys: ["Tab"], description: "Accept selected picker item" },
  { keys: ["?"], description: "Open this help overlay", context: "while input is empty" },
  { keys: ["g", "c"], description: "Go to Chat tab", context: "chord — outside text fields" },
  { keys: ["g", "f"], description: "Go to Files tab" },
  { keys: ["g", "r"], description: "Go to Roadmap tab" },
  { keys: ["g", "d"], description: "Go to Diff tab" },
  { keys: ["g", "h"], description: "Go to GitHub tab" },
  { keys: ["g", "w"], description: "Go to Git Write tab" },
  { keys: ["g", "j"], description: "Go to Jobs tab" },
];

export default function KeyboardShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close shortcuts overlay"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-1">
          Code Chat keyboard shortcuts
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Every way to drive the Code Chat from the keyboard
        </p>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Chat input
          </h3>
          <ul className="space-y-1.5">
            {DEFAULT_SHORTCUTS.map((s) => (
              <li key={s.description} className="flex items-center gap-3 text-xs">
                <div className="flex gap-1 shrink-0">
                  {s.keys.map((k, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-[10px] text-foreground"
                    >
                      {k}
                    </span>
                  ))}
                </div>
                <span className="text-muted-foreground">{s.description}</span>
                {s.context && (
                  <span className="text-muted-foreground/60 italic text-[10px]">
                    ({s.context})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Slash commands
          </h3>
          <ul className="space-y-1.5">
            {BUILT_IN_COMMANDS.map((c) => (
              <li
                key={c.name}
                className="flex items-center gap-3 text-xs font-mono"
              >
                <code className="text-accent shrink-0 w-32">
                  /{c.name}
                  {c.args ? ` ${c.args}` : ""}
                </code>
                <span className="text-muted-foreground truncate">
                  {c.description}
                </span>
                {c.aliases && c.aliases.length > 0 && (
                  <span className="text-muted-foreground/50 text-[9px] ml-auto shrink-0">
                    {c.aliases.map((a) => `/${a}`).join(" ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
