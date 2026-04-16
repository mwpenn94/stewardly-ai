/**
 * Pass 72 — Command Center Depth Pass Tests
 *
 * Validates:
 * 1. CRM router has syncHistory + providers queries
 * 2. CRMSync page wired to real data (no mock arrays)
 * 3. CRMSync page has empty state for sync history
 * 4. CRMSync page derives provider cards from real data
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf-8");

describe("Pass 72 — CRM Router Enhancements", () => {
  const src = read("server/routers/serviceRouters.ts");

  it("has syncHistory query", () => {
    expect(src).toContain("syncHistory: adminProcedure.query");
  });

  it("syncHistory reads from crmSyncLog table", () => {
    expect(src).toContain("crmSyncLog");
    expect(src).toContain(".orderBy(desc(crmSyncLog.createdAt))");
  });

  it("has providers query", () => {
    expect(src).toContain("providers: adminProcedure.query");
  });

  it("providers aggregates by crmProvider", () => {
    expect(src).toContain(".groupBy(crmSyncLog.crmProvider)");
  });
});

describe("Pass 72 — CRMSync Page Data Wiring", () => {
  const src = read("client/src/pages/CRMSync.tsx");

  it("imports trpc", () => {
    expect(src).toContain('import { trpc }');
  });

  it("uses crm.syncHistory query", () => {
    expect(src).toContain("crm.syncHistory.useQuery");
  });

  it("uses crm.providers query", () => {
    expect(src).toContain("crm.providers.useQuery");
  });

  it("does NOT use SYNC_HISTORY mock array", () => {
    expect(src).not.toContain("SYNC_HISTORY");
  });

  it("has empty state for no sync history", () => {
    expect(src).toContain("No sync history yet");
  });

  it("derives provider cards from real data", () => {
    expect(src).toContain("providerMap");
    expect(src).toContain("providerRows");
  });

  it("invalidates queries after sync", () => {
    expect(src).toContain("utils.crm.syncHistory.invalidate");
    expect(src).toContain("utils.crm.providers.invalidate");
  });

  it("has QueryErrorBanner for error handling", () => {
    expect(src).toContain("QueryErrorBanner");
  });

  it("has loading state for history tab", () => {
    expect(src).toContain("syncHistory.isLoading");
  });
});

describe("Pass 72 — AdminLeadSources (from Pass 71, verify no regression)", () => {
  const src = read("client/src/pages/AdminLeadSources.tsx");

  it("still uses leadPipeline.sourcePerformance", () => {
    expect(src).toContain("leadPipeline.sourcePerformance.useQuery");
  });

  it("still has empty state", () => {
    expect(src).toContain("No Source Performance Data");
  });
});

describe("Pass 72 — ClientDashboard (from Pass 71, verify no regression)", () => {
  const src = read("client/src/pages/ClientDashboard.tsx");

  it("still uses financialProfile.get", () => {
    expect(src).toContain("financialProfile.get.useQuery");
  });

  it("still has 9 planning domains", () => {
    const domainMatches = src.match(/id: "[a-z]+", label:/g);
    expect(domainMatches?.length).toBe(9);
  });
});
