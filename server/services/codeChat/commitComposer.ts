/**
 * Git commit message composer — Pass 262.
 *
 * Pure helpers for building a structured commit message from a
 * unified diff. Used by the client-side CommitComposerPanel to
 * generate a first-pass commit message for staged changes that
 * the user can tweak before running `git commit`.
 *
 * The pure side is regex-driven so we can test it deterministically
 * without invoking an LLM. A second tRPC procedure optionally
 * feeds the same diff through contextualLLM for a richer message —
 * that path lives in the router, not in this module.
 */

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
  filesByStatus: {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
  };
}

export interface CommitMessage {
  subject: string;
  body: string[];
}

/**
 * Parse a unified diff output from `git diff --staged` into file-
 * level status + insertion/deletion counts. Handles added,
 * modified, deleted, and renamed files. Binary file headers are
 * counted as zero lines.
 */
export function parseDiffStats(diff: string): DiffStats {
  const stats: DiffStats = {
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    filesByStatus: { added: [], modified: [], deleted: [], renamed: [] },
  };
  if (!diff) return stats;

  const lines = diff.split("\n");
  let currentFile: string | null = null;
  let currentStatus: "added" | "modified" | "deleted" | "renamed" = "modified";
  let renamedFrom: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // File header: `diff --git a/path b/path`
    const diffHeader = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffHeader) {
      // Flush previous file
      if (currentFile) finalizeFile();
      currentFile = diffHeader[2];
      currentStatus = "modified";
      renamedFrom = null;
      stats.filesChanged++;
      continue;
    }
    if (!currentFile) continue;
    if (line.startsWith("new file mode")) currentStatus = "added";
    else if (line.startsWith("deleted file mode")) currentStatus = "deleted";
    else if (line.startsWith("rename from ")) {
      currentStatus = "renamed";
      renamedFrom = line.slice("rename from ".length);
    }
    // Insertion / deletion counts — ignore diff headers starting with +++/---
    else if (line.startsWith("+") && !line.startsWith("+++")) stats.insertions++;
    else if (line.startsWith("-") && !line.startsWith("---")) stats.deletions++;
  }
  if (currentFile) finalizeFile();
  return stats;

  function finalizeFile() {
    if (!currentFile) return;
    if (currentStatus === "added") stats.filesByStatus.added.push(currentFile);
    else if (currentStatus === "deleted")
      stats.filesByStatus.deleted.push(currentFile);
    else if (currentStatus === "renamed" && renamedFrom)
      stats.filesByStatus.renamed.push({ from: renamedFrom, to: currentFile });
    else stats.filesByStatus.modified.push(currentFile);
  }
}

/**
 * Compose a conventional-style commit subject line from the diff
 * stats alone. Pure, deterministic, language-agnostic.
 *
 * Format: `<type>(<scope>): <summary>` where:
 *   - type is derived from the mix of adds/mods/deletes
 *   - scope is the shared path prefix if one exists
 *   - summary is a natural-language count
 */
export function composeSubject(stats: DiffStats): string {
  if (stats.filesChanged === 0) return "chore: no staged changes";

  const type = detectType(stats);
  const scope = detectScope(stats);
  const summary = formatSummary(stats);
  if (scope) return `${type}(${scope}): ${summary}`;
  return `${type}: ${summary}`;
}

function detectType(stats: DiffStats): string {
  const s = stats.filesByStatus;
  if (s.added.length > 0 && s.modified.length === 0 && s.deleted.length === 0)
    return "feat";
  if (s.deleted.length > 0 && s.added.length === 0 && s.modified.length === 0)
    return "chore";
  if (s.renamed.length > 0 && s.added.length === 0 && s.deleted.length === 0)
    return "refactor";
  // Tests / docs / config heuristics
  const allPaths = [
    ...s.added,
    ...s.modified,
    ...s.deleted,
    ...s.renamed.map((r) => r.to),
  ];
  if (allPaths.every((p) => /\.(md|mdx|txt)$/.test(p))) return "docs";
  if (allPaths.every((p) => /\.test\.|\.spec\.|__tests__/.test(p))) return "test";
  if (allPaths.every((p) => /\.(json|ya?ml|toml)$/.test(p))) return "chore";
  return "refactor";
}

/**
 * Find the longest directory prefix shared by every changed file.
 * Returns the scope string, or an empty string when there's no
 * single shared directory.
 */
export function detectScope(stats: DiffStats): string {
  const paths = [
    ...stats.filesByStatus.added,
    ...stats.filesByStatus.modified,
    ...stats.filesByStatus.deleted,
    ...stats.filesByStatus.renamed.map((r) => r.to),
  ];
  if (paths.length === 0) return "";
  const segmentsList = paths.map((p) => p.split("/"));
  const minLen = Math.min(...segmentsList.map((s) => s.length));
  const shared: string[] = [];
  for (let i = 0; i < minLen - 1; i++) {
    const first = segmentsList[0][i];
    if (segmentsList.every((segs) => segs[i] === first)) {
      shared.push(first);
    } else {
      break;
    }
  }
  if (shared.length === 0) return "";
  // Last segment of the shared prefix is usually the most specific
  // and readable (e.g. "codeChat" for "server/services/codeChat/...")
  return shared[shared.length - 1];
}

function formatSummary(stats: DiffStats): string {
  const parts: string[] = [];
  if (stats.filesByStatus.added.length > 0) {
    parts.push(`add ${stats.filesByStatus.added.length} file${stats.filesByStatus.added.length === 1 ? "" : "s"}`);
  }
  if (stats.filesByStatus.modified.length > 0) {
    parts.push(`update ${stats.filesByStatus.modified.length} file${stats.filesByStatus.modified.length === 1 ? "" : "s"}`);
  }
  if (stats.filesByStatus.deleted.length > 0) {
    parts.push(`remove ${stats.filesByStatus.deleted.length} file${stats.filesByStatus.deleted.length === 1 ? "" : "s"}`);
  }
  if (stats.filesByStatus.renamed.length > 0) {
    parts.push(`rename ${stats.filesByStatus.renamed.length} file${stats.filesByStatus.renamed.length === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return "no changes";
  return parts.join(", ");
}

/**
 * Produce a bulleted body from the diff stats. Lists changed files
 * with their status, capped at 10 entries per category so the body
 * stays readable.
 */
export function composeBody(stats: DiffStats): string[] {
  const body: string[] = [];
  body.push(
    `${stats.filesChanged} file${stats.filesChanged === 1 ? "" : "s"} changed, ${stats.insertions} insertion${stats.insertions === 1 ? "" : "s"} (+), ${stats.deletions} deletion${stats.deletions === 1 ? "" : "s"} (-)`,
  );
  const sections: Array<[string, string[]]> = [
    ["Added", stats.filesByStatus.added],
    ["Modified", stats.filesByStatus.modified],
    ["Deleted", stats.filesByStatus.deleted],
  ];
  for (const [label, list] of sections) {
    if (list.length === 0) continue;
    body.push("");
    body.push(`${label}:`);
    const limit = 10;
    for (const p of list.slice(0, limit)) {
      body.push(`  - ${p}`);
    }
    if (list.length > limit) {
      body.push(`  ... and ${list.length - limit} more`);
    }
  }
  if (stats.filesByStatus.renamed.length > 0) {
    body.push("");
    body.push("Renamed:");
    for (const r of stats.filesByStatus.renamed.slice(0, 10)) {
      body.push(`  - ${r.from} -> ${r.to}`);
    }
  }
  return body;
}

export function composeMessage(stats: DiffStats): CommitMessage {
  return {
    subject: composeSubject(stats),
    body: composeBody(stats),
  };
}

export function formatMessage(message: CommitMessage): string {
  const body = message.body.filter((l) => l.length > 0 || message.body.indexOf(l) === 0).join("\n");
  return `${message.subject}\n\n${body}`;
}
