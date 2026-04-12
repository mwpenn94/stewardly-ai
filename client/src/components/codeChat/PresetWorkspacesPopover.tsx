/**
 * PresetWorkspacesPopover — Pass 260.
 *
 * Modal for applying / saving / managing preset workspace
 * environments. Each preset bundles the Code Chat config tree
 * (model, enabled tools, max iterations, mutation permission,
 * project instructions) so users can instantly switch between
 * "read-only exploration", "refactor mode", "test writer", etc.
 */

import { useState } from "react";
import {
  X,
  Plus,
  Check,
  Trash2,
  Pencil,
  XCircle,
  Layers,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addPreset,
  removePreset,
  updatePreset,
  captureCurrentAsPreset,
  type PresetWorkspace,
} from "./presetWorkspaces";

interface PresetWorkspacesPopoverProps {
  open: boolean;
  onClose: () => void;
  presets: PresetWorkspace[];
  onChange: (next: PresetWorkspace[]) => void;
  onApply: (preset: PresetWorkspace) => void;
  currentRuntime: {
    modelOverride?: string;
    enabledTools: string[];
    maxIterations: number;
    allowMutations: boolean;
    includeProjectInstructions: boolean;
  };
}

export default function PresetWorkspacesPopover({
  open,
  onClose,
  presets,
  onChange,
  onApply,
  currentRuntime,
}: PresetWorkspacesPopoverProps) {
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<PresetWorkspace>>({});

  if (!open) return null;

  const handleSaveCurrent = () => {
    if (!draftName.trim()) return;
    const preset = captureCurrentAsPreset(
      draftName.trim(),
      draftDescription.trim() || undefined,
      currentRuntime,
    );
    onChange(addPreset(presets, preset));
    setDraftName("");
    setDraftDescription("");
    setShowForm(false);
  };

  const startEdit = (p: PresetWorkspace) => {
    setEditingId(p.id);
    setEditPatch({
      name: p.name,
      description: p.description,
      maxIterations: p.maxIterations,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    onChange(updatePreset(presets, editingId, editPatch));
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Preset workspaces"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,760px)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Preset workspaces</h2>
            <Badge variant="outline" className="text-[10px]">
              {presets.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-3 h-3 mr-1" /> Save current
            </Button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {showForm && (
            <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Save current runtime as preset
              </div>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Preset name"
                className="text-xs"
              />
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="text-xs"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div>
                  <span>{currentRuntime.enabledTools.length} tools</span>
                  <span className="ml-2">· {currentRuntime.maxIterations} iters</span>
                  {currentRuntime.allowMutations && (
                    <span className="ml-2 text-amber-500">· mutations</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveCurrent} disabled={!draftName.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {presets.map((preset) => {
            const isEditing = editingId === preset.id;
            return (
              <div
                key={preset.id}
                className="p-3 rounded border border-border text-xs"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={String(editPatch.name ?? "")}
                      onChange={(e) =>
                        setEditPatch((p) => ({ ...p, name: e.target.value }))
                      }
                      className="text-xs"
                      placeholder="Name"
                    />
                    <Textarea
                      value={String(editPatch.description ?? "")}
                      onChange={(e) =>
                        setEditPatch((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      className="text-xs"
                      placeholder="Description"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
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
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{preset.name}</span>
                          {preset.builtin && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 text-muted-foreground"
                            >
                              built-in
                            </Badge>
                          )}
                          {preset.allowMutations && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-500"
                            >
                              write
                            </Badge>
                          )}
                        </div>
                        {preset.description && (
                          <div className="text-[10px] italic text-muted-foreground mt-0.5">
                            {preset.description}
                          </div>
                        )}
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{preset.enabledTools.length} tool{preset.enabledTools.length === 1 ? "" : "s"}</span>
                          <span>· {preset.maxIterations} iters</span>
                          {preset.modelOverride && (
                            <span className="font-mono">· {preset.modelOverride}</span>
                          )}
                        </div>
                      </div>
                      {!preset.builtin && (
                        <>
                          <button
                            onClick={() => startEdit(preset)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${preset.name}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onChange(removePreset(presets, preset.id))}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${preset.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        onApply(preset);
                        onClose();
                      }}
                      className="w-full justify-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> Apply
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
