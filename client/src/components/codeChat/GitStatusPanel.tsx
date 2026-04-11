/**
 * GitStatusPanel — live view of the workspace's current delta from
 * HEAD (Pass 244).
 *
 * Shows a summary strip (branch name + commit sha + per-status
 * counts), a scrollable entry list grouped by status, and an inline
 * diff viewer for the selected file. Refreshes on demand (no
 * polling — git status is cheap but we don't want to hammer the
 * subprocess every second).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  FileQuestion,
  MoveRight,
  AlertCircle,
  Loader2,
  FileCode,
} from "lucide-react";

type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflicted"
  | "typechange"
  | "unknown";

interface GitStatusEntry {
  path: string;
  originalPath?: string;
  staged: GitFileStatus;
  worktree: GitFileStatus;
  dirty: boolean;
}

const STATUS_META: Record<
  string,
  { label: string; Icon: typeof Pencil; color: string }
> = {
  modified: { label: "modified", Icon: Pencil, color: "text-accent" },
  added: { label: "added", Icon: Plus, color: "text-emerald-500" },
  deleted: { label: "deleted", Icon: Trash2, color: "text-destructive" },
  renamed: { label: "renamed", Icon: MoveRight, color: "text-chart-3" },
  copied: { label: "copied", Icon: MoveRight, color: "text-chart-3" },
  untracked: { label: "untracked", Icon: FileQuestion, color: "text-muted-foreground" },
  conflicted: { label: "conflict", Icon: AlertCircle, color: "text-destructive" },
  typechange: { label: "type", Icon: FileCode, color: "text-chart-3" },
};

function primaryStatus(entry: GitStatusEntry): string {
  const states = [entry.staged, entry.worktree];
  if (states.includes("conflicted")) return "conflicted";
  if (states.includes("untracked")) return "untracked";
  if (states.includes("deleted")) return "deleted";
  if (states.includes("renamed")) return "renamed";
  if (states.includes("copied")) return "copied";
  if (states.includes("added")) return "added";
  if (states.includes("modified") || states.includes("typechange")) return "modified";
  return "modified";
}

export default function GitStatusPanel() {
  const statusQuery = trpc.codeChat.gitWorkspaceStatus.useQuery(undefined, {
    staleTime: 5_000,
  });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const diffQuery = trpc.codeChat.gitWorkspaceDiff.useQuery(
    { path: selectedPath ?? "", staged: selectedStaged },
    { enabled: !!selectedPath, staleTime: 5_000 },
  );

  const entries = statusQuery.data?.entries ?? [];
  const summary = statusQuery.data?.summary;
  const head = statusQuery.data?.head;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-4 w-4 shrink-0" />
              <span className="truncate">Git status</span>
              {head?.branch && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1.5 border-accent/40 text-accent font-mono"
                >
                  {head.branch}
                </Badge>
              )}
              {head?.sha && (
                <span className="text-[9px] text-muted-foreground/60 font-mono tabular-nums">
                  {head.sha.slice(0, 7)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusQuery.refetch()}
              className="h-7 text-[10px]"
              disabled={statusQuery.isRefetching}
              aria-label="Refresh git status"
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${statusQuery.isRefetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary strip */}
          {summary && summary.total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.modified > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-accent/40 text-accent"
                >
                  {summary.modified} modified
                </Badge>
              )}
              {summary.added > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-emerald-500/40 text-emerald-500"
                >
                  {summary.added} added
                </Badge>
              )}
              {summary.deleted > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-destructive/40 text-destructive"
                >
                  {summary.deleted} deleted
                </Badge>
              )}
              {summary.renamed > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-chart-3/40 text-chart-3"
                >
                  {summary.renamed} renamed
                </Badge>
              )}
              {summary.untracked > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-muted text-muted-foreground"
                >
                  {summary.untracked} untracked
                </Badge>
              )}
              {summary.conflicted > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 border-destructive bg-destructive/10 text-destructive"
                >
                  {summary.conflicted} conflict
                </Badge>
              )}
            </div>
          )}

          {statusQuery.isLoading ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
              Loading git status…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              Working tree clean — no changes detected.
              {!head?.branch && " (Workspace may not be a git repo.)"}
            </p>
          ) : (
            <ul className="divide-y divide-border/30 border rounded-md max-h-96 overflow-auto">
              {entries.map((entry) => {
                const status = primaryStatus(entry);
                const meta = STATUS_META[status] ?? STATUS_META.modified;
                const Icon = meta.Icon;
                const isSelected = selectedPath === entry.path;
                return (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPath(entry.path);
                        setSelectedStaged(entry.staged !== "unknown");
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                        isSelected
                          ? "bg-accent/10 border-l-2 border-accent"
                          : "border-l-2 border-transparent hover:bg-secondary/20"
                      }`}
                    >
                      <Icon className={`h-3 w-3 shrink-0 ${meta.color}`} />
                      <span className="font-mono text-xs truncate flex-1 text-foreground">
                        {entry.originalPath && (
                          <>
                            <span className="text-muted-foreground/60">
                              {entry.originalPath}
                            </span>{" "}
                            →{" "}
                          </>
                        )}
                        {entry.path}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[8px] h-4 px-1 ${meta.color} border-current/30`}
                        >
                          {meta.label}
                        </Badge>
                        {entry.staged !== "unknown" &&
                          entry.staged !== "untracked" && (
                            <Badge
                              variant="outline"
                              className="text-[8px] h-4 px-1 border-chart-2/40 text-chart-2"
                            >
                              staged
                            </Badge>
                          )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="h-4 w-4 shrink-0" />
              <span className="font-mono text-xs truncate">
                {selectedPath ?? "No file selected"}
              </span>
            </div>
            {selectedPath && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant={selectedStaged ? "default" : "outline"}
                  onClick={() => setSelectedStaged(true)}
                  className="h-6 text-[10px]"
                >
                  staged
                </Button>
                <Button
                  size="sm"
                  variant={!selectedStaged ? "default" : "outline"}
                  onClick={() => setSelectedStaged(false)}
                  className="h-6 text-[10px]"
                >
                  worktree
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedPath ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              Click a file on the left to view its diff.
            </p>
          ) : diffQuery.isLoading ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
              Loading diff…
            </p>
          ) : !diffQuery.data?.diff ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No diff output. File may be untracked or unchanged in this context.
            </p>
          ) : (
            <pre className="text-[10px] font-mono border rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap bg-background/60 leading-relaxed">
              {diffQuery.data.diff
                .split("\n")
                .slice(0, 500)
                .map((line, i) => {
                  let cls = "text-muted-foreground";
                  if (line.startsWith("+") && !line.startsWith("+++"))
                    cls = "text-emerald-500";
                  else if (line.startsWith("-") && !line.startsWith("---"))
                    cls = "text-destructive";
                  else if (line.startsWith("@@")) cls = "text-chart-3 font-medium";
                  return (
                    <div key={i} className={cls}>
                      {line || " "}
                    </div>
                  );
                })}
              {diffQuery.data.diff.split("\n").length > 500 && (
                <div className="text-muted-foreground italic">
                  … (truncated at 500 lines)
                </div>
              )}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
