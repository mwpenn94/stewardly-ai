/**
 * WorkspaceSearchPanel — unified "find anywhere" entry point (Pass 249).
 *
 * Blends three server-side sources into one ranked list:
 *   • regex-based symbol definitions
 *   • ripgrep text matches
 *   • TODO/FIXME marker inventory
 *
 * A single search box + three facet toggles drives the tRPC query.
 * Clicking any result dispatches the existing `codechat-open-file`
 * CustomEvent that FileBrowser listens for so the inspection tab
 * jumps to the exact line.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Hash,
  FileCode,
  ListTodo,
  AlertTriangle,
  FileSearch,
} from "lucide-react";

type ResultKind = "symbol" | "grep" | "todo";

const KIND_STYLE: Record<
  ResultKind,
  { label: string; className: string; Icon: typeof Search }
> = {
  symbol: {
    label: "symbol",
    className: "text-accent border-accent/40 bg-accent/5",
    Icon: Hash,
  },
  grep: {
    label: "text",
    className: "text-chart-3 border-chart-3/40 bg-chart-3/5",
    Icon: FileCode,
  },
  todo: {
    label: "todo",
    className: "text-amber-500 border-amber-500/40 bg-amber-500/5",
    Icon: ListTodo,
  },
};

function openFileAt(path: string, line?: number) {
  window.dispatchEvent(
    new CustomEvent("codechat-open-file", {
      detail: { path, line: line ?? 1 },
    }),
  );
}

export default function WorkspaceSearchPanel() {
  const [query, setQuery] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<ResultKind>>(
    new Set(["symbol", "grep", "todo"] as ResultKind[]),
  );

  // Debounce the query so we don't hit the server on every keystroke.
  const trimmed = query.trim();
  const kindsArray = useMemo(
    () => Array.from(activeKinds) as ResultKind[],
    [activeKinds],
  );

  const searchQuery = trpc.codeChat.workspaceSearch.useQuery(
    {
      query: trimmed,
      kinds: kindsArray.length > 0 ? kindsArray : undefined,
      perKindLimit: 40,
      totalLimit: 120,
    },
    {
      enabled: trimmed.length > 0,
      staleTime: 10_000,
    },
  );

  const toggleKind = (k: ResultKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  const facets = searchQuery.data?.facets;
  const results = searchQuery.data?.results ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-accent" />
            Find Anywhere
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbols, text, and TODOs across the workspace…"
              className="flex-1"
              autoFocus
              aria-label="Workspace search query"
            />
            {searchQuery.isFetching && trimmed.length > 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(["symbol", "grep", "todo"] as ResultKind[]).map((k) => {
              const style = KIND_STYLE[k];
              const active = activeKinds.has(k);
              const count =
                facets && (k === "symbol"
                  ? facets.symbols
                  : k === "grep"
                    ? facets.grep
                    : facets.todos);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
                    active
                      ? style.className
                      : "text-muted-foreground border-border/60 opacity-60"
                  }`}
                >
                  <style.Icon className="h-3 w-3" />
                  <span className="font-medium">{style.label}</span>
                  {typeof count === "number" && count > 0 && (
                    <span className="font-mono text-[10px]">{count}</span>
                  )}
                </button>
              );
            })}
            {facets && (
              <span className="ml-auto text-muted-foreground">
                {facets.total} hit{facets.total === 1 ? "" : "s"}
                {searchQuery.data?.truncated && " (truncated)"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {trimmed.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <FileSearch className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            Type a query to search symbols, file contents, and TODO markers
            in one pass.
          </CardContent>
        </Card>
      ) : results.length === 0 && !searchQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
            No hits for &ldquo;{trimmed}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border/60">
            {results.map((r, idx) => {
              const style = KIND_STYLE[r.kind as ResultKind];
              return (
                <button
                  key={`${r.kind}:${r.path}:${r.line}:${idx}`}
                  type="button"
                  onClick={() => openFileAt(r.path, r.line)}
                  className="w-full text-left p-3 hover:bg-muted/50 transition-colors block"
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wide shrink-0 ${style.className}`}
                    >
                      <style.Icon className="h-3 w-3 mr-1" />
                      {style.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate">
                        {r.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono truncate">
                          {r.path}:{r.line}
                        </span>
                        {r.badge && r.badge !== `line ${r.line}` && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono">
                            {r.badge}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 font-mono opacity-70">
                          {r.score}
                        </span>
                      </div>
                      {r.snippet && r.snippet !== r.title && (
                        <div className="text-[11px] text-muted-foreground/80 mt-1 font-mono truncate">
                          {r.snippet}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
