/**
 * Word-level LCS diff — Round A7 enhancement.
 *
 * Pulled from the multi-model-ai-synthesizer pattern (per audit
 * findings). Compares two LLM responses and produces a word-level
 * diff with `equal` / `insert` / `delete` segments. Used by the
 * Consensus UI to highlight where models agree vs disagree.
 *
 * Implementation: classic O(N*M) longest-common-subsequence.
 * For the sizes we care about (~5K words per response) this is
 * sub-millisecond. The audit's recommendation to swap in Myers
 * diff (`diff` npm package) at 500K+ words is noted but not
 * needed at current scale.
 *
 * This module is pure functions only — no DB, no LLM, no UI deps.
 * Unit-testable from the wealth-engine test suite.
 */

export type DiffOp = "equal" | "insert" | "delete";

export interface DiffSegment {
  op: DiffOp;
  /** Words for `equal` and `delete` segments come from `a`; `insert` segments come from `b` */
  text: string;
}

export interface DiffStats {
  /** Total tokens in `a` */
  totalA: number;
  /** Total tokens in `b` */
  totalB: number;
  /** Number of tokens shared between both responses */
  shared: number;
  /** Tokens unique to `a` (deletions) */
  uniqueToA: number;
  /** Tokens unique to `b` (insertions) */
  uniqueToB: number;
  /** Jaccard-style similarity 0..1 */
  similarity: number;
}

export interface WordDiffResult {
  segments: DiffSegment[];
  stats: DiffStats;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────
// Splits on whitespace + keeps punctuation as separate tokens so the
// diff highlights individual punctuation changes ("." → ";") cleanly.

const TOKEN_RX = /\s+|([.,;:!?()[\]{}"'`])/;

export function tokenize(s: string): string[] {
  if (!s) return [];
  // Split on whitespace OR a single punctuation character. Keep the
  // punctuation as its own token via the capturing group.
  const out: string[] = [];
  for (const piece of s.split(TOKEN_RX)) {
    if (piece === undefined) continue;
    if (piece === "" || /^\s+$/.test(piece)) continue;
    out.push(piece);
  }
  return out;
}

// ─── LCS-based diff ──────────────────────────────────────────────────────

/**
 * Compute the longest-common-subsequence DP table for two token arrays.
 * Returns a (n+1)×(m+1) table where lcs[i][j] = length of LCS for
 * a[0..i-1] vs b[0..j-1].
 */
function buildLcsTable(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  const table: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const row = new Array<number>(m + 1).fill(0);
    table.push(row);
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

/**
 * Walk the LCS table backwards to produce a sequence of diff segments.
 * Adjacent same-op segments are merged so consumers see runs.
 */
function backtrack(
  table: number[][],
  a: string[],
  b: string[],
): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  // Helper to push a token, merging with the previous segment if same op
  const push = (op: DiffOp, token: string) => {
    const last = segments[segments.length - 1];
    if (last && last.op === op) {
      last.text += " " + token;
    } else {
      segments.push({ op, text: token });
    }
  };

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      push("equal", a[i - 1]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      push("insert", b[j - 1]);
      j--;
    } else if (i > 0) {
      push("delete", a[i - 1]);
      i--;
    } else {
      break;
    }
  }
  segments.reverse();
  return segments;
}

/**
 * Public API: word-level diff between two strings.
 */
export function wordDiff(a: string, b: string): WordDiffResult {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const table = buildLcsTable(ta, tb);
  const segments = backtrack(table, ta, tb);

  // Stats
  const equalTokens = segments
    .filter((s) => s.op === "equal")
    .reduce((acc, s) => acc + s.text.split(" ").length, 0);
  const insertTokens = segments
    .filter((s) => s.op === "insert")
    .reduce((acc, s) => acc + s.text.split(" ").length, 0);
  const deleteTokens = segments
    .filter((s) => s.op === "delete")
    .reduce((acc, s) => acc + s.text.split(" ").length, 0);
  const totalA = ta.length;
  const totalB = tb.length;
  const union = equalTokens + insertTokens + deleteTokens;
  const similarity = union > 0 ? equalTokens / union : 1;

  return {
    segments,
    stats: {
      totalA,
      totalB,
      shared: equalTokens,
      uniqueToA: deleteTokens,
      uniqueToB: insertTokens,
      similarity,
    },
  };
}

// ─── Multi-response synthesis hint ────────────────────────────────────────
// When the user has 3+ responses, return pairwise similarity matrix so
// the consensus UI can show which pair agrees most.

export interface PairwiseAgreement {
  i: number;
  j: number;
  similarity: number;
}

export function pairwiseSimilarities(responses: string[]): PairwiseAgreement[] {
  const out: PairwiseAgreement[] = [];
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const { stats } = wordDiff(responses[i], responses[j]);
      out.push({ i, j, similarity: stats.similarity });
    }
  }
  return out;
}
