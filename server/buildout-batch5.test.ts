/**
 * Batch 5 Tests — Propensity, import parsers, CRM, SEO, email
 */
import { describe, it, expect } from "vitest";

describe("Bias Auditor", () => {
  it("should run audit for a model and return results", async () => {
    const { runBiasAudit } = await import("./services/propensity/biasAuditor");
    const result = await runBiasAudit(1);
    expect(result.protectedClasses).toHaveLength(3);
    expect(result.protectedClasses.every(pc => typeof pc.disparityRatio === "number")).toBe(true);
    expect(typeof result.overallPasses).toBe("boolean");
  });
});

describe("Selection Bias Monitor", () => {
  it("should export checkSelectionBias", async () => {
    const { checkSelectionBias } = await import("./services/propensity/selectionBiasMonitor");
    expect(typeof checkSelectionBias).toBe("function");
  });
});

describe("Import Validator", () => {
  it("should validate a record with all required fields", async () => {
    const { validateRecord } = await import("./services/import/importValidator");
    const result = validateRecord({ email: "test@example.com", firstName: "John" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation for missing email", async () => {
    const { validateRecord } = await import("./services/import/importValidator");
    const result = validateRecord({ firstName: "John" });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("email"))).toBe(true);
  });

  it("should fail validation for invalid email format", async () => {
    const { validateRecord } = await import("./services/import/importValidator");
    const result = validateRecord({ email: "not-an-email" });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Invalid email"))).toBe(true);
  });

  it("should warn on CSV injection patterns", async () => {
    const { validateRecord } = await import("./services/import/importValidator");
    const result = validateRecord({ email: "test@example.com", formula: "=SUM(A1)" });
    expect(result.warnings.some(w => w.includes("injection"))).toBe(true);
  });

  it("should validate batch and separate valid from invalid", async () => {
    const { validateBatch } = await import("./services/import/importValidator");
    const records = [
      { email: "good@example.com" },
      { firstName: "NoEmail" },
      { email: "also-good@example.com" },
    ];
    const result = validateBatch(records);
    expect(result.validRecords).toHaveLength(2);
    expect(result.invalidRecords).toHaveLength(1);
  });
});

describe("Dripify CSV Parser", () => {
  it("should parse Dripify export format", async () => {
    const { parseDripifyCsv } = await import("./services/import/dripifyCsvParser");
    const csv = 'First Name,Last Name,Email,Headline,Company Name,Location,LinkedIn URL\nJohn,Smith,john@test.com,VP Sales,Acme Inc,"Phoenix, AZ",https://linkedin.com/in/john';
    const result = parseDripifyCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe("John");
    expect(result[0].company).toBe("Acme Inc");
    expect(result[0].city).toBe("Phoenix");
    expect(result[0].state).toBe("AZ");
  });
});

describe("LinkedIn Sales Nav Parser", () => {
  it("should parse Sales Nav export and flag needs_email", async () => {
    const { parseLinkedInSalesNavCsv } = await import("./services/import/linkedinSalesNavParser");
    const csv = 'First Name,Last Name,Title,Company,Company Size,Location,LinkedIn Sales Nav URL\nJane,Doe,CFO,BigCorp,1000,"Tucson, AZ",https://linkedin.com/sales/jane';
    const result = parseLinkedInSalesNavCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].needsEmail).toBe("true");
    expect(result[0].companySizeSignal).toBe("enterprise");
  });
});

describe("CRM Adapter", () => {
  it("should return null when no CRM configured", async () => {
    const { getCRMAdapter } = await import("./services/crm/crmAdapter");
    if (!process.env.GHL_API_TOKEN) {
      expect(getCRMAdapter()).toBeNull();
    }
  });
});

describe("Sitemap Generator", () => {
  it("should generate valid XML sitemap", async () => {
    const { generateSitemap } = await import("./services/seo/sitemapGenerator");
    const xml = generateSitemap("https://stewardly.manus.space");
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("https://stewardly.manus.space/");
    expect(xml).toContain("financial-protection-score");
    expect(xml).toContain("glossary");
    expect(xml).toContain("<priority>");
  });
});

describe("Email Deliverability", () => {
  it("should handle hard bounce as invalid", async () => {
    const { handleBounce } = await import("./services/email/emailDeliverability");
    const result = handleBounce("test@bad.com", "hard");
    expect(result.action).toBe("invalid");
  });

  it("should retry soft bounce up to 3 times", async () => {
    const { handleBounce } = await import("./services/email/emailDeliverability");
    expect(handleBounce("test@slow.com", "soft", 0).action).toBe("retry");
    expect(handleBounce("test@slow.com", "soft", 2).action).toBe("retry");
    expect(handleBounce("test@slow.com", "soft", 3).action).toBe("invalid");
  });

  it("should auto-unsubscribe on complaint", async () => {
    const { handleBounce } = await import("./services/email/emailDeliverability");
    const result = handleBounce("test@complain.com", "complaint");
    expect(result.action).toBe("unsubscribe");
  });
});
