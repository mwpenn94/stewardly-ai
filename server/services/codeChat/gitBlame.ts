/**
 * gitBlame.ts — `git blame` wrapper for Code Chat (Parity Pass 9, T18).
 *
 * Gives the ReAct agent per-line attribution without having to reach
 * for `run_bash` (which requires admin + write mode). This tool is
 * read-only so it works for any role and respects the same workspace
 * sandbox as the other file tools.
 *
 * Design:
 *   - `parseBlamePorcelain` is a pure function that decodes `git
 *     blame --porcelain` output into structured entries. Porcelain
 *     format is stable across git versions and gives us author,
 *     email, timestamp, summary, AND the actual line content in a
 *     single stream.
 *   - `runGitBlame` shells out once with a timeout + stdout cap.
 *     Falls back to a "not a git repo" error when the workspace
 *     isn't git-initialized instead of leaving the process dangling.
 *   - `summarizeBlame` rolls the entries into per-author counts +
 *     date range + the most-recent commit for the dashboard blurb.
 *   - Optional range (startLine, endLine) so the agent can blame a
 *     specific function without pulling the whole file.
 */

import { spawn } from "child_process";
import path from "path";
import { resolveInsideReal, SandboxError } from "./fileTools";

// ─── Types ─────────────────────────────────────────────────────────────

export interface BlameEntry {
  /** 1-indexed line number in the current file */
  line: number;
  /** Full commit SHA of the last touch */
  commit: string;
  /** Short (7-char) commit SHA — always derivable, cached to save callers */
  shortCommit: string;
  author: string;
  authorEmail: string;
  /** Seconds-since-epoch */
  authorTime: number;
  /** ISO string of authorTime for convenience */
  authorTimeIso: string;
  /** First line of the commit message */
  summary: string;
  /** The actual file content for this line (trimmed trailing newline) */
  content: string;
  /** True if this commit is the root commit / uncommitted (`0000…`) */
  uncommitted: boolean;
}

export interface BlameResult {
  path: string;
  totalLines: number;
  entries: BlameEntry[];
  /** Range applied if any, echoed back for caller display */
  range?: { startLine: number; endLine: number };
}

export interface BlameSummary {
  totalLines: number;
  uncommittedLines: number;
  distinctAuthors: number;
  distinctCommits: number;
  topAuthors: Array<{ author: string; lines: number }>;
  oldestAuthorTime: number | null;
  newestAuthorTime: number | null;
  mostRecent: {
    commit: string;
    author: string;
    summary: string;
    authorTimeIso: string;
  } | null;
}

// ─── Pure parser ───────────────────────────────────────────────────────

/**
 * Parse `git blame --porcelain` output. The format is:
 *
 *     <commit> <orig-line> <final-line> [<num-lines>]
 *     author <name>
 *     author-mail <<email>>
 *     author-time <seconds>
 *     author-tz <offset>
 *     committer <name>
 *     committer-mail <<email>>
 *     committer-time <seconds>
 *     committer-tz <offset>
 *     summary <first-line-of-commit-message>
 *     [previous <commit> <file>]
 *     [filename <file>]
 *     \t<line content>
 *
 * Subsequent lines from the same commit OMIT the metadata lines and
 * appear as `<commit> <orig> <final>\n\t<content>`. The parser
 * caches metadata per commit so it can fill in the repeated entries.
 */
export function parseBlamePorcelain(stdout: string): BlameEntry[] {
  const lines = stdout.split("\n");
  const out: BlameEntry[] = [];

  // Per-commit metadata cache: sha -> { author, email, time, summary }
  type CommitMeta = {
    author: string;
    authorEmail: string;
    authorTime: number;
    summary: string;
  };
  const commitMeta = new Map<string, CommitMeta>();

  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    if (!header) {
      i++;
      continue;
    }
    // Header: "<sha> <orig> <final> [<count>]"
    const headerMatch = header.match(/^([0-9a-f]{7,40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/);
    if (!headerMatch) {
      // Stray line — advance
      i++;
      continue;
    }
    const commit = headerMatch[1];
    const finalLine = parseInt(headerMatch[3], 10);
    i++;

    // Metadata block — consume until we hit the \t<content> line
    const meta: Partial<CommitMeta> = commitMeta.has(commit)
      ? { ...commitMeta.get(commit)! }
      : {};
    while (i < lines.length && !lines[i].startsWith("\t")) {
      const metaLine = lines[i];
      if (metaLine.startsWith("author ")) {
        meta.author = metaLine.slice("author ".length);
      } else if (metaLine.startsWith("author-mail ")) {
        meta.authorEmail = metaLine
          .slice("author-mail ".length)
          .replace(/^<|>$/g, "");
      } else if (metaLine.startsWith("author-time ")) {
        meta.authorTime = parseInt(metaLine.slice("author-time ".length), 10);
      } else if (metaLine.startsWith("summary ")) {
        meta.summary = metaLine.slice("summary ".length);
      }
      // committer-* / filename / previous intentionally skipped
      i++;
    }

    // The content line (\t<text>) should be next
    if (i < lines.length && lines[i].startsWith("\t")) {
      const content = lines[i].slice(1);
      if (!commitMeta.has(commit) && meta.author) {
        commitMeta.set(commit, {
          author: meta.author ?? "",
          authorEmail: meta.authorEmail ?? "",
          authorTime: meta.authorTime ?? 0,
          summary: meta.summary ?? "",
        });
      }
      const resolved = commitMeta.get(commit) ?? {
        author: meta.author ?? "Unknown",
        authorEmail: meta.authorEmail ?? "",
        authorTime: meta.authorTime ?? 0,
        summary: meta.summary ?? "",
      };
      const authorTimeIso =
        resolved.authorTime > 0
          ? new Date(resolved.authorTime * 1000).toISOString()
          : "";
      out.push({
        line: finalLine,
        commit,
        shortCommit: commit.slice(0, 7),
        author: resolved.author,
        authorEmail: resolved.authorEmail,
        authorTime: resolved.authorTime,
        authorTimeIso,
        summary: resolved.summary,
        content,
        uncommitted: /^0+$/.test(commit),
      });
      i++;
    } else {
      // Malformed — advance past the header anyway
      continue;
    }
  }

  return out;
}

// ─── Summary ──────────────────────────────────────────────────────────

export function summarizeBlame(entries: BlameEntry[]): BlameSummary {
  const authorCounts = new Map<string, number>();
  const commits = new Set<string>();
  let oldest: number | null = null;
  let newest: number | null = null;
  let uncommitted = 0;
  let mostRecent: BlameEntry | null = null;

  for (const entry of entries) {
    if (entry.uncommitted) uncommitted++;
    commits.add(entry.commit);
    authorCounts.set(entry.author, (authorCounts.get(entry.author) ?? 0) + 1);
    if (entry.authorTime > 0) {
      if (oldest === null || entry.authorTime < oldest) oldest = entry.authorTime;
      if (newest === null || entry.authorTime > newest) {
        newest = entry.authorTime;
        mostRecent = entry;
      }
    }
  }

  const topAuthors = Array.from(authorCounts.entries())
    .map(([author, lines]) => ({ author, lines }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  return {
    totalLines: entries.length,
    uncommittedLines: uncommitted,
    distinctAuthors: authorCounts.size,
    distinctCommits: commits.size,
    topAuthors,
    oldestAuthorTime: oldest,
    newestAuthorTime: newest,
    mostRecent: mostRecent
      ? {
          commit: mostRecent.shortCommit,
          author: mostRecent.author,
          summary: mostRecent.summary,
          authorTimeIso: mostRecent.authorTimeIso,
        }
      : null,
  };
}

// ─── Subprocess wrapper ───────────────────────────────────────────────

const GIT_TIMEOUT_MS = 15_000;
const MAX_STDOUT_BYTES = 2 * 1024 * 1024; // 2MB — enough for huge files

export interface RunBlameOptions {
  workspaceRoot: string;
  relativePath: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Run `git blame --porcelain` against `relativePath` inside the
 * workspace and return the parsed entries. Throws SandboxError on
 * sandbox escape or git-not-found; returns an empty result on an
 * untracked file.
 */
export async function runGitBlame(opts: RunBlameOptions): Promise<BlameResult> {
  const abs = await resolveInsideReal(opts.workspaceRoot, opts.relativePath);
  const rootReal = path.resolve(opts.workspaceRoot);

  // Refuse impossible ranges early
  if (opts.startLine !== undefined && opts.startLine < 1) {
    throw new SandboxError("startLine must be >= 1", "BAD_ARGS");
  }
  if (
    opts.endLine !== undefined &&
    opts.startLine !== undefined &&
    opts.endLine < opts.startLine
  ) {
    throw new SandboxError("endLine must be >= startLine", "BAD_ARGS");
  }

  const args = ["blame", "--porcelain"];
  if (opts.startLine !== undefined) {
    const range =
      opts.endLine !== undefined
        ? `${opts.startLine},${opts.endLine}`
        : `${opts.startLine}`;
    args.push("-L", range);
  }
  args.push("--", path.relative(rootReal, abs));

  const { stdout, stderr, exitCode } = await spawnGit(rootReal, args);

  if (exitCode !== 0) {
    // Git prints useful error text to stderr — surface a short slice
    // as the SandboxError message so the caller can show it in the
    // tool_result.
    const msg = stderr.trim().split("\n")[0] ?? `git blame exit ${exitCode}`;
    if (/no such path|does not exist|outside/.test(msg)) {
      throw new SandboxError(msg, "NOT_FOUND");
    }
    if (/not a git repository/.test(msg)) {
      throw new SandboxError(msg, "NOT_A_REPO");
    }
    if (/fatal: file .* has only \d+ lines/.test(msg)) {
      throw new SandboxError(msg, "BAD_RANGE");
    }
    throw new SandboxError(msg, "GIT_FAILED");
  }

  const entries = parseBlamePorcelain(stdout);
  return {
    path: opts.relativePath,
    totalLines: entries.length,
    entries,
    range:
      opts.startLine !== undefined
        ? {
            startLine: opts.startLine,
            endLine: opts.endLine ?? opts.startLine,
          }
        : undefined,
  };
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function spawnGit(cwd: string, args: string[]): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    }, GIT_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        if (!killed) {
          killed = true;
          try {
            child.kill("SIGKILL");
          } catch {
            /* already dead */
          }
        }
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `${err.message}`,
        exitCode: -1,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed && code === null) {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: "git blame timed out or exceeded 2MB stdout",
          exitCode: -1,
        });
        return;
      }
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code ?? 0,
      });
    });
  });
}
