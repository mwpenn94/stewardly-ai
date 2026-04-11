/**
 * Keyboard shortcut help overlay (Pass 6 — learning experience).
 *
 * Every session page in the learning flow (Flashcard study, Quiz
 * runner, Review session, Exam simulator) exposes keyboard shortcuts
 * that were added in Pass 1. Before this component existed, the
 * shortcuts were surfaced only as a single-line footer hint like
 * "Space to flip · 1 wrong · 2 right · Esc to exit" — fine for power
 * users who already know them but invisible to everyone else.
 *
 * This component renders a `?`-triggered modal that lists every
 * shortcut available on the current page, grouped by category. The
 * `?` hotkey is bound at the component level so every session page
 * gets the overlay by dropping in a single <KeyboardHelpOverlay
 * shortcuts={...} />.
 *
 * Following the WCAG 2.1 "visible focus indicator" pattern: the
 * overlay is keyboard-only discoverable today. A future pass can
 * add a persistent `?` button in a session header if UX research
 * says users aren't discovering it.
 */

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Keyboard, X } from "lucide-react";

export interface KeyboardShortcut {
  /** The key or key combination, e.g. "Space", "1 / W", "Esc". */
  keys: string;
  /** Human-readable description of what the shortcut does. */
  label: string;
  /** Optional group so the overlay renders logical sections. */
  group?: string;
}

interface Props {
  /** The shortcut list to render in the overlay. */
  shortcuts: KeyboardShortcut[];
  /** Optional page title shown at the top of the overlay. */
  title?: string;
}

export function KeyboardHelpOverlay({ shortcuts, title = "Keyboard shortcuts" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when the user is typing somewhere
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        // Only intercept Escape when the overlay is open — other Esc
        // handlers (like "exit session") should still fire when it
        // isn't. Can't use `e.stopPropagation()` here because the
        // session page's handler is on the same window listener.
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  // Group shortcuts by category for legibility. Ungrouped entries
  // go under "General".
  const grouped: Record<string, KeyboardShortcut[]> = {};
  for (const s of shortcuts) {
    const g = s.group ?? "General";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }
  const groupKeys = Object.keys(grouped);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
      onClick={() => setOpen(false)}
    >
      <Card
        className="max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-accent" />
              <h2 id="keyboard-help-title" className="font-heading font-semibold">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close keyboard help"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {groupKeys.map((groupKey) => (
            <div key={groupKey} className="space-y-1.5">
              {groupKeys.length > 1 && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupKey}
                </p>
              )}
              <ul className="space-y-1.5">
                {grouped[groupKey].map((s, i) => (
                  <li
                    key={`${groupKey}-${i}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">{s.label}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] shrink-0"
                    >
                      {s.keys}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-[11px] text-muted-foreground border-t pt-3">
            Press <kbd className="font-mono">?</kbd> to toggle this overlay.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
