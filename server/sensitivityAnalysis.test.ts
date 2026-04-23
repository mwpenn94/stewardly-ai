import { describe, it, expect } from "vitest";
import { mulberry32, boxMullerSeeded, defaultSeed } from "./shared/calculators/seededRng";
import { runSensitivityAnalysis, tornadoChart } from "./shared/calculators/sensitivityAnalysis";

describe("seededRng", () => {
  it("mulberry32 produces deterministic output for same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const vals1 = Array.from({ length: 10 }, () => rng1());
    const vals2 = Array.from({ length: 10 }, () => rng2());
    expect(vals1).toEqual(vals2);
  });

  it("mulberry32 produces different output for different seeds", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });

  it("mulberry32 values are in [0, 1)", () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("boxMullerSeeded produces normal-ish distribution", () => {
    const rng = mulberry32(7);
    const vals = Array.from({ length: 1000 }, () => boxMullerSeeded(rng));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    // Mean should be near 0, variance near 1
    expect(Math.abs(mean)).toBeLessThan(0.15);
    expect(Math.abs(variance - 1)).toBeLessThan(0.3);
  });

  it("defaultSeed returns unique values", () => {
    const seeds = new Set(Array.from({ length: 100 }, () => defaultSeed()));
    expect(seeds.size).toBeGreaterThan(90);
  });
});

describe("sensitivityAnalysis", () => {
  it("returns 4 parameter results", () => {
    const results = runSensitivityAnalysis({
      baseReturn: 0.07,
      baseVolatility: 0.15,
      startBalance: 100000,
      annualContribution: 12000,
      years: 20,
      trials: 200,
      seed: 42,
    });
    expect(results).toHaveLength(4);
    expect(results.map(r => r.parameter)).toEqual([
      "expectedReturn", "volatility", "annualContribution", "timeHorizon",
    ]);
  });

  it("each result has points with required fields", () => {
    const results = runSensitivityAnalysis({
      baseReturn: 0.07,
      baseVolatility: 0.15,
      startBalance: 50000,
      annualContribution: 6000,
      years: 25,
      trials: 100,
      seed: 42,
    });
    for (const r of results) {
      expect(r.points.length).toBeGreaterThan(0);
      for (const pt of r.points) {
        expect(pt).toHaveProperty("value");
        expect(pt).toHaveProperty("label");
        expect(pt).toHaveProperty("medianOutcome");
        expect(pt).toHaveProperty("p10");
        expect(pt).toHaveProperty("p90");
        expect(pt).toHaveProperty("successRate");
        expect(pt.medianOutcome).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("higher return produces higher median outcome", () => {
    const results = runSensitivityAnalysis({
      baseReturn: 0.07,
      baseVolatility: 0.15,
      startBalance: 100000,
      annualContribution: 12000,
      years: 20,
      trials: 300,
      seed: 42,
    });
    const returnResult = results.find(r => r.parameter === "expectedReturn")!;
    const sorted = [...returnResult.points].sort((a, b) => a.value - b.value);
    // Generally, higher return should produce higher median
    expect(sorted[sorted.length - 1].medianOutcome).toBeGreaterThan(sorted[0].medianOutcome);
  });

  it("tornadoChart sorts by absolute elasticity", () => {
    const results = runSensitivityAnalysis({
      baseReturn: 0.07,
      baseVolatility: 0.15,
      startBalance: 100000,
      annualContribution: 12000,
      years: 20,
      trials: 200,
      seed: 42,
    });
    const tornado = tornadoChart(results);
    expect(tornado).toHaveLength(4);
    for (let i = 1; i < tornado.length; i++) {
      expect(Math.abs(tornado[i - 1].elasticity)).toBeGreaterThanOrEqual(Math.abs(tornado[i].elasticity));
    }
  });

  it("is reproducible with same seed", () => {
    const input = {
      baseReturn: 0.07,
      baseVolatility: 0.15,
      startBalance: 100000,
      annualContribution: 12000,
      years: 20,
      trials: 200,
      seed: 42,
    };
    const r1 = runSensitivityAnalysis(input);
    const r2 = runSensitivityAnalysis(input);
    expect(r1[0].points[0].medianOutcome).toBe(r2[0].points[0].medianOutcome);
    expect(r1[1].points[1].p90).toBe(r2[1].points[1].p90);
  });
});
