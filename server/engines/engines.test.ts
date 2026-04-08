/**
 * Comprehensive Engine Test Suite — Tasks 1-10
 *
 * Tests UWE, BIE, HE, SCUI engines + GHL sync + Plaid perception
 * + compliance verification + improvement engine + HTML maintenance.
 */
import { describe, expect, it } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// UWE ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("UWE Engine", () => {
  it("should import and expose public API", async () => {
    const uwe = await import("./uwe");
    expect(typeof uwe.simulate).toBe("function");
    expect(typeof uwe.buildStrategy).toBe("function");
    expect(typeof uwe.estPrem).toBe("function");
    expect(typeof uwe.monteCarlo).toBe("function");
    expect(typeof uwe.COMPANIES).toBe("object");
    // MODEL_MAP is internal, not exported
  });

  it("should have valid company profiles", async () => {
    const { COMPANIES } = await import("./uwe");
    expect(Object.keys(COMPANIES).length).toBeGreaterThanOrEqual(5);
    for (const [key, co] of Object.entries(COMPANIES)) {
      expect(co.name).toBeTruthy();
      expect(co.products).toBeInstanceOf(Array);
      // donothing has empty products array, skip length check for it
    }
  });

  it("should have UWE barrel export with key methods", async () => {
    const { UWE } = await import("./uwe");
    expect(typeof UWE.simulate).toBe("function");
    expect(typeof UWE.buildStrategy).toBe("function");
    expect(typeof UWE.estPrem).toBe("function");
    expect(typeof UWE.monteCarlo).toBe("function");
    expect(typeof UWE.getCompanyKeys).toBe("function");
    expect(UWE.getCompanyKeys().length).toBeGreaterThanOrEqual(5);
  });

  it("should build a strategy and simulate a 30-year projection", async () => {
    const { buildStrategy, simulate, COMPANIES } = await import("./uwe");
    const profile = { age: 35, income: 100000, netWorth: 350000, savings: 50000, dependents: 2, mortgage: 250000, debts: 30000 };
    const strategy = buildStrategy("wealthbridge", profile);

    expect(strategy).toBeDefined();
    expect(strategy.company).toBe("wealthbridge");
    expect(strategy.products.length).toBeGreaterThan(0);

    const results = simulate(strategy, 30);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(30);
    expect(results[29].totalValue).toBeGreaterThan(0);
    expect(results[29].netValue).toBeGreaterThan(0);
    expect(results[29].roi).toBeGreaterThan(0);
  });

  it("should produce increasing values over time", async () => {
    const { buildStrategy, simulate } = await import("./uwe");
    const profile = { age: 30, income: 80000, savings: 20000, dependents: 1, mortgage: 200000, debts: 10000 };
    const strategy = buildStrategy("wealthbridge", profile);
    const results = simulate(strategy, 20);

    // Values should generally increase
    for (let i = 1; i < results.length; i++) {
      expect(results[i].totalValue).toBeGreaterThanOrEqual(results[i - 1].totalValue * 0.90);
    }
  });

  it("should build multi-company strategies via UWE barrel", async () => {
    const { buildStrategy, simulate, COMPANIES } = await import("./uwe");
    const profile = { age: 35, income: 100000, savings: 50000 };
    const companyKeys = Object.keys(COMPANIES);

    for (const key of companyKeys.slice(0, 3)) {
      const strategy = buildStrategy(key as any, profile);
      expect(strategy.company).toBe(key);
      const results = simulate(strategy, 10);
      expect(results.length).toBe(10);
    }
  });

  it("should estimate premiums", async () => {
    const { estPrem } = await import("./uwe");
    const premium = estPrem("term", 35, 500000);
    expect(premium).toBeGreaterThan(0);
    expect(premium).toBeLessThan(50000);
  });

  it("should run Monte Carlo simulation", async () => {
    const { buildStrategy, monteCarlo } = await import("./uwe");
    const profile = { age: 35, income: 100000, savings: 50000, equitiesReturn: 0.07 };
    const strategy = buildStrategy("wealthbridge", profile);
    const results = monteCarlo(strategy, 20, 100, 0.15);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(20);
    expect(results[19].p90).toBeGreaterThanOrEqual(results[19].p50);
    expect(results[19].p50).toBeGreaterThanOrEqual(results[19].p10);
  });

  it("should handle edge case: zero savings", async () => {
    const { buildStrategy, simulate } = await import("./uwe");
    const profile = { age: 35, income: 100000, savings: 0, monthlySavings: 0 };
    const strategy = buildStrategy("wealthbridge", profile);
    const results = simulate(strategy, 10);
    expect(results.length).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BIE ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("BIE Engine", () => {
  it("should import and expose public API", async () => {
    const bie = await import("./bie");
    expect(typeof bie.simulate).toBe("function");
    expect(typeof bie.backPlan).toBe("function");
    expect(typeof bie.rollUp).toBe("function");
    expect(typeof bie.rollDown).toBe("function");
    expect(typeof bie.createStrategy).toBe("function");
    expect(typeof bie.calcEconomics).toBe("function");
    expect(bie.ROLES).toBeDefined();
    expect(bie.GDC_BRACKETS).toBeInstanceOf(Array);
    expect(bie.CHANNELS).toBeDefined();
  });

  it("should have valid roles", async () => {
    const { ROLES } = await import("./bie");
    expect(Object.keys(ROLES).length).toBeGreaterThanOrEqual(4);
    for (const [key, role] of Object.entries(ROLES)) {
      expect(role.name).toBeTruthy();
      expect(role.baseGDC).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have valid GDC brackets", async () => {
    const { GDC_BRACKETS } = await import("./bie");
    expect(GDC_BRACKETS.length).toBeGreaterThanOrEqual(3);
    for (const bracket of GDC_BRACKETS) {
      expect(bracket.min).toBeGreaterThanOrEqual(0);
      expect(bracket.rate).toBeGreaterThan(0);
    }
  });

  it("should simulate business income with createStrategy", async () => {
    const { createStrategy, simulate } = await import("./bie");
    const strategy = createStrategy("Test Associate", { role: "new", personalGDC: 65000 });
    const results = simulate(strategy, 5);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(5);
    expect(results[0].totalIncome).toBeGreaterThan(0);
  });

  it("should calculate back-plan", async () => {
    const { backPlan } = await import("./bie");
    const result = backPlan(100000, "new");

    expect(result).toBeDefined();
    expect(result.neededGDC).toBeGreaterThan(0);
    expect(result.funnel.approaches).toBeGreaterThan(0);
    expect(result.funnel.monthly.apps).toBeGreaterThan(0);
  });

  it("should calculate roll-up economics", async () => {
    const { createStrategy, rollUp } = await import("./bie");
    const strategies = [
      createStrategy("Agent 1", { role: "new", personalGDC: 50000 }),
      createStrategy("Agent 2", { role: "exp", personalGDC: 100000 }),
    ];
    const result = rollUp(strategies, 1);

    expect(result).toBeDefined();
    expect(result.totalGDC).toBeGreaterThan(0);
    expect(result.totalIncome).toBeGreaterThan(0);
  });

  it("should calculate roll-down economics", async () => {
    const { createStrategy, rollDown } = await import("./bie");
    const strategy = createStrategy("Director", { role: "dir", personalGDC: 200000 });
    const result = rollDown(strategy, 1);

    expect(result).toBeDefined();
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it("should use presets", async () => {
    const { presetNewAssociate, presetExperiencedPro, presetDirector, simulate } = await import("./bie");
    const strats = [presetNewAssociate(), presetExperiencedPro(), presetDirector()];
    for (const s of strats) {
      expect(s.role).toBeTruthy();
      const results = simulate(s, 3);
      expect(results.length).toBe(3);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HE ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("HE Engine", () => {
  it("should import and expose public API", async () => {
    const he = await import("./he");
    expect(typeof he.simulate).toBe("function");
    expect(typeof he.compareStrategies).toBe("function");
    expect(typeof he.backPlanHolistic).toBe("function");
    expect(typeof he.createHolisticStrategy).toBe("function");
    expect(typeof he.presetWealthBridgeClient).toBe("function");
    expect(typeof he.presetDoNothing).toBe("function");
  });

  it("should simulate holistic projection using presets", async () => {
    const { presetWealthBridgeClient, simulate } = await import("./he");
    const strategy = presetWealthBridgeClient({ age: 35, income: 100000 });
    const results = simulate(strategy, 10);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(10);
    expect(results[9].totalValue).toBeGreaterThan(0);
    expect(results[9].totalNetIncome).toBeGreaterThanOrEqual(0);
  });

  it("should compare multiple strategies", async () => {
    const { presetWealthBridgeClient, presetDoNothing, compareStrategies } = await import("./he");
    const strategies = [
      presetWealthBridgeClient({ age: 35, income: 100000 }),
      presetDoNothing({ age: 35, income: 100000 }),
    ];
    const result = compareStrategies(strategies, 20);

    expect(result).toBeDefined();
    expect(result.entries.length).toBe(2);
    expect(result.comparison.length).toBe(2);
    expect(result.winners).toBeDefined();
  });

  it("should calculate holistic back-plan", async () => {
    const { presetWealthBridgeClient, backPlanHolistic } = await import("./he");
    const strategy = presetWealthBridgeClient({ age: 35, income: 100000 });
    const result = backPlanHolistic(1000000, 20, strategy);

    expect(result).toBeDefined();
    expect(result.requiredIncome).toBeGreaterThan(0);
    expect(result.targetValue).toBe(1000000);
    expect(result.targetYear).toBe(20);
  });

  it("should create holistic strategy with BIE component", async () => {
    const { createHolisticStrategy, simulate } = await import("./he");
    const { createStrategy: createBIE } = await import("./bie");
    const { buildStrategy: buildUWE } = await import("./uwe");

    const profile = { age: 35, income: 100000, savings: 50000 };
    const bieStrat = createBIE("Test BIE", { role: "new", personalGDC: 65000 });
    const uweStrat = buildUWE("wealthbridge", profile);

    const holistic = createHolisticStrategy("Combined", {
      hasBizIncome: true,
      bizStrategy: bieStrat,
      wealthStrategy: uweStrat,
      profile,
      companyKey: "wealthbridge",
      savingsRate: 0.15,
      investmentReturn: 0.07,
    });

    const results = simulate(holistic, 10);
    expect(results.length).toBe(10);
    expect(results[9].bizIncome).toBeGreaterThan(0);
    expect(results[9].totalValue).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCUI ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("SCUI Engine", () => {
  it("should import and expose public API", async () => {
    const scui = await import("./scui");
    expect(typeof scui.stressTest).toBe("function");
    expect(typeof scui.historicalBacktest).toBe("function");
    expect(typeof scui.checkGuardrails).toBe("function");
    expect(scui.SP500_HISTORY).toBeDefined();
    expect(scui.STRESS_SCENARIOS).toBeDefined();
    expect(scui.PRODUCT_REFERENCES).toBeDefined();
    expect(scui.INDUSTRY_BENCHMARKS).toBeDefined();
    expect(scui.METHODOLOGY_DISCLOSURE).toBeDefined();
  });

  it("should have S&P 500 historical data", async () => {
    const { SP500_HISTORY } = await import("./scui");
    expect(Object.keys(SP500_HISTORY).length).toBeGreaterThanOrEqual(90);
    expect(SP500_HISTORY[1928]).toBeDefined();
    expect(SP500_HISTORY[2024]).toBeDefined();
  });

  it("should have stress scenarios as a record", async () => {
    const { STRESS_SCENARIOS } = await import("./scui");
    const keys = Object.keys(STRESS_SCENARIOS);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys).toContain("dotcom");
    expect(keys).toContain("gfc");
    expect(keys).toContain("covid");
    for (const key of keys) {
      const scenario = STRESS_SCENARIOS[key];
      expect(scenario.name).toBeTruthy();
      expect(scenario.years).toBeInstanceOf(Array);
      expect(scenario.returns).toBeInstanceOf(Array);
    }
  });

  it("should run stress test with valid scenario key", async () => {
    const { stressTest } = await import("./scui");
    const result = stressTest("gfc", 1000000, 15000, 0);

    expect(result).not.toBeNull();
    expect(result!.scenario.name).toContain("Financial Crisis");
    expect(result!.maxDrawdown).toBeGreaterThan(0);
    expect(result!.maxDrawdown).toBeLessThanOrEqual(1);
    expect(result!.finalBalance).toBeGreaterThan(0);
  });

  it("should return null for invalid scenario key", async () => {
    const { stressTest } = await import("./scui");
    const result = stressTest("nonexistent", 1000000);
    expect(result).toBeNull();
  });

  it("should run historical backtest", async () => {
    const { historicalBacktest } = await import("./scui");
    const result = historicalBacktest(100000, 10000, 0, 30);

    expect(result).toBeDefined();
    expect(result.survived).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.survivalRate).toBeGreaterThan(0);
    expect(result.medianFinal).toBeGreaterThan(0);
  });

  it("should have product references", async () => {
    const { PRODUCT_REFERENCES } = await import("./scui");
    expect(Object.keys(PRODUCT_REFERENCES).length).toBeGreaterThan(0);
    expect(PRODUCT_REFERENCES.term).toBeDefined();
    expect(PRODUCT_REFERENCES.iul).toBeDefined();
    expect(PRODUCT_REFERENCES.term.src).toBeTruthy();
  });

  it("should have industry benchmarks", async () => {
    const { INDUSTRY_BENCHMARKS } = await import("./scui");
    expect(INDUSTRY_BENCHMARKS.savingsRate).toBeDefined();
    expect(INDUSTRY_BENCHMARKS.savingsRate.national).toBe(0.062);
  });

  it("should have methodology disclosure", async () => {
    const { METHODOLOGY_DISCLOSURE } = await import("./scui");
    expect(METHODOLOGY_DISCLOSURE.uwe).toBeTruthy();
    expect(METHODOLOGY_DISCLOSURE.bie).toBeTruthy();
    expect(METHODOLOGY_DISCLOSURE.he).toBeTruthy();
    expect(METHODOLOGY_DISCLOSURE.mc).toBeTruthy();
    expect(METHODOLOGY_DISCLOSURE.disclaimer).toBeTruthy();
  });

  it("should check guardrails", async () => {
    const { checkGuardrails } = await import("./scui");
    const warnings = checkGuardrails({ returnRate: 0.15, savingsRate: 0.60 });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.field === "returnRate")).toBe(true);
    expect(warnings.some((w) => w.field === "savingsRate")).toBe(true);

    const clean = checkGuardrails({ returnRate: 0.07, savingsRate: 0.15 });
    expect(clean.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GHL CALCULATOR SYNC TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("GHL Calculator Sync", () => {
  it("should import and expose public API", async () => {
    const ghl = await import("../services/crm/ghlCalculatorSync");
    expect(typeof ghl.classifyPlanType).toBe("function");
    expect(typeof ghl.classifyStrategy).toBe("function");
    expect(typeof ghl.buildGHLPayload).toBe("function");
    expect(typeof ghl.getAutomationTags).toBe("function");
    expect(typeof ghl.shouldTriggerPlanShared).toBe("function");
  });

  it("should classify plan types correctly", async () => {
    const { classifyPlanType } = await import("../services/crm/ghlCalculatorSync");
    expect(classifyPlanType(500000, 2)).toBe("basic");
    expect(classifyPlanType(1500000, 3)).toBe("growth");
    expect(classifyPlanType(6000000, 7)).toBe("premium");
  });

  it("should classify strategies correctly", async () => {
    const { classifyStrategy } = await import("../services/crm/ghlCalculatorSync");
    expect(classifyStrategy(0.04, 0.10, false, "wealthbridge")).toBe("conservative-dividend");
    expect(classifyStrategy(0.07, 0.20, false, "wealthbridge")).toBe("balanced-growth");
    expect(classifyStrategy(0.12, 0.15, false, "wealthbridge")).toBe("aggressive-equity");
    expect(classifyStrategy(0.08, 0.15, true, "wealthbridge")).toBe("tax-optimized-hybrid");
  });

  it("should build valid GHL payload", async () => {
    const { buildGHLPayload } = await import("../services/crm/ghlCalculatorSync");
    const fieldMapping = {
      calculatorCompletedDate: "field1",
      calculatorLastRunDate: "field2",
      planType: "field3",
      totalValue30yr: "field4",
      roi30yr: "field5",
      strategyRecommended: "field6",
      affiliateTrackA: "field7",
      affiliateTrackB: "field8",
      bizIncomeProjection: "field9",
      savingsRate: "field10",
      returnRate: "field11",
      planShareUrl: "field12",
      calculatorRunCount: "field13",
    };

    const result = buildGHLPayload(
      {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        totalValue30yr: 2000000,
        roi30yr: 52,
        strategySlug: "balanced-growth",
        planType: "growth",
        savingsRate: 0.15,
        returnRate: 0.07,
        planSummary: {
          headline: "Test Plan",
          strategyBreakdown: [],
          generatedAt: new Date().toISOString(),
        },
      },
      fieldMapping,
      null,
    );

    expect(result.contactPayload.email).toBe("test@example.com");
    expect(result.contactPayload.firstName).toBe("Test");
    expect(result.tags).toContain("calculator-completed");
    expect(result.tags).toContain("strategy-balanced-growth");
    expect(result.tags).toContain("high-roi-priority");
    expect(result.isUpdate).toBe(false);
  });

  it("should generate correct automation tags", async () => {
    const { getAutomationTags } = await import("../services/crm/ghlCalculatorSync");

    const baseResult = {
      firstName: "A", lastName: "B", email: "a@b.com",
      totalValue30yr: 1000000, roi30yr: 30,
      strategySlug: "balanced-growth" as const, planType: "growth" as const,
      savingsRate: 0.15, returnRate: 0.07,
      planSummary: { headline: "", strategyBreakdown: [], generatedAt: "" },
    };

    const tags1 = getAutomationTags(baseResult, 1);
    expect(tags1).toContain("calculator-completed");
    expect(tags1).toContain("strategy-balanced-growth");
    expect(tags1).not.toContain("high-roi-priority");
    expect(tags1).not.toContain("strategy-comparer");

    const tags2 = getAutomationTags({ ...baseResult, roi30yr: 55 }, 3);
    expect(tags2).toContain("high-roi-priority");
    expect(tags2).toContain("strategy-comparer");
  });

  it("should detect plan share trigger", async () => {
    const { shouldTriggerPlanShared } = await import("../services/crm/ghlCalculatorSync");
    expect(shouldTriggerPlanShared(null, "https://example.com/plan/123")).toBe(true);
    expect(shouldTriggerPlanShared("https://example.com/plan/old", "https://example.com/plan/new")).toBe(false);
    expect(shouldTriggerPlanShared(null, null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PLAID PERCEPTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Plaid Perception", () => {
  it("should import and expose public API", async () => {
    const plaid = await import("../services/plaidPerception");
    expect(typeof plaid.enrichPlaidAccounts).toBe("function");
    expect(typeof plaid.mapToUWEInput).toBe("function");
  });

  it("should enrich Plaid accounts correctly", async () => {
    const { enrichPlaidAccounts } = await import("../services/plaidPerception");

    const accounts = [
      { accountId: "1", name: "Checking", type: "depository" as const, subtype: "checking", balances: { available: 5000, current: 5000, limit: null } },
      { accountId: "2", name: "Savings", type: "depository" as const, subtype: "savings", balances: { available: 20000, current: 20000, limit: null } },
      { accountId: "3", name: "Brokerage", type: "investment" as const, subtype: "brokerage", balances: { available: null, current: 50000, limit: null } },
      { accountId: "4", name: "Credit Card", type: "credit" as const, subtype: "credit card", balances: { available: 8000, current: 2000, limit: 10000 } },
    ];

    const transactions = [
      { transactionId: "t1", accountId: "1", amount: -5000, date: new Date().toISOString(), category: ["Transfer", "Payroll"], merchantName: "Employer" },
      { transactionId: "t2", accountId: "1", amount: 1500, date: new Date().toISOString(), category: ["Housing", "Rent"], merchantName: "Landlord" },
    ];

    const result = enrichPlaidAccounts(accounts, transactions, 35);

    expect(result.totalAssets).toBe(75000);
    expect(result.totalLiabilities).toBe(2000);
    expect(result.netWorth).toBe(73000);
    expect(result.liquidAssets).toBe(25000);
    expect(result.investmentAssets).toBe(50000);
    expect(result.riskProfile).toBeDefined();
    expect(result.insights).toBeInstanceOf(Array);
    expect(result.uweProfile).toBeDefined();
    expect(result.uweProfile.age).toBe(35);
  });

  it("should map enriched data to UWE input", async () => {
    const { enrichPlaidAccounts, mapToUWEInput } = await import("../services/plaidPerception");

    const accounts = [
      { accountId: "1", name: "Checking", type: "depository" as const, subtype: "checking", balances: { available: 10000, current: 10000, limit: null } },
    ];

    const enriched = enrichPlaidAccounts(accounts, [], 40);
    const uweInput = mapToUWEInput(enriched);

    expect(uweInput.age).toBe(40);
    expect(uweInput.horizon).toBe(25);
    expect(uweInput.investmentReturn).toBeGreaterThan(0);
    expect(uweInput.companyKey).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE VERIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Compliance Verification", () => {
  it("should import and expose public API", async () => {
    const compliance = await import("../services/complianceVerification");
    expect(compliance.METHODOLOGY_DISCLOSURES).toBeDefined();
    expect(compliance.PRODUCT_CITATIONS).toBeInstanceOf(Array);
    expect(compliance.INDUSTRY_BENCHMARKS).toBeInstanceOf(Array);
    expect(typeof compliance.validateCompliance).toBe("function");
    expect(typeof compliance.getComplianceBundle).toBe("function");
  });

  it("should have methodology disclosures for all engines", async () => {
    const { METHODOLOGY_DISCLOSURES } = await import("../services/complianceVerification");
    expect(METHODOLOGY_DISCLOSURES.uwe).toBeDefined();
    expect(METHODOLOGY_DISCLOSURES.bie).toBeDefined();
    expect(METHODOLOGY_DISCLOSURES.he).toBeDefined();
    expect(METHODOLOGY_DISCLOSURES.monteCarlo).toBeDefined();
    expect(METHODOLOGY_DISCLOSURES.stressTest).toBeDefined();

    for (const [key, disc] of Object.entries(METHODOLOGY_DISCLOSURES)) {
      expect(disc.assumptions.length).toBeGreaterThan(0);
      expect(disc.limitations.length).toBeGreaterThan(0);
      expect(disc.sources.length).toBeGreaterThan(0);
    }
  });

  it("should validate compliance correctly — fully compliant", async () => {
    const { validateCompliance } = await import("../services/complianceVerification");
    const checks = validateCompliance({
      hasDisclaimer: true,
      hasMethodology: true,
      hasSources: true,
      illustratedRateUsed: 0.07,
      guaranteedRateShown: true,
      projectionHorizon: 30,
      includesStressTest: true,
    });
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("should validate compliance correctly — non-compliant", async () => {
    const { validateCompliance } = await import("../services/complianceVerification");
    const checks = validateCompliance({
      hasDisclaimer: false,
      hasMethodology: false,
      hasSources: false,
      illustratedRateUsed: 0.15,
      guaranteedRateShown: false,
      projectionHorizon: 50,
      includesStressTest: false,
    });
    const errors = checks.filter((c) => c.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should return compliance bundle for engine type", async () => {
    const { getComplianceBundle } = await import("../services/complianceVerification");
    const bundle = getComplianceBundle("uwe");
    expect(bundle.methodology).toBeDefined();
    expect(bundle.methodology!.title).toContain("UWE");
    expect(bundle.citations.length).toBeGreaterThan(0);
    expect(bundle.benchmarks.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMPROVEMENT ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Improvement Engine", () => {
  it("should import and expose public API", async () => {
    const engine = await import("../services/improvementEngine");
    expect(typeof engine.recordSignal).toBe("function");
    expect(typeof engine.runImprovementPass).toBe("function");
    expect(typeof engine.verifyParity).toBe("function");
    expect(typeof engine.getImprovementState).toBe("function");
  });

  it("should record and track signals", async () => {
    const { recordSignal, getImprovementState } = await import("../services/improvementEngine");

    recordSignal({
      userId: "test-user",
      engineType: "uwe",
      action: "simulate",
      inputHash: "abc123",
      durationMs: 150,
      resultSummary: { totalValue: 1000000 },
      timestamp: Date.now(),
    });

    const state = getImprovementState();
    expect(state.totalSignals).toBeGreaterThan(0);
  });

  it("should run improvement pass", async () => {
    const { runImprovementPass } = await import("../services/improvementEngine");
    const report = runImprovementPass();

    expect(report).toBeDefined();
    expect(report.generatedAt).toBeTruthy();
    expect(report.convergenceMetrics).toBeInstanceOf(Array);
    expect(report.recommendations).toBeInstanceOf(Array);
    expect(typeof report.overallConverged).toBe("boolean");
  });

  it("should verify parity correctly", async () => {
    const { verifyParity } = await import("../services/improvementEngine");

    const result = verifyParity(
      {
        name: "Test Case",
        engine: "uwe",
        input: {},
        expectedOutput: { totalValue: 1000000, roi: 10 },
        tolerancePercent: 5,
      },
      { totalValue: 1020000, roi: 10.3 },
    );

    expect(result.passed).toBe(true);
    expect(result.fields.length).toBe(2);
    expect(result.fields.every((f) => f.withinTolerance)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HTML MAINTENANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("HTML Maintenance", () => {
  it("should import and expose public API", async () => {
    const maint = await import("../services/htmlMaintenance");
    expect(maint.HTML_CALCULATOR_VERSIONS).toBeInstanceOf(Array);
    expect(maint.PARITY_TEST_CASES).toBeInstanceOf(Array);
    expect(typeof maint.runParityVerification).toBe("function");
    expect(typeof maint.getCalculatorVersions).toBe("function");
    expect(typeof maint.getOutdatedCalculators).toBe("function");
  });

  it("should track 3 HTML calculator versions", async () => {
    const { HTML_CALCULATOR_VERSIONS } = await import("../services/htmlMaintenance");
    expect(HTML_CALCULATOR_VERSIONS.length).toBe(3);
    expect(HTML_CALCULATOR_VERSIONS.every((v) => v.status === "current")).toBe(true);
  });

  it("should have parity test cases for all engines", async () => {
    const { PARITY_TEST_CASES } = await import("../services/htmlMaintenance");
    expect(PARITY_TEST_CASES.length).toBeGreaterThanOrEqual(5);

    const engines = new Set(PARITY_TEST_CASES.map((tc) => tc.engine));
    expect(engines.has("uwe")).toBe(true);
    expect(engines.has("bie")).toBe(true);
    expect(engines.has("he")).toBe(true);
  });

  it("should run parity verification", async () => {
    const { runParityVerification } = await import("../services/htmlMaintenance");

    const mockRunner = (tc: any) => {
      if (tc.engine === "uwe") return { totalValue: 1400000, netValue: 1260000, roi: 8.5 };
      if (tc.engine === "bie") return { firstYearCommission: 26000, renewalIncome: 0, totalIncome: 26000 };
      return { totalCombinedValue: 480000, wealthComponent: 330000, incomeComponent: 150000 };
    };

    const report = runParityVerification(mockRunner);

    expect(report).toBeDefined();
    expect(report.calculatorVersions.length).toBe(3);
    expect(report.testResults.length).toBeGreaterThan(0);
    expect(typeof report.passRate).toBe("number");
  });
});
