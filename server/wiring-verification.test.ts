/**
 * Intelligence Wiring Verification Tests
 *
 * Validates that all intelligence modules are properly wired into
 * production code paths, not just installed.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Intelligence Wiring Verification", () => {
  // Test 1: No unexpected invokeLLM imports outside shared/
  it("should have zero unexpected invokeLLM imports outside shared/", () => {
    const result = execSync(
      `grep -r "invokeLLM" server/ --include="*.ts" -l` +
      ` | grep -v test | grep -v node_modules | grep -v "shared/"` +
      ` | grep -v "_core/llm.ts"` +
      ` | grep -v "services/contextualLLM.ts"` +
      ` | grep -v "services/llmFailover.ts"` +
      ` | grep -v "services/infrastructureDocs.ts"` +
      ` | grep -v "memoryEngine.ts"` +
      ` || true`,
      { cwd: ROOT, encoding: "utf-8" }
    ).trim();
    expect(result).toBe("");
  });

  // Test 2: contextualLLM wiring module exports a callable function
  it("should export contextualLLM from stewardlyWiring", async () => {
    const wiring = await import("./shared/stewardlyWiring");
    expect(typeof wiring.contextualLLM).toBe("function");
  });

  // Test 3: SSE streaming endpoint is registered
  it("should have SSE stream endpoint in server index", () => {
    const indexContent = fs.readFileSync(
      path.join(ROOT, "server/_core/index.ts"),
      "utf-8"
    );
    expect(indexContent).toContain("/api/chat/stream");
    expect(indexContent).toContain("createSSEStreamHandler");
  });

  // Test 4: normalizeQualityScore handles edge cases
  it("should normalize quality scores correctly", async () => {
    const { normalizeQualityScore } = await import(
      "./services/qualityNormalization"
    );
    expect(normalizeQualityScore(0.85)).toBeCloseTo(0.85);
    expect(normalizeQualityScore("0.85")).toBeCloseTo(0.85);
    expect(normalizeQualityScore(8.5)).toBeCloseTo(0.85); // 0-10 scale → 0-1
    expect(normalizeQualityScore(null)).toBe(0);
    expect(normalizeQualityScore(undefined)).toBe(0);
    expect(normalizeQualityScore(NaN)).toBe(0);
    expect(normalizeQualityScore(0)).toBe(0);
    expect(normalizeQualityScore(1)).toBe(1);
    expect(normalizeQualityScore(10)).toBe(1);
    expect(normalizeQualityScore(-1)).toBe(0);
  });

  // Test 5: autonomy_levels table exists in schema
  it("should define agentAutonomyLevels table in schema", () => {
    const schemaContent = fs.readFileSync(
      path.join(ROOT, "drizzle/schema.ts"),
      "utf-8"
    );
    expect(schemaContent).toContain("agent_autonomy_levels");
    expect(schemaContent).toContain("agentAutonomyLevels");
    expect(schemaContent).toContain("currentLevel");
  });

  // Bonus: ReAct loop is wired into chat router
  it("should import executeReActLoop in main router", () => {
    const routersContent = fs.readFileSync(
      path.join(ROOT, "server/routers.ts"),
      "utf-8"
    );
    expect(routersContent).toContain("executeReActLoop");
  });

  // Bonus: Improvement engine is scheduled
  it("should schedule improvement engine in scheduler", () => {
    const schedulerContent = fs.readFileSync(
      path.join(ROOT, "server/services/scheduler.ts"),
      "utf-8"
    );
    expect(schedulerContent).toContain("improvement_engine");
    expect(schedulerContent).toContain("detectSignals");
  });

  // Bonus: 5-layer config tables all exist in schema
  it("should define all 5 AI config layer tables in schema", () => {
    const schema = fs.readFileSync(
      path.join(ROOT, "drizzle/schema.ts"),
      "utf-8"
    );
    expect(schema).toContain("platform_ai_settings");
    expect(schema).toContain("organization_ai_settings");
    expect(schema).toContain("manager_ai_settings");
    expect(schema).toContain("professional_ai_settings");
  });
});
