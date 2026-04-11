import { describe, it, expect } from "vitest";
import {
  categorizeFile,
  inferTitle,
  extractSummaryBullets,
  synthesizeTestPlan,
  draftPullRequest,
  renderBody,
  type CommitSummary,
  type ChangedFile,
} from "./prDrafter";

const commit = (over: Partial<CommitSummary> = {}): CommitSummary => ({
  sha: "abc123",
  subject: "fix: resolve nav bug",
  ...over,
});

const file = (over: Partial<ChangedFile> = {}): ChangedFile => ({
  path: "server/foo.ts",
  status: "M",
  additions: 10,
  deletions: 2,
  ...over,
});

describe("prDrafter — categorizeFile", () => {
  it("detects frontend files", () => {
    expect(categorizeFile("client/src/pages/Foo.tsx")).toBe("frontend");
    expect(categorizeFile("client/src/components/Bar.jsx")).toBe("frontend");
  });

  it("detects backend files", () => {
    expect(categorizeFile("server/routers/foo.ts")).toBe("backend");
  });

  it("detects tests", () => {
    expect(categorizeFile("server/services/foo.test.ts")).toBe("tests");
    expect(categorizeFile("src/__tests__/foo.ts")).toBe("tests");
    expect(categorizeFile("src/foo.spec.ts")).toBe("tests");
  });

  it("detects docs", () => {
    expect(categorizeFile("README.md")).toBe("docs");
    expect(categorizeFile("docs/guide.md")).toBe("docs");
  });

  it("detects schema", () => {
    expect(categorizeFile("drizzle/0012_new.sql")).toBe("schema");
    expect(categorizeFile("db/schema.ts")).toBe("schema");
  });

  it("detects config", () => {
    expect(categorizeFile("package.json")).toBe("config");
    expect(categorizeFile("tsconfig.json")).toBe("config");
    expect(categorizeFile("vite.config.ts")).toBe("config");
  });

  it("falls back to other for uncategorized", () => {
    expect(categorizeFile("somefile.xyz")).toBe("other");
  });
});

describe("prDrafter — inferTitle", () => {
  it("returns a placeholder when there are no commits", () => {
    expect(inferTitle([], "my-branch")).toBe("Changes on my-branch");
  });

  it("uses the single commit subject when there's exactly one", () => {
    const t = inferTitle([commit({ subject: "fix: one thing" })]);
    expect(t).toBe("fix: one thing");
  });

  it("truncates long titles at 72 chars", () => {
    const long = "x".repeat(100);
    const t = inferTitle([commit({ subject: long })]);
    expect(t.length).toBeLessThanOrEqual(72);
    expect(t.endsWith("…")).toBe(true);
  });

  it("reuses a shared conventional-commit prefix", () => {
    const t = inferTitle([
      commit({ subject: "feat: add A" }),
      commit({ subject: "feat: add B" }),
    ]);
    expect(t.startsWith("feat:")).toBe(true);
  });

  it("falls back to newest + count when prefixes differ", () => {
    const t = inferTitle([
      commit({ subject: "fix: bug" }),
      commit({ subject: "docs: update readme" }),
    ]);
    expect(t).toContain("(+1 more)");
  });
});

describe("prDrafter — extractSummaryBullets", () => {
  it("collects commit subjects, deduped", () => {
    const bullets = extractSummaryBullets([
      commit({ subject: "fix: A" }),
      commit({ subject: "fix: A" }), // dup
      commit({ subject: "feat: B" }),
    ]);
    expect(bullets).toEqual(["fix: A", "feat: B"]);
  });

  it("includes bulleted lines from commit bodies", () => {
    const bullets = extractSummaryBullets([
      commit({
        subject: "feat: big change",
        body: "- adds foo\n- fixes bar\nNot a bullet.\n* asterisk bullet",
      }),
    ]);
    expect(bullets).toContain("adds foo");
    expect(bullets).toContain("fixes bar");
    expect(bullets).toContain("asterisk bullet");
    expect(bullets).not.toContain("Not a bullet.");
  });

  it("caps at 20 bullets", () => {
    const commits = Array.from({ length: 50 }, (_, i) =>
      commit({ subject: `feat: item ${i}` }),
    );
    expect(extractSummaryBullets(commits).length).toBeLessThanOrEqual(20);
  });
});

describe("prDrafter — synthesizeTestPlan", () => {
  it("produces frontend + typecheck items when frontend files change", () => {
    const plan = synthesizeTestPlan([file({ path: "client/src/Foo.tsx" })]);
    expect(plan.some((s) => s.includes("browser"))).toBe(true);
    expect(plan.some((s) => s.includes("npm run check"))).toBe(true);
  });

  it("always includes the typecheck guard", () => {
    const plan = synthesizeTestPlan([file()]);
    expect(plan[plan.length - 1]).toContain("npm run check");
  });

  it("adds a migration item for schema changes", () => {
    const plan = synthesizeTestPlan([
      file({ path: "drizzle/0013_new.sql" }),
    ]);
    expect(plan.some((s) => s.includes("db:push"))).toBe(true);
  });

  it("falls back to smoke test for empty or other-only categories", () => {
    const plan = synthesizeTestPlan([file({ path: "somefile.xyz" })]);
    expect(plan.some((s) => s.toLowerCase().includes("smoke"))).toBe(true);
  });
});

describe("prDrafter — draftPullRequest", () => {
  it("assembles a full draft with title/summary/body/fileMap", () => {
    const draft = draftPullRequest({
      sourceBranch: "feature/x",
      targetBranch: "main",
      commits: [
        commit({ subject: "feat: add widget", body: "- does stuff" }),
      ],
      changedFiles: [
        file({ path: "client/src/Foo.tsx", additions: 30, deletions: 5 }),
        file({ path: "server/routers/foo.ts", additions: 10, deletions: 2 }),
      ],
    });
    expect(draft.title).toBe("feat: add widget");
    expect(draft.summary).toContain("feat: add widget");
    expect(draft.fileMap).toHaveLength(2);
    expect(draft.stats.filesChanged).toBe(2);
    expect(draft.stats.additions).toBe(40);
    expect(draft.stats.deletions).toBe(7);
    expect(draft.body).toContain("## Summary");
    expect(draft.body).toContain("## Test plan");
    expect(draft.body).toContain("## Files changed");
  });

  it("sorts the file map by category then path", () => {
    const draft = draftPullRequest({
      sourceBranch: "f",
      targetBranch: "main",
      commits: [commit()],
      changedFiles: [
        file({ path: "server/z.ts" }),
        file({ path: "client/src/a.tsx" }),
        file({ path: "client/src/b.tsx" }),
      ],
    });
    const paths = draft.fileMap.map((f) => f.path);
    // frontend sorts before backend
    expect(paths[0]).toContain("client/");
    expect(paths[1]).toContain("client/");
    expect(paths[2]).toContain("server/");
  });
});

describe("prDrafter — renderBody", () => {
  it("renders the standard PR template shape", () => {
    const body = renderBody({
      title: "t",
      summary: ["one", "two"],
      testPlan: ["do X", "do Y"],
      fileMap: [
        {
          category: "frontend",
          path: "client/src/a.tsx",
          status: "M",
          additions: 10,
          deletions: 0,
        },
      ],
      additions: 10,
      deletions: 0,
      sourceBranch: "feature/x",
      targetBranch: "main",
      commitCount: 2,
    });
    expect(body).toContain("## Summary");
    expect(body).toContain("- one");
    expect(body).toContain("- [ ] do X");
    expect(body).toContain("**frontend**");
    expect(body).toContain("`feature/x` → `main`");
  });

  it("handles an empty summary gracefully", () => {
    const body = renderBody({
      title: "t",
      summary: [],
      testPlan: ["test"],
      fileMap: [],
      additions: 0,
      deletions: 0,
      sourceBranch: "f",
      targetBranch: "main",
      commitCount: 0,
    });
    expect(body).toContain("No commit subjects found");
  });
});
