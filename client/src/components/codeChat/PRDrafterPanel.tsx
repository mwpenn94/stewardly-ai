/**
 * PRDrafterPanel — auto-draft a Pull Request body from the current
 * branch diff (Pass 253).
 *
 * Users pick a target branch, click Generate, and get a rendered
 * draft with title / summary bullets / test plan / file map. The
 * draft is editable inline and has Copy + Use in GitHub buttons.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitPullRequest,
  Loader2,
  Copy,
  RefreshCw,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function PRDrafterPanel() {
  const [targetBranch, setTargetBranch] = useState("main");
  const [sourceBranch, setSourceBranch] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [run, setRun] = useState(0);

  const draftQuery = trpc.codeChat.draftPullRequest.useQuery(
    {
      targetBranch,
      sourceBranch: sourceBranch || undefined,
      maxCommits: 40,
    },
    {
      enabled: run > 0,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );

  const handleGenerate = () => {
    setRun((n) => n + 1);
  };

  // When draft arrives, populate the editable fields
  const draft = draftQuery.data?.draft ?? null;
  const meta = draftQuery.data?.meta ?? null;

  // Populate editable title/body when a fresh draft lands
  const currentDraftKey = draft
    ? `${draft.title}:${draft.stats.commitCount}:${draft.stats.filesChanged}`
    : null;
  const [lastAppliedKey, setLastAppliedKey] = useState<string | null>(null);
  if (currentDraftKey && currentDraftKey !== lastAppliedKey && draft) {
    setLastAppliedKey(currentDraftKey);
    setCustomTitle(draft.title);
    setCustomBody(draft.body);
  }

  const handleCopyTitle = async () => {
    await navigator.clipboard.writeText(customTitle || draft?.title || "");
    toast.success("Title copied");
  };

  const handleCopyBody = async () => {
    await navigator.clipboard.writeText(customBody || draft?.body || "");
    toast.success("Body copied");
  };

  const handleCopyBoth = async () => {
    const combined = `${customTitle || draft?.title || ""}\n\n${customBody || draft?.body || ""}`;
    await navigator.clipboard.writeText(combined);
    toast.success("Title + body copied");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitPullRequest className="h-4 w-4 text-accent" />
            Draft Pull Request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Source branch</label>
              <Input
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
                placeholder="leave blank for current HEAD"
                className="font-mono text-xs mt-1"
                aria-label="Source branch"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target branch</label>
              <Input
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
                className="font-mono text-xs mt-1"
                aria-label="Target branch"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={draftQuery.isFetching}
          >
            {draftQuery.isFetching ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1.5" />
            )}
            Generate draft
          </Button>
        </CardContent>
      </Card>

      {draft && meta && (
        <>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px]"
                >
                  {meta.sourceBranch} → {meta.targetBranch}
                </Badge>
                <span>
                  <strong className="text-foreground">{meta.commitCount}</strong>
                  {" "}commit{meta.commitCount === 1 ? "" : "s"}
                </span>
                <span>
                  <strong className="text-foreground">{meta.filesChanged}</strong>
                  {" "}file{meta.filesChanged === 1 ? "" : "s"}
                </span>
                <span>
                  +<strong className="text-emerald-500">{draft.stats.additions}</strong>
                </span>
                <span>
                  −<strong className="text-destructive">{draft.stats.deletions}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Draft
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 px-2 text-xs"
                  onClick={handleCopyBoth}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy both
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={handleCopyTitle}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="font-mono text-sm"
                  aria-label="PR title"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs text-muted-foreground">Body (markdown)</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={handleCopyBody}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="font-mono text-xs min-h-[300px]"
                  aria-label="PR body"
                />
              </div>
            </CardContent>
          </Card>

          {draft.fileMap.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">File map</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40">
                {draft.fileMap.slice(0, 40).map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("codechat-open-file", {
                          detail: { path: entry.path, line: 1 },
                        }),
                      )
                    }
                    className="w-full text-left p-2 px-4 hover:bg-muted/50 flex items-center gap-3"
                  >
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {entry.category}
                    </Badge>
                    <span className="font-mono text-xs truncate flex-1">
                      {entry.path}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {entry.status} · +{entry.additions}/−{entry.deletions}
                    </span>
                  </button>
                ))}
                {draft.fileMap.length > 40 && (
                  <div className="p-2 px-4 text-xs text-muted-foreground italic">
                    +{draft.fileMap.length - 40} more files
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {draftQuery.isError && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Failed to generate draft: {String(draftQuery.error?.message ?? draftQuery.error)}
          </CardContent>
        </Card>
      )}

      {run > 0 && !draft && !draftQuery.isFetching && !draftQuery.isError && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            No commits ahead of {targetBranch}.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
