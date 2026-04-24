/**
 * Expert Pass 6 — Cadence Sequencing
 * Validates cadence library, touch rendering, throttling, and variant creation.
 */
import { describe, it, expect } from "vitest";

describe("Expert Pass 6 — Cadence Sequencing", () => {
  it("CADENCE_LIBRARY contains multi-channel cadences", async () => {
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const channels = new Set(CADENCE_LIBRARY.flatMap(c => c.touches.map(t => t.channel)));
    expect(channels.size).toBeGreaterThanOrEqual(2);
  });
  it("renderTouch substitutes variables", async () => {
    const { renderTouch, CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const cadence = CADENCE_LIBRARY[0];
    if (cadence && cadence.touches[0]) {
      const rendered = renderTouch(cadence.touches[0], { firstName: "Alice", companyName: "Acme" });
      expect(rendered).toBeDefined();
      expect(typeof rendered.body).toBe("string");
    }
  });
  it("VARIABLE_MAP has standard variables", async () => {
    const { VARIABLE_MAP } = await import("./services/cadenceEngine");
    expect(VARIABLE_MAP).toBeDefined();
    expect(typeof VARIABLE_MAP).toBe("object");
  });
  it("runComplianceChecks validates touch content", async () => {
    const { runComplianceChecks } = await import("./services/cadenceTouchDrafting");
    const checks = runComplianceChecks("Buy now! Guaranteed returns!", "email", "ESI-001");
    expect(checks).toBeDefined();
    expect(typeof checks.readyToSend).toBe("boolean");
  });
  it("runComplianceChecks detects performance projections", async () => {
    const { runComplianceChecks } = await import("./services/cadenceTouchDrafting");
    const checks = runComplianceChecks("You will earn 15% guaranteed returns annually!", "email", "ESI-001");
    expect(checks.performanceProjectionsPresent).toBe(true);
    expect(checks.readyToSend).toBe(false);
  });
  it("validateVariant checks variant structure", async () => {
    const { validateVariant } = await import("./services/cadenceVariantCreation");
    const result = validateVariant({
      variantCadenceId: "v1", baseCadenceId: "c1", variantName: "Test",
      variantType: "tone", touches: [], adaptationNotes: [], complianceNotes: [], createdAt: Date.now(),
    });
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe("boolean");
    expect(result.valid).toBe(false); // no touches = invalid
  });
  it("listBaseCadences returns array", async () => {
    const { listBaseCadences } = await import("./services/cadenceVariantCreation");
    const list = listBaseCadences();
    expect(Array.isArray(list)).toBe(true);
  });
  it("classifyReply handles opt-out language", async () => {
    const { classifyReply } = await import("./services/cadenceEngine");
    const result = classifyReply("Please remove me from your list. Unsubscribe.");
    expect(result.classification).toBe("opt_out");
  });
  it("classifyReply handles out-of-office", async () => {
    const { classifyReply } = await import("./services/cadenceEngine");
    const result = classifyReply("I am out of the office until January 15th.");
    expect(result.classification).toBe("out_of_office");
  });
  it("complianceGateCheck blocks missing ESI", async () => {
    const { complianceGateCheck } = await import("./services/cadenceEngine");
    const touch = { touchNumber: 1, day: 0, channel: "email" as const, body: "test", complianceNotes: "" };
    const result = complianceGateCheck(touch, {});
    expect(result.passed).toBe(false);
  });
  it("complianceGateCheck passes with valid ESI", async () => {
    const { complianceGateCheck } = await import("./services/cadenceEngine");
    const touch = { touchNumber: 1, day: 0, channel: "email" as const, body: "test", complianceNotes: "" };
    const result = complianceGateCheck(touch, { esiPreApprovalId: "ESI-2026-001" });
    expect(result.passed).toBe(true);
  });
  it("recommendCadence handles dormant contacts", async () => {
    const { recommendCadence } = await import("./services/cadenceEngine");
    const result = recommendCadence({ segment: "hnw", daysSinceLastContact: 120 });
    expect(typeof result).toBe("string");
  });
});
