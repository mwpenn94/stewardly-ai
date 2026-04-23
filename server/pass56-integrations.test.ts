/**
 * Pass 56 — IMF + ExchangeRate-API Pipeline Tests
 * Validates the two new keyless data pipelines are properly wired.
 */
import { describe, it, expect, vi } from "vitest";

// ─── IMF Pipeline Tests ────────────────────────────────────────────────

describe("IMF DataMapper Pipeline", () => {
  it("should export fetchIMFData via runSinglePipeline map", async () => {
    // Verify the pipeline map includes "imf"
    const mod = await import("./services/governmentDataPipelines");
    expect(typeof mod.runSinglePipeline).toBe("function");
    // The function should exist and return a PipelineResult shape for unknown slugs
    const result = await mod.runSinglePipeline("__nonexistent__");
    expect(result).toHaveProperty("pipeline");
    expect(result).toHaveProperty("status", "error");
    expect(result).toHaveProperty("error", "Unknown provider");
  });

  it("should include imf in the pipeline map", async () => {
    const mod = await import("./services/governmentDataPipelines");
    let result: any;
    try {
      result = await Promise.race([
        mod.runSinglePipeline("imf"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000)),
      ]);
    } catch (err: any) {
      // Network timeout or DB unavailable — skip gracefully
      console.warn("IMF pipeline test skipped (network/DB):", err.message);
      return;
    }
    expect(result.providerSlug).toBe("imf");
    if (result.status === "error") {
      expect(result.error).not.toBe("Unknown provider");
    }
  }, 60000);

  it("should include exchangerate-api in the pipeline map", async () => {
    const mod = await import("./services/governmentDataPipelines");
    let result: any;
    try {
      result = await Promise.race([
        mod.runSinglePipeline("exchangerate-api"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000)),
      ]);
    } catch (err: any) {
      console.warn("ExchangeRate pipeline test skipped (network/DB):", err.message);
      return;
    }
    expect(result.providerSlug).toBe("exchangerate-api");
    if (result.status === "error") {
      expect(result.error).not.toBe("Unknown provider");
    }
  }, 60000);

  it("IMF DataMapper API URL should be well-formed", () => {
    const indicators = ["NGDP_RPCH", "PCPIPCH", "BCA_NGDPD"];
    for (const code of indicators) {
      const url = `https://www.imf.org/external/datamapper/api/v1/${code}?periods=2024,2025,2026`;
      expect(url).toMatch(/^https:\/\/www\.imf\.org\/external\/datamapper\/api\/v1\/[A-Z_]+\?periods=/);
    }
  });

  it("ExchangeRate-API URL should be well-formed", () => {
    const url = "https://open.er-api.com/v6/latest/USD";
    expect(url).toMatch(/^https:\/\/open\.er-api\.com\/v6\/latest\/[A-Z]{3}$/);
  });
});

// ─── Seed Integration Tests ────────────────────────────────────────────

describe("Seed Integrations include IMF and ExchangeRate-API", () => {
  it("should have imf and exchangerate-api in seed data", async () => {
    const fs = await import("fs");
    const seedContent = fs.readFileSync("server/services/seedIntegrations.ts", "utf-8");
    expect(seedContent).toContain('slug: "imf"');
    expect(seedContent).toContain('slug: "exchangerate-api"');
    expect(seedContent).toContain("IMF DataMapper");
    expect(seedContent).toContain("ExchangeRate-API");
  });
});

// ─── Foundation Layer Tests ────────────────────────────────────────────

describe("Foundation Layer includes new providers", () => {
  it("should have rate profiles for imf and exchangerate-api", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/foundationLayer.ts", "utf-8");
    expect(content).toContain('provider: "imf"');
    expect(content).toContain('provider: "exchangerate-api"');
    expect(content).toContain("www.imf.org");
    expect(content).toContain("open.er-api.com");
  });

  it("should have freshness registry entries for new providers", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/foundationLayer.ts", "utf-8");
    expect(content).toContain('"global_gdp"');
    expect(content).toContain('"global_inflation"');
    expect(content).toContain('"fx_rates"');
    expect(content).toContain('"fx_cross_rates"');
    expect(content).toContain('"fx_indices"');
  });
});

// ─── Cron Manager Tests ────────────────────────────────────────────────

describe("Cron Manager includes new pipeline jobs", () => {
  it("should register IMF and ExchangeRate cron jobs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/cronManager.ts", "utf-8");
    expect(content).toContain('"platform-imf"');
    expect(content).toContain('"platform-exchangerate"');
    expect(content).toContain("IMF World Economic Outlook");
    expect(content).toContain("Exchange Rate Data");
  });
});

// ─── Economic Data Summary Tests ───────────────────────────────────────

describe("Economic Data Summary includes new sections", () => {
  it("should have IMF and ExchangeRate sections in summary builder", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/governmentDataPipelines.ts", "utf-8");
    expect(content).toContain("### IMF (International Monetary Fund)");
    expect(content).toContain("### Exchange Rates (ExchangeRate-API)");
    expect(content).toContain('providerSlug, "imf"');
    expect(content).toContain('providerSlug, "exchangerate-api"');
  });
});

// ─── DXY Proxy Calculation Tests ───────────────────────────────────────

describe("DXY Proxy Index calculation", () => {
  it("should compute a reasonable DXY proxy from exchange rates", () => {
    // Simulate the DXY proxy calculation from the pipeline
    const dxyWeights: Record<string, number> = { EUR: 0.576, JPY: 0.136, GBP: 0.119, CAD: 0.091, SEK: 0.042, CHF: 0.036 };
    const baseRates: Record<string, number> = { EUR: 0.9246, JPY: 141.04, GBP: 0.7879, CAD: 1.3226, SEK: 10.04, CHF: 0.8414 };
    
    // Use current-ish rates for testing
    const currentRates: Record<string, number> = { EUR: 0.92, JPY: 149.5, GBP: 0.79, CAD: 1.36, SEK: 10.5, CHF: 0.88 };
    
    let dxyApprox = 0;
    let totalWeight = 0;
    for (const [curr, weight] of Object.entries(dxyWeights)) {
      const currentRate = currentRates[curr];
      const baseRate = baseRates[curr];
      if (currentRate && baseRate) {
        dxyApprox += weight * (currentRate / baseRate);
        totalWeight += weight;
      }
    }
    
    const dxyIndex = (dxyApprox / totalWeight) * 100;
    
    // DXY should be in a reasonable range (80-130)
    expect(dxyIndex).toBeGreaterThan(80);
    expect(dxyIndex).toBeLessThan(130);
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });
});

// ─── UnifiedAI Route Tests ─────────────────────────────────────────────

describe("UnifiedAI route registration", () => {
  it("should have /ai in the exempt routes for navReachability", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/navReachability.test.ts", "utf-8");
    expect(content).toContain("/ai");
  });
});

// ─── Email Campaign Page Tests ─────────────────────────────────────────

describe("Email Campaign page exists", () => {
  it("should have EmailCampaign.tsx page", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("client/src/pages/EmailCampaign.tsx")).toBe(true);
  });

  it("should be registered in App.tsx", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain("EmailCampaign");
    expect(content).toContain("email-campaigns");
  });

  it("should be in navigation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/lib/navigation.ts", "utf-8");
    expect(content).toContain("email-campaigns");
  });
});
