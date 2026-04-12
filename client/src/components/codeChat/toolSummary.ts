/**
 * Tool call summary aggregator (Pass 217).
 *
 * Pure function that reduces a `ToolEvent[]` into a compact per-message
 * receipt — "Read 4 files · Grep 2 · Edit 1 file · Wrote 1 · Bash 1".
 * Used under every assistant message to give the user a quick glance
 * at what the agent actually did during that turn.
 */

import type { ToolEvent } from "@/hooks/useCodeChatStream";

export interface ToolSummary {
  reads: number;
  lists: number;
  greps: number;
  writes: number;
  edits: number;
  bashRuns: number;
  webFetches: number;
  errors: number;
  totalDurationMs: number;
  /** Unique file paths the agent touched (union of read/write/edit) */
  filesTouched: string[];
}

export function summarizeToolEvents(events: ToolEvent[] | undefined): ToolSummary {
  const summary: ToolSummary = {
    reads: 0,
    lists: 0,
    greps: 0,
    writes: 0,
    edits: 0,
    bashRuns: 0,
    webFetches: 0,
    errors: 0,
    totalDurationMs: 0,
    filesTouched: [],
  };
  if (!events || events.length === 0) return summary;

  const files = new Set<string>();

  for (const ev of events) {
    if (ev.status === "error") summary.errors++;
    if (ev.durationMs) summary.totalDurationMs += ev.durationMs;

    const path =
      typeof ev.args?.path === "string" ? (ev.args.path as string) : null;

    switch (ev.toolName) {
      case "read_file":
        summary.reads++;
        if (path) files.add(path);
        break;
      case "list_directory":
        summary.lists++;
        break;
      case "grep_search":
        summary.greps++;
        break;
      case "write_file":
        summary.writes++;
        if (path) files.add(path);
        break;
      case "edit_file":
        summary.edits++;
        if (path) files.add(path);
        break;
      case "multi_edit":
        // Multi_edit is a batch operation — count as one edit from the
        // summary's perspective since the user asked for one
        // coordinated change. Path still counted in filesTouched.
        summary.edits++;
        if (path) files.add(path);
        break;
      case "run_bash":
        summary.bashRuns++;
        break;
      case "web_fetch":
        summary.webFetches++;
        break;
    }
  }

  summary.filesTouched = Array.from(files).sort();
  return summary;
}

/**
 * Render the summary as an array of `{ label, count }` chips for
 * the UI layer. Empty counts are filtered out so the UI only shows
 * what's relevant.
 */
export function summaryChips(
  s: ToolSummary,
): Array<{ key: string; label: string; count: number; variant: "info" | "warn" | "error" }> {
  const chips: Array<{ key: string; label: string; count: number; variant: "info" | "warn" | "error" }> = [];
  if (s.reads > 0) chips.push({ key: "read", label: "read", count: s.reads, variant: "info" });
  if (s.lists > 0) chips.push({ key: "list", label: "list", count: s.lists, variant: "info" });
  if (s.greps > 0) chips.push({ key: "grep", label: "grep", count: s.greps, variant: "info" });
  if (s.writes > 0) chips.push({ key: "write", label: "write", count: s.writes, variant: "warn" });
  if (s.edits > 0) chips.push({ key: "edit", label: "edit", count: s.edits, variant: "warn" });
  if (s.bashRuns > 0) chips.push({ key: "bash", label: "bash", count: s.bashRuns, variant: "warn" });
  if (s.webFetches > 0) chips.push({ key: "web", label: "web", count: s.webFetches, variant: "info" });
  if (s.errors > 0) chips.push({ key: "errors", label: "errors", count: s.errors, variant: "error" });
  return chips;
}

/**
 * Build a one-line human summary — "Read 4 files, grep 2, edit 1"
 * — for toasts, exports, or collapsed trace headers.
 */
export function summarySentence(s: ToolSummary): string {
  const parts: string[] = [];
  if (s.reads) parts.push(`${s.reads} read${s.reads === 1 ? "" : "s"}`);
  if (s.lists) parts.push(`${s.lists} list${s.lists === 1 ? "" : "s"}`);
  if (s.greps) parts.push(`${s.greps} grep${s.greps === 1 ? "" : "s"}`);
  if (s.writes) parts.push(`${s.writes} write${s.writes === 1 ? "" : "s"}`);
  if (s.edits) parts.push(`${s.edits} edit${s.edits === 1 ? "" : "s"}`);
  if (s.bashRuns) parts.push(`${s.bashRuns} bash`);
  if (s.webFetches) parts.push(`${s.webFetches} web fetch${s.webFetches === 1 ? "" : "es"}`);
  if (s.errors) parts.push(`${s.errors} error${s.errors === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "no tool calls";
}
