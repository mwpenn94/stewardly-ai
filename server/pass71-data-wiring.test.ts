/**
 * Pass 71 — Data Wiring & Accessibility Tests
 *
 * Validates:
 * 1. UnifiedAI aria-live attributes on streaming areas
 * 2. UnifiedAI focus management on mode switch
 * 3. TeamManagement wired to organizations tRPC
 * 4. AdminLeadSources wired to leadPipeline.sourcePerformance
 * 5. ClientDashboard wired to financialProfile.get
 * 6. HonestPlaceholder removed from wired pages
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf-8");

describe("Pass 71 — UnifiedAI Accessibility", () => {
  const src = read("client/src/pages/UnifiedAI.tsx");

  it("chat messages area has aria-live='polite'", () => {
    expect(src).toContain('aria-live="polite"');
  });

  it("chat messages area has aria-relevant='additions'", () => {
    expect(src).toContain('aria-relevant="additions"');
  });

  it("Ctrl+1 focuses chat textarea after mode switch", () => {
    expect(src).toContain("Chat mode") ;
    expect(src).toMatch(/setMode\("chat"\).*focus/);
  });

  it("Ctrl+2 focuses dev input after mode switch", () => {
    expect(src).toMatch(/setMode\("dev"\).*focus/);
  });
});

describe("Pass 71 — TeamManagement Data Wiring", () => {
  const src = read("client/src/pages/TeamManagement.tsx");

  it("imports trpc", () => {
    expect(src).toContain('import { trpc }');
  });

  it("uses organizations.list query", () => {
    expect(src).toContain("organizations.list.useQuery");
  });

  it("uses organizations.listMembers query", () => {
    expect(src).toContain("organizations.listMembers.useQuery");
  });

  it("uses organizations.inviteMember mutation", () => {
    expect(src).toContain("organizations.inviteMember.useMutation");
  });

  it("uses organizations.removeMember mutation", () => {
    expect(src).toContain("organizations.removeMember.useMutation");
  });

  it("does NOT import HonestPlaceholder", () => {
    expect(src).not.toContain("HonestPlaceholder");
  });

  it("has invite dialog with email input", () => {
    expect(src).toContain("invite-email");
    expect(src).toContain("Invite Team Member");
  });

  it("has empty state for no organization", () => {
    expect(src).toContain("No Organization");
  });

  it("has QueryErrorBanner for error handling", () => {
    expect(src).toContain("QueryErrorBanner");
  });
});

describe("Pass 71 — AdminLeadSources Data Wiring", () => {
  const src = read("client/src/pages/AdminLeadSources.tsx");

  it("imports trpc", () => {
    expect(src).toContain('import { trpc }');
  });

  it("uses leadPipeline.sourcePerformance query", () => {
    expect(src).toContain("leadPipeline.sourcePerformance.useQuery");
  });

  it("does NOT import HonestPlaceholder", () => {
    expect(src).not.toContain("HonestPlaceholder");
  });

  it("does NOT use MOCK_SOURCES", () => {
    expect(src).not.toContain("MOCK_SOURCES");
  });

  it("has empty state when no data", () => {
    expect(src).toContain("No Source Performance Data");
  });

  it("has QueryErrorBanner for error handling", () => {
    expect(src).toContain("QueryErrorBanner");
  });
});

describe("Pass 71 — ClientDashboard Data Wiring", () => {
  const src = read("client/src/pages/ClientDashboard.tsx");

  it("imports trpc", () => {
    expect(src).toContain('import { trpc }');
  });

  it("uses financialProfile.get query", () => {
    expect(src).toContain("financialProfile.get.useQuery");
  });

  it("does NOT import HonestPlaceholder", () => {
    expect(src).not.toContain("HonestPlaceholder");
  });

  it("derives domain scores from profile data via useMemo", () => {
    expect(src).toContain("useMemo");
    expect(src).toContain("profile.data");
  });

  it("has navigation buttons to domain-specific pages", () => {
    expect(src).toContain("domain.href");
    expect(src).toContain("navigate(domain.href)");
  });

  it("has QueryErrorBanner for error handling", () => {
    expect(src).toContain("QueryErrorBanner");
  });

  it("has 9 planning domains", () => {
    const domainMatches = src.match(/id: "[a-z]+", label:/g);
    expect(domainMatches?.length).toBe(9);
  });
});
