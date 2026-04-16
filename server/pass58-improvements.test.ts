/**
 * Pass 58 — Comprehensive improvements tests
 * - MarketTicker component
 * - RetryableQuery component
 * - Error tracking service
 * - System router logClientErrors
 * - DisclosureSection integration across pages
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 58 — MarketTicker component", () => {
  const src = readFileSync(join(ROOT, "client/src/components/MarketTicker.tsx"), "utf-8");

  it("exports MarketTicker component", () => {
    expect(src).toContain("export function MarketTicker");
  });

  it("uses trpc.market.getQuotes for live data", () => {
    expect(src).toContain("trpc.market.getQuotes.useQuery");
  });

  it("refreshes every 60 seconds", () => {
    expect(src).toContain("refetchInterval: 60_000");
  });

  it("respects disclosure level (hidden at level 1)", () => {
    expect(src).toContain("useDisclosure");
    expect(src).toContain("level < 2");
  });

  it("has proper ARIA for marquee", () => {
    expect(src).toContain("role=\"marquee\"");
    expect(src).toContain("aria-label=\"Market ticker\"");
  });

  it("uses CSS animation for smooth scroll", () => {
    expect(src).toContain("animate-ticker");
  });

  it("pauses on hover", () => {
    const css = readFileSync(join(ROOT, "client/src/index.css"), "utf-8");
    expect(css).toContain("animate-ticker:hover");
    expect(css).toContain("animation-play-state: paused");
  });

  it("is integrated into AppShell", () => {
    const appShell = readFileSync(join(ROOT, "client/src/components/AppShell.tsx"), "utf-8");
    expect(appShell).toContain("MarketTicker");
  });
});

describe("Pass 58 — RetryableQuery component", () => {
  const src = readFileSync(join(ROOT, "client/src/components/RetryableQuery.tsx"), "utf-8");

  it("exports RetryableQuery component", () => {
    expect(src).toContain("export function RetryableQuery");
  });

  it("exports useRetryableAction hook", () => {
    expect(src).toContain("export function useRetryableAction");
  });

  it("handles circuit breaker errors", () => {
    expect(src).toContain("circuit");
    expect(src).toContain("CIRCUIT_OPEN");
  });

  it("handles network errors", () => {
    expect(src).toContain("Connection Error");
    expect(src).toContain("ECONNREFUSED");
  });

  it("handles timeout errors", () => {
    expect(src).toContain("Request Timed Out");
    expect(src).toContain("ETIMEDOUT");
  });

  it("supports compact mode", () => {
    expect(src).toContain("compact");
  });

  it("shows retry count", () => {
    expect(src).toContain("retryCount");
    expect(src).toContain("Retried");
  });

  it("implements exponential backoff in useRetryableAction", () => {
    expect(src).toContain("Math.pow(2, attempt)");
    expect(src).toContain("baseDelay");
  });
});

describe("Pass 58 — Error tracking service", () => {
  const src = readFileSync(join(ROOT, "client/src/lib/errorTracking.ts"), "utf-8");

  it("exports initErrorTracking", () => {
    expect(src).toContain("export function initErrorTracking");
  });

  it("exports trackError for manual tracking", () => {
    expect(src).toContain("export function trackError");
  });

  it("exports trackTRPCError for tRPC errors", () => {
    expect(src).toContain("export function trackTRPCError");
  });

  it("handles unhandled errors", () => {
    expect(src).toContain("window.addEventListener(\"error\"");
  });

  it("handles promise rejections", () => {
    expect(src).toContain("unhandledrejection");
  });

  it("implements deduplication", () => {
    expect(src).toContain("isDuplicate");
    expect(src).toContain("DEDUP_WINDOW_MS");
  });

  it("batches errors before sending", () => {
    expect(src).toContain("FLUSH_INTERVAL_MS");
    expect(src).toContain("errorQueue");
  });

  it("flushes on page unload", () => {
    expect(src).toContain("beforeunload");
  });

  it("is initialized in main.tsx", () => {
    const main = readFileSync(join(ROOT, "client/src/main.tsx"), "utf-8");
    expect(main).toContain("initErrorTracking");
  });
});

describe("Pass 58 — System router logClientErrors", () => {
  const src = readFileSync(join(ROOT, "server/_core/systemRouter.ts"), "utf-8");

  it("has logClientErrors procedure", () => {
    expect(src).toContain("logClientErrors");
  });

  it("has getClientErrors admin procedure", () => {
    expect(src).toContain("getClientErrors");
    expect(src).toContain("adminProcedure");
  });

  it("validates error schema with zod", () => {
    expect(src).toContain("clientErrorSchema");
    expect(src).toContain("z.object");
  });

  it("maintains in-memory error buffer", () => {
    expect(src).toContain("errorBuffer");
    expect(src).toContain("MAX_BUFFER");
  });

  it("supports filtering by source", () => {
    expect(src).toContain("source");
    expect(src).toContain("unhandled");
    expect(src).toContain("promise");
    expect(src).toContain("trpc");
    expect(src).toContain("manual");
  });
});

describe("Pass 58 — Progressive disclosure consistency", () => {
  it("DisclosureSection component exists", () => {
    expect(existsSync(join(ROOT, "client/src/components/DisclosureSection.tsx"))).toBe(true);
  });

  it("DisclosureContext exists", () => {
    expect(existsSync(join(ROOT, "client/src/contexts/DisclosureContext.tsx"))).toBe(true);
  });

  it("Multiple pages use DisclosureSection or useDisclosureGate", () => {
    const pages = [
      "client/src/pages/FinancialPlanning.tsx",
      "client/src/pages/MarketData.tsx",
      "client/src/pages/Integrations.tsx",
    ];
    let count = 0;
    for (const p of pages) {
      const src = readFileSync(join(ROOT, p), "utf-8");
      if (src.includes("DisclosureSection") || src.includes("useDisclosureGate")) count++;
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
