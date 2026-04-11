/**
 * EditHistoryPopover — inspect + revert recent edits (Pass 239).
 *
 * Renders the edit history ring buffer from `editHistory.ts` as a
 * list with:
 *   - Per-entry undo/drop buttons
 *   - Visual cursor indicator (everything above the cursor is
 *     currently applied, everything below is redo-able)
 *   - Clear all button
 *   - Keyboard shortcut hints (Ctrl+Z / Ctrl+Shift+Z)
 *
 * The parent handles the actual file write — this popover just
 * invokes `onUndo`/`onRedo`/`onRevert` callbacks with the target
 * entry, and the parent calls the `codeChat.dispatch` mutation with
 * `write_file` to restore the content.
 */

import { X, Undo2, Redo2, Trash2, History, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  summarizeHistory,
  type EditHistoryState,
  type EditHistoryEntry,
} from "./editHistory";

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface EditHistoryPopoverProps {
  open: boolean;
  onClose: () => void;
  state: EditHistoryState;
  onUndo: () => void;
  onRedo: () => void;
  onRevert: (entry: EditHistoryEntry) => void;
  onDrop: (id: string) => void;
  onClear: () => void;
}

export default function EditHistoryPopover({
  open,
  onClose,
  state,
  onUndo,
  onRedo,
  onRevert,
  onDrop,
  onClear,
}: EditHistoryPopoverProps) {
  if (!open) return null;
  const summary = summarizeHistory(state);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit history"
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close edit history"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <History className="h-4 w-4 text-accent" /> Edit history
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Every write/edit from the agent and from your inline edits.
          Undo reverts the most recent change; redo re-applies after an
          undo. Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts work too.
        </p>

        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={!summary.canUndo}
            onClick={onUndo}
            aria-label="Undo most recent edit"
          >
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={!summary.canRedo}
            onClick={onRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-3 w-3 mr-1" /> Redo
          </Button>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {summary.undoCount}/{summary.total} applied
          </span>
          {summary.total > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Clear all edit history? This can't be undone.")) {
                  onClear();
                }
              }}
              aria-label="Clear all edit history"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {state.entries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            No edits recorded yet. Ask the agent to change a file, or
            edit one in the File browser, to start the history.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {/* Newest first */}
            {[...state.entries].map((e, idx) => {
              // idx goes 0..n-1 over the reversed order
              const realIdx = state.entries.length - 1 - idx;
              const entry = state.entries[realIdx];
              const isCursor = realIdx === state.cursor;
              const isPending = realIdx > state.cursor;
              const beforeBytes = new Blob([entry.before]).size;
              const afterBytes = new Blob([entry.after]).size;
              const delta = afterBytes - beforeBytes;
              return (
                <li
                  key={entry.id}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    isPending
                      ? "border-border/30 bg-muted/10 opacity-50"
                      : isCursor
                        ? "border-accent/50 bg-accent/5"
                        : "border-border/40 bg-background/40"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-mono truncate text-foreground">
                      {entry.path}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 px-1.5 ${
                        entry.origin === "agent"
                          ? "border-chart-3/40 text-chart-3"
                          : "border-chart-2/40 text-chart-2"
                      }`}
                    >
                      {entry.origin}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground"
                    >
                      {entry.kind}
                    </Badge>
                    {isCursor && (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 border-accent/50 text-accent"
                      >
                        current
                      </Badge>
                    )}
                    <div className="flex-1" />
                    <span className="text-[9px] text-muted-foreground font-mono tabular-nums shrink-0">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {(beforeBytes / 1024).toFixed(1)}KB →{" "}
                      {(afterBytes / 1024).toFixed(1)}KB
                      <span
                        className={`ml-1 ${
                          delta > 0
                            ? "text-emerald-500"
                            : delta < 0
                              ? "text-destructive"
                              : ""
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}B
                      </span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                        onClick={() => onRevert(entry)}
                        aria-label={`Revert ${entry.path} to before this edit`}
                      >
                        Revert to before
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        onClick={() => onDrop(entry.id)}
                        aria-label="Drop this entry from history"
                        title="Drop from history"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
