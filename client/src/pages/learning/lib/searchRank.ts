/**
 * EMBA Learning — pure client-side search result ranker + highlighter.
 *
 * Before this pass, `learning.content.search` returned a flat array
 * of `{type, id, title, snippet}` rows in the order the server
 * happened to query them (definitions first, then flashcards, then
 * tracks). No relevance ranking. A user searching "Sharpe" would
 * see 19 definitions with that word in their body before the one
 * definition whose term IS "Sharpe ratio" — dead-last useful.
 *
 * This module fixes the UX without touching the server:
 *
 *   - `scoreResult(result, query)` is a 5-tier pure scorer: exact
 *     title match → prefix → token prefix → substring → snippet
 *     substring. Score is 0 for non-matches so caller can filter.
 *
 *   - `rankSearchResults(results, query)` sorts by score desc with
 *     a stable type+id tiebreak.
 *
 *   - `groupByType(results)` buckets ranked results into the four
 *     content types for display.
 *
 *   - `highlightMatches(text, query)` splits text into `{text,
 *     matched}` segments so the UI can wrap matches in `<mark>`
 *     without manipulating innerHTML.
 *
 * All pure, all deterministic, all O(n·m) at worst for normal
 * query lengths.
 */

export type ContentType = "definition" | "flashcard" | "track" | "question" | "formula" | "case";

export interface SearchResult {
  type: ContentType;
  id: number;
  title: string;
  snippet: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────

/** Numeric tiers for interpretability. */
const SCORE_EXACT_TITLE = 1000;
const SCORE_TITLE_PREFIX = 500;
const SCORE_TITLE_WORD_PREFIX = 250;
const SCORE_TITLE_SUBSTRING = 100;
const SCORE_SNIPPET_SUBSTRING = 20;

/** Type-level nudge so definitions rank ahead of flashcards at ties. */
const TYPE_BIAS: Record<ContentType, number> = {
  definition: 4,
  track: 3,
  flashcard: 2,
  question: 1,
  formula: 2,
  case: 1,
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Pure. Score a single result against a query. Returns 0 if the
 * query doesn't match anywhere (callers can filter).
 *
 * Tiers (highest wins):
 *   1. Title is exactly the query.
 *   2. Title starts with the query.
 *   3. Title has a word that starts with the query
 *      (multi-word titles: "Sharpe ratio" matches "sharpe").
 *   4. Title contains the query as a substring.
 *   5. Snippet contains the query.
 *
 * A small `typeBias` is added so that when scores tie, a
 * definition ranks ahead of a flashcard.
 */
export function scoreResult(result: SearchResult, query: string): number {
  const q = normalize(query);
  if (q.length === 0) return 0;
  const title = normalize(result.title ?? "");
  const snippet = normalize(result.snippet ?? "");

  const bias = TYPE_BIAS[result.type] ?? 0;

  if (title === q) return SCORE_EXACT_TITLE + bias;
  if (title.startsWith(q)) return SCORE_TITLE_PREFIX + bias;

  // Word-prefix — any space-delimited word starts with the query
  if (title.length > 0) {
    const words = title.split(/\s+/);
    for (const w of words) {
      if (w.startsWith(q)) {
        return SCORE_TITLE_WORD_PREFIX + bias;
      }
    }
  }
  if (title.includes(q)) return SCORE_TITLE_SUBSTRING + bias;
  if (snippet.includes(q)) return SCORE_SNIPPET_SUBSTRING + bias;
  return 0;
}

/**
 * Pure. Sort results by relevance, dropping non-matches.
 * Deterministic — same input → same output.
 */
export function rankSearchResults(
  results: readonly SearchResult[],
  query: string,
): SearchResult[] {
  if (!query || !query.trim()) return results.slice();
  const scored = results
    .map((r) => ({ r, s: scoreResult(r, query) }))
    .filter((e) => e.s > 0);
  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    // Stable tie-break: type alpha then id.
    if (a.r.type !== b.r.type) return a.r.type < b.r.type ? -1 : 1;
    return a.r.id - b.r.id;
  });
  return scored.map((e) => e.r);
}

// ─── Grouping ────────────────────────────────────────────────────────────

export interface GroupedResults {
  definitions: SearchResult[];
  flashcards: SearchResult[];
  tracks: SearchResult[];
  questions: SearchResult[];
  other: SearchResult[];
}

/**
 * Pure. Bucket a (ranked) result list into the four UI sections.
 * Preserves within-bucket ordering so the caller's rank is
 * respected.
 */
export function groupByType(results: readonly SearchResult[]): GroupedResults {
  const out: GroupedResults = {
    definitions: [],
    flashcards: [],
    tracks: [],
    questions: [],
    other: [],
  };
  for (const r of results) {
    switch (r.type) {
      case "definition":
        out.definitions.push(r);
        break;
      case "flashcard":
        out.flashcards.push(r);
        break;
      case "track":
        out.tracks.push(r);
        break;
      case "question":
        out.questions.push(r);
        break;
      default:
        out.other.push(r);
    }
  }
  return out;
}

// ─── Highlighting ────────────────────────────────────────────────────────

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Pure. Split a string into alternating `{text, matched}` segments
 * so the UI can render matches inside `<mark>` without touching
 * innerHTML. Case-insensitive.
 *
 * Returns `[{text, matched:false}]` when no matches exist; returns
 * a single segment when `query` is empty.
 */
export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, matched: false }];
  const q = normalize(query);
  if (q.length === 0) return [{ text, matched: false }];

  const result: HighlightSegment[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(q, cursor);
    if (idx === -1) {
      // No more matches — push the rest unmarked and break.
      result.push({ text: text.slice(cursor), matched: false });
      break;
    }
    if (idx > cursor) {
      result.push({ text: text.slice(cursor, idx), matched: false });
    }
    result.push({ text: text.slice(idx, idx + q.length), matched: true });
    cursor = idx + q.length;
    // Safety: if query is empty (shouldn't happen — guarded above)
    // advance to avoid infinite loops.
    if (q.length === 0) break;
  }
  // Prune leading empty segment.
  return result.filter((s) => s.text.length > 0);
}

/** Pure. Short summary for a header badge. */
export function countsByType(grouped: GroupedResults): {
  definitions: number;
  flashcards: number;
  tracks: number;
  questions: number;
  total: number;
} {
  return {
    definitions: grouped.definitions.length,
    flashcards: grouped.flashcards.length,
    tracks: grouped.tracks.length,
    questions: grouped.questions.length,
    total:
      grouped.definitions.length +
      grouped.flashcards.length +
      grouped.tracks.length +
      grouped.questions.length +
      grouped.other.length,
  };
}
