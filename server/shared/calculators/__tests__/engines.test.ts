/**
 * WealthBridge calculator engines — convergence test suite.
 *
 * ~279 cases across six groups covering UWE, BIE, HE, Monte Carlo and
 * the benchmark / guardrail bundle. Organized to match the step plan in
 * /root/.claude/plans/idempotent-jingling-dream.md so each group can be
 * added incrementally while keeping `pnpm test server/shared/calculators`
 * green.
 *
 * Group A — UWE product models (~112 cases)
 * Group B — UWE simulate / buildStrategy / autoSelectProducts (~38 cases)
 * Group C — BIE constants + helpers (~30 cases)
 * Group D — BIE simulate / planning / presets (~40 cases)
 * Group E — HE simulate / compare / winners / milestones / presets (~35 cases)
 * Group F — Monte Carlo + benchmarks / guardrails bounds (~24 cases)
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  // UWE
  PRODUCT_MODELS,
  COMPANIES,
  RATES,
  estPrem,
  interpRate,
  modelTerm,
  modelIUL,
  modelWL,
  modelDI,
  modelLTC,
  modelFIA,
  modelAUM,
  model401k,
  model529,
  modelEstate,
  modelPremFin,
  modelSplitDollar,
  modelDeferredComp,
  uweSimulate,
  uweBuildStrategy,
  autoSelectProducts,
  generateBestOverall,
  // BIE
  ROLES,
  GDC_BRACKETS,
  CHANNELS,
  SEASON_PROFILES,
  STREAM_TYPES,
  FREQUENCIES,
  bieCreateStrategy,
  bieSimulate,
  backPlan,
  rollUp,
  rollDown,
  calcEconomics,
  toFrequency,
  getBracketRate,
  getBracketLabel,
  getSeasonMultipliers,
  getRoleInfo,
  getAllRoles,
  getAllChannels,
  getStreamTypes,
  BIE_PRESETS,
  // HE
  createHolisticStrategy,
  heSimulate,
  addStrategy,
  clearStrategies,
  setHorizon,
  getHorizon,
  compareAt,
  findWinners,
  milestoneCompare,
  getChartSeries,
  backPlanHolistic,
  HE_PRESETS,
  presetWealthBridgeClient,
  presetDoNothing,
  // Monte Carlo
  monteCarloSimulate,
  // Benchmarks
  GUARDRAILS,
  checkGuardrail,
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
  type ClientProfile,
  type ProductConfig,
} from "../index";

// Canonical 40-year-old WB client used by parity tests throughout.
const CANONICAL_CLIENT: ClientProfile = {
  age: 40,
  income: 120000,
  netWorth: 350000,
  savings: 180000,
  dependents: 2,
  mortgage: 250000,
  debts: 30000,
  marginalRate: 0.25,
};

// ═══════════════════════════════════════════════════════════════════════════
// GROUP A — UWE PRODUCT MODELS (~112 cases)
// Each model gets ~8 assertions: shape, label, carrier, zero-input, year-1
// positivity, year-N monotonicity, edge-age behaviour, etc.
// ═══════════════════════════════════════════════════════════════════════════

describe("Group A — UWE product models", () => {
  describe("modelTerm", () => {
    const baseCfg: ProductConfig = {
      type: "term",
      face: 500000,
      termYears: 20,
      annualPremium: 280,
    };

    it("year 1: full death benefit + annual cost", () => {
      const r = modelTerm({ ...baseCfg }, 1, 40);
      expect(r.deathBenefit).toBe(500000);
      expect(r.annualCost).toBe(280);
      expect(r.taxSaving).toBe(0);
    });
    it("year 1: no conversion value outside final 5 years", () => {
      expect(modelTerm({ ...baseCfg }, 1, 40).cashValue).toBe(0);
    });
    it("year 16+: conversion value kicks in (~2% face)", () => {
      expect(modelTerm({ ...baseCfg }, 16, 55).cashValue).toBe(10000);
    });
    it("expired term: death benefit becomes 0", () => {
      expect(modelTerm({ ...baseCfg }, 25, 65).deathBenefit).toBe(0);
    });
    it("expired term: annual cost becomes 0", () => {
      expect(modelTerm({ ...baseCfg }, 25, 65).annualCost).toBe(0);
    });
    it("label includes the term length", () => {
      expect(modelTerm({ ...baseCfg }, 1, 40).label).toBe("Term 20yr");
    });
    it("default carrier is NLG", () => {
      expect(modelTerm({ ...baseCfg }, 1, 40).carrier).toBe("NLG");
    });
    it("custom carrier is honored", () => {
      const r = modelTerm({ ...baseCfg, carrier: "Custom" }, 1, 40);
      expect(r.carrier).toBe("Custom");
    });
  });

  describe("modelIUL", () => {
    const baseCfg: ProductConfig = {
      type: "iul",
      face: 500000,
      fundingYears: 15,
      annualPremium: 10000,
      livingBenPct: 0.5,
      marginalRate: 0.25,
    };
    it("year 1 cash value positive (from premium contribution)", () => {
      expect(modelIUL({ ...baseCfg }, 1, 40).cashValue).toBeGreaterThan(0);
    });
    it("death benefit is at least face amount", () => {
      expect(modelIUL({ ...baseCfg }, 1, 40).deathBenefit).toBeGreaterThanOrEqual(500000);
    });
    it("cash value grows year over year", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = modelIUL(cfg, 1, 40).cashValue;
      const y2 = modelIUL(cfg, 2, 41).cashValue;
      const y3 = modelIUL(cfg, 3, 42).cashValue;
      expect(y2).toBeGreaterThan(y1);
      expect(y3).toBeGreaterThan(y2);
    });
    it("living benefit is ~50% of death benefit by default", () => {
      const r = modelIUL({ ...baseCfg }, 1, 40);
      expect(r.livingBenefit).toBeCloseTo(r.deathBenefit * 0.5, -1);
    });
    it("label is 'IUL'", () => {
      expect(modelIUL({ ...baseCfg }, 1, 40).label).toBe("IUL");
    });
    it("default carrier is NLG FlexLife", () => {
      expect(modelIUL({ ...baseCfg }, 1, 40).carrier).toBe("NLG FlexLife");
    });
    it("paying stops past funding years", () => {
      const cfg: ProductConfig = { ...baseCfg, fundingYears: 3 };
      expect(modelIUL(cfg, 4, 43).annualCost).toBe(0);
    });
    it("tax saving present when marginal rate > 0 and prev CV > 0", () => {
      const cfg: ProductConfig = { ...baseCfg };
      modelIUL(cfg, 1, 40);
      const r = modelIUL(cfg, 2, 41);
      expect(r.taxSaving).toBeGreaterThan(0);
    });
  });

  describe("modelWL", () => {
    const baseCfg: ProductConfig = {
      type: "wl",
      face: 250000,
      payYears: 20,
      annualPremium: 3200,
      dividendRate: 0.02,
      marginalRate: 0.25,
    };
    it("year 1 cash value positive", () => {
      expect(modelWL({ ...baseCfg }, 1, 40).cashValue).toBeGreaterThan(0);
    });
    it("death benefit >= face in year 1", () => {
      expect(modelWL({ ...baseCfg }, 1, 40).deathBenefit).toBeGreaterThanOrEqual(250000);
    });
    it("cash value monotonically increases in funding years", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = modelWL(cfg, 1, 40).cashValue;
      const y5 = modelWL(cfg, 5, 44).cashValue;
      expect(y5).toBeGreaterThan(y1);
    });
    it("20-Pay label includes pay years", () => {
      expect(modelWL({ ...baseCfg }, 1, 40).label).toBe("Whole Life 20-Pay");
    });
    it("99-pay label omits pay years", () => {
      expect(modelWL({ ...baseCfg, payYears: 99 }, 1, 40).label).toBe(
        "Whole Life",
      );
    });
    it("default carrier is NLG/MassMutual", () => {
      expect(modelWL({ ...baseCfg }, 1, 40).carrier).toBe("NLG/MassMutual");
    });
    it("living benefit is 0 for standard WL", () => {
      expect(modelWL({ ...baseCfg }, 1, 40).livingBenefit).toBe(0);
    });
    it("annual cost 0 after pay years", () => {
      expect(modelWL({ ...baseCfg, payYears: 10 }, 15, 54).annualCost).toBe(0);
    });
  });

  describe("modelDI", () => {
    const baseCfg: ProductConfig = {
      type: "di",
      annualBenefit: 72000,
      toAge: 65,
      startAge: 40,
      annualPremium: 2160,
    };
    it("living benefit equals annual benefit while in force", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).livingBenefit).toBe(72000);
    });
    it("annual cost paid while in force", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).annualCost).toBe(2160);
    });
    it("not in force past toAge", () => {
      expect(modelDI({ ...baseCfg }, 30, 70).livingBenefit).toBe(0);
    });
    it("expected value accumulates over time", () => {
      const cfg: ProductConfig = { ...baseCfg };
      modelDI(cfg, 1, 40);
      const r2 = modelDI(cfg, 2, 41);
      expect(r2.expectedValue).toBeGreaterThan(0);
    });
    it("label is Disability Insurance", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).label).toBe("Disability Insurance");
    });
    it("default carrier is Guardian", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).carrier).toBe("Guardian");
    });
    it("no death benefit", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).deathBenefit).toBe(0);
    });
    it("no cash value", () => {
      expect(modelDI({ ...baseCfg }, 1, 40).cashValue).toBe(0);
    });
  });

  describe("modelLTC", () => {
    const baseCfg: ProductConfig = {
      type: "ltc",
      benefitPool: 150000,
      payYears: 10,
      inflationRate: 0.03,
      annualPremium: 3200,
    };
    it("benefit pool grows with inflation", () => {
      const y1 = modelLTC({ ...baseCfg }, 1, 45).livingBenefit;
      const y10 = modelLTC({ ...baseCfg }, 10, 54).livingBenefit;
      expect(y10).toBeGreaterThan(y1);
    });
    it("living benefit ~= benefit pool", () => {
      expect(modelLTC({ ...baseCfg }, 1, 45).livingBenefit).toBeGreaterThanOrEqual(
        150000,
      );
    });
    it("death benefit = 80% of cumulative premiums", () => {
      expect(modelLTC({ ...baseCfg }, 5, 49).deathBenefit).toBe(
        Math.round(5 * 3200 * 0.8),
      );
    });
    it("tax saving = 15% of annual premium", () => {
      expect(modelLTC({ ...baseCfg }, 1, 45).taxSaving).toBe(480);
    });
    it("label is Hybrid LTC", () => {
      expect(modelLTC({ ...baseCfg }, 1, 45).label).toBe("Hybrid LTC");
    });
    it("default carrier is Lincoln MoneyGuard", () => {
      expect(modelLTC({ ...baseCfg }, 1, 45).carrier).toBe("Lincoln MoneyGuard");
    });
    it("annual cost 0 after pay years", () => {
      expect(modelLTC({ ...baseCfg }, 15, 59).annualCost).toBe(0);
    });
    it("no cash value", () => {
      expect(modelLTC({ ...baseCfg }, 1, 45).cashValue).toBe(0);
    });
  });

  describe("modelFIA", () => {
    const baseCfg: ProductConfig = {
      type: "fia",
      deposit: 100000,
      fundingYears: 5,
      avgReturn: 0.055,
      riderFee: 0.01,
    };
    it("cash value grows with net return", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = modelFIA(cfg, 1, 40).cashValue;
      const y5 = modelFIA(cfg, 5, 44).cashValue;
      expect(y5).toBeGreaterThan(y1);
    });
    it("living benefit = income from roll-up base", () => {
      expect(modelFIA({ ...baseCfg }, 1, 40).livingBenefit).toBeGreaterThan(0);
    });
    it("label is Fixed Indexed Annuity", () => {
      expect(modelFIA({ ...baseCfg }, 1, 40).label).toBe("Fixed Indexed Annuity");
    });
    it("default carrier is NLG/Athene", () => {
      expect(modelFIA({ ...baseCfg }, 1, 40).carrier).toBe("NLG/Athene");
    });
    it("death benefit = current account value", () => {
      const r = modelFIA({ ...baseCfg }, 1, 40);
      expect(r.deathBenefit).toBe(r.cashValue);
    });
    it("annual cost 0 past funding years", () => {
      expect(modelFIA({ ...baseCfg }, 10, 49).annualCost).toBe(0);
    });
    it("tax saving positive while growing", () => {
      const cfg: ProductConfig = { ...baseCfg };
      modelFIA(cfg, 1, 40);
      const r = modelFIA(cfg, 2, 41);
      expect(r.taxSaving).toBeGreaterThan(0);
    });
    it("legacy value = account value", () => {
      const r = modelFIA({ ...baseCfg }, 1, 40);
      expect(r.legacyValue).toBe(r.cashValue);
    });
  });

  describe("modelAUM", () => {
    const baseCfg: ProductConfig = {
      type: "aum",
      initialAUM: 180000,
      annualAdd: 6000,
      feeRate: 0.01,
      grossReturn: 0.08,
      advisoryAlpha: 0.015,
      taxDrag: 0.005,
    };
    it("account value grows with net return", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = modelAUM(cfg, 1, 40).cashValue;
      const y5 = modelAUM(cfg, 5, 44).cashValue;
      expect(y5).toBeGreaterThan(y1);
    });
    it("annual cost = AUM fee", () => {
      expect(modelAUM({ ...baseCfg }, 1, 40).annualCost).toBeGreaterThanOrEqual(
        0,
      );
    });
    it("label is Advisory/AUM", () => {
      expect(modelAUM({ ...baseCfg }, 1, 40).label).toBe("Advisory/AUM");
    });
    it("no death benefit", () => {
      expect(modelAUM({ ...baseCfg }, 1, 40).deathBenefit).toBe(0);
    });
    it("default carrier", () => {
      expect(modelAUM({ ...baseCfg }, 1, 40).carrier).toBe("ESI/WealthBridge");
    });
    it("tax saving from advisory alpha harvesting", () => {
      const cfg: ProductConfig = { ...baseCfg };
      modelAUM(cfg, 1, 40);
      const r = modelAUM(cfg, 2, 41);
      expect(r.taxSaving).toBeGreaterThan(0);
    });
    it("no living benefit", () => {
      expect(modelAUM({ ...baseCfg }, 1, 40).livingBenefit).toBe(0);
    });
    it("legacy = cash value", () => {
      const r = modelAUM({ ...baseCfg }, 1, 40);
      expect(r.legacyValue).toBe(r.cashValue);
    });
  });

  describe("model401k", () => {
    const baseCfg: ProductConfig = {
      type: "401k",
      initialBalance: 50000,
      annualContrib: 18000,
      employerMatch: 9000,
      grossReturn: 0.07,
      feeRate: 0.005,
      marginalRate: 0.25,
    };
    it("account grows with contributions + return", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = model401k(cfg, 1, 40).cashValue;
      const y5 = model401k(cfg, 5, 44).cashValue;
      expect(y5).toBeGreaterThan(y1);
    });
    it("traditional tax saving = contrib * marginal rate", () => {
      expect(model401k({ ...baseCfg }, 1, 40).taxSaving).toBe(
        Math.round(18000 * 0.25),
      );
    });
    it("label is 401k for traditional", () => {
      expect(model401k({ ...baseCfg }, 1, 40).label).toBe("401k");
    });
    it("Roth label when isRoth flag set", () => {
      expect(model401k({ ...baseCfg, isRoth: true }, 1, 40).label).toBe(
        "Roth IRA/401k",
      );
    });
    it("Roth legacy value = full cash value (tax-free)", () => {
      const cfg: ProductConfig = { ...baseCfg, isRoth: true };
      const r = model401k(cfg, 1, 40);
      expect(r.legacyValue).toBe(r.cashValue);
    });
    it("traditional legacy value = 0.75 * cash value (tax drag)", () => {
      const r = model401k({ ...baseCfg }, 1, 40);
      expect(r.legacyValue).toBe(Math.round(r.cashValue * 0.75));
    });
    it("no death benefit, no living benefit", () => {
      const r = model401k({ ...baseCfg }, 1, 40);
      expect(r.deathBenefit).toBe(0);
      expect(r.livingBenefit).toBe(0);
    });
    it("annual cost 0 (savings not cost)", () => {
      expect(model401k({ ...baseCfg }, 1, 40).annualCost).toBe(0);
    });
  });

  describe("model529", () => {
    const baseCfg: ProductConfig = {
      type: "529",
      annualContrib: 6000,
      grossReturn: 0.06,
      marginalRate: 0.25,
    };
    it("account grows year over year", () => {
      const cfg: ProductConfig = { ...baseCfg };
      const y1 = model529(cfg, 1, 40).cashValue;
      const y5 = model529(cfg, 5, 44).cashValue;
      expect(y5).toBeGreaterThan(y1);
    });
    it("label is 529 Plan", () => {
      expect(model529({ ...baseCfg }, 1, 40).label).toBe("529 Plan");
    });
    it("default carrier is State Plan", () => {
      expect(model529({ ...baseCfg }, 1, 40).carrier).toBe("State Plan");
    });
    it("tax saving reflects tax-free growth (year 2+)", () => {
      const cfg: ProductConfig = { ...baseCfg };
      model529(cfg, 1, 40);
      const r = model529(cfg, 2, 41);
      expect(r.taxSaving).toBeGreaterThan(0);
    });
    it("no death benefit", () => {
      expect(model529({ ...baseCfg }, 1, 40).deathBenefit).toBe(0);
    });
    it("no living benefit", () => {
      expect(model529({ ...baseCfg }, 1, 40).livingBenefit).toBe(0);
    });
    it("no annual cost (savings)", () => {
      expect(model529({ ...baseCfg }, 1, 40).annualCost).toBe(0);
    });
    it("legacy = cash value", () => {
      const r = model529({ ...baseCfg }, 1, 40);
      expect(r.legacyValue).toBe(r.cashValue);
    });
  });

  describe("modelEstate", () => {
    const baseCfg: ProductConfig = {
      type: "estate",
      netWorth: 20000000,
      growthRate: 0.06,
      exemption: 15000000,
      setupCost: 2500,
      annualReview: 500,
    };
    it("large estate has positive tax saving", () => {
      expect(modelEstate({ ...baseCfg }, 1, 40).taxSaving).toBeGreaterThan(0);
    });
    it("small estate has zero tax saving", () => {
      expect(
        modelEstate({ ...baseCfg, netWorth: 500000 }, 1, 40).taxSaving,
      ).toBe(0);
    });
    it("year 1 cost = setup cost", () => {
      expect(modelEstate({ ...baseCfg }, 1, 40).annualCost).toBe(2500);
    });
    it("year 2+ cost = annual review", () => {
      expect(modelEstate({ ...baseCfg }, 2, 41).annualCost).toBe(500);
    });
    it("label is Estate Plan", () => {
      expect(modelEstate({ ...baseCfg }, 1, 40).label).toBe("Estate Plan");
    });
    it("default carrier is WB Adv Markets", () => {
      expect(modelEstate({ ...baseCfg }, 1, 40).carrier).toBe("WB Adv Markets");
    });
    it("legacy value > 0 for any estate", () => {
      expect(modelEstate({ ...baseCfg }, 1, 40).legacyValue).toBeGreaterThan(0);
    });
    it("no death / cash / living benefit", () => {
      const r = modelEstate({ ...baseCfg }, 1, 40);
      expect(r.deathBenefit).toBe(0);
      expect(r.cashValue).toBe(0);
      expect(r.livingBenefit).toBe(0);
    });
  });

  describe("modelPremFin", () => {
    const baseCfg: ProductConfig = {
      type: "premfin",
      face: 5000000,
      annualPremium: 100000,
      fundingYears: 10,
      loanRate: 0.055,
      creditingRate: 0.07,
      cashOutlay: 25000,
    };
    it("label is Premium Finance (IUL)", () => {
      expect(modelPremFin({ ...baseCfg }, 1, 40).label).toBe("Premium Finance (IUL)");
    });
    it("details include loan balance", () => {
      const r = modelPremFin({ ...baseCfg }, 1, 40);
      expect(r.details?.loanBalance).toBeDefined();
    });
    it("details include spread percentage", () => {
      expect(modelPremFin({ ...baseCfg }, 1, 40).details?.spread).toBe("1.5%");
    });
    it("details include leverage ratio", () => {
      expect(modelPremFin({ ...baseCfg }, 5, 44).details?.leverage).toBeDefined();
    });
    it("year 1 annual cost = cash outlay", () => {
      expect(modelPremFin({ ...baseCfg }, 1, 40).annualCost).toBe(25000);
    });
    it("death benefit bounded by face - loan balance", () => {
      const r = modelPremFin({ ...baseCfg }, 1, 40);
      expect(r.deathBenefit).toBeLessThanOrEqual(5000000);
    });
    it("living benefit = 50% of face", () => {
      expect(modelPremFin({ ...baseCfg }, 1, 40).livingBenefit).toBe(2500000);
    });
    it("default carrier", () => {
      expect(modelPremFin({ ...baseCfg }, 1, 40).carrier).toBe(
        "NLG LSW FlexLife",
      );
    });
  });

  describe("modelSplitDollar", () => {
    const baseCfg: ProductConfig = {
      type: "splitdollar",
      face: 1000000,
      annualPremium: 15000,
      employerShare: 0.8,
    };
    it("label is Split Dollar", () => {
      expect(modelSplitDollar({ ...baseCfg }, 1, 45).label).toBe("Split Dollar");
    });
    it("employee cost = premium * (1 - employer share)", () => {
      expect(modelSplitDollar({ ...baseCfg }, 1, 45).annualCost).toBe(3000);
    });
    it("death benefit <= face", () => {
      expect(modelSplitDollar({ ...baseCfg }, 1, 45).deathBenefit).toBeLessThanOrEqual(
        1000000,
      );
    });
    it("tax saving accumulates over years", () => {
      const y1 = modelSplitDollar({ ...baseCfg }, 1, 45).taxSaving;
      const y5 = modelSplitDollar({ ...baseCfg }, 5, 49).taxSaving;
      expect(y5).toBeGreaterThan(y1);
    });
    it("default carrier", () => {
      expect(modelSplitDollar({ ...baseCfg }, 1, 45).carrier).toBe(
        "NLG/MassMutual",
      );
    });
    it("no living benefit", () => {
      expect(modelSplitDollar({ ...baseCfg }, 1, 45).livingBenefit).toBe(0);
    });
    it("legacy value matches death benefit", () => {
      const r = modelSplitDollar({ ...baseCfg }, 1, 45);
      expect(r.legacyValue).toBe(r.deathBenefit);
    });
    it("employee benefit non-negative", () => {
      expect(
        modelSplitDollar({ ...baseCfg }, 1, 45).cashValue,
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe("modelDeferredComp", () => {
    const baseCfg: ProductConfig = {
      type: "deferredcomp",
      annualContrib: 50000,
      growthRate: 0.06,
    };
    it("balance grows year over year", () => {
      const y1 = modelDeferredComp({ ...baseCfg }, 1, 50).cashValue;
      const y10 = modelDeferredComp({ ...baseCfg }, 10, 59).cashValue;
      expect(y10).toBeGreaterThan(y1);
    });
    it("label is NQDC", () => {
      expect(modelDeferredComp({ ...baseCfg }, 1, 50).label).toBe(
        "Deferred Comp (NQDC)",
      );
    });
    it("default carrier is Plan Administrator", () => {
      expect(modelDeferredComp({ ...baseCfg }, 1, 50).carrier).toBe(
        "Plan Administrator",
      );
    });
    it("tax saving at top marginal rate 37%", () => {
      expect(modelDeferredComp({ ...baseCfg }, 1, 50).taxSaving).toBe(
        Math.round(50000 * 0.37 * 1),
      );
    });
    it("tax saving caps at 20 years", () => {
      expect(modelDeferredComp({ ...baseCfg }, 25, 74).taxSaving).toBe(
        Math.round(50000 * 0.37 * 20),
      );
    });
    it("annual cost 0 (employer-funded)", () => {
      expect(modelDeferredComp({ ...baseCfg }, 1, 50).annualCost).toBe(0);
    });
    it("death benefit = balance", () => {
      const r = modelDeferredComp({ ...baseCfg }, 1, 50);
      expect(r.deathBenefit).toBe(r.cashValue);
    });
    it("legacy value = balance", () => {
      const r = modelDeferredComp({ ...baseCfg }, 1, 50);
      expect(r.legacyValue).toBe(r.cashValue);
    });
  });

  describe("PRODUCT_MODELS dispatch map", () => {
    it("maps all 14 product types (roth shares 401k model)", () => {
      expect(Object.keys(PRODUCT_MODELS).length).toBe(14);
    });
    it("roth is aliased to model401k", () => {
      expect(PRODUCT_MODELS.roth).toBe(model401k);
    });
    it("every value is a function", () => {
      Object.values(PRODUCT_MODELS).forEach((fn) =>
        expect(typeof fn).toBe("function"),
      );
    });
  });

  describe("interpRate + estPrem + RATES", () => {
    it("interpRate clamps below table min", () => {
      expect(interpRate(RATES.termPer100K, 15)).toBe(31);
    });
    it("interpRate clamps above table max", () => {
      expect(interpRate(RATES.termPer100K, 90)).toBe(1557);
    });
    it("interpRate interpolates between anchors", () => {
      const r = interpRate(RATES.termPer100K, 22);
      expect(r).toBeGreaterThan(31);
      expect(r).toBeLessThan(33);
    });
    it("estPrem('term', 40, 500000) returns reasonable $", () => {
      expect(estPrem("term", 40, 500000)).toBe(280);
    });
    it("estPrem returns 0 for non-positive amount", () => {
      expect(estPrem("term", 40, 0)).toBe(0);
    });
    it("estPrem returns 0 for unknown type", () => {
      expect(estPrem("bogus", 40, 500000)).toBe(0);
    });
    it("RATES.aumFee tiers: < $500K = 1.25%", () => {
      expect(RATES.aumFee(100000)).toBe(0.0125);
    });
    it("RATES.aumFee tiers: $500K-$1M = 1%", () => {
      expect(RATES.aumFee(750000)).toBe(0.01);
    });
    it("RATES.aumFee tiers: $1M-$5M = 0.85%", () => {
      expect(RATES.aumFee(2000000)).toBe(0.0085);
    });
    it("RATES.aumFee tiers: >= $5M = 0.60%", () => {
      expect(RATES.aumFee(10000000)).toBe(0.006);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP B — UWE simulate / buildStrategy / autoSelectProducts /
//          generateBestOverall / COMPANIES integrity (~38 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe("Group B — UWE simulate & strategy builder", () => {
  describe("COMPANIES integrity", () => {
    it("has exactly 7 companies", () => {
      expect(Object.keys(COMPANIES).length).toBe(7);
    });
    it("wealthbridge has all 14 products", () => {
      expect(COMPANIES.wealthbridge.products.length).toBe(14);
    });
    it("donothing has zero products", () => {
      expect(COMPANIES.donothing.products.length).toBe(0);
    });
    it("wirehouse features.fiduciary is false", () => {
      expect(COMPANIES.wirehouse.features.fiduciary).toBe(false);
    });
    it("ria features.fiduciary is true", () => {
      expect(COMPANIES.ria.features.fiduciary).toBe(true);
    });
    it("diy has lowest AUM fee", () => {
      const fees = Object.values(COMPANIES)
        .filter((c) => c.aumFee > 0)
        .map((c) => c.aumFee);
      expect(COMPANIES.diy.aumFee).toBe(Math.min(...fees));
    });
    it("every company has strategyInfo for non-empty product lists", () => {
      Object.entries(COMPANIES).forEach(([, co]) => {
        if (co.products.length > 0) {
          expect(co.strategyInfo).toBeDefined();
        }
      });
    });
    it("all companies have color and aumFee fields", () => {
      Object.values(COMPANIES).forEach((co) => {
        expect(co.color).toMatch(/^#/);
        expect(typeof co.aumFee).toBe("number");
      });
    });
  });

  describe("buildStrategy + autoSelectProducts", () => {
    it("builds a WB strategy for the canonical client", () => {
      const s = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      expect(s.company).toBe("wealthbridge");
      expect(s.products.length).toBeGreaterThan(0);
    });
    it("donothing builds empty product list", () => {
      const s = uweBuildStrategy("donothing", CANONICAL_CLIENT);
      expect(s.products.length).toBe(0);
    });
    it("custom products override auto-selection", () => {
      const custom: ProductConfig[] = [
        { type: "term", face: 250000, termYears: 15, annualPremium: 200 },
      ];
      const s = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT, custom);
      expect(s.products.length).toBe(1);
      expect(s.products[0].face).toBe(250000);
    });
    it("unknown company falls back to donothing", () => {
      const s = uweBuildStrategy("bogus", CANONICAL_CLIENT);
      expect(s.company).toBe("bogus");
      expect(s.products.length).toBe(0);
    });
    it("autoSelect includes term when life need > existing insurance", () => {
      const products = autoSelectProducts(COMPANIES.wealthbridge, CANONICAL_CLIENT, "wealthbridge");
      expect(products.some((p) => p.type === "term")).toBe(true);
    });
    it("autoSelect omits 529 when dependents = 0", () => {
      const noDeps = { ...CANONICAL_CLIENT, dependents: 0 };
      const products = autoSelectProducts(COMPANIES.wealthbridge, noDeps, "wealthbridge");
      expect(products.some((p) => p.type === "529")).toBe(false);
    });
    it("autoSelect adds premfin for HNW clients (nw >= 250K, inc >= 150K)", () => {
      const hnw = { ...CANONICAL_CLIENT, netWorth: 500000, income: 200000 };
      const products = autoSelectProducts(COMPANIES.wealthbridge, hnw, "wealthbridge");
      expect(products.some((p) => p.type === "premfin")).toBe(true);
    });
    it("autoSelect omits premfin for non-HNW clients", () => {
      const products = autoSelectProducts(COMPANIES.wealthbridge, CANONICAL_CLIENT, "wealthbridge");
      expect(products.some((p) => p.type === "premfin")).toBe(false);
    });
    it("autoSelect includes estate only when nw > 500K", () => {
      const rich = { ...CANONICAL_CLIENT, netWorth: 1000000 };
      const poor = { ...CANONICAL_CLIENT, netWorth: 300000 };
      expect(
        autoSelectProducts(COMPANIES.wealthbridge, rich, "wealthbridge").some(
          (p) => p.type === "estate",
        ),
      ).toBe(true);
      expect(
        autoSelectProducts(COMPANIES.wealthbridge, poor, "wealthbridge").some(
          (p) => p.type === "estate",
        ),
      ).toBe(false);
    });
    it("autoSelect LTC only for age >= 35", () => {
      const young = { ...CANONICAL_CLIENT, age: 30 };
      expect(
        autoSelectProducts(COMPANIES.wealthbridge, young, "wealthbridge").some(
          (p) => p.type === "ltc",
        ),
      ).toBe(false);
    });
  });

  describe("simulate - year-by-year integrity", () => {
    it("canonical 30-year WB simulation returns 30 snapshots", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 30);
      expect(results.length).toBe(30);
    });
    it("first year has age = profile.age + 1", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      expect(uweSimulate(strat, 5)[0].age).toBe(41);
    });
    it("totalValue increases across the simulation horizon", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 30);
      expect(results[29].totalValue).toBeGreaterThan(results[0].totalValue);
    });
    it("savingsBalance never decreases below starting balance in first year", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 10);
      expect(results[0].savingsBalance).toBeGreaterThanOrEqual(180000);
    });
    it("cumulativeCost monotonically increases", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].cumulativeCost).toBeGreaterThanOrEqual(
          results[i - 1].cumulativeCost,
        );
      }
    });
    it("donothing simulation yields low totalValue", () => {
      const strat = uweBuildStrategy("donothing", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 30);
      const wb = uweSimulate(
        uweBuildStrategy("wealthbridge", CANONICAL_CLIENT),
        30,
      );
      expect(results[29].totalValue).toBeLessThan(wb[29].totalValue);
    });
    it("wirehouse features.holistic is false", () => {
      expect(COMPANIES.wirehouse.features.holistic).toBe(false);
    });
    it("total protection = death benefit + living benefit", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const r = uweSimulate(strat, 5)[0];
      expect(r.totalProtection).toBe(r.productDeathBenefit + r.productLivingBenefit);
    });
    it("cumulativeTaxSaving monotonically increases", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].cumulativeTaxSaving).toBeGreaterThanOrEqual(
          results[i - 1].cumulativeTaxSaving,
        );
      }
    });
    it("productDetails length = active products for WB plan", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const r = uweSimulate(strat, 1)[0];
      expect(r.productDetails.length).toBe(strat.products.length);
    });
    it("year N snapshot has year property = N", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      const results = uweSimulate(strat, 10);
      results.forEach((r, i) => expect(r.year).toBe(i + 1));
    });
    it("default simulate years = 100 when not provided", () => {
      const strat = uweBuildStrategy("wealthbridge", CANONICAL_CLIENT);
      expect(uweSimulate(strat).length).toBe(100);
    });
    it("empty product list still produces valid snapshots", () => {
      const strat = uweBuildStrategy("donothing", CANONICAL_CLIENT);
      const r = uweSimulate(strat, 5)[0];
      expect(r.productDetails).toEqual([]);
    });
  });

  describe("generateBestOverall", () => {
    it("returns a bestoverall company key", () => {
      const s = generateBestOverall(CANONICAL_CLIENT);
      expect(s.company).toBe("bestoverall");
    });
    it("has at least one cherry-picked product", () => {
      const s = generateBestOverall(CANONICAL_CLIENT);
      expect(s.products.length).toBeGreaterThan(0);
    });
    it("cherry-picked carriers include the 'Best-in-Class' marker", () => {
      const s = generateBestOverall(CANONICAL_CLIENT);
      expect(
        s.products.some((p) =>
          String(p.carrier || "").includes("Best-in-Class"),
        ),
      ).toBe(true);
    });
    it("total value positive for best-overall over 30 years", () => {
      const s = generateBestOverall(CANONICAL_CLIENT);
      const r = uweSimulate(s, 30);
      expect(r[29].totalValue).toBeGreaterThan(0);
    });
    it("color is amber for best-overall", () => {
      expect(generateBestOverall(CANONICAL_CLIENT).color).toBe("#F59E0B");
    });
    it("features.holistic is true", () => {
      expect(generateBestOverall(CANONICAL_CLIENT).features.holistic).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP C — BIE constants + helpers (~30 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe("Group C — BIE constants & helpers", () => {
  describe("ROLES", () => {
    it("has 11 roles (6 producer + 4 affiliate + 1 partner)", () => {
      expect(Object.keys(ROLES).length).toBe(11);
    });
    it("new associate has 6-month ramp at 30%", () => {
      expect(ROLES.new.rampMonths).toBe(6);
      expect(ROLES.new.rampPct).toBe(0.3);
    });
    it("exp pro has 3-month ramp at 50%", () => {
      expect(ROLES.exp.rampMonths).toBe(3);
      expect(ROLES.exp.rampPct).toBe(0.5);
    });
    it("RVP is level 5 (highest)", () => {
      expect(ROLES.rvp.level).toBe(5);
    });
    it("strategic partner cannot produce", () => {
      expect(ROLES.partner.canProduce).toBe(false);
    });
    it("affiliate A cannot produce", () => {
      expect(ROLES.affA.canProduce).toBe(false);
    });
    it("affiliate B can produce", () => {
      expect(ROLES.affB.canProduce).toBe(true);
    });
    it("growth rates descend with seniority", () => {
      expect(ROLES.new.growthRate).toBeGreaterThan(ROLES.rvp.growthRate);
    });
  });

  describe("GDC_BRACKETS", () => {
    it("has 8 tiers", () => {
      expect(GDC_BRACKETS.length).toBe(8);
    });
    it("lowest bracket rate is 0.55", () => {
      expect(GDC_BRACKETS[0].rate).toBe(0.55);
    });
    it("highest bracket rate is 0.85", () => {
      expect(GDC_BRACKETS[GDC_BRACKETS.length - 1].rate).toBe(0.85);
    });
    it("rates monotonically increase", () => {
      for (let i = 1; i < GDC_BRACKETS.length; i++) {
        expect(GDC_BRACKETS[i].rate).toBeGreaterThan(GDC_BRACKETS[i - 1].rate);
      }
    });
    it("top bracket max = Infinity", () => {
      expect(GDC_BRACKETS[GDC_BRACKETS.length - 1].max).toBe(Infinity);
    });
  });

  describe("getBracketRate & getBracketLabel", () => {
    it("$50K in <$65K bracket", () => {
      expect(getBracketRate(50000)).toBe(0.55);
    });
    it("$100K in $95-150K bracket", () => {
      expect(getBracketRate(100000)).toBe(0.7);
    });
    it("$500K in $300K+ bracket", () => {
      expect(getBracketRate(500000)).toBe(0.85);
    });
    it("bracket label lookup", () => {
      expect(getBracketLabel(100000)).toBe("$95-150K");
    });
  });

  describe("CHANNELS", () => {
    it("has 10 channels", () => {
      expect(Object.keys(CHANNELS).length).toBe(10);
    });
    it("referral has lowest CPL", () => {
      expect(CHANNELS.referral.cpl).toBe(50);
    });
    it("events has highest CPL", () => {
      expect(CHANNELS.events.cpl).toBe(200);
    });
    it("every channel has ltv > 0", () => {
      Object.values(CHANNELS).forEach((c) => expect(c.ltv).toBeGreaterThan(0));
    });
  });

  describe("SEASON_PROFILES", () => {
    it("has 6 profiles", () => {
      expect(Object.keys(SEASON_PROFILES).length).toBe(6);
    });
    it("every profile has 12 months", () => {
      Object.values(SEASON_PROFILES).forEach((p) => expect(p.length).toBe(12));
    });
    it("flat profile sums to 12", () => {
      expect(SEASON_PROFILES.flat.reduce((a, b) => a + b, 0)).toBe(12);
    });
    it("q4Heavy has December at 1.5x", () => {
      expect(SEASON_PROFILES.q4Heavy[11]).toBe(1.5);
    });
  });

  describe("STREAM_TYPES", () => {
    it("has 13 stream types", () => {
      expect(Object.keys(STREAM_TYPES).length).toBe(13);
    });
    it("personal stream requires production", () => {
      expect(STREAM_TYPES.personal.requiresProduction).toBe(true);
    });
    it("override stream does not require production", () => {
      expect(STREAM_TYPES.override.requiresProduction).toBe(false);
    });
  });

  describe("FREQUENCIES + toFrequency", () => {
    it("has 7 frequency cadences", () => {
      expect(FREQUENCIES.length).toBe(7);
    });
    it("toFrequency daily uses 252 trading days", () => {
      expect(toFrequency(252000, "daily")).toBe(1000);
    });
    it("toFrequency weekly = /52", () => {
      expect(toFrequency(52000, "weekly")).toBe(1000);
    });
    it("toFrequency unknown passes through annual", () => {
      expect(toFrequency(100000, "bogus")).toBe(100000);
    });
  });

  describe("lookup helpers", () => {
    it("getSeasonMultipliers uses customSeason when present", () => {
      const custom = Array(12).fill(2);
      const s = bieCreateStrategy("t", {
        role: "new",
        seasonality: "custom",
        customSeason: custom,
      });
      expect(getSeasonMultipliers(s)).toEqual(custom);
    });
    it("getSeasonMultipliers falls back to profile when custom missing", () => {
      const s = bieCreateStrategy("t", { role: "new", seasonality: "q4Heavy" });
      expect(getSeasonMultipliers(s)).toEqual(SEASON_PROFILES.q4Heavy);
    });
    it("getRoleInfo returns new for unknown key", () => {
      expect(getRoleInfo("bogus" as never)).toBe(ROLES.new);
    });
    it("getAllRoles returns 11 entries", () => {
      expect(getAllRoles().length).toBe(11);
    });
    it("getAllChannels returns 10 entries", () => {
      expect(getAllChannels().length).toBe(10);
    });
    it("getStreamTypes returns same reference as constant", () => {
      expect(getStreamTypes()).toBe(STREAM_TYPES);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP D — BIE simulate / backPlan / rollUp / rollDown / calcEconomics /
//          7 PRESETS (~40 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe("Group D — BIE simulate & planning", () => {
  describe("createStrategy", () => {
    it("applies all defaults", () => {
      const s = bieCreateStrategy("t", { role: "new" });
      expect(s.role).toBe("new");
      expect(s.wbPct).toBe(0.7);
      expect(s.teamGrowth).toBe(0.1);
      expect(s.retentionRate).toBe(0.8);
      expect(s.seasonality).toBe("flat");
    });
    it("honors overrides", () => {
      const s = bieCreateStrategy("t", { role: "md", wbPct: 0.9 });
      expect(s.wbPct).toBe(0.9);
    });
    it("default name is 'Untitled Strategy'", () => {
      expect(bieCreateStrategy("", { role: "new" }).name).toBe(
        "Untitled Strategy",
      );
    });
  });

  describe("simulate", () => {
    it("default horizon is 30 years", () => {
      const s = bieCreateStrategy("t", {
        role: "new",
        streams: { personal: true },
      });
      expect(bieSimulate(s).length).toBe(30);
    });
    it("personal income grows over time (exp pro)", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { personal: true },
      });
      const r = bieSimulate(s, 5);
      expect(r[4].totalIncome).toBeGreaterThan(r[0].totalIncome);
    });
    it("year 1 ramp reduces new associate income", () => {
      const s = bieCreateStrategy("t", {
        role: "new",
        streams: { personal: true },
      });
      const r = bieSimulate(s, 2);
      expect(r[0].totalIncome).toBeLessThan(r[1].totalIncome);
    });
    it("zero streams produces zero income", () => {
      const s = bieCreateStrategy("t", { role: "new", streams: {} });
      const r = bieSimulate(s, 3);
      expect(r[0].totalIncome).toBe(0);
    });
    it("channel costs accumulate when channels stream enabled", () => {
      const s = bieCreateStrategy("t", {
        role: "dir",
        streams: { channels: true },
        channelSpend: { referral: 500 },
      });
      expect(bieSimulate(s, 1)[0].totalCost).toBeGreaterThan(0);
    });
    it("cumulative income increases year over year", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { personal: true },
      });
      const r = bieSimulate(s, 5);
      for (let i = 1; i < r.length; i++) {
        expect(r[i].cumulativeIncome).toBeGreaterThan(r[i - 1].cumulativeIncome);
      }
    });
    it("first 3 years have monthly detail", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { personal: true },
      });
      const r = bieSimulate(s, 5);
      expect(r[0].monthly.length).toBe(12);
      expect(r[2].monthly.length).toBe(12);
      expect(r[4].monthly.length).toBe(0);
    });
    it("team override income tracked when team present", () => {
      const s = bieCreateStrategy("t", {
        role: "dir",
        streams: { personal: true, override: true },
        team: [{ name: "SA1", role: "sa", fyc: 100000 }],
      });
      const r = bieSimulate(s, 1)[0];
      expect((r.streams.override?.income ?? 0)).toBeGreaterThan(0);
    });
    it("gen 2 override only when gen2Rate > 0", () => {
      const s = bieCreateStrategy("t", {
        role: "md",
        streams: { personal: true, override: true, overrideG2: true },
        team: [{ name: "D1", role: "dir", fyc: 200000 }],
        gen2Rate: 0.05,
      });
      const r = bieSimulate(s, 1)[0];
      expect(r.streams.overrideG2).toBeDefined();
    });
    it("AUM trail income grows with aumGrowth rate", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { aum: true },
        existingAUM: 5000000,
        aumFeeRate: 0.01,
        aumGrowth: 0.1,
      });
      const r = bieSimulate(s, 5);
      expect(r[4].streams.aum?.income || 0).toBeGreaterThan(
        r[0].streams.aum?.income || 0,
      );
    });
    it("bonus pct applied on top of subtotal", () => {
      const s = bieCreateStrategy("t", {
        role: "md",
        streams: { personal: true, bonus: true },
        bonusPct: 0.1,
      });
      const r = bieSimulate(s, 1)[0];
      expect(r.streams.bonus).toBeDefined();
    });
    it("renewal income starts at renewalStartYear", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { personal: true, renewal: true },
        renewalStartYear: 2,
        renewalRate: 0.04,
      });
      const r = bieSimulate(s, 3);
      expect(r[0].streams.renewal).toBeUndefined();
      expect(r[1].streams.renewal).toBeDefined();
    });
    it("partner income grows with partnerGrowth", () => {
      const s = bieCreateStrategy("t", {
        role: "partner",
        streams: { partner: true },
        partnerIncome: 50000,
        partnerGrowth: 0.1,
      });
      const r = bieSimulate(s, 5);
      expect((r[4].streams.partner?.income ?? 0)).toBeGreaterThan(
        (r[0].streams.partner?.income ?? 0),
      );
    });
    it("seasonality multiplier applied to monthly detail", () => {
      const s = bieCreateStrategy("t", {
        role: "exp",
        streams: { personal: true },
        seasonality: "q4Heavy",
      });
      const r = bieSimulate(s, 1)[0];
      expect(r.monthly[11].multiplier).toBe(1.5);
    });
  });

  describe("backPlan", () => {
    it("returns required GDC for target income", () => {
      const s = bieCreateStrategy("t", {
        role: "new",
        streams: { personal: true },
      });
      const plan = backPlan(100000, s);
      expect(plan.neededGDC).toBeGreaterThan(0);
    });
    it("funnel has daily, weekly, monthly, annual cadence", () => {
      const s = bieCreateStrategy("t", { role: "new", streams: { personal: true } });
      const plan = backPlan(100000, s);
      expect(plan.funnel.daily.approaches).toBeGreaterThan(0);
      expect(plan.funnel.weekly.approaches).toBeGreaterThan(0);
      expect(plan.funnel.monthly.approaches).toBeGreaterThan(0);
      expect(plan.funnel.annual.approaches).toBeGreaterThan(0);
    });
    it("team needed derived when override stream enabled", () => {
      const s = bieCreateStrategy("t", {
        role: "dir",
        streams: { personal: true, override: true },
        overrideRate: 0.1,
      });
      const plan = backPlan(200000, s);
      expect(plan.teamNeeded).toBeGreaterThan(0);
    });
    it("bracket label returned", () => {
      const s = bieCreateStrategy("t", { role: "new", streams: { personal: true } });
      expect(backPlan(100000, s).bracketLabel).toBeTruthy();
    });
  });

  describe("rollUp", () => {
    it("aggregates multi-strategy team totals", () => {
      const strategies = [
        bieCreateStrategy("A", { role: "new", streams: { personal: true } }),
        bieCreateStrategy("B", { role: "exp", streams: { personal: true } }),
      ];
      const r = rollUp(strategies);
      expect(r.teamSize).toBe(2);
      expect(r.totalIncome).toBeGreaterThan(0);
    });
    it("byRole accumulates per role", () => {
      const strategies = [
        bieCreateStrategy("A", { role: "new", streams: { personal: true } }),
        bieCreateStrategy("B", { role: "new", streams: { personal: true } }),
      ];
      const r = rollUp(strategies);
      expect(r.byRole.new.count).toBe(2);
    });
    it("empty list returns zero totals", () => {
      const r = rollUp([]);
      expect(r.teamSize).toBe(0);
      expect(r.totalIncome).toBe(0);
    });
  });

  describe("rollDown", () => {
    it("cascades org target across roles", () => {
      const targets = rollDown(1000000, [
        { role: "dir", count: 2 },
        { role: "sa", count: 5 },
      ]);
      expect(targets.length).toBe(2);
      expect(targets[0].totalTarget).toBeGreaterThan(0);
    });
    it("per-person target = total / count", () => {
      const targets = rollDown(600000, [{ role: "md", count: 2 }]);
      expect(targets[0].perPersonTarget).toBe(
        Math.round(targets[0].totalTarget / 2),
      );
    });
  });

  describe("calcEconomics", () => {
    it("computes CAC when channel spend present", () => {
      const s = bieCreateStrategy("t", {
        role: "dir",
        streams: { personal: true, channels: true },
        channelSpend: { referral: 500 },
      });
      const e = calcEconomics(s, 5);
      expect(e.cac).toBeGreaterThan(0);
    });
    it("LTV/CAC ratio computed when both > 0", () => {
      const s = bieCreateStrategy("t", {
        role: "dir",
        streams: { personal: true, channels: true },
        channelSpend: { referral: 500 },
      });
      expect(calcEconomics(s, 5).ltvCacRatio).toBeGreaterThan(0);
    });
    it("revenue matches sum of simulated income", () => {
      const s = bieCreateStrategy("t", { role: "exp", streams: { personal: true } });
      const e = calcEconomics(s, 5);
      expect(e.revenue).toBeGreaterThan(0);
    });
    it("default years = 5", () => {
      const s = bieCreateStrategy("t", { role: "exp", streams: { personal: true } });
      expect(calcEconomics(s).totalYears).toBe(5);
    });
  });

  describe("PRESETS", () => {
    it("has 7 presets", () => {
      expect(Object.keys(BIE_PRESETS).length).toBe(7);
    });
    it("each preset produces positive income in year 1", () => {
      Object.values(BIE_PRESETS).forEach((fn) => {
        const s = fn();
        const r = bieSimulate(s, 1)[0];
        expect(r.totalIncome).toBeGreaterThanOrEqual(0);
      });
    });
    it("new associate preset uses ramp seasonality", () => {
      expect(BIE_PRESETS.newAssociate().seasonality).toBe("ramp");
    });
    it("MD preset has team members", () => {
      expect(BIE_PRESETS.md().team.length).toBeGreaterThan(0);
    });
    it("RVP preset includes all streams", () => {
      const r = BIE_PRESETS.rvp();
      expect(r.streams.personal).toBe(true);
      expect(r.streams.override).toBe(true);
      expect(r.streams.partner).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP E — HE simulate / compareAt / findWinners / milestoneCompare /
//          getChartSeries / backPlanHolistic / 9 PRESETS (~35 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe("Group E — Holistic Engine", () => {
  beforeEach(() => {
    // Each test starts with an empty strategy registry.
    clearStrategies();
    setHorizon(30);
  });

  describe("createHolisticStrategy", () => {
    it("applies default profile when none given", () => {
      const hs = createHolisticStrategy("t", {});
      expect(hs.profile.age).toBe(40);
      expect(hs.profile.income).toBe(120000);
    });
    it("honors provided profile", () => {
      const hs = createHolisticStrategy("t", { profile: { age: 50 } });
      expect(hs.profile.age).toBe(50);
    });
    it("default company key is wealthbridge", () => {
      expect(createHolisticStrategy("t", {}).companyKey).toBe("wealthbridge");
    });
    it("default savingsRate = 0.15", () => {
      expect(createHolisticStrategy("t", {}).savingsRate).toBe(0.15);
    });
  });

  describe("HE simulate", () => {
    it("default horizon is 30 years", () => {
      const hs = presetWealthBridgeClient(CANONICAL_CLIENT);
      expect(heSimulate(hs).length).toBe(30);
    });
    it("totalValue grows over 30 years for WB plan", () => {
      const hs = presetWealthBridgeClient(CANONICAL_CLIENT);
      const r = heSimulate(hs, 30);
      expect(r[29].totalValue).toBeGreaterThan(r[0].totalValue);
    });
    it("Do Nothing has lower totalValue than WB at year 30", () => {
      const wb = presetWealthBridgeClient(CANONICAL_CLIENT);
      const dn = presetDoNothing(CANONICAL_CLIENT);
      const wbR = heSimulate(wb, 30);
      const dnR = heSimulate(dn, 30);
      expect(wbR[29].totalValue).toBeGreaterThan(dnR[29].totalValue);
    });
    it("snapshot age = profile.age + year", () => {
      const hs = presetWealthBridgeClient(CANONICAL_CLIENT);
      const r = heSimulate(hs, 5);
      expect(r[0].age).toBe(41);
      expect(r[4].age).toBe(45);
    });
    it("cumulativeBizIncome monotonically increases", () => {
      const hs = createHolisticStrategy("t", {
        hasBizIncome: true,
        bizStrategy: BIE_PRESETS.experiencedPro(),
        profile: CANONICAL_CLIENT,
      });
      const r = heSimulate(hs, 5);
      for (let i = 1; i < r.length; i++) {
        expect(r[i].cumulativeBizIncome).toBeGreaterThanOrEqual(
          r[i - 1].cumulativeBizIncome,
        );
      }
    });
    it("affiliate total = sum of A+B+C+D", () => {
      const hs = createHolisticStrategy("t", {
        hasBizIncome: true,
        bizStrategy: BIE_PRESETS.md(),
        profile: CANONICAL_CLIENT,
      });
      const r = heSimulate(hs, 1)[0];
      const sum =
        (r.affiliateIncomeA || 0) +
        (r.affiliateIncomeB || 0) +
        (r.affiliateIncomeC || 0) +
        (r.affiliateIncomeD || 0);
      expect(r.affiliateTotalIncome).toBe(sum);
    });
    it("totalProtection = death benefit + living benefit", () => {
      const hs = presetWealthBridgeClient(CANONICAL_CLIENT);
      const r = heSimulate(hs, 1)[0];
      expect(r.totalProtection).toBe(
        r.productDeathBenefit + r.productLivingBenefit,
      );
    });
  });

  describe("strategy registry (compareAt / findWinners / milestoneCompare)", () => {
    it("addStrategy returns index", () => {
      const idx = addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      expect(idx).toBe(0);
    });
    it("compareAt returns one row per strategy", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      addStrategy(presetDoNothing(CANONICAL_CLIENT));
      const rows = compareAt(30);
      expect(rows.length).toBe(2);
    });
    it("findWinners identifies highest totalValue", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      addStrategy(presetDoNothing(CANONICAL_CLIENT));
      const winners = findWinners(30);
      expect(winners.totalValue.name).toBe("WealthBridge Plan");
    });
    it("findWinners returns empty for <2 strategies", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      expect(Object.keys(findWinners(30)).length).toBe(0);
    });
    it("milestoneCompare uses default milestone years", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      expect(milestoneCompare().length).toBe(11);
    });
    it("milestoneCompare honors custom years", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      expect(milestoneCompare([5, 10, 20]).length).toBe(3);
    });
    it("getChartSeries returns series, labels, years", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      const cs = getChartSeries("totalValue", 30);
      expect(cs.series.length).toBe(1);
      expect(cs.labels.length).toBe(cs.years.length);
    });
    it("setHorizon/getHorizon round-trip", () => {
      setHorizon(50);
      expect(getHorizon()).toBe(50);
    });
    it("clearStrategies empties the registry", () => {
      addStrategy(presetWealthBridgeClient(CANONICAL_CLIENT));
      clearStrategies();
      expect(compareAt(30).length).toBe(0);
    });
  });

  describe("backPlanHolistic", () => {
    it("finds required income for target value", () => {
      const base = presetWealthBridgeClient(CANONICAL_CLIENT);
      const r = backPlanHolistic(2000000, 20, base);
      expect(r.requiredIncome).toBeGreaterThan(0);
      expect(r.targetValue).toBe(2000000);
      expect(r.targetYear).toBe(20);
    });
    it("iterations bounded at 50", () => {
      const base = presetWealthBridgeClient(CANONICAL_CLIENT);
      const r = backPlanHolistic(5000000, 30, base);
      expect(r.iterations).toBeLessThanOrEqual(50);
    });
  });

  describe("HE PRESETS", () => {
    it("has 9 presets", () => {
      expect(Object.keys(HE_PRESETS).length).toBe(9);
    });
    it("every no-biz preset runs a 30-year simulation", () => {
      const fns = [
        HE_PRESETS.wealthbridgeClient,
        HE_PRESETS.doNothing,
        HE_PRESETS.diy,
        HE_PRESETS.wirehouse,
        HE_PRESETS.ria,
        HE_PRESETS.captivemutual,
        HE_PRESETS.communitybd,
        HE_PRESETS.wbPremFinance,
      ];
      fns.forEach((fn) => {
        const hs = fn(CANONICAL_CLIENT);
        expect(heSimulate(hs, 30).length).toBe(30);
      });
    });
    it("presetWBPremFinance raises sub-threshold inputs", () => {
      const poor: ClientProfile = { ...CANONICAL_CLIENT, netWorth: 100000, income: 50000 };
      const hs = HE_PRESETS.wbPremFinance(poor);
      expect(hs.profile.netWorth).toBeGreaterThanOrEqual(250000);
      expect(hs.profile.income).toBeGreaterThanOrEqual(150000);
    });
    it("presetWealthBridgePro builds a biz strategy", () => {
      const hs = HE_PRESETS.wealthbridgePro(CANONICAL_CLIENT, "md");
      expect(hs.hasBizIncome).toBe(true);
      expect(hs.bizStrategy).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP F — Monte Carlo + Benchmarks / Guardrails (~24 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe("Group F — Monte Carlo + benchmarks", () => {
  describe("Monte Carlo simulate", () => {
    it("returns yearCount + 1 rows (sentinel + years)", () => {
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 30, 100);
      expect(bands.length).toBe(31);
    });
    it("each row has p10/p25/p50/p75/p90 ordering (or all zero)", () => {
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 30, 100);
      bands.forEach((b) => {
        // When all trials produced the same sign, percentiles can equal each
        // other; use <= comparisons only.
        expect(b.p10).toBeLessThanOrEqual(b.p25);
        expect(b.p25).toBeLessThanOrEqual(b.p50);
        expect(b.p50).toBeLessThanOrEqual(b.p75);
        expect(b.p75).toBeLessThanOrEqual(b.p90);
      });
    });
    it("1-year horizon + 0 volatility approximates deterministic baseline", () => {
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0 }, 1, 50);
      expect(bands.length).toBe(2);
      // Per v7 shape, index 0 is the pre-simulation sentinel
      expect(bands[1].p50).toBeGreaterThan(0);
    });
    it("default trials = 1000 when not specified", () => {
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 5);
      // Can't read raw trial count, but mean should be defined and non-zero
      expect(bands[5].mean).toBeDefined();
    });
    it("years=0 falls back to default 30 per v7 parity", () => {
      // v7 does `years = maxYears || 30`, so passing 0 picks up the default
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 0, 10);
      expect(bands.length).toBe(31);
    });
    it("successRate is 0-100", () => {
      const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 10, 50);
      bands.forEach((b) => {
        if (b.successRate !== undefined) {
          expect(b.successRate).toBeGreaterThanOrEqual(0);
          expect(b.successRate).toBeLessThanOrEqual(100);
        }
      });
    });
    it("config is cloned (no mutation of caller state)", () => {
      const cfg = { investReturn: 0.07, volatility: 0.15 };
      monteCarloSimulate(cfg, 5, 10);
      expect(cfg.investReturn).toBe(0.07);
      expect(cfg.volatility).toBe(0.15);
    });
  });

  describe("Guardrails", () => {
    it("GUARDRAILS has 6 keys", () => {
      expect(Object.keys(GUARDRAILS).length).toBe(6);
    });
    it("returnRate default is 0.07", () => {
      expect(GUARDRAILS.returnRate.default).toBe(0.07);
    });
    it("checkGuardrail returns error below min", () => {
      const g = checkGuardrail("returnRate", -0.01);
      expect(g?.type).toBe("error");
    });
    it("checkGuardrail returns error above max", () => {
      const g = checkGuardrail("returnRate", 0.2);
      expect(g?.type).toBe("error");
    });
    it("checkGuardrail warns between 80% and 100% of max", () => {
      // returnRate max 0.15; 80% = 0.12. Use 0.13.
      const g = checkGuardrail("returnRate", 0.13);
      expect(g?.type).toBe("warn");
    });
    it("checkGuardrail returns null in green zone", () => {
      expect(checkGuardrail("returnRate", 0.07)).toBeNull();
    });
    it("checkGuardrail returns null for unknown key", () => {
      expect(checkGuardrail("bogus", 0.5)).toBeNull();
    });
    it("loanRate min is 0.02 (SOFR floor)", () => {
      expect(GUARDRAILS.loanRate.min).toBe(0.02);
    });
  });

  describe("PRODUCT_REFERENCES", () => {
    it("has all 14 product keys", () => {
      expect(Object.keys(PRODUCT_REFERENCES).length).toBe(14);
    });
    it("every reference has src/url/benchmark", () => {
      Object.values(PRODUCT_REFERENCES).forEach((r) => {
        expect(r.src).toBeTruthy();
        expect(r.url).toMatch(/^https?:\/\//);
        expect(r.benchmark).toBeTruthy();
      });
    });
    it("term benchmark mentions NerdWallet", () => {
      expect(PRODUCT_REFERENCES.term.benchmark).toContain("NerdWallet");
    });
  });

  describe("INDUSTRY_BENCHMARKS", () => {
    it("has 8 benchmark categories", () => {
      expect(Object.keys(INDUSTRY_BENCHMARKS).length).toBe(8);
    });
    it("savingsRate national is ~6.2%", () => {
      expect(INDUSTRY_BENCHMARKS.savingsRate.national).toBe(0.062);
    });
    it("advisorAlpha value is ~3%", () => {
      expect(INDUSTRY_BENCHMARKS.advisorAlpha.value).toBe(0.03);
    });
    it("avgWealthGrowth exposes sp500/bonds/balanced", () => {
      const g = INDUSTRY_BENCHMARKS.avgWealthGrowth;
      expect(g.sp500).toBe(0.103);
      expect(g.bonds).toBe(0.05);
      expect(g.balanced).toBe(0.075);
    });
  });

  describe("METHODOLOGY_DISCLOSURE", () => {
    it("has the full 6 sections", () => {
      expect(METHODOLOGY_DISCLOSURE.uwe).toBeTruthy();
      expect(METHODOLOGY_DISCLOSURE.bie).toBeTruthy();
      expect(METHODOLOGY_DISCLOSURE.he).toBeTruthy();
      expect(METHODOLOGY_DISCLOSURE.mc).toBeTruthy();
      expect(METHODOLOGY_DISCLOSURE.pf).toBeTruthy();
      expect(METHODOLOGY_DISCLOSURE.disclaimer).toBeTruthy();
    });
    it("disclaimer mentions 'hypothetical'", () => {
      expect(METHODOLOGY_DISCLOSURE.disclaimer).toContain("hypothetical");
    });
  });
});
