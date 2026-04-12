/**
 * ToolAuditPopover — Pass 249.
 *
 * Modal UI for the Tool Audit Rules system. Two tabs:
 *   1. Rules — add/edit/toggle/delete the rule list (with built-ins
 *      preserved via seedBuiltins on any parse round-trip).
 *   2. Trail — live audit entries with filter chips + CSV export.
 *
 * The component is stateless — all mutations go through a single
 * `onChange` callback so the parent (CodeChat.tsx) can persist the
 * result to localStorage.
 */

import { useState, useMemo } from "react";
import { X, ShieldCheck, Plus, Trash2, Pencil, Check, XCircle, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addRule,
  removeRule,
  toggleRule,
  updateRule,
  clearEntries,
  exportAuditCsv,
  summarizeTrail,
  type AuditState,
  type AuditRule,
  type AuditVerdict,
  type AuditEntry,
} from "./toolAudit";

const VERDICT_STYLE: Record<AuditVerdict, string> = {
  safe: "border-emerald-500/40 text-emerald-500 bg-emerald-500/5",
  log: "border-border text-muted-foreground bg-muted/10",
  warn: "border-amber-500/40 text-amber-500 bg-amber-500/5",
  block: "border-destructive/40 text-destructive bg-destructive/5",
};

function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

function downloadCsv(csv: string, filename: string): void {
  try {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* best effort */
  }
}

interface ToolAuditPopoverProps {
  open: boolean;
  onClose: () => void;
  state: AuditState;
  onChange: (next: AuditState) => void;
}

export default function ToolAuditPopover({
  open,
  onClose,
  state,
  onChange,
}: ToolAuditPopoverProps) {
  const [tab, setTab] = useState<"rules" | "trail">("rules");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftTool, setDraftTool] = useState("run_bash");
  const [draftPattern, setDraftPattern] = useState("");
  const [draftVerdict, setDraftVerdict] = useState<AuditVerdict>("warn");
  const [draftNote, setDraftNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<AuditRule>>({});
  const [trailFilter, setTrailFilter] = useState<AuditVerdict | "all">("all");

  const summary = useMemo(() => summarizeTrail(state.entries), [state.entries]);
  const filteredTrail = useMemo<AuditEntry[]>(() => {
    if (trailFilter === "all") return [...state.entries].reverse();
    return [...state.entries].reverse().filter((e) => e.verdict === trailFilter);
  }, [state.entries, trailFilter]);

  if (!open) return null;

  const handleAdd = () => {
    const label = draftLabel.trim();
    if (!label) return;
    const tool = draftTool.trim() || "*";
    const patternValid =
      !draftPattern ||
      (() => {
        try {
          new RegExp(draftPattern, "i");
          return true;
        } catch {
          return false;
        }
      })();
    if (!patternValid) {
      alert("Invalid regex pattern");
      return;
    }
    onChange(
      addRule(state, {
        label,
        tool,
        verdict: draftVerdict,
        argPattern: draftPattern || undefined,
        note: draftNote.trim() || undefined,
      }),
    );
    setDraftLabel("");
    setDraftPattern("");
    setDraftNote("");
  };

  const handleDelete = (id: string) => {
    onChange(removeRule(state, id));
  };

  const handleToggle = (id: string) => {
    onChange(toggleRule(state, id));
  };

  const startEdit = (rule: AuditRule) => {
    setEditingId(rule.id);
    setEditDraft({
      label: rule.label,
      tool: rule.tool,
      argPattern: rule.argPattern,
      verdict: rule.verdict,
      note: rule.note,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    onChange(updateRule(state, editingId, editDraft));
    setEditingId(null);
    setEditDraft({});
  };

  const handleExport = () => {
    const csv = exportAuditCsv(state.entries);
    downloadCsv(csv, `codechat-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleClearTrail = () => {
    if (!confirm("Clear all audit trail entries? This cannot be undone.")) return;
    onChange(clearEntries(state));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tool audit rules"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,800px)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Tool Audit</h2>
            <Badge variant="outline" className="text-[10px]">
              {state.rules.length} rule{state.rules.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {summary.total} entries
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

        <div className="flex gap-1 px-4 pt-3 border-b border-border/40">
          <button
            onClick={() => setTab("rules")}
            className={`px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${
              tab === "rules"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setTab("trail")}
            className={`px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${
              tab === "trail"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Trail
            {summary.byVerdict.warn + summary.byVerdict.block > 0 && (
              <Badge
                variant="outline"
                className="ml-2 text-[9px] border-amber-500/50 text-amber-500"
              >
                {summary.byVerdict.warn + summary.byVerdict.block}
              </Badge>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === "rules" && (
            <div className="space-y-4">
              <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  Add rule
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Label (e.g. Block rm -rf)"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Tool (e.g. run_bash, * for any)"
                    value={draftTool}
                    onChange={(e) => setDraftTool(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <Input
                  placeholder="Arg regex (optional, e.g. rm\s+-rf)"
                  value={draftPattern}
                  onChange={(e) => setDraftPattern(e.target.value)}
                  className="text-xs font-mono"
                />
                <Input
                  placeholder="Note shown when the rule fires (optional)"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  className="text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {(["log", "safe", "warn", "block"] as AuditVerdict[]).map(
                      (v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDraftVerdict(v)}
                          className={`px-2 py-0.5 rounded border text-[10px] capitalize ${
                            draftVerdict === v ? VERDICT_STYLE[v] : "border-border text-muted-foreground"
                          }`}
                        >
                          {v}
                        </button>
                      ),
                    )}
                  </div>
                  <Button size="sm" onClick={handleAdd} disabled={!draftLabel.trim()}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                {state.rules.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No rules yet. Add one above.
                  </p>
                )}
                {state.rules.map((rule) => {
                  const isEditing = editingId === rule.id;
                  return (
                    <div
                      key={rule.id}
                      className={`p-2 rounded border text-xs ${
                        rule.enabled ? "border-border" : "border-border/40 opacity-50"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={String(editDraft.label ?? "")}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, label: e.target.value }))
                            }
                            className="text-xs"
                            placeholder="Label"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={String(editDraft.tool ?? "")}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, tool: e.target.value }))
                              }
                              className="text-xs font-mono"
                              placeholder="Tool"
                            />
                            <Input
                              value={String(editDraft.argPattern ?? "")}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  argPattern: e.target.value || undefined,
                                }))
                              }
                              className="text-xs font-mono"
                              placeholder="Arg regex"
                            />
                          </div>
                          <div className="flex gap-1">
                            {(["log", "safe", "warn", "block"] as AuditVerdict[]).map(
                              (v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((d) => ({ ...d, verdict: v }))
                                  }
                                  className={`px-2 py-0.5 rounded border text-[10px] capitalize ${
                                    editDraft.verdict === v
                                      ? VERDICT_STYLE[v]
                                      : "border-border text-muted-foreground"
                                  }`}
                                >
                                  {v}
                                </button>
                              ),
                            )}
                          </div>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" onClick={saveEdit}>
                              <Check className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggle(rule.id)}
                            className="mt-0.5"
                            aria-label={`Toggle rule ${rule.label}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{rule.label}</span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] h-4 px-1.5 ${VERDICT_STYLE[rule.verdict]}`}
                              >
                                {rule.verdict}
                              </Badge>
                              <code className="text-[10px] text-muted-foreground font-mono">
                                {rule.tool}
                              </code>
                              {rule.id.startsWith("builtin-") && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1.5 text-muted-foreground"
                                >
                                  built-in
                                </Badge>
                              )}
                            </div>
                            {rule.argPattern && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
                                /{rule.argPattern}/
                              </div>
                            )}
                            {rule.note && (
                              <div className="mt-0.5 text-[10px] italic text-muted-foreground">
                                {rule.note}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => startEdit(rule)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Edit rule ${rule.label}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete rule ${rule.label}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "trail" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(["all", "block", "warn", "log", "safe"] as const).map((v) => {
                    const count = v === "all" ? summary.total : summary.byVerdict[v];
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTrailFilter(v)}
                        className={`px-2 py-0.5 rounded border text-[10px] capitalize ${
                          trailFilter === v
                            ? "bg-accent/10 border-accent/40 text-accent"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {v} ({count})
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExport}
                    disabled={state.entries.length === 0}
                  >
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearTrail}
                    disabled={state.entries.length === 0}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear
                  </Button>
                </div>
              </div>

              {filteredTrail.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-8">
                  No audit entries {trailFilter === "all" ? "yet" : `for "${trailFilter}"`}.
                </p>
              )}
              {filteredTrail.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2 rounded border border-border text-xs"
                >
                  <div className="flex items-center gap-2">
                    {entry.verdict === "block" || entry.verdict === "warn" ? (
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 px-1.5 ${VERDICT_STYLE[entry.verdict]}`}
                    >
                      {entry.verdict}
                    </Badge>
                    <code className="text-[10px] text-muted-foreground font-mono">
                      {entry.toolName}
                    </code>
                    <span className="font-semibold truncate">{entry.ruleLabel}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  {entry.note && (
                    <div className="mt-0.5 pl-5 text-[10px] italic text-muted-foreground">
                      {entry.note}
                    </div>
                  )}
                  {entry.argsPreview && (
                    <div className="mt-0.5 pl-5 text-[10px] font-mono text-muted-foreground/80 truncate">
                      {entry.argsPreview}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
