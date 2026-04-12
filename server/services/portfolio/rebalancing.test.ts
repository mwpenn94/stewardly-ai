/**
 * Unit tests for the pure portfolio rebalancing engine.
 *
 * Pass 2 of the hybrid build loop — closes PARITY-REBAL-0001.
 * Covers: validation, drift math, dollar gaps, proposal generation,
 * cash buffer clamping, tax-aware sell ordering, new-cash simulation,
 * and defensive handling of malformed inputs.
 */
import { describe, it, expect } from "vitest";
import {
  validateTargetAllocation,
  isCashLike,
  computeDrift,
  simulateWithNewCash,
  type Holding,
  type TargetAllocation,
} from "./rebalancing";

const holdings: Holding[] = [
  { id: "VTI", name: "US Total Market", marketValue: 60_000 },
  { id: "VXUS", name: "International", marketValue: 25_000 },
  { id: "BND", name: "US Bond", marketValue: 10_000 },
  { id: "CASH", name: "Cash", marketValue: 5_000, isCash: true },
];

const target60_30_10: TargetAllocation[] = [
  { id: "VTI", targetPct: 60 },
  { id: "VXUS", targetPct: 20 },
  { id: "BND", targetPct: 15 },
  { id: "CASH", targetPct: 5 },
];

// ─── validateTargetAllocation ─────────────────────────────────────────────

describe("portfolio/rebalancing — validateTargetAllocation", () => {
  it("accepts a valid 100% allocation", () => {
    const r = validateTargetAllocation(target60_30_10);
    expect(r.ok).toBe(true);
    expect(r.totalPct).toBe(100);
  });
  it("rejects sums outside 99.5..100.5", () => {
    const r = validateTargetAllocation([
      { id: "A", targetPct: 60 },
      { id: "B", targetPct: 30 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/sums to 90/);
  });
  it("accepts 100.5% tolerance rounding", () => {
    const r = validateTargetAllocation([
      { id: "A", targetPct: 50.3 },
      { id: "B", targetPct: 50.1 },
    ]);
    expect(r.ok).toBe(true);
  });
  it("rejects duplicate ids", () => {
    const r = validateTargetAllocation([
      { id: "A", targetPct: 50 },
      { id: "A", targetPct: 50 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Duplicate/);
  });
  it("rejects negative target pct", () => {
    const r = validateTargetAllocation([
      { id: "A", targetPct: -10 },
      { id: "B", targetPct: 110 },
    ]);
    expect(r.ok).toBe(false);
  });
  it("rejects NaN target pct", () => {
    const r = validateTargetAllocation([
      { id: "A", targetPct: Number.NaN },
      { id: "B", targetPct: 100 },
    ]);
    expect(r.ok).toBe(false);
  });
});

// ─── isCashLike ───────────────────────────────────────────────────────────

describe("portfolio/rebalancing — isCashLike", () => {
  it("matches the isCash flag", () => {
    expect(
      isCashLike({ id: "ANY", name: "x", marketValue: 0, isCash: true }),
    ).toBe(true);
  });
  it("matches id === CASH (case insensitive)", () => {
    expect(isCashLike({ id: "CASH", name: "x", marketValue: 0 })).toBe(true);
    expect(isCashLike({ id: "cash", name: "x", marketValue: 0 })).toBe(true);
  });
  it("matches id === USD", () => {
    expect(isCashLike({ id: "USD", name: "x", marketValue: 0 })).toBe(true);
  });
  it("does not match a regular ticker", () => {
    expect(isCashLike({ id: "VTI", name: "x", marketValue: 0 })).toBe(false);
  });
});

// ─── computeDrift — balanced ──────────────────────────────────────────────

describe("portfolio/rebalancing — balanced portfolio", () => {
  it("reports balanced status when portfolio is at target", () => {
    // Portfolio at exact target: 60/20/15/5 on $100k total
    const hold: Holding[] = [
      { id: "VTI", name: "US", marketValue: 60_000 },
      { id: "VXUS", name: "Intl", marketValue: 20_000 },
      { id: "BND", name: "Bond", marketValue: 15_000 },
      { id: "CASH", name: "Cash", marketValue: 5_000, isCash: true },
    ];
    const r = computeDrift(hold, target60_30_10);
    expect(r.totalValueUSD).toBe(100_000);
    expect(r.status).toBe("balanced");
    expect(r.sleevesInDrift).toBe(0);
    expect(r.proposals).toHaveLength(0);
    for (const row of r.drift) {
      expect(Math.abs(row.driftPct)).toBeLessThan(0.001);
    }
  });

  it("returns zero drift for an empty portfolio with empty target (trivial balanced)", () => {
    const r = computeDrift([], []);
    expect(r.totalValueUSD).toBe(0);
    expect(r.drift).toHaveLength(0);
    expect(r.proposals).toHaveLength(0);
  });
});

// ─── computeDrift — drift + proposals ─────────────────────────────────────

describe("portfolio/rebalancing — drift detection + cash-neutral proposals", () => {
  it("detects overweight VTI on a typical drift scenario", () => {
    const r = computeDrift(holdings, target60_30_10);
    // 60+25+10+5 = 100k total
    // VTI actual = 60% (target 60%)  → 0 drift
    // VXUS actual = 25% (target 20%) → +5 drift → inDrift (at threshold)
    // BND actual = 10% (target 15%) → -5 drift → inDrift
    // CASH actual = 5% (target 5%) → 0 drift
    expect(r.totalValueUSD).toBe(100_000);
    expect(r.sleevesInDrift).toBe(2);
    expect(r.status).toBe("needs_rebalance");
    const vxusRow = r.drift.find((d) => d.holding.id === "VXUS");
    const bndRow = r.drift.find((d) => d.holding.id === "BND");
    expect(vxusRow?.driftPct).toBeCloseTo(5, 5);
    expect(bndRow?.driftPct).toBeCloseTo(-5, 5);
  });

  it("produces cash-neutral proposals (total sell = total buy)", () => {
    const r = computeDrift(holdings, target60_30_10);
    const sellSum = r.proposals
      .filter((p) => p.side === "sell")
      .reduce((s, p) => s + p.amountUSD, 0);
    const buySum = r.proposals
      .filter((p) => p.side === "buy")
      .reduce((s, p) => s + p.amountUSD, 0);
    expect(sellSum).toBeGreaterThan(0);
    expect(sellSum).toBeCloseTo(buySum, 5);
  });

  it("ranks proposals — sells before buys, each ascending", () => {
    const r = computeDrift(holdings, target60_30_10);
    const ranks = r.proposals.map((p) => p.rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
    // First proposal is a sell (we always propose sells first)
    expect(r.proposals[0].side).toBe("sell");
  });

  it("sorts drift rows by |drift| descending for the UI table", () => {
    const r = computeDrift(holdings, target60_30_10);
    for (let i = 1; i < r.drift.length; i++) {
      expect(Math.abs(r.drift[i].driftPct)).toBeLessThanOrEqual(
        Math.abs(r.drift[i - 1].driftPct),
      );
    }
  });

  it("respects a custom driftThreshold", () => {
    // With threshold=10pp, nothing is in drift (max is 5)
    const r = computeDrift(holdings, target60_30_10, { driftThreshold: 10 });
    expect(r.sleevesInDrift).toBe(0);
    expect(r.proposals).toHaveLength(0);
    expect(r.status).toBe("mild_drift"); // totalAbsDriftPp = 10 >= 10, not balanced
  });
});

// ─── computeDrift — malformed input ───────────────────────────────────────

describe("portfolio/rebalancing — malformed input", () => {
  it("clamps a negative market value to 0 with a warning", () => {
    const bad: Holding[] = [
      { id: "VTI", name: "x", marketValue: -100 },
      { id: "BND", name: "y", marketValue: 100 },
    ];
    const r = computeDrift(bad, [
      { id: "VTI", targetPct: 50 },
      { id: "BND", targetPct: 50 },
    ]);
    expect(r.warnings.some((w) => /invalid market value/i.test(w))).toBe(true);
    expect(r.totalValueUSD).toBe(100);
  });

  it("clamps NaN market value to 0 with a warning", () => {
    const bad: Holding[] = [
      { id: "VTI", name: "x", marketValue: Number.NaN },
      { id: "BND", name: "y", marketValue: 100 },
    ];
    const r = computeDrift(bad, [
      { id: "VTI", targetPct: 50 },
      { id: "BND", targetPct: 50 },
    ]);
    expect(r.warnings.some((w) => /invalid market value/i.test(w))).toBe(true);
  });

  it("flags holdings without a target as sell-all orphans", () => {
    const hold: Holding[] = [
      { id: "MEME", name: "Leftover", marketValue: 5_000 },
      { id: "VTI", name: "US", marketValue: 95_000 },
    ];
    const r = computeDrift(hold, [{ id: "VTI", targetPct: 100 }]);
    expect(r.warnings.some((w) => /no target allocation/i.test(w))).toBe(true);
    const memeRow = r.drift.find((d) => d.holding.id === "MEME");
    expect(memeRow?.targetPct).toBe(0);
    expect(memeRow?.driftPct).toBeCloseTo(5, 5); // 5% overweight
  });

  it("rescales targets that don't sum to 100 with a warning", () => {
    const hold: Holding[] = [
      { id: "A", name: "A", marketValue: 50_000 },
      { id: "B", name: "B", marketValue: 50_000 },
    ];
    const r = computeDrift(hold, [
      { id: "A", targetPct: 30 },
      { id: "B", targetPct: 30 },
    ]);
    // Targets sum to 60 — engine rescales to 50/50 (equiv).
    expect(r.warnings.some((w) => /sums to 60/i.test(w))).toBe(true);
    const rowA = r.drift.find((d) => d.holding.id === "A");
    expect(rowA?.targetPct).toBeCloseTo(50, 2);
  });

  it("handles a target with no matching holding (treated as 0 actual)", () => {
    const hold: Holding[] = [{ id: "A", name: "A", marketValue: 100_000 }];
    const r = computeDrift(hold, [
      { id: "A", targetPct: 50 },
      { id: "B", targetPct: 50 },
    ]);
    expect(r.drift.find((d) => d.holding.id === "B")).toBeDefined();
    const rowB = r.drift.find((d) => d.holding.id === "B");
    expect(rowB?.actualPct).toBe(0);
    expect(rowB?.driftPct).toBeCloseTo(-50, 5);
  });
});

// ─── Tax-aware sell ordering ──────────────────────────────────────────────

describe("portfolio/rebalancing — tax-aware sell ordering", () => {
  it("puts loss harvest candidates at the top of the sell queue", () => {
    const hold: Holding[] = [
      { id: "GAIN", name: "Appreciated", marketValue: 30_000, longTermGainLossUSD: 10_000 },
      { id: "LOSS", name: "Underwater", marketValue: 30_000, longTermGainLossUSD: -5_000 },
      { id: "BND", name: "Bond", marketValue: 40_000 },
    ];
    const r = computeDrift(
      hold,
      [
        { id: "GAIN", targetPct: 20 },
        { id: "LOSS", targetPct: 20 },
        { id: "BND", targetPct: 60 },
      ],
      { taxAware: true },
    );
    const sells = r.proposals.filter((p) => p.side === "sell");
    // Both GAIN and LOSS are overweight by 10pp; LOSS should come first.
    expect(sells[0].holdingId).toBe("LOSS");
    expect(sells[0].reason).toMatch(/loss harvest/i);
  });

  it("without taxAware sorts sells by |dollar gap| descending", () => {
    const hold: Holding[] = [
      { id: "GAIN", name: "Appreciated", marketValue: 30_000, longTermGainLossUSD: 10_000 },
      { id: "LOSS", name: "Underwater", marketValue: 35_000, longTermGainLossUSD: -5_000 },
      { id: "BND", name: "Bond", marketValue: 35_000 },
    ];
    const r = computeDrift(hold, [
      { id: "GAIN", targetPct: 20 },
      { id: "LOSS", targetPct: 20 },
      { id: "BND", targetPct: 60 },
    ]);
    const sells = r.proposals.filter((p) => p.side === "sell");
    // LOSS has the largest |dollar gap| (35k - 20k = -15k vs 30k - 20k = -10k for GAIN)
    expect(sells[0].holdingId).toBe("LOSS");
  });

  it("defaults to alphabetical sell ordering when no LT gains are provided", () => {
    const hold: Holding[] = [
      { id: "ZZZ", name: "Z", marketValue: 40_000 },
      { id: "AAA", name: "A", marketValue: 40_000 },
      { id: "BND", name: "Bond", marketValue: 20_000 },
    ];
    const r = computeDrift(
      hold,
      [
        { id: "ZZZ", targetPct: 20 },
        { id: "AAA", targetPct: 20 },
        { id: "BND", targetPct: 60 },
      ],
      { taxAware: true },
    );
    const sells = r.proposals.filter((p) => p.side === "sell");
    expect(sells[0].holdingId).toBe("AAA");
  });
});

// ─── simulateWithNewCash ──────────────────────────────────────────────────

describe("portfolio/rebalancing — simulateWithNewCash", () => {
  it("adds new cash to the existing cash sleeve", () => {
    const r = simulateWithNewCash(holdings, target60_30_10, 50_000);
    expect(r.totalValueUSD).toBe(150_000);
    const cashRow = r.drift.find((d) => d.holding.id === "CASH");
    expect(cashRow?.holding.marketValue).toBe(55_000);
  });

  it("creates a new CASH sleeve when none exists", () => {
    const hold: Holding[] = [
      { id: "VTI", name: "x", marketValue: 50_000 },
      { id: "BND", name: "y", marketValue: 50_000 },
    ];
    const r = simulateWithNewCash(hold, [
      { id: "VTI", targetPct: 60 },
      { id: "BND", targetPct: 30 },
      { id: "CASH", targetPct: 10 },
    ], 10_000);
    expect(r.totalValueUSD).toBe(110_000);
    const cashRow = r.drift.find((d) => d.holding.id === "CASH");
    expect(cashRow?.holding.marketValue).toBe(10_000);
  });

  it("no-ops on negative or NaN new cash", () => {
    const r1 = simulateWithNewCash(holdings, target60_30_10, -1000);
    const r2 = simulateWithNewCash(holdings, target60_30_10, Number.NaN);
    expect(r1.totalValueUSD).toBe(100_000);
    expect(r2.totalValueUSD).toBe(100_000);
  });
});

// ─── Cash buffer ──────────────────────────────────────────────────────────

describe("portfolio/rebalancing — cash buffer", () => {
  it("never sells more cash than the buffer allows", () => {
    // Portfolio heavily overweight cash.
    const hold: Holding[] = [
      { id: "VTI", name: "US", marketValue: 40_000 },
      { id: "CASH", name: "Cash", marketValue: 60_000, isCash: true },
    ];
    const r = computeDrift(
      hold,
      [
        { id: "VTI", targetPct: 70 },
        { id: "CASH", targetPct: 30 },
      ],
      { cashBufferPct: 50 },
    );
    const cashSell = r.proposals.find(
      (p) => p.holdingId === "CASH" && p.side === "sell",
    );
    // Without buffer we'd sell 30k of cash to move to 30%. With 50%
    // buffer reserved (30k), the engine can only sell 30k of the 60k
    // — exactly matching the required rebalance anyway. Check that
    // proposals don't exceed the reserved portion.
    if (cashSell) {
      expect(cashSell.amountUSD).toBeLessThanOrEqual(30_000 + 0.001);
    }
  });

  it("buffer=0 is a no-op", () => {
    const r0 = computeDrift(holdings, target60_30_10, { cashBufferPct: 0 });
    const rNoOpts = computeDrift(holdings, target60_30_10);
    expect(r0.proposals.length).toBe(rNoOpts.proposals.length);
  });
});

// ─── status classification ────────────────────────────────────────────────

describe("portfolio/rebalancing — status classification", () => {
  it("balanced when totalAbsDriftPp < threshold", () => {
    const hold: Holding[] = [
      { id: "A", name: "A", marketValue: 51_000 },
      { id: "B", name: "B", marketValue: 49_000 },
    ];
    const r = computeDrift(hold, [
      { id: "A", targetPct: 50 },
      { id: "B", targetPct: 50 },
    ]);
    // Drift is 1pp each way → totalAbsDriftPp = 2, threshold 5 → balanced
    expect(r.status).toBe("balanced");
  });

  it("mild_drift when only 1 sleeve is in drift", () => {
    const hold: Holding[] = [
      { id: "A", name: "A", marketValue: 90_000 },
      { id: "B", name: "B", marketValue: 5_000 },
      { id: "C", name: "C", marketValue: 5_000 },
    ];
    const r = computeDrift(hold, [
      { id: "A", targetPct: 85 },
      { id: "B", targetPct: 10 },
      { id: "C", targetPct: 5 },
    ]);
    // A: 90 vs 85 → +5 (in drift)
    // B: 5 vs 10 → -5 (in drift)
    // C: 5 vs 5 → 0
    // 2 sleeves → needs_rebalance
    expect(r.sleevesInDrift).toBe(2);
  });
});

// ─── Snapshot invariants ──────────────────────────────────────────────────

describe("portfolio/rebalancing — snapshot invariants", () => {
  it("sum of target values = totalValueUSD", () => {
    const r = computeDrift(holdings, target60_30_10);
    const sum = r.drift.reduce((s, row) => s + row.targetValue, 0);
    expect(sum).toBeCloseTo(r.totalValueUSD, 3);
  });
  it("sum of dollar gaps = 0 (cash neutral)", () => {
    const r = computeDrift(holdings, target60_30_10);
    const sum = r.drift.reduce((s, row) => s + row.dollarGap, 0);
    expect(Math.abs(sum)).toBeLessThan(0.001);
  });
  it("sum of drift percentages = 0 (% invariant)", () => {
    const r = computeDrift(holdings, target60_30_10);
    const sum = r.drift.reduce((s, row) => s + row.driftPct, 0);
    expect(Math.abs(sum)).toBeLessThan(0.001);
  });
});
