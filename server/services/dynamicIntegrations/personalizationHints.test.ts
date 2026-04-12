/**
 * Tests for personalizationHints.ts (Pass 10 — personalization fold-back
 * from dynamic integrations into learning/calculator/chat).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { mapToCanonicalContact } from "./crmCanonicalMap";
import {
  extractPersonalizationHints,
  augmentWithCrmHints,
  summarizeHints,
} from "./personalizationHints";

describe("extractPersonalizationHints — learning tracks", () => {
  it("detects Series 7 licensing", () => {
    const schema = inferSchema([
      { id: 1, series_7_date: "2022-01-01" },
      { id: 2, series_7_date: "2023-05-15" },
    ]);
    const result = extractPersonalizationHints(schema);
    const hint = result.hints.find((h) => h.key === "series_7");
    expect(hint).toBeDefined();
    expect(hint?.category).toBe("learning_track");
    expect(hint?.confidence).toBeGreaterThan(0.8);
  });

  it("detects CFP credentialing", () => {
    const schema = inferSchema([
      { id: 1, cfp_status: "active" },
      { id: 2, cfp_status: "pending" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "cfp")).toBeDefined();
  });

  it("detects retirement planning", () => {
    const schema = inferSchema([
      { id: 1, roth_ira_balance: "$50,000" },
      { id: 2, roth_ira_balance: "$120,000" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "retirement_calculator")).toBeDefined();
    expect(result.hints.find((h) => h.key === "retirement_planning")).toBeDefined();
  });

  it("detects premium financing", () => {
    const schema = inferSchema([
      { id: 1, premium_finance_loan: "$100,000" },
      { id: 2, premium_finance_loan: "$250,000" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "premium_financing")).toBeDefined();
    expect(result.hints.find((h) => h.key === "premium_finance_calculator")).toBeDefined();
  });
});

describe("extractPersonalizationHints — calculator focus", () => {
  it("spotlights estate calculator when trust/will present", () => {
    const schema = inferSchema([
      { id: 1, trust_type: "revocable" },
      { id: 2, trust_type: "irrevocable" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "estate_calculator")).toBeDefined();
    expect(result.hints.find((h) => h.key === "estate_planning")).toBeDefined();
  });

  it("spotlights tax calculator when AGI/deduction present", () => {
    const schema = inferSchema([
      { id: 1, adjusted_gross: 150000 },
      { id: 2, adjusted_gross: 220000 },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "tax_planning_calculator")).toBeDefined();
  });
});

describe("extractPersonalizationHints — risk indicators", () => {
  it("flags debt exposure", () => {
    const schema = inferSchema([
      { id: 1, mortgage_balance: 300000, credit_card_debt: 5000 },
      { id: 2, mortgage_balance: 450000, credit_card_debt: 12000 },
    ]);
    const result = extractPersonalizationHints(schema);
    const debt = result.hints.filter((h) => h.key === "debt_exposure");
    expect(debt.length).toBeGreaterThanOrEqual(1);
  });

  it("flags missing beneficiary when null rate is high", () => {
    const schema = inferSchema([
      { id: 1, beneficiary: "Alice" },
      { id: 2, beneficiary: null },
      { id: 3, beneficiary: null },
      { id: 4, beneficiary: null },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "missing_beneficiary")).toBeDefined();
  });

  it("does NOT flag beneficiary when all rows have one", () => {
    const schema = inferSchema([
      { id: 1, beneficiary: "Alice" },
      { id: 2, beneficiary: "Bob" },
      { id: 3, beneficiary: "Carol" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "missing_beneficiary")).toBeUndefined();
  });
});

describe("extractPersonalizationHints — CRM segment + retention", () => {
  it("detects HNW segment from net_worth field", () => {
    const schema = inferSchema([
      { id: 1, net_worth: 2_500_000 },
      { id: 2, net_worth: 4_100_000 },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "high_net_worth")).toBeDefined();
  });

  it("detects retention signal from last_login", () => {
    const schema = inferSchema([
      { id: 1, last_login: "2024-01-01T00:00:00Z" },
      { id: 2, last_login: "2024-06-15T00:00:00Z" },
    ]);
    const result = extractPersonalizationHints(schema);
    expect(result.hints.find((h) => h.key === "activity_tracking")).toBeDefined();
  });
});

describe("extractPersonalizationHints — dedup + ranking", () => {
  it("dedupes same-key hints from multiple fields", () => {
    const schema = inferSchema([
      { id: 1, roth_ira_balance: "$50,000", pension_balance: "$100,000" },
      { id: 2, roth_ira_balance: "$100,000", pension_balance: "$200,000" },
    ]);
    const result = extractPersonalizationHints(schema);
    const retirementCalcHints = result.hints.filter((h) => h.key === "retirement_calculator");
    // Even though two fields match, only one hint should remain
    expect(retirementCalcHints.length).toBe(1);
  });

  it("sorts by priority then confidence", () => {
    const schema = inferSchema([
      { id: 1, trust_type: "revocable", mortgage_balance: 300000 },
      { id: 2, trust_type: "irrevocable", mortgage_balance: 450000 },
    ]);
    const result = extractPersonalizationHints(schema);
    // Estate calc (priority 1) should come before debt_exposure (priority 2)
    const estateIdx = result.hints.findIndex((h) => h.key === "estate_calculator");
    const debtIdx = result.hints.findIndex((h) => h.key === "debt_exposure");
    if (estateIdx !== -1 && debtIdx !== -1) {
      expect(estateIdx).toBeLessThan(debtIdx);
    }
  });

  it("respects minConfidence threshold", () => {
    const schema = inferSchema([
      { id: 1, mortgage_balance: 300000 },
      { id: 2, mortgage_balance: 450000 },
    ]);
    // debt_exposure has confidence 0.7
    const result = extractPersonalizationHints(schema, { minConfidence: 0.8 });
    expect(result.hints.find((h) => h.key === "debt_exposure")).toBeUndefined();
  });
});

describe("augmentWithCrmHints", () => {
  it("adds no-email warning when mapping is missing email", () => {
    const schema = inferSchema([
      { id: 1, first_name: "Alice" },
      { id: 2, first_name: "Bob" },
    ]);
    const mapping = mapToCanonicalContact(schema);
    const base = extractPersonalizationHints(schema);
    const augmented = augmentWithCrmHints(base, mapping);
    expect(augmented.byCategory.chat_context.find((h) => h.key === "no_email")).toBeDefined();
  });

  it("adds b2b segment hint when company field is present", () => {
    const schema = inferSchema([
      { id: 1, email: "a@x.com", company_name: "Acme Inc" },
      { id: 2, email: "b@y.com", company_name: "Globex" },
    ]);
    const mapping = mapToCanonicalContact(schema);
    const base = extractPersonalizationHints(schema);
    const augmented = augmentWithCrmHints(base, mapping);
    expect(augmented.byCategory.crm_segment.find((h) => h.key === "b2b_orient")).toBeDefined();
  });
});

describe("summarizeHints", () => {
  it("produces a one-line summary", () => {
    const schema = inferSchema([
      { id: 1, roth_ira_balance: "$50,000", trust_type: "revocable" },
      { id: 2, roth_ira_balance: "$80,000", trust_type: "irrevocable" },
    ]);
    const result = extractPersonalizationHints(schema);
    const summary = summarizeHints(result);
    expect(summary).toContain("hints");
    expect(summary).toContain("learning");
    expect(summary).toContain("calc");
  });
});
