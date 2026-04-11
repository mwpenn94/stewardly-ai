/**
 * Conversation compact (Pass 232).
 *
 * `/compact` is a Claude-Code-terminal convention for trimming the
 * older half of a conversation into a single summary message to
 * free up context window. The real Claude Code runs the summary
 * through an LLM; we do a heuristic version client-side so the
 * feature works without an API round-trip and stays deterministic /
 * unit-testable.
 *
 * The compactor keeps the `keepRecent` most-recent messages verbatim
 * and replaces everything before them with a single synthetic
 * assistant message containing:
 *   - A bulleted list of every user prompt (truncated)
 *   - Tool-call counts aggregated by kind
 *   - Total duration of the compacted window
 *   - A "[compacted]" marker so users can identify the synthetic turn
 */

import type { CodeChatMessage } from "@/hooks/useCodeChatStream";
import { summarizeToolEvents, summarySentence } from "./toolSummary";

export interface CompactResult {
  /** True when compaction actually did something (i.e. older messages existed) */
  compacted: boolean;
  /** The post-compact message list */
  messages: CodeChatMessage[];
  /** How many messages were collapsed into the summary (0 if no-op) */
  collapsed: number;
}

/**
 * Compact the older portion of a conversation into a single summary
 * assistant message. Returns the original message list unchanged
 * when there's nothing to compact (fewer than `keepRecent + 2`
 * messages, or no user messages in the collapsed range).
 *
 * `keepRecent` defaults to 4 — the last 2 user/assistant pairs stay
 * verbatim so recent context is preserved intact for the agent.
 */
export function compactConversation(
  messages: CodeChatMessage[],
  keepRecent: number = 4,
): CompactResult {
  if (keepRecent < 0) keepRecent = 0;
  if (messages.length <= keepRecent + 1) {
    return { compacted: false, messages, collapsed: 0 };
  }

  const splitIdx = messages.length - keepRecent;
  const older = messages.slice(0, splitIdx);
  const recent = messages.slice(splitIdx);

  if (older.length === 0) {
    return { compacted: false, messages, collapsed: 0 };
  }

  const summary = buildSummary(older);
  const summaryMessage: CodeChatMessage = {
    id: `compact-${Date.now()}`,
    role: "assistant",
    content: summary,
    timestamp: new Date(),
    // Stamp a distinct model label so the meta bar shows "compacted"
    model: "[compacted]",
  };

  return {
    compacted: true,
    messages: [summaryMessage, ...recent],
    collapsed: older.length,
  };
}

/**
 * Build a readable summary of a range of messages as markdown.
 * Pure formatting — extracted so tests can lock in the layout.
 */
export function buildSummary(messages: CodeChatMessage[]): string {
  const lines: string[] = [];
  lines.push(`> **[compacted]** Summary of ${messages.length} earlier message${messages.length === 1 ? "" : "s"}`);
  lines.push("");

  // User prompts — the most useful recall for restoring context
  const userPrompts = messages.filter((m) => m.role === "user");
  if (userPrompts.length > 0) {
    lines.push(`**User prompts (${userPrompts.length}):**`);
    for (const msg of userPrompts) {
      const first = msg.content.split("\n")[0].trim();
      const truncated = first.length > 100 ? first.slice(0, 97) + "…" : first;
      lines.push(`- ${truncated}`);
    }
    lines.push("");
  }

  // Tool-call aggregate
  const allEvents = messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.toolEvents ?? []);
  if (allEvents.length > 0) {
    const agg = summarizeToolEvents(allEvents);
    lines.push(`**Agent activity:** ${summarySentence(agg)}`);
    if (agg.filesTouched.length > 0) {
      const shown = agg.filesTouched.slice(0, 10);
      lines.push(`**Files touched:** ${shown.join(", ")}${agg.filesTouched.length > 10 ? `, +${agg.filesTouched.length - 10} more` : ""}`);
    }
    lines.push("");
  }

  // Total wall-clock
  const totalMs = messages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + (m.totalDurationMs ?? 0), 0);
  if (totalMs > 0) {
    lines.push(`**Total time:** ${(totalMs / 1000).toFixed(1)}s`);
    lines.push("");
  }

  lines.push(
    "_Use `/clear` to start fresh, or continue from here — the recent turns are still intact below._",
  );

  return lines.join("\n");
}
