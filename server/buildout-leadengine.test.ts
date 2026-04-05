/**
 * Lead Engine + Planning + Scraping Tests
 */
import { describe, it, expect } from "vitest";

describe("Qualification Engine", () => {
  it("should qualify a lead with all required fields + high propensity", async () => {
    const { qualifyLead } = await import("./services/leadEngine/qualificationEngine");
    const result = qualifyLead(
      { email: "test@example.com", firstName: "John", state: "AZ", age: 45, income: 100000, primaryInterest: "retirement", assets: 500000, homeownership: true, businessOwner: false },
      0.75,
    );
    expect(result.qualified).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.missingRequired).toHaveLength(0);
  });

  it("should not qualify with missing required fields", async () => {
    const { qualifyLead } = await import("./services/leadEngine/qualificationEngine");
    const result = qualifyLead({ age: 45 }, 0.9);
    expect(result.qualified).toBe(false);
    expect(result.missingRequired.length).toBeGreaterThan(0);
  });

  it("should not qualify with low propensity despite full profile", async () => {
    const { qualifyLead } = await import("./services/leadEngine/qualificationEngine");
    const result = qualifyLead(
      { email: "test@example.com", firstName: "John", state: "AZ", age: 45, income: 100000, primaryInterest: "retirement", assets: 500000, homeownership: true, businessOwner: true },
      0.2,
    );
    expect(result.qualified).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0.7); // Profile is complete
  });
});

describe("Financial Protection Score", () => {
  it("should calculate score from answers", async () => {
    const { calculateScore } = await import("./services/leadEngine/financialProtectionScore");
    const result = calculateScore({
      life_insurance: 8, disability: 5, emergency_fund: 7, retirement: 6,
      estate_plan: 3, health_insurance: 9, debt_management: 7, investment_diversification: 5,
      tax_efficiency: 4, education_funding: 6, long_term_care: 2, property_casualty: 8,
    });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.dimensions).toHaveLength(12);
    expect(result.improvementPriorities.length).toBeGreaterThan(0);
  });

  it("should recommend products for low-scoring dimensions", async () => {
    const { calculateScore } = await import("./services/leadEngine/financialProtectionScore");
    const result = calculateScore({
      life_insurance: 1, disability: 1, retirement: 1, estate_plan: 1,
    });
    expect(result.productRecommendations.length).toBeGreaterThanOrEqual(4);
    expect(result.productRecommendations.some(r => r.product.includes("Term Life"))).toBe(true);
    expect(result.productRecommendations.some(r => r.product.includes("Disability"))).toBe(true);
  });

  it("should return 0 for empty answers", async () => {
    const { calculateScore } = await import("./services/leadEngine/financialProtectionScore");
    const result = calculateScore({});
    expect(result.overallScore).toBe(0);
    expect(result.dimensions.every(d => d.score === 0)).toBe(true);
  });
});

describe("Progressive Profiler", () => {
  it("should export addDataPoint and getProfile", async () => {
    const mod = await import("./services/leadEngine/progressiveProfiler");
    expect(typeof mod.addDataPoint).toBe("function");
    expect(typeof mod.getProfile).toBe("function");
  });
});

describe("Lead Distributor", () => {
  it("should export distributeLead", async () => {
    const { distributeLead } = await import("./services/leadEngine/leadDistributor");
    expect(typeof distributeLead).toBe("function");
  });
});

describe("Pre-Meeting Brief", () => {
  it("should export generateBrief", async () => {
    const { generateBrief } = await import("./services/leadEngine/preMeetingBrief");
    expect(typeof generateBrief).toBe("function");
  });
});

describe("Plan Analyzer", () => {
  it("should export analyzePlans", async () => {
    const { analyzePlans } = await import("./services/planning/planAnalyzer");
    expect(typeof analyzePlans).toBe("function");
  });
});

describe("CSV Parser", () => {
  it("should parse comma-delimited CSV", async () => {
    const { parseCsv } = await import("./services/import/csvParser");
    const result = parseCsv("name,email,phone\nJohn,john@test.com,555-1234\nJane,jane@test.com,555-5678");
    expect(result.headers).toEqual(["name", "email", "phone"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe("John");
    expect(result.rows[1].email).toBe("jane@test.com");
  });

  it("should auto-detect tab delimiter", async () => {
    const { parseCsv } = await import("./services/import/csvParser");
    const result = parseCsv("name\temail\nJohn\tjohn@test.com");
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows[0].name).toBe("John");
  });

  it("should handle quoted fields with commas", async () => {
    const { parseCsv } = await import("./services/import/csvParser");
    const result = parseCsv('name,title\n"Smith, John","VP, Sales"');
    expect(result.rows[0].name).toBe("Smith, John");
    expect(result.rows[0].title).toBe("VP, Sales");
  });

  it("should sanitize CSV injection", async () => {
    const { parseCsv } = await import("./services/import/csvParser");
    const result = parseCsv("name,formula\nTest,=SUM(A1)");
    expect(result.rows[0].formula).toBe("'=SUM(A1)");
  });
});

describe("Field Mapper", () => {
  it("should auto-detect common field names", async () => {
    const { autoDetectMapping } = await import("./services/import/fieldMapper");
    const mapping = autoDetectMapping(["First Name", "Last Name", "Email", "Phone", "Company", "LinkedIn"]);
    expect(mapping["First Name"]).toBe("firstName");
    expect(mapping["Email"]).toBe("email");
    expect(mapping["LinkedIn"]).toBe("linkedinUrl");
  });

  it("should apply mapping to rows", async () => {
    const { applyMapping } = await import("./services/import/fieldMapper");
    const rows = [{ "First Name": "John", "E-mail": "john@test.com" }];
    const result = applyMapping(rows, { "First Name": "firstName", "E-mail": "email" });
    expect(result[0].firstName).toBe("John");
    expect(result[0].email).toBe("john@test.com");
  });
});

describe("Robots Checker", () => {
  it("should export isAllowed", async () => {
    const { isAllowed } = await import("./services/scraping/robotsChecker");
    expect(typeof isAllowed).toBe("function");
  });
});

describe("Rate Limiter", () => {
  it("should export acquireToken", async () => {
    const { acquireToken } = await import("./services/scraping/rateLimiter");
    expect(typeof acquireToken).toBe("function");
  });
});

describe("Enrichment Orchestrator", () => {
  it("should export enrichLead", async () => {
    const { enrichLead } = await import("./services/enrichment/enrichmentOrchestrator");
    expect(typeof enrichLead).toBe("function");
  });
});

describe("Data Maintenance", () => {
  it("should export checkDataFreshness", async () => {
    const { checkDataFreshness } = await import("./services/monitoring/dataMaintenanceEngine");
    expect(typeof checkDataFreshness).toBe("function");
  });
});

describe("SOFR Rates", () => {
  it("should export fetchLatestSofr and getRateHistory", async () => {
    const mod = await import("./services/premiumFinance/premiumFinanceRates");
    expect(typeof mod.fetchLatestSofr).toBe("function");
    expect(typeof mod.getRateHistory).toBe("function");
  });

  it("should return null when FRED_API_KEY not set", async () => {
    const { fetchLatestSofr } = await import("./services/premiumFinance/premiumFinanceRates");
    const result = await fetchLatestSofr();
    if (!process.env.FRED_API_KEY) {
      expect(result).toBeNull();
    }
  });
});

describe("SMS-iT Adapter", () => {
  it("should export pushContact and handleWebhook", async () => {
    const mod = await import("./services/smsit/smsitAdapter");
    expect(typeof mod.pushContact).toBe("function");
    expect(typeof mod.handleWebhook).toBe("function");
  });

  it("should return null when not configured", async () => {
    const { pushContact } = await import("./services/smsit/smsitAdapter");
    const result = await pushContact({ firstName: "Test", phone: "5551234567" });
    expect(result).toBeNull();
  });
});
