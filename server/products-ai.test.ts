import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── HELPERS ────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-1",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── CALCULATOR TESTS ───────────────────────────────────────────────
describe("calculators", () => {
  it("iulProjection returns valid projections", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.calculators.iulProjection({
      age: 35,
      annualPremium: 12000,
      years: 10,
      illustratedRate: 6.5,
      deathBenefit: 500000,
    });

    expect(result.projections).toHaveLength(10);
    expect(result.totalPremiums).toBe(120000);
    expect(result.projections[0]).toHaveProperty("year", 1);
    expect(result.projections[0]).toHaveProperty("age", 36);
    expect(result.projections[0]).toHaveProperty("cashValue");
    expect(result.projections[0]).toHaveProperty("surrenderValue");
    expect(result.projections[0]).toHaveProperty("deathBenefit");
    // Cash value should grow over time
    expect(result.projections[9]!.cashValue).toBeGreaterThan(result.projections[0]!.cashValue);
  });

  it("premiumFinance returns valid projections with ROI", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.calculators.premiumFinance({
      faceAmount: 5000000,
      annualPremium: 100000,
      loanRate: 5.5,
      years: 10,
      collateralRate: 2.0,
    });

    expect(result.projections).toHaveLength(10);
    expect(result).toHaveProperty("totalCollateralCost");
    expect(result).toHaveProperty("roi");
    expect(result.projections[0]).toHaveProperty("loanBalance");
    expect(result.projections[0]).toHaveProperty("policyValue");
    expect(result.projections[0]).toHaveProperty("netEquity");
  });

  it("retirement returns valid projections with income estimate", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.calculators.retirement({
      currentAge: 35,
      retirementAge: 65,
      currentSavings: 50000,
      monthlyContribution: 1500,
      expectedReturn: 7.0,
      inflationRate: 3.0,
    });

    expect(result.projections).toHaveLength(30);
    expect(result).toHaveProperty("finalBalance");
    expect(result).toHaveProperty("estimatedMonthlyIncome");
    expect(result.finalBalance).toBeGreaterThan(50000);
    expect(result.estimatedMonthlyIncome).toBeGreaterThan(0);
    // Nominal should be greater than real (inflation-adjusted)
    const lastProj = result.projections[result.projections.length - 1]!;
    expect(lastProj.nominalBalance).toBeGreaterThan(lastProj.realBalance);
  });

  it("iulProjection rejects invalid age", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.calculators.iulProjection({
        age: 10, // below min of 18
        annualPremium: 12000,
        years: 10,
        illustratedRate: 6.5,
        deathBenefit: 500000,
      })
    ).rejects.toThrow();
  });
});

// ─── AI CONFIG RESOLVER TESTS ───────────────────────────────────────
describe("aiConfigResolver", () => {
  it("resolveAIConfig module exports correctly", async () => {
    const { resolveAIConfig, buildLayerOverlayPrompt } = await import("./aiConfigResolver");
    expect(typeof resolveAIConfig).toBe("function");
    expect(typeof buildLayerOverlayPrompt).toBe("function");
  });

  it("buildLayerOverlayPrompt handles empty config", async () => {
    const { buildLayerOverlayPrompt } = await import("./aiConfigResolver");
    const result = buildLayerOverlayPrompt({
      toneStyle: "professional",
      responseFormat: "detailed",
      responseLength: "balanced",
      temperature: 0.7,
      maxTokens: 2048,
      promptOverlays: [],
      guardrails: [],
      prohibitedTopics: [],
      approvedProductCategories: null,
      complianceLanguage: null,
      customDisclaimers: null,
      platformDisclaimer: null,
      brandVoice: null,
      communicationStyle: "detailed",
      customPromptAdditions: null,
      enabledFocusModes: ["general", "financial"],
      modelPreferences: {},
      ensembleWeights: {},
      layerSources: [],
    });
    expect(typeof result).toBe("string");
    expect(result).toContain("professional");
  });

  it("buildLayerOverlayPrompt includes guardrails and overlays", async () => {
    const { buildLayerOverlayPrompt } = await import("./aiConfigResolver");
    const result = buildLayerOverlayPrompt({
      toneStyle: "conversational",
      responseFormat: "concise",
      responseLength: "concise",
      temperature: 0.5,
      maxTokens: 2048,
      promptOverlays: [{ layer: "L1-Platform", content: "Always greet the user warmly" }],
      guardrails: ["Never discuss competitor pricing", "Always include disclaimers"],
      prohibitedTopics: ["cryptocurrency"],
      approvedProductCategories: null,
      complianceLanguage: null,
      customDisclaimers: null,
      platformDisclaimer: null,
      brandVoice: null,
      communicationStyle: "detailed",
      customPromptAdditions: null,
      enabledFocusModes: ["general"],
      modelPreferences: {},
      ensembleWeights: {},
      layerSources: [],
    });
    expect(result).toContain("Never discuss competitor pricing");
    expect(result).toContain("Always include disclaimers");
    expect(result).toContain("greet the user warmly");
    expect(result).toContain("cryptocurrency");
  });
});

// ─── PRODUCTS ROUTER TESTS ──────────────────────────────────────────
describe("products router", () => {
  it("products.create rejects non-admin platform product creation", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));
    await expect(
      caller.products.create({
        company: "Test Co",
        name: "Test Product",
        category: "iul",
        isPlatform: true,
      })
    ).rejects.toThrow(/platform admin/i);
  });
});
