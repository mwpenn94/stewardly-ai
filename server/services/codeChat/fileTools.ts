/**
 * Sandboxed file tools for the code chat — Round B1.
 *
 * The Claude-Code-style chat needs the ability to read, write, edit,
 * grep, glob, and run shell commands against the workspace. These
 * tools are intentionally narrow:
 *
 *  - Every path is normalized + bounds-checked against `workspaceRoot`
 *    so the agent cannot escape the project root.
 *  - Write/Edit/Bash operations require the caller to pass an
 *    `allowMutations: true` flag so read-only sessions are safe by
 *    default.
 *  - Bash commands are denylist-filtered for the obvious destructive
 *    cases (`rm -rf /`, `:(){ :|:& };:`, etc).
 *
 * The functions here are pure server-side helpers; the LLM-facing
 * tool definitions live in `codeChatTools.ts` and the dispatcher
 * lives in `codeChatExecutor.ts`.
 */

import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";
import { notifyFileChanged } from "./cacheInvalidation";

// ─── Sandbox guard ────────────────────────────────────────────────────────

export interface SandboxOptions {
  workspaceRoot: string;
  allowMutations?: boolean;
  /** Maximum bytes to read from a file in one call (default 256KB) */
  maxReadBytes?: number;
  /** Maximum bytes to write in one call (default 1MB) */
  maxWriteBytes?: number;
  /** Maximum bash command timeout in ms (default 30s) */
  bashTimeoutMs?: number;
}

export class SandboxError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SandboxError";
  }
}

/**
 * Resolve a user-supplied path against the workspace root and verify
 * the result stays inside it. Throws SandboxError on escape attempts.
 *
 * NOTE: This does NOT follow symlinks. Use `resolveInsideReal` for
 * any operation that's about to actually touch the filesystem — a
 * symlink sitting inside the workspace could otherwise redirect the
 * operation to an arbitrary file on the host. See Parity Pass 6.
 */
export function resolveInside(
  workspaceRoot: string,
  userPath: string,
): string {
  const normRoot = path.resolve(workspaceRoot);
  const normPath = path.resolve(normRoot, userPath);
  if (!normPath.startsWith(normRoot + path.sep) && normPath !== normRoot) {
    throw new SandboxError(
      `path '${userPath}' resolves outside workspace`,
      "OUT_OF_BOUNDS",
    );
  }
  return normPath;
}

/**
 * Like `resolveInside` but also fs.realpath()'s the result (when the
 * path already exists) and re-verifies the REAL path still lives
 * inside the workspace root. Blocks symlink-escape attacks where a
 * malicious or LLM-planted symlink inside the workspace redirects
 * reads/writes to arbitrary files on the host filesystem (e.g. a
 * symlink `./notes.md` → `/etc/passwd`).
 *
 * For non-existent paths (e.g. create-a-new-file), we fall back to
 * resolving the parent directory's realpath and rebasing the leaf,
 * so writeFile still works when the target doesn't exist yet but
 * its containing directory is a symlink out of the sandbox.
 */
export async function resolveInsideReal(
  workspaceRoot: string,
  userPath: string,
): Promise<string> {
  const normRoot = path.resolve(workspaceRoot);
  const rootReal = existsSync(normRoot)
    ? await fs.realpath(normRoot)
    : normRoot;
  const normPath = resolveInside(workspaceRoot, userPath);

  // Fast path — path exists, realpath it directly.
  if (existsSync(normPath)) {
    let real: string;
    try {
      real = await fs.realpath(normPath);
    } catch (err) {
      throw new SandboxError(
        `cannot realpath '${userPath}': ${(err as Error).message}`,
        "REALPATH_FAILED",
      );
    }
    if (!isInsideRoot(real, rootReal)) {
      throw new SandboxError(
        `path '${userPath}' resolves via symlink outside workspace`,
        "SANDBOX_ESCAPE",
      );
    }
    return normPath;
  }

  // Path doesn't exist yet — realpath the containing directory so a
  // symlinked parent still blocks escapes on create.
  const parent = path.dirname(normPath);
  if (existsSync(parent)) {
    let parentReal: string;
    try {
      parentReal = await fs.realpath(parent);
    } catch (err) {
      throw new SandboxError(
        `cannot realpath parent of '${userPath}': ${(err as Error).message}`,
        "REALPATH_FAILED",
      );
    }
    if (!isInsideRoot(parentReal, rootReal)) {
      throw new SandboxError(
        `path '${userPath}' resolves via symlinked parent outside workspace`,
        "SANDBOX_ESCAPE",
      );
    }
  }
  return normPath;
}

function isInsideRoot(absPath: string, rootReal: string): boolean {
  return absPath === rootReal || absPath.startsWith(rootReal + path.sep);
}

// ─── Read ─────────────────────────────────────────────────────────────────

export interface ReadFileResult {
  path: string;
  content: string;
  truncated: boolean;
  byteLength: number;
}

export async function readFile(
  opts: SandboxOptions,
  relativePath: string,
): Promise<ReadFileResult> {
  const abs = await resolveInsideReal(opts.workspaceRoot, relativePath);
  if (!existsSync(abs)) {
    throw new SandboxError(`file not found: ${relativePath}`, "NOT_FOUND");
  }
  const stat = await fs.stat(abs);
  if (!stat.isFile()) {
    throw new SandboxError(`not a file: ${relativePath}`, "NOT_FILE");
  }
  const max = opts.maxReadBytes ?? 256 * 1024;
  const buf = await fs.readFile(abs);
  const truncated = buf.length > max;
  return {
    path: relativePath,
    content: truncated ? buf.subarray(0, max).toString("utf8") + "\n[…truncated]" : buf.toString("utf8"),
    truncated,
    byteLength: buf.length,
  };
}

// ─── Write ────────────────────────────────────────────────────────────────

export interface WriteFileResult {
  path: string;
  byteLength: number;
  created: boolean;
  /** Content before the write (truncated to DIFF_SNAPSHOT_BYTES) — empty for new files */
  before?: string;
  /** Content after the write (truncated to DIFF_SNAPSHOT_BYTES) */
  after?: string;
  /** True when either snapshot was truncated */
  diffTruncated?: boolean;
}

/**
 * Max bytes kept for before/after snapshots. 64KB covers virtually
 * every source file Code Chat will touch while keeping SSE payload
 * size bounded.
 */
const DIFF_SNAPSHOT_BYTES = 64 * 1024;

function snapshot(s: string): string {
  if (s.length <= DIFF_SNAPSHOT_BYTES) return s;
  return s.slice(0, DIFF_SNAPSHOT_BYTES) + "\n[…truncated]";
}

export async function writeFile(
  opts: SandboxOptions,
  relativePath: string,
  content: string,
): Promise<WriteFileResult> {
  if (!opts.allowMutations) {
    throw new SandboxError(
      "write_file requires allowMutations: true",
      "MUTATIONS_DISABLED",
    );
  }
  const abs = await resolveInsideReal(opts.workspaceRoot, relativePath);
  const max = opts.maxWriteBytes ?? 1024 * 1024;
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > max) {
    throw new SandboxError(
      `content exceeds max write size (${bytes} > ${max})`,
      "TOO_LARGE",
    );
  }
  // Capture the existing file for diff rendering if it exists. We
  // read before writing so a failed write doesn't pollute the snapshot.
  let before = "";
  const created = !existsSync(abs);
  if (!created) {
    try {
      before = await fs.readFile(abs, "utf8");
    } catch {
      /* best-effort — a read failure doesn't block the write */
    }
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  // Build-loop Pass 9 (G10): eager cache invalidation so the next
  // find_symbol / glob_files / @mention call sees the new content
  // instead of stale TTL data.
  notifyFileChanged(relativePath, "write");
  const beforeSnap = snapshot(before);
  const afterSnap = snapshot(content);
  return {
    path: relativePath,
    byteLength: bytes,
    created,
    before: beforeSnap,
    after: afterSnap,
    diffTruncated:
      beforeSnap.length !== before.length || afterSnap.length !== content.length,
  };
}

// ─── Edit (find + replace) ────────────────────────────────────────────────

export interface EditFileResult {
  path: string;
  replacements: number;
  byteLength: number;
  before?: string;
  after?: string;
  diffTruncated?: boolean;
}

export async function editFile(
  opts: SandboxOptions,
  relativePath: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): Promise<EditFileResult> {
  if (!opts.allowMutations) {
    throw new SandboxError(
      "edit_file requires allowMutations: true",
      "MUTATIONS_DISABLED",
    );
  }
  const abs = await resolveInsideReal(opts.workspaceRoot, relativePath);
  if (!existsSync(abs)) {
    throw new SandboxError(`file not found: ${relativePath}`, "NOT_FOUND");
  }
  const before = await fs.readFile(abs, "utf8");
  if (!before.includes(oldString)) {
    throw new SandboxError(
      `oldString not found in ${relativePath}`,
      "NO_MATCH",
    );
  }
  let replacements = 0;
  let after: string;
  if (replaceAll) {
    after = before.split(oldString).join(newString);
    replacements = (before.match(new RegExp(escapeRegex(oldString), "g")) || []).length;
  } else {
    // Require uniqueness for single-occurrence edits
    const occurrences = before.split(oldString).length - 1;
    if (occurrences > 1) {
      throw new SandboxError(
        `oldString matches ${occurrences} times in ${relativePath} (use replaceAll)`,
        "AMBIGUOUS",
      );
    }
    after = before.replace(oldString, newString);
    replacements = 1;
  }
  await fs.writeFile(abs, after, "utf8");
  // Build-loop Pass 9 (G10): eager cache invalidation.
  notifyFileChanged(relativePath, "edit");
  const beforeSnap = snapshot(before);
  const afterSnap = snapshot(after);
  return {
    path: relativePath,
    replacements,
    byteLength: Buffer.byteLength(after, "utf8"),
    before: beforeSnap,
    after: afterSnap,
    diffTruncated:
      beforeSnap.length !== before.length || afterSnap.length !== after.length,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Multi-edit (atomic batch find + replace) ────────────────────────────

export interface MultiEditStep {
  oldString: string;
  newString: string;
  /** Default false — require unique match, fail on ambiguity */
  replaceAll?: boolean;
}

export interface MultiEditStepOutcome {
  index: number;
  oldString: string;
  newString: string;
  replacements: number;
}

export interface MultiEditFileResult {
  path: string;
  /** Total replacements summed across every step */
  replacements: number;
  /** Number of steps applied (= steps.length on success) */
  stepsApplied: number;
  byteLength: number;
  before?: string;
  after?: string;
  diffTruncated?: boolean;
  /** Per-step breakdown for UI rendering / auditing */
  steps: MultiEditStepOutcome[];
}

/**
 * Apply a batch of find/replace edits to a single file atomically:
 *
 *   1. Read the file once into memory.
 *   2. Apply each edit sequentially against the running in-memory
 *      content (later edits see earlier edits' results — Claude Code
 *      MultiEdit semantics).
 *   3. If any step throws (not found, ambiguous), the entire batch
 *      is aborted and the file on disk is left untouched.
 *   4. Only if every step succeeds is the final content written back.
 *
 * The atomicity is important because separate editFile calls can
 * leave a file half-edited if the second call fails — this tool
 * guarantees either all or none.
 */
export async function multiEditFile(
  opts: SandboxOptions,
  relativePath: string,
  steps: MultiEditStep[],
): Promise<MultiEditFileResult> {
  if (!opts.allowMutations) {
    throw new SandboxError(
      "multi_edit requires allowMutations: true",
      "MUTATIONS_DISABLED",
    );
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new SandboxError(
      "multi_edit requires at least one step",
      "BAD_ARGS",
    );
  }
  if (steps.length > 50) {
    throw new SandboxError(
      `multi_edit is capped at 50 steps (got ${steps.length})`,
      "TOO_MANY_STEPS",
    );
  }

  // Validate every step shape up-front so the agent gets a clean
  // error instead of a mid-batch failure.
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || typeof s !== "object") {
      throw new SandboxError(
        `step ${i} is not an object`,
        "BAD_ARGS",
      );
    }
    if (typeof s.oldString !== "string" || s.oldString.length === 0) {
      throw new SandboxError(
        `step ${i}: oldString must be a non-empty string`,
        "BAD_ARGS",
      );
    }
    if (typeof s.newString !== "string") {
      throw new SandboxError(
        `step ${i}: newString must be a string`,
        "BAD_ARGS",
      );
    }
    if (s.oldString === s.newString) {
      throw new SandboxError(
        `step ${i}: oldString equals newString (no-op)`,
        "BAD_ARGS",
      );
    }
  }

  const abs = await resolveInsideReal(opts.workspaceRoot, relativePath);
  if (!existsSync(abs)) {
    throw new SandboxError(`file not found: ${relativePath}`, "NOT_FOUND");
  }

  const before = await fs.readFile(abs, "utf8");
  let running = before;
  const outcomes: MultiEditStepOutcome[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const old = step.oldString;
    if (!running.includes(old)) {
      throw new SandboxError(
        `step ${i}: oldString not found in ${relativePath} (after prior edits)`,
        "NO_MATCH",
      );
    }
    let replacements = 0;
    if (step.replaceAll) {
      const matchCount = (running.match(new RegExp(escapeRegex(old), "g")) || []).length;
      running = running.split(old).join(step.newString);
      replacements = matchCount;
    } else {
      const occurrences = running.split(old).length - 1;
      if (occurrences > 1) {
        throw new SandboxError(
          `step ${i}: oldString matches ${occurrences} times in ${relativePath} (use replaceAll)`,
          "AMBIGUOUS",
        );
      }
      running = running.replace(old, step.newString);
      replacements = 1;
    }
    outcomes.push({
      index: i,
      oldString: old,
      newString: step.newString,
      replacements,
    });
  }

  // Enforce the same max-write budget as writeFile so a batch of
  // edits that bloats the file past the cap fails before touching disk.
  const max = opts.maxWriteBytes ?? 1024 * 1024;
  const bytes = Buffer.byteLength(running, "utf8");
  if (bytes > max) {
    throw new SandboxError(
      `multi_edit result exceeds max write size (${bytes} > ${max})`,
      "TOO_LARGE",
    );
  }

  await fs.writeFile(abs, running, "utf8");

  const beforeSnap = snapshot(before);
  const afterSnap = snapshot(running);
  return {
    path: relativePath,
    replacements: outcomes.reduce((sum, o) => sum + o.replacements, 0),
    stepsApplied: outcomes.length,
    byteLength: bytes,
    before: beforeSnap,
    after: afterSnap,
    diffTruncated:
      beforeSnap.length !== before.length || afterSnap.length !== running.length,
    steps: outcomes,
  };
}

// ─── List directory ──────────────────────────────────────────────────────

export interface ListDirEntry {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
}

export async function listDirectory(
  opts: SandboxOptions,
  relativePath: string,
): Promise<{ path: string; entries: ListDirEntry[] }> {
  const abs = await resolveInsideReal(opts.workspaceRoot, relativePath);
  if (!existsSync(abs)) {
    throw new SandboxError(`directory not found: ${relativePath}`, "NOT_FOUND");
  }
  const stat = await fs.stat(abs);
  if (!stat.isDirectory()) {
    throw new SandboxError(`not a directory: ${relativePath}`, "NOT_DIR");
  }
  const dir = await fs.readdir(abs, { withFileTypes: true });
  const entries: ListDirEntry[] = await Promise.all(
    dir.map(async (e) => {
      let size: number | undefined;
      try {
        const s = await fs.stat(path.join(abs, e.name));
        if (s.isFile()) size = s.size;
      } catch {
        /* ignore */
      }
      return {
        name: e.name,
        type: e.isFile() ? "file" : e.isDirectory() ? "directory" : "other",
        size,
      };
    }),
  );
  // Sort directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { path: relativePath, entries };
}

// ─── Bash ────────────────────────────────────────────────────────────────

const DENYLIST_PATTERNS: RegExp[] = [
  /\brm\s+-rf?\s+\/(?!home\/user\/stewardly-ai)/i, // rm -rf / outside workspace
  /\brm\s+-rf?\s+\*\s*$/, // rm -rf *
  /:\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;\s*:/, // fork bomb
  /\bdd\s+if=\/dev\/zero\s+of=\/dev/i, // disk wipe
  /\bmkfs\b/i, // format filesystem
  /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/i,
  // CBL17 security hardening: block network exfiltration + privilege escalation
  /\b(nc|ncat|socat)\s+-/i, // netcat reverse shells
  /\bcurl\b.*\|\s*(ba)?sh/i, // curl-pipe-to-shell
  /\bwget\b.*\|\s*(ba)?sh/i, // wget-pipe-to-shell
  />\s*\/dev\/tcp\//i, // bash TCP redirect (data exfiltration)
  /\bsudo\b/i, // privilege escalation
  /\bsu\s+-?\s/i, // switch user
  /\bchmod\s+[0-7]*s/i, // setuid/setgid
  /\bchown\b.*\/(?!home\/user\/stewardly-ai)/i, // chown outside workspace
  /\bwhile\s+true\s*;\s*do/i, // infinite loops
  /\bfor\s*\(\s*;\s*;\s*\)/i, // C-style infinite loop
];

export interface BashResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
}

export function isBashCommandSafe(command: string): {
  safe: boolean;
  reason?: string;
} {
  for (const pattern of DENYLIST_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `matches denylist pattern ${pattern}` };
    }
  }
  return { safe: true };
}

export async function runBash(
  opts: SandboxOptions,
  command: string,
): Promise<BashResult> {
  if (!opts.allowMutations) {
    throw new SandboxError(
      "run_bash requires allowMutations: true",
      "MUTATIONS_DISABLED",
    );
  }
  const safety = isBashCommandSafe(command);
  if (!safety.safe) {
    throw new SandboxError(
      `bash command rejected: ${safety.reason}`,
      "DENYLIST",
    );
  }
  const timeout = opts.bashTimeoutMs ?? 30_000;
  const t0 = Date.now();

  return await new Promise<BashResult>((resolve, reject) => {
    const child = spawn("bash", ["-c", command], {
      cwd: opts.workspaceRoot,
      env: process.env,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout.on("data", (b: Buffer) => stdoutChunks.push(b));
    child.stderr.on("data", (b: Buffer) => stderrChunks.push(b));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const truncated = stdout.length > 10_000 || stderr.length > 10_000;
      resolve({
        command,
        stdout: stdout.slice(0, 10_000),
        stderr: stderr.slice(0, 10_000),
        exitCode: killed ? 124 : code ?? -1,
        durationMs: Date.now() - t0,
        truncated,
      });
    });
  });
}
