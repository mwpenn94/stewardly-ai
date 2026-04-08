/**
 * Round C2 + C4 — pure helper tests for the consensus stream service
 * and weight presets module.
 *
 * The streaming part itself isn't exercised end-to-end here because
 * it requires a live LLM. We test the deterministic pieces:
 *  - encodeSseEvent wire format
 *  - buildSynthesisPrompt template + weight injection
 *  - pickConsensusModels fallback + budget filter
 *  - calculateAgreement Jaccard
 *  - parseSynthesisOutput section extraction + confidence parsing
 *  - normalizeWeights / validatePresetShape / mergePresetWithSelection
 *  - findBuiltInByName
 *  - selectModelsWithinTimeBudget on the model registry
 */

import { describe, it, expect } from "vitest";
import {
  encodeSseEvent,
  buildSynthesisPrompt,
  pickConsensusModels,
  calculateAgreement,
  parseSynthesisOutput,
  DEFAULT_CONSENSUS_MODELS,
  type ConsensusEvent,
} from "./consensusStream";
import {
  normalizeWeights,
  validatePresetShape,
  mergePresetWithSelection,
  findBuiltInByName,
  BUILT_IN_PRESETS,
  DEFAULT_WEIGHT,
  MIN_WEIGHT,
  MAX_WEIGHT,
} from "./weightPresets";
import {
  selectModelsWithinTimeBudget,
  getModelEstimatedResponseMs,
  getModelSpeedRating,
  defaultSpeedRating,
  defaultEstimatedResponseMs,
  SYNTHESIS_OVERHEAD_MS,
} from "../shared/config/modelRegistry";

// ═══════════════════════════════════════════════════════════════════════════
// consensusStream pure helpers
// ═══════════════════════════════════════════════════════════════════════════

describe("Round C2 — consensusStream pure helpers", () => {
  describe("encodeSseEvent", () => {
    it("formats as SSE data line with double newline", () => {
      const event: ConsensusEvent = { type: "model_start", modelId: "x", ts: 1 };
      const line = encodeSseEvent(event);
      expect(line.startsWith("data: ")).toBe(true);
      expect(line.endsWith("\n\n")).toBe(true);
    });

    it("round-trips through JSON.parse", () => {
      const event: ConsensusEvent = {
        type: "model_complete",
        modelId: "gpt-4o",
        ts: 12345,
        durationMs: 800,
        content: "hello",
        tokenCount: 2,
      };
      const line = encodeSseEvent(event);
      const stripped = line.slice("data: ".length, -2); // remove "data: " and "\n\n"
      const parsed = JSON.parse(stripped) as ConsensusEvent;
      expect(parsed).toEqual(event);
    });
  });

  describe("buildSynthesisPrompt", () => {
    it("includes the question, every response, and the three required sections", () => {
      const text = buildSynthesisPrompt({
        question: "Should I do a Roth conversion?",
        responses: [
          { modelId: "claude-sonnet-4-20250514", content: "Yes — bracket headroom is high." },
          { modelId: "gpt-4o", content: "Possibly — depends on state tax." },
        ],
      });
      expect(text).toContain("Roth conversion");
      expect(text).toContain("claude-sonnet-4-20250514");
      expect(text).toContain("gpt-4o");
      expect(text).toContain("## Unified Answer");
      expect(text).toContain("## Key Agreements");
      expect(text).toContain("## Notable Differences");
      expect(text).toContain("_summary:");
    });

    it("injects per-model weights when provided", () => {
      const text = buildSynthesisPrompt({
        question: "Test",
        responses: [
          { modelId: "claude", content: "A", weight: 90 },
          { modelId: "gpt", content: "B", weight: 30 },
        ],
      });
      expect(text).toContain("claude (weight 90)");
      expect(text).toContain("gpt (weight 30)");
    });

    it("omits weights when not provided", () => {
      const text = buildSynthesisPrompt({
        question: "Test",
        responses: [{ modelId: "claude", content: "A" }],
      });
      expect(text).not.toContain("(weight");
    });

    it("includes domain context when provided", () => {
      const text = buildSynthesisPrompt({
        question: "Q",
        responses: [{ modelId: "x", content: "A" }],
        domain: "tax planning",
      });
      expect(text).toContain("tax planning");
    });
  });

  describe("pickConsensusModels", () => {
    it("returns DEFAULT_CONSENSUS_MODELS when no input given", () => {
      const r = pickConsensusModels({});
      expect(r.selected).toEqual(DEFAULT_CONSENSUS_MODELS);
      expect(r.fits).toBe(true);
    });

    it("honors user-supplied selection", () => {
      const r = pickConsensusModels({ selectedModels: ["gpt-4o"] });
      expect(r.selected).toEqual(["gpt-4o"]);
    });

    it("respects maxModels cap when no time budget", () => {
      const r = pickConsensusModels({ maxModels: 1 });
      expect(r.selected.length).toBe(1);
    });

    it("filters via time budget when supplied", () => {
      const r = pickConsensusModels({ timeBudgetMs: 8000 });
      // With 4000ms overhead and tiered fallbacks, we expect at most 1-2 default models
      expect(r.selected.length).toBeGreaterThan(0);
      expect(r.selected.length).toBeLessThanOrEqual(DEFAULT_CONSENSUS_MODELS.length);
      expect(r.rationale).toContain("ms budget");
    });
  });

  describe("calculateAgreement", () => {
    it("returns 1 for identical text", () => {
      const score = calculateAgreement(
        "alpha beta gamma delta epsilon",
        "alpha beta gamma delta epsilon",
      );
      expect(score).toBe(1);
    });

    it("returns 0 for fully disjoint text", () => {
      const score = calculateAgreement("alpha beta", "zulu omicron");
      expect(score).toBe(0);
    });

    it("returns 0 when either input is empty", () => {
      expect(calculateAgreement("", "alpha")).toBe(0);
      expect(calculateAgreement("alpha", "")).toBe(0);
    });

    it("ignores words ≤3 chars", () => {
      const score = calculateAgreement("the and but", "the and but");
      // All filtered out → empty union → 0
      expect(score).toBe(0);
    });

    it("partial overlap is between 0 and 1", () => {
      const score = calculateAgreement(
        "alpha beta gamma",
        "alpha delta gamma",
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe("parseSynthesisOutput", () => {
    it("extracts the three sections", () => {
      const r = parseSynthesisOutput(`
## Unified Answer
The Roth conversion is appropriate.

## Key Agreements
- Both models agree the bracket has headroom
- Both flag the 5-year clock

## Notable Differences
- Claude focuses on tax-rate forecasting
- GPT focuses on Medicare IRMAA cliff

_summary: 78
`);
      expect(r.unifiedAnswer).toContain("Roth conversion is appropriate");
      expect(r.keyAgreements).toHaveLength(2);
      expect(r.notableDifferences).toHaveLength(2);
      expect(r.confidenceScore).toBeCloseTo(0.78);
    });

    it("degrades gracefully when sections missing", () => {
      const r = parseSynthesisOutput("just plain text");
      expect(r.unifiedAnswer).toBe("just plain text");
      expect(r.keyAgreements).toEqual([]);
      expect(r.notableDifferences).toEqual([]);
      expect(r.confidenceScore).toBe(0);
    });

    it("clamps confidence to 0-1", () => {
      const r = parseSynthesisOutput("## Unified Answer\nx\n_summary: 200");
      expect(r.confidenceScore).toBeLessThanOrEqual(1);
    });

    it("handles bullet markers - and *", () => {
      const r = parseSynthesisOutput(`
## Key Agreements
- one
* two
- three
`);
      expect(r.keyAgreements).toEqual(["one", "two", "three"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// weightPresets pure helpers
// ═══════════════════════════════════════════════════════════════════════════

describe("Round C4 — weightPresets pure helpers", () => {
  describe("normalizeWeights", () => {
    it("rounds to integers and clamps to [1, 100]", () => {
      const r = normalizeWeights({
        a: 50.7,
        b: -5,
        c: 200,
        d: 13,
      });
      expect(r).toEqual({ a: 51, b: 1, c: 100, d: 13 });
    });

    it("drops non-numeric entries", () => {
      const r = normalizeWeights({
        a: 50,
        b: NaN,
        c: Infinity,
      } as Record<string, number>);
      expect(r).toEqual({ a: 50 });
    });

    it("returns empty object for empty input", () => {
      expect(normalizeWeights({})).toEqual({});
    });

    it("DEFAULT_WEIGHT is in the valid range", () => {
      expect(DEFAULT_WEIGHT).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(DEFAULT_WEIGHT).toBeLessThanOrEqual(MAX_WEIGHT);
    });
  });

  describe("validatePresetShape", () => {
    it("requires a name", () => {
      const errs = validatePresetShape({ name: "", weights: { a: 50 } });
      expect(errs).toContain("name required");
    });

    it("rejects empty weights map", () => {
      const errs = validatePresetShape({ name: "x", weights: {} });
      expect(errs).toContain("at least one model weight required");
    });

    it("rejects weight outside range", () => {
      const errs = validatePresetShape({
        name: "x",
        weights: { a: 200 },
      });
      expect(errs.some((e) => e.includes("outside"))).toBe(true);
    });

    it("rejects names over 100 chars", () => {
      const errs = validatePresetShape({
        name: "x".repeat(101),
        weights: { a: 50 },
      });
      expect(errs).toContain("name max 100 chars");
    });

    it("returns empty array for valid input", () => {
      const errs = validatePresetShape({
        name: "Conservative Suitability",
        weights: { "claude-sonnet-4-20250514": 90, "gpt-4o": 60 },
      });
      expect(errs).toEqual([]);
    });
  });

  describe("mergePresetWithSelection", () => {
    it("uses preset weights when present and DEFAULT_WEIGHT otherwise", () => {
      const merged = mergePresetWithSelection(
        {
          name: "test",
          weights: { "claude-sonnet-4-20250514": 90, "gpt-4o": 60 },
        },
        ["claude-sonnet-4-20250514", "gpt-4o", "gemini-2.5-pro"],
      );
      expect(merged["claude-sonnet-4-20250514"]).toBe(90);
      expect(merged["gpt-4o"]).toBe(60);
      expect(merged["gemini-2.5-pro"]).toBe(DEFAULT_WEIGHT);
    });

    it("returns DEFAULT_WEIGHT for every model when preset is null", () => {
      const merged = mergePresetWithSelection(null, ["a", "b"]);
      expect(merged.a).toBe(DEFAULT_WEIGHT);
      expect(merged.b).toBe(DEFAULT_WEIGHT);
    });

    it("only includes selected models in the output", () => {
      const merged = mergePresetWithSelection(
        { name: "x", weights: { a: 50, b: 60, c: 70 } },
        ["a"],
      );
      expect(Object.keys(merged)).toEqual(["a"]);
    });
  });

  describe("BUILT_IN_PRESETS", () => {
    it("contains at least 5 presets", () => {
      expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it("every built-in is valid per validatePresetShape", () => {
      for (const p of BUILT_IN_PRESETS) {
        const errs = validatePresetShape(p);
        expect(errs).toEqual([]);
      }
    });

    it("findBuiltInByName retrieves existing presets", () => {
      const balanced = findBuiltInByName("Balanced");
      expect(balanced).not.toBeNull();
      expect(balanced?.weights["claude-sonnet-4-20250514"]).toBeDefined();
    });

    it("findBuiltInByName returns null for unknown name", () => {
      expect(findBuiltInByName("Bogus Preset")).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// modelRegistry C1 additions
// ═══════════════════════════════════════════════════════════════════════════

describe("Round C1 — modelRegistry latency helpers", () => {
  describe("defaultSpeedRating + defaultEstimatedResponseMs", () => {
    it("economy maps to fast / 1.5s", () => {
      expect(defaultSpeedRating("economy")).toBe("fast");
      expect(defaultEstimatedResponseMs("economy")).toBe(1500);
    });

    it("standard maps to moderate / 3.5s", () => {
      expect(defaultSpeedRating("standard")).toBe("moderate");
      expect(defaultEstimatedResponseMs("standard")).toBe(3500);
    });

    it("premium maps to slow / 6s", () => {
      expect(defaultSpeedRating("premium")).toBe("slow");
      expect(defaultEstimatedResponseMs("premium")).toBe(6000);
    });

    it("reasoning maps to slow / 12s", () => {
      expect(defaultSpeedRating("reasoning")).toBe("slow");
      expect(defaultEstimatedResponseMs("reasoning")).toBe(12_000);
    });
  });

  describe("getModelEstimatedResponseMs", () => {
    it("returns a number for known models", () => {
      const ms = getModelEstimatedResponseMs("gemini-2.5-pro");
      expect(typeof ms).toBe("number");
      expect(ms).toBeGreaterThan(0);
    });

    it("returns 4000 for unknown models", () => {
      expect(getModelEstimatedResponseMs("totally-fake-model-xyz")).toBe(4000);
    });
  });

  describe("getModelSpeedRating", () => {
    it("returns one of the three speed ratings for known models", () => {
      const rating = getModelSpeedRating("gemini-2.5-pro");
      expect(["fast", "moderate", "slow"]).toContain(rating);
    });

    it("returns moderate for unknown models", () => {
      expect(getModelSpeedRating("nope")).toBe("moderate");
    });
  });

  describe("selectModelsWithinTimeBudget (registry version)", () => {
    it("returns the requested models when budget is huge", () => {
      const r = selectModelsWithinTimeBudget(
        ["gemini-2.5-pro", "gpt-4o", "gemini-2.5-flash"],
        100_000,
      );
      expect(r.selected.length).toBe(3);
      expect(r.fits).toBe(true);
    });

    it("excludes models when budget is too tight", () => {
      const r = selectModelsWithinTimeBudget(
        ["gemini-2.5-pro", "gpt-4o", "gemini-2.5-flash"],
        5500, // 4000 overhead + 1500 fast = 5500, just fits one fast
      );
      expect(r.selected.length).toBeLessThanOrEqual(2);
      expect(Object.keys(r.excluded).length).toBeGreaterThan(0);
    });

    it("respects maxModels cap", () => {
      const r = selectModelsWithinTimeBudget(
        ["gemini-2.5-pro", "gpt-4o"],
        100_000,
        { maxModels: 1 },
      );
      expect(r.selected.length).toBe(1);
    });

    it("totalEstimatedMs includes synthesis overhead", () => {
      const r = selectModelsWithinTimeBudget(["gemini-2.5-flash"], 100_000);
      expect(r.totalEstimatedMs).toBeGreaterThanOrEqual(SYNTHESIS_OVERHEAD_MS);
    });

    it("returns fits=false when even minModels can't fit", () => {
      const r = selectModelsWithinTimeBudget(
        ["gemini-2.5-pro"],
        500, // way too tight
        { minModels: 1 },
      );
      expect(r.fits).toBe(false);
    });
  });
});
