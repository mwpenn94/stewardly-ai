/**
 * Test runner output parser (Pass 255).
 *
 * Claude Code lets users run `vitest` from the UI and see a structured
 * results panel instead of raw CLI output. Stewardly's Code Chat had
 * no integrated test runner — users had to drop to a terminal.
 *
 * This module is the pure parser side. It takes the raw stdout from
 * `vitest run` (default reporter) and converts it to structured
 * `TestFileResult[]` + `TestSummary` objects.
 *
 * Default vitest reporter output looks roughly like:
 *
 *   ✓ client/src/foo.test.ts (12 tests) 8ms
 *   ❯ client/src/bar.test.ts (5 tests | 1 failed) 17ms
 *     × describe > it should do the thing 2ms
 *       → expected 1 to be 2
 *
 *   Test Files  1 failed | 2 passed (3)
 *        Tests  1 failed | 20 passed (21)
 *
 * We parse the file summary rows (anything starting with a status
 * marker followed by a path ending in .test.ts / .test.tsx) plus the
 * per-test failure lines beneath a failed file, and the final
 * aggregate summary. The module is pure — no I/O, no regex
 * dependencies on the parent filesystem.
 */

export type TestStatus = "passed" | "failed" | "skipped" | "todo";

export interface TestCaseResult {
  name: string;
  status: TestStatus;
  durationMs?: number;
  /** Error message for failed tests */
  error?: string;
}

export interface TestFileResult {
  path: string;
  status: TestStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
  failures: TestCaseResult[];
}

export interface TestSummary {
  files: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  durationMs?: number;
  exitCode?: number;
  /** Full stderr preserved for the UI's "raw output" toggle */
  rawTail?: string;
}

// ─── Per-file status parsing ──────────────────────────────────────────

// Matches: "✓ path/to/file.test.ts (12 tests) 8ms"
// Or    : "❯ path/to/file.test.ts (5 tests | 1 failed) 17ms"
// Or    : "✗ path/to/file.test.ts (3 tests | 3 failed) 12ms"
const FILE_LINE_REGEX =
  /^\s*([✓❯✗×⎯↓→])\s+(\S+\.(?:test|spec)\.[tj]sx?)\s*(?:\(([^)]+)\))?\s*(?:(\d+(?:\.\d+)?)\s*(ms|s))?/;

// Matches the per-test failure line: "× describe > it should work 2ms"
// or                                 "✗ describe > it should work"
const FAILURE_LINE_REGEX = /^\s{2,}([×✗])\s+(.+?)(?:\s+(\d+(?:\.\d+)?)(ms|s))?\s*$/;

// Matches the "→ expected X to be Y" follow-up line
const FAILURE_DETAIL_REGEX = /^\s{3,}→\s+(.+)$/;

// Aggregate rows:
//   "Test Files  1 failed | 2 passed (3)"
//   "     Tests  1 failed | 20 passed (21)"
const AGGREGATE_REGEX =
  /^\s*(Test Files|\s*Tests)\s+(?:(\d+)\s+failed\s*\|\s*)?(?:(\d+)\s+passed\s*)?(?:\|\s*(\d+)\s+skipped)?\s*\((\d+)\)/;

// Duration row: "Duration  4.07s (transform 1.22s, ...)"
const DURATION_REGEX = /Duration\s+([\d.]+)(ms|s)/;

/** Parse stdout from `vitest run` into structured file + summary results */
export function parseVitestOutput(raw: string): {
  files: TestFileResult[];
  summary: TestSummary;
} {
  const files: TestFileResult[] = [];
  const lines = raw.split(/\r?\n/);

  const summary: TestSummary = {
    files: { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
  };

  let currentFile: TestFileResult | null = null;
  let currentFailure: TestCaseResult | null = null;

  for (const raw of lines) {
    // Strip ANSI escapes if any slipped through
    const line = raw.replace(/\x1b\[[0-9;]*m/g, "");

    // File status line
    const fileMatch = FILE_LINE_REGEX.exec(line);
    if (fileMatch) {
      const [, marker, path, counts, durStr, unit] = fileMatch;
      const status: TestStatus =
        marker === "✓" ? "passed" : marker === "↓" ? "skipped" : "failed";
      const { totalTests, failed, skipped } = parseCounts(counts ?? "");
      const passed = Math.max(0, totalTests - failed - skipped);
      const durationMs = parseDuration(durStr, unit);
      currentFile = {
        path: path!,
        status,
        totalTests,
        passed,
        failed,
        skipped,
        durationMs,
        failures: [],
      };
      files.push(currentFile);
      currentFailure = null;
      continue;
    }

    // Per-test failure line (appears after a failed file)
    const failMatch = FAILURE_LINE_REGEX.exec(line);
    if (failMatch && currentFile && currentFile.status === "failed") {
      const [, , name, durStr, unit] = failMatch;
      currentFailure = {
        name: name!.trim(),
        status: "failed",
        durationMs: parseDuration(durStr, unit),
      };
      currentFile.failures.push(currentFailure);
      continue;
    }

    // Failure detail line
    const detailMatch = FAILURE_DETAIL_REGEX.exec(line);
    if (detailMatch && currentFailure) {
      const existing = currentFailure.error ?? "";
      const extra = detailMatch[1]!.trim();
      currentFailure.error = existing ? `${existing} ${extra}` : extra;
      continue;
    }

    // Aggregate rows
    const aggMatch = AGGREGATE_REGEX.exec(line);
    if (aggMatch) {
      const [, kind, failedStr, passedStr, skippedStr, totalStr] = aggMatch;
      const failed = Number.parseInt(failedStr ?? "0", 10) || 0;
      const passed = Number.parseInt(passedStr ?? "0", 10) || 0;
      const skipped = Number.parseInt(skippedStr ?? "0", 10) || 0;
      const total = Number.parseInt(totalStr!, 10) || 0;
      if (/Test Files/i.test(kind!)) {
        summary.files = { total, passed, failed, skipped };
      } else if (/Tests/i.test(kind!)) {
        summary.tests = { total, passed, failed, skipped };
      }
      continue;
    }

    // Duration row
    const dur = DURATION_REGEX.exec(line);
    if (dur) {
      summary.durationMs = parseDuration(dur[1], dur[2]);
      continue;
    }
  }

  // If the file-status headers didn't contain an aggregate summary
  // (some CI reporters skip it), synthesize it from the parsed files
  if (summary.files.total === 0 && files.length > 0) {
    summary.files = summarizeFiles(files);
    summary.tests = summarizeTests(files);
  }

  return { files, summary };
}

function parseCounts(raw: string): {
  totalTests: number;
  failed: number;
  skipped: number;
} {
  // Accepts: "12 tests" or "5 tests | 1 failed" or "3 tests | 2 failed | 1 skipped"
  const parts = raw.split("|").map((p) => p.trim());
  let totalTests = 0;
  let failed = 0;
  let skipped = 0;
  for (const part of parts) {
    const numMatch = /(\d+)/.exec(part);
    if (!numMatch) continue;
    const n = Number.parseInt(numMatch[1]!, 10);
    if (part.includes("failed")) failed = n;
    else if (part.includes("skipped")) skipped = n;
    else if (part.includes("test")) totalTests = n;
  }
  return { totalTests, failed, skipped };
}

function parseDuration(raw?: string, unit?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  if (unit === "s") return Math.round(n * 1000);
  return Math.round(n);
}

function summarizeFiles(files: TestFileResult[]): TestSummary["files"] {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const f of files) {
    if (f.status === "passed") passed++;
    else if (f.status === "failed") failed++;
    else if (f.status === "skipped") skipped++;
  }
  return { total: files.length, passed, failed, skipped };
}

function summarizeTests(files: TestFileResult[]): TestSummary["tests"] {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;
  for (const f of files) {
    total += f.totalTests;
    passed += f.passed;
    failed += f.failed;
    skipped += f.skipped;
  }
  return { total, passed, failed, skipped };
}

// ─── Filtering + sorting ──────────────────────────────────────────────

export interface TestFilter {
  status?: TestStatus[];
  search?: string;
}

export function filterFileResults(
  files: TestFileResult[],
  filter: TestFilter,
): TestFileResult[] {
  return files.filter((f) => {
    if (filter.status && filter.status.length > 0 && !filter.status.includes(f.status)) {
      return false;
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (
        !f.path.toLowerCase().includes(s) &&
        !f.failures.some((fl) => fl.name.toLowerCase().includes(s))
      ) {
        return false;
      }
    }
    return true;
  });
}

/** Sort files: failures first, then by path */
export function sortFileResults(files: TestFileResult[]): TestFileResult[] {
  return [...files].sort((a, b) => {
    const aw = a.status === "failed" ? 0 : a.status === "skipped" ? 2 : 1;
    const bw = b.status === "failed" ? 0 : b.status === "skipped" ? 2 : 1;
    if (aw !== bw) return aw - bw;
    return a.path.localeCompare(b.path);
  });
}
