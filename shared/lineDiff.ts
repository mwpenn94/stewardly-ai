/**
 * Line-level diff — Pass 202.
 *
 * Classic O(N*M) longest-common-subsequence diff on line arrays.
 * Returns a sequence of hunks (add/delete/equal) with line numbers
 * from both sides, suitable for rendering a GitHub-style unified
 * diff in the Code Chat inline editor and the tool-result viewer.
 *
 * Pure functions — no DOM, no DB, no LLM. Safe to import from both
 * server (wordDiff is on the synthesizer side) and client components.
 *
 * Why a line diff when we already have wordDiff? Word-level diffs
 * work great for prose comparison (consensus synthesizer) but make
 * code changes unreadable: a single renamed variable lights up the
 * entire surrounding paragraph. For code, line-level is the right
 * granularity and matches `git diff` / GitHub PR view exactly.
 */

export type LineDiffOp = "equal" | "add" | "delete";

export interface LineDiffEntry {
  op: LineDiffOp;
  /** Original line number (1-indexed) for `equal` + `delete`; null for `add` */
  oldLine: number | null;
  /** New line number (1-indexed) for `equal` + `add`; null for `delete` */
  newLine: number | null;
  text: string;
}

export interface LineDiffHunk {
  /** Starting line in `a` (1-indexed) */
  oldStart: number;
  /** Line count in `a` this hunk represents */
  oldCount: number;
  /** Starting line in `b` (1-indexed) */
  newStart: number;
  /** Line count in `b` this hunk represents */
  newCount: number;
  entries: LineDiffEntry[];
}

export interface LineDiffStats {
  totalOld: number;
  totalNew: number;
  added: number;
  deleted: number;
  unchanged: number;
  /** Jaccard-ish similarity based on shared lines 0..1 */
  similarity: number;
}

export interface LineDiffResult {
  entries: LineDiffEntry[];
  hunks: LineDiffHunk[];
  stats: LineDiffStats;
}

// ─── Core diff ────────────────────────────────────────────────────────────

function splitLines(s: string): string[] {
  if (s === "") return [];
  // Normalize CRLF to LF before split so Windows files compare identically.
  const normalized = s.replace(/\r\n/g, "\n");
  return normalized.split("\n");
}

/**
 * Compute the longest-common-subsequence DP table. Returns a
 * (n+1)×(m+1) matrix where lcs[i][j] = length of LCS of a[0..i)
 * and b[0..j).
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }
  return lcs;
}

/**
 * Backtrack the LCS table into a flat entry list.
 *
 * The traversal is standard: prefer `equal` moves when both sides
 * match, otherwise step whichever side contributes the higher LCS
 * count. Ties break toward `delete` (same as `git diff`) to make the
 * output deterministic.
 */
function backtrack(
  a: string[],
  b: string[],
  lcs: number[][],
): LineDiffEntry[] {
  const entries: LineDiffEntry[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      entries.push({
        op: "equal",
        oldLine: i,
        newLine: j,
        text: a[i - 1],
      });
      i--;
      j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      entries.push({
        op: "delete",
        oldLine: i,
        newLine: null,
        text: a[i - 1],
      });
      i--;
    } else {
      entries.push({
        op: "add",
        oldLine: null,
        newLine: j,
        text: b[j - 1],
      });
      j--;
    }
  }
  while (i > 0) {
    entries.push({ op: "delete", oldLine: i, newLine: null, text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    entries.push({ op: "add", oldLine: null, newLine: j, text: b[j - 1] });
    j--;
  }
  return entries.reverse();
}

// ─── Hunk grouping ────────────────────────────────────────────────────────

/**
 * Group entries into hunks with N lines of surrounding context.
 *
 * A hunk starts at the first changed line (add/delete), extends
 * `contextLines` before and after, and ends when we've seen
 * `2 * contextLines + 1` consecutive unchanged lines (standard
 * `git diff -U` behavior).
 */
export function groupHunks(
  entries: LineDiffEntry[],
  contextLines = 3,
): LineDiffHunk[] {
  const hunks: LineDiffHunk[] = [];
  let inHunk = false;
  let buffer: LineDiffEntry[] = [];
  let equalRunAfter = 0;

  const flushHunk = () => {
    if (buffer.length === 0) return;
    // Drop trailing equal lines beyond contextLines
    while (
      buffer.length > 0 &&
      buffer[buffer.length - 1].op === "equal" &&
      equalRunAfter > contextLines
    ) {
      buffer.pop();
      equalRunAfter--;
    }
    if (buffer.length === 0) return;

    // Compute hunk header numbers
    let oldStart = 0;
    let newStart = 0;
    for (const e of buffer) {
      if (oldStart === 0 && e.oldLine !== null) oldStart = e.oldLine;
      if (newStart === 0 && e.newLine !== null) newStart = e.newLine;
      if (oldStart !== 0 && newStart !== 0) break;
    }
    const oldCount = buffer.filter((e) => e.op !== "add").length;
    const newCount = buffer.filter((e) => e.op !== "delete").length;
    hunks.push({
      oldStart: oldStart || 1,
      oldCount,
      newStart: newStart || 1,
      newCount,
      entries: [...buffer],
    });
    buffer = [];
    equalRunAfter = 0;
    inHunk = false;
  };

  const leadingContext: LineDiffEntry[] = [];
  for (const entry of entries) {
    if (entry.op === "equal") {
      if (inHunk) {
        buffer.push(entry);
        equalRunAfter++;
        // If we've seen 2*context equal lines in a row, the hunk is
        // complete: everything beyond `contextLines` is the lead-in
        // for the next hunk.
        if (equalRunAfter >= contextLines * 2 + 1) {
          flushHunk();
        }
      } else {
        leadingContext.push(entry);
        if (leadingContext.length > contextLines) leadingContext.shift();
      }
    } else {
      // A change — start (or continue) a hunk
      if (!inHunk) {
        buffer = [...leadingContext];
        leadingContext.length = 0;
        inHunk = true;
      }
      buffer.push(entry);
      equalRunAfter = 0;
    }
  }
  if (inHunk) flushHunk();

  return hunks;
}

// ─── Public API ───────────────────────────────────────────────────────────

export function lineDiff(
  a: string,
  b: string,
  opts: { contextLines?: number } = {},
): LineDiffResult {
  const contextLines = opts.contextLines ?? 3;
  const aLines = splitLines(a);
  const bLines = splitLines(b);

  const lcs = lcsTable(aLines, bLines);
  const entries = backtrack(aLines, bLines, lcs);
  const hunks = groupHunks(entries, contextLines);

  let added = 0;
  let deleted = 0;
  let unchanged = 0;
  for (const e of entries) {
    if (e.op === "add") added++;
    else if (e.op === "delete") deleted++;
    else unchanged++;
  }
  const union = aLines.length + bLines.length - unchanged;
  const similarity = union === 0 ? 1 : unchanged / union;

  return {
    entries,
    hunks,
    stats: {
      totalOld: aLines.length,
      totalNew: bLines.length,
      added,
      deleted,
      unchanged,
      similarity,
    },
  };
}

/**
 * Format a diff result as a unified-diff string (the same shape
 * `git diff -U<context>` produces). Useful for CLI output, PR
 * descriptions, or pasting into a terminal.
 */
export function formatUnifiedDiff(
  result: LineDiffResult,
  opts: { pathA?: string; pathB?: string } = {},
): string {
  const lines: string[] = [];
  if (opts.pathA || opts.pathB) {
    lines.push(`--- ${opts.pathA ?? "a"}`);
    lines.push(`+++ ${opts.pathB ?? "b"}`);
  }
  for (const hunk of result.hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    );
    for (const entry of hunk.entries) {
      const prefix =
        entry.op === "add" ? "+" : entry.op === "delete" ? "-" : " ";
      lines.push(`${prefix}${entry.text}`);
    }
  }
  return lines.join("\n");
}
