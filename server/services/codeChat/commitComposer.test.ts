/**
 * Tests for commit composer — Pass 262.
 */

import { describe, it, expect } from "vitest";
import {
  parseDiffStats,
  composeSubject,
  composeBody,
  composeMessage,
  detectScope,
} from "./commitComposer";

describe("parseDiffStats", () => {
  it("returns zeros for empty input", () => {
    const stats = parseDiffStats("");
    expect(stats.filesChanged).toBe(0);
  });

  it("parses a single modified file", () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
-const z = 3;
`;
    const stats = parseDiffStats(diff);
    expect(stats.filesChanged).toBe(1);
    expect(stats.insertions).toBe(1);
    expect(stats.deletions).toBe(1);
    expect(stats.filesByStatus.modified).toEqual(["src/a.ts"]);
  });

  it("detects added files", () => {
    const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`;
    const stats = parseDiffStats(diff);
    expect(stats.filesByStatus.added).toEqual(["src/new.ts"]);
    expect(stats.insertions).toBe(2);
  });

  it("detects deleted files", () => {
    const diff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1111111..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const a = 1;
-const b = 2;
`;
    const stats = parseDiffStats(diff);
    expect(stats.filesByStatus.deleted).toEqual(["old.ts"]);
    expect(stats.deletions).toBe(2);
  });

  it("detects renamed files", () => {
    const diff = `diff --git a/old.ts b/new.ts
similarity index 100%
rename from old.ts
rename to new.ts
`;
    const stats = parseDiffStats(diff);
    expect(stats.filesByStatus.renamed).toEqual([{ from: "old.ts", to: "new.ts" }]);
  });

  it("handles multiple files", () => {
    const diff = `diff --git a/a.ts b/a.ts
index 11..22 100644
--- a/a.ts
+++ b/a.ts
@@ -1 +1,2 @@
+x
diff --git a/b.ts b/b.ts
new file mode 100644
index 00..11
--- /dev/null
+++ b/b.ts
@@ -0,0 +1 @@
+y
`;
    const stats = parseDiffStats(diff);
    expect(stats.filesChanged).toBe(2);
    expect(stats.filesByStatus.modified).toEqual(["a.ts"]);
    expect(stats.filesByStatus.added).toEqual(["b.ts"]);
  });

  it("ignores +++ / --- headers", () => {
    const diff = `diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1 +1,2 @@
+new line
`;
    const stats = parseDiffStats(diff);
    expect(stats.insertions).toBe(1);
    expect(stats.deletions).toBe(0);
  });
});

describe("detectScope", () => {
  it("finds the deepest shared directory", () => {
    const stats = {
      filesChanged: 2,
      insertions: 0,
      deletions: 0,
      filesByStatus: {
        added: [],
        modified: ["server/services/codeChat/a.ts", "server/services/codeChat/b.ts"],
        deleted: [],
        renamed: [],
      },
    };
    expect(detectScope(stats)).toBe("codeChat");
  });

  it("returns empty when files share no directory", () => {
    const stats = {
      filesChanged: 2,
      insertions: 0,
      deletions: 0,
      filesByStatus: {
        added: [],
        modified: ["a.ts", "b.ts"],
        deleted: [],
        renamed: [],
      },
    };
    expect(detectScope(stats)).toBe("");
  });

  it("returns empty when diverges on first segment", () => {
    const stats = {
      filesChanged: 2,
      insertions: 0,
      deletions: 0,
      filesByStatus: {
        added: [],
        modified: ["server/a.ts", "client/b.ts"],
        deleted: [],
        renamed: [],
      },
    };
    expect(detectScope(stats)).toBe("");
  });
});

describe("composeSubject", () => {
  it("uses feat for additions-only", () => {
    const stats = parseDiffStats(
      `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1 @@
+x
`,
    );
    expect(composeSubject(stats)).toMatch(/^feat/);
  });

  it("uses docs for md-only changes", () => {
    const stats = parseDiffStats(
      `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
+new
`,
    );
    expect(composeSubject(stats)).toMatch(/^docs/);
  });

  it("uses test for *.test.ts-only changes", () => {
    const stats = parseDiffStats(
      `diff --git a/foo.test.ts b/foo.test.ts
--- a/foo.test.ts
+++ b/foo.test.ts
@@ -1 +1,2 @@
+new
`,
    );
    expect(composeSubject(stats)).toMatch(/^test/);
  });

  it("includes scope when files share a directory", () => {
    const stats = parseDiffStats(
      `diff --git a/server/services/codeChat/a.ts b/server/services/codeChat/a.ts
--- a/server/services/codeChat/a.ts
+++ b/server/services/codeChat/a.ts
@@ -1 +1,2 @@
+x
`,
    );
    expect(composeSubject(stats)).toContain("(codeChat)");
  });

  it("returns 'no staged changes' for empty diff", () => {
    const stats = parseDiffStats("");
    expect(composeSubject(stats)).toBe("chore: no staged changes");
  });
});

describe("composeBody", () => {
  it("includes file counts and insertion/deletion", () => {
    const stats = parseDiffStats(
      `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1,2 @@
+x
`,
    );
    const body = composeBody(stats);
    expect(body[0]).toContain("1 file changed");
    expect(body[0]).toContain("1 insertion");
  });

  it("caps file lists at 10", () => {
    const files = Array.from({ length: 15 }, (_, i) => `f${i}.ts`);
    const diff = files
      .map(
        (f) =>
          `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}\n@@ -0,0 +1 @@\n+x\n`,
      )
      .join("");
    const stats = parseDiffStats(diff);
    const body = composeBody(stats);
    const addedLines = body.filter((l) => l.startsWith("  - "));
    expect(addedLines).toHaveLength(10);
    expect(body.some((l) => l.includes("and 5 more"))).toBe(true);
  });
});

describe("composeMessage", () => {
  it("returns subject + body", () => {
    const stats = parseDiffStats(
      `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1,2 @@
+x
`,
    );
    const msg = composeMessage(stats);
    expect(msg.subject).toBeTruthy();
    expect(msg.body.length).toBeGreaterThan(0);
  });
});
