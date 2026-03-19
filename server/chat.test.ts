import { describe, expect, it } from "vitest";
import { buildSystemPrompt, FINANCIAL_DISCLAIMER, needsFinancialDisclaimer, detectPII, stripPII, calculateConfidence } from "./prompts";

describe("System Prompt Builder", () => {
  it("builds a general-focus prompt when focus is 'general'", () => {
    const prompt = buildSystemPrompt({ focus: "general", mode: "client" });
    expect(prompt).toContain("intelligent AI advisor");
    expect(prompt).toContain("general_expertise");
    expect(prompt).not.toContain("financial_expertise");
  });

  it("builds a financial-focus prompt when focus is 'financial'", () => {
    const prompt = buildSystemPrompt({ focus: "financial", mode: "client" });
    expect(prompt).toContain("financial_expertise");
    expect(prompt).toContain("financial_expertise");
  });

  it("builds a combined prompt when multiple focus modes are active", () => {
    const prompt = buildSystemPrompt({ focus: "general", mode: "client", focusModes: ["general", "financial"] });
    expect(prompt).toContain("general_expertise");
    expect(prompt).toContain("financial_expertise");
  });

  it("adjusts tone for client advisory mode", () => {
    const prompt = buildSystemPrompt({ focus: "both", mode: "client" });
    expect(prompt).toContain("clear, accessible language");
  });

  it("adjusts tone for coach advisory mode", () => {
    const prompt = buildSystemPrompt({ focus: "both", mode: "coach" });
    expect(prompt).toContain("PROFESSIONAL COACH MODE");
  });

  it("adjusts tone for manager advisory mode", () => {
    const prompt = buildSystemPrompt({ focus: "both", mode: "manager" });
    expect(prompt).toContain("strategic");
  });

  it("includes user style profile when provided", () => {
    const prompt = buildSystemPrompt({ focus: "both", mode: "client", styleProfile: "Speaks formally, uses bullet points" });
    expect(prompt).toContain("Speaks formally, uses bullet points");
  });

  it("includes suitability note when completed", () => {
    const prompt = buildSystemPrompt({ focus: "financial", mode: "client", suitabilityCompleted: true });
    expect(prompt).toContain("completed their suitability assessment");
  });

  it("warns when suitability not completed", () => {
    const prompt = buildSystemPrompt({ focus: "financial", mode: "client", suitabilityCompleted: false });
    expect(prompt).toContain("NOT completed a suitability assessment");
  });
});

describe("Financial Disclaimer", () => {
  it("exports a non-empty disclaimer string", () => {
    expect(FINANCIAL_DISCLAIMER).toBeTruthy();
    expect(typeof FINANCIAL_DISCLAIMER).toBe("string");
    expect(FINANCIAL_DISCLAIMER.length).toBeGreaterThan(10);
  });

  it("detects financial topics needing disclaimer", () => {
    expect(needsFinancialDisclaimer("Tell me about IUL insurance", "financial")).toBe(true);
    expect(needsFinancialDisclaimer("What about premium financing?", "financial")).toBe(true);
    expect(needsFinancialDisclaimer("retirement planning strategies", "financial")).toBe(true);
  });

  it("does not flag general-focus responses", () => {
    expect(needsFinancialDisclaimer("Tell me about IUL insurance", "general")).toBe(false);
  });

  it("does not flag non-financial content", () => {
    expect(needsFinancialDisclaimer("How is the weather today?", "financial")).toBe(false);
  });
});

describe("PII Detection", () => {
  it("detects SSN patterns", () => {
    const result = detectPII("My SSN is 123-45-6789");
    expect(result.hasPII).toBe(true);
    expect(result.types).toContain("SSN");
  });

  it("detects credit card patterns", () => {
    const result = detectPII("Card number 4111111111111111");
    expect(result.hasPII).toBe(true);
    expect(result.types).toContain("credit_card");
  });

  it("returns false for clean text", () => {
    const result = detectPII("Hello, how are you today?");
    expect(result.hasPII).toBe(false);
    expect(result.types).toHaveLength(0);
  });

  it("strips PII from text", () => {
    const stripped = stripPII("My SSN is 123-45-6789 and card is 4111111111111111");
    expect(stripped).not.toContain("123-45-6789");
    expect(stripped).not.toContain("4111111111111111");
    expect(stripped).toContain("SSN_REDACTED");
    expect(stripped).toContain("CARD_REDACTED");
  });
});

describe("Confidence Scoring", () => {
  it("returns a number between 0 and 1", () => {
    const score = calculateConfidence({ hasRAGContext: false, hasSuitability: false, focus: "financial", isFinancialAdvice: true, responseLength: 100 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("gives higher confidence with RAG context", () => {
    const withoutRAG = calculateConfidence({ hasRAGContext: false, hasSuitability: true, focus: "financial", isFinancialAdvice: true, responseLength: 500 });
    const withRAG = calculateConfidence({ hasRAGContext: true, hasSuitability: true, focus: "financial", isFinancialAdvice: true, responseLength: 500 });
    expect(withRAG).toBeGreaterThan(withoutRAG);
  });

  it("penalizes financial advice without suitability", () => {
    const withSuit = calculateConfidence({ hasRAGContext: false, hasSuitability: true, focus: "financial", isFinancialAdvice: true, responseLength: 500 });
    const withoutSuit = calculateConfidence({ hasRAGContext: false, hasSuitability: false, focus: "financial", isFinancialAdvice: true, responseLength: 500 });
    expect(withSuit).toBeGreaterThan(withoutSuit);
  });

  it("base confidence is 0.7", () => {
    const score = calculateConfidence({ hasRAGContext: false, hasSuitability: false, focus: "general", isFinancialAdvice: false, responseLength: 100 });
    expect(score).toBe(0.7);
  });
});
