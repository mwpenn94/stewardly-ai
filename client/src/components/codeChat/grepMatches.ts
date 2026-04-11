/**
 * Grep tool result parser (Pass 225).
 *
 * The Code Chat `grep_search` tool returns a JSON payload shaped as:
 *   { kind: "grep", result: { matches: [{file, line, text}, ...], truncated } }
 *
 * This module parses that payload safely out of the SSE
 * `tool_result` preview string and exposes clickable match rows to
 * the TraceView so users can jump from a grep hit to the
 * corresponding file/line in the FileBrowser viewer.
 *
 * Pure function + no DOM so the parser is unit-testable.
 */

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface GrepResult {
  matches: GrepMatch[];
  truncated: boolean;
}

/**
 * Extract grep matches from a serialized tool_result preview. Returns
 * null when the tool kind isn't grep or the payload shape doesn't
 * match. Never throws — parse errors fall through to null.
 */
export function extractGrepMatches(
  toolName: string | undefined,
  rawPreview: string | undefined,
): GrepResult | null {
  if (!rawPreview) return null;
  if (toolName !== "grep_search") return null;
  try {
    const parsed = JSON.parse(rawPreview);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind !== "grep") return null;
    const inner = parsed.result;
    if (!inner || !Array.isArray(inner.matches)) return null;
    const matches: GrepMatch[] = [];
    for (const m of inner.matches) {
      if (!m || typeof m !== "object") continue;
      if (typeof m.file !== "string") continue;
      if (typeof m.line !== "number") continue;
      if (typeof m.text !== "string") continue;
      matches.push({ file: m.file, line: m.line, text: m.text });
    }
    return {
      matches,
      truncated: Boolean(inner.truncated),
    };
  } catch {
    return null;
  }
}

/**
 * Group matches by file so the UI can render a compact
 * file-with-hit-count header followed by the per-line rows.
 */
export interface GrepFileGroup {
  file: string;
  matches: GrepMatch[];
}

export function groupMatchesByFile(matches: GrepMatch[]): GrepFileGroup[] {
  const byFile = new Map<string, GrepMatch[]>();
  for (const m of matches) {
    const existing = byFile.get(m.file);
    if (existing) existing.push(m);
    else byFile.set(m.file, [m]);
  }
  const out: GrepFileGroup[] = Array.from(byFile.entries()).map(
    ([file, fileMatches]) => ({
      file,
      matches: [...fileMatches].sort((a, b) => a.line - b.line),
    }),
  );
  out.sort((a, b) => a.file.localeCompare(b.file));
  return out;
}
