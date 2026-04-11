/**
 * SubagentsPopover — pick a specialized subagent for Code Chat
 * (Pass 253).
 *
 * Surfaces the agents defined in `.stewardly/agents/*.md`, lets
 * the user activate one for the next send, and shows the selected
 * agent's prompt preview + tool allowlist. Matches Claude Code's
 * Task-tool UX.
 *
 * The popover is purely a picker — the actual overlay + tool
 * intersection happens server-side via codeChatStream once the
 * selected slug is forwarded through useCodeChatStream.
 */

import { useState, useMemo } from "react";
import { X, Users, RefreshCw, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface SubagentsPopoverProps {
  open: boolean;
  onClose: () => void;
  activeSlug: string | null;
  onPick: (slug: string | null) => void;
}

export default function SubagentsPopover({
  open,
  onClose,
  activeSlug,
  onPick,
}: SubagentsPopoverProps) {
  const [filter, setFilter] = useState("");
  const query = trpc.codeChat.listSubagents.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const reload = trpc.codeChat.reloadSubagents.useMutation({
    onSuccess: () => query.refetch(),
  });

  const filtered = useMemo(() => {
    const agents = query.data?.agents ?? [];
    if (!filter.trim()) return agents;
    const q = filter.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [query.data, filter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Subagents"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-accent shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Subagents
            </h2>
            {query.data && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground font-mono"
              >
                {query.data.agents.length} defined
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => reload.mutate()}
              disabled={reload.isPending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Reload subagents from disk"
              title="Reload from disk"
            >
              <RefreshCw
                className={`h-4 w-4 ${reload.isPending ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close subagents"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground px-5 py-2 border-b border-border/30">
          Define specialized agents in{" "}
          <code className="px-1 rounded bg-muted/40 font-mono">
            .stewardly/agents/&lt;slug&gt;.md
          </code>{" "}
          with YAML frontmatter (name, description, model, tools) and a
          markdown body as the system prompt. Picking an agent overlays its
          prompt onto the next send and intersects its tool allowlist with
          yours.
        </p>

        <div className="px-5 py-2 border-b border-border/30 bg-background/40 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, slug, or description…"
            className="h-7 text-xs flex-1 min-w-0 border-border/40"
            aria-label="Filter subagents"
          />
          {activeSlug && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onPick(null);
                onClose();
              }}
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear active
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {query.isLoading && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              Loading subagents…
            </p>
          )}
          {query.isError && (
            <p className="text-xs text-destructive italic text-center py-8">
              Failed to load subagents:{" "}
              {query.error?.message ?? "unknown error"}
            </p>
          )}
          {query.data && !query.data.scanned && (
            <div className="text-xs text-muted-foreground py-6 text-center space-y-2">
              <p className="italic">
                No subagents directory found.
              </p>
              <p>
                Create{" "}
                <code className="px-1 rounded bg-muted/40 font-mono">
                  .stewardly/agents/
                </code>{" "}
                and drop one or more{" "}
                <code className="px-1 rounded bg-muted/40 font-mono">
                  .md
                </code>{" "}
                files in it.
              </p>
            </div>
          )}
          {query.data?.scanned && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              {query.data.agents.length === 0
                ? "No agents defined yet."
                : `No agents matching "${filter}".`}
            </p>
          )}
          {query.data?.errors && query.data.errors.length > 0 && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[10px]">
              <div className="font-medium text-destructive mb-1">
                Load errors
              </div>
              {query.data.errors.map((e, i) => (
                <div key={i} className="text-muted-foreground">
                  <code className="font-mono">{e.path}</code>: {e.message}
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1.5">
            {filtered.map((a) => {
              const isActive = a.slug === activeSlug;
              return (
                <li
                  key={a.slug}
                  className={`rounded-lg border overflow-hidden transition-colors ${
                    isActive
                      ? "border-accent/60 bg-accent/5"
                      : "border-border/40 bg-background/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPick(isActive ? null : a.slug);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 space-y-1 hover:bg-accent/5"
                    aria-pressed={isActive}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isActive && (
                        <Check className="h-3 w-3 text-accent shrink-0" />
                      )}
                      <span className="text-xs font-medium">{a.name}</span>
                      <code className="text-[9px] font-mono text-muted-foreground">
                        {a.slug}
                      </code>
                      {a.model && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 border-chart-2/40 text-chart-2 bg-chart-2/5"
                        >
                          {a.model}
                        </Badge>
                      )}
                      {a.tools.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 border-accent/40 text-accent bg-accent/5"
                          title={a.tools.join(", ")}
                        >
                          {a.tools.length} tool
                          {a.tools.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[11px] text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                    {a.promptPreview && (
                      <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2">
                        {a.promptPreview}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
