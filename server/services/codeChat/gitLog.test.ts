import { describe, it, expect } from "vitest";
import {
  parseGitLog,
  parseNumstat,
  mergeCommitStats,
  computeLogStats,
  groupCommitsByDay,
  filterCommits,
  type GitCommit,
} from "./gitLog";

const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

function mkRecord(parts: string[]): string {
  return parts.join(FIELD_SEP) + RECORD_SEP;
}

describe("gitLog — parseGitLog", () => {
  it("parses a single 5-field commit record", () => {
    const raw = mkRecord([
      "abc1234567890abcdef",
      "Alice",
      String(Math.floor(new Date("2026-04-01T12:00:00Z").getTime() / 1000)),
      "feat: add feature",
      "body line",
    ]);
    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.shortSha).toBe("abc1234");
    expect(commits[0]!.author).toBe("Alice");
    expect(commits[0]!.subject).toBe("feat: add feature");
    expect(commits[0]!.body).toBe("body line");
    expect(commits[0]!.date.slice(0, 10)).toBe("2026-04-01");
  });

  it("parses the 6-field shape with email", () => {
    const raw = mkRecord([
      "def1234567890abcdef",
      "Bob",
      "bob@example.com",
      String(Math.floor(new Date("2026-04-02T00:00:00Z").getTime() / 1000)),
      "fix: bug",
      "details here",
    ]);
    const commits = parseGitLog(raw);
    expect(commits[0]!.email).toBe("bob@example.com");
    expect(commits[0]!.subject).toBe("fix: bug");
  });

  it("handles multiple records", () => {
    const raw =
      mkRecord(["aaa1234", "A", "1700000000", "one", ""]) +
      mkRecord(["bbb1234", "B", "1700000001", "two", ""]);
    expect(parseGitLog(raw)).toHaveLength(2);
  });

  it("skips corrupt records silently", () => {
    const raw =
      mkRecord(["", "", "", "", ""]) +
      mkRecord(["good1234", "A", "1700000000", "subject", ""]);
    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.subject).toBe("subject");
  });

  it("returns empty on empty input", () => {
    expect(parseGitLog("")).toHaveLength(0);
  });

  it("handles multi-line bodies", () => {
    const raw = mkRecord([
      "ccc1234",
      "C",
      "1700000000",
      "feat",
      "line one\nline two\nline three",
    ]);
    expect(parseGitLog(raw)[0]!.body).toContain("line two");
  });
});

describe("gitLog — parseNumstat", () => {
  it("parses a single commit numstat block", () => {
    const raw = `commit:abc1234
10\t5\tpath/a.ts
3\t0\tpath/b.ts`;
    const stats = parseNumstat(raw);
    const entry = stats.get("abc1234");
    expect(entry).toBeDefined();
    expect(entry!.filesChanged).toBe(2);
    expect(entry!.additions).toBe(13);
    expect(entry!.deletions).toBe(5);
  });

  it("handles multiple commits", () => {
    const raw = `commit:aaa
5\t2\ta.ts
commit:bbb
1\t1\tb.ts
2\t0\tc.ts`;
    const stats = parseNumstat(raw);
    expect(stats.get("aaa")!.filesChanged).toBe(1);
    expect(stats.get("bbb")!.filesChanged).toBe(2);
  });

  it("handles binary file entries (-\\t-\\t)", () => {
    const raw = `commit:aaa
-\t-\tbinary.png
10\t0\ttext.ts`;
    const stats = parseNumstat(raw);
    const entry = stats.get("aaa")!;
    expect(entry.additions).toBe(10);
    expect(entry.filesChanged).toBe(2);
  });

  it("returns empty map on empty input", () => {
    expect(parseNumstat("").size).toBe(0);
  });
});

describe("gitLog — mergeCommitStats", () => {
  it("attaches stats to matching commits", () => {
    const commits: GitCommit[] = [
      {
        sha: "abc1234",
        shortSha: "abc1234",
        author: "A",
        timestamp: 0,
        date: "2026-01-01T00:00:00Z",
        subject: "x",
      },
    ];
    const stats = new Map([
      ["abc1234", { filesChanged: 2, additions: 10, deletions: 5 }],
    ]);
    const merged = mergeCommitStats(commits, stats);
    expect(merged[0]!.stats!.filesChanged).toBe(2);
  });

  it("leaves commits without stats untouched", () => {
    const commits: GitCommit[] = [
      {
        sha: "nostats",
        shortSha: "nostats",
        author: "A",
        timestamp: 0,
        date: "2026-01-01T00:00:00Z",
        subject: "x",
      },
    ];
    const merged = mergeCommitStats(commits, new Map());
    expect(merged[0]!.stats).toBeUndefined();
  });
});

describe("gitLog — computeLogStats", () => {
  const commits: GitCommit[] = [
    {
      sha: "a",
      shortSha: "a",
      author: "Alice",
      timestamp: 0,
      date: "2026-04-01T00:00:00Z",
      subject: "x",
      stats: { filesChanged: 1, additions: 10, deletions: 2 },
    },
    {
      sha: "b",
      shortSha: "b",
      author: "Alice",
      timestamp: 0,
      date: "2026-04-01T00:00:00Z",
      subject: "y",
    },
    {
      sha: "c",
      shortSha: "c",
      author: "Bob",
      timestamp: 0,
      date: "2026-04-02T00:00:00Z",
      subject: "z",
      stats: { filesChanged: 2, additions: 5, deletions: 5 },
    },
  ];

  it("counts total and authors", () => {
    const stats = computeLogStats(commits);
    expect(stats.total).toBe(3);
    expect(stats.authors[0]!.author).toBe("Alice");
    expect(stats.authors[0]!.count).toBe(2);
  });

  it("aggregates per-day counts in descending date order", () => {
    const stats = computeLogStats(commits);
    expect(stats.perDay[0]!.date).toBe("2026-04-02");
    expect(stats.perDay[0]!.count).toBe(1);
    expect(stats.perDay[1]!.date).toBe("2026-04-01");
    expect(stats.perDay[1]!.count).toBe(2);
  });

  it("sums additions/deletions from attached stats", () => {
    const stats = computeLogStats(commits);
    expect(stats.totalAdditions).toBe(15);
    expect(stats.totalDeletions).toBe(7);
  });
});

describe("gitLog — groupCommitsByDay", () => {
  const commits: GitCommit[] = [
    { sha: "a", shortSha: "a", author: "A", timestamp: 100, date: "2026-04-01T10:00:00Z", subject: "one" },
    { sha: "b", shortSha: "b", author: "A", timestamp: 200, date: "2026-04-01T20:00:00Z", subject: "two" },
    { sha: "c", shortSha: "c", author: "A", timestamp: 50, date: "2026-04-02T00:00:00Z", subject: "three" },
  ];

  it("buckets by date descending", () => {
    const grouped = groupCommitsByDay(commits);
    expect(grouped[0]!.date).toBe("2026-04-02");
    expect(grouped[1]!.date).toBe("2026-04-01");
  });

  it("sorts within each day by timestamp descending", () => {
    const grouped = groupCommitsByDay(commits);
    const apr1 = grouped.find((g) => g.date === "2026-04-01")!;
    expect(apr1.commits[0]!.subject).toBe("two");
    expect(apr1.commits[1]!.subject).toBe("one");
  });
});

describe("gitLog — filterCommits", () => {
  const commits: GitCommit[] = [
    { sha: "a", shortSha: "a", author: "Alice", timestamp: 0, date: "2026-04-01T00:00:00Z", subject: "fix auth bug" },
    { sha: "b", shortSha: "b", author: "Bob", timestamp: 0, date: "2026-04-02T00:00:00Z", subject: "add feature" },
  ];

  it("filters by author", () => {
    expect(filterCommits(commits, { author: "alice" })).toHaveLength(1);
  });

  it("filters by subject search", () => {
    expect(filterCommits(commits, { search: "feature" })).toHaveLength(1);
    expect(filterCommits(commits, { search: "auth" })).toHaveLength(1);
  });

  it("filters by sinceIso", () => {
    const out = filterCommits(commits, { sinceIso: "2026-04-02T00:00:00Z" });
    expect(out).toHaveLength(1);
    expect(out[0]!.author).toBe("Bob");
  });

  it("composes filters", () => {
    const out = filterCommits(commits, {
      search: "feature",
      sinceIso: "2026-04-01T00:00:00Z",
    });
    expect(out).toHaveLength(1);
  });
});
