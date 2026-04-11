/**
 * CheckpointsPopover — Pass 253.
 *
 * Modal for managing workspace checkpoints. Lists saved checkpoints,
 * lets the user save a new one, restore with a confirm prompt (since
 * restore is destructive), rename, or delete.
 *
 * The parent `CodeChat.tsx` is the source of truth for the full
 * state tree; this component calls into callbacks (onSave, onRestore,
 * onRename, onDelete) and renders what it receives.
 */

import { useState } from "react";
import {
  X,
  Plus,
  RotateCcw,
  Trash2,
  Pencil,
  Check,
  XCircle,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatAge,
  type Checkpoint,
} from "./checkpoints";

interface CheckpointsPopoverProps {
  open: boolean;
  onClose: () => void;
  checkpoints: Checkpoint[];
  currentStats: Checkpoint["meta"]["stats"];
  /** Called with {name, note} to save the current state */
  onSave: (name: string, note?: string) => void;
  /** Called to restore a full checkpoint payload */
  onRestore: (checkpoint: Checkpoint) => void;
  onRename: (id: string, name: string, note?: string) => void;
  onDelete: (id: string) => void;
}

export default function CheckpointsPopover({
  open,
  onClose,
  checkpoints,
  currentStats,
  onSave,
  onRestore,
  onRename,
  onDelete,
}: CheckpointsPopoverProps) {
  const [draftName, setDraftName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = () => {
    onSave(draftName.trim(), draftNote.trim() || undefined);
    setDraftName("");
    setDraftNote("");
  };

  const startEdit = (cp: Checkpoint) => {
    setEditingId(cp.meta.id);
    setEditName(cp.meta.name);
    setEditNote(cp.meta.note ?? "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    onRename(editingId, editName, editNote);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditNote("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Checkpoints"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,720px)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Checkpoints</h2>
            <Badge variant="outline" className="text-[10px]">
              {checkpoints.length}/30
            </Badge>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Save current state
            </div>
            <Input
              placeholder="Checkpoint name (auto-generated if blank)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Optional note (why are you saving?)"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              className="text-xs"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>{currentStats.messageCount} msgs</span>
                <span>{currentStats.toolCallCount} tool calls</span>
                <span>{currentStats.editCount} edits</span>
              </div>
              <Button size="sm" onClick={handleSave}>
                <Plus className="w-3 h-3 mr-1" /> Save checkpoint
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {checkpoints.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-8">
                No checkpoints yet. Save the current state to roll back later.
              </p>
            )}
            {checkpoints.map((cp) => {
              const isEditing = editingId === cp.meta.id;
              const isConfirming = confirmRestoreId === cp.meta.id;
              return (
                <div
                  key={cp.meta.id}
                  className="p-3 rounded border border-border text-xs"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xs"
                        placeholder="Name"
                      />
                      <Input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="text-xs"
                        placeholder="Note"
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {cp.meta.name}
                          </div>
                          {cp.meta.note && (
                            <div className="text-[10px] italic text-muted-foreground">
                              {cp.meta.note}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{cp.meta.stats.messageCount} msgs</span>
                            <span>{cp.meta.stats.toolCallCount} tools</span>
                            <span>{cp.meta.stats.editCount} edits</span>
                            <span>· {formatAge(cp.meta.createdAt)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => startEdit(cp)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${cp.meta.name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDelete(cp.meta.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${cp.meta.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="text-[11px] flex-1">
                            Restoring will discard unsaved chat + edit history.
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmRestoreId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              onRestore(cp);
                              setConfirmRestoreId(null);
                            }}
                          >
                            Restore
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmRestoreId(cp.meta.id)}
                          className="w-full justify-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
