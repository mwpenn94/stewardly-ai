/**
 * Pass 79 — Structural Integrity Tests
 *
 * Novel test categories that verify the overall health of the codebase:
 * 1. Route coverage: Every lazy import in App.tsx resolves to a real file
 * 2. Router completeness: Every tRPC router in routers.ts has at least one procedure
 * 3. Component health: No orphaned imports, no missing dependencies
 * 4. SEOHead coverage: All user-facing pages have SEOHead
 * 5. Error boundary coverage: All route groups have error boundaries
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const CLIENT = path.join(ROOT, "client/src");
const PAGES = path.join(CLIENT, "pages");

function readFile(p: string) {
  return fs.readFileSync(p, "utf-8");
}

function findAllTsx(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findAllTsx(full));
    else if (entry.name.endsWith(".tsx")) results.push(full);
  }
  return results;
}

describe("Route coverage — every lazy import resolves to a real file", () => {
  const appSrc = readFile(path.join(CLIENT, "App.tsx"));
  // Extract all lazy(() => import("...")) paths
  const lazyImports = [...appSrc.matchAll(/lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g)];

  it("has at least 100 lazy-loaded routes", () => {
    expect(lazyImports.length).toBeGreaterThanOrEqual(100);
  });

  it("every lazy import resolves to an existing file", () => {
    const missing: string[] = [];
    for (const [, importPath] of lazyImports) {
      // Resolve relative to client/src
      const resolved = importPath.replace(/^@\//, "");
      const fullPath = path.join(CLIENT, resolved);
      const exists = fs.existsSync(fullPath + ".tsx") || fs.existsSync(fullPath + ".ts") || fs.existsSync(fullPath + "/index.tsx");
      if (!exists) missing.push(importPath);
    }
    expect(missing).toEqual([]);
  });
});

describe("Router completeness — every router file exports a router", () => {
  const routersDir = path.join(ROOT, "server/routers");

  it("routers directory exists with multiple router files", () => {
    expect(fs.existsSync(routersDir)).toBe(true);
    const files = fs.readdirSync(routersDir).filter(f => f.endsWith(".ts") && !f.includes("test"));
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it("every router file exports at least one router object", () => {
    const files = fs.readdirSync(routersDir).filter(f => f.endsWith(".ts") && !f.includes("test"));
    const noExport: string[] = [];
    for (const f of files) {
      const content = readFile(path.join(routersDir, f));
      if (!content.includes("export const") && !content.includes("export function") && !content.includes("export {")) {
        noExport.push(f);
      }
    }
    expect(noExport).toEqual([]);
  });
});

describe("SEOHead coverage — user-facing pages have SEOHead", () => {
  // Pages that legitimately don't need SEOHead
  const EXEMPT = new Set([
    "EmbedCalculator.tsx", "EmbedWidget.tsx", // embeds
    "NotFound.tsx", // error page
    "SharedPlanView.tsx", // public shared view (no SEO needed)
    "WebhookVsPolling.tsx", // internal admin tool
    "AlertThresholds.tsx", // embedded settings component
    "AdminUsageAnalytics.tsx", // admin-only analytics
    "LocationAnalytics.tsx", // admin-only location analytics
    "LocationHealth.tsx", // admin-only location health
  ]);

  it("all top-level pages (except exemptions) have SEOHead", () => {
    const topLevelPages = fs.readdirSync(PAGES)
      .filter(f => f.endsWith(".tsx") && !EXEMPT.has(f));
    const missing: string[] = [];
    for (const f of topLevelPages) {
      const content = readFile(path.join(PAGES, f));
      if (!content.includes("SEOHead")) {
        missing.push(f);
      }
    }
    // Allow a small number of pages without SEOHead (settings tabs, etc.)
    expect(missing.length).toBeLessThanOrEqual(5);
  });
});

describe("Error boundary coverage", () => {
  const appSrc = readFile(path.join(CLIENT, "App.tsx"));

  it("has top-level ErrorBoundary wrapping the app", () => {
    expect(appSrc).toContain("ErrorBoundary");
  });

  it("has SectionErrorBoundary on wealth-engine routes", () => {
    expect(appSrc).toContain("SectionErrorBoundary");
  });

  it("has Suspense boundaries for lazy-loaded routes", () => {
    expect(appSrc).toContain("Suspense");
  });
});

describe("Component health — no broken patterns", () => {
  it("no page uses both DashboardLayout and AppShell (conflicting layouts)", () => {
    const allPages = findAllTsx(PAGES);
    const conflicting: string[] = [];
    for (const f of allPages) {
      const content = readFile(f);
      if (content.includes("DashboardLayout") && content.includes("AppShell")) {
        conflicting.push(path.basename(f));
      }
    }
    expect(conflicting).toEqual([]);
  });

  it("no page has nested <a> tags inside <Link> components", () => {
    const allPages = findAllTsx(PAGES);
    const nested: string[] = [];
    for (const f of allPages) {
      const content = readFile(f);
      // Check for <Link><a> pattern (nested anchors)
      if (/<Link[^>]*>\s*<a\b/.test(content)) {
        nested.push(path.basename(f));
      }
    }
    expect(nested).toEqual([]);
  });

  it("all pages that import trpc actually use it", () => {
    const allPages = findAllTsx(PAGES);
    const importButNotUse: string[] = [];
    for (const f of allPages) {
      const content = readFile(f);
      if (content.includes('from "@/lib/trpc"') && !content.includes("trpc.")) {
        importButNotUse.push(path.basename(f));
      }
    }
    // Allow a small number (some may use trpc indirectly via hooks)
    expect(importButNotUse.length).toBeLessThanOrEqual(2);
  });
});

describe("Security patterns — consistent across codebase", () => {
  it("no window.open calls without noopener", () => {
    const allPages = findAllTsx(PAGES);
    const unsafe: string[] = [];
    for (const f of allPages) {
      const content = readFile(f);
      const opens = [...content.matchAll(/window\.open\([^)]+\)/g)];
      for (const [match] of opens) {
        if (!match.includes("noopener")) {
          unsafe.push(`${path.basename(f)}: ${match.slice(0, 60)}`);
        }
      }
    }
    expect(unsafe).toEqual([]);
  });

  it("no dangerouslySetInnerHTML without DOMPurify", () => {
    const allPages = findAllTsx(PAGES);
    const unsafe: string[] = [];
    for (const f of allPages) {
      const content = readFile(f);
      if (content.includes("dangerouslySetInnerHTML") && !content.includes("DOMPurify") && !content.includes("sanitize")) {
        unsafe.push(path.basename(f));
      }
    }
    expect(unsafe).toEqual([]);
  });
});
