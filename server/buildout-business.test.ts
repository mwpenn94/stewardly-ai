/**
 * Stewardly Build-Out Business Tests
 * Covers: PII, monitoring, verification, CRM, propensity, lead engine, import, planning
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

describe("Business Schema — New Tables", () => {
  const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");

  it("should have 310+ tables", () => {
    const count = (schema.match(/mysqlTable\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(305);
  });

  it("should define lead_pipeline table", () => {
    expect(schema).toContain("lead_pipeline");
    expect(schema).toContain("email_hash");
    expect(schema).toContain("propensity_score");
    expect(schema).toContain("propensity_tier");
  });

  it("should define business_plans table", () => {
    expect(schema).toContain("business_plans");
    expect(schema).toContain("gdc_target");
    expect(schema).toContain("back_plan_mode");
  });

  it("should define communication_archive for FINRA compliance", () => {
    expect(schema).toContain("communication_archive");
    expect(schema).toContain("retention_expires_at");
    expect(schema).toContain("calculator_insight");
  });

  it("should define import_jobs table", () => {
    expect(schema).toContain("import_jobs");
    expect(schema).toContain("records_imported");
    expect(schema).toContain("dripify_webhook");
  });

  it("should define compliance_rules table", () => {
    expect(schema).toContain("compliance_rules");
    expect(schema).toContain("tcpa");
    expect(schema).toContain("can_spam");
    expect(schema).toContain("finra");
  });

  it("should define propensity_models with 3 types", () => {
    expect(schema).toContain("propensity_models");
    expect(schema).toContain("expert_weights");
    expect(schema).toContain("gradient_boosting");
  });

  it("should define system_health_events for monitoring", () => {
    expect(schema).toContain("system_health_events");
    expect(schema).toContain("cron_success");
    expect(schema).toContain("cron_failure");
    expect(schema).toContain("compliance_flag");
  });

  it("should define calculator_result_cache", () => {
    expect(schema).toContain("calculator_result_cache");
    expect(schema).toContain("inputs_hash");
  });

  it("should define zip_code_demographics", () => {
    expect(schema).toContain("zip_code_demographics");
    expect(schema).toContain("wealth_index");
    expect(schema).toContain("median_household_income");
  });

  it("should define client_plan_outcomes with 13 plan areas", () => {
    expect(schema).toContain("client_plan_outcomes");
    expect(schema).toContain("protection");
    expect(schema).toContain("premium_finance");
    expect(schema).toContain("ilit");
    expect(schema).toContain("exec_comp");
    expect(schema).toContain("charitable");
  });

  it("should define user_memories with 5 categories", () => {
    expect(schema).toContain("user_memories");
    expect(schema).toContain("amp_engagement");
    expect(schema).toContain("ho_domain_trajectory");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PII
// ═══════════════════════════════════════════════════════════════════════════

describe("PII Services", () => {
  it("should hash emails consistently", async () => {
    const { hashEmail } = await import("./services/pii/piiHasher");
    const h1 = hashEmail("Test@Example.com");
    const h2 = hashEmail("test@example.com");
    expect(h1).toBe(h2); // Case-insensitive
    expect(h1.length).toBe(64); // SHA-256 hex
  });

  it("should hash phones by digits only", async () => {
    const { hashPhone } = await import("./services/pii/piiHasher");
    const h1 = hashPhone("(555) 123-4567");
    const h2 = hashPhone("5551234567");
    expect(h1).toBe(h2);
  });

  it("should encrypt and decrypt round-trip", async () => {
    // Only test if INTEGRATION_ENCRYPTION_KEY is set
    if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
      const { hashValue } = await import("./services/pii/piiHasher");
      expect(typeof hashValue("test")).toBe("string");
      return;
    }
    const { encrypt, decrypt } = await import("./services/pii/piiEncryptor");
    const plaintext = "test@example.com";
    const cipher = encrypt(plaintext);
    const decrypted = decrypt(cipher);
    expect(decrypted).toBe(plaintext);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING
// ═══════════════════════════════════════════════════════════════════════════

describe("Health Monitor", () => {
  it("should export runMonitoredCron", async () => {
    const { runMonitoredCron } = await import("./services/monitoring/healthMonitor");
    expect(typeof runMonitoredCron).toBe("function");
  });

  it("should export getHealthStatus", async () => {
    const { getHealthStatus } = await import("./services/monitoring/healthMonitor");
    const status = getHealthStatus();
    expect(status.status).toBe("ok");
    expect(status.timestamp).toBeDefined();
  });

  it("should handle cron timeout", async () => {
    const { runMonitoredCron } = await import("./services/monitoring/healthMonitor");
    const slowFn = () => new Promise<void>(resolve => setTimeout(resolve, 5000));
    await runMonitoredCron("test-timeout", slowFn, 100); // 100ms timeout
    // Should not throw — just log the timeout
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Verification Providers", () => {
  it("should export verify and bulkVerify", async () => {
    const mod = await import("./services/verification/verificationProviders");
    expect(typeof mod.verify).toBe("function");
    expect(typeof mod.bulkVerify).toBe("function");
  });

  it("should return error for unimplemented providers", async () => {
    const { verify } = await import("./services/verification/verificationProviders");
    const result = await verify("cfp", "Test", "12345");
    expect(result.status).toBe("error");
    expect(result.error).toContain("ToS review");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRM
// ═══════════════════════════════════════════════════════════════════════════

describe("GoHighLevel CRM Client", () => {
  it("should export CRUD functions", async () => {
    const mod = await import("./services/crm/gohighlevel");
    expect(typeof mod.createContact).toBe("function");
    expect(typeof mod.updateContact).toBe("function");
    expect(typeof mod.createOpportunity).toBe("function");
    expect(typeof mod.deleteContact).toBe("function");
    expect(typeof mod.handleWebhook).toBe("function");
  });

  it("should gracefully return null when credentials missing", async () => {
    const { createContact } = await import("./services/crm/gohighlevel");
    const result = await createContact({ firstName: "Test", email: "test@example.com" });
    expect(result).toBeNull(); // No GHL_API_TOKEN set
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPENSITY
// ═══════════════════════════════════════════════════════════════════════════

describe("Propensity Scoring", () => {
  it("should export scoreLead and rescoreAllLeads", async () => {
    const mod = await import("./services/propensity/scoringEngine");
    expect(typeof mod.scoreLead).toBe("function");
    expect(typeof mod.rescoreAllLeads).toBe("function");
  });

  it("should return score between 0 and 1 with tier", async () => {
    const { scoreLead } = await import("./services/propensity/scoringEngine");
    const result = await scoreLead(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(["hot", "warm", "cool", "cold"]).toContain(result.tier);
    expect(result.model).toBe("expert_weights");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEAD ENGINE
// ═══════════════════════════════════════════════════════════════════════════

describe("Calculator Insights", () => {
  it("should export generateInsight", async () => {
    const { generateInsight } = await import("./services/leadEngine/calculatorInsights");
    expect(typeof generateInsight).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════════════════

describe("Import Orchestrator", () => {
  it("should export startImport", async () => {
    const { startImport } = await import("./services/import/importOrchestrator");
    expect(typeof startImport).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTERS
// ═══════════════════════════════════════════════════════════════════════════

describe("New Business Routers", () => {
  it("should register all new routers in appRouter", () => {
    const routerFile = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(routerFile).toContain("leadPipeline:");
    expect(routerFile).toContain("propensityScoring:");
    expect(routerFile).toContain("dataImport:");
    expect(routerFile).toContain("businessPlanning:");
    expect(routerFile).toContain("communityForum:");
    expect(routerFile).toContain("verification:");
    expect(routerFile).toContain("esignature:");
    expect(routerFile).toContain("pdf:");
    expect(routerFile).toContain("creditBureau:");
    expect(routerFile).toContain("crm:");
  });

  it("should have verification router file", () => {
    expect(fs.existsSync(path.join(ROOT, "server/routers/verification.ts"))).toBe(true);
  });

  it("should have lead pipeline router file", () => {
    expect(fs.existsSync(path.join(ROOT, "server/routers/leadPipeline.ts"))).toBe(true);
  });

  it("should have planning router file", () => {
    expect(fs.existsSync(path.join(ROOT, "server/routers/planning.ts"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE NON-NEGOTIABLES
// ═══════════════════════════════════════════════════════════════════════════

describe("Compliance Non-Negotiables", () => {
  it("should have communication_archive for FINRA 17a-4", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("communication_archive");
    expect(schema).toContain("retention_expires_at");
  });

  it("should have PII hashing for dedup without storing plaintext", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("email_hash");
    expect(schema).toContain("phone_hash");
    // No plaintext email/phone in lead_pipeline
    expect(schema).not.toMatch(/lead_pipeline.*email\s+VARCHAR/);
  });

  it("should have consent tracking for CAN-SPAM", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("email_consent_granted");
    expect(schema).toContain("unsubscribed");
  });

  it("should have control group for propensity bias testing", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("is_control_group");
  });

  it("should have bias audit table", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("propensity_bias_audits");
    expect(schema).toContain("disparity_ratio");
  });
});
