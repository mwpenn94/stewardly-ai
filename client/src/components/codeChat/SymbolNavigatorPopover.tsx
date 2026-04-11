/**
 * SymbolNavigatorPopover — VS-Code-style "Go to Symbol" (Pass 242).
 *
 * Fuzzy-search the workspace symbol index and jump to the definition
 * site. Opens with Ctrl+T / Cmd+T. Selecting a result dispatches the
 * existing `codechat-open-file` custom event so the FileBrowser
 * swaps the active tab + loads the file.
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { X, Search, FunctionSquare, Box, Braces, Hash, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const KIND_ICONS: Record<string, typeof FunctionSquare> = {
  function: FunctionSquare,
  class: Box,
  interface: Braces,
  type: Sparkles,
  const: Hash,
  let: Hash,
  var: Hash,
  enum: Sparkles,
};

const KIND_COLORS: Record<string, string> = {
  function: "text-accent",
  class: "text-chart-2",
  interface: "text-chart-3",
  type: "text-chart-4",
  const: "text-muted-foreground",
  let: "text-muted-foreground",
  var: "text-muted-foreground",
  enum: "text-chart-3",
};

interface SymbolNavigatorPopoverProps {
  open: boolean;
  onClose: () => void;
}

export default function SymbolNavigatorPopover({
  open,
  onClose,
}: SymbolNavigatorPopoverProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultsQuery = trpc.codeChat.findSymbols.useQuery(
    { query, limit: 30 },
    { enabled: open, staleTime: 10_000 },
  );
  const statsQuery = trpc.codeChat.symbolIndexStats.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });

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

  const matches = resultsQuery.data?.matches ?? [];

  const handleSelect = (idx: number) => {
    const m = matches[idx];
    if (!m) return;
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path: m.path, line: m.line },
      }),
    );
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Symbol navigator"
    >
      <div
        className="relative w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Search className="h-4 w-4 text-accent shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Go to symbol… (start typing a function, class, or type name)"
            className="border-0 bg-transparent focus-visible:ring-0 text-sm"
            aria-label="Symbol search query"
          />
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close symbol navigator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats strip */}
        {statsQuery.data && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/30 bg-background/40 text-[10px] font-mono">
            <span className="text-muted-foreground">
              {statsQuery.data.total.toLocaleString()} symbols across{" "}
              {statsQuery.data.files} files
            </span>
            <span className="text-muted-foreground/50">·</span>
            {(["function", "class", "interface", "type"] as const).map((k) => (
              <span key={k} className="text-muted-foreground">
                {k}: {statsQuery.data.byKind[k]}
              </span>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {resultsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              Loading index…
            </p>
          ) : matches.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              {query ? `No symbols match "${query}"` : "Start typing to search…"}
            </p>
          ) : (
            <ul>
              {matches.map((m, idx) => {
                const Icon = KIND_ICONS[m.kind] ?? Hash;
                const color = KIND_COLORS[m.kind] ?? "text-muted-foreground";
                const isActive = idx === activeIdx;
                return (
                  <li key={`${m.path}:${m.line}:${m.name}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors ${
                        isActive
                          ? "bg-accent/10 border-l-2 border-accent"
                          : "border-l-2 border-transparent hover:bg-secondary/20"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-foreground">
                            {m.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[8px] h-4 px-1 border-border/60 text-muted-foreground"
                          >
                            {m.kind}
                          </Badge>
                          {m.exported && (
                            <Badge
                              variant="outline"
                              className="text-[8px] h-4 px-1 border-accent/40 text-accent"
                            >
                              export
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {m.path}:{m.line}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 font-mono truncate mt-0.5">
                          {m.snippet}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-border/40 bg-background/40 text-[9px] text-muted-foreground font-mono">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>⌘T / Ctrl+T to reopen</span>
        </div>
      </div>
    </div>
  );
}
