/**
 * PR description drafter (Pass 253).
 *
 * Claude Code can read your current branch's commit history + diff
 * and draft a structured Pull Request description (title, summary,
 * test plan, file map). Stewardly's Code Chat had githubCreatePullRequest
 * (Pass 201) but no way to auto-populate the body from the branch.
 *
 * This module is the pure composition side — it takes commit metadata
 * + a list of changed files + an optional unified diff, runs a few
 * heuristics, and returns a structured `PullRequestDraft`. The tRPC
 * layer gathers the git inputs and feeds them in.
 *
 * Safety: no LLM calls here. The drafter is deterministic so users
 * can trust the output. They can still hand it to an LLM for
 * polishing by forwarding the draft via the existing chat routes.
 */

export interface CommitSummary {
  sha: string;
  subject: string;
  body?: string;
  author?: string;
}

export interface ChangedFile {
  path: string;
  /** "A" added, "M" modified, "D" deleted, "R" renamed, "T" typechange */
  status: "A" | "M" | "D" | "R" | "T" | string;
  additions: number;
  deletions: number;
}

export interface PullRequestDraftInput {
  sourceBranch: string;
  targetBranch: string;
  commits: CommitSummary[];
  changedFiles: ChangedFile[];
  /** Optional short unified diff for excerpted quoting */
  diffExcerpt?: string;
}

export interface PullRequestDraft {
  title: string;
  body: string;
  summary: string[];
  testPlan: string[];
  fileMap: FileMapEntry[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
    commitCount: number;
  };
}

export interface FileMapEntry {
  category: FileCategory;
  path: string;
  status: ChangedFile["status"];
  additions: number;
  deletions: number;
}

export type FileCategory =
  | "frontend"
  | "backend"
  | "tests"
  | "docs"
  | "schema"
  | "config"
  | "build"
  | "scripts"
  | "other";

/** Canonical sort order — used by both draftPullRequest and renderBody */
const CATEGORY_ORDER_INDEX: Record<FileCategory, number> = {
  frontend: 0,
  backend: 1,
  tests: 2,
  schema: 3,
  docs: 4,
  config: 5,
  build: 6,
  scripts: 7,
  other: 8,
};

// ─── Categorization ──────────────────────────────────────────────────

export function categorizeFile(path: string): FileCategory {
  const lc = path.toLowerCase();
  if (lc.includes(".test.") || lc.includes(".spec.") || lc.includes("__tests__/")) {
    return "tests";
  }
  if (lc.endsWith(".md") || lc.includes("docs/")) {
    return "docs";
  }
  if (lc.startsWith("drizzle/") || lc.includes("/schema") || lc.endsWith(".sql")) {
    return "schema";
  }
  if (lc.startsWith("client/") || /\.(tsx|jsx|css|scss|html)$/.test(lc)) {
    return "frontend";
  }
  if (lc.startsWith("server/")) {
    return "backend";
  }
  if (lc.startsWith("scripts/") || lc.endsWith(".sh")) {
    return "scripts";
  }
  if (
    lc === "package.json" ||
    lc === "tsconfig.json" ||
    lc === "vite.config.ts" ||
    lc === ".eslintrc" ||
    lc.endsWith(".toml") ||
    lc.endsWith(".yaml") ||
    lc.endsWith(".yml")
  ) {
    return "config";
  }
  if (lc === "dockerfile" || lc.endsWith(".dockerfile") || lc === "package-lock.json") {
    return "build";
  }
  return "other";
}

// ─── Title inference ─────────────────────────────────────────────────

/**
 * Infer a PR title from the commit list. Heuristics:
 *   - If there's exactly one commit, use its subject (trimmed to 72 chars).
 *   - If there are multiple, and they share a leading conventional-commit
 *     prefix ("feat:", "fix:", etc), use that prefix + the most common
 *     noun phrase.
 *   - Otherwise, take the newest commit's subject and prefix with [N commits]
 *     to signal a multi-commit PR.
 */
export function inferTitle(commits: CommitSummary[], sourceBranch?: string): string {
  if (commits.length === 0) {
    return sourceBranch ? `Changes on ${sourceBranch}` : "Proposed changes";
  }
  if (commits.length === 1) {
    return truncate(commits[0]!.subject.trim(), 72);
  }
  // Check shared conventional-commit prefix
  const prefixes = commits.map((c) => extractConventionalPrefix(c.subject));
  const firstPrefix = prefixes[0];
  const allSame = firstPrefix && prefixes.every((p) => p === firstPrefix);
  if (allSame) {
    return truncate(`${firstPrefix}: ${commits[0]!.subject.replace(/^[^:]+:\s*/, "")}`, 72);
  }
  return truncate(commits[0]!.subject, 62) + ` (+${commits.length - 1} more)`;
}

function extractConventionalPrefix(subject: string): string | null {
  const m = /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci|revert)(\([^)]+\))?:/.exec(
    subject,
  );
  return m ? m[1]! : null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ─── Summary bullets ─────────────────────────────────────────────────

/**
 * Extract summary bullet points from the commit body + subjects.
 * Heuristic: use the commit subjects as bullets, deduplicating near-
 * duplicates, and include any lines that start with `- ` or `* ` from
 * the commit bodies (those are typically already manual bullets).
 */
export function extractSummaryBullets(commits: CommitSummary[]): string[] {
  const bullets: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const clean = line.trim().replace(/^[-*]\s*/, "");
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    bullets.push(clean);
  };

  for (const commit of commits) {
    push(commit.subject);
    if (commit.body) {
      for (const line of commit.body.split(/\r?\n/)) {
        if (/^[-*]\s/.test(line.trim())) {
          push(line);
        }
      }
    }
  }

  return bullets.slice(0, 20);
}

// ─── Test plan synthesis ─────────────────────────────────────────────

/**
 * Produce test plan checklist items based on the changed files. Each
 * item is a concrete, verifiable check. Returns between 2 and 8 items.
 */
export function synthesizeTestPlan(changedFiles: ChangedFile[]): string[] {
  const plan: string[] = [];
  const categories = new Set(changedFiles.map((f) => categorizeFile(f.path)));

  if (categories.has("frontend")) {
    plan.push("Visit the affected pages in a dev browser and verify the UI renders cleanly");
  }
  if (categories.has("backend")) {
    plan.push("Exercise the touched tRPC procedures (happy path + one error path)");
  }
  if (categories.has("tests")) {
    plan.push("Run `npm test` and confirm the new/updated test files pass");
  }
  if (categories.has("schema")) {
    plan.push("Run `npm run db:push` and verify the migration applies cleanly");
  }
  if (categories.has("config") || categories.has("build")) {
    plan.push("Run `npm run check` and `npm run build` end-to-end");
  }
  if (categories.has("docs")) {
    plan.push("Proofread the updated markdown sections");
  }

  if (plan.length === 0) {
    plan.push("Manual smoke test of the affected surface area");
  }
  // Always include a typecheck guard as the final line
  plan.push("`npm run check` passes with zero new TS errors");
  return plan.slice(0, 8);
}

// ─── Assemble the full draft ─────────────────────────────────────────

export function draftPullRequest(input: PullRequestDraftInput): PullRequestDraft {
  const title = inferTitle(input.commits, input.sourceBranch);
  const summary = extractSummaryBullets(input.commits);
  const testPlan = synthesizeTestPlan(input.changedFiles);

  const fileMap: FileMapEntry[] = input.changedFiles.map((f) => ({
    category: categorizeFile(f.path),
    path: f.path,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  }));
  // Sort by canonical category order then path
  fileMap.sort((a, b) => {
    const ai = CATEGORY_ORDER_INDEX[a.category] ?? 99;
    const bi = CATEGORY_ORDER_INDEX[b.category] ?? 99;
    if (ai !== bi) return ai - bi;
    return a.path.localeCompare(b.path);
  });

  const additions = input.changedFiles.reduce((acc, f) => acc + f.additions, 0);
  const deletions = input.changedFiles.reduce((acc, f) => acc + f.deletions, 0);

  const body = renderBody({
    title,
    summary,
    testPlan,
    fileMap,
    additions,
    deletions,
    sourceBranch: input.sourceBranch,
    targetBranch: input.targetBranch,
    commitCount: input.commits.length,
  });

  return {
    title,
    body,
    summary,
    testPlan,
    fileMap,
    stats: {
      filesChanged: input.changedFiles.length,
      additions,
      deletions,
      commitCount: input.commits.length,
    },
  };
}

// ─── Body renderer ───────────────────────────────────────────────────

export function renderBody(opts: {
  title: string;
  summary: string[];
  testPlan: string[];
  fileMap: FileMapEntry[];
  additions: number;
  deletions: number;
  sourceBranch: string;
  targetBranch: string;
  commitCount: number;
}): string {
  const lines: string[] = [];
  lines.push("## Summary");
  if (opts.summary.length === 0) {
    lines.push("_No commit subjects found — please describe the change._");
  } else {
    for (const bullet of opts.summary) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push("");

  lines.push("## Test plan");
  for (const step of opts.testPlan) {
    lines.push(`- [ ] ${step}`);
  }
  lines.push("");

  // File map grouped by category
  if (opts.fileMap.length > 0) {
    lines.push("## Files changed");
    lines.push(
      `\`${opts.sourceBranch}\` → \`${opts.targetBranch}\` · ${opts.fileMap.length} files · +${opts.additions} / −${opts.deletions} · ${opts.commitCount} commit${opts.commitCount === 1 ? "" : "s"}`,
    );
    lines.push("");
    const categoryOrder: FileCategory[] = [
      "frontend",
      "backend",
      "tests",
      "schema",
      "docs",
      "config",
      "build",
      "scripts",
      "other",
    ];
    const grouped = new Map<FileCategory, FileMapEntry[]>();
    for (const entry of opts.fileMap) {
      const list = grouped.get(entry.category) ?? [];
      list.push(entry);
      grouped.set(entry.category, list);
    }
    for (const cat of categoryOrder) {
      const entries = grouped.get(cat);
      if (!entries || entries.length === 0) continue;
      lines.push(`**${cat}** (${entries.length})`);
      for (const e of entries.slice(0, 20)) {
        lines.push(`- \`${e.path}\` ${e.status} +${e.additions}/−${e.deletions}`);
      }
      if (entries.length > 20) {
        lines.push(`- _…${entries.length - 20} more_`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}
