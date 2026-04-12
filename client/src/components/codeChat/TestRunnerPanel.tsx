/**
 * TestRunnerPanel — vitest integration (Pass 255).
 *
 * Runs `vitest run` server-side via the codeChat.runTests mutation
 * and renders the parsed results as a filterable panel with drill-down
 * per-file failures.
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
  TestTube,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type Status = "passed" | "failed" | "skipped" | "todo";

const STATUS_STYLE: Record<Status, { Icon: typeof CheckCircle2; className: string }> = {
  passed: { Icon: CheckCircle2, className: "text-emerald-500" },
  failed: { Icon: XCircle, className: "text-destructive" },
  skipped: { Icon: SkipForward, className: "text-muted-foreground" },
  todo: { Icon: AlertTriangle, className: "text-amber-500" },
};

export default function TestRunnerPanel() {
  const [pattern, setPattern] = useState("");
  const [search, setSearch] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<Status>>(
    new Set(["failed", "passed"] as Status[]),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<
    Awaited<ReturnType<typeof runTestsMutation.mutateAsync>> | null
  >(null);

  const runTestsMutation = trpc.codeChat.runTests.useMutation();

  const handleRun = async () => {
    try {
      const result = await runTestsMutation.mutateAsync({
        pattern: pattern || undefined,
        status: Array.from(activeStatuses) as Status[],
        search: search || undefined,
      });
      setLastResult(result);
      // Auto-expand failing files
      const failingPaths = new Set(
        result.files.filter((f) => f.status === "failed").map((f) => f.path),
      );
      setExpanded(failingPaths);
      if (result.summary.tests.failed === 0 && result.summary.tests.total > 0) {
        toast.success(`${result.summary.tests.total} tests passing`);
      } else if (result.summary.tests.failed > 0) {
        toast.error(
          `${result.summary.tests.failed} test${result.summary.tests.failed === 1 ? "" : "s"} failing`,
        );
      } else {
        toast.info("No tests found");
      }
    } catch (err: any) {
      toast.error(`Run failed: ${err.message ?? err}`);
    }
  };

  const toggleStatus = (s: Status) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!lastResult) return [];
    // Client-side re-filter for live search/status toggle without
    // re-running the tests
    return lastResult.files.filter((f) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(f.status as Status)) {
        return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const pathMatch = f.path.toLowerCase().includes(s);
        const failureMatch = f.failures.some((fl) =>
          fl.name.toLowerCase().includes(s),
        );
        if (!pathMatch && !failureMatch) return false;
      }
      return true;
    });
  }, [lastResult, activeStatuses, search]);

  const summary = lastResult?.summary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube className="h-4 w-4 text-accent" />
            Test Runner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Optional path or glob (e.g. server/services/codeChat)"
              className="font-mono text-xs h-8 flex-1"
              aria-label="Test pattern"
            />
            <Button
              size="sm"
              onClick={handleRun}
              disabled={runTestsMutation.isPending}
            >
              {runTestsMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1.5" />
              )}
              Run
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["passed", "failed", "skipped"] as Status[]).map((s) => {
              const style = STATUS_STYLE[s];
              const active = activeStatuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition capitalize ${
                    active
                      ? `border-current/40 ${style.className}`
                      : "text-muted-foreground border-border/60 opacity-60"
                  }`}
                >
                  <style.Icon className="h-3 w-3" />
                  {s}
                </button>
              );
            })}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by path or failure name…"
              className="h-7 text-xs flex-1 min-w-[180px]"
              aria-label="Filter tests"
            />
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {summary.tests.failed > 0 ? (
                <Badge
                  variant="outline"
                  className="text-destructive border-destructive/40"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  {summary.tests.failed} failing
                </Badge>
              ) : summary.tests.total > 0 ? (
                <Badge
                  variant="outline"
                  className="text-emerald-500 border-emerald-500/40"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All passing
                </Badge>
              ) : null}
              <span>
                <strong className="text-foreground">{summary.tests.passed}</strong>
                {" "}/ {summary.tests.total} tests
              </span>
              <span>
                <strong className="text-foreground">{summary.files.passed}</strong>
                {" "}/ {summary.files.total} files
              </span>
              {summary.durationMs !== undefined && (
                <span>{(summary.durationMs / 1000).toFixed(2)}s</span>
              )}
              {summary.exitCode !== undefined && (
                <span className="ml-auto">exit {summary.exitCode}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lastResult && filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No results match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const style = STATUS_STYLE[f.status as Status];
            const isExpanded = expanded.has(f.path);
            return (
              <Card key={f.path}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(f.path)}
                    className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <style.Icon className={`h-3.5 w-3.5 shrink-0 ${style.className}`} />
                    <span className="font-mono text-sm truncate flex-1">
                      {f.path}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {f.passed}/{f.totalTests}
                    </span>
                    {f.durationMs !== undefined && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {f.durationMs}ms
                      </span>
                    )}
                  </button>
                  {isExpanded && f.failures.length > 0 && (
                    <div className="divide-y divide-border/30 border-t border-border/40">
                      {f.failures.map((fail, idx) => (
                        <div
                          key={`${f.path}:${idx}`}
                          className="px-3 py-2 pl-10"
                        >
                          <div className="flex items-start gap-2 text-xs">
                            <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-destructive" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-destructive truncate">
                                {fail.name}
                              </div>
                              {fail.error && (
                                <div className="text-[11px] font-mono text-muted-foreground mt-1 break-words">
                                  {fail.error}
                                </div>
                              )}
                            </div>
                            {fail.durationMs !== undefined && (
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {fail.durationMs}ms
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && f.failures.length === 0 && f.status === "passed" && (
                    <div className="px-3 pb-3 pl-10 text-[11px] text-muted-foreground">
                      All {f.totalTests} tests passing.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!lastResult && !runTestsMutation.isPending && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <TestTube className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            Click Run to execute vitest and see results inline.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
