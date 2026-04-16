/**
 * Pass 73 — Holistic Optimization Tests
 *
 * Validates:
 * 1. MyWork wired to real workflow + compliance data
 * 2. SEOHead added to OrgLanding and Unsubscribe
 * 3. UnifiedAI aria-live regions (from Pass 71)
 * 4. No regressions in prior pass improvements
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf-8");

describe("Pass 73 — MyWork Data Wiring", () => {
  const src = read("client/src/pages/MyWork.tsx");

  it("imports trpc", () => {
    expect(src).toContain('import { trpc }');
  });

  it("uses workflow.listAll query", () => {
    expect(src).toContain("workflow.listAll.useQuery");
  });

  it("uses compliance.getReviews query", () => {
    expect(src).toContain("compliance.getReviews.useQuery");
  });

  it("aggregates workflow items into WorkItem format", () => {
    expect(src).toContain("wf-${wf.id}");
  });

  it("aggregates compliance items into WorkItem format", () => {
    expect(src).toContain("cr-${cr.id}");
  });

  it("has loading state", () => {
    expect(src).toContain("isLoading");
    expect(src).toContain("Loader2");
  });

  it("has QueryErrorBanner for both queries", () => {
    expect(src).toContain("QueryErrorBanner");
  });

  it("has empty state when no items", () => {
    expect(src).toContain("All clear");
  });
});

describe("Pass 73 — SEOHead Coverage", () => {
  it("OrgLanding has SEOHead", () => {
    const src = read("client/src/pages/OrgLanding.tsx");
    expect(src).toContain("SEOHead");
  });

  it("Unsubscribe has SEOHead", () => {
    const src = read("client/src/pages/Unsubscribe.tsx");
    expect(src).toContain("SEOHead");
  });

  it("CRMSync has SEOHead", () => {
    const src = read("client/src/pages/CRMSync.tsx");
    expect(src).toContain("SEOHead");
  });
});

describe("Pass 73 — UnifiedAI Accessibility (from Pass 71)", () => {
  const src = read("client/src/pages/UnifiedAI.tsx");

  it("has aria-live on chat messages", () => {
    expect(src).toContain('aria-live="polite"');
  });
});

describe("Pass 73 — No Regressions", () => {
  it("Pass 70 AI Studio still has 3 modes", () => {
    const src = read("client/src/pages/UnifiedAI.tsx");
    expect(src).toContain("ChatPanel");
    expect(src).toContain("DevPanel");
    expect(src).toContain("AutoPanel");
  });

  it("Pass 71 TeamManagement still wired to organizations", () => {
    const src = read("client/src/pages/TeamManagement.tsx");
    expect(src).toContain("organizations.listMembers");
  });

  it("Pass 72 CRMSync still wired to syncHistory", () => {
    const src = read("client/src/pages/CRMSync.tsx");
    expect(src).toContain("crm.syncHistory.useQuery");
  });
});
