/**
 * Error digest — Pass 267.
 *
 * Walks the conversation history + tool events and extracts every
 * error-shaped signal (tool_result with kind=error, assistant
 * messages mentioning "Error:", traces with failed steps) into a
 * structured digest so users can triage a long session at a glance.
 *
 * Pure, no React. Integration lives in ErrorDigestPopover.tsx and
 * the config bar which shows a count badge when errors exist.
 */

export type ErrorSource =
  | "tool_error"
  | "bash_exit"
  | "diagnostic"
  | "assistant_error"
  | "rate_limit"
  | "unknown";

export interface DigestEntry {
  id: string;
  source: ErrorSource;
  /** Human-readable summary — first line of the error */
  summary: string;
  /** The full message text, capped at 500 chars */
  detail: string;
  /** Message ID this error came from */
  messageId?: string;
  /** Tool name if the error came from a tool */
  toolName?: string;
  /** Step index if the error came from a tool event */
  stepIndex?: number;
  /** Unix ms */
  timestamp: number;
}

export interface ErrorDigest {
  entries: DigestEntry[];
  totalCount: number;
  bySource: Record<ErrorSource, number>;
  /** Most common error keywords — useful for cluster-at-a-glance */
  topKeywords: Array<{ word: string; count: number }>;
}

interface MessageLike {
  id: string;
  role: string;
  content: string;
  toolEvents?: Array<{
    stepIndex: number;
    toolName: string;
    kind?: string;
    preview?: string;
    durationMs?: number;
  }>;
  timestamp?: Date | number;
}

/**
 * Extract errors from a single assistant message's text body.
 * Matches lines starting with Error:, ERROR:, TypeError:, etc.
 */
function extractFromContent(content: string): string[] {
  if (!content) return [];
  const matches: string[] = [];
  const lines = content.split("\n");
  const errorRegex =
    /^(?:\s*)(?:Error|ERROR|TypeError|SyntaxError|ReferenceError|RangeError|Failed|FAILED|FAIL):\s*(.+)$/;
  const rateLimitRegex = /rate[\s-]?limit|too[\s-]?many[\s-]?requests|429/i;
  for (const line of lines) {
    const m = line.match(errorRegex);
    if (m) {
      matches.push(m[0].trim());
      continue;
    }
    if (rateLimitRegex.test(line)) {
      matches.push(line.trim());
    }
  }
  return matches;
}

/**
 * Classify an error message into a source bucket by content.
 */
export function classifyError(text: string): ErrorSource {
  const lower = text.toLowerCase();
  if (/rate.?limit|429|too many requests/.test(lower)) return "rate_limit";
  if (/\bexit\s+(?:code\s+)?\d/.test(lower)) return "bash_exit";
  if (/\bTS\d{4,}/.test(text) || /type.*not assignable/i.test(text)) return "diagnostic";
  if (/tool.*error|\b(write|edit|read)_file.*error/i.test(text))
    return "tool_error";
  return "unknown";
}

/**
 * Build a digest from the current message list. Scans both explicit
 * tool_result errors (preview kind === "error") and free-text errors
 * in assistant message content. Deduplicates by (messageId, summary).
 */
export function buildDigest(messages: MessageLike[]): ErrorDigest {
  const entries: DigestEntry[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    const ts =
      typeof msg.timestamp === "number"
        ? msg.timestamp
        : msg.timestamp instanceof Date
          ? msg.timestamp.getTime()
          : Date.now();

    // Tool event errors
    if (msg.toolEvents) {
      for (const ev of msg.toolEvents) {
        const isExplicitError = ev.kind === "error";
        const hasErrorField = ev.preview?.includes('"error"');
        const isBashFailure =
          ev.toolName === "run_bash" &&
          ev.preview?.includes('"exitCode":') &&
          !ev.preview.includes('"exitCode":0');
        if (!isExplicitError && !hasErrorField && !isBashFailure) continue;
        let detail = "";
        let source: ErrorSource = "tool_error";
        try {
          if (ev.preview) {
            const parsed = JSON.parse(ev.preview);
            detail = parsed.error ?? parsed.result?.error ?? ev.preview;
            // bash-specific exit code detection
            if (ev.toolName === "run_bash") {
              const exitCode = parsed.result?.exitCode;
              if (typeof exitCode === "number" && exitCode !== 0) {
                source = "bash_exit";
                detail = `exit ${exitCode}: ${parsed.result?.stderr?.split("\n")[0] ?? detail}`;
              }
            }
          }
        } catch {
          detail = ev.preview ?? "tool error";
        }
        const summary = String(detail).split("\n")[0].slice(0, 200);
        const dedupeKey = `${msg.id}:${ev.stepIndex}:${summary}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        entries.push({
          id: `e-${entries.length}-${ev.stepIndex}`,
          source,
          summary: summary || "(empty error)",
          detail: String(detail).slice(0, 500),
          messageId: msg.id,
          toolName: ev.toolName,
          stepIndex: ev.stepIndex,
          timestamp: ts,
        });
      }
    }

    // Content-level errors (only assistant messages)
    if (msg.role === "assistant") {
      const matches = extractFromContent(msg.content);
      for (const match of matches) {
        const summary = match.slice(0, 200);
        const dedupeKey = `${msg.id}:content:${summary}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        entries.push({
          id: `e-${entries.length}-content`,
          source: classifyError(match),
          summary,
          detail: match.slice(0, 500),
          messageId: msg.id,
          timestamp: ts,
        });
      }
    }
  }

  const bySource: Record<ErrorSource, number> = {
    tool_error: 0,
    bash_exit: 0,
    diagnostic: 0,
    assistant_error: 0,
    rate_limit: 0,
    unknown: 0,
  };
  for (const entry of entries) {
    bySource[entry.source]++;
  }

  return {
    entries,
    totalCount: entries.length,
    bySource,
    topKeywords: topErrorKeywords(entries),
  };
}

/**
 * Extract common keywords from the digest entries for cluster
 * visualization. Returns up to 10 words sorted by frequency.
 */
export function topErrorKeywords(
  entries: DigestEntry[],
  limit = 10,
): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  const stopwords = new Set([
    "error", "the", "a", "an", "is", "in", "of", "to", "from",
    "was", "for", "with", "at", "on", "by", "as", "this", "that",
    "it", "be", "or", "not", "if", "then", "could", "failed",
  ]);
  for (const entry of entries) {
    const words = entry.summary
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length >= 3 && !stopwords.has(w));
    for (const w of words) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const sorted: Array<{ word: string; count: number }> = [];
  counts.forEach((count, word) => {
    sorted.push({ word, count });
  });
  sorted.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return sorted.slice(0, limit);
}

/**
 * Format the digest as a readable markdown block suitable for
 * including in a prompt to ask the agent to help fix everything.
 */
export function formatDigestMarkdown(digest: ErrorDigest): string {
  if (digest.totalCount === 0) return "No errors in this session.";
  const lines: string[] = [];
  lines.push(`# Error digest — ${digest.totalCount} issue${digest.totalCount === 1 ? "" : "s"}`);
  lines.push("");
  const sorted: Array<{ source: string; count: number }> = [];
  (Object.keys(digest.bySource) as ErrorSource[]).forEach((source) => {
    const count = digest.bySource[source];
    if (count > 0) sorted.push({ source, count });
  });
  sorted.sort((a, b) => b.count - a.count);
  for (const { source, count } of sorted) {
    lines.push(`- **${source}**: ${count}`);
  }
  lines.push("");
  lines.push("## Entries");
  for (const entry of digest.entries.slice(0, 20)) {
    lines.push(`- [${entry.source}] ${entry.summary}`);
  }
  if (digest.entries.length > 20) {
    lines.push(`- … and ${digest.entries.length - 20} more`);
  }
  return lines.join("\n");
}
