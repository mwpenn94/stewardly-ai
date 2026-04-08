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
  const abs = resolveInside(opts.workspaceRoot, relativePath);
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
  const abs = resolveInside(opts.workspaceRoot, relativePath);
  const max = opts.maxWriteBytes ?? 1024 * 1024;
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > max) {
    throw new SandboxError(
      `content exceeds max write size (${bytes} > ${max})`,
      "TOO_LARGE",
    );
  }
  const created = !existsSync(abs);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { path: relativePath, byteLength: bytes, created };
}

// ─── Edit (find + replace) ────────────────────────────────────────────────

export interface EditFileResult {
  path: string;
  replacements: number;
  byteLength: number;
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
  const abs = resolveInside(opts.workspaceRoot, relativePath);
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
  return {
    path: relativePath,
    replacements,
    byteLength: Buffer.byteLength(after, "utf8"),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const abs = resolveInside(opts.workspaceRoot, relativePath);
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
