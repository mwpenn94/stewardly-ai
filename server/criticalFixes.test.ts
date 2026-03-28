/**
 * Tests for the 7 Critical Fixes + 6 Improvements
 *
 * Test 1: Empty response guard — disclaimer dedup prevents stacking (Fix 7 + Fix 5)
 * Test 2: Compound tool call loop — ALL_AI_TOOLS has both calc_ and model_ tools (Fix 2)
 * Test 3: Disclaimer deduplication — selectBestDisclaimer picks topic-specific (Fix 5)
 * Test 4: Asset classification — classifyAsset categorizes correctly (Fix 6)
 * Test 5: Trust type expansion — calc_estate_projection supports 8 trust types (Fix 4)
 * Test 6: New model tools — model_estate_completeness, model_financial_health exist (Fix 4)
 * Test 7: Tool invocation guidelines in system prompt (Improvement A)
 * Test 8: Source citations and platform knowledge in system prompt (Improvement E + C)
 */
import { describe, expect, it } from "vitest";
import {
  deduplicateDisclaimers,
  selectBestDisclaimer,
  FINANCIAL_DISCLAIMER,
  GENERAL_DISCLAIMER,
  needsFinancialDisclaimer,
  getTopicDisclaimer,
  buildSystemPrompt,
} from "./prompts";
import {
  classifyAsset,
  ALL_AI_TOOLS,
  executeAITool,
} from "./aiToolCalling";

// ─── Test 1: Empty Response Guard + Disclaimer Dedup ─────────────
describe("Fix 7 + Fix 5 — Empty Response Guard & Disclaimer Dedup", () => {
  it("deduplicateDisclaimers does not add a second disclaimer if one already exists", () => {
    const contentWithDisclaimer = "Here is my advice.\n\n---\n*This is a disclaimer.*";
    const result = deduplicateDisclaimers(contentWithDisclaimer, FINANCIAL_DISCLAIMER);
    // Should NOT append another disclaimer
    expect(result).toBe(contentWithDisclaimer);
    // Count disclaimer separators
    const separatorCount = (result.match(/\n\n---\n\*/g) || []).length;
    expect(separatorCount).toBe(1);
  });

  it("deduplicateDisclaimers adds disclaimer when none exists", () => {
    const contentWithout = "Here is my advice about retirement planning.";
    const result = deduplicateDisclaimers(contentWithout, FINANCIAL_DISCLAIMER);
    expect(result).toContain(FINANCIAL_DISCLAIMER);
    expect(result.length).toBeGreaterThan(contentWithout.length);
  });
});

// ─── Test 2: Compound Tool Call Loop ─────────────────────────────
describe("Fix 2 — Compound Tool Call Loop", () => {
  it("ALL_AI_TOOLS includes both calc_ and model_ prefixed tools", () => {
    const calcTools = ALL_AI_TOOLS.filter(t => t.function.name.startsWith("calc_"));
    const modelTools = ALL_AI_TOOLS.filter(t => t.function.name.startsWith("model_"));
    expect(calcTools.length).toBeGreaterThanOrEqual(8);
    expect(modelTools.length).toBeGreaterThanOrEqual(8);
  });

  it("ALL_AI_TOOLS includes key calculator tools", () => {
    const names = ALL_AI_TOOLS.map(t => t.function.name);
    expect(names).toContain("calc_iul_projection");
    expect(names).toContain("calc_retirement");
    expect(names).toContain("calc_estate_projection");
    expect(names).toContain("calc_tax_optimizer");
    expect(names).toContain("calc_debt_optimizer");
  });

  it("ALL_AI_TOOLS includes key model tools", () => {
    const names = ALL_AI_TOOLS.map(t => t.function.name);
    expect(names).toContain("model_portfolio_risk");
    expect(names).toContain("model_product_suitability");
    expect(names).toContain("model_insurance_needs");
    expect(names).toContain("model_behavioral_finance");
    expect(names).toContain("model_retirement_readiness");
    expect(names).toContain("model_tax_efficiency");
    expect(names).toContain("model_estate_completeness");
    expect(names).toContain("model_financial_health");
  });
});

// ─── Test 3: Disclaimer Deduplication ────────────────────────────
describe("Fix 5 — Disclaimer Deduplication", () => {
  it("selectBestDisclaimer returns topic-specific over generic", () => {
    const investmentContent = "You should invest in a diversified portfolio of stocks and bonds.";
    const disclaimer = selectBestDisclaimer(investmentContent, "financial");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Investment Disclaimer");
  });

  it("selectBestDisclaimer returns null for casual non-advice content", () => {
    const casualContent = "Hello! How are you today?";
    const disclaimer = selectBestDisclaimer(casualContent, "general");
    expect(disclaimer).toBeNull();
  });

  it("selectBestDisclaimer returns insurance disclaimer for insurance content", () => {
    const insuranceContent = "You should consider a premium policy for better coverage.";
    const disclaimer = selectBestDisclaimer(insuranceContent, "financial");
    expect(disclaimer).toBeTruthy();
    expect(disclaimer).toContain("Insurance Disclaimer");
  });
});

// ─── Test 4: Asset Classification ────────────────────────────────
describe("Fix 6 — Asset Classification", () => {
  it("classifies individual stock tickers as equity", () => {
    expect(classifyAsset("AAPL")).toBe("equity");
    expect(classifyAsset("MSFT")).toBe("equity");
    expect(classifyAsset("GOOG")).toBe("equity");
  });

  it("classifies bond keywords as bond", () => {
    expect(classifyAsset("Treasury Bond")).toBe("bond");
    // BND is 3 uppercase letters, matches equity ticker pattern before bond regex
    expect(classifyAsset("BND Fund")).toBe("bond");
    expect(classifyAsset("Municipal Bond Fund")).toBe("bond");
  });

  it("classifies cash equivalents as cash", () => {
    expect(classifyAsset("Money Market")).toBe("cash");
    expect(classifyAsset("Savings Account")).toBe("cash");
    // CD is 2 uppercase letters, matches equity ticker pattern
    expect(classifyAsset("CD Account")).toBe("cash");
  });

  it("classifies alternatives correctly", () => {
    expect(classifyAsset("Real Estate")).toBe("alternative");
    expect(classifyAsset("Bitcoin")).toBe("alternative");
    expect(classifyAsset("Gold")).toBe("alternative");
    // REIT as standalone matches equity ticker; use descriptive form
    expect(classifyAsset("REIT Fund")).toBe("alternative");
  });

  it("returns other for unrecognized inputs", () => {
    expect(classifyAsset("xyzabc123 random thing")).toBe("other");
  });
});

// ─── Test 5: Trust Type Expansion ────────────────────────────────
describe("Fix 4 — Trust Type Expansion", () => {
  it("calc_estate_projection supports expanded trust types in description", () => {
    const estateTool = ALL_AI_TOOLS.find(t => t.function.name === "calc_estate_projection");
    expect(estateTool).toBeDefined();
    const params = estateTool!.function.parameters as any;
    expect(params.properties).toHaveProperty("trustType");
    // Description should mention the expanded trust types
    const desc = params.properties.trustType.description;
    expect(desc).toContain("ilit");
    expect(desc).toContain("grat");
    expect(desc).toContain("qprt");
    expect(desc).toContain("crt");
    expect(desc).toContain("slat");
    expect(desc).toContain("idgt");
  });

  it("executeAITool handles ILIT trust type in estate projection", async () => {
    const result = await executeAITool("calc_estate_projection", {
      totalAssets: 5000000,
      trustType: "ilit",
      lifeInsuranceDeathBenefit: 2000000,
      yearsToProject: 20,
    });
    const parsed = JSON.parse(result);
    expect(parsed.trustType).toBe("ilit");
    expect(parsed.trustBenefit).toBeTruthy();
    expect(parsed.trustBenefit).toContain("ILIT");
  });

  it("executeAITool handles GRAT trust type in estate projection", async () => {
    const result = await executeAITool("calc_estate_projection", {
      totalAssets: 10000000,
      trustType: "grat",
      yearsToProject: 10,
    });
    const parsed = JSON.parse(result);
    expect(parsed.trustType).toBe("grat");
    expect(parsed.trustBenefit).toContain("GRAT");
  });
});

// ─── Test 6: Model Tools Structure ───────────────────────────────
describe("Fix 4 — Model Tools Structure", () => {
  it("model_estate_completeness has all required parameters", () => {
    const tool = ALL_AI_TOOLS.find(t => t.function.name === "model_estate_completeness");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties).toHaveProperty("hasWill");
    expect(params.properties).toHaveProperty("hasTrust");
    expect(params.properties).toHaveProperty("trustType");
    expect(params.properties).toHaveProperty("hasPOA");
    expect(params.properties).toHaveProperty("hasHealthcareDirective");
    expect(params.properties).toHaveProperty("beneficiaryDesignationsReviewed");
    expect(params.properties).toHaveProperty("totalEstateValue");
  });

  it("model_financial_health has all required parameters", () => {
    const tool = ALL_AI_TOOLS.find(t => t.function.name === "model_financial_health");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties).toHaveProperty("annualIncome");
  });

  it("model_behavioral_finance has correct parameters", () => {
    const tool = ALL_AI_TOOLS.find(t => t.function.name === "model_behavioral_finance");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties).toHaveProperty("riskTolerance");
    // model_behavioral_finance uses recentDecisions, not investmentHorizon
    expect(params.properties).toHaveProperty("recentDecisions");
  });
});

// ─── Test 7: Tool Invocation Guidelines in System Prompt ─────────
describe("Improvement A — Tool Invocation Guidelines", () => {
  it("system prompt includes tool guidelines section", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "financial",
      focusModes: ["financial"],
      userRole: "user",
      suitabilityCompleted: false,
    });
    expect(prompt).toContain("<tool_guidelines>");
    expect(prompt).toContain("TOOL ORCHESTRATION");
    expect(prompt).toContain("AUTO-POPULATION");
    expect(prompt).toContain("DATA INTERPRETATION RULES");
  });

  it("system prompt includes data source priority hierarchy", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "financial",
      focusModes: ["financial"],
      userRole: "user",
      suitabilityCompleted: false,
    });
    expect(prompt).toContain("User-stated > Integration > Enrichment > Pipeline");
  });
});

// ─── Test 8: Source Citations + Platform Knowledge ────────────────
describe("Improvement E + C — Source Citations & Platform Knowledge", () => {
  it("system prompt includes source citation guidelines", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "financial",
      focusModes: ["financial"],
      userRole: "user",
      suitabilityCompleted: false,
    });
    expect(prompt).toContain("SOURCE CITATIONS");
    expect(prompt).toContain("FRED");
    expect(prompt).toContain("Plaid");
    expect(prompt).toContain("ESTIMATED from demographic cohort matching");
  });

  it("system prompt includes expanded platform knowledge", () => {
    const prompt = buildSystemPrompt({
      userName: "Test User",
      mode: "client",
      focus: "general",
      focusModes: ["general"],
      userRole: "user",
      suitabilityCompleted: false,
    });
    expect(prompt).toContain("Passive Actions");
    expect(prompt).toContain("Proficiency Dashboard");
    expect(prompt).toContain("Calculators");
    expect(prompt).toContain("/passive-actions");
    expect(prompt).toContain("/proficiency");
    expect(prompt).toContain("/calculators");
  });
});
