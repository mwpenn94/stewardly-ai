/**
 * FindReplacePanel — multi-file find & replace with preview (Pass 250).
 *
 * Users type a find pattern + replacement, preview every matching file
 * with a diffed line view, selectively deselect files they don't want
 * to change, and apply (admin only — calls write_file behind the
 * scenes via the findReplaceApply mutation).
 *
 * Dry-run is always free; apply is admin-gated with an explicit
 * confirmDangerous flag and a per-file checkbox list.
 */

import { useState, useMemo, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Replace,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Play,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

export default function FindReplacePanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [pathPrefix, setPathPrefix] = useState("");
  const [previewRun, setPreviewRun] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const previewQuery = trpc.codeChat.findReplacePreview.useQuery(
    {
      find: findText,
      replace: replaceText,
      regex: useRegex,
      caseSensitive,
      wholeWord,
      pathPrefix: pathPrefix || undefined,
      perFileLimit: 100,
      totalLimit: 5000,
      maxFiles: 500,
    },
    {
      enabled: previewRun > 0 && findText.length > 0,
      staleTime: 30_000,
      // Don't re-run on window focus; this is an explicit user action
      refetchOnWindowFocus: false,
    },
  );

  const applyMutation = trpc.codeChat.findReplaceApply.useMutation();
  const utils = trpc.useUtils();

  const preview = previewQuery.data?.preview ?? null;
  const previewError = previewQuery.data?.error ?? null;

  // Default-select every file when a new preview lands
  useEffect(() => {
    if (preview) {
      setSelected(new Set(preview.files.map((f) => f.path)));
    }
  }, [preview]);

  const handleRunPreview = () => {
    if (!findText.trim()) {
      toast.error("Enter a find pattern");
      return;
    }
    setPreviewRun((n) => n + 1);
  };

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (preview) setSelected(new Set(preview.files.map((f) => f.path)));
  };
  const selectNone = () => setSelected(new Set());

  const handleApply = async () => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    if (!preview || selected.size === 0) {
      toast.error("No files selected");
      return;
    }
    setApplying(true);
    try {
      const result = await applyMutation.mutateAsync({
        confirmDangerous: true as const,
        acceptPaths: Array.from(selected),
        preview: {
          options: preview.options,
          files: preview.files.map((f) => ({
            path: f.path,
            newContent: f.newContent,
            matches: f.matches,
            truncated: f.truncated,
            delta: f.delta,
          })),
          totals: preview.totals,
        },
      });
      toast.success(
        `Applied: ${result.writtenPaths.length} file${result.writtenPaths.length === 1 ? "" : "s"}` +
          (result.failed.length > 0
            ? ` · ${result.failed.length} failed`
            : ""),
      );
      if (result.failed.length > 0) {
        console.warn("find/replace apply failures:", result.failed);
      }
      // Clear selection + rerun to show the now-zero-match state
      setSelected(new Set());
      utils.codeChat.findReplacePreview.invalidate();
    } catch (err: any) {
      toast.error(`Apply failed: ${err.message ?? err}`);
    } finally {
      setApplying(false);
    }
  };

  const totals = preview?.totals;
  const selectedTotalMatches = useMemo(() => {
    if (!preview) return 0;
    return preview.files
      .filter((f) => selected.has(f.path))
      .reduce((acc, f) => acc + f.matches.length, 0);
  }, [preview, selected]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Replace className="h-4 w-4 text-accent" />
            Find &amp; Replace Across Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Find</Label>
              <Input
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder={useRegex ? "regex body (no slashes)" : "literal text"}
                className="font-mono text-sm mt-1"
                aria-label="Find pattern"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Replace</Label>
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="replacement (supports $1 in regex mode)"
                className="font-mono text-sm mt-1"
                aria-label="Replace text"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={useRegex}
                onCheckedChange={(v) => setUseRegex(Boolean(v))}
              />
              <span>Regex</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={caseSensitive}
                onCheckedChange={(v) => setCaseSensitive(Boolean(v))}
              />
              <span>Case sensitive</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={wholeWord}
                onCheckedChange={(v) => setWholeWord(Boolean(v))}
              />
              <span>Whole word</span>
            </label>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground shrink-0">
                Path prefix
              </Label>
              <Input
                value={pathPrefix}
                onChange={(e) => setPathPrefix(e.target.value)}
                placeholder="e.g. client/src/"
                className="font-mono text-xs h-7"
                aria-label="Path prefix filter"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRunPreview}
              disabled={!findText.trim() || previewQuery.isFetching}
              size="sm"
            >
              {previewQuery.isFetching ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Eye className="h-3 w-3 mr-1.5" />
              )}
              Preview
            </Button>
            {preview && (
              <>
                <Button
                  onClick={handleApply}
                  disabled={
                    !isAdmin || applying || selected.size === 0 || applyMutation.isPending
                  }
                  size="sm"
                  variant="default"
                >
                  {applying ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1.5" />
                  )}
                  Apply to {selected.size} file{selected.size === 1 ? "" : "s"}
                </Button>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectNone}>None</Button>
                </div>
              </>
            )}
          </div>

          {!isAdmin && (
            <div className="text-xs text-muted-foreground">
              Preview-only mode. Admin role required for apply.
            </div>
          )}
          {previewError && (
            <div className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {previewError}
            </div>
          )}
        </CardContent>
      </Card>

      {preview && totals && (
        <>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <FileEdit className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{totals.filesMatched}</strong> files matched
                </span>
                <span>
                  <strong className="text-foreground">{totals.totalMatches}</strong> total matches
                </span>
                <span>
                  {totals.filesScanned} scanned
                </span>
                {selectedTotalMatches > 0 && (
                  <span className="ml-auto text-accent">
                    {selectedTotalMatches} selected
                  </span>
                )}
                {totals.workspaceTruncated && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                    truncated
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {preview.files.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-accent" />
                No matches found.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {preview.files.map((file) => (
                <Card key={file.path}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-3 border-b border-border/40">
                      <Checkbox
                        checked={selected.has(file.path)}
                        onCheckedChange={() => toggleFile(file.path)}
                        aria-label={`Select ${file.path}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("codechat-open-file", {
                              detail: { path: file.path, line: file.matches[0]?.line ?? 1 },
                            }),
                          )
                        }
                        className="font-mono text-sm truncate hover:text-accent text-left flex-1"
                      >
                        {file.path}
                      </button>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {file.matches.length} match{file.matches.length === 1 ? "" : "es"}
                      </span>
                      {file.truncated && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-[10px]">
                          truncated
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {file.delta.added > 0 && <span className="text-emerald-500">+{file.delta.added}</span>}
                        {file.delta.removed > 0 && <span className="text-destructive ml-1">-{file.delta.removed}</span>}
                      </span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {file.matches.slice(0, 20).map((m, idx) => (
                        <div
                          key={`${file.path}:${m.line}:${m.column}:${idx}`}
                          className="px-3 py-1.5 font-mono text-[11px] space-y-0.5"
                        >
                          <div className="text-muted-foreground">
                            <span className="inline-block w-12 text-right mr-2 opacity-60">
                              {m.line}
                            </span>
                            <span className="text-destructive">-</span> {m.before}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="inline-block w-12 text-right mr-2 opacity-60">
                              {m.line}
                            </span>
                            <span className="text-emerald-500">+</span> {m.after}
                          </div>
                        </div>
                      ))}
                      {file.matches.length > 20 && (
                        <div className="px-3 py-1.5 text-[11px] text-muted-foreground italic">
                          +{file.matches.length - 20} more matches (click path to open file)
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
