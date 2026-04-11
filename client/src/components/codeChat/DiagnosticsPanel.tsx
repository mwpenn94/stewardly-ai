/**
 * DiagnosticsPanel — Pass 251.
 *
 * Renders TypeScript compiler diagnostics as a grouped-by-file tree.
 * Backed by the `codeChat.getTsDiagnostics` tRPC query which shells
 * out to `tsc --noEmit --pretty false` and caches the result for
 * 30s. Each diagnostic row is clickable and dispatches a
 * `codechat-open-file` event that jumps the FileBrowser to the
 * error site.
 *
 * Claude Code parity note: Claude Code surfaces LSP diagnostics
 * inline through the IDE extension. Since Stewardly's Code Chat runs
 * in a web UI we can't hook the language server directly, but we can
 * bring the same information to the user by polling the project
 * compiler. 30s cache + manual rebuild keeps it cheap.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Severity = "error" | "warning" | "info";

const SEVERITY_STYLE: Record<Severity, string> = {
  error: "border-destructive/40 text-destructive bg-destructive/5",
  warning: "border-amber-500/40 text-amber-500 bg-amber-500/5",
  info: "border-chart-3/40 text-chart-3 bg-chart-3/5",
};

function severityIcon(severity: Severity) {
  if (severity === "error") return <AlertCircle className="w-3 h-3" />;
  if (severity === "warning") return <AlertTriangle className="w-3 h-3" />;
  return <Info className="w-3 h-3" />;
}

function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export default function DiagnosticsPanel() {
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = trpc.codeChat.getTsDiagnostics.useQuery(
    {
      severity: severityFilter,
      search: search || undefined,
      limit: 500,
    },
    { refetchOnWindowFocus: false, staleTime: 15_000 },
  );
  const rebuild = trpc.codeChat.rebuildTsDiagnostics.useMutation({
    onSuccess: (result) => {
      if (result.fatalError) {
        toast.error(`tsc: ${result.fatalError}`);
      } else {
        toast.success(
          `Rebuilt — ${result.total} diagnostic${result.total === 1 ? "" : "s"} in ${Math.round(result.durationMs / 100) / 10}s`,
        );
      }
      query.refetch();
    },
    onError: (err) => toast.error(`Rebuild failed: ${err.message}`),
  });

  const toggleFile = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    if (!query.data?.groups) return;
    setExpanded(new Set(query.data.groups.map((g) => g.path)));
  };

  const collapseAll = () => setExpanded(new Set());

  const handleJump = (path: string, line: number, column: number) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path, line, column },
      }),
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-accent" />
          TypeScript diagnostics
          {query.data && !query.isFetching && (
            <Badge variant="outline" className="text-[10px]">
              {query.data.cached ? "cached" : "fresh"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search messages, codes, paths…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs max-w-xs"
          />
          <div className="flex gap-1">
            {(["all", "error", "warning", "info"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={`px-2 py-0.5 rounded border text-[10px] capitalize ${
                  severityFilter === s
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={expandAll} className="text-xs">
              Expand all
            </Button>
            <Button size="sm" variant="ghost" onClick={collapseAll} className="text-xs">
              Collapse
            </Button>
            <Button
              size="sm"
              onClick={() => rebuild.mutate()}
              disabled={rebuild.isPending}
              className="text-xs"
            >
              {rebuild.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Run tsc
            </Button>
          </div>
        </div>

        {query.isLoading && !query.data && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Running tsc…
          </div>
        )}

        {query.data && (
          <>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <Badge variant="outline" className={SEVERITY_STYLE.error}>
                {query.data.summary.errors} error{query.data.summary.errors === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className={SEVERITY_STYLE.warning}>
                {query.data.summary.warnings} warning{query.data.summary.warnings === 1 ? "" : "s"}
              </Badge>
              {query.data.summary.info > 0 && (
                <Badge variant="outline" className={SEVERITY_STYLE.info}>
                  {query.data.summary.info} info
                </Badge>
              )}
              <span className="text-muted-foreground">
                {query.data.summary.fileCount} file{query.data.summary.fileCount === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground/70 ml-auto">
                {formatRelativeTime(query.data.startedAt)} · {Math.round(query.data.durationMs / 100) / 10}s
              </span>
            </div>

            {query.data.fatalError && (
              <div className="p-3 rounded border border-destructive/40 bg-destructive/5 text-[11px] text-destructive font-mono whitespace-pre-wrap">
                <strong>tsc error:</strong> {query.data.fatalError}
              </div>
            )}

            {query.data.total === 0 ? (
              <div className="text-center py-12 text-xs text-emerald-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
                No TypeScript issues — all clear.
              </div>
            ) : (
              <div className="space-y-1">
                {query.data.groups.map((group) => {
                  const isOpen = expanded.has(group.path);
                  const errorCount = group.diagnostics.filter(
                    (d) => d.severity === "error",
                  ).length;
                  const warnCount = group.diagnostics.filter(
                    (d) => d.severity === "warning",
                  ).length;
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
                        <span className="font-mono truncate flex-1">{group.path}</span>
                        {errorCount > 0 && (
                          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${SEVERITY_STYLE.error}`}>
                            {errorCount}
                          </Badge>
                        )}
                        {warnCount > 0 && (
                          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${SEVERITY_STYLE.warning}`}>
                            {warnCount}
                          </Badge>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border/20">
                          {group.diagnostics.map((d, idx) => (
                            <button
                              key={`${d.line}-${d.column}-${idx}`}
                              type="button"
                              onClick={() => handleJump(group.path, d.line, d.column)}
                              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/20 border-t border-border/10 flex items-start gap-2"
                              title={`Jump to ${d.line}:${d.column}`}
                            >
                              <span className="shrink-0">
                                {severityIcon(d.severity as Severity)}
                              </span>
                              <span className="text-muted-foreground tabular-nums shrink-0 w-16">
                                {d.line}:{d.column}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1.5 shrink-0"
                              >
                                {d.code}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="break-words">{d.message}</div>
                                {d.details.map((detail, i) => (
                                  <div
                                    key={i}
                                    className="text-muted-foreground/80 text-[10px] pl-2 border-l border-border/30 mt-0.5"
                                  >
                                    {detail}
                                  </div>
                                ))}
                              </div>
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
      </CardContent>
    </Card>
  );
}
