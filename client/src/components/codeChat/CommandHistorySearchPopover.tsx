/**
 * CommandHistorySearchPopover — terminal-style Ctrl+R reverse-search
 * over the Code Chat command history (Pass 216).
 *
 * Parent owns history array + focus; this component only renders
 * the search UI.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  searchHistory,
  highlightEntry,
  type HistoryMatch,
} from "./commandHistorySearch";
import { Search, X, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function CommandHistorySearchPopover({
  open,
  onClose,
  history,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  history: string[];
  onSelect: (entry: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus the search input on open
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const matches: HistoryMatch[] = useMemo(
    () => searchHistory(history, query, 30),
    [history, query],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[activeIdx]) {
        onSelect(matches[activeIdx].entry);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-24"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command history search"
    >
      <div
        className="relative w-full max-w-xl rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <Search className="h-4 w-4 text-accent shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reverse-search command history…"
            className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 shadow-none px-0"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground italic p-4 text-center">
              {history.length === 0
                ? "No command history yet. Send a message first."
                : `No matches for "${query}"`}
            </p>
          ) : (
            <ul role="listbox">
              {matches.map((m, idx) => {
                const segments = highlightEntry(m.entry, m.indices);
                return (
                  <li
                    key={`${m.entry}-${idx}`}
                    role="option"
                    aria-selected={idx === activeIdx}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs ${
                      idx === activeIdx
                        ? "bg-accent/10"
                        : "hover:bg-secondary/30"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(m.entry);
                    }}
                  >
                    <Clock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    <span className="font-mono truncate flex-1">
                      {segments.map((seg, i) => (
                        <span
                          key={i}
                          className={
                            seg.highlight ? "text-accent font-semibold" : ""
                          }
                        >
                          {seg.text}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border/30 bg-muted/20 text-[10px] text-muted-foreground flex items-center gap-3">
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[9px]">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[9px]">
              ↵
            </kbd>{" "}
            insert
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[9px]">
              Esc
            </kbd>{" "}
            close
          </span>
          <span className="ml-auto font-mono">
            {matches.length} / {history.length}
          </span>
        </div>
      </div>
    </div>
  );
}
