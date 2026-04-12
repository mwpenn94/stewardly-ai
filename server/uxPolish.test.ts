/**
 * UX Polish Tests — What's New modal, route prefetch, SectionErrorBoundary enhancements
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── What's New Changelog Modal ─────────────────────────────────────────────

describe("What's New Changelog Modal", () => {
  it("should have changelog entries with required fields", async () => {
    // Read the WhatsNewModal source to verify structure
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Must have a CHANGELOG array
    expect(source).toContain("CHANGELOG");

    // Each entry should have version, date, and entries
    expect(source).toContain("version:");
    expect(source).toContain("date:");
    expect(source).toContain("entries:");
  });

  it("should export CURRENT_VERSION for changelog tracking", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Data-only export — no modal UI, just changelog data
    expect(source).toContain("export const CURRENT_VERSION");
    expect(source).toContain("export const CHANGELOG");
    expect(source).toContain("export const CATEGORY_STYLES");
  });

  it("should not render a modal popup (moved to notifications)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/WhatsNewModal.tsx", "utf-8");

    // Modal UI has been removed — no Dialog, no localStorage, no setTimeout
    expect(source).not.toContain("export default function");
    expect(source).not.toContain("<Dialog");
  });

  it("should not be mounted in App.tsx (popup removed)", async () => {
    const fs = await import("fs");
    const appSource = fs.readFileSync("client/src/App.tsx", "utf-8");

    // WhatsNewModal is no longer rendered as a popup in App.tsx
    expect(appSource).not.toContain("WhatsNewModal");
  });
});

// ─── Route Prefetch on Hover ────────────────────────────────────────────────

describe("Route Prefetch on Hover", () => {
  it("should export prefetchRoute function", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");

    expect(source).toContain("export function prefetchRoute");
  });

  it("should have a route-to-import mapping", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");

    // Must map routes to dynamic imports
    expect(source).toContain("ROUTE_PREFETCH_MAP");
    expect(source).toContain("/operations");
    expect(source).toContain("/integrations");
    expect(source).toContain("/market-data");
    expect(source).toContain("/help");
    expect(source).toContain("/settings/profile");
  });

  it("should deduplicate prefetch calls", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");

    // Must track already-prefetched routes
    expect(source).toContain("prefetched");
    expect(source).toMatch(/\.has\(|Set/);
  });

  it("should handle prefetch failures gracefully", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");

    // Must catch errors and allow retry
    expect(source).toContain(".catch");
    expect(source).toContain("delete");
  });

  it("should be wired into Chat sidebar navigation", async () => {
    // Pass 9 removed the old sidebar code from AppShell (G56 — dead code
    // purge). PersonaSidebar5 is the real sidebar. prefetchRoute is consumed
    // by Chat.tsx sidebar nav items.
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/pages/Chat.tsx", "utf-8");

    expect(source).toContain("prefetchRoute");
  });

  it("should also export usePrefetchProps hook", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");

    expect(source).toContain("export function usePrefetchProps");
  });
});

// ─── Enhanced SectionErrorBoundary ──────────────────────────────────────────

describe("Enhanced SectionErrorBoundary with Query Invalidation", () => {
  it("should accept an onRetry callback prop", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    expect(source).toContain("onRetry");
    expect(source).toMatch(/onRetry\??\s*:\s*\(\)/);
  });

  it("should call onRetry before resetting error state", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    // onRetry should be called in handleRetry before setState
    const handleRetryMatch = source.match(/handleRetry[\s\S]*?setState/);
    expect(handleRetryMatch).toBeTruthy();

    // onRetry should appear before setState in the handler
    const onRetryIdx = source.indexOf("this.props.onRetry");
    const setStateIdx = source.indexOf("this.setState", onRetryIdx);
    expect(onRetryIdx).toBeLessThan(setStateIdx);
  });

  it("should track retry count", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    expect(source).toContain("retryCount");
  });

  it("should have a max retry limit of 3", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    // Should cap retries at 3
    expect(source).toMatch(/retryCount\s*>=\s*3|maxRetries.*3/);
  });

  it("should show 'Refresh page' button after max retries", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    expect(source).toContain("Refresh page");
    expect(source).toContain("window.location.reload");
  });

  it("should be wired with onRetry in Integrations page", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/pages/Integrations.tsx", "utf-8");

    // Each SectionErrorBoundary should have onRetry
    expect(source).toContain("onRetry={() => {");

    // Should invalidate specific queries
    expect(source).toContain("utils.integrations.listProviders.invalidate()");
    expect(source).toContain("utils.integrations.listConnections.invalidate()");
    expect(source).toContain("utils.integrations.snapTradeStatus.invalidate()");
    expect(source).toContain("utils.verification.getLatestRates.invalidate()");
    expect(source).toContain("utils.operations.crm.stats.invalidate()");
  });

  it("should safely handle onRetry callback errors", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/components/SectionErrorBoundary.tsx", "utf-8");

    // Should wrap onRetry in try/catch
    expect(source).toContain("try");
    expect(source).toContain("catch");
    expect(source).toContain("onRetry callback threw");
  });
});

// ─── Integration: All three features coexist ────────────────────────────────

describe("Feature Integration", () => {
  it("should have all three features in App.tsx", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("client/src/App.tsx", "utf-8");

    // WhatsNew modal removed — changelog data is now in WhatsNewModal.tsx as data-only export
    // Surfaced through ChangelogBell and /changelog page instead of a popup

    // Suspense with lazy loading (enables prefetch)
    expect(source).toContain("Suspense");
    expect(source).toContain("lazy");

    // OfflineBanner (from previous iteration)
    expect(source).toContain("OfflineBanner");
  });

  it("should have prefetch map covering all lazy-loaded routes", async () => {
    const fs = await import("fs");
    const prefetchSource = fs.readFileSync("client/src/lib/routePrefetch.ts", "utf-8");
    const appSource = fs.readFileSync("client/src/App.tsx", "utf-8");

    // Extract lazy-loaded page names from App.tsx
    const lazyMatches = appSource.matchAll(/lazy\(\(\)\s*=>\s*import\("\.\/pages\/(\w+)"\)/g);
    const lazyPages = [...lazyMatches].map(m => m[1]);

    // Should have at least 10 lazy-loaded pages
    expect(lazyPages.length).toBeGreaterThanOrEqual(10);

    // Prefetch map should cover key routes
    const keyRoutes = ["/operations", "/integrations", "/market-data", "/help"];
    for (const route of keyRoutes) {
      expect(prefetchSource).toContain(`"${route}"`);
    }
  });
});
