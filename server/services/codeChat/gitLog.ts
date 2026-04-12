/**
 * Git log parser (Pass 257).
 *
 * Claude Code has a commit history timeline that shows recent commits
 * with author, subject, body preview, and file delta. Stewardly's
 * Code Chat had `git status` and `git diff` panels but no history
 * view — users couldn't see "what changed last week".
 *
 * This module is the pure parser side. It takes the raw stdout of
 * `git log --format='%H%x1f%an%x1f%at%x1f%s%x1f%b%x1e'` and returns
 * a structured `GitCommit[]` array. The tRPC layer runs git.
 *
 * The `\x1e` record separator + `\x1f` field separator trick lets us
 * include multi-line commit bodies without worrying about
 * newline-based parsing. This matches the same trick used in Pass 253
 * prDrafter for consistency.
 */

export interface GitCommit {
  sha: string;
  shortSha: string;
  author: string;
  email?: string;
  /** Unix epoch seconds */
  timestamp: number;
  /** ISO8601 date — derived from `timestamp` for convenience */
  date: string;
  subject: string;
  body?: string;
  /** Optional file stat summary parsed from --numstat */
  stats?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

// ─── Parsers ──────────────────────────────────────────────────────────

const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

/**
 * Parse the output of
 *   git log --format="%H%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b%x1e"
 */
export function parseGitLog(raw: string): GitCommit[] {
  const out: GitCommit[] = [];
  if (!raw) return out;
  for (const record of raw.split(RECORD_SEP)) {
    const trimmed = record.replace(/^\n+/, "");
    if (!trimmed.trim()) continue;
    const parts = trimmed.split(FIELD_SEP);
    if (parts.length < 5) continue;
    const [sha, author, emailOrTs, tsOrSubject, subjectOrBody, body] = parts;
    // Handle both 5-field (sha/author/ts/subject/body) and 6-field
    // (sha/author/email/ts/subject/body) shapes. We detect the 6-field
    // variant by checking whether parts[2] looks like an email and
    // parts[3] is parseable as a timestamp.
    let resolvedEmail: string | undefined;
    let timestamp = 0;
    let subject = "";
    let resolvedBody: string | undefined;
    if (
      parts.length >= 6 &&
      emailOrTs &&
      /@/.test(emailOrTs) &&
      /^\d+$/.test(tsOrSubject ?? "")
    ) {
      resolvedEmail = emailOrTs;
      timestamp = Number.parseInt(tsOrSubject!, 10) || 0;
      subject = (subjectOrBody ?? "").trim();
      resolvedBody = (body ?? "").trim() || undefined;
    } else {
      timestamp = Number.parseInt(emailOrTs ?? "0", 10) || 0;
      subject = (tsOrSubject ?? "").trim();
      resolvedBody = (subjectOrBody ?? "").trim() || undefined;
    }
    if (!sha || !subject) continue;
    const epochMs = timestamp * 1000;
    out.push({
      sha: sha.slice(0, 40),
      shortSha: sha.slice(0, 7),
      author: author ?? "",
      email: resolvedEmail,
      timestamp,
      date: new Date(epochMs).toISOString(),
      subject,
      body: resolvedBody,
    });
  }
  return out;
}

/**
 * Parse the output of `git log --numstat --format="commit:%H"` where
 * each commit is introduced by a `commit:<sha>` line followed by
 * zero-or-more `adds\tdels\tpath` lines. Returns a map `{sha → stats}`.
 */
export function parseNumstat(raw: string): Map<
  string,
  { filesChanged: number; additions: number; deletions: number }
> {
  const out = new Map<
    string,
    { filesChanged: number; additions: number; deletions: number }
  >();
  if (!raw) return out;
  let currentSha: string | null = null;
  let additions = 0;
  let deletions = 0;
  let filesChanged = 0;
  const flush = () => {
    if (currentSha) {
      out.set(currentSha, { filesChanged, additions, deletions });
    }
    currentSha = null;
    additions = 0;
    deletions = 0;
    filesChanged = 0;
  };
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("commit:")) {
      flush();
      currentSha = line.slice(7).trim();
      continue;
    }
    if (!currentSha) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const a = parts[0] === "-" ? 0 : Number.parseInt(parts[0]!, 10) || 0;
    const d = parts[1] === "-" ? 0 : Number.parseInt(parts[1]!, 10) || 0;
    additions += a;
    deletions += d;
    filesChanged++;
  }
  flush();
  return out;
}

/**
 * Merge a commit list with a numstat map so each commit carries its
 * file delta stats. Pure so the caller can feed in either real git
 * output or test fixtures.
 */
export function mergeCommitStats(
  commits: GitCommit[],
  stats: Map<
    string,
    { filesChanged: number; additions: number; deletions: number }
  >,
): GitCommit[] {
  return commits.map((c) => {
    const s = stats.get(c.sha);
    if (!s) return c;
    return { ...c, stats: s };
  });
}

// ─── Stats + grouping ─────────────────────────────────────────────────

export interface GitLogStats {
  total: number;
  authors: Array<{ author: string; count: number }>;
  /** Commits per day (YYYY-MM-DD → count) in descending date order */
  perDay: Array<{ date: string; count: number }>;
  /** Total additions/deletions across commits with numstat attached */
  totalAdditions: number;
  totalDeletions: number;
}

export function computeLogStats(commits: GitCommit[]): GitLogStats {
  const authorCount = new Map<string, number>();
  const perDayMap = new Map<string, number>();
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const c of commits) {
    authorCount.set(c.author, (authorCount.get(c.author) ?? 0) + 1);
    const day = c.date.slice(0, 10);
    perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
    if (c.stats) {
      totalAdditions += c.stats.additions;
      totalDeletions += c.stats.deletions;
    }
  }
  const authors = Array.from(authorCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([author, count]) => ({ author, count }));
  const perDay = Array.from(perDayMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, count]) => ({ date, count }));
  return {
    total: commits.length,
    authors,
    perDay,
    totalAdditions,
    totalDeletions,
  };
}

/**
 * Group commits by calendar day for the timeline UI. Returns a map in
 * descending date order.
 */
export function groupCommitsByDay(commits: GitCommit[]): Array<{
  date: string;
  commits: GitCommit[];
}> {
  const byDay = new Map<string, GitCommit[]>();
  for (const c of commits) {
    const day = c.date.slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(c);
    byDay.set(day, bucket);
  }
  // Sort inside each day by timestamp descending
  for (const bucket of Array.from(byDay.values())) {
    bucket.sort((a, b) => b.timestamp - a.timestamp);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, commits]) => ({ date, commits }));
}

// ─── Filter ──────────────────────────────────────────────────────────

export interface CommitFilter {
  author?: string;
  search?: string;
  sinceIso?: string;
}

export function filterCommits(
  commits: GitCommit[],
  filter: CommitFilter,
): GitCommit[] {
  return commits.filter((c) => {
    if (filter.author && !c.author.toLowerCase().includes(filter.author.toLowerCase())) {
      return false;
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      const hay = `${c.subject} ${c.body ?? ""} ${c.shortSha}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (filter.sinceIso && c.date < filter.sinceIso) return false;
    return true;
  });
}
