/**
 * Server-side symbol citation extractor for the Code Chat input.
 *
 * Build-loop Pass 14 — closes the loop on G23. Pass 13 built the
 * client-side `#symbol` autocomplete that rewrites the input as
 * `[Name at path:line]` citations. This module mirrors that on the
 * server: extract every citation from the user's message, read a
 * context window around each cited line, and inline the slice as
 * additional context the LLM sees alongside the prompt.
 *
 * Symmetric with `extractFileMentions` from `fileIndex.ts` (the
 * `@file` mention resolver). Caps at 10 citations per message,
 * 200 lines of context per citation, defensive against malformed
 * line numbers.
 *
 * Pure-function module — the actual file read happens in the route
 * layer via the existing sandboxed `readFile`.
 */

export interface SymbolCitation {
  name: string;
  path: string;
  line: number;
}

export interface ResolvedSymbolCitation extends SymbolCitation {
  /** True if the file/line could be read successfully. */
  resolved: boolean;
  /** The lines around the cited line, joined with newlines. */
  context?: string;
  /** First line number of the context window (1-indexed). */
  startLine?: number;
  error?: string;
}

const CITATION_RE =
  /\[([A-Za-z_$][A-Za-z0-9_$]*) at ([^:\]]+):(\d+)\]/g;

const MAX_CITATIONS = 10;

/**
 * Pull every `[Name at path:line]` reference out of a message,
 * deduped + capped at 10.
 *
 * Identical semantics to the client-side `extractSymbolCitations`
 * helper in `client/src/components/codeChat/symbolMentions.ts` so
 * the two stay in sync.
 */
export function extractSymbolCitations(message: string): SymbolCitation[] {
  if (!message) return [];
  const seen = new Set<string>();
  const out: SymbolCitation[] = [];
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(message)) !== null) {
    const name = m[1];
    const path = m[2];
    const line = parseInt(m[3], 10);
    if (!Number.isFinite(line) || line < 1) continue;
    const key = `${name}|${path}|${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, path, line });
    if (out.length >= MAX_CITATIONS) break;
  }
  return out;
}

/**
 * Extract a context window of `before`/`after` lines around the
 * cited line. Returns the joined slice + the 1-indexed start line
 * so the prompt can show the correct line numbers.
 *
 * `lines` is the file content split into lines (caller passes the
 * already-split array to avoid re-splitting per citation).
 */
export function buildCitationContext(
  lines: string[],
  citation: SymbolCitation,
  before = 5,
  after = 25,
): { context: string; startLine: number } | null {
  if (lines.length === 0) return null;
  const targetIdx = citation.line - 1; // 0-indexed
  const startIdx = Math.max(0, targetIdx - before);
  const endIdx = Math.min(lines.length, targetIdx + after + 1);
  const slice = lines.slice(startIdx, endIdx);
  if (slice.length === 0) return null;
  return {
    context: slice.join("\n"),
    startLine: startIdx + 1,
  };
}

/**
 * Format a resolved citation as a prompt overlay block. The LLM
 * sees this appended to the user message in the same shape as
 * `extractFileMentions` overlays.
 */
export function formatCitationOverlay(
  resolved: ResolvedSymbolCitation,
): string {
  if (!resolved.resolved || !resolved.context) {
    return `\n\n--- Cited symbol: ${resolved.name} at ${resolved.path}:${resolved.line} (error: ${resolved.error ?? "unresolved"}) ---`;
  }
  return (
    `\n\n--- Cited symbol: ${resolved.name} at ${resolved.path}:${resolved.line} ` +
    `(showing lines ${resolved.startLine}-${(resolved.startLine ?? 0) + resolved.context.split("\n").length - 1}) ---\n` +
    resolved.context
  );
}
