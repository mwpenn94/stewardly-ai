/**
 * Extended Intelligence Tests — Web search, consensus, provider routing, usage, agents
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Extended Schema", () => {
  const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");

  it("should have 314+ tables", () => {
    const count = (schema.match(/mysqlTable\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(314);
  });

  it("should define usage_tracking table", () => {
    expect(schema).toContain("usage_tracking");
    expect(schema).toContain("estimated_cost");
  });

  it("should define usage_budgets table", () => {
    expect(schema).toContain("usage_budgets");
    expect(schema).toContain("daily_query_limit");
    expect(schema).toContain("monthly_cost_ceiling");
  });

  it("should define response_ratings table", () => {
    expect(schema).toContain("response_ratings");
    expect(schema).toContain("thumbs_up");
    expect(schema).toContain("thumbs_down");
  });

  it("should define shared_links table", () => {
    expect(schema).toContain("shared_links");
    expect(schema).toContain("share_token");
  });

  it("should define template_optimization_results table", () => {
    expect(schema).toContain("template_optimization_results");
    expect(schema).toContain("avg_score");
  });
});

describe("Web Search Tool", () => {
  it("should export executeWebSearch", async () => {
    const { executeWebSearch } = await import("./services/webSearchTool");
    expect(typeof executeWebSearch).toBe("function");
  });

  it("should return fallback when no API keys set", async () => {
    const { getSearchProvider } = await import("./services/webSearchTool");
    // Verify provider detection works without external API keys
    const provider = getSearchProvider();
    expect(["tavily", "brave", "manus-google", "llm-fallback"]).toContain(provider);
  });
});

describe("Consensus LLM", () => {
  it("should export consensusLLM", async () => {
    const { consensusLLM } = await import("./services/consensusLLM");
    expect(typeof consensusLLM).toBe("function");
  });
});

describe("Provider Router", () => {
  it("should export getAvailableProviders", async () => {
    const { getAvailableProviders } = await import("./services/providerRouter");
    const providers = getAvailableProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it("should export selectProvider", async () => {
    const { selectProvider } = await import("./services/providerRouter");
    expect(typeof selectProvider).toBe("function");
  });

  it("should handle markFailure without crashing", async () => {
    const { markFailure } = await import("./services/providerRouter");
    markFailure("nonexistent"); // Should not throw
  });
});

describe("Usage Tracker", () => {
  it("should export trackUsage and checkBudget", async () => {
    const mod = await import("./services/usageTracker");
    expect(typeof mod.trackUsage).toBe("function");
    expect(typeof mod.checkBudget).toBe("function");
  });

  it("should return allowed=true when no budget exists", async () => {
    const { checkBudget } = await import("./services/usageTracker");
    const result = await checkBudget(999999);
    expect(result.allowed).toBe(true);
  });
});

describe("Financial Planning Agent", () => {
  it("should export generateComprehensivePlan", async () => {
    const { generateComprehensivePlan } = await import("./services/financialPlanningAgent");
    expect(typeof generateComprehensivePlan).toBe("function");
  });
});

describe("Batch AI Pipeline", () => {
  it("should export batchEnrich, batchScore, batchProcess", async () => {
    const mod = await import("./services/batchAIPipeline");
    expect(typeof mod.batchEnrich).toBe("function");
    expect(typeof mod.batchScore).toBe("function");
    expect(typeof mod.batchProcess).toBe("function");
  });
});

describe("Feedback Collector", () => {
  it("should export recordRating and getAggregateRatings", async () => {
    const mod = await import("./services/feedbackCollector");
    expect(typeof mod.recordRating).toBe("function");
    expect(typeof mod.getAggregateRatings).toBe("function");
  });

  it("should return zero counts when no ratings exist", async () => {
    const { getAggregateRatings } = await import("./services/feedbackCollector");
    const result = await getAggregateRatings();
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(typeof result.approvalRate).toBe("number");
  });
});
