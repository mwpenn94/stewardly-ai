/**
 * Tests for crossModelDistillation.ts (Pass 8 — continuous training from
 * multi-model outputs).
 */

import { describe, it, expect } from "vitest";
import {
  splitIntoSentences,
  normalizeClaim,
  extractClaims,
  jaccardSimilarity,
  clusterClaims,
  distillConsensus,
  buildTrainingExamples,
  summarizeDistillation,
} from "./crossModelDistillation";

describe("splitIntoSentences", () => {
  it("splits on periods", () => {
    expect(splitIntoSentences("First. Second. Third.")).toEqual(["First", "Second", "Third"]);
  });

  it("handles question and exclamation marks", () => {
    expect(splitIntoSentences("Why? Because! End.")).toEqual(["Why", "Because", "End"]);
  });

  it("collapses newlines", () => {
    expect(splitIntoSentences("A.\nB.\n\nC.")).toEqual(["A", "B", "C"]);
  });

  it("returns empty for empty input", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });
});

describe("normalizeClaim", () => {
  it("lowercases and trims", () => {
    expect(normalizeClaim("  Hello World  ")).toBe("hello world");
  });

  it("strips filler prefixes", () => {
    expect(normalizeClaim("In my opinion, the market is volatile")).toBe("the market is volatile");
    expect(normalizeClaim("I think this is correct")).toBe("this is correct");
    expect(normalizeClaim("Note that, the rate is 5%")).toBe("the rate is 5%");
  });

  it("respects ignoreFillerPhrases=false", () => {
    expect(normalizeClaim("In my opinion, this is true", { ignoreFillerPhrases: false })).toBe("in my opinion, this is true");
  });

  it("strips trailing punctuation", () => {
    expect(normalizeClaim("A statement.")).toBe("a statement");
    expect(normalizeClaim("A fact!")).toBe("a fact");
  });
});

describe("extractClaims", () => {
  it("breaks a model output into claims", () => {
    const claims = extractClaims({
      model: "test",
      text: "The S&P 500 averaged 10% returns. Volatility increases with leverage. Diversification reduces risk.",
    });
    expect(claims.length).toBe(3);
    expect(claims[0].model).toBe("test");
  });

  it("filters out short claims", () => {
    const claims = extractClaims({
      model: "test",
      text: "Yes. The market is very complex and has many moving parts.",
    });
    expect(claims.length).toBe(1); // "Yes" gets filtered (< 12 chars)
  });

  it("filters out overly long claims", () => {
    const long = "a ".repeat(300); // 600 chars
    const claims = extractClaims({
      model: "test",
      text: `Short enough sentence here. ${long}.`,
    });
    expect(claims.every((c) => c.normalized.length <= 500)).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(jaccardSimilarity("the market rose 5%", "the market rose 5%")).toBe(1);
  });

  it("returns 0 for completely disjoint strings", () => {
    expect(jaccardSimilarity("apple orange banana", "computer television phone")).toBe(0);
  });

  it("returns a fractional value for partial overlap", () => {
    const sim = jaccardSimilarity("the market rose five percent", "the market fell five percent");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe("clusterClaims", () => {
  it("groups similar claims into one cluster", () => {
    const claims = [
      { text: "Diversification reduces risk", normalized: "diversification reduces risk", model: "a" },
      { text: "Risk is reduced by diversification", normalized: "risk is reduced by diversification", model: "b" },
      { text: "Inflation erodes purchasing power", normalized: "inflation erodes purchasing power", model: "c" },
    ];
    const clusters = clusterClaims(claims, 0.3);
    // The two diversification claims should cluster together
    const clusterWithDiv = clusters.find((c) => c.length > 1);
    expect(clusterWithDiv).toBeDefined();
  });

  it("keeps unique claims separate", () => {
    const claims = [
      { text: "Apple is a fruit", normalized: "apple is a fruit", model: "a" },
      { text: "Computers use electricity", normalized: "computers use electricity", model: "b" },
    ];
    const clusters = clusterClaims(claims);
    expect(clusters.length).toBe(2);
  });
});

describe("distillConsensus", () => {
  it("returns empty-ish for a single model", () => {
    const result = distillConsensus([
      { model: "a", text: "The market is volatile. Diversification helps. Timing is difficult." },
    ]);
    // With 1 model, no claim can reach consensus threshold (2/3 default)
    expect(result.consensusClaims.length).toBe(0);
    expect(result.uniqueToOneModel.length).toBe(3);
  });

  it("extracts consensus claims when multiple models agree", () => {
    const result = distillConsensus([
      { model: "a", text: "Diversification reduces portfolio risk significantly." },
      { model: "b", text: "A diversified portfolio has reduced risk." },
      { model: "c", text: "Diversification is one way to reduce risk in portfolios." },
    ]);
    // All 3 models make a claim about diversification + risk — should reach consensus
    expect(result.consensusClaims.length).toBeGreaterThanOrEqual(1);
    expect(result.agreementScore).toBeGreaterThan(0);
  });

  it("identifies unique-to-one-model claims", () => {
    const result = distillConsensus([
      { model: "a", text: "The market went up today. An unusual anomaly occurred." },
      { model: "b", text: "The market went up today. Something else happened entirely." },
    ]);
    // "market went up today" should reach consensus (2/2 = 1.0)
    // "anomaly" and "something else" are unique
    expect(result.consensusClaims.length).toBeGreaterThanOrEqual(1);
    expect(result.uniqueToOneModel.length).toBeGreaterThanOrEqual(1);
  });

  it("respects custom threshold", () => {
    const result = distillConsensus(
      [
        { model: "a", text: "Diversification reduces risk effectively in portfolios." },
        { model: "b", text: "A diversified portfolio has lower risk overall." },
      ],
      { consensusThreshold: 0.99 }, // needs ~100% agreement
    );
    // Even if the claim is in both, 2/2 = 1.0 still reaches threshold
    // But let's also test with threshold > 1.0 conceptually (a stricter filter)
    const strict = distillConsensus(
      [
        { model: "a", text: "Diversification is key to managing long-term portfolio risk." },
        { model: "b", text: "Completely unrelated claim about climate change here." },
      ],
      { consensusThreshold: 0.99 },
    );
    expect(strict.consensusClaims.length).toBe(0);
  });
});

describe("buildTrainingExamples", () => {
  it("converts consensus claims to training examples", () => {
    const result = distillConsensus([
      { model: "a", text: "Diversification reduces portfolio risk significantly over long horizons." },
      { model: "b", text: "A diversified portfolio has reduced risk over long time horizons." },
      { model: "c", text: "Diversification is one way to reduce risk for long-term portfolios." },
    ]);
    const examples = buildTrainingExamples("Why diversify?", result);
    expect(examples.length).toBeGreaterThan(0);
    expect(examples[0].prompt).toBe("Why diversify?");
    expect(examples[0].provenance.agreeingModels.length).toBeGreaterThanOrEqual(2);
  });
});

describe("summarizeDistillation", () => {
  it("produces a one-line summary", () => {
    const result = distillConsensus([
      { model: "a", text: "Diversification helps portfolio stability over time." },
      { model: "b", text: "Portfolios benefit from diversification over long horizons." },
    ]);
    const summary = summarizeDistillation(result);
    expect(summary).toContain("2 models");
    expect(summary).toContain("consensus");
  });
});
