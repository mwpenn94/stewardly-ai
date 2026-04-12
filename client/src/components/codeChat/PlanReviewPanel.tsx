/**
 * PlanReviewPanel — interactive plan editor + executor (Pass 236).
 *
 * Renders a `Plan` inline inside the chat as a Claude-Code-style plan
 * review card. Users can:
 *   - Edit step descriptions inline
 *   - Reorder steps (↑ / ↓)
 *   - Add / remove steps
 *   - Approve the full plan to trigger execution
 *   - Reject the plan (abort)
 *
 * The component is purely presentational — all state lives in the
 * parent through `plan` + `onChange`. Execution is delegated to the
 * parent via `onApprove` which receives the final plan.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Play,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  X,
  Loader2,
  MinusCircle,
  Undo2,
} from "lucide-react";
import {
  type Plan,
  type PlanStep,
  type PlanStepStatus,
  addStep,
  removeStep,
  reorderStep,
  updateStepDescription,
  approveAllSteps,
  rejectPlan,
  unapprovePlan,
  planProgress,
} from "./planMode";

export interface PlanReviewPanelProps {
  plan: Plan;
  onChange: (next: Plan) => void;
  onApprove: (plan: Plan) => void;
  onReject?: (plan: Plan) => void;
  /** Pass v5 #83: fully drop the plan from the parent's message→plan
   *  map. Discard always confirms first via `window.confirm`. */
  onDiscard?: (plan: Plan) => void;
  /** When true, renders the panel as read-only — used once execution is
   *  under way so the user can see live status but not edit. */
  readOnly?: boolean;
}

const STATUS_STYLE: Record<PlanStepStatus, { cls: string; label: string; Icon?: typeof CheckCircle2 }> = {
  pending: { cls: "text-muted-foreground", label: "pending" },
  approved: { cls: "text-accent", label: "approved" },
  executing: { cls: "text-chart-3 animate-pulse", label: "running", Icon: Loader2 },
  done: { cls: "text-emerald-500", label: "done", Icon: CheckCircle2 },
  failed: { cls: "text-destructive", label: "failed", Icon: XCircle },
  skipped: { cls: "text-muted-foreground/60", label: "skipped", Icon: MinusCircle },
};

export default function PlanReviewPanel({
  plan,
  onChange,
  onApprove,
  onReject,
  onDiscard,
  readOnly = false,
}: PlanReviewPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [newStepDraft, setNewStepDraft] = useState<string>("");

  const progress = planProgress(plan);
  const canEdit = !readOnly && plan.status === "draft";

  // Pass v5 #83: show Unapprove only when plan is approved but no step
  // has actually started executing yet. Once any step hits executing/
  // done/failed, the plan is locked.
  const canUnapprove =
    !readOnly &&
    plan.status === "approved" &&
    plan.steps.every(
      (s) => s.status === "pending" || s.status === "approved" || s.status === "skipped",
    );

  const handleUnapprove = () => {
    const next = unapprovePlan(plan);
    if (next !== plan) onChange(next);
  };

  const handleDiscard = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Discard this plan? This cannot be undone.",
      );
      if (!ok) return;
    }
    onDiscard?.(plan);
  };

  const startEdit = (step: PlanStep) => {
    setEditingId(step.id);
    setEditDraft(step.description);
  };

  const commitEdit = () => {
    if (!editingId) return;
    onChange(updateStepDescription(plan, editingId, editDraft));
    setEditingId(null);
    setEditDraft("");
  };

  const handleAdd = () => {
    if (!newStepDraft.trim()) return;
    onChange(addStep(plan, newStepDraft));
    setNewStepDraft("");
  };

  const handleApprove = () => {
    const approved = approveAllSteps(plan);
    onChange(approved);
    onApprove(approved);
  };

  const handleReject = () => {
    const aborted = rejectPlan(plan);
    onChange(aborted);
    onReject?.(aborted);
  };

  return (
    <div
      className="my-3 rounded-xl border border-accent/30 bg-accent/5 overflow-hidden"
      role="region"
      aria-label={`Plan: ${plan.title}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-accent/20 bg-accent/10">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-accent/50 text-accent uppercase"
          >
            Plan
          </Badge>
          <span className="font-heading text-sm font-medium text-foreground truncate">
            {plan.title}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground tabular-nums shrink-0"
          >
            {plan.steps.length} steps
          </Badge>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1.5 uppercase ${
            plan.status === "approved"
              ? "border-emerald-500/40 text-emerald-500"
              : plan.status === "executing"
                ? "border-chart-3/40 text-chart-3"
                : plan.status === "complete"
                  ? "border-emerald-500/60 text-emerald-500"
                  : plan.status === "aborted"
                    ? "border-destructive/40 text-destructive"
                    : "border-border/60 text-muted-foreground"
          }`}
        >
          {plan.status}
        </Badge>
      </div>

      {/* Progress bar (only when not draft) */}
      {plan.status !== "draft" && progress.total > 0 && (
        <div className="px-4 pt-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>
              {progress.done}/{progress.total} done
              {progress.failed > 0 && ` · ${progress.failed} failed`}
              {progress.skipped > 0 && ` · ${progress.skipped} skipped`}
            </span>
            <span className="tabular-nums">{Math.round(progress.pct * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent via-chart-3 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress.pct * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <ol className="divide-y divide-border/20 p-2">
        {plan.steps.map((step, idx) => {
          const style = STATUS_STYLE[step.status];
          const Icon = style.Icon;
          const isEditing = editingId === step.id;
          return (
            <li
              key={step.id}
              className="flex items-start gap-2 px-2 py-2 group/step"
              aria-label={`Step ${idx + 1}: ${step.description}`}
            >
              <span
                className={`shrink-0 tabular-nums font-mono text-[10px] mt-0.5 w-5 text-right ${style.cls}`}
              >
                {idx + 1}.
              </span>
              <span className="shrink-0 mt-0.5">
                {Icon ? (
                  <Icon className={`h-3 w-3 ${style.cls}`} />
                ) : (
                  <span className={`h-3 w-3 block rounded-full border-2 ${style.cls}`} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    className="text-xs resize-none min-h-[44px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    aria-label="Edit step description"
                  />
                ) : (
                  <div
                    className={`text-xs leading-relaxed ${
                      step.status === "skipped"
                        ? "line-through text-muted-foreground/60"
                        : "text-foreground"
                    }`}
                  >
                    {step.description}
                  </div>
                )}
                {step.toolHint && !isEditing && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[9px] h-4 px-1.5 border-chart-3/40 text-chart-3 font-mono"
                  >
                    {step.toolHint}
                  </Badge>
                )}
                {step.note && !isEditing && (
                  <div className="mt-1 text-[10px] text-muted-foreground italic break-words">
                    {step.note}
                  </div>
                )}
              </div>
              {/* Per-step controls — only in draft */}
              {canEdit && !isEditing && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/step:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                    onClick={() => onChange(reorderStep(plan, step.id, "up"))}
                    disabled={idx === 0}
                    aria-label={`Move step ${idx + 1} up`}
                    title="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                    onClick={() => onChange(reorderStep(plan, step.id, "down"))}
                    disabled={idx === plan.steps.length - 1}
                    aria-label={`Move step ${idx + 1} down`}
                    title="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(step)}
                    aria-label={`Edit step ${idx + 1}`}
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(removeStep(plan, step.id))}
                    aria-label={`Remove step ${idx + 1}`}
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
              {canEdit && isEditing && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500"
                    onClick={commitEdit}
                    aria-label="Save edit"
                    title="Save (Enter)"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel edit"
                    title="Cancel (Esc)"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Add-step input (draft only) */}
      {canEdit && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 bg-background/40">
          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={newStepDraft}
            onChange={(e) => setNewStepDraft(e.target.value)}
            placeholder="Add a step…"
            className="flex-1 bg-transparent text-xs focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            aria-label="New step description"
          />
          {newStepDraft.trim() && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdd}
              className="h-6 text-[10px]"
            >
              Add
            </Button>
          )}
        </div>
      )}

      {/* Action bar */}
      {canEdit && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border/30 bg-background/20">
          {onDiscard && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDiscard}
              className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
              aria-label="Discard plan"
              title="Discard plan (cannot be undone)"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Discard
            </Button>
          )}
          {onReject && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              className="h-7 text-[11px]"
              aria-label="Reject plan"
            >
              <XCircle className="h-3 w-3 mr-1" /> Reject
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={plan.steps.length === 0}
            className="h-7 text-[11px] bg-accent text-accent-foreground hover:bg-accent/90"
            aria-label="Approve and execute plan"
          >
            <Play className="h-3 w-3 mr-1" /> Approve &amp; Execute
          </Button>
        </div>
      )}

      {/* Pass v5 #83: post-approval action bar — lets the user flip
          back to draft mode (if no step has executed yet) or discard
          the plan entirely. */}
      {!canEdit && !readOnly && (canUnapprove || onDiscard) && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-border/30 bg-background/10">
          {canUnapprove && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnapprove}
              className="h-7 text-[11px]"
              aria-label="Unapprove plan — flip back to draft mode"
              title="Unapprove — resume editing the plan"
            >
              <Undo2 className="h-3 w-3 mr-1" /> Unapprove
            </Button>
          )}
          {onDiscard && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDiscard}
              className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
              aria-label="Discard plan"
              title="Discard plan (cannot be undone)"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Discard
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
