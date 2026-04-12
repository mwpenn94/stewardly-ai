/**
 * Tests for the financial profile validators. Per-field range +
 * required rules, cross-field checks, aggregation / summary,
 * and the dedupe behavior on aggregated issues.
 */

import { describe, it, expect } from "vitest";
import {
  marginalRateReminderRule,
  mortgageNetWorthRule,
  profileIsValid,
  rangeRule,
  requiredRule,
  retirementAfterAgeRule,
  savingsToIncomeSanityRule,
  standardRules,
  validateProfile,
  validationSummary,
} from "./financialProfileValidators";

describe("validators / rangeRule", () => {
  const rule = rangeRule("age", { min: 0, max: 120, label: "Age" });

  it("accepts values within range", () => {
    expect(rule.validate(40, {})).toBeNull();
    expect(rule.validate(0, {})).toBeNull();
    expect(rule.validate(120, {})).toBeNull();
  });

  it("rejects values below min", () => {
    const issue = rule.validate(-5, {});
    expect(issue).not.toBeNull();
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("Age must be at least 0");
  });

  it("rejects values above max", () => {
    const issue = rule.validate(200, {});
    expect(issue?.message).toContain("Age must be at most 120");
  });

  it("ignores undefined / null / NaN", () => {
    expect(rule.validate(undefined as unknown as number, {})).toBeNull();
    expect(rule.validate(Number.NaN, {})).toBeNull();
  });
});

describe("validators / requiredRule", () => {
  const rule = requiredRule("income", "Income");

  it("accepts a present value", () => {
    expect(rule.validate(120000, {})).toBeNull();
    expect(rule.validate(0, {})).toBeNull(); // 0 is still present
  });

  it("rejects undefined", () => {
    const issue = rule.validate(undefined, {});
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("required");
  });

  it("rejects empty string", () => {
    const issue = rule.validate("", {});
    expect(issue).not.toBeNull();
  });

  it("rejects NaN", () => {
    const issue = rule.validate(Number.NaN, {});
    expect(issue).not.toBeNull();
  });
});

describe("validators / retirementAfterAgeRule", () => {
  const rule = retirementAfterAgeRule();

  it("accepts normal case (retirement > age)", () => {
    expect(rule.validate(undefined, { age: 40, retirementAge: 65 })).toBeNull();
  });

  it("rejects retirement ≤ age", () => {
    const issue = rule.validate(undefined, { age: 65, retirementAge: 60 });
    expect(issue?.severity).toBe("error");
  });

  it("warns when retirement is 0-1 years away", () => {
    const issue = rule.validate(undefined, { age: 64, retirementAge: 65 });
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("decumulation");
  });

  it("no-ops when either field missing", () => {
    expect(rule.validate(undefined, { age: 40 })).toBeNull();
    expect(rule.validate(undefined, { retirementAge: 65 })).toBeNull();
  });
});

describe("validators / savingsToIncomeSanityRule", () => {
  const rule = savingsToIncomeSanityRule();

  it("accepts reasonable savings:income ratios", () => {
    expect(rule.validate(undefined, { savings: 500000, income: 150000 })).toBeNull();
  });

  it("warns on 50× income", () => {
    const issue = rule.validate(undefined, {
      savings: 10_000_000,
      income: 100_000,
    });
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toMatch(/unit error/i);
  });

  it("no-ops when income is 0", () => {
    expect(rule.validate(undefined, { savings: 1_000_000, income: 0 })).toBeNull();
  });
});

describe("validators / mortgageNetWorthRule", () => {
  const rule = mortgageNetWorthRule();

  it("accepts mortgage ≤ net worth", () => {
    expect(
      rule.validate(undefined, { mortgage: 200_000, netWorth: 500_000 }),
    ).toBeNull();
  });

  it("warns when underwater", () => {
    const issue = rule.validate(undefined, {
      mortgage: 500_000,
      netWorth: 200_000,
    });
    expect(issue?.severity).toBe("warning");
  });

  it("no-ops when netWorth is 0 (data not yet entered)", () => {
    expect(
      rule.validate(undefined, { mortgage: 200_000, netWorth: 0 }),
    ).toBeNull();
  });
});

describe("validators / marginalRateReminderRule", () => {
  const rule = marginalRateReminderRule();

  it("fires info reminder when income known but marginalRate missing", () => {
    const issue = rule.validate(undefined, { income: 120_000 });
    expect(issue?.severity).toBe("info");
  });

  it("no-ops when both income and marginalRate are set", () => {
    expect(
      rule.validate(undefined, { income: 120_000, marginalRate: 0.25 }),
    ).toBeNull();
  });

  it("no-ops when income is missing", () => {
    expect(rule.validate(undefined, {})).toBeNull();
  });
});

describe("validators / validateProfile", () => {
  it("returns empty for a valid profile", () => {
    const issues = validateProfile({
      age: 40,
      retirementAge: 65,
      income: 120_000,
      savings: 50_000,
      dependents: 2,
      marginalRate: 0.25,
    });
    expect(issues.length).toBe(0);
  });

  it("aggregates errors from multiple rules", () => {
    const issues = validateProfile({
      age: 200,
      retirementAge: 60,
      income: 120_000,
    });
    // age out of range, retirementAge < age
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("dedupes identical (field, message) pairs", () => {
    // Run validateProfile with a rule list that intentionally
    // duplicates the retirement-after-age rule twice.
    const rules = [
      { field: "_cross" as const, rule: retirementAfterAgeRule() },
      { field: "_cross" as const, rule: retirementAfterAgeRule() },
    ];
    const issues = validateProfile(
      { age: 65, retirementAge: 60 },
      rules,
    );
    // Despite 2 rules, only 1 issue should be emitted (dedupe)
    expect(issues.length).toBe(1);
  });
});

describe("validators / profileIsValid", () => {
  it("returns true when profile has no errors", () => {
    expect(
      profileIsValid({
        age: 40,
        retirementAge: 65,
        income: 120_000,
      }),
    ).toBe(true);
  });

  it("returns false when profile has an error", () => {
    expect(
      profileIsValid({ age: 999 }),
    ).toBe(false);
  });

  it("returns true when profile has only warnings/infos", () => {
    // warnings only: income 100k but no marginalRate → info + no error
    expect(
      profileIsValid({ income: 100_000 }),
    ).toBe(true);
  });
});

describe("validators / validationSummary", () => {
  it("counts by severity", () => {
    const issues = validateProfile({
      age: 300,
      income: 150_000,
      savings: 10_000_000,
    });
    const summary = validationSummary(issues);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
    expect(summary.warnings + summary.infos).toBeGreaterThanOrEqual(1);
  });

  it("returns zero counts for no issues", () => {
    expect(validationSummary([])).toEqual({ errors: 0, warnings: 0, infos: 0 });
  });
});

describe("validators / standardRules integrity", () => {
  it("ships every critical field rule", () => {
    const rules = standardRules();
    const fields = rules.map((r) => r.field);
    expect(fields).toContain("age");
    expect(fields).toContain("income");
    expect(fields).toContain("savings");
    expect(fields).toContain("_cross");
  });
});
