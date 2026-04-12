/**
 * Tests for the completeness gate.
 *
 * Cover required/optional field detection, the blended ratio +
 * confidence tier derivation, missing-field ranking by impact,
 * labelFor fallbacks, and edge cases (empty required list,
 * field present but falsy boolean, empty string treated as missing).
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_LABELS,
  evaluateGate,
  labelFor,
  rankMissingByImpact,
} from "./completenessGate";
import type { FinancialProfile } from "@shared/financialProfile";

describe("completenessGate / evaluateGate", () => {
  it("returns ready=true for an empty required list", () => {
    const r = evaluateGate({}, []);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.tier).toBe("high");
  });

  it("reports every missing required field", () => {
    const r = evaluateGate({ age: 40 }, ["age", "income", "savings"]);
    expect(r.ready).toBe(false);
    expect(r.populated).toBe(1);
    expect(r.missing).toEqual(["income", "savings"]);
    expect(r.ratio).toBeCloseTo(1 / 3, 4);
  });

  it("returns ready=true when every required field is populated", () => {
    const p: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
    };
    const r = evaluateGate(p, ["age", "income", "savings"]);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("treats undefined / null / NaN / empty string as missing", () => {
    const p = {
      age: undefined,
      income: null as unknown as number,
      savings: NaN,
      stateOfResidence: "",
    } as unknown as FinancialProfile;
    const r = evaluateGate(p, ["age", "income", "savings", "stateOfResidence"]);
    expect(r.missing).toEqual(["age", "income", "savings", "stateOfResidence"]);
    expect(r.ready).toBe(false);
  });

  it("treats zero as present (0 is a meaningful value)", () => {
    // `dependents: 0` is a legitimate user-entered answer
    const r = evaluateGate({ dependents: 0 }, ["dependents"]);
    expect(r.ready).toBe(true);
  });

  it("treats false booleans as present", () => {
    const r = evaluateGate({ isBizOwner: false }, ["isBizOwner"]);
    expect(r.ready).toBe(true);
  });

  it("dedupes duplicate field names in the required list", () => {
    const r = evaluateGate({ age: 40 }, ["age", "age", "age"]);
    expect(r.populated).toBe(1);
    expect(r.ratio).toBe(1);
  });

  it("assigns high tier when everything required AND all optional are filled", () => {
    const p: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
      monthlySavings: 1500,
      marginalRate: 0.25,
    };
    const r = evaluateGate(
      p,
      ["age", "income", "savings"],
      ["monthlySavings", "marginalRate"],
    );
    expect(r.tier).toBe("high");
  });

  it("assigns medium tier when required is full but optional is empty", () => {
    const p: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
    };
    const r = evaluateGate(
      p,
      ["age", "income", "savings"],
      ["monthlySavings", "marginalRate", "netWorth", "mortgage"],
    );
    // blendedRatio = (1 * 3 + 0) / 4 = 0.75 → medium
    expect(r.tier).toBe("medium");
  });

  it("assigns low tier when mostly empty", () => {
    const r = evaluateGate(
      { age: 40 },
      ["age", "income", "savings", "marginalRate"],
    );
    // reqRatio = 0.25, blended = (0.25 * 3 + 1) / 4 = 0.4375 → low
    expect(r.tier).toBe("low");
  });

  it("summary text reflects ready vs missing state", () => {
    const ready = evaluateGate({ age: 40 }, ["age"]);
    expect(ready.summary).toMatch(/ready/i);
    const missing = evaluateGate({}, ["age", "income"]);
    expect(missing.summary).toContain("2");
    expect(missing.summary).toContain("2 of 2");
  });

  it("handles the edge case where required list is larger than the profile", () => {
    const r = evaluateGate(
      {},
      ["age", "income", "savings", "monthlySavings", "dependents"],
    );
    expect(r.ready).toBe(false);
    expect(r.missing.length).toBe(5);
    expect(r.ratio).toBe(0);
    expect(r.tier).toBe("low");
  });
});

describe("completenessGate / rankMissingByImpact", () => {
  it("sorts descending by impact score", () => {
    const missing: (keyof FinancialProfile)[] = ["savings", "income", "age"];
    const impacts = { age: 1, income: 5, savings: 3 };
    expect(rankMissingByImpact(missing, impacts)).toEqual([
      "income",
      "savings",
      "age",
    ]);
  });

  it("treats missing impact scores as 0", () => {
    const missing: (keyof FinancialProfile)[] = ["netWorth", "age"];
    const impacts = { age: 5 };
    expect(rankMissingByImpact(missing, impacts)).toEqual(["age", "netWorth"]);
  });

  it("returns a new array (doesn't mutate input)", () => {
    const missing: (keyof FinancialProfile)[] = ["savings", "income"];
    const impacts = { income: 2, savings: 1 };
    const ranked = rankMissingByImpact(missing, impacts);
    expect(missing).toEqual(["savings", "income"]);
    expect(ranked).toEqual(["income", "savings"]);
  });
});

describe("completenessGate / labelFor", () => {
  it("returns explicit labels for known fields", () => {
    expect(labelFor("age")).toBe("Current age");
    expect(labelFor("isBizOwner")).toBe("Business owner?");
    expect(labelFor("desiredRetirementIncome")).toBe("Desired retirement income");
  });

  it("falls back to title case for unknown fields", () => {
    expect(labelFor("updatedAt")).toBe("Updated At");
  });

  it("every registered field has a non-empty label", () => {
    for (const [field, label] of Object.entries(FIELD_LABELS)) {
      expect(field.length).toBeGreaterThan(0);
      expect((label ?? "").length).toBeGreaterThan(0);
    }
  });
});
