/**
 * Conversation export helpers (Pass 208).
 *
 * Pure functions that convert Code Chat messages into a shareable
 * markdown snapshot. Used by both the "Export" action on a single
 * assistant message and the conversation-level download button.
 *
 * The export shape is intentionally Claude-Code-terminal-friendly:
 *   - Each turn is a fenced block with a ▸ header
 *   - Tool calls are rendered as collapsible `<details>` blocks so
 *     the primary prose stays readable on GitHub / Slack / email
 *   - Timing + model metadata land in a trailing metadata line
 */

import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

export interface ExportOptions {
  /** Include the tool call trace per assistant message. Default true. */
  includeTraces?: boolean;
  /** Include metadata line (model, iterations, duration). Default true. */
  includeMetadata?: boolean;
  /** Conversation title embedded at the top. */
  title?: string;
}

export function exportConversationAsMarkdown(
  messages: CodeChatMessage[],
  opts: ExportOptions = {},
): string {
  const includeTraces = opts.includeTraces ?? true;
  const includeMetadata = opts.includeMetadata ?? true;
  const lines: string[] = [];

  const title = opts.title ?? "Code Chat transcript";
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Exported ${new Date().toISOString()}_`);
  lines.push(`_${messages.length} message${messages.length === 1 ? "" : "s"}_`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`## ▸ User`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    } else {
      lines.push(`## ◂ Assistant`);
      lines.push("");
      if (includeTraces && msg.toolEvents && msg.toolEvents.length > 0) {
        lines.push(`<details><summary>${msg.toolEvents.length} tool call${msg.toolEvents.length === 1 ? "" : "s"}</summary>`);
        lines.push("");
        for (const ev of msg.toolEvents) {
          const args =
            ev.args && Object.keys(ev.args).length > 0
              ? ` ${Object.entries(ev.args)
                  .map(([k, v]) => `${k}=${shortValue(v)}`)
                  .join(" ")}`
              : "";
          const timing = ev.durationMs != null ? ` — ${ev.durationMs}ms` : "";
          lines.push(`- **\`${ev.toolName}\`**${args}${timing}`);
        }
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
      lines.push(msg.content);
      lines.push("");
      if (includeMetadata) {
        const meta: string[] = [];
        if (msg.model) meta.push(msg.model);
        if (msg.toolCallCount != null && msg.toolCallCount > 0)
          meta.push(`${msg.toolCallCount} tool calls`);
        if (msg.iterations != null) meta.push(`${msg.iterations} iterations`);
        if (msg.totalDurationMs != null)
          meta.push(`${(msg.totalDurationMs / 1000).toFixed(1)}s`);
        if (meta.length > 0) {
          lines.push(`_${meta.join(" · ")}_`);
          lines.push("");
        }
      }
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function exportSingleMessageAsMarkdown(msg: CodeChatMessage): string {
  return exportConversationAsMarkdown([msg], {
    title:
      msg.role === "user" ? "Code Chat — user prompt" : "Code Chat — response",
  });
}

function shortValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

/** Trigger a browser download of `content` as `filename`. */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
