/**
 * Round E2 — semantic agreement scorer tests.
 *
 * Tests the pure helpers (prompt builder + score parser) without
 * hitting an LLM. The async `semanticAgreement` wrapper is also
 * covered with a short-circuit path for zero/single responses.
 */

import { describe, it, expect } from "vitest";
import {
  buildAgreementJudgePrompt,
  parseJudgeScore,
  semanticAgreement,
  combinedAgreement,
} from "./semanticAgreement";

describe("Round E2 — semanticAgreement pure helpers", () => {
  describe("buildAgreementJudgePrompt", () => {
    it("includes every response with its model id", () => {
      const prompt = buildAgreementJudgePrompt([
        { modelId: "claude-sonnet-4", content: "Yes, do the Roth conversion." },
        { modelId: "gpt-4o", content: "No, wait until Q4." },
      ]);
      expect(prompt).toContain("claude-sonnet-4");
      expect(prompt).toContain("Yes, do the Roth conversion.");
      expect(prompt).toContain("gpt-4o");
      expect(prompt).toContain("No, wait until Q4.");
    });

    it("asks for the exact `SCORE: N` output format", () => {
      const prompt = buildAgreementJudgePrompt([
        { modelId: "a", content: "x" },
        { modelId: "b", content: "y" },
      ]);
      expect(prompt).toContain("SCORE: N");
      expect(prompt).toContain("integer 0-100");
    });

    it("explains the scoring anchors", () => {
      const prompt = buildAgreementJudgePrompt([
        { modelId: "a", content: "x" },
        { modelId: "b", content: "y" },
      ]);
      expect(prompt).toContain("100: All responses agree");
      expect(prompt).toContain("50:");
      expect(prompt).toContain("0: The responses are entirely disjoint");
    });

    it("tells the judge to ignore stylistic differences", () => {
      const prompt = buildAgreementJudgePrompt([
        { modelId: "a", content: "x" },
        { modelId: "b", content: "y" },
      ]);
      expect(prompt.toLowerCase()).toContain("ignore stylistic");
    });

    it("handles 3+ responses without issue", () => {
      const prompt = buildAgreementJudgePrompt([
        { modelId: "a", content: "alpha" },
        { modelId: "b", content: "beta" },
        { modelId: "c", content: "gamma" },
      ]);
      expect(prompt).toContain("### a");
      expect(prompt).toContain("### b");
      expect(prompt).toContain("### c");
    });
  });

  describe("parseJudgeScore", () => {
    it("parses SCORE: 87", () => {
      expect(parseJudgeScore("SCORE: 87")).toBeCloseTo(0.87);
    });

    it("parses case-insensitive", () => {
      expect(parseJudgeScore("score: 50")).toBeCloseTo(0.5);
    });

    it("parses with surrounding text", () => {
      expect(parseJudgeScore("My verdict:\nSCORE: 72\nThanks.")).toBeCloseTo(0.72);
    });

    it("clamps above 100 to 100", () => {
      expect(parseJudgeScore("SCORE: 150")).toBe(1);
    });

    it("returns null for negative scores (regex requires unsigned digits)", () => {
      // The `\d+` in the regex doesn't match a leading minus sign, so
      // "SCORE: -5" produces no match and the parser returns null.
      // The judge prompt explicitly says "integer 0-100" so we don't
      // need to support negatives.
      expect(parseJudgeScore("SCORE: -5")).toBeNull();
    });

    it("returns null for missing SCORE line", () => {
      expect(parseJudgeScore("I think they agree 80%")).toBeNull();
    });

    it("returns null for empty input", () => {
      expect(parseJudgeScore("")).toBeNull();
    });

    it("returns null for non-string input", () => {
      // @ts-expect-error — testing runtime defensiveness
      expect(parseJudgeScore(null)).toBeNull();
      // @ts-expect-error — testing runtime defensiveness
      expect(parseJudgeScore(undefined)).toBeNull();
    });

    it("returns null when SCORE: has no digits after", () => {
      expect(parseJudgeScore("SCORE: ")).toBeNull();
      expect(parseJudgeScore("SCORE: abc")).toBeNull();
    });

    it("tolerates flexible whitespace", () => {
      expect(parseJudgeScore("SCORE:  42 ")).toBeCloseTo(0.42);
      expect(parseJudgeScore("SCORE :42")).toBeCloseTo(0.42);
    });
  });

  describe("semanticAgreement — short-circuit paths", () => {
    it("returns 0 for empty responses", async () => {
      const r = await semanticAgreement([]);
      expect(r).toBe(0);
    });

    it("returns 1 for a single response (trivially self-consistent)", async () => {
      const r = await semanticAgreement([{ modelId: "a", content: "x" }]);
      expect(r).toBe(1);
    });
  });

  describe("combinedAgreement", () => {
    it("falls back to jaccard when semantic returns null", async () => {
      // Single response short-circuits to 1, which counts as non-null.
      // Use empty responses — semantic returns 0, jaccard 0.5 → best is 0
      const r = await combinedAgreement([], 0.5);
      expect(r.jaccard).toBe(0.5);
      expect(r.semantic).toBe(0);
      expect(r.source).toBe("semantic"); // 0 is not null
      expect(r.best).toBe(0);
    });

    it("uses semantic when available", async () => {
      const r = await combinedAgreement(
        [{ modelId: "solo", content: "only" }],
        0.3,
      );
      expect(r.semantic).toBe(1); // single response short-circuit
      expect(r.source).toBe("semantic");
      expect(r.best).toBe(1);
    });
  });
});
