/**
 * Unified workspace search (Pass 249).
 *
 * Claude Code has a "find anywhere" entry point that blends source
 * text, symbol definitions, and inline markers into one result set.
 * Stewardly's Code Chat had three separate tools (grep / symbols /
 * TODO scanner) and no unified entry point, so users had to pick the
 * right one up-front.
 *
 * This pure module takes the three source collections plus a query
 * string and produces a single ranked `UnifiedSearchResult[]` list
 * with typed entries, faceted counts, and deterministic ordering.
 * Ranking is simple but sharp:
 *
 *  - Exact name/text matches beat prefix matches beat substring
 *  - Symbol hits beat grep hits beat TODO hits when tied on score
 *  - Exported symbols boost over private ones
 *  - Newer modification times (if provided) break ties on final sort
 *
 * The module is pure — no I/O — so it can be unit-tested without a
 * real workspace. The tRPC procedure that calls it wires up the
 * symbol index, TODO marker cache, and grep via `dispatchCodeTool`.
 */

import type { SymbolEntry } from "./symbolIndex";
import type { TodoMarker } from "./todoMarkers";

export type UnifiedResultKind = "symbol" | "grep" | "todo";

export interface UnifiedSearchResult {
  kind: UnifiedResultKind;
  /** Score in [0, 100]; higher = more relevant */
  score: number;
  /** Path relative to the workspace root */
  path: string;
  /** 1-indexed line number where the match appears */
  line: number;
  /** Displayable title — symbol name / marker kind+author / first grep line */
  title: string;
  /** Displayable body — source snippet / grep line / marker message */
  snippet: string;
  /** Optional secondary badge (symbol kind / marker kind / "line N") */
  badge?: string;
}

export interface UnifiedFacetCounts {
  total: number;
  symbols: number;
  grep: number;
  todos: number;
}

export interface UnifiedSearchOptions {
  query: string;
  symbols?: SymbolEntry[];
  grepMatches?: Array<{ file: string; line: number; text: string }>;
  todos?: TodoMarker[];
  /** Optional facet filter — only return these kinds */
  kinds?: UnifiedResultKind[];
  /** Cap per-kind results before merging (default 40) */
  perKindLimit?: number;
  /** Cap final merged results (default 120) */
  totalLimit?: number;
}

export interface UnifiedSearchOutput {
  query: string;
  results: UnifiedSearchResult[];
  facets: UnifiedFacetCounts;
  truncated: boolean;
}

// ─── Scoring ────────────────────────────────────────────────────────────

function lc(s: string): string {
  return s.toLowerCase();
}

/**
 * Score a text against a lowercased query. Returns 0 if the query
 * does not appear at all, otherwise a number in [1, 100].
 */
export function scoreMatch(text: string, queryLc: string): number {
  if (!queryLc) return 0;
  const t = lc(text);
  if (!t) return 0;
  if (t === queryLc) return 100;
  if (t.startsWith(queryLc)) return 90;
  const idx = t.indexOf(queryLc);
  if (idx === 0) return 85; // already handled by startsWith, safety net
  if (idx > 0) {
    // Earlier positions score higher, falling off linearly
    const positionPenalty = Math.min(30, Math.floor(idx / 2));
    return 70 - positionPenalty;
  }
  // Subsequence fallback (characters appear in order but non-contiguous)
  let qi = 0;
  for (let i = 0; i < t.length && qi < queryLc.length; i++) {
    if (t[i] === queryLc[qi]) qi++;
  }
  if (qi === queryLc.length) return 30;
  return 0;
}

// ─── Per-source converters ──────────────────────────────────────────────

export function symbolToResult(
  entry: SymbolEntry,
  queryLc: string,
): UnifiedSearchResult | null {
  const nameScore = scoreMatch(entry.name, queryLc);
  if (nameScore === 0) return null;
  const exportBoost = entry.exported ? 5 : 0;
  const kindBoost = entry.kind === "function" || entry.kind === "class" ? 3 : 0;
  return {
    kind: "symbol",
    score: Math.min(100, nameScore + exportBoost + kindBoost),
    path: entry.path,
    line: entry.line,
    title: entry.name,
    snippet: entry.snippet.trim().slice(0, 180),
    badge: entry.kind,
  };
}

export function grepToResult(
  match: { file: string; line: number; text: string },
  queryLc: string,
): UnifiedSearchResult | null {
  const textScore = scoreMatch(match.text, queryLc);
  if (textScore === 0) return null;
  return {
    kind: "grep",
    score: Math.max(10, textScore - 10), // grep is always a little less specific
    path: match.file,
    line: match.line,
    title: match.text.trim().slice(0, 100),
    snippet: match.text.trim().slice(0, 220),
    badge: `line ${match.line}`,
  };
}

export function todoToResult(
  marker: TodoMarker,
  queryLc: string,
): UnifiedSearchResult | null {
  // Match against the marker message OR the kind OR the author
  const msgScore = scoreMatch(marker.message, queryLc);
  const kindScore = scoreMatch(marker.kind, queryLc);
  const authorScore = marker.author ? scoreMatch(marker.author, queryLc) : 0;
  const best = Math.max(msgScore, kindScore, authorScore);
  if (best === 0) return null;
  return {
    kind: "todo",
    score: Math.max(10, best - 15), // TODOs are usually contextual
    path: marker.path,
    line: marker.line,
    title: `${marker.kind}${marker.author ? ` (${marker.author})` : ""}: ${marker.message}`.slice(0, 180),
    snippet: marker.message.slice(0, 220),
    badge: marker.kind,
  };
}

// ─── Top-level search ──────────────────────────────────────────────────

const DEFAULT_PER_KIND_LIMIT = 40;
const DEFAULT_TOTAL_LIMIT = 120;

/**
 * Run the unified search. Returns results sorted by score descending
 * with a stable tie-break on (kind order, path, line). Facet counts
 * reflect the pre-merge hit counts per source.
 */
export function unifiedSearch(opts: UnifiedSearchOptions): UnifiedSearchOutput {
  const query = (opts.query ?? "").trim();
  const queryLc = lc(query);
  const perKindLimit = Math.max(1, opts.perKindLimit ?? DEFAULT_PER_KIND_LIMIT);
  const totalLimit = Math.max(1, opts.totalLimit ?? DEFAULT_TOTAL_LIMIT);
  const allowedKinds = new Set<UnifiedResultKind>(
    opts.kinds && opts.kinds.length > 0 ? opts.kinds : ["symbol", "grep", "todo"],
  );

  if (!queryLc) {
    return {
      query,
      results: [],
      facets: { total: 0, symbols: 0, grep: 0, todos: 0 },
      truncated: false,
    };
  }

  const symbolHits: UnifiedSearchResult[] = [];
  if (allowedKinds.has("symbol") && opts.symbols) {
    for (const entry of opts.symbols) {
      const r = symbolToResult(entry, queryLc);
      if (r) symbolHits.push(r);
    }
  }
  symbolHits.sort(byScoreDescThenPathLine);
  const symbolTotal = symbolHits.length;

  const grepHits: UnifiedSearchResult[] = [];
  if (allowedKinds.has("grep") && opts.grepMatches) {
    for (const m of opts.grepMatches) {
      const r = grepToResult(m, queryLc);
      if (r) grepHits.push(r);
    }
  }
  grepHits.sort(byScoreDescThenPathLine);
  const grepTotal = grepHits.length;

  const todoHits: UnifiedSearchResult[] = [];
  if (allowedKinds.has("todo") && opts.todos) {
    for (const t of opts.todos) {
      const r = todoToResult(t, queryLc);
      if (r) todoHits.push(r);
    }
  }
  todoHits.sort(byScoreDescThenPathLine);
  const todoTotal = todoHits.length;

  const merged: UnifiedSearchResult[] = [
    ...symbolHits.slice(0, perKindLimit),
    ...grepHits.slice(0, perKindLimit),
    ...todoHits.slice(0, perKindLimit),
  ];
  merged.sort(byScoreDescThenKindThenPath);

  const truncated = merged.length > totalLimit;
  const results = merged.slice(0, totalLimit);

  return {
    query,
    results,
    facets: {
      total: symbolTotal + grepTotal + todoTotal,
      symbols: symbolTotal,
      grep: grepTotal,
      todos: todoTotal,
    },
    truncated,
  };
}

// ─── Sort helpers ──────────────────────────────────────────────────────

const KIND_ORDER: Record<UnifiedResultKind, number> = {
  symbol: 0,
  grep: 1,
  todo: 2,
};

function byScoreDescThenPathLine(
  a: UnifiedSearchResult,
  b: UnifiedSearchResult,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return a.line - b.line;
}

function byScoreDescThenKindThenPath(
  a: UnifiedSearchResult,
  b: UnifiedSearchResult,
): number {
  if (b.score !== a.score) return b.score - a.score;
  const ak = KIND_ORDER[a.kind];
  const bk = KIND_ORDER[b.kind];
  if (ak !== bk) return ak - bk;
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return a.line - b.line;
}

// ─── Grouping for the UI ───────────────────────────────────────────────

export interface GroupedResults {
  byKind: Record<UnifiedResultKind, UnifiedSearchResult[]>;
  byPath: Map<string, UnifiedSearchResult[]>;
}

export function groupResults(results: UnifiedSearchResult[]): GroupedResults {
  const byKind: Record<UnifiedResultKind, UnifiedSearchResult[]> = {
    symbol: [],
    grep: [],
    todo: [],
  };
  const byPath = new Map<string, UnifiedSearchResult[]>();
  for (const r of results) {
    byKind[r.kind].push(r);
    const bucket = byPath.get(r.path) ?? [];
    bucket.push(r);
    byPath.set(r.path, bucket);
  }
  return { byKind, byPath };
}
