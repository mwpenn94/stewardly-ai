/**
 * AgentMemoryPopover — manage persistent agent memory (Pass 241).
 *
 * Modal for adding, editing, categorizing, and clearing the per-user
 * memory entries that get injected into every Code Chat system prompt.
 *
 * UX:
 *   - Category filter chips at the top
 *   - Add form (content + category picker)
 *   - Scrollable entry list with per-entry edit/delete
 *   - Clear-all action at the bottom with confirm
 *   - Count badge in the header
 */

import { useState } from "react";
import { X, Brain, Plus, Trash2, Pencil, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addMemory,
  removeMemory,
  updateMemory,
  clearMemory,
  filterByCategory,
  summarizeMemory,
  CATEGORIES,
  CATEGORY_ICONS,
  type MemoryEntry,
  type MemoryCategory,
} from "./agentMemory";

const CATEGORY_STYLE: Record<MemoryCategory, string> = {
  project: "border-chart-2/40 text-chart-2 bg-chart-2/5",
  preference: "border-accent/40 text-accent bg-accent/5",
  fact: "border-border/60 text-muted-foreground bg-muted/10",
  warning: "border-destructive/40 text-destructive bg-destructive/5",
};

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface AgentMemoryPopoverProps {
  open: boolean;
  onClose: () => void;
  entries: MemoryEntry[];
  onChange: (next: MemoryEntry[]) => void;
}

export default function AgentMemoryPopover({
  open,
  onClose,
  entries,
  onChange,
}: AgentMemoryPopoverProps) {
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [newDraft, setNewDraft] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("fact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryCategory>("fact");

  if (!open) return null;

  const summary = summarizeMemory(entries);
  const filtered = filterByCategory(entries, filter);

  const handleAdd = () => {
    const trimmed = newDraft.trim();
    if (!trimmed) return;
    onChange(addMemory(entries, trimmed, newCategory));
    setNewDraft("");
  };

  const startEdit = (e: MemoryEntry) => {
    setEditingId(e.id);
    setEditDraft(e.content);
    setEditCategory(e.category);
  };

  const commitEdit = () => {
    if (!editingId) return;
    onChange(
      updateMemory(entries, editingId, {
        content: editDraft,
        category: editCategory,
      }),
    );
    setEditingId(null);
    setEditDraft("");
  };

  const handleClear = () => {
    if (entries.length === 0) return;
    if (confirm(`Clear all ${entries.length} memory entries? This can't be undone.`)) {
      onChange(clearMemory());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Agent memory"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="h-4 w-4 text-accent shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Agent memory
            </h2>
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground font-mono"
            >
              {summary.total} entries
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close memory"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground px-5 py-2 border-b border-border/30">
          Persistent facts injected into every Code Chat system prompt. The
          agent treats these as authoritative context unless you override in
          the conversation. Max 200 entries, 1000 chars each.
        </p>

        {/* Add form */}
        <div className="px-5 py-3 border-b border-border/40 bg-background/40 space-y-2">
          <Textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder="Add a memory — 'This project uses Drizzle, not Prisma' / 'Always use pnpm' / ..."
            rows={2}
            className="text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
            aria-label="New memory content"
          />
          <div className="flex items-center gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              className="h-7 px-2 text-[10px] rounded border border-border bg-background font-mono"
              aria-label="Category for new memory"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_ICONS[c]} {c}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <span className="text-[9px] text-muted-foreground font-mono">
              ⌘+Enter to add
            </span>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newDraft.trim()}
              className="h-7 text-[11px] bg-accent text-accent-foreground hover:bg-accent/90"
              aria-label="Save memory entry"
            >
              <Plus className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border/30 overflow-x-auto">
          <button
            type="button"
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              filter === "all"
                ? "bg-accent/10 border-accent/40 text-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
          >
            all ({summary.total})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                filter === c
                  ? CATEGORY_STYLE[c]
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
            >
              {CATEGORY_ICONS[c]} {c} ({summary.byCategory[c]})
            </button>
          ))}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              {entries.length === 0
                ? "No memory entries yet. Add one above to seed the agent's context."
                : `No entries in the "${filter}" category.`}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((e) => {
                const isEditing = editingId === e.id;
                return (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border/40 bg-background/40 overflow-hidden"
                  >
                    <div className="flex items-start gap-2 px-3 py-2">
                      <Badge
                        variant="outline"
                        className={`text-[9px] h-4 px-1.5 shrink-0 mt-0.5 border ${CATEGORY_STYLE[e.category]}`}
                      >
                        {CATEGORY_ICONS[e.category]} {e.category}
                      </Badge>
                      {isEditing ? (
                        <div className="flex-1 space-y-1.5">
                          <Textarea
                            value={editDraft}
                            onChange={(ev) => setEditDraft(ev.target.value)}
                            rows={2}
                            className="text-xs resize-none min-h-[44px]"
                            autoFocus
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" && !ev.shiftKey) {
                                ev.preventDefault();
                                commitEdit();
                              }
                              if (ev.key === "Escape") {
                                ev.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            aria-label="Edit memory content"
                          />
                          <div className="flex items-center gap-1.5">
                            <select
                              value={editCategory}
                              onChange={(ev) =>
                                setEditCategory(ev.target.value as MemoryCategory)
                              }
                              className="h-6 px-1.5 text-[10px] rounded border border-border bg-background"
                              aria-label="Edit category"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {CATEGORY_ICONS[c]} {c}
                                </option>
                              ))}
                            </select>
                            <div className="flex-1" />
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500"
                              onClick={commitEdit}
                              aria-label="Save edit"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-destructive/10 text-destructive"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel edit"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground break-words whitespace-pre-wrap">
                              {e.content}
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5 font-mono tabular-nums">
                              {formatRelativeTime(e.updatedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(e)}
                              aria-label="Edit memory"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              onClick={() => onChange(removeMemory(entries, e.id))}
                              aria-label="Delete memory"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-2 border-t border-border/40 bg-background/40">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="h-6 text-[10px] text-destructive hover:text-destructive"
              aria-label="Clear all memory"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Clear all
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
