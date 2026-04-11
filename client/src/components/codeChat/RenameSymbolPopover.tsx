/**
 * RenameSymbolPopover — Pass 257.
 *
 * Two-step rename refactor modal:
 *   1. User enters old + new name + optional path prefix → click
 *      Preview to load the plan via codeChat.planRenameSymbol.
 *   2. Plan shows affected files + per-file replacement count +
 *      first-5 hits per entry. User reviews and clicks Commit to
 *      run codeChat.applyRenameSymbol (admin-gated + rollback-safe
 *      via batchApply under the hood).
 */

import { useState } from "react";
import {
  X,
  Edit3,
  FileText,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface RenameSymbolPopoverProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export default function RenameSymbolPopover({
  open,
  onClose,
  isAdmin,
}: RenameSymbolPopoverProps) {
  const [oldName, setOldName] = useState("");
  const [newName, setNewName] = useState("");
  const [pathPrefix, setPathPrefix] = useState("");
  const [includeComments, setIncludeComments] = useState(true);
  const [committed, setCommitted] = useState<null | {
    oldName: string;
    newName: string;
    includeComments: boolean;
    pathPrefix: string;
  }>(null);

  const planQuery = trpc.codeChat.planRenameSymbol.useQuery(
    {
      oldName: committed?.oldName ?? "",
      newName: committed?.newName ?? "",
      includeComments: committed?.includeComments,
      pathPrefix: committed?.pathPrefix || undefined,
    },
    {
      enabled: open && committed !== null,
      staleTime: 10_000,
    },
  );

  const applyMutation = trpc.codeChat.applyRenameSymbol.useMutation({
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          `Renamed — ${result.totalReplacements} replacement${result.totalReplacements === 1 ? "" : "s"} across ${result.fileCount} file${result.fileCount === 1 ? "" : "s"}`,
        );
        onClose();
      } else {
        toast.error(`Rename failed: ${result.error ?? "unknown"}`);
      }
    },
    onError: (err) => toast.error(`Rename failed: ${err.message}`),
  });

  if (!open) return null;

  const handlePreview = () => {
    if (!oldName.trim() || !newName.trim()) {
      toast.error("Both names are required");
      return;
    }
    setCommitted({
      oldName: oldName.trim(),
      newName: newName.trim(),
      includeComments,
      pathPrefix: pathPrefix.trim(),
    });
  };

  const handleCommit = () => {
    if (!committed) return;
    if (!isAdmin) {
      toast.error("Rename requires admin role");
      return;
    }
    applyMutation.mutate({
      oldName: committed.oldName,
      newName: committed.newName,
      includeComments: committed.includeComments,
      pathPrefix: committed.pathPrefix || undefined,
      confirmDangerous: true,
    });
  };

  const plan = planQuery.data?.plan;
  const issues = planQuery.data?.issues ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rename symbol"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,900px)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Rename symbol</h2>
            {plan && (
              <Badge variant="outline" className="text-[10px]">
                {plan.summary.fileCount} file{plan.summary.fileCount === 1 ? "" : "s"} · {plan.summary.totalReplacements} replacement{plan.summary.totalReplacements === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b border-border/40">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Old name</label>
              <Input
                value={oldName}
                onChange={(e) => setOldName(e.target.value)}
                placeholder="oldName"
                className="text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">New name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="newName"
                className="text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Path prefix (optional)</label>
            <Input
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="src/ (leave blank to scan all)"
              className="text-sm font-mono"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
              />
              <span className="text-muted-foreground">include comments</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePreview} disabled={planQuery.isFetching}>
                {planQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : null}
                Preview
              </Button>
              {plan && plan.entries.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleCommit}
                  disabled={!isAdmin || applyMutation.isPending}
                  title={isAdmin ? undefined : "Rename requires admin role"}
                >
                  {applyMutation.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  Commit rename
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {committed === null && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              Enter old + new names and click Preview to see affected files.
            </p>
          )}

          {issues.length > 0 && (
            <div className="p-3 rounded border border-destructive/40 bg-destructive/5 text-[11px] text-destructive">
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3 h-3" /> Invalid rename
              </div>
              <ul className="mt-1 list-disc pl-5">
                {issues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {plan && plan.entries.length === 0 && issues.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              No files matched "{plan.oldName}" ({plan.filesScanned} scanned).
            </p>
          )}

          {plan && plan.entries.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground">
                {plan.filesScanned} files scanned · {plan.summary.totalHits} total hits · {plan.summary.totalReplacements} replacements
              </div>
              {plan.entries.map((entry) => (
                <div
                  key={entry.path}
                  className="border border-border/40 rounded overflow-hidden"
                >
                  <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2 border-b border-border/20">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono text-xs truncate flex-1">
                      {entry.path}
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      {entry.replacements} replacement{entry.replacements === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="px-3 py-1 text-[10px] font-mono text-muted-foreground max-h-24 overflow-auto">
                    {entry.hits.slice(0, 5).map((h: any, i: number) => (
                      <div key={i} className="truncate">
                        <span className="text-accent">{h.line}:{h.column}</span>{" "}
                        <span>{h.text}</span>
                      </div>
                    ))}
                    {entry.hits.length > 5 && (
                      <div className="italic">+{entry.hits.length - 5} more</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
