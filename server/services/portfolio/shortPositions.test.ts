/**
 * Unit tests for the short-position tracker.
 * Pass 13 of the hybrid build loop — PARITY-PORT-0003.
 */
import { describe, it, expect } from "vitest";
import {
  trackShortPositions,
  valueShortPositions,
} from "./shortPositions";
import type { Transaction } from "./ledger";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? "t1",
    symbol: overrides.symbol ?? "VTI",
    timestamp: overrides.timestamp ?? "2024-01-15T00:00:00Z",
    kind: overrides.kind ?? "buy",
    shares: overrides.shares ?? 10,
    pricePerShare: overrides.pricePerShare ?? 100,
    feesUSD: overrides.feesUSD,
    againstLotId: overrides.againstLotId,
  };
}

// ─── Basic short open/close ───────────────────────────────────────────────

describe("portfolio/shortPositions — basic open", () => {
  it("opens a short when the first transaction is a sell of an unheld symbol", () => {
    const r = trackShortPositions([
      txn({
        id: "s1",
        kind: "sell",
        shares: 10,
        pricePerShare: 100,
      }),
    ]);
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].shortShares).toBe(10);
    expect(r.positions[0].avgProceedsPerShare).toBe(100);
    expect(r.warnings.some((w) => /short position/i.test(w))).toBe(true);
  });

  it("opens a short when a sell exceeds the existing long position", () => {
    const r = trackShortPositions([
      txn({ id: "b1", shares: 5, pricePerShare: 100 }),
      txn({
        id: "s1",
        kind: "sell",
        shares: 15,
        pricePerShare: 120,
      }),
    ]);
    // 5 long consumed + 10 short opened
    expect(r.positions[0].shortShares).toBe(10);
    expect(r.positions[0].avgProceedsPerShare).toBe(120);
  });

  it("does NOT open a short when long exposure covers the sell", () => {
    const r = trackShortPositions([
      txn({ id: "b1", shares: 20, pricePerShare: 100 }),
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 120 }),
    ]);
    expect(r.positions).toHaveLength(0);
  });
});

// ─── Cover shorts with buys ────────────────────────────────────────────────

describe("portfolio/shortPositions — cover", () => {
  it("covers a short with a subsequent buy and records the gain", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", shares: 10, pricePerShare: 80 }),
    ]);
    expect(r.positions).toHaveLength(0); // short closed
    expect(r.coverGains).toHaveLength(1);
    const g = r.coverGains[0];
    // Sold at 100, bought back at 80 → 200 profit on 10 shares
    expect(g.proceedsUSD).toBe(1000);
    expect(g.coverCostUSD).toBe(800);
    expect(g.gainUSD).toBe(200);
  });

  it("computes a loss when cover price is higher than open price", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", shares: 10, pricePerShare: 120 }),
    ]);
    const g = r.coverGains[0];
    expect(g.gainUSD).toBe(-200);
  });

  it("partial cover leaves the remaining shares short", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", shares: 4, pricePerShare: 80 }),
    ]);
    expect(r.positions[0].shortShares).toBe(6);
    expect(r.coverGains[0].shares).toBe(4);
  });

  it("covers across multiple short lots FIFO", () => {
    const r = trackShortPositions([
      txn({ id: "s1", timestamp: "2024-01-01", kind: "sell", shares: 5, pricePerShare: 100 }),
      txn({ id: "s2", timestamp: "2024-02-01", kind: "sell", shares: 5, pricePerShare: 110 }),
      txn({ id: "b1", timestamp: "2024-06-01", shares: 8, pricePerShare: 90 }),
    ]);
    expect(r.coverGains).toHaveLength(2);
    expect(r.coverGains[0].openLotId).toBe("s1");
    expect(r.coverGains[1].openLotId).toBe("s2");
  });

  it("over-cover closes the short and adds the excess to long exposure", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 5, pricePerShare: 100 }),
      txn({ id: "b1", shares: 12, pricePerShare: 80 }),
    ]);
    expect(r.positions).toHaveLength(0);
    expect(r.coverGains[0].shares).toBe(5);
    expect(r.warnings.some((w) => /crossed into long/i.test(w))).toBe(true);
  });

  it("marks long-term when held ≥365 days", () => {
    const r = trackShortPositions([
      txn({ id: "s1", timestamp: "2024-01-01", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", timestamp: "2025-06-01", shares: 10, pricePerShare: 80 }),
    ]);
    expect(r.coverGains[0].longTerm).toBe(true);
  });

  it("marks short-term when held <365 days", () => {
    const r = trackShortPositions([
      txn({ id: "s1", timestamp: "2024-01-01", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", timestamp: "2024-06-01", shares: 10, pricePerShare: 80 }),
    ]);
    expect(r.coverGains[0].longTerm).toBe(false);
  });
});

// ─── Splits ───────────────────────────────────────────────────────────────

describe("portfolio/shortPositions — splits", () => {
  it("2-for-1 split doubles short shares and halves proceeds per share", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "sp1", kind: "split", shares: 0, pricePerShare: 2 }),
    ]);
    expect(r.positions[0].shortShares).toBe(20);
    expect(r.positions[0].avgProceedsPerShare).toBe(50);
    // Invariant: total proceeds unchanged
    expect(r.positions[0].totalProceeds).toBe(1000);
  });
});

// ─── Multi-symbol ────────────────────────────────────────────────────────

describe("portfolio/shortPositions — multi-symbol", () => {
  it("tracks independent shorts per symbol", () => {
    const r = trackShortPositions([
      txn({ id: "s1", symbol: "VTI", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "s2", symbol: "BND", kind: "sell", shares: 20, pricePerShare: 50 }),
    ]);
    expect(r.positions).toHaveLength(2);
    expect(r.positions.map((p) => p.symbol)).toEqual(["BND", "VTI"]);
  });

  it("covering one symbol leaves the other short", () => {
    const r = trackShortPositions([
      txn({ id: "s1", symbol: "VTI", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "s2", symbol: "BND", kind: "sell", shares: 10, pricePerShare: 50 }),
      txn({ id: "b1", symbol: "VTI", shares: 10, pricePerShare: 80 }),
    ]);
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].symbol).toBe("BND");
  });
});

// ─── valueShortPositions ────────────────────────────────────────────────

describe("portfolio/shortPositions — valueShortPositions", () => {
  it("computes unrealized gain as (proceeds - market) × shares", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valueShortPositions(r.positions, [
      { symbol: "VTI", pricePerShare: 80 },
    ]);
    expect(valued[0].unrealizedGainUSD).toBe(200);
  });

  it("computes unrealized loss when price is higher than the short opened at", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valueShortPositions(r.positions, [
      { symbol: "VTI", pricePerShare: 130 },
    ]);
    expect(valued[0].unrealizedGainUSD).toBe(-300);
  });

  it("handles missing price as zero market exposure", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
    ]);
    const valued = valueShortPositions(r.positions, []);
    expect(valued[0].marketPrice).toBe(0);
    expect(valued[0].unrealizedGainUSD).toBe(1000); // proceeds − 0
  });
});

// ─── Invariants ──────────────────────────────────────────────────────────

describe("portfolio/shortPositions — invariants", () => {
  it("sum of cover gains + open proceeds = total proceeds received", () => {
    const r = trackShortPositions([
      txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 }),
      txn({ id: "b1", shares: 4, pricePerShare: 80 }),
      // 6 shares still short, proceeds = 600
      // 4 shares covered, proceeds = 400, cover cost = 320, gain = 80
    ]);
    const openProceeds = r.positions.reduce((s, p) => s + p.totalProceeds, 0);
    const coveredProceeds = r.coverGains.reduce((s, g) => s + g.proceedsUSD, 0);
    expect(openProceeds + coveredProceeds).toBe(1000);
  });

  it("empty input returns empty result", () => {
    const r = trackShortPositions([]);
    expect(r.positions).toHaveLength(0);
    expect(r.coverGains).toHaveLength(0);
    expect(r.totalShortGain).toBe(0);
  });

  it("skips null / invalid transactions", () => {
    // @ts-expect-error deliberate bad input
    const r = trackShortPositions([null, undefined, txn({ id: "s1", kind: "sell", shares: 10, pricePerShare: 100 })]);
    expect(r.positions).toHaveLength(1);
  });
});
