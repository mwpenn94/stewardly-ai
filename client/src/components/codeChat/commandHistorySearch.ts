/**
 * Command history search (Pass 216).
 *
 * Terminal-style reverse-i-search (Ctrl+R) over the Code Chat
 * command history that localStorage already persists for arrow-key
 * navigation. Pure-function fuzzy matcher so the popover stays
 * unit-testable without DOM mocks.
 *
 * Scoring rules:
 *   - exact substring match: score = 100
 *   - substring match earlier in the string ranks higher
 *   - subsequence match (every query char in order): score = 40+
 *   - ties broken by shortest entry first (shorter = more specific)
 *
 * Case-insensitive. Returns entries in original history order when
 * the query is empty.
 */

export interface HistoryMatch {
  entry: string;
  /** Position of each matched character in the entry, for highlighting */
  indices: number[];
  score: number;
}

/**
 * Search a command history array for entries matching `query`.
 * Returns at most `limit` matches sorted by score desc.
 *
 * Entries are deduped by exact-equal text before scoring so the UI
 * never shows the same command twice in a row.
 */
export function searchHistory(
  history: string[],
  query: string,
  limit = 20,
): HistoryMatch[] {
  // Dedup preserving insertion order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const entry of history) {
    if (!seen.has(entry)) {
      seen.add(entry);
      deduped.push(entry);
    }
  }

  if (!query.trim()) {
    return deduped
      .slice(0, limit)
      .map((entry) => ({ entry, indices: [], score: 1 }));
  }

  const q = query.toLowerCase();
  const matches: HistoryMatch[] = [];

  for (const entry of deduped) {
    const lower = entry.toLowerCase();
    // Exact substring
    const substringIdx = lower.indexOf(q);
    if (substringIdx >= 0) {
      const indices: number[] = [];
      for (let i = 0; i < q.length; i++) indices.push(substringIdx + i);
      // Score: base 100, bonus for early position, penalty for length
      const score =
        100 - Math.min(substringIdx, 50) * 0.5 - entry.length * 0.02;
      matches.push({ entry, indices, score });
      continue;
    }
    // Subsequence fallback
    const subsequence = subsequenceMatch(lower, q);
    if (subsequence) {
      const score = 40 + 10 / entry.length;
      matches.push({ entry, indices: subsequence, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Return the character positions in `text` that match every char of
 * `query` in order, or null if not a subsequence.
 */
function subsequenceMatch(text: string, query: string): number[] | null {
  const indices: number[] = [];
  let ti = 0;
  for (let qi = 0; qi < query.length; qi++) {
    const ch = query[qi];
    while (ti < text.length && text[ti] !== ch) ti++;
    if (ti >= text.length) return null;
    indices.push(ti);
    ti++;
  }
  return indices;
}

/**
 * Split an entry into highlight segments for rendering. Returns an
 * array of `{ text, highlight }` runs — a match like `indices=[2,3,4]`
 * on "hello" produces:
 *   [{ text: "he", highlight: false },
 *    { text: "llo", highlight: true }]
 */
export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

export function highlightEntry(
  entry: string,
  indices: number[],
): HighlightSegment[] {
  if (indices.length === 0) return [{ text: entry, highlight: false }];
  const segments: HighlightSegment[] = [];
  const idxSet = new Set(indices);
  let run = "";
  let runHighlight = idxSet.has(0);
  for (let i = 0; i < entry.length; i++) {
    const current = idxSet.has(i);
    if (current === runHighlight) {
      run += entry[i];
    } else {
      if (run) segments.push({ text: run, highlight: runHighlight });
      run = entry[i];
      runHighlight = current;
    }
  }
  if (run) segments.push({ text: run, highlight: runHighlight });
  return segments;
}
