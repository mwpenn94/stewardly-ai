/**
 * DiagnosticsPanel — TS compile errors inline (Pass 252).
 *
 * Runs `tsc --noEmit` server-side via the getDiagnostics tRPC query
 * and renders the parsed output as a filterable problems panel.
 *
 * Click-through: every diagnostic row dispatches the existing
 * `codechat-open-file` CustomEvent so FileBrowser jumps to the exact
 * line.
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  CheckCircle2,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";

type Severity = "error" | "warning" | "info";

const SEVERITY_STYLE: Record<
  Severity,
  { Icon: typeof Info; className: string; label: string }
> = {
  error: {
    Icon: AlertCircle,
    className: "text-destructive border-destructive/40 bg-destructive/5",
    label: "error",
  },
  warning: {
    Icon: AlertTriangle,
    className: "text-amber-500 border-amber-500/40 bg-amber-500/5",
    label: "warning",
  },
  info: {
    Icon: Info,
    className: "text-muted-foreground border-border/60",
    label: "info",
  },
};

export default function DiagnosticsPanel() {
  const [search, setSearch] = useState("");
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(
    new Set(["error", "warning"] as Severity[]),
  );
  const [refreshing, setRefreshing] = useState(false);

  const diagnosticsQuery = trpc.codeChat.getDiagnostics.useQuery(
    {
      severity:
        selectedSeverities.size > 0
          ? (Array.from(selectedSeverities) as Severity[])
          : undefined,
      search: search || undefined,
      limit: 500,
    },
    { staleTime: 30_000 },
  );

  const refreshMutation = trpc.codeChat.refreshDiagnostics.useMutation();
  const utils = trpc.useUtils();

  const toggleSeverity = (s: Severity) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
      await utils.codeChat.getDiagnostics.invalidate();
      toast.success("Running tsc…");
    } catch (err: any) {
      toast.error(`Refresh failed: ${err.message ?? err}`);
    } finally {
      setRefreshing(false);
    }
  };

  const summary = diagnosticsQuery.data?.summary;
  const groups = diagnosticsQuery.data?.groups ?? [];
  const runMeta = diagnosticsQuery.data?.runMeta;
  const totalFiltered = diagnosticsQuery.data?.totalFiltered ?? 0;

  const openFile = (path: string, line: number) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path, line },
      }),
    );
  };

  const headerCounts = useMemo(() => {
    if (!summary) return null;
    return { errors: summary.errors, warnings: summary.warnings, infos: summary.infos };
  }, [summary]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-4 w-4 text-accent" />
            Diagnostics
            {headerCounts && (
              <>
                {headerCounts.errors > 0 && (
                  <Badge
                    variant="outline"
                    className="text-destructive border-destructive/40 font-mono"
                  >
                    {headerCounts.errors} error{headerCounts.errors === 1 ? "" : "s"}
                  </Badge>
                )}
                {headerCounts.warnings > 0 && (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500/40 font-mono"
                  >
                    {headerCounts.warnings} warning{headerCounts.warnings === 1 ? "" : "s"}
                  </Badge>
                )}
                {headerCounts.errors === 0 && headerCounts.warnings === 0 && (
                  <Badge
                    variant="outline"
                    className="text-emerald-500 border-emerald-500/40"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    clean
                  </Badge>
                )}
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 w-7 p-0"
              onClick={handleRefresh}
              disabled={refreshing || diagnosticsQuery.isFetching}
              aria-label="Refresh diagnostics"
            >
              {refreshing || diagnosticsQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["error", "warning", "info"] as Severity[]).map((s) => {
              const style = SEVERITY_STYLE[s];
              const active = selectedSeverities.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSeverity(s)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? style.className
                      : "text-muted-foreground border-border/60 opacity-60"
                  }`}
                >
                  <style.Icon className="h-3 w-3" />
                  <span className="font-medium">{style.label}</span>
                </button>
              );
            })}
            <div className="flex-1 min-w-[200px]">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by message, code, or path…"
                className="h-8 text-xs"
                aria-label="Filter diagnostics"
              />
            </div>
          </div>
          {runMeta && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-3">
              <span>
                Last run: {new Date(runMeta.startedAt).toLocaleTimeString()}
              </span>
              <span>·</span>
              <span>{(runMeta.durationMs / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span>exit {runMeta.exitCode}</span>
              {summary && summary.topRules.length > 0 && (
                <span className="ml-auto font-mono truncate">
                  top: {summary.topRules.slice(0, 3).map((r) => `${r.code}×${r.count}`).join(" ")}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {diagnosticsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto animate-spin" />
            <div className="mt-2">Running tsc --noEmit…</div>
          </CardContent>
        </Card>
      ) : totalFiltered === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            No diagnostics{search ? ` matching "${search}"` : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card key={group.path}>
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => openFile(group.path, group.diagnostics[0]?.line ?? 1)}
                  className="w-full text-left p-3 border-b border-border/40 hover:bg-muted/50 flex items-center gap-3"
                >
                  <span className="font-mono text-sm truncate flex-1">
                    {group.path}
                  </span>
                  {group.errorCount > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-destructive border-destructive/40"
                    >
                      {group.errorCount} error{group.errorCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {group.warningCount > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-500 border-amber-500/40"
                    >
                      {group.warningCount} warning{group.warningCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                </button>
                <div className="divide-y divide-border/30">
                  {group.diagnostics.map((d, idx) => {
                    const style = SEVERITY_STYLE[d.severity as Severity];
                    return (
                      <button
                        key={`${d.path}:${d.line}:${d.column}:${idx}`}
                        type="button"
                        onClick={() => openFile(d.path, d.line)}
                        className="w-full text-left p-2.5 hover:bg-muted/50 flex items-start gap-2"
                      >
                        <style.Icon
                          className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                            d.severity === "error"
                              ? "text-destructive"
                              : d.severity === "warning"
                                ? "text-amber-500"
                                : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="text-xs truncate">{d.message}</div>
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                            <span>
                              {d.line}:{d.column}
                            </span>
                            <span>·</span>
                            <span className="text-accent/80">{d.code}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
