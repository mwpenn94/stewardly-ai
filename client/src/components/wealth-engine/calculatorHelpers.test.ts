/**
 * calculatorHelpers.test.ts — Unit tests for pure calculator helper functions.
 *
 * Tests formatBenchmarkValue, transformDbQuestion, transformDbQuestions,
 * and sanitizeGuardrailParams.
 */
import { describe, it, expect } from "vitest";
import {
  formatBenchmarkValue,
  BENCHMARK_LABELS,
  PARAM_LABELS,
  transformDbQuestion,
  transformDbQuestions,
  sanitizeGuardrailParams,
} from "./calculatorHelpers";

/* ── formatBenchmarkValue ─────────────────────────────────────── */

describe("formatBenchmarkValue", () => {
  it("formats national savings rate (national field)", () => {
    expect(formatBenchmarkValue("savingsRate", { national: 0.062 })).toBe("6.2%");
  });

  it("formats investor behavior gap (gap field)", () => {
    expect(formatBenchmarkValue("investorBehaviorGap", { gap: 0.035 })).toBe("3.5%/yr");
  });

  it("formats life insurance gap (pct field)", () => {
    expect(formatBenchmarkValue("lifeInsuranceGap", { pct: 0.41 })).toBe("41%");
  });

  it("formats avg advisory fee with 2 decimal places", () => {
    expect(formatBenchmarkValue("avgAdvisoryFee", { value: 0.0102 })).toBe("1.02%");
  });

  it("formats advisor alpha with tilde", () => {
    expect(formatBenchmarkValue("advisorAlpha", { value: 0.03 })).toBe("~3%/yr");
  });

  it("formats avg wealth growth (sp500 field)", () => {
    expect(formatBenchmarkValue("avgWealthGrowth", { sp500: 0.103 })).toBe("S&P: 10.3%");
  });

  it("returns dash for empty benchmark", () => {
    expect(formatBenchmarkValue("unknown", {})).toBe("—");
  });

  it("returns raw value string for generic value field", () => {
    expect(formatBenchmarkValue("custom", { value: 42 })).toBe("42");
  });

  it("prefers national over gap when both present", () => {
    expect(formatBenchmarkValue("test", { national: 0.05, gap: 0.02 })).toBe("5.0%");
  });
});

/* ── BENCHMARK_LABELS + PARAM_LABELS ──────────────────────────── */

describe("BENCHMARK_LABELS", () => {
  it("has labels for all expected benchmark keys", () => {
    expect(BENCHMARK_LABELS.savingsRate).toBe("National Savings Rate");
    expect(BENCHMARK_LABELS.avgAdvisoryFee).toBe("Avg Advisory Fee");
    expect(BENCHMARK_LABELS.avgWealthGrowth).toBe("Avg Wealth Growth");
  });
});

describe("PARAM_LABELS", () => {
  it("has labels for common guardrail parameters", () => {
    expect(PARAM_LABELS.returnRate).toBe("Investment Return");
    expect(PARAM_LABELS.savingsRate).toBe("Savings Rate");
    expect(PARAM_LABELS.taxRate).toBe("Tax Rate");
  });
});

/* ── transformDbQuestion ──────────────────────────────────────── */

describe("transformDbQuestion", () => {
  const validQ = {
    id: 42,
    prompt: "What is compound interest?",
    options: ["Simple growth", "Interest on interest", "Fixed rate", "None"],
    correctIndex: 1,
    explanation: "Compound interest earns interest on prior interest.",
    difficulty: "easy",
    tags: ["finance-basics"],
    status: "published",
  };

  it("transforms a valid question", () => {
    const result = transformDbQuestion(validQ, "sie", "SIE Exam");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("42");
    expect(result!.text).toBe("What is compound interest?");
    expect(result!.options).toHaveLength(4);
    expect(result!.options[0]).toEqual({ key: "A", text: "Simple growth" });
    expect(result!.options[1]).toEqual({ key: "B", text: "Interest on interest" });
    expect(result!.correctKey).toBe("B");
    expect(result!.explanation).toBe("Compound interest earns interest on prior interest.");
    expect(result!.topic).toBe("finance-basics");
    expect(result!.difficulty).toBe("easy");
    expect(result!.moduleSlug).toBe("sie");
  });

  it("falls back to q.correct when correctIndex missing", () => {
    const q = { ...validQ, correctIndex: undefined, correct: 2 };
    const result = transformDbQuestion(q, "test");
    expect(result!.correctKey).toBe("C");
  });

  it("falls back to q.text when prompt missing", () => {
    const q = { ...validQ, prompt: undefined, text: "Fallback text" };
    const result = transformDbQuestion(q, "test");
    expect(result!.text).toBe("Fallback text");
  });

  it("returns null for null input", () => {
    expect(transformDbQuestion(null, "test")).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(transformDbQuestion("string", "test")).toBeNull();
  });

  it("returns null when options has fewer than 2 items", () => {
    expect(transformDbQuestion({ ...validQ, options: ["only one"] }, "test")).toBeNull();
  });

  it("returns null when options is not an array", () => {
    expect(transformDbQuestion({ ...validQ, options: "not array" }, "test")).toBeNull();
  });

  it("returns null when correctIndex is out of bounds", () => {
    expect(transformDbQuestion({ ...validQ, correctIndex: 10 }, "test")).toBeNull();
  });

  it("returns null when text and prompt are both empty", () => {
    expect(transformDbQuestion({ ...validQ, prompt: "", text: "" }, "test")).toBeNull();
  });

  it("defaults difficulty to medium when not provided", () => {
    const q = { ...validQ, difficulty: undefined };
    const result = transformDbQuestion(q, "test");
    expect(result!.difficulty).toBe("medium");
  });

  it("uses trackName as topic when tags are empty", () => {
    const q = { ...validQ, tags: undefined };
    const result = transformDbQuestion(q, "sie", "SIE Exam");
    expect(result!.topic).toBe("SIE Exam");
  });

  it("uses slug as topic when both tags and trackName are missing", () => {
    const q = { ...validQ, tags: undefined };
    const result = transformDbQuestion(q, "sie");
    expect(result!.topic).toBe("sie");
  });
});

/* ── transformDbQuestions ──────────────────────────────────────── */

describe("transformDbQuestions", () => {
  const published = {
    id: 1, prompt: "Q1", options: ["A", "B"], correctIndex: 0, status: "published",
  };
  const draft = {
    id: 2, prompt: "Q2", options: ["A", "B"], correctIndex: 0, status: "draft",
  };
  const noStatus = {
    id: 3, prompt: "Q3", options: ["A", "B"], correctIndex: 0,
  };

  it("includes published questions", () => {
    const result = transformDbQuestions([published], "test");
    expect(result).toHaveLength(1);
  });

  it("excludes draft questions", () => {
    const result = transformDbQuestions([draft], "test");
    expect(result).toHaveLength(0);
  });

  it("includes questions with no status (backwards compat)", () => {
    const result = transformDbQuestions([noStatus], "test");
    expect(result).toHaveLength(1);
  });

  it("filters out malformed questions", () => {
    const result = transformDbQuestions([published, { id: 4, prompt: "", options: [] }], "test");
    expect(result).toHaveLength(1);
  });

  it("returns empty array for non-array input", () => {
    expect(transformDbQuestions("not array" as any, "test")).toEqual([]);
  });

  it("handles empty array", () => {
    expect(transformDbQuestions([], "test")).toEqual([]);
  });
});

/* ── sanitizeGuardrailParams ──────────────────────────────────── */

describe("sanitizeGuardrailParams", () => {
  it("passes through valid numeric params", () => {
    expect(sanitizeGuardrailParams({ a: 1, b: 2.5 })).toEqual({ a: 1, b: 2.5 });
  });

  it("strips NaN values", () => {
    expect(sanitizeGuardrailParams({ good: 1, bad: NaN })).toEqual({ good: 1 });
  });

  it("strips non-number values", () => {
    const params = { num: 1, str: "hello" as any, bool: true as any };
    expect(sanitizeGuardrailParams(params)).toEqual({ num: 1 });
  });

  it("handles empty object", () => {
    expect(sanitizeGuardrailParams({})).toEqual({});
  });
});
