/**
 * Expert Pass 1 — Structural Integrity
 * Validates module boundaries, export hygiene, and project structure.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 1 — Structural Integrity", () => {
  it("server/services directory exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services"))).toBe(true);
  });
  it("shared/ directory has engine, intelligence, automation, calculators", () => {
    for (const d of ["engine", "intelligence", "automation", "calculators"]) {
      expect(fs.existsSync(path.join(ROOT, "server/shared", d))).toBe(true);
    }
  });
  it("drizzle/schema.ts exists and is substantial", () => {
    const s = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(s.split("\n").length).toBeGreaterThan(500);
  });
  it("routers.ts exists and imports tRPC", () => {
    const r = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(r).toContain("router");
    expect(r).toContain("protectedProcedure");
  });
  it("cadenceEngine exports core functions", async () => {
    const mod = await import("./services/cadenceEngine");
    expect(typeof mod.getCadence).toBe("function");
    expect(typeof mod.renderTouch).toBe("function");
    expect(typeof mod.complianceGateCheck).toBe("function");
    expect(typeof mod.checkThrottle).toBe("function");
    expect(typeof mod.classifyReply).toBe("function");
    expect(typeof mod.recommendCadence).toBe("function");
  });
  it("complianceAudit exports auditMessage", async () => {
    const mod = await import("./services/complianceAudit");
    expect(typeof mod.auditMessage).toBe("function");
    expect(typeof mod.selectDailyAuditSample).toBe("function");
    expect(typeof mod.generateMonthlySummary).toBe("function");
    expect(typeof mod.validateEsiTracking).toBe("function");
  });
  it("funnelMetrics exports calculateFunnelMetrics", async () => {
    const mod = await import("./services/funnelMetrics");
    expect(typeof mod.calculateFunnelMetrics).toBe("function");
    expect(typeof mod.calculateFunnelRollup).toBe("function");
    expect(typeof mod.getExpectedMetrics).toBe("function");
  });
  it("patternTransition exports assessTransition", async () => {
    const mod = await import("./services/patternTransition");
    expect(typeof mod.assessTransition).toBe("function");
    expect(typeof mod.calculatePipelineCoverage).toBe("function");
  });
  it("meddpiccFieldCompletion exports core functions", async () => {
    const mod = await import("./services/meddpiccFieldCompletion");
    expect(typeof mod.createEmptyMeddpicc).toBe("function");
    expect(typeof mod.countCompletedFields).toBe("function");
    expect(typeof mod.determineStageRecommendation).toBe("function");
    expect(typeof mod.identifyFocusAreas).toBe("function");
  });
  it("recruitScoring exports calculateComposite and assignTier", async () => {
    const mod = await import("./services/recruitScoring");
    expect(typeof mod.calculateComposite).toBe("function");
    expect(typeof mod.assignTier).toBe("function");
  });
  it("qualityNormalization exports normalizeQualityScore", async () => {
    const mod = await import("./services/qualityNormalization");
    expect(typeof mod.normalizeQualityScore).toBe("function");
  });
  it("cadenceTouchDrafting exports runComplianceChecks", async () => {
    const mod = await import("./services/cadenceTouchDrafting");
    expect(typeof mod.runComplianceChecks).toBe("function");
    expect(typeof mod.validateDraftForSend).toBe("function");
  });
  it("cadenceVariantCreation exports validateVariant", async () => {
    const mod = await import("./services/cadenceVariantCreation");
    expect(typeof mod.validateVariant).toBe("function");
    expect(typeof mod.listBaseCadences).toBe("function");
  });
  it("dynamicIntegrations index re-exports core modules", async () => {
    const mod = await import("./services/dynamicIntegrations");
    expect(mod).toBeDefined();
  });
  it("App.tsx exists and has routes", () => {
    const app = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
    expect(app).toContain("Route");
  });
  it("more than 100 pages exist", () => {
    const pages = fs.readdirSync(path.join(ROOT, "client/src/pages")).filter(f => f.endsWith(".tsx"));
    expect(pages.length).toBeGreaterThan(100);
  });
  it("more than 50 components exist", () => {
    const comps = fs.readdirSync(path.join(ROOT, "client/src/components")).filter(f => f.endsWith(".tsx"));
    expect(comps.length).toBeGreaterThan(50);
  });
  it("shared/calculators has core modules", () => {
    const files = fs.readdirSync(path.join(ROOT, "server/shared/calculators")).filter(f => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(5);
  });
  it("telemetry module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/shared/telemetry"))).toBe(true);
  });
  it("events module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/shared/events"))).toBe(true);
  });
  it("guardrails module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/shared/guardrails"))).toBe(true);
  });
});
