/**
 * Tests for M&V persistence queries and BYO test endpoint
 * Validates the substrate router additions for Phase 6.
 */
import { describe, it, expect } from "vitest";
import { testBYOEndpoint, getBYOProviders } from "./services/substrate";
import {
  queryUserEvents,
  getLatestPeriodSummary,
  getUserPeriodSummaries,
  getPlatformSavingsMetrics,
} from "./services/substrate/mvPersistence";

describe("M&V Persistence Layer", () => {
  it("queryUserEvents is a function", () => {
    expect(typeof queryUserEvents).toBe("function");
  });

  it("getLatestPeriodSummary is a function", () => {
    expect(typeof getLatestPeriodSummary).toBe("function");
  });

  it("getUserPeriodSummaries is a function", () => {
    expect(typeof getUserPeriodSummaries).toBe("function");
  });

  it("getPlatformSavingsMetrics is a function", () => {
    expect(typeof getPlatformSavingsMetrics).toBe("function");
  });
});

describe("BYO Endpoint Testing", () => {
  it("testBYOEndpoint is a function", () => {
    expect(typeof testBYOEndpoint).toBe("function");
  });

  it("testBYOEndpoint returns failure for invalid endpoint", async () => {
    const result = await testBYOEndpoint("http://localhost:99999");
    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("latencyMs");
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("getBYOProviders is a function", () => {
    expect(typeof getBYOProviders).toBe("function");
  });

  it("getBYOProviders returns array for any user", () => {
    const providers = getBYOProviders(999);
    expect(Array.isArray(providers)).toBe(true);
  });
});
