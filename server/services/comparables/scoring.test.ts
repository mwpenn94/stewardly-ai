/**
 * Unit tests for the pure comparables scoring helpers. No DB, no fetch.
 */
import { describe, it, expect } from "vitest";
import {
  FEATURE_AXES,
  COMPARABLES,
  CATEGORY_LABELS,
  type ComparableApp,
  type FeatureAxis,
} from "./data";
import {
  clampScore,
  getFeatureScore,
  totalScoreFor,
  stewardlyTotal,
  classifyAxis,
  leadersForAxis,
  buildGapMatrix,
  overallRanking,
  overallSummary,
  priorityRecommendations,
  groupByCategory,
  appSummaries,
} from "./scoring";

// ─── Test fixtures ─────────────────────────────────────────────────────────

const axisA: FeatureAxis = {
  id: "chat_native_ux",
  label: "Axis A",
  description: "",
  stewardlyScore: 3,
  stewardlyEvidence: "",
};
const axisB: FeatureAxis = {
  id: "rebalancing",
  label: "Axis B",
  description: "",
  stewardlyScore: 0,
  stewardlyEvidence: "",
};
const axisC: FeatureAxis = {
  id: "tax_planning",
  label: "Axis C",
  description: "",
  stewardlyScore: 2,
  stewardlyEvidence: "",
};

const FIXTURE_AXES = [axisA, axisB, axisC] as const;

const app1: ComparableApp = {
  id: "alpha",
  name: "Alpha",
  vendor: "Alpha Co",
  category: "financial_planning",
  status: "shipping",
  since: 2020,
  pitch: "test",
  strengths: [],
  gaps: [],
  features: [
    { axis: "chat_native_ux", score: 2 },
    { axis: "rebalancing", score: 3 },
    { axis: "tax_planning", score: 3 },
  ],
  overlapsWith: ["rebalancing"],
  sourceNotes: "",
};
const app2: ComparableApp = {
  id: "bravo",
  name: "Bravo",
  vendor: "Bravo Co",
  category: "portfolio_mgmt",
  status: "shipping",
  since: 2019,
  pitch: "test",
  strengths: [],
  gaps: [],
  features: [
    { axis: "rebalancing", score: 2 },
  ],
  overlapsWith: [],
  sourceNotes: "",
};
const app3: ComparableApp = {
  id: "charlie",
  name: "Charlie",
  vendor: "Charlie Co",
  category: "advisor_copilot",
  status: "beta",
  since: 2024,
  pitch: "test",
  strengths: [],
  gaps: [],
  features: [],
  overlapsWith: [],
  sourceNotes: "",
};

const POOL = [app1, app2, app3];

// ─── clampScore ────────────────────────────────────────────────────────────

describe("comparables/scoring — clampScore", () => {
  it("clamps negatives to 0", () => {
    expect(clampScore(-1)).toBe(0);
  });
  it("clamps above 3 down to 3", () => {
    expect(clampScore(9)).toBe(3);
  });
  it("rounds fractional scores", () => {
    expect(clampScore(1.6)).toBe(2);
  });
  it("returns 0 for NaN", () => {
    expect(clampScore(Number.NaN)).toBe(0);
  });
  it("handles 0 and 3 at the bounds", () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(3)).toBe(3);
  });
});

// ─── getFeatureScore ───────────────────────────────────────────────────────

describe("comparables/scoring — getFeatureScore", () => {
  it("returns the declared score for a present axis", () => {
    expect(getFeatureScore(app1, "rebalancing")).toBe(3);
  });
  it("returns 0 for an axis the app does not declare", () => {
    expect(getFeatureScore(app2, "chat_native_ux")).toBe(0);
  });
  it("returns 0 for an app with no features at all", () => {
    expect(getFeatureScore(app3, "tax_planning")).toBe(0);
  });
});

// ─── totalScoreFor ─────────────────────────────────────────────────────────

describe("comparables/scoring — totalScoreFor", () => {
  it("sums every declared feature", () => {
    expect(totalScoreFor(app1)).toBe(8); // 2 + 3 + 3
  });
  it("returns 0 when no features are declared", () => {
    expect(totalScoreFor(app3)).toBe(0);
  });
});

// ─── stewardlyTotal ────────────────────────────────────────────────────────

describe("comparables/scoring — stewardlyTotal", () => {
  it("sums every stewardly score over the provided axes", () => {
    expect(stewardlyTotal(FIXTURE_AXES)).toBe(5); // 3 + 0 + 2
  });
  it("defaults to the real FEATURE_AXES when called with no args", () => {
    const real = stewardlyTotal();
    const manual = FEATURE_AXES.reduce(
      (sum, axis) => sum + clampScore(axis.stewardlyScore),
      0,
    );
    expect(real).toBe(manual);
  });
});

// ─── classifyAxis ──────────────────────────────────────────────────────────

describe("comparables/scoring — classifyAxis", () => {
  it("marks 'leading' when stewardly > bestExternal", () => {
    expect(classifyAxis(axisA, 1)).toBe("leading");
  });
  it("marks 'parity' on an exact tie", () => {
    expect(classifyAxis(axisA, 3)).toBe("parity");
  });
  it("marks 'trailing' when stewardly < bestExternal but stewardly > 0", () => {
    expect(classifyAxis(axisC, 3)).toBe("trailing");
  });
  it("marks 'missing' when stewardly = 0 and someone has it at 2+", () => {
    expect(classifyAxis(axisB, 2)).toBe("missing");
  });
  it("marks 'parity' when both stewardly = 0 and nobody has it", () => {
    expect(classifyAxis(axisB, 0)).toBe("parity");
  });
});

// ─── leadersForAxis ────────────────────────────────────────────────────────

describe("comparables/scoring — leadersForAxis", () => {
  it("sorts descending by score", () => {
    const leaders = leadersForAxis("rebalancing", 5, POOL);
    expect(leaders.map((l) => l.app.name)).toEqual(["Alpha", "Bravo"]);
    expect(leaders.map((l) => l.score)).toEqual([3, 2]);
  });
  it("breaks ties alphabetically by name", () => {
    const tie = [
      { ...app1, features: [{ axis: "tax_planning" as const, score: 3 }] },
      { ...app2, features: [{ axis: "tax_planning" as const, score: 3 }] },
    ];
    const leaders = leadersForAxis("tax_planning", 5, tie);
    expect(leaders.map((l) => l.app.name)).toEqual(["Alpha", "Bravo"]);
  });
  it("filters out zero-score apps", () => {
    const leaders = leadersForAxis("rebalancing", 5, POOL);
    expect(leaders.every((l) => l.score > 0)).toBe(true);
    // app3 has no features — should not appear
    expect(leaders.some((l) => l.app.name === "Charlie")).toBe(false);
  });
  it("respects the limit", () => {
    const leaders = leadersForAxis("rebalancing", 1, POOL);
    expect(leaders).toHaveLength(1);
  });
  it("returns [] when nobody has the feature", () => {
    const pool = [app3];
    expect(leadersForAxis("rebalancing", 3, pool)).toEqual([]);
  });
});

// ─── buildGapMatrix ────────────────────────────────────────────────────────

describe("comparables/scoring — buildGapMatrix", () => {
  it("computes gap = bestExternal - stewardly for every axis", () => {
    const matrix = buildGapMatrix(FIXTURE_AXES, POOL);
    const axisBRow = matrix.find((r) => r.axis.id === "rebalancing");
    expect(axisBRow?.stewardly).toBe(0);
    expect(axisBRow?.bestExternal).toBe(3);
    expect(axisBRow?.gap).toBe(3);
  });
  it("returns negative gap when stewardly leads (but keeps value)", () => {
    const matrix = buildGapMatrix(FIXTURE_AXES, POOL);
    const axisARow = matrix.find((r) => r.axis.id === "chat_native_ux");
    expect(axisARow?.stewardly).toBe(3);
    expect(axisARow?.bestExternal).toBe(2);
    expect(axisARow?.gap).toBe(-1);
  });
  it("attaches top-3 leaders per axis", () => {
    const matrix = buildGapMatrix(FIXTURE_AXES, POOL);
    const axisBRow = matrix.find((r) => r.axis.id === "rebalancing");
    expect(axisBRow?.leaders).toHaveLength(2); // Alpha + Bravo
  });
});

// ─── overallRanking ────────────────────────────────────────────────────────

describe("comparables/scoring — overallRanking", () => {
  it("includes Stewardly as a named row", () => {
    const ranks = overallRanking(FIXTURE_AXES, POOL);
    expect(ranks.some((r) => r.isStewardly)).toBe(true);
    expect(ranks.some((r) => r.name === "Stewardly")).toBe(true);
  });
  it("sorts descending by total", () => {
    const ranks = overallRanking(FIXTURE_AXES, POOL);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].total).toBeLessThanOrEqual(ranks[i - 1].total);
    }
  });
  it("breaks ties alphabetically", () => {
    const tiedA: ComparableApp = { ...app1, name: "Zeta", features: [{ axis: "tax_planning", score: 3 }] };
    const tiedB: ComparableApp = { ...app2, name: "Alpha", features: [{ axis: "tax_planning", score: 3 }] };
    const pool = [tiedA, tiedB];
    const ranks = overallRanking([axisC], pool);
    // Both have total=3, alphabetical: Alpha before Zeta
    const nonStewardly = ranks.filter((r) => !r.isStewardly);
    expect(nonStewardly[0].name).toBe("Alpha");
  });
});

// ─── overallSummary ────────────────────────────────────────────────────────

describe("comparables/scoring — overallSummary", () => {
  it("reports Stewardly's total, max, and percentage", () => {
    const s = overallSummary(FIXTURE_AXES, POOL);
    expect(s.stewardlyTotal).toBe(5);
    expect(s.maxTotal).toBe(9); // 3 axes × 3
    expect(s.overallPct).toBe(56); // 5/9 = 55.55 → 56
  });
  it("counts axes into the 4 bands", () => {
    const s = overallSummary(FIXTURE_AXES, POOL);
    // axisA: stewardly=3, best=2 → leading
    // axisB: stewardly=0, best=3 → missing
    // axisC: stewardly=2, best=3 → trailing
    expect(s.bands.leading).toBe(1);
    expect(s.bands.missing).toBe(1);
    expect(s.bands.trailing).toBe(1);
    expect(s.bands.parity).toBe(0);
  });
  it("gives Stewardly a numeric rank ≥ 1", () => {
    const s = overallSummary(FIXTURE_AXES, POOL);
    expect(s.stewardlyRank).toBeGreaterThanOrEqual(1);
  });
  it("handles an empty axes array without dividing by zero", () => {
    const s = overallSummary([], []);
    expect(s.overallPct).toBe(0);
    expect(s.maxTotal).toBe(0);
  });
});

// ─── priorityRecommendations ───────────────────────────────────────────────

describe("comparables/scoring — priorityRecommendations", () => {
  it("sorts by gap descending and filters non-gap rows", () => {
    const recs = priorityRecommendations(10, FIXTURE_AXES, POOL);
    expect(recs.length).toBe(2); // axisB + axisC (axisA leads)
    expect(recs[0].axis.id).toBe("rebalancing"); // gap=3
    expect(recs[1].axis.id).toBe("tax_planning"); // gap=1
  });
  it("attaches exemplars from the top of the leader board", () => {
    const recs = priorityRecommendations(10, FIXTURE_AXES, POOL);
    const rebalancingRec = recs.find((r) => r.axis.id === "rebalancing");
    expect(rebalancingRec?.exemplars.map((e) => e.name)).toContain("Alpha");
  });
  it("respects the limit", () => {
    const recs = priorityRecommendations(1, FIXTURE_AXES, POOL);
    expect(recs).toHaveLength(1);
  });
  it("writes a 'not implemented' reason when stewardly = 0", () => {
    const recs = priorityRecommendations(10, FIXTURE_AXES, POOL);
    const missing = recs.find((r) => r.axis.id === "rebalancing");
    expect(missing?.reason).toMatch(/not implemented/i);
  });
});

// ─── groupByCategory ───────────────────────────────────────────────────────

describe("comparables/scoring — groupByCategory", () => {
  it("buckets apps by category", () => {
    const groups = groupByCategory(POOL);
    expect(groups.length).toBe(3);
    const ids = groups.map((g) => g.category);
    expect(ids).toContain("financial_planning");
    expect(ids).toContain("portfolio_mgmt");
    expect(ids).toContain("advisor_copilot");
  });
  it("uses the canonical label", () => {
    const groups = groupByCategory(POOL);
    const fp = groups.find((g) => g.category === "financial_planning");
    expect(fp?.label).toBe(CATEGORY_LABELS.financial_planning);
  });
  it("sorts apps alphabetically within each category", () => {
    const extra: ComparableApp = {
      ...app1,
      id: "zebra",
      name: "Zebra",
    };
    const groups = groupByCategory([extra, app1]);
    const fp = groups.find((g) => g.category === "financial_planning");
    expect(fp?.apps.map((a) => a.name)).toEqual(["Alpha", "Zebra"]);
  });
});

// ─── appSummaries ──────────────────────────────────────────────────────────

describe("comparables/scoring — appSummaries", () => {
  it("computes totalScore and beatsStewardlyOn for each app", () => {
    const s = appSummaries(POOL, FIXTURE_AXES);
    const alpha = s.find((row) => row.app.name === "Alpha");
    expect(alpha?.totalScore).toBe(8);
    // axisA=2 vs stewardly=3 (no), axisB=3 vs stewardly=0 (yes), axisC=3 vs stewardly=2 (yes)
    expect(alpha?.beatsStewardlyOn).toBe(2);
  });
  it("returns zero for an app with no features", () => {
    const s = appSummaries([app3], FIXTURE_AXES);
    expect(s[0].totalScore).toBe(0);
    expect(s[0].beatsStewardlyOn).toBe(0);
  });
});

// ─── Real catalog invariants ───────────────────────────────────────────────

describe("comparables/scoring — real catalog invariants", () => {
  it("every FEATURE_AXES stewardly score is in [0..3]", () => {
    for (const axis of FEATURE_AXES) {
      expect(axis.stewardlyScore).toBeGreaterThanOrEqual(0);
      expect(axis.stewardlyScore).toBeLessThanOrEqual(3);
    }
  });
  it("every comparable feature score is in [0..3]", () => {
    for (const app of COMPARABLES) {
      for (const f of app.features) {
        expect(f.score).toBeGreaterThanOrEqual(0);
        expect(f.score).toBeLessThanOrEqual(3);
      }
    }
  });
  it("every comparable id is unique", () => {
    const ids = COMPARABLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every comparable feature axis references a known FEATURE_AXES entry", () => {
    const known = new Set(FEATURE_AXES.map((a) => a.id));
    for (const app of COMPARABLES) {
      for (const f of app.features) {
        expect(known.has(f.axis)).toBe(true);
      }
    }
  });
  it("real catalog produces a gap matrix with one row per axis", () => {
    const matrix = buildGapMatrix();
    expect(matrix.length).toBe(FEATURE_AXES.length);
  });
});
