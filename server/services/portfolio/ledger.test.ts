/**
 * Unit tests for the pure cost-basis ledger.
 *
 * Pass 5 of the hybrid build loop — PARITY-PORT-0001 + PARITY-TAX-0002.
 *
 * Test philosophy: high coverage + property invariants + graceful
 * degradation. Every public function gets at least one test per branch.
 * Realistic multi-transaction scenarios lock in end-to-end behavior.
 */
import { describe, it, expect } from "vitest";
import {
  runLedger,
  daysBetween,
  valuePositions,
  splitRealized,
  lossHarvestCandidates,
  type Transaction,
  type CostBasisMethod,
} from "./ledger";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? "t1",
    symbol: overrides.symbol ?? "VTI",
    timestamp: overrides.timestamp ?? "2024-01-15T00:00:00Z",
    kind: overrides.kind ?? "buy",
    shares: overrides.shares ?? 10,
    pricePerShare: overrides.pricePerShare ?? 200,
    feesUSD: overrides.feesUSD,
    againstLotId: overrides.againstLotId,
  };
}

// ─── daysBetween ──────────────────────────────────────────────────────────

describe("portfolio/ledger — daysBetween", () => {
  it("returns days between two ISO dates", () => {
    expect(daysBetween("2024-01-01", "2024-01-11")).toBe(10);
  });
  it("returns 0 for same-day", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
  it("clamps to 0 for reversed dates", () => {
    expect(daysBetween("2024-02-01", "2024-01-01")).toBe(0);
  });
  it("returns 0 for invalid dates", () => {
    expect(daysBetween("not a date", "2024-01-01")).toBe(0);
  });
});

// ─── Buys ──────────────────────────────────────────────────────────────────

describe("portfolio/ledger — buy transactions", () => {
  it("opens a single lot for a buy", () => {
    const r = runLedger([txn({ id: "b1", shares: 10, pricePerShare: 100 })]);
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].shares).toBe(10);
    expect(r.positions[0].avgCostPerShare).toBe(100);
  });

  it("amortizes fees into the cost per share", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100, feesUSD: 10 }),
    ]);
    // 10 shares at $100 + $10 fee = $11 amortized → $101/share
    expect(r.positions[0].avgCostPerShare).toBe(101);
  });

  it("aggregates two buys into one position with weighted avg", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
      txn({ id: "b2", shares: 10, pricePerShare: 200 }),
    ]);
    expect(r.positions[0].shares).toBe(20);
    expect(r.positions[0].avgCostPerShare).toBe(150);
  });

  it("tracks multiple lots in chronological order", () => {
    const r = runLedger([
      txn({ id: "b1", timestamp: "2024-01-01", shares: 5 }),
      txn({ id: "b2", timestamp: "2024-02-01", shares: 5 }),
      txn({ id: "b3", timestamp: "2024-03-01", shares: 5 }),
    ]);
    expect(r.positions[0].lots).toHaveLength(3);
  });

  it("treats transfer_in like a buy", () => {
    const r = runLedger([
      txn({ id: "t1", kind: "transfer_in", shares: 10, pricePerShare: 50 }),
    ]);
    expect(r.positions[0].shares).toBe(10);
  });

  it("clamps negative shares to 0 with warning", () => {
    const r = runLedger([
      txn({ id: "b1", shares: -5 }),
      txn({ id: "b2", shares: 10 }),
    ]);
    expect(r.warnings.some((w) => /invalid shares/i.test(w))).toBe(true);
    expect(r.positions[0].shares).toBe(10);
  });

  it("clamps negative price to 0 with warning", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: -50 }),
    ]);
    expect(r.warnings.some((w) => /invalid price/i.test(w))).toBe(true);
    expect(r.positions[0].avgCostPerShare).toBe(0);
  });
});

// ─── FIFO sells ────────────────────────────────────────────────────────────

describe("portfolio/ledger — FIFO sells", () => {
  const buys: Transaction[] = [
    txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
    txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 200 }),
  ];

  it("consumes the oldest lot first on partial sell", () => {
    const r = runLedger(
      [
        ...buys,
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 5, pricePerShare: 300 }),
      ],
      "FIFO",
    );
    expect(r.realizedGains).toHaveLength(1);
    expect(r.realizedGains[0].lotId).toBe("b1");
    expect(r.realizedGains[0].shares).toBe(5);
    // cost basis = 5 * 100 = 500, proceeds = 5 * 300 = 1500, gain = 1000
    expect(r.realizedGains[0].costBasisUSD).toBe(500);
    expect(r.realizedGains[0].proceedsUSD).toBe(1500);
    expect(r.realizedGains[0].gainUSD).toBe(1000);
  });

  it("consumes across two lots on full sell", () => {
    const r = runLedger(
      [
        ...buys,
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 15, pricePerShare: 300 }),
      ],
      "FIFO",
    );
    expect(r.realizedGains).toHaveLength(2);
    expect(r.realizedGains[0].lotId).toBe("b1"); // first 10
    expect(r.realizedGains[0].shares).toBe(10);
    expect(r.realizedGains[1].lotId).toBe("b2"); // next 5
    expect(r.realizedGains[1].shares).toBe(5);
  });

  it("marks long-term when held ≥365 days", () => {
    const r = runLedger(
      [
        ...buys,
        txn({ id: "s1", timestamp: "2025-02-01", kind: "sell", shares: 5, pricePerShare: 300 }),
      ],
      "FIFO",
    );
    expect(r.realizedGains[0].longTerm).toBe(true);
  });

  it("marks short-term when held <365 days", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-10-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "s1", timestamp: "2024-12-01", kind: "sell", shares: 5, pricePerShare: 150 }),
      ],
      "FIFO",
    );
    expect(r.realizedGains[0].longTerm).toBe(false);
  });

  it("emits SHORT_POSITION warning on oversell", () => {
    const r = runLedger(
      [
        txn({ id: "b1", shares: 5, pricePerShare: 100 }),
        txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 150 }),
      ],
      "FIFO",
    );
    expect(r.warnings.some((w) => /SHORT_POSITION/.test(w))).toBe(true);
  });

  it("emits SHORT_POSITION warning when selling unheld symbol", () => {
    const r = runLedger(
      [
        txn({ id: "s1", symbol: "GME", kind: "sell", shares: 10, pricePerShare: 100 }),
      ],
      "FIFO",
    );
    expect(r.warnings.some((w) => /SHORT_POSITION/.test(w))).toBe(true);
  });
});

// ─── LIFO sells ────────────────────────────────────────────────────────────

describe("portfolio/ledger — LIFO sells", () => {
  it("consumes the newest lot first", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 200 }),
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 5, pricePerShare: 300 }),
      ],
      "LIFO",
    );
    expect(r.realizedGains[0].lotId).toBe("b2");
    expect(r.realizedGains[0].costBasisUSD).toBe(1000); // 5 * 200
  });
});

// ─── HIFO sells ────────────────────────────────────────────────────────────

describe("portfolio/ledger — HIFO sells", () => {
  it("consumes the highest-cost lot first (minimizes gain)", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 300 }),
        txn({ id: "b3", timestamp: "2024-09-01", shares: 10, pricePerShare: 200 }),
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 5, pricePerShare: 250 }),
      ],
      "HIFO",
    );
    expect(r.realizedGains[0].lotId).toBe("b2");
    // Selling at 250, basis 300 → loss of 250
    expect(r.realizedGains[0].gainUSD).toBe(-250);
  });
});

// ─── LCFO sells ────────────────────────────────────────────────────────────

describe("portfolio/ledger — LCFO sells", () => {
  it("consumes the lowest-cost lot first (maximizes gain for donation)", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 300 }),
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 5, pricePerShare: 350 }),
      ],
      "LCFO",
    );
    expect(r.realizedGains[0].lotId).toBe("b1");
    expect(r.realizedGains[0].gainUSD).toBe(1250); // 5 * (350 - 100)
  });
});

// ─── avgCost ───────────────────────────────────────────────────────────────

describe("portfolio/ledger — avgCost sells", () => {
  it("collapses lots into one weighted-avg lot", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 200 }),
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 5, pricePerShare: 300 }),
      ],
      "avgCost",
    );
    // avg = 150, 5 sold at 300 → gain = 5 * (300 - 150) = 750
    expect(r.realizedGains).toHaveLength(1);
    expect(r.realizedGains[0].gainUSD).toBe(750);
    expect(r.positions[0].shares).toBe(15);
    expect(r.positions[0].avgCostPerShare).toBe(150);
  });

  it("emits SHORT_POSITION warning on avgCost oversell", () => {
    const r = runLedger(
      [
        txn({ id: "b1", shares: 5, pricePerShare: 100 }),
        txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 150 }),
      ],
      "avgCost",
    );
    expect(r.warnings.some((w) => /SHORT_POSITION/.test(w))).toBe(true);
    // 5 consumed, 5 short
    expect(r.realizedGains[0].shares).toBe(5);
  });

  it("empties position on full avgCost sell", () => {
    const r = runLedger(
      [
        txn({ id: "b1", shares: 10, pricePerShare: 100 }),
        txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 150 }),
      ],
      "avgCost",
    );
    expect(r.positions).toHaveLength(0);
  });
});

// ─── Specific-lot ──────────────────────────────────────────────────────────

describe("portfolio/ledger — specific-lot sells", () => {
  it("consumes the lot matching againstLotId", () => {
    const r = runLedger(
      [
        txn({ id: "b1", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", shares: 10, pricePerShare: 300 }),
        txn({
          id: "s1",
          kind: "sell",
          shares: 5,
          pricePerShare: 200,
          againstLotId: "b2",
        }),
      ],
      "specific",
    );
    expect(r.realizedGains[0].lotId).toBe("b2");
    expect(r.realizedGains[0].gainUSD).toBe(-500); // basis 300, sell 200
  });

  it("emits SPECIFIC_LOT_NOT_FOUND when lot id is missing", () => {
    const r = runLedger(
      [
        txn({ id: "b1", shares: 10, pricePerShare: 100 }),
        txn({
          id: "s1",
          kind: "sell",
          shares: 5,
          pricePerShare: 200,
          againstLotId: "nonexistent",
        }),
      ],
      "specific",
    );
    expect(r.warnings.some((w) => /SPECIFIC_LOT_NOT_FOUND/.test(w))).toBe(true);
  });

  it("falls back to FIFO when no againstLotId is provided", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 200 }),
        txn({
          id: "s1",
          timestamp: "2025-01-01",
          kind: "sell",
          shares: 5,
          pricePerShare: 300,
        }),
      ],
      "specific",
    );
    expect(r.realizedGains[0].lotId).toBe("b1");
  });
});

// ─── Dividends ─────────────────────────────────────────────────────────────

describe("portfolio/ledger — dividends", () => {
  it("reinvested dividends open a new lot", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 100, pricePerShare: 100 }),
      txn({ id: "d1", kind: "dividend", shares: 2, pricePerShare: 150 }),
    ]);
    expect(r.positions[0].lots).toHaveLength(2);
    expect(r.positions[0].shares).toBe(102);
  });

  it("zero-share (cash) dividend does nothing to lots", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 100, pricePerShare: 100 }),
      txn({ id: "d1", kind: "dividend", shares: 0, pricePerShare: 0 }),
    ]);
    expect(r.positions[0].lots).toHaveLength(1);
  });
});

// ─── Splits ────────────────────────────────────────────────────────────────

describe("portfolio/ledger — splits", () => {
  it("2-for-1 split doubles shares and halves cost", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
      txn({ id: "s1", kind: "split", shares: 0, pricePerShare: 2 }),
    ]);
    expect(r.positions[0].shares).toBe(20);
    expect(r.positions[0].avgCostPerShare).toBe(50);
    expect(r.positions[0].totalCostBasis).toBe(1000); // invariant
  });

  it("3-for-2 split scales correctly", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 150 }),
      txn({ id: "s1", kind: "split", shares: 0, pricePerShare: 1.5 }),
    ]);
    expect(r.positions[0].shares).toBe(15);
    expect(r.positions[0].avgCostPerShare).toBe(100);
  });

  it("no-op split (ratio 1) leaves lots unchanged", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
      txn({ id: "s1", kind: "split", shares: 0, pricePerShare: 1 }),
    ]);
    expect(r.positions[0].shares).toBe(10);
  });

  it("zero ratio is ignored", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
      txn({ id: "s1", kind: "split", shares: 0, pricePerShare: 0 }),
    ]);
    expect(r.positions[0].shares).toBe(10);
  });
});

// ─── valuePositions ───────────────────────────────────────────────────────

describe("portfolio/ledger — valuePositions", () => {
  it("computes market value, unrealized gain, and pct", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valuePositions(r.positions, [
      { symbol: "VTI", pricePerShare: 150 },
    ]);
    expect(valued[0].marketValueUSD).toBe(1500);
    expect(valued[0].unrealizedGainUSD).toBe(500);
    expect(valued[0].unrealizedGainPct).toBeCloseTo(50, 2);
  });

  it("returns 0% when cost basis is 0", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 0 }),
    ]);
    const valued = valuePositions(r.positions, [
      { symbol: "VTI", pricePerShare: 150 },
    ]);
    expect(valued[0].unrealizedGainPct).toBe(0);
  });

  it("handles missing price as 0", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valuePositions(r.positions, []);
    expect(valued[0].marketValueUSD).toBe(0);
    expect(valued[0].unrealizedGainUSD).toBe(-1000);
  });
});

// ─── splitRealized ────────────────────────────────────────────────────────

describe("portfolio/ledger — splitRealized", () => {
  it("separates ST and LT gains", () => {
    const r = runLedger(
      [
        txn({ id: "b1", timestamp: "2023-01-01", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", timestamp: "2024-10-01", shares: 10, pricePerShare: 200 }),
        txn({ id: "s1", timestamp: "2025-01-01", kind: "sell", shares: 15, pricePerShare: 300 }),
      ],
      "FIFO",
    );
    const split = splitRealized(r.realizedGains);
    expect(split.longTerm).toBe(2000); // 10 * (300 - 100)
    expect(split.shortTerm).toBe(500); // 5 * (300 - 200)
  });

  it("returns zero for empty array", () => {
    expect(splitRealized([])).toEqual({ shortTerm: 0, longTerm: 0 });
  });
});

// ─── lossHarvestCandidates ────────────────────────────────────────────────

describe("portfolio/ledger — lossHarvestCandidates", () => {
  it("picks lots with losses above minLossUSD", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 200 }),
      txn({ id: "b2", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valuePositions(r.positions, [
      { symbol: "VTI", pricePerShare: 80 },
    ]);
    // Note: lots collapse into a single position so the
    // harvest helper inspects them via the lot list — we compute
    // mv per share from position total, not per-lot.
    const candidates = lossHarvestCandidates(valued, 100);
    expect(candidates.length).toBeGreaterThan(0);
    // Sorted by loss ascending (most negative first)
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].loss).toBeGreaterThanOrEqual(candidates[i - 1].loss);
    }
  });

  it("returns empty when no losses exceed threshold", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valuePositions(r.positions, [
      { symbol: "VTI", pricePerShare: 99 },
    ]);
    // Unrealized loss = 10 — below minLoss of 100
    const candidates = lossHarvestCandidates(valued, 100);
    expect(candidates).toHaveLength(0);
  });
});

// ─── Multi-symbol scenarios ───────────────────────────────────────────────

describe("portfolio/ledger — multi-symbol", () => {
  it("tracks independent positions per symbol", () => {
    const r = runLedger([
      txn({ id: "b1", symbol: "VTI", shares: 10, pricePerShare: 100 }),
      txn({ id: "b2", symbol: "VXUS", shares: 20, pricePerShare: 50 }),
      txn({ id: "b3", symbol: "BND", shares: 50, pricePerShare: 80 }),
    ]);
    expect(r.positions).toHaveLength(3);
    expect(r.positions.map((p) => p.symbol)).toEqual(["BND", "VTI", "VXUS"]);
  });

  it("selling one symbol does not touch another", () => {
    const r = runLedger(
      [
        txn({ id: "b1", symbol: "VTI", shares: 10, pricePerShare: 100 }),
        txn({ id: "b2", symbol: "VXUS", shares: 10, pricePerShare: 50 }),
        txn({
          id: "s1",
          symbol: "VTI",
          kind: "sell",
          shares: 5,
          pricePerShare: 150,
        }),
      ],
      "FIFO",
    );
    expect(r.positions.find((p) => p.symbol === "VXUS")?.shares).toBe(10);
    expect(r.positions.find((p) => p.symbol === "VTI")?.shares).toBe(5);
  });
});

// ─── Defensive / malformed inputs ─────────────────────────────────────────

describe("portfolio/ledger — defensive handling", () => {
  it("handles empty transaction list", () => {
    const r = runLedger([]);
    expect(r.positions).toHaveLength(0);
    expect(r.realizedGains).toHaveLength(0);
    expect(r.totalRealizedGain).toBe(0);
  });

  it("skips null/undefined entries", () => {
    // @ts-expect-error — intentional bad input
    const r = runLedger([null, undefined, txn({ id: "b1", shares: 10 })]);
    expect(r.positions[0].shares).toBe(10);
    expect(r.warnings.some((w) => /non-object/i.test(w))).toBe(true);
  });

  it("warns on unknown txn kind", () => {
    const r = runLedger([
      // @ts-expect-error — intentional bad kind
      txn({ id: "x1", kind: "teleport" }),
    ]);
    expect(r.warnings.some((w) => /Unknown txn kind/i.test(w))).toBe(true);
  });

  it("totalFeesPaid sums across all transactions", () => {
    const r = runLedger([
      txn({ id: "b1", shares: 10, pricePerShare: 100, feesUSD: 5 }),
      txn({ id: "b2", shares: 10, pricePerShare: 200, feesUSD: 7 }),
      txn({ id: "s1", kind: "sell", shares: 5, pricePerShare: 300, feesUSD: 3 }),
    ]);
    expect(r.totalFeesPaid).toBe(15);
  });
});

// ─── Method comparison invariant ──────────────────────────────────────────

describe("portfolio/ledger — method invariants", () => {
  const buys: Transaction[] = [
    txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
    txn({ id: "b2", timestamp: "2024-06-01", shares: 10, pricePerShare: 300 }),
    txn({ id: "b3", timestamp: "2024-09-01", shares: 10, pricePerShare: 200 }),
  ];
  const sell = txn({
    id: "s1",
    timestamp: "2025-01-01",
    kind: "sell",
    shares: 15,
    pricePerShare: 250,
  });

  const methods: CostBasisMethod[] = [
    "FIFO",
    "LIFO",
    "HIFO",
    "LCFO",
    "avgCost",
  ];

  it("all methods produce the same total shares remaining (15)", () => {
    for (const m of methods) {
      const r = runLedger([...buys, sell], m);
      expect(r.positions[0].shares).toBe(15);
    }
  });

  it("total cost basis + realized cost basis = original cost (invariant)", () => {
    for (const m of methods) {
      const r = runLedger([...buys, sell], m);
      const realizedCost = r.realizedGains.reduce((s, g) => s + g.costBasisUSD, 0);
      const remainingCost = r.positions[0].totalCostBasis;
      const total = realizedCost + remainingCost;
      // Original cost = 10*100 + 10*300 + 10*200 = 6000
      expect(total).toBeCloseTo(6000, 2);
    }
  });

  it("HIFO produces the smallest realized gain", () => {
    const fifo = runLedger([...buys, sell], "FIFO").totalRealizedGain;
    const hifo = runLedger([...buys, sell], "HIFO").totalRealizedGain;
    expect(hifo).toBeLessThanOrEqual(fifo);
  });

  it("LCFO produces the largest realized gain", () => {
    const fifo = runLedger([...buys, sell], "FIFO").totalRealizedGain;
    const lcfo = runLedger([...buys, sell], "LCFO").totalRealizedGain;
    expect(lcfo).toBeGreaterThanOrEqual(fifo);
  });
});
