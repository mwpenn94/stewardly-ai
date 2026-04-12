import { describe, it, expect } from "vitest";
import {
  scoreLengthAdequacy,
  scoreStructuralRichness,
  scoreComplianceAwareness,
  scoreHallucinationRisk,
  scoreCoherence,
  scoreResponse,
} from "./autoQualityRater";

describe("autoQualityRater — pure scoring functions", () => {
  // ── Length Adequacy ────────────────────────────────────────────────
  describe("scoreLengthAdequacy", () => {
    it("penalizes very short responses", () => {
      expect(scoreLengthAdequacy("Hi")).toBe(0.1);
      expect(scoreLengthAdequacy("I don't know the answer to that.")).toBe(0.3);
    });

    it("gives full marks for medium-length responses", () => {
      const medium = "A".repeat(500);
      expect(scoreLengthAdequacy(medium)).toBe(1.0);
    });

    it("slightly penalizes very long responses", () => {
      const long = "A".repeat(10000);
      expect(scoreLengthAdequacy(long)).toBe(0.6);
    });

    it("handles the sweet spot boundary correctly", () => {
      expect(scoreLengthAdequacy("A".repeat(4000))).toBe(1.0);
      expect(scoreLengthAdequacy("A".repeat(4001))).toBe(0.8);
    });
  });

  // ── Structural Richness ───────────────────────────────────────────
  describe("scoreStructuralRichness", () => {
    it("gives base score for plain text", () => {
      expect(scoreStructuralRichness("Just a plain text response.")).toBe(0.3);
    });

    it("scores higher for markdown-rich content", () => {
      const rich = `## Overview
- Item one
- Item two

**Important:** Here is a code example:

\`\`\`typescript
const x = 1;
\`\`\`

| Col A | Col B |
|-------|-------|
| 1     | 2     |
`;
      const score = scoreStructuralRichness(rich);
      expect(score).toBeGreaterThan(0.8);
    });

    it("detects bullet lists", () => {
      const withBullets = "Here are the steps:\n- Step 1\n- Step 2\n- Step 3";
      expect(scoreStructuralRichness(withBullets)).toBeGreaterThan(0.4);
    });

    it("detects numbered lists", () => {
      const withNumbers = "Here are the steps:\n1. Step 1\n2. Step 2";
      expect(scoreStructuralRichness(withNumbers)).toBeGreaterThan(0.4);
    });
  });

  // ── Compliance Awareness ──────────────────────────────────────────
  describe("scoreComplianceAwareness", () => {
    it("gives full score when no advice is given", () => {
      expect(scoreComplianceAwareness("The weather is nice today.")).toBe(1.0);
    });

    it("penalizes financial advice without disclaimer", () => {
      expect(scoreComplianceAwareness("I recommend you should invest in index funds for your portfolio.")).toBe(0.4);
    });

    it("gives full score when advice has disclaimer", () => {
      const withDisclaimer = "I recommend index funds for your portfolio. " +
        "This is not financial advice — please consult a licensed professional.";
      expect(scoreComplianceAwareness(withDisclaimer)).toBe(1.0);
    });

    it("detects various advice signal words", () => {
      expect(scoreComplianceAwareness("The best strategy is to maximize your 401k allocation.")).toBe(0.4);
      expect(scoreComplianceAwareness("Consider investing in bonds for your retirement plan.")).toBe(0.4);
    });
  });

  // ── Hallucination Risk ────────────────────────────────────────────
  describe("scoreHallucinationRisk", () => {
    it("gives full score with no URLs", () => {
      expect(scoreHallucinationRisk("No links here.")).toBe(1.0);
    });

    it("gives full score for trusted URLs", () => {
      expect(scoreHallucinationRisk("Check https://www.irs.gov/taxes for details.")).toBe(1.0);
    });

    it("penalizes suspicious URLs", () => {
      const suspicious = "See https://fake.sub.domain.random.example.com/very/long/path/that/goes/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/for/a/very/long/time";
      expect(scoreHallucinationRisk(suspicious)).toBeLessThan(1.0);
    });

    it("handles malformed URLs", () => {
      expect(scoreHallucinationRisk("Visit http://[invalid for info")).toBeLessThan(1.0);
    });
  });

  // ── Coherence ─────────────────────────────────────────────────────
  describe("scoreCoherence", () => {
    it("gives low score for very short content", () => {
      expect(scoreCoherence("OK.")).toBe(0.5);
    });

    it("gives high score for well-structured sentences", () => {
      const good = "This is a well-written response. It has multiple sentences of reasonable length. Each point is clearly made. The reader can follow the logic easily.";
      expect(scoreCoherence(good)).toBeGreaterThanOrEqual(0.7);
    });

    it("penalizes responses with no sentence breaks", () => {
      const noBreaks = "A" + " word".repeat(100);
      expect(scoreCoherence(noBreaks)).toBeLessThan(0.7);
    });
  });

  // ── Overall Score ─────────────────────────────────────────────────
  describe("scoreResponse", () => {
    it("returns 0 for empty content", () => {
      const score = scoreResponse("");
      expect(score.overall).toBe(0);
      expect(score.reasoning).toContain("Empty");
    });

    it("returns 0 for null-like content", () => {
      const score = scoreResponse(null as any);
      expect(score.overall).toBe(0);
    });

    it("scores a good response highly", () => {
      const good = `## Analysis

Based on your financial profile, here are the key findings:

- **Savings rate:** Your 15% savings rate is above the national average
- **Investment mix:** The current allocation aligns with your risk tolerance
- **Tax optimization:** Consider maximizing your 401(k) contributions

This is general information only — please consult a licensed financial advisor for personalized recommendations based on your individual circumstances.`;

      const score = scoreResponse(good);
      expect(score.overall).toBeGreaterThan(0.7);
      expect(score.dimensions.complianceAwareness).toBe(1.0);
      expect(score.dimensions.structuralRichness).toBeGreaterThan(0.5);
    });

    it("scores a poor response lower", () => {
      const poor = "You should invest in crypto.";
      const score = scoreResponse(poor);
      expect(score.overall).toBeLessThan(0.6);
      expect(score.dimensions.complianceAwareness).toBe(0.4); // advice without disclaimer
    });

    it("overall is a weighted average of dimensions", () => {
      const content = "A reasonable response with enough length and structure.";
      const score = scoreResponse(content);

      // Verify overall is between 0 and 1
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);

      // Verify all dimensions are between 0 and 1
      for (const val of Object.values(score.dimensions)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });
});
