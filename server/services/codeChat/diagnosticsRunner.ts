/**
 * Cached tsc runner — Pass 251.
 *
 * Invokes `npx tsc --noEmit --pretty false` against the workspace
 * root, captures stdout (diagnostics are emitted on stdout for tsc),
 * parses the output via `parseTscOutput`, and caches the result
 * for TTL milliseconds so the UI can poll cheaply.
 *
 * Timeouts:
 *   - 60s hard cap on tsc invocation (project is large)
 *   - In-flight dedup so concurrent callers share one run
 *
 * Non-zero exit from tsc is expected when diagnostics exist — we
 * only treat it as a hard failure when stdout is empty AND stderr
 * has content (binary missing, tsconfig errors, etc.).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { parseTscOutput, type Diagnostic } from "./diagnostics";

export interface DiagnosticsRunResult {
  diagnostics: Diagnostic[];
  startedAt: number;
  durationMs: number;
  cached: boolean;
  /** Raw stdout for debugging */
  raw?: string;
  /** Set when tsc itself crashed or couldn't start */
  fatalError?: string;
}

interface CacheEntry {
  result: DiagnosticsRunResult;
  expiresAt: number;
}

const TTL_MS = 30_000;
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5MB stdout cap

const cache: Map<string, CacheEntry> = new Map();
const inflight: Map<string, Promise<DiagnosticsRunResult>> = new Map();

function cacheKey(workspaceRoot: string): string {
  return path.resolve(workspaceRoot);
}

export function clearDiagnosticsCache(): void {
  cache.clear();
  inflight.clear();
}

function runTsc(workspaceRoot: string): Promise<DiagnosticsRunResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsc", "--noEmit", "--pretty", "false"], {
      cwd: workspaceRoot,
      shell: false,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBuf.length < MAX_OUTPUT_BYTES) {
        stdoutBuf += chunk.toString("utf8");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBuf.length < MAX_OUTPUT_BYTES) {
        stderrBuf += chunk.toString("utf8");
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        diagnostics: [],
        startedAt,
        durationMs: Date.now() - startedAt,
        cached: false,
        fatalError: `spawn error: ${err.message}`,
      });
    });

    child.on("exit", () => {
      clearTimeout(timer);
      const diagnostics = parseTscOutput(stdoutBuf);
      const result: DiagnosticsRunResult = {
        diagnostics,
        startedAt,
        durationMs: Date.now() - startedAt,
        cached: false,
        raw: stdoutBuf.slice(0, 20_000),
      };
      if (killed) {
        result.fatalError = `tsc timed out after ${TIMEOUT_MS}ms`;
      } else if (diagnostics.length === 0 && stderrBuf.trim().length > 0) {
        // tsc printed something on stderr but we got no parseable
        // diagnostics — surface it as a fatal so the UI can show why.
        result.fatalError = stderrBuf.trim().slice(0, 2000);
      }
      resolve(result);
    });
  });
}

/**
 * Run tsc or return a cached result. Concurrent callers share the
 * same in-flight promise to avoid compiling twice.
 */
export async function getDiagnostics(
  workspaceRoot: string,
  opts: { force?: boolean } = {},
): Promise<DiagnosticsRunResult> {
  const key = cacheKey(workspaceRoot);
  const now = Date.now();

  if (!opts.force) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return { ...cached.result, cached: true };
    }
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = runTsc(workspaceRoot).then((result) => {
    cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
    inflight.delete(key);
    return result;
  });
  inflight.set(key, promise);
  return promise;
}
