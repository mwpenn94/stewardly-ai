/**
 * CheckpointsPanel — workspace snapshot + restore (Pass 251).
 *
 * Lets users capture a named snapshot of an arbitrary set of files
 * and roll back to it later. Preview (read) is free; restore is
 * admin-gated via the confirmDangerous flag on the tRPC mutation.
 *
 * Input layout:
 *  - Create card: name + description + tags + path list (one per line)
 *  - List card: every existing checkpoint with file count, total
 *    bytes, age, and restore/delete buttons
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Camera,
  Loader2,
  Undo2,
  Trash2,
  History,
  Plus,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function formatAge(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const delta = Math.max(0, now - then);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CheckpointsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const listQuery = trpc.codeChat.listCheckpoints.useQuery(undefined, {
    staleTime: 10_000,
  });
  const createMutation = trpc.codeChat.createCheckpoint.useMutation();
  const deleteMutation = trpc.codeChat.deleteCheckpoint.useMutation();
  const restoreMutation = trpc.codeChat.restoreCheckpoint.useMutation();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [pathsRaw, setPathsRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedPaths = useMemo(
    () =>
      pathsRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [pathsRaw],
  );
  const parsedTags = useMemo(
    () =>
      tagsRaw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [tagsRaw],
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Checkpoint name is required");
      return;
    }
    if (parsedPaths.length === 0) {
      toast.error("At least one file path is required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        paths: parsedPaths,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
      if (!result.checkpoint) {
        toast.error(
          `Could not capture any files · ${result.readErrors.length} read error${result.readErrors.length === 1 ? "" : "s"}`,
        );
      } else {
        const skippedCount = result.skipped.length + result.readErrors.length;
        toast.success(
          `Checkpoint saved: ${result.checkpoint.fileCount} file${result.checkpoint.fileCount === 1 ? "" : "s"}` +
            (skippedCount > 0 ? ` · ${skippedCount} skipped` : ""),
        );
        setName("");
        setDescription("");
        setTagsRaw("");
        setPathsRaw("");
        utils.codeChat.listCheckpoints.invalidate();
      }
    } catch (err: any) {
      toast.error(`Create failed: ${err.message ?? err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    if (!window.confirm("Restore this checkpoint? Files will be overwritten.")) {
      return;
    }
    try {
      const result = await restoreMutation.mutateAsync({
        id,
        confirmDangerous: true as const,
      });
      if (!result.ok) {
        toast.error(`Restore failed: ${result.error ?? "unknown"}`);
        return;
      }
      toast.success(
        `Restored ${result.restoredPaths.length} file${result.restoredPaths.length === 1 ? "" : "s"}` +
          (result.failed.length > 0 ? ` · ${result.failed.length} failed` : ""),
      );
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message ?? err}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this checkpoint? Cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      utils.codeChat.listCheckpoints.invalidate();
      toast.success("Checkpoint deleted");
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message ?? err}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-accent" />
            New Checkpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkpoint name (e.g. 'before-refactor')"
              aria-label="Checkpoint name"
            />
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Tags (comma or space separated)"
              aria-label="Checkpoint tags"
            />
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Checkpoint description"
          />
          <Textarea
            value={pathsRaw}
            onChange={(e) => setPathsRaw(e.target.value)}
            placeholder="One file path per line, relative to workspace root"
            rows={5}
            className="font-mono text-sm"
            aria-label="File paths"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {parsedPaths.length} path{parsedPaths.length === 1 ? "" : "s"}
              {parsedTags.length > 0 && ` · ${parsedTags.length} tag${parsedTags.length === 1 ? "" : "s"}`}
            </span>
            <Button
              onClick={handleCreate}
              disabled={submitting || !name.trim() || parsedPaths.length === 0}
              size="sm"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1.5" />
              )}
              Capture
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-accent" />
            Saved Checkpoints
            {listQuery.data && (
              <Badge variant="outline" className="text-xs font-mono">
                {listQuery.data.checkpoints.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mx-auto animate-spin" />
            </div>
          ) : listQuery.data && listQuery.data.checkpoints.length > 0 ? (
            <div className="divide-y divide-border/60">
              {listQuery.data.checkpoints.map((cp) => (
                <div key={cp.id} className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {cp.name}
                      </div>
                      {cp.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {cp.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span>{formatAge(cp.createdAt)}</span>
                        <span>·</span>
                        <span>
                          <FileText className="h-3 w-3 inline mr-0.5" />
                          {cp.fileCount} file{cp.fileCount === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{formatBytes(cp.totalBytes)}</span>
                        {cp.tags.length > 0 && (
                          <>
                            <span>·</span>
                            {cp.tags.slice(0, 4).map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 h-4"
                              >
                                {t}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleRestore(cp.id)}
                        disabled={!isAdmin || restoreMutation.isPending}
                        aria-label={`Restore ${cp.name}`}
                      >
                        <Undo2 className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(cp.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete ${cp.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {cp.paths.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                      {cp.paths.slice(0, 6).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("codechat-open-file", {
                                detail: { path: p, line: 1 },
                              }),
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground truncate max-w-[240px]"
                          title={p}
                        >
                          {p}
                        </button>
                      ))}
                      {cp.paths.length > 6 && (
                        <span className="text-muted-foreground">
                          +{cp.paths.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No checkpoints yet. Create one above to capture a known-good
              state you can roll back to.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
