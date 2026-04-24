/**
 * Expert Pass 17 — Adapter Registry & Model Engine
 * Validates dynamic integration adapters and model engine.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 17 — Adapter Registry & Model Engine", () => {
  it("adapterDSL exports serializeSpec", async () => {
    const { serializeSpec } = await import("./services/dynamicIntegrations/adapterDSL");
    expect(typeof serializeSpec).toBe("function");
  });
  it("adapterDSL exports shortFingerprint", async () => {
    const { shortFingerprint } = await import("./services/dynamicIntegrations/adapterDSL");
    expect(typeof shortFingerprint).toBe("function");
  });
  it("adapterRuntime module exports types", async () => {
    const mod = await import("./services/dynamicIntegrations/adapterRuntime");
    expect(mod).toBeDefined();
  });
  it("adapterGenerator module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/adapterGenerator.ts"))).toBe(true);
  });
  it("blueprintExecutor module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/blueprintExecutor.ts"))).toBe(true);
  });
  it("blueprintRegistry module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/blueprintRegistry.ts"))).toBe(true);
  });
  it("blueprintScheduler module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/blueprintScheduler.ts"))).toBe(true);
  });
  it("aiBlueprintDrafter module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/aiBlueprintDrafter.ts"))).toBe(true);
  });
  it("naturalLanguageParser module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/naturalLanguageParser.ts"))).toBe(true);
  });
  it("onboardingWizard module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/onboardingWizard.ts"))).toBe(true);
  });
  it("pipelineOrchestrator module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/pipelineOrchestrator.ts"))).toBe(true);
  });
  it("pipelineTelemetry module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/pipelineTelemetry.ts"))).toBe(true);
  });
  it("rateLimiter module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/rateLimiter.ts"))).toBe(true);
  });
  it("crmCanonicalMap module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/crmCanonicalMap.ts"))).toBe(true);
  });
  it("fieldOverrides module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/fieldOverrides.ts"))).toBe(true);
  });
  it("personalizationHints module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/personalizationHints.ts"))).toBe(true);
  });
  it("authProbe module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/dynamicIntegrations/authProbe.ts"))).toBe(true);
  });
  it("modelEngine exports BUILT_IN_MODELS", async () => {
    const { BUILT_IN_MODELS } = await import("./services/modelEngine");
    expect(Array.isArray(BUILT_IN_MODELS)).toBe(true);
    expect(BUILT_IN_MODELS.length).toBeGreaterThan(0);
  });
  it("modelEngine exports listModels", async () => {
    const { listModels } = await import("./services/modelEngine");
    expect(typeof listModels).toBe("function");
  });
});
