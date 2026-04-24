import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Verify that all frontend tRPC learning calls use the correct
 * nested router paths (learning.mastery.*, learning.content.*)
 * instead of the old flat paths (learning.dueReview, learning.dashboard, etc.)
 */
describe("Learning tRPC path correctness", () => {
  const clientDir = path.resolve(__dirname, "../client/src");

  function readFile(relPath: string): string {
    return fs.readFileSync(path.join(clientDir, relPath), "utf-8");
  }

  it("useNavBadges uses learning.mastery.dueReview (not learning.dueReview)", () => {
    const src = readFile("hooks/useNavBadges.ts");
    expect(src).toContain("learning.mastery.dueReview");
    expect(src).not.toMatch(/trpc\.learning\.dueReview\b[^.]/);
  });

  it("ClientDashboard uses learning.mastery.summary (not learning.dashboard)", () => {
    const src = readFile("pages/ClientDashboard.tsx");
    expect(src).toContain("learning.mastery.summary");
    expect(src).not.toMatch(/trpc\.learning\.dashboard\b/);
  });

  it("SovereignStudy uses learning.mastery.summary (not learning.getProgress)", () => {
    const src = readFile("pages/SovereignStudy.tsx");
    expect(src).toContain("learning.mastery.summary");
    expect(src).not.toMatch(/trpc\.learning\.getProgress\b/);
  });

  it("no frontend file uses the old flat learning.dueReview path", () => {
    const files = findTsxFiles(clientDir);
    for (const file of files) {
      const src = fs.readFileSync(file, "utf-8");
      // Allow the comment in useNavBadges that says "via learning.dueReview" as documentation
      if (file.includes("useNavBadges")) continue;
      const match = src.match(/trpc\.learning\.dueReview\b/);
      expect(match, `Found old path in ${path.relative(clientDir, file)}`).toBeNull();
    }
  });

  it("no frontend file uses the old flat learning.dashboard path", () => {
    const files = findTsxFiles(clientDir);
    for (const file of files) {
      const src = fs.readFileSync(file, "utf-8");
      const match = src.match(/trpc\.learning\.dashboard\b/);
      expect(match, `Found old path in ${path.relative(clientDir, file)}`).toBeNull();
    }
  });

  it("no frontend file uses the old flat learning.getProgress path", () => {
    const files = findTsxFiles(clientDir);
    for (const file of files) {
      const src = fs.readFileSync(file, "utf-8");
      const match = src.match(/trpc\.learning\.getProgress\b/);
      expect(match, `Found old path in ${path.relative(clientDir, file)}`).toBeNull();
    }
  });
});

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...findTsxFiles(full));
    } else if (entry.isFile() && /\.(tsx?|ts)$/.test(entry.name) && !entry.name.includes(".test.")) {
      results.push(full);
    }
  }
  return results;
}
