/**
 * Vitest runner — Pass 258.
 *
 * Spawns `npx vitest run` with optional --reporter=json so the
 * client can render per-test pass/fail status, and parses the JSON
 * output into a structured result.
 *
 * Unlike the diagnostics runner (Pass 251) we don't cache — tests
 * are assumed to change often, and the UI is a button-click-to-run
 * flow anyway. A 5-minute hard cap covers full suite runs; a 15-
 * second cap covers single-file runs.
 *
 * The parser is pure and exported separately so it can be tested
 * without spinning up a child process.
 */

import { spawn } from "node:child_process";
import path from "node:path";

export type TestStatus = "passed" | "failed" | "skipped" | "todo" | "pending";

export interface TestAssertion {
  title: string;
  fullName: string;
  status: TestStatus;
  duration: number | null;
  /** Failure message (first line of error) */
  failureMessage?: string;
}

export interface TestFileResult {
  path: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  assertions: TestAssertion[];
  numPassed: number;
  numFailed: number;
  numSkipped: number;
  /** Raw stderr captured from tsc/vitest during this file */
  errorMessage?: string;
}

export interface TestRunResult {
  ok: boolean;
  startedAt: number;
  durationMs: number;
  /** Per-file results */
  files: TestFileResult[];
  /** Aggregate counts */
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalFiles: number;
  /** Set when vitest itself crashed (binary missing, config error, etc.) */
  fatalError?: string;
  /** Raw first 20KB of stdout for debugging */
  rawStdout?: string;
}

/**
 * Parse vitest's `--reporter=json` output into structured results.
 * Pure function; exposed for tests.
 *
 * The JSON reporter emits one top-level object with:
 *   - numTotalTestSuites / numTotalTests / numPassedTests / numFailedTests
 *   - testResults: Array of { name, status, assertionResults, ... }
 *
 * This parser is tolerant of shape drift between vitest versions —
 * any missing field falls back to a sensible default.
 */
export function parseVitestJson(raw: string): Partial<TestRunResult> {
  if (!raw) return { files: [], totalPassed: 0, totalFailed: 0, totalSkipped: 0 };
  // The JSON reporter can emit log lines before the JSON object. Find
  // the first `{` that starts a valid parseable blob.
  const trimmed = raw.trim();
  let json: any = null;
  try {
    json = JSON.parse(trimmed);
  } catch {
    // Fall back: scan for the last `{` that opens a valid json block
    const lastOpen = trimmed.lastIndexOf("\n{");
    if (lastOpen >= 0) {
      try {
        json = JSON.parse(trimmed.slice(lastOpen + 1));
      } catch {
        /* fall through */
      }
    }
  }
  if (!json || typeof json !== "object") {
    return {
      files: [],
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      fatalError: "could not parse vitest JSON output",
    };
  }

  const testResults = Array.isArray(json.testResults) ? json.testResults : [];
  const files: TestFileResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const tr of testResults) {
    if (!tr || typeof tr !== "object") continue;
    const assertionResults = Array.isArray(tr.assertionResults)
      ? tr.assertionResults
      : [];
    const assertions: TestAssertion[] = [];
    let numPassed = 0;
    let numFailed = 0;
    let numSkipped = 0;
    for (const a of assertionResults) {
      if (!a || typeof a !== "object") continue;
      const status = normalizeStatus(a.status);
      const failure =
        Array.isArray(a.failureMessages) && a.failureMessages.length > 0
          ? String(a.failureMessages[0]).split("\n")[0]
          : undefined;
      assertions.push({
        title: typeof a.title === "string" ? a.title : "",
        fullName: typeof a.fullName === "string" ? a.fullName : "",
        status,
        duration: typeof a.duration === "number" ? a.duration : null,
        failureMessage: failure,
      });
      if (status === "passed") numPassed++;
      else if (status === "failed") numFailed++;
      else if (status === "skipped" || status === "todo" || status === "pending") {
        numSkipped++;
      }
    }
    const fileStatus: TestFileResult["status"] =
      numFailed > 0 ? "failed" : numSkipped === assertions.length ? "skipped" : "passed";
    files.push({
      path: typeof tr.name === "string" ? tr.name : "",
      status: fileStatus,
      durationMs:
        typeof tr.perfStats?.runtime === "number"
          ? tr.perfStats.runtime
          : typeof tr.duration === "number"
            ? tr.duration
            : 0,
      assertions,
      numPassed,
      numFailed,
      numSkipped,
      errorMessage: typeof tr.message === "string" ? tr.message : undefined,
    });
    totalPassed += numPassed;
    totalFailed += numFailed;
    totalSkipped += numSkipped;
  }

  return {
    files,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalFiles: files.length,
  };
}

function normalizeStatus(raw: unknown): TestStatus {
  if (raw === "passed" || raw === "failed" || raw === "skipped") return raw;
  if (raw === "pending") return "pending";
  if (raw === "todo") return "todo";
  return "failed"; // unknown → treat as failed
}

/**
 * Run vitest against the workspace with the given target pattern.
 * An empty string pattern runs the full suite.
 */
export async function runVitest(
  workspaceRoot: string,
  target: string = "",
  opts: { timeoutMs?: number } = {},
): Promise<TestRunResult> {
  const timeout = opts.timeoutMs ?? (target ? 60_000 : 5 * 60_000);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const args = ["vitest", "run", "--reporter=json"];
    if (target) args.push(target);
    const child = spawn("npx", args, {
      cwd: workspaceRoot,
      shell: false,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeout);

    child.stdout.on("data", (b: Buffer) => {
      if (stdout.length < 5 * 1024 * 1024) stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      if (stderr.length < 1024 * 1024) stderr += b.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        startedAt,
        durationMs: Date.now() - startedAt,
        files: [],
        totalPassed: 0,
        totalFailed: 0,
        totalSkipped: 0,
        totalFiles: 0,
        fatalError: `spawn error: ${err.message}`,
      });
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      const parsed = parseVitestJson(stdout);
      const result: TestRunResult = {
        ok:
          !killed &&
          (parsed.totalFailed ?? 0) === 0 &&
          (parsed.files?.length ?? 0) > 0,
        startedAt,
        durationMs: Date.now() - startedAt,
        files: parsed.files ?? [],
        totalPassed: parsed.totalPassed ?? 0,
        totalFailed: parsed.totalFailed ?? 0,
        totalSkipped: parsed.totalSkipped ?? 0,
        totalFiles: parsed.files?.length ?? 0,
        rawStdout: stdout.slice(0, 20_000),
      };
      if (killed) {
        result.fatalError = `vitest timed out after ${timeout}ms`;
      } else if (parsed.fatalError) {
        result.fatalError = parsed.fatalError;
      } else if ((parsed.files?.length ?? 0) === 0 && stderr.trim().length > 0) {
        result.fatalError = stderr.trim().slice(0, 2000);
      } else if (code !== 0 && (parsed.totalFailed ?? 0) === 0) {
        result.fatalError = `vitest exited with code ${code}`;
      }
      resolve(result);
    });
  });
}
