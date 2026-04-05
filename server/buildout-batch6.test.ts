/**
 * Batch 6 Tests — Expert weights, feature gatherer, embed, coaching, routers
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Expert Weights", () => {
  it("should have 14 segment models", async () => {
    const { EXPERT_MODELS } = await import("./services/propensity/expertWeights");
    expect(EXPERT_MODELS).toHaveLength(14);
  });

  it("should have weights summing to ~1.0 per model", async () => {
    const { EXPERT_MODELS } = await import("./services/propensity/expertWeights");
    for (const model of EXPERT_MODELS) {
      const sum = Object.values(model.features).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("should score with weights", async () => {
    const { scoreWithWeights } = await import("./services/propensity/expertWeights");
    const score = scoreWithWeights({ a: 1, b: 0.5 }, { a: 0.6, b: 0.4 });
    expect(score).toBeCloseTo(0.8);
  });

  it("should get model for segment", async () => {
    const { getModelForSegment } = await import("./services/propensity/expertWeights");
    expect(getModelForSegment("client_retirement")).toBeDefined();
    expect(getModelForSegment("nonexistent")).toBeUndefined();
  });
});

describe("Feature Gatherer", () => {
  it("should export gatherFeatures", async () => {
    const { gatherFeatures } = await import("./services/propensity/featureGatherer");
    expect(typeof gatherFeatures).toBe("function");
  });
});

describe("Embed Manager", () => {
  it("should generate valid embed code", async () => {
    const { generateEmbedCode } = await import("./services/leadEngine/embedManager");
    const code = generateEmbedCode("https://stewardly.manus.space", 1, "retirement", "dark");
    expect(code).toContain("<iframe");
    expect(code).toContain("advisorId=1");
    expect(code).toContain("retirement");
    expect(code).toContain("Powered by");
    expect(code).toContain("Not investment advice");
  });
});

describe("Coaching Content", () => {
  it("should return coaching items for protection domain", async () => {
    const { getCoachingForDomain } = await import("./services/leadEngine/coachingContent");
    const items = getCoachingForDomain("protection");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].conversationStarter.length).toBeGreaterThan(10);
    expect(items[0].product.length).toBeGreaterThan(0);
  });

  it("should return all coaching content", async () => {
    const { getAllCoachingContent } = await import("./services/leadEngine/coachingContent");
    const all = getAllCoachingContent();
    expect(all.length).toBeGreaterThanOrEqual(9);
    const domains = new Set(all.map(c => c.domain));
    expect(domains.has("protection")).toBe(true);
    expect(domains.has("retirement")).toBe(true);
    expect(domains.has("estate")).toBe(true);
    expect(domains.has("premium_finance")).toBe(true);
  });

  it("should return appropriate coaching for low scores", async () => {
    const { getCoachingForScore } = await import("./services/leadEngine/coachingContent");
    const item = getCoachingForScore("protection", 2);
    expect(item).not.toBeNull();
    expect(item!.domain).toBe("protection");
  });
});

describe("New Routers Registered", () => {
  it("should have all batch 6 routers in appRouter", () => {
    const routerFile = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(routerFile).toContain("leadCapture:");
    expect(routerFile).toContain("referrals:");
    expect(routerFile).toContain("embeds:");
    expect(routerFile).toContain("premiumFinanceRates:");
    expect(routerFile).toContain("businessReports:");
    expect(routerFile).toContain("contentCms:");
  });
});
