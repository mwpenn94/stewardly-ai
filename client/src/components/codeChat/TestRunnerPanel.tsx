/**
 * TestRunnerPanel — Pass 258.
 *
 * Inline vitest runner. Users can run the full suite or a single
 * file/pattern, view per-file and per-test results, and click to
 * jump to failing test locations.
 */

import { useState } from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Status = "passed" | "failed" | "skipped" | "todo" | "pending";

const STATUS_STYLE: Record<string, string> = {
  passed: "border-emerald-500/40 text-emerald-500 bg-emerald-500/5",
  failed: "border-destructive/40 text-destructive bg-destructive/5",
  skipped: "border-muted text-muted-foreground bg-muted/10",
  todo: "border-muted text-muted-foreground bg-muted/10",
  pending: "border-muted text-muted-foreground bg-muted/10",
};

export default function TestRunnerPanel() {
  const [target, setTarget] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const run = trpc.codeChat.runTests.useMutation({
    onError: (err) => toast.error(`Test run failed: ${err.message}`),
  });

  const handleRun = () => {
    setExpanded(new Set());
    run.mutate({ target: target.trim() || undefined });
  };

  const toggleFile = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const result = run.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <Play className="w-4 h-4 text-accent" />
          Vitest runner
          {result && !run.isPending && (
            <Badge
              variant="outline"
              className={`text-[10px] ${
                result.ok
                  ? STATUS_STYLE.passed
                  : result.totalFailed > 0
                    ? STATUS_STYLE.failed
                    : STATUS_STYLE.skipped
              }`}
            >
              {result.totalPassed} passed · {result.totalFailed} failed
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target pattern (blank = full suite)"
            className="text-xs font-mono flex-1"
          />
          <Button size="sm" onClick={handleRun} disabled={run.isPending}>
            {run.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" /> Run
              </>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Example: <code>server/services/codeChat</code> runs every test file
          in that directory. Full-suite runs can take several minutes.
        </p>

        {run.isPending && !result && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Running vitest…
          </div>
        )}

        {result?.fatalError && (
          <div className="p-3 rounded border border-destructive/40 bg-destructive/5 text-[11px] text-destructive font-mono whitespace-pre-wrap max-h-40 overflow-auto">
            <strong>Fatal:</strong> {result.fatalError}
          </div>
        )}

        {result && !result.fatalError && (
          <>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <Badge variant="outline" className={STATUS_STYLE.passed}>
                {result.totalPassed} passed
              </Badge>
              {result.totalFailed > 0 && (
                <Badge variant="outline" className={STATUS_STYLE.failed}>
                  {result.totalFailed} failed
                </Badge>
              )}
              {result.totalSkipped > 0 && (
                <Badge variant="outline" className={STATUS_STYLE.skipped}>
                  {result.totalSkipped} skipped
                </Badge>
              )}
              <span className="text-muted-foreground">
                {result.totalFiles} file{result.totalFiles === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground/70 ml-auto">
                {Math.round(result.durationMs / 100) / 10}s
              </span>
            </div>

            <div className="space-y-1">
              {result.files.map((file) => {
                const isOpen = expanded.has(file.path);
                return (
                  <div
                    key={file.path}
                    className="border border-border/40 rounded overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFile(file.path)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/30 transition-colors text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      )}
                      {file.status === "passed" ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : file.status === "failed" ? (
                        <XCircle className="w-3 h-3 text-destructive" />
                      ) : (
                        <SkipForward className="w-3 h-3 text-muted-foreground" />
                      )}
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      <span className="font-mono truncate flex-1">{file.path}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {file.numPassed}/{file.numPassed + file.numFailed + file.numSkipped}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground/70">
                        {Math.round(file.durationMs)}ms
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border/20 bg-background/40">
                        {file.assertions.map((a, idx) => (
                          <button
                            key={`${a.fullName}-${idx}`}
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent("codechat-open-file", {
                                  detail: { path: file.path },
                                }),
                              );
                            }}
                            className="w-full flex items-start gap-2 px-3 py-1 text-[10px] text-left hover:bg-secondary/20 border-t border-border/10 first:border-t-0"
                            title={`Open ${file.path}`}
                          >
                            {a.status === "passed" ? (
                              <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500 mt-0.5" />
                            ) : a.status === "failed" ? (
                              <XCircle className="w-3 h-3 shrink-0 text-destructive mt-0.5" />
                            ) : (
                              <SkipForward className="w-3 h-3 shrink-0 text-muted-foreground mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-foreground/90">
                                {a.fullName || a.title}
                              </div>
                              {a.failureMessage && (
                                <div className="text-[10px] italic text-destructive/90 mt-0.5 truncate">
                                  {a.failureMessage}
                                </div>
                              )}
                            </div>
                            {a.duration !== null && (
                              <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                                {a.duration}ms
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
