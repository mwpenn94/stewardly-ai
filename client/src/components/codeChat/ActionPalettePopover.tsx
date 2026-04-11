/**
 * ActionPalettePopover — unified ⌘K action launcher (Pass 248).
 *
 * Ties every Code Chat action (tabs, popovers, slash commands,
 * workspace actions) into a single fuzzy-searchable palette bound
 * to ⌘K / Ctrl+K. Arrow keys navigate, Enter selects, Esc closes.
 *
 * The parent passes an `onRun` handler that takes an action id and
 * dispatches it. This keeps the palette decoupled from the rest of
 * the Code Chat state and testable in isolation.
 */

import { useState, useEffect, useRef } from "react";
import { X, Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  filterActions,
  groupByCategory,
  DEFAULT_ACTIONS,
  type PaletteAction,
  type PaletteCategory,
} from "./actionPalette";

const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  tab: "Tabs",
  popover: "Popovers",
  slash: "Slash commands",
  shortcut: "Shortcuts",
  workspace: "Workspace",
};

interface ActionPalettePopoverProps {
  open: boolean;
  onClose: () => void;
  onRun: (actionId: string) => void;
  actions?: PaletteAction[];
}

export default function ActionPalettePopover({
  open,
  onClose,
  onRun,
  actions = DEFAULT_ACTIONS,
}: ActionPalettePopoverProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filterActions(actions, query, 50);
  const groups = query ? [{ category: "tab" as const, items: filtered }] : groupByCategory(filtered);
  // Flatten for keyboard navigation
  const flat = query ? filtered : groups.flatMap((g) => g.items);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  if (!open) return null;

  const handleSelect = (idx: number) => {
    const action = flat[idx];
    if (!action) return;
    onRun(action.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(activeIdx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Action palette"
    >
      <div
        className="relative w-full max-w-xl max-h-[70vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Command className="h-4 w-4 text-accent shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to anything… (⌘K)"
            className="border-0 bg-transparent focus-visible:ring-0 text-sm"
            aria-label="Action palette search"
          />
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {flat.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No actions match "{query}"
            </p>
          ) : query ? (
            <ul>
              {flat.map((action, idx) => (
                <PaletteRow
                  key={action.id}
                  action={action}
                  isActive={idx === activeIdx}
                  onSelect={() => handleSelect(idx)}
                  onHover={() => setActiveIdx(idx)}
                />
              ))}
            </ul>
          ) : (
            <>
              {groupByCategory(filtered).map((group, gi) => {
                // Compute the global index offset for this group
                const offset = groupByCategory(filtered)
                  .slice(0, gi)
                  .reduce((acc, g) => acc + g.items.length, 0);
                return (
                  <section key={group.category}>
                    <div className="px-4 py-1 text-[9px] uppercase tracking-wide text-muted-foreground/70 font-mono bg-background/40 border-b border-border/20">
                      {CATEGORY_LABELS[group.category]}
                    </div>
                    <ul>
                      {group.items.map((action, idx) => {
                        const globalIdx = offset + idx;
                        return (
                          <PaletteRow
                            key={action.id}
                            action={action}
                            isActive={globalIdx === activeIdx}
                            onSelect={() => handleSelect(globalIdx)}
                            onHover={() => setActiveIdx(globalIdx)}
                          />
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-border/40 bg-background/40 text-[9px] text-muted-foreground font-mono">
          <span>↑↓ navigate · Enter run · Esc close</span>
          <span>⌘K to reopen</span>
        </div>
      </div>
    </div>
  );
}

function PaletteRow({
  action,
  isActive,
  onSelect,
  onHover,
}: {
  action: PaletteAction;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left transition-colors ${
          isActive ? "bg-accent/10 border-l-2 border-accent" : "border-l-2 border-transparent hover:bg-secondary/20"
        }`}
      >
        <span className="text-xs text-foreground truncate">{action.label}</span>
        {action.hint && (
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground font-mono shrink-0"
          >
            {action.hint}
          </Badge>
        )}
      </button>
    </li>
  );
}
