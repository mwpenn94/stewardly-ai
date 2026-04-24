/**
 * Expert Pass 14 — Lead Distribution & Enrichment
 * Validates enrichment waterfall, knowledge base, and distribution modules.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 14 — Lead Distribution & Enrichment", () => {
  it("enrichmentWaterfall exports enrichContact", async () => {
    const mod = await import("./services/enrichmentWaterfall");
    expect(typeof mod.enrichContact).toBe("function");
  });
  it("enrichmentWaterfall exports mergeEnrichmentData", async () => {
    const mod = await import("./services/enrichmentWaterfall");
    expect(typeof mod.mergeEnrichmentData).toBe("function");
  });
  it("knowledgeBase module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/knowledgeBase.ts"))).toBe(true);
  });
  it("knowledgeIngestion module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/knowledgeIngestion.ts"))).toBe(true);
  });
  it("knowledgeGraphDynamic module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/knowledgeGraphDynamic.ts"))).toBe(true);
  });
  it("linkedinEnrichment module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/linkedinEnrichment.ts"))).toBe(true);
  });
  it("databankEnrichment module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/databankEnrichment.ts"))).toBe(true);
  });
  it("searchEnhanced module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/searchEnhanced.ts"))).toBe(true);
  });
  it("selfDiscovery module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/selfDiscovery.ts"))).toBe(true);
  });
  it("roleOnboarding module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/roleOnboarding.ts"))).toBe(true);
  });
  it("exponentialEngine module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/exponentialEngine.ts"))).toBe(true);
  });
  it("LAYER_HIERARCHY defined in exponentialEngine", async () => {
    const { LAYER_HIERARCHY } = await import("./services/exponentialEngine");
    expect(Array.isArray(LAYER_HIERARCHY)).toBe(true);
    expect(LAYER_HIERARCHY.length).toBeGreaterThan(0);
  });
  it("FEATURE_CATALOG defined in exponentialEngine", async () => {
    const { FEATURE_CATALOG } = await import("./services/exponentialEngine");
    expect(Array.isArray(FEATURE_CATALOG)).toBe(true);
  });
  it("propagationEngine module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/propagationEngine.ts"))).toBe(true);
  });
  it("providerRouter module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/providerRouter.ts"))).toBe(true);
  });
  it("fieldSharing module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/fieldSharing.ts"))).toBe(true);
  });
  it("orgProviders module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/orgProviders.ts"))).toBe(true);
  });
  it("orgAiConfig module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/orgAiConfig.ts"))).toBe(true);
  });
});
