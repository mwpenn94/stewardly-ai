/**
 * Parser for inline `#symbol` mentions in the Code Chat input.
 *
 * Build-loop Pass 13 (G23). Mirrors `extractFileMentions` from
 * `fileIndex.ts` but for symbol references — typing `#useAuth` in the
 * input opens a popover of matching workspace symbols. Pick one and
 * the parent inlines a citation like:
 *
 *     [useAuth at client/src/hooks/useAuth.ts:42]
 *
 * The chat pipeline can then auto-resolve the citation by reading the
 * file at the cited line for context.
 *
 * `#` was chosen instead of `@` because:
 *   - `@` is already taken by file mentions
 *   - GitHub uses `#` for issue references and most users instinctively
 *     associate `#` with "named thing inside this codebase"
 *   - It avoids any conflict with `@username` syntax in chat clients
 *
 * Pure-function module — no DOM, no React. The popover state lives
 * in CodeChat.tsx and is driven by `extractActiveSymbolMention` on
 * every input change.
 */

export interface SymbolMentionState {
  /** Cursor position when the mention was detected. */
  cursor: number;
  /** Position of the `#` that started the mention. */
  start: number;
  /** Substring after the `#` and before the cursor. */
  query: string;
}

const SYMBOL_CHAR_RE = /[A-Za-z0-9_$]/;

/**
 * Detect if the cursor is currently inside a `#symbol` mention. Returns
 * the parsed state on hit, null otherwise.
 *
 * Rules:
 *   - The `#` must be preceded by a word boundary (start of input,
 *     whitespace, opening bracket, comma, or another `#`).
 *   - The cursor must be IMMEDIATELY after the partial query — no
 *     intervening whitespace.
 *   - The query must consist of `[A-Za-z0-9_$]` characters only.
 *   - An empty query (just `#` typed) is treated as a valid trigger
 *     so the popover can open with a placeholder list.
 */
export function extractActiveSymbolMention(
  input: string,
  cursor: number,
): SymbolMentionState | null {
  if (cursor < 1 || cursor > input.length) return null;
  // Walk backwards from cursor while we're still on symbol-name chars.
  let i = cursor - 1;
  while (i >= 0 && SYMBOL_CHAR_RE.test(input[i])) {
    i--;
  }
  // i now points at the character BEFORE the run (or -1).
  if (i < 0) return null;
  if (input[i] !== "#") return null;
  // Check the boundary before the `#` — must be whitespace or one of
  // the allowed leading punctuation chars to avoid hash-color codes
  // (`#FFFFFF`) or hashtag-like text (`foo#bar`).
  const before = i === 0 ? " " : input[i - 1];
  if (!/\s|^[\[(,;:#`'"\u201c\u201d]$/.test(before)) {
    // Reject mid-word `#` (`foo#bar`)
    return null;
  }
  return {
    cursor,
    start: i,
    query: input.slice(i + 1, cursor),
  };
}

/**
 * Replace the active mention with a finalized citation. Returns the
 * new input string + the cursor position to set after the replacement.
 */
export function replaceMentionWithCitation(
  input: string,
  mention: SymbolMentionState,
  hit: { name: string; path: string; line: number },
): { next: string; cursor: number } {
  const citation = `[${hit.name} at ${hit.path}:${hit.line}]`;
  // Replace from the `#` (mention.start) through the cursor.
  const before = input.slice(0, mention.start);
  const after = input.slice(mention.cursor);
  // Add a trailing space if there isn't one already so the user can
  // keep typing without manually inserting one.
  const sep = after.startsWith(" ") || after === "" ? "" : " ";
  const next = `${before}${citation}${sep}${after}`;
  return {
    next,
    cursor: before.length + citation.length + sep.length,
  };
}

/**
 * Pull every `[Name at path:line]` citation out of a final user
 * message so the server can resolve them into context. Symmetric
 * with `extractFileMentions` from the server-side `fileIndex.ts`.
 *
 * Returns the citations in the order they appear, deduped.
 */
export function extractSymbolCitations(
  input: string,
): Array<{ name: string; path: string; line: number }> {
  const re = /\[([A-Za-z_$][A-Za-z0-9_$]*) at ([^:\]]+):(\d+)\]/g;
  const seen = new Set<string>();
  const out: Array<{ name: string; path: string; line: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const name = m[1];
    const path = m[2];
    const line = parseInt(m[3], 10);
    if (!Number.isFinite(line)) continue;
    const key = `${name}|${path}|${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, path, line });
    if (out.length >= 10) break;
  }
  return out;
}
