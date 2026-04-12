/**
 * HooksPopover — manage user-defined Code Chat hooks (Pass 249).
 *
 * Claude Code parity: Users can create rules that fire on
 * PreToolUse/PostToolUse/SessionStart/UserPromptSubmit events and
 * block, warn, or inject context. This modal is the admin surface.
 *
 * UX:
 *   - Event filter chips at the top
 *   - Add form with pattern + event + action + message
 *   - Scrollable rule list with toggle/delete/inline edit
 *   - Summary header showing enabled/total + counts by event
 *   - Examples row to seed new users
 */

import { useState } from "react";
import { X, Webhook, Plus, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  makeHook,
  upsertHook,
  removeHook,
  toggleHook,
  filterByEvent,
  summarizeHooks,
  EVENT_LABELS,
  ACTION_LABELS,
  type HookRule,
  type HookEvent,
  type HookAction,
} from "./hooks";

const EVENT_STYLE: Record<HookEvent, string> = {
  PreToolUse: "border-accent/40 text-accent bg-accent/5",
  PostToolUse: "border-chart-2/40 text-chart-2 bg-chart-2/5",
  SessionStart: "border-chart-3/40 text-chart-3 bg-chart-3/5",
  UserPromptSubmit: "border-chart-4/40 text-chart-4 bg-chart-4/5",
};

const ACTION_STYLE: Record<HookAction, string> = {
  block: "border-destructive/40 text-destructive bg-destructive/5",
  warn: "border-chart-3/40 text-chart-3 bg-chart-3/5",
  inject_prompt: "border-accent/40 text-accent bg-accent/5",
  inject_system: "border-chart-2/40 text-chart-2 bg-chart-2/5",
};

const EXAMPLES: Array<{
  label: string;
  pattern: string;
  event: HookEvent;
  action: HookAction;
  message: string;
}> = [
  {
    label: "Block .env writes",
    pattern: "write_*:*.env*",
    event: "PreToolUse",
    action: "block",
    message: "Writing to .env files is not allowed from Code Chat.",
  },
  {
    label: "Warn on bash",
    pattern: "run_bash",
    event: "PreToolUse",
    action: "warn",
    message: "Heads up: bash command about to run.",
  },
  {
    label: "Inject house rules",
    pattern: "*",
    event: "SessionStart",
    action: "inject_system",
    message:
      "House rules: prefer TypeScript strict, small PRs, and add tests for any new pure module.",
  },
  {
    label: "Remind to run tests on edits",
    pattern: "edit_file",
    event: "PostToolUse",
    action: "warn",
    message: "Remember to run tests when you're done editing.",
  },
];

const EVENTS: HookEvent[] = [
  "PreToolUse",
  "PostToolUse",
  "SessionStart",
  "UserPromptSubmit",
];

const ACTIONS: HookAction[] = [
  "block",
  "warn",
  "inject_prompt",
  "inject_system",
];

interface HooksPopoverProps {
  open: boolean;
  onClose: () => void;
  hooks: HookRule[];
  onChange: (next: HookRule[]) => void;
}

export default function HooksPopover({
  open,
  onClose,
  hooks,
  onChange,
}: HooksPopoverProps) {
  const [filter, setFilter] = useState<HookEvent | "all">("all");
  const [draftPattern, setDraftPattern] = useState("");
  const [draftEvent, setDraftEvent] = useState<HookEvent>("PreToolUse");
  const [draftAction, setDraftAction] = useState<HookAction>("warn");
  const [draftMessage, setDraftMessage] = useState("");

  if (!open) return null;

  const summary = summarizeHooks(hooks);
  const filtered =
    filter === "all" ? hooks : filterByEvent(hooks, filter);

  const handleAdd = () => {
    const pattern = draftPattern.trim();
    if (!pattern) return;
    const next = makeHook({
      event: draftEvent,
      pattern,
      action: draftAction,
      message: draftMessage.trim(),
    });
    onChange(upsertHook(hooks, next));
    setDraftPattern("");
    setDraftMessage("");
  };

  const handleSeedFromExample = (ex: (typeof EXAMPLES)[number]) => {
    setDraftPattern(ex.pattern);
    setDraftEvent(ex.event);
    setDraftAction(ex.action);
    setDraftMessage(ex.message);
  };

  const handleClearAll = () => {
    if (hooks.length === 0) return;
    if (confirm(`Delete all ${hooks.length} hooks? This can't be undone.`)) {
      onChange([]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="User-defined hooks"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <Webhook className="h-4 w-4 text-accent shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Hooks
            </h2>
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground font-mono"
            >
              {summary.enabled}/{summary.total} active
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close hooks"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground px-5 py-2 border-b border-border/30">
          Hook rules fire on Code Chat events. Use{" "}
          <code className="px-1 rounded bg-muted/40 font-mono">*</code> as a
          wildcard,{" "}
          <code className="px-1 rounded bg-muted/40 font-mono">write_*:*.env</code>{" "}
          to filter on tool and argument, or{" "}
          <code className="px-1 rounded bg-muted/40 font-mono">[read_file|write_file]</code>{" "}
          for OR groups.
        </p>

        {/* Examples row */}
        <div className="px-5 py-2 border-b border-border/30 bg-background/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-mono shrink-0">
              seed:
            </span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => handleSeedFromExample(ex)}
                className="px-2 py-0.5 rounded-full text-[10px] border border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
              >
                <Copy className="h-2.5 w-2.5 inline mr-1" />
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add form */}
        <div className="px-5 py-3 border-b border-border/40 bg-background/40 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={draftPattern}
              onChange={(e) => setDraftPattern(e.target.value)}
              placeholder="Pattern (e.g. write_*:*.env, run_bash, *deploy*)"
              className="h-8 text-xs font-mono flex-1 min-w-0"
              aria-label="Hook pattern"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={draftEvent}
              onChange={(e) => setDraftEvent(e.target.value as HookEvent)}
              className="h-7 px-2 text-[10px] rounded border border-border bg-background font-mono"
              aria-label="Hook event"
            >
              {EVENTS.map((e) => (
                <option key={e} value={e}>
                  {EVENT_LABELS[e]}
                </option>
              ))}
            </select>
            <select
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value as HookAction)}
              className="h-7 px-2 text-[10px] rounded border border-border bg-background font-mono"
              aria-label="Hook action"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <span className="text-[9px] text-muted-foreground font-mono">
              ⌘+Enter to save
            </span>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!draftPattern.trim()}
              className="h-7 text-[11px] bg-accent text-accent-foreground hover:bg-accent/90"
              aria-label="Save hook rule"
            >
              <Plus className="h-3 w-3 mr-1" /> Add hook
            </Button>
          </div>
          <Textarea
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            placeholder="Message (shown when block/warn fires, or injected when inject_* is chosen)"
            rows={2}
            className="text-xs resize-none"
            aria-label="Hook message"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border/30 overflow-x-auto shrink-0">
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
          {EVENTS.map((e) => (
            <button
              key={e}
              type="button"
              className={`px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap transition-colors ${
                filter === e
                  ? EVENT_STYLE[e]
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter(e)}
              aria-pressed={filter === e}
            >
              {e} ({summary.byEvent[e]})
            </button>
          ))}
        </div>

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              {hooks.length === 0
                ? "No hooks yet. Use one of the seeds above or write your own pattern."
                : `No hooks in the "${filter}" event.`}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((h) => (
                <li
                  key={h.id}
                  className={`rounded-lg border border-border/40 bg-background/40 overflow-hidden ${
                    !h.enabled ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onChange(toggleHook(hooks, h.id))}
                      className={`h-4 w-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${
                        h.enabled
                          ? "bg-accent/20 border-accent text-accent"
                          : "border-border bg-background"
                      }`}
                      aria-label={h.enabled ? "Disable hook" : "Enable hook"}
                      aria-pressed={h.enabled}
                    >
                      {h.enabled && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <code className="text-[11px] font-mono bg-muted/40 px-1.5 py-0.5 rounded truncate">
                          {h.pattern}
                        </code>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-4 px-1.5 border ${EVENT_STYLE[h.event]}`}
                        >
                          {h.event}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-4 px-1.5 border ${ACTION_STYLE[h.action]}`}
                        >
                          {h.action}
                        </Badge>
                      </div>
                      {h.message && (
                        <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                          {h.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(removeHook(hooks, h.id))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Delete hook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border/40 bg-background/40 shrink-0">
          <div className="text-[10px] text-muted-foreground font-mono">
            Pre: {summary.byEvent.PreToolUse} · Post:{" "}
            {summary.byEvent.PostToolUse} · Session:{" "}
            {summary.byEvent.SessionStart} · Prompt:{" "}
            {summary.byEvent.UserPromptSubmit}
          </div>
          {hooks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Clear all hooks"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Clear all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
