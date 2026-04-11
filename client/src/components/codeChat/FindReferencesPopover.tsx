/**
 * FindReferencesPopover — Pass 252.
 *
 * Workspace-wide "Find All References" modal. Enter a symbol name
 * and every usage site across the codebase comes back grouped by
 * file with kind badges (import / definition / call / property /
 * reference). Clicking a hit dispatches `codechat-open-file` with
 * line+column so the FileBrowser jumps there.
 *
 * Shortcut: Shift+F12 (VS Code convention). Also opens from the
 * action palette as `open:references`.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  Search,
  ArrowUpRight,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RefKind = "import" | "definition" | "call" | "property" | "reference";

const KIND_STYLE: Record<RefKind, string> = {
  import: "border-chart-3/40 text-chart-3 bg-chart-3/5",
  definition: "border-emerald-500/40 text-emerald-500 bg-emerald-500/5",
  call: "border-accent/40 text-accent bg-accent/5",
  property: "border-chart-2/40 text-chart-2 bg-chart-2/5",
  reference: "border-border text-muted-foreground bg-muted/10",
};

interface FindReferencesPopoverProps {
  open: boolean;
  onClose: () => void;
  /** Optional pre-filled query from outside (e.g. palette-dispatched) */
  initialQuery?: string;
}

export default function FindReferencesPopover({
  open,
  onClose,
  initialQuery = "",
}: FindReferencesPopoverProps) {
  const [draftQuery, setDraftQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [includeComments, setIncludeComments] = useState(true);
  const [kindFilter, setKindFilter] = useState<RefKind | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraftQuery(initialQuery);
      setCommittedQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialQuery]);

  const query = trpc.codeChat.findReferences.useQuery(
    {
      name: committedQuery,
      includeComments,
      kinds: kindFilter === "all" ? undefined : [kindFilter],
      limit: 500,
    },
    {
      enabled: open && committedQuery.length >= 2,
      staleTime: 15_000,
    },
  );

  const groups = query.data?.groups ?? [];

  // Auto-expand the first 3 files when a new result arrives so users
  // see something immediately without manual clicks.
  useEffect(() => {
    if (query.data && groups.length > 0) {
      setExpanded(new Set(groups.slice(0, 3).map((g) => g.path)));
    }
  }, [query.data]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = draftQuery.trim();
    if (trimmed.length >= 2) setCommittedQuery(trimmed);
  };

  const toggleFile = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleJump = (path: string, line: number, column: number) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path, line, column },
      }),
    );
    onClose();
  };

  const summary = query.data?.summary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Find references"
    >
      <div
        className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Search className="h-4 w-4 text-accent shrink-0" />
          <Input
            ref={inputRef}
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Symbol name (≥2 chars) — press Enter to search"
            className="flex-1 text-sm"
          />
          <Button size="sm" onClick={handleSubmit} disabled={draftQuery.trim().length < 2}>
            Find
          </Button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 text-xs">
          <div className="flex gap-1">
            {(["all", "import", "definition", "call", "property", "reference"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`px-2 py-0.5 rounded border text-[10px] capitalize ${
                  kindFilter === k
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={includeComments}
              onChange={(e) => setIncludeComments(e.target.checked)}
            />
            <span className="text-muted-foreground">include comments</span>
          </label>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {committedQuery.length < 2 && (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Enter a symbol name (2+ characters) and press Enter.
            </div>
          )}

          {committedQuery.length >= 2 && query.isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Scanning workspace for <code className="mx-1">{committedQuery}</code>…
            </div>
          )}

          {query.data && (
            <>
              <div className="flex items-center gap-3 text-xs flex-wrap mb-3">
                <Badge variant="outline" className="text-[10px]">
                  {query.data.total} hit{query.data.total === 1 ? "" : "s"}
                </Badge>
                {summary && (
                  <>
                    {summary.byKind.definition > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${KIND_STYLE.definition}`}>
                        {summary.byKind.definition} def
                      </Badge>
                    )}
                    {summary.byKind.import > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${KIND_STYLE.import}`}>
                        {summary.byKind.import} import
                      </Badge>
                    )}
                    {summary.byKind.call > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${KIND_STYLE.call}`}>
                        {summary.byKind.call} call
                      </Badge>
                    )}
                    {summary.byKind.property > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${KIND_STYLE.property}`}>
                        {summary.byKind.property} prop
                      </Badge>
                    )}
                    {summary.byKind.reference > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${KIND_STYLE.reference}`}>
                        {summary.byKind.reference} ref
                      </Badge>
                    )}
                  </>
                )}
                <span className="text-muted-foreground/70 ml-auto">
                  {query.data.filesScanned} files scanned
                  {query.data.truncated && " (truncated)"}
                </span>
              </div>

              {query.data.total === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No references found for <code>{committedQuery}</code>.
                </div>
              ) : (
                <div className="space-y-1">
                  {groups.map((group) => {
                    const isOpen = expanded.has(group.path);
                    return (
                      <div
                        key={group.path}
                        className="border border-border/40 rounded overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFile(group.path)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/30 transition-colors text-left"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3 h-3 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 shrink-0" />
                          )}
                          <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="font-mono truncate flex-1">
                            {group.path}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            {group.hits.length}
                          </Badge>
                        </button>
                        {isOpen && (
                          <div className="border-t border-border/20 bg-background/40">
                            {group.hits.map((h, i) => (
                              <button
                                key={`${h.line}-${h.column}-${i}`}
                                type="button"
                                onClick={() => handleJump(group.path, h.line, h.column)}
                                className="w-full flex items-start gap-2 px-3 py-1 text-[11px] text-left hover:bg-secondary/20 border-t border-border/10 first:border-t-0"
                                title={`Open ${group.path}:${h.line}:${h.column}`}
                              >
                                <span className="text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                                  {h.line}:{h.column}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] h-4 px-1.5 shrink-0 ${KIND_STYLE[h.kind as RefKind] ?? KIND_STYLE.reference}`}
                                >
                                  {h.kind}
                                </Badge>
                                <span className="font-mono flex-1 min-w-0 truncate text-foreground/90">
                                  {h.text}
                                </span>
                                <ArrowUpRight className="w-3 h-3 text-muted-foreground shrink-0 opacity-60" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
