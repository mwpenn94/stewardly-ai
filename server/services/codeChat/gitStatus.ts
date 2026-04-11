/**
 * Git status parser + reader for Code Chat (Pass 244).
 *
 * Parses `git status --porcelain=v1` output into structured entries
 * so the Code Chat UI can show modified/new/deleted files and the
 * agent can reason about the current delta from HEAD.
 *
 * The parser is pure and testable. The subprocess runner lives in
 * a separate helper so tests can hit the parser directly without
 * spinning up a real git repo.
 */

import { spawn } from "child_process";

export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflicted"
  | "typechange"
  | "unknown";

export interface GitStatusEntry {
  path: string;
  /** Previous path for renames/copies */
  originalPath?: string;
  /** Staged (index) state */
  staged: GitFileStatus;
  /** Worktree state */
  worktree: GitFileStatus;
  /** Convenience: is this file modified at all (staged OR worktree != unmodified)? */
  dirty: boolean;
}

// Map a single porcelain status code character to a semantic status.
function codeToStatus(code: string): GitFileStatus {
  switch (code) {
    case " ":
      return "unknown"; // placeholder, caller treats as "unmodified"
    case "M":
      return "modified";
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "U":
      return "conflicted";
    case "T":
      return "typechange";
    case "?":
      return "untracked";
    case "!":
      return "ignored";
    default:
      return "unknown";
  }
}

/**
 * Parse `git status --porcelain=v1 -z`? No — the z variant uses NUL
 * separators which are annoying in tests. We stick with the
 * newline-separated v1 format which is:
 *
 *   XY <space> <path>[ -> <renamed_path>]
 *
 * where X is the staged state and Y is the worktree state. For
 * untracked files both are "?".
 */
export function parseGitStatusPorcelain(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  if (!output) return entries;
  const lines = output.split("\n");
  for (const line of lines) {
    if (line.length < 4) continue; // need at least "XY path"
    const X = line[0];
    const Y = line[1];
    if (line[2] !== " ") continue; // expect a space after XY
    const rest = line.slice(3);
    let path = rest;
    let originalPath: string | undefined;
    // Rename / copy: "orig -> new"
    const arrowIdx = rest.indexOf(" -> ");
    if (arrowIdx !== -1) {
      originalPath = rest.slice(0, arrowIdx);
      path = rest.slice(arrowIdx + 4);
    }
    const staged =
      X === " " ? "unknown" : codeToStatus(X);
    const worktree =
      Y === " " ? "unknown" : codeToStatus(Y);
    // Untracked files show as "??" — both X and Y are "?"
    const dirty =
      (staged !== "unknown" && staged !== "ignored") ||
      (worktree !== "unknown" && worktree !== "ignored");
    entries.push({ path, originalPath, staged, worktree, dirty });
  }
  return entries;
}

export interface GitStatusSummary {
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
  untracked: number;
  conflicted: number;
  total: number;
}

export function summarizeGitStatus(entries: GitStatusEntry[]): GitStatusSummary {
  const summary: GitStatusSummary = {
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    untracked: 0,
    conflicted: 0,
    total: entries.length,
  };
  for (const e of entries) {
    // Pick the most meaningful state between staged and worktree
    const states = [e.staged, e.worktree];
    if (states.includes("conflicted")) {
      summary.conflicted++;
      continue;
    }
    if (states.includes("untracked")) {
      summary.untracked++;
      continue;
    }
    if (states.includes("deleted")) {
      summary.deleted++;
      continue;
    }
    if (states.includes("renamed") || states.includes("copied")) {
      summary.renamed++;
      continue;
    }
    if (states.includes("added")) {
      summary.added++;
      continue;
    }
    if (states.includes("modified") || states.includes("typechange")) {
      summary.modified++;
      continue;
    }
  }
  return summary;
}

// ─── Subprocess runners ─────────────────────────────────────────────────

/**
 * Run a git command in the workspace and capture stdout. Throws on
 * non-zero exit or subprocess failure.
 */
function runGit(cwd: string, args: string[], timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`git ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`git exited ${code}: ${stderr.trim() || "unknown"}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Get a parsed list of modified files in the workspace. Returns an
 * empty array if the workspace isn't a git repo (so the UI can
 * degrade gracefully instead of throwing).
 */
export async function getWorkspaceGitStatus(
  workspaceRoot: string,
): Promise<GitStatusEntry[]> {
  try {
    const output = await runGit(workspaceRoot, ["status", "--porcelain=v1"]);
    return parseGitStatusPorcelain(output);
  } catch {
    return [];
  }
}

/**
 * Get the diff for a specific file. Returns empty string on failure
 * (not a git repo, file not tracked, etc.).
 */
export async function getWorkspaceGitDiff(
  workspaceRoot: string,
  path: string,
  staged = false,
): Promise<string> {
  try {
    const args = staged
      ? ["diff", "--cached", "--", path]
      : ["diff", "--", path];
    return await runGit(workspaceRoot, args, 15_000);
  } catch {
    return "";
  }
}

/**
 * Get the current HEAD commit sha and branch name. Returns nulls on
 * failure.
 */
export async function getWorkspaceGitHead(workspaceRoot: string): Promise<{
  sha: string | null;
  branch: string | null;
}> {
  try {
    const [sha, branch] = await Promise.all([
      runGit(workspaceRoot, ["rev-parse", "HEAD"]).then((s) => s.trim()),
      runGit(workspaceRoot, ["rev-parse", "--abbrev-ref", "HEAD"]).then((s) => s.trim()),
    ]);
    return { sha, branch };
  } catch {
    return { sha: null, branch: null };
  }
}
