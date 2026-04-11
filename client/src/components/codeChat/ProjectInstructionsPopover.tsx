/**
 * ProjectInstructionsPopover — modal showing auto-loaded CLAUDE.md +
 * friends (Pass 238).
 *
 * The server auto-injects the content of CLAUDE.md / AGENTS.md /
 * .stewardly/instructions.md into every Code Chat system prompt. This
 * modal surfaces that behavior so users can:
 *   - See exactly which files the agent is reading as house rules
 *   - Preview the first ~512 chars of each file
 *   - Reload from disk (admin edits immediately)
 *   - Toggle the auto-load off for the current session
 */

import { X, FileText, RefreshCw, BookOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const KIND_LABELS: Record<string, { label: string; variant: string }> = {
  stewardly: { label: "Stewardly", variant: "bg-accent/10 text-accent border-accent/30" },
  claude: { label: "Claude", variant: "bg-chart-3/10 text-chart-3 border-chart-3/30" },
  agents: { label: "Agents", variant: "bg-chart-2/10 text-chart-2 border-chart-2/30" },
};

export default function ProjectInstructionsPopover({
  open,
  onClose,
  enabled,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const manifestQuery = trpc.codeChat.projectInstructions.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });
  const reloadMutation = trpc.codeChat.reloadProjectInstructions.useMutation();
  const utils = trpc.useUtils();

  if (!open) return null;

  const entries = manifestQuery.data?.entries ?? [];
  const totalBytes = manifestQuery.data?.totalBytes ?? 0;

  const handleReload = async () => {
    try {
      await reloadMutation.mutateAsync();
      utils.codeChat.projectInstructions.invalidate();
      toast.success("Reloaded project instructions from disk");
    } catch (err: any) {
      toast.error(`Reload failed: ${err.message ?? err}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Project instructions"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close project instructions"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" /> Project instructions
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Auto-loaded files the agent reads as house rules on every message.
          Priority order: <code>.stewardly/instructions.md</code> →{" "}
          <code>CLAUDE.md</code> → <code>AGENTS.md</code>. Capped at 32KB each.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background/40 mb-4">
          <label htmlFor="pi-toggle" className="flex-1 text-xs cursor-pointer">
            <div className="font-medium text-foreground">Include in system prompt</div>
            <div className="text-muted-foreground text-[10px]">
              Toggle off to run a clean-slate session (still auto-reloads when next enabled)
            </div>
          </label>
          <Switch
            id="pi-toggle"
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label="Include project instructions in system prompt"
          />
        </div>

        {/* Entry list */}
        {manifestQuery.isLoading ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            Loading…
          </p>
        ) : entries.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground italic mb-2">
              No project instructions found in the workspace root.
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Create <code>CLAUDE.md</code> or <code>.stewardly/instructions.md</code>{" "}
              to give the agent persistent guidance.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                {entries.length} file{entries.length === 1 ? "" : "s"} ·{" "}
                {(totalBytes / 1024).toFixed(1)}KB total
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={handleReload}
                disabled={reloadMutation.isPending}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${
                    reloadMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                Reload
              </Button>
            </div>
            <ul className="space-y-2">
              {entries.map((e) => {
                const kind = KIND_LABELS[e.kind] ?? {
                  label: e.kind,
                  variant: "border-border/60",
                };
                return (
                  <li
                    key={e.path}
                    className="rounded-lg border border-border/40 bg-background/60 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/30 bg-background/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="font-mono text-xs truncate text-foreground">
                          {e.path}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-4 px-1.5 border ${kind.variant}`}
                        >
                          {kind.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                          {(e.byteLength / 1024).toFixed(1)}KB
                        </span>
                        {e.truncated && (
                          <Badge
                            variant="outline"
                            className="text-[8px] h-4 px-1 border-amber-500/40 text-amber-500 uppercase"
                          >
                            truncated
                          </Badge>
                        )}
                      </div>
                    </div>
                    <pre className="text-[10px] font-mono text-muted-foreground leading-relaxed px-3 py-2 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                      {e.preview}
                      {e.preview.length >= 512 && "…"}
                    </pre>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
