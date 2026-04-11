/**
 * Unit tests for the shared financial profile store.
 *
 * Pure functions only — no React, no localStorage. The React-side hook
 * is covered separately by the component tests that consume it.
 */

import { describe, it, expect } from "vitest";
import {
  EMPTY_PROFILE,
  FINANCIAL_PROFILE_VERSION,
  completenessLabel,
  diffProfiles,
  mergeProfile,
  parseFinancialProfile,
  profileCompleteness,
  sanitizeProfile,
  serializeProfileState,
  toEngineProfile,
  type FinancialProfile,
} from "./financialProfile";

describe("financialProfile / parseFinancialProfile", () => {
  it("returns an empty profile for null / undefined input", () => {
    const a = parseFinancialProfile(null);
    expect(a.profile).toEqual({});
    expect(a.version).toBe(FINANCIAL_PROFILE_VERSION);
  });

  it("tolerates malformed JSON", () => {
    const a = parseFinancialProfile("{not valid json");
    expect(a.profile).toEqual({});
  });

  it("tolerates non-object top-level shapes (array, string, number)", () => {
    expect(parseFinancialProfile("[1, 2, 3]").profile).toEqual({});
    expect(parseFinancialProfile("\"hello\"").profile).toEqual({});
    expect(parseFinancialProfile("42").profile).toEqual({});
    expect(parseFinancialProfile("null").profile).toEqual({});
  });

  it("hydrates a valid saved state", () => {
    const raw = JSON.stringify({
      version: 1,
      profile: {
        age: 40,
        income: 120000,
        savings: 50000,
        dependents: 2,
        marginalRate: 0.25,
      },
    });
    const parsed = parseFinancialProfile(raw);
    expect(parsed.profile.age).toBe(40);
    expect(parsed.profile.income).toBe(120000);
    expect(parsed.profile.dependents).toBe(2);
    expect(parsed.profile.marginalRate).toBe(0.25);
  });

  it("drops unknown keys during rehydration", () => {
    const raw = JSON.stringify({
      version: 1,
      profile: {
        age: 40,
        __proto__: "bad",
        randomInjected: "yes",
      },
    });
    const parsed = parseFinancialProfile(raw);
    expect(parsed.profile.age).toBe(40);
    expect((parsed.profile as Record<string, unknown>).randomInjected).toBeUndefined();
  });
});

describe("financialProfile / sanitizeProfile", () => {
  it("coerces numeric strings to numbers", () => {
    const s = sanitizeProfile({ age: "40", income: "120000" });
    expect(s.age).toBe(40);
    expect(s.income).toBe(120000);
  });

  it("clamps age to 0..120", () => {
    expect(sanitizeProfile({ age: -5 }).age).toBe(0);
    expect(sanitizeProfile({ age: 9999 }).age).toBe(120);
  });

  it("clamps marginalRate to 0..0.55", () => {
    expect(sanitizeProfile({ marginalRate: -0.1 }).marginalRate).toBe(0);
    expect(sanitizeProfile({ marginalRate: 1.5 }).marginalRate).toBe(0.55);
  });

  it("rounds dependents to integers", () => {
    expect(sanitizeProfile({ dependents: 2.7 }).dependents).toBe(3);
  });

  it("drops NaN and Infinity values", () => {
    const s = sanitizeProfile({ income: Number.NaN, savings: Number.POSITIVE_INFINITY });
    expect(s.income).toBeUndefined();
    expect(s.savings).toBeUndefined();
  });

  it("preserves booleans for known flag fields", () => {
    const s = sanitizeProfile({ isBizOwner: true, hasLtc: false, hasHomeowner: true });
    expect(s.isBizOwner).toBe(true);
    expect(s.hasLtc).toBe(false);
    expect(s.hasHomeowner).toBe(true);
  });

  it("drops non-boolean flag values", () => {
    const s = sanitizeProfile({ isBizOwner: "true" });
    expect(s.isBizOwner).toBeUndefined();
  });

  it("accepts known filing statuses and drops unknowns", () => {
    expect(sanitizeProfile({ filingStatus: "mfj" }).filingStatus).toBe("mfj");
    expect(sanitizeProfile({ filingStatus: "divorced" }).filingStatus).toBeUndefined();
  });

  it("uppercases state of residence", () => {
    expect(sanitizeProfile({ stateOfResidence: "tx" }).stateOfResidence).toBe("TX");
  });

  it("rejects state strings longer than 4 chars", () => {
    expect(sanitizeProfile({ stateOfResidence: "TEXAS_STATE" }).stateOfResidence).toBeUndefined();
  });

  it("passes business role enum through", () => {
    expect(sanitizeProfile({ businessRole: "md" }).businessRole).toBe("md");
    expect(sanitizeProfile({ businessRole: "ceo" }).businessRole).toBeUndefined();
  });
});

describe("financialProfile / mergeProfile", () => {
  it("merges a patch over existing values", () => {
    const a: FinancialProfile = { age: 40, income: 100000 };
    const b = mergeProfile(a, { income: 120000, savings: 50000 });
    expect(b.age).toBe(40);
    expect(b.income).toBe(120000);
    expect(b.savings).toBe(50000);
  });

  it("bumps updatedAt on every merge", () => {
    const a = mergeProfile({}, { age: 30 });
    expect(a.updatedAt).toBeDefined();
    expect(typeof a.updatedAt).toBe("string");
  });

  it("tags the source", () => {
    const a = mergeProfile({}, { age: 30 }, "quick_quote");
    expect(a.source).toBe("quick_quote");
  });

  it("re-sanitizes merged values so raw form input is safe", () => {
    const a = mergeProfile(
      { age: 40 },
      // @ts-expect-error — simulating a raw form event with string values
      { income: "150000", marginalRate: "0.3" },
    );
    expect(a.income).toBe(150000);
    expect(a.marginalRate).toBe(0.3);
  });

  it("does not mutate the input profile", () => {
    const a: FinancialProfile = { age: 40 };
    mergeProfile(a, { income: 120000 });
    expect(a.income).toBeUndefined();
  });
});

describe("financialProfile / profileCompleteness", () => {
  it("returns 0 for an empty profile", () => {
    expect(profileCompleteness(EMPTY_PROFILE)).toBe(0);
  });

  it("returns 0.7 for a fully populated core profile", () => {
    const full: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
      monthlySavings: 1500,
      dependents: 2,
      marginalRate: 0.25,
    };
    expect(profileCompleteness(full)).toBeCloseTo(0.7, 4);
  });

  it("returns 1 for a fully filled profile", () => {
    const full: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
      monthlySavings: 1500,
      dependents: 2,
      marginalRate: 0.25,
      netWorth: 500000,
      mortgage: 250000,
      debts: 10000,
      stateOfResidence: "TX",
      filingStatus: "mfj",
      isBizOwner: false,
      hasHomeowner: true,
      lifeInsuranceCoverage: 500000,
    };
    expect(profileCompleteness(full)).toBeCloseTo(1, 4);
  });

  it("scales linearly with core field count", () => {
    const half: FinancialProfile = { age: 40, income: 120000, savings: 50000 };
    // 3 of 6 core fields = 0.5 of 0.7 = 0.35
    expect(profileCompleteness(half)).toBeCloseTo(0.35, 4);
  });
});

describe("financialProfile / completenessLabel", () => {
  it("labels 0 as empty", () => {
    expect(completenessLabel(0).tone).toBe("empty");
  });

  it("labels <34% as sparse", () => {
    expect(completenessLabel(0.2).tone).toBe("sparse");
  });

  it("labels 34-74% as partial", () => {
    expect(completenessLabel(0.5).tone).toBe("partial");
  });

  it("labels >=75% as full", () => {
    expect(completenessLabel(0.8).tone).toBe("full");
    expect(completenessLabel(1).tone).toBe("full");
  });
});

describe("financialProfile / toEngineProfile", () => {
  it("strips UI-only fields and keeps engine-recognized ones", () => {
    const p: FinancialProfile = {
      age: 40,
      income: 120000,
      filingStatus: "mfj",
      stateOfResidence: "TX",
      hasHomeowner: true,
      businessRevenue: 500000,
    };
    const engine = toEngineProfile(p);
    expect(engine.age).toBe(40);
    expect(engine.income).toBe(120000);
    expect(engine.filingStatus).toBeUndefined();
    expect(engine.stateOfResidence).toBeUndefined();
    expect(engine.hasHomeowner).toBeUndefined();
    expect(engine.businessRevenue).toBeUndefined();
  });

  it("handles empty profile without crashing", () => {
    expect(toEngineProfile({})).toEqual({});
  });

  it("drops undefined and null values", () => {
    const p: FinancialProfile = { age: 40, income: undefined };
    const engine = toEngineProfile(p);
    expect(engine.age).toBe(40);
    expect(Object.keys(engine)).toEqual(["age"]);
  });
});

describe("financialProfile / diffProfiles", () => {
  it("returns empty for identical profiles", () => {
    const p: FinancialProfile = { age: 40, income: 100000 };
    expect(diffProfiles(p, { ...p })).toEqual([]);
  });

  it("returns sorted keys that differ", () => {
    const a: FinancialProfile = { age: 40, income: 100000 };
    const b: FinancialProfile = { age: 40, income: 120000, savings: 50000 };
    expect(diffProfiles(a, b)).toEqual(["income", "savings"]);
  });

  it("handles keys present in only one side", () => {
    const a: FinancialProfile = { age: 40 };
    const b: FinancialProfile = {};
    expect(diffProfiles(a, b)).toEqual(["age"]);
  });
});

describe("financialProfile / serializeProfileState round-trip", () => {
  it("round-trips a non-trivial profile", () => {
    const profile: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
      dependents: 2,
      marginalRate: 0.25,
      filingStatus: "mfj",
      stateOfResidence: "TX",
      isBizOwner: true,
    };
    const raw = serializeProfileState({ version: FINANCIAL_PROFILE_VERSION, profile });
    const rehydrated = parseFinancialProfile(raw);
    expect(rehydrated.profile.age).toBe(40);
    expect(rehydrated.profile.income).toBe(120000);
    expect(rehydrated.profile.filingStatus).toBe("mfj");
    expect(rehydrated.profile.stateOfResidence).toBe("TX");
    expect(rehydrated.profile.isBizOwner).toBe(true);
  });
});
