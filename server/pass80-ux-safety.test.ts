/**
 * Pass 80 — UX Safety & Structural Fixes
 *
 * 1. ConvItem: Two-step delete confirmation
 * 2. Calculators: confirm before scenario delete
 * 3. Nested anchor fixes in learning pages
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");

function read(rel: string) {
  return fs.readFileSync(path.join(CLIENT, rel), "utf-8");
}

describe("Pass 80 — ConvItem two-step delete", () => {
  const src = read("components/chat/ConvItem.tsx");

  it("has confirmDelete state for two-step deletion", () => {
    expect(src).toContain("confirmDelete");
    expect(src).toContain("setConfirmDelete");
  });

  it("shows 'Confirm delete?' text on second step", () => {
    expect(src).toContain("Confirm delete?");
  });

  it("resets confirmation on dropdown close", () => {
    expect(src).toContain("onOpenChange");
    expect(src).toContain("setConfirmDelete(false)");
  });

  it("has auto-reset timeout for confirmation", () => {
    expect(src).toContain("setTimeout");
    expect(src).toContain("3000");
  });
});

describe("Pass 80 — Calculators delete confirmation", () => {
  const src = read("pages/Calculators.tsx");

  it("uses window.confirm before deleting saved scenarios", () => {
    expect(src).toContain("window.confirm");
    expect(src).toContain("Delete this saved scenario");
  });
});

describe("Pass 80 — Nested anchor fixes in learning pages", () => {
  const LEARNING_PAGES = [
    "pages/learning/CaseStudySimulatorRoute.tsx",
    "pages/learning/LearningFlashcardStudy.tsx",
    "pages/learning/LearningQuizRunner.tsx",
    "pages/learning/LearningSearch.tsx",
    "pages/learning/LearningTrackDetail.tsx",
  ];

  for (const page of LEARNING_PAGES) {
    it(`${path.basename(page)} has no nested <a> inside <Link>`, () => {
      const src = read(page);
      // Check for <Link...>↵<a pattern
      expect(src).not.toMatch(/<Link[^>]*>\s*\n\s*<a\b/);
    });
  }
});
