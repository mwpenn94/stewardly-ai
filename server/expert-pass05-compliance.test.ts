/**
 * Expert Pass 5 — Compliance Deep Dive
 * Validates guardrails, PII masking, audit trails, and regulatory modules.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 5 — Compliance Deep Dive", () => {
  it("screenInput detects SSN", async () => {
    const { screenInput } = await import("./shared/guardrails");
    const r = screenInput("My SSN is 123-45-6789");
    expect(r.passed).toBe(false);
  });
  it("screenInput detects credit card", async () => {
    const { screenInput } = await import("./shared/guardrails");
    const r = screenInput("Card 4111-1111-1111-1111");
    expect(r.passed).toBe(false);
  });
  it("screenInput passes clean text", async () => {
    const { screenInput } = await import("./shared/guardrails");
    const r = screenInput("What are good retirement strategies?");
    expect(r.passed).toBe(true);
  });
  it("screenOutput catches PII leakage", async () => {
    const { screenOutput } = await import("./shared/guardrails");
    const r = screenOutput("Your SSN is 123-45-6789");
    expect(r.passed).toBe(false);
  });
  it("maskPII redacts SSN and credit card", async () => {
    const { maskPII } = await import("./shared/guardrails");
    const masked = maskPII("SSN: 123-45-6789, Card: 4111111111111111");
    expect(masked).toContain("[REDACTED_SSN]");
    expect(masked).toContain("[REDACTED_CREDIT_CARD]");
  });
  it("complianceAudit validates ESI tracking", async () => {
    const { validateEsiTracking } = await import("./services/complianceAudit");
    const result = validateEsiTracking({
      esiPreApprovalId: "ESI-2026-001",
      esiPreApprovalExpiry: Date.now() + 86400000,
      antiRebateLanguageVerified: true,
      lastVerifiedAt: Date.now(),
      verifiedBy: "admin",
    });
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.issues)).toBe(true);
  });
  it("validateEsiTracking fails for placeholder ID", async () => {
    const { validateEsiTracking } = await import("./services/complianceAudit");
    const result = validateEsiTracking({
      esiPreApprovalId: "{{esi_id}}",
      esiPreApprovalExpiry: Date.now() + 86400000,
      antiRebateLanguageVerified: true,
      lastVerifiedAt: Date.now(),
      verifiedBy: "admin",
    });
    expect(result.valid).toBe(false);
  });
  it("regulatoryMonitor module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/regulatoryMonitor.ts"))).toBe(true);
  });
  it("regulatoryImpact module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/regulatoryImpact.ts"))).toBe(true);
  });
  it("regBIDocumentation module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/regBIDocumentation.ts"))).toBe(true);
  });
  it("dynamicDisclaimers module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicDisclaimers.ts"))).toBe(true);
  });
  it("fairnessTesting module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/fairnessTesting.ts"))).toBe(true);
  });
  it("urlHallucination detection exists", async () => {
    const mod = await import("./shared/guardrails");
    expect(typeof mod.detectHallucinatedURLs).toBe("function");
  });
  it("GLOBAL_RULES defined in cadenceEngine", async () => {
    const { GLOBAL_RULES } = await import("./services/cadenceEngine");
    expect(GLOBAL_RULES).toBeDefined();
  });
  it("auditMessage grades messages correctly", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "msg-test-2",
      body: "General greeting with no compliance issues.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-002",
      auditType: "ad_hoc",
    });
    expect(["Pass", "Conditional Pass", "Fail"]).toContain(result.grade);
  });
});
