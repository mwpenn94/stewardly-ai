/**
 * Pass 78 — Final Data Wiring & HonestPlaceholder Elimination
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PAGES = path.resolve(__dirname, "../client/src/pages");

function readFile(p: string) {
  return fs.readFileSync(p, "utf-8");
}

function findAllTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findAllTsx(full));
    else if (entry.name.endsWith(".tsx")) results.push(full);
  }
  return results;
}

describe("Pass 78 — ClientOnboarding real data wiring", () => {
  const src = readFile(path.join(PAGES, "ClientOnboarding.tsx"));

  it("uses financialProfile.set mutation", () => {
    expect(src).toContain("financialProfile.set.useMutation");
  });

  it("sends patch with income and netWorth", () => {
    expect(src).toContain("patch.income");
    expect(src).toContain("patch.netWorth");
  });

  it("no longer has fake setTimeout submit", () => {
    expect(src).not.toContain("await new Promise(resolve => setTimeout");
  });
});

describe("Pass 78 — APIKeys rewritten with real data", () => {
  const src = readFile(path.join(PAGES, "APIKeys.tsx"));

  it("uses webhooks.list query", () => {
    expect(src).toContain("webhooks.list.useQuery");
  });

  it("uses dynamicIntegrations.listBlueprints query", () => {
    expect(src).toContain("dynamicIntegrations.listBlueprints.useQuery");
  });

  it("no longer imports HonestPlaceholder", () => {
    expect(src).not.toContain("HonestPlaceholder");
  });

  it("no longer has hardcoded API_KEYS", () => {
    expect(src).not.toContain("const API_KEYS");
  });
});

describe("Pass 78 — Zero HonestPlaceholder pages", () => {
  it("no page imports HonestPlaceholder", () => {
    const allPages = findAllTsx(PAGES);
    const bad = allPages.filter(f => {
      const c = fs.readFileSync(f, "utf-8");
      return c.includes("HonestPlaceholder") && c.includes("import");
    });
    expect(bad).toEqual([]);
  });

  it("no page has DEMO_ constants without trpc queries", () => {
    const allPages = findAllTsx(PAGES);
    const bad = allPages.filter(f => {
      const c = fs.readFileSync(f, "utf-8");
      return /const (DEMO_|MOCK_|FAKE_)/.test(c) && !c.includes("trpc.");
    });
    expect(bad).toEqual([]);
  });
});
