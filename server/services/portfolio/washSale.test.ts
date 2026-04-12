/**
 * Unit tests for the pure wash sale detector.
 * Pass 9 of the hybrid build loop — PARITY-REBAL-0004.
 */
import { describe, it, expect } from "vitest";
import {
  detectWashSales,
  canHarvestWithoutWashSale,
  earliestSafeRepurchase,
} from "./washSale";
import { runLedger, type Transaction } from "./ledger";

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

// ─── Basic detection ─────────────────────────────────────────────────────

describe("portfolio/washSale — detectWashSales", () => {
  it("flags a loss followed by a repurchase within 30 days", () => {
    // Buy at 100, sell at 80 (loss), repurchase within 10 days
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b2", timestamp: "2024-06-10", shares: 10, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(1);
    expect(report.totalDisallowedUSD).toBeGreaterThan(0);
    expect(report.violations[0].replacementTxnIds).toContain("b2");
  });

  it("flags a loss preceded by a buy within 30 days", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({ id: "b2", timestamp: "2024-05-15", shares: 10, pricePerShare: 85 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it("does NOT flag when repurchase is >30 days away", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b2", timestamp: "2024-07-15", shares: 10, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(0);
    expect(report.cleanHarvestCount).toBe(1);
  });

  it("does NOT flag a gain (only losses are wash-sale-sensitive)", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 50 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 100,
      }),
      txn({ id: "b2", timestamp: "2024-06-10", shares: 10, pricePerShare: 110 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(0);
  });

  it("does NOT cross symbols (different tickers are not substantially identical)", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", symbol: "VTI", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        symbol: "VTI",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b2", timestamp: "2024-06-10", symbol: "VOO", shares: 10, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(0);
  });

  it("computes partial disallowance when replacement shares < sold shares", () => {
    // Sold 10, but only 3 replaced → 30% disallowed
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b2", timestamp: "2024-06-10", shares: 3, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(1);
    const v = report.violations[0];
    // Loss was 10 * (100 - 80) = 200. 30% disallowed = 60.
    expect(v.disallowedUSD).toBeCloseTo(60, 0);
    // Allowed loss = -200 + 60 = -140.
    expect(v.allowedLossUSD).toBeCloseTo(-140, 0);
    expect(v.reason).toMatch(/partial/);
  });

  it("stacks multiple replacement buys", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b2", timestamp: "2024-06-05", shares: 3, pricePerShare: 85 }),
      txn({ id: "b3", timestamp: "2024-06-15", shares: 3, pricePerShare: 85 }),
      txn({ id: "b4", timestamp: "2024-06-25", shares: 3, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].replacementTxnIds).toHaveLength(3);
  });

  it("treats reinvested dividends as replacement buys", () => {
    const transactions: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({
        id: "d1",
        timestamp: "2024-06-10",
        kind: "dividend",
        shares: 0.5,
        pricePerShare: 85,
      }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it("reports zero violations for an empty transaction list", () => {
    const report = detectWashSales([], []);
    expect(report.violations).toHaveLength(0);
    expect(report.totalDisallowedUSD).toBe(0);
    expect(report.cleanHarvestCount).toBe(0);
    expect(report.analyzedLosses).toBe(0);
  });

  it("counts clean harvests alongside violations", () => {
    const transactions: Transaction[] = [
      // Clean harvest
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s1",
        timestamp: "2024-06-01",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      // Separate position with a wash
      txn({ id: "b2", timestamp: "2024-01-01", symbol: "BND", shares: 10, pricePerShare: 100 }),
      txn({
        id: "s2",
        timestamp: "2024-06-01",
        symbol: "BND",
        kind: "sell",
        shares: 10,
        pricePerShare: 80,
      }),
      txn({ id: "b3", timestamp: "2024-06-10", symbol: "BND", shares: 10, pricePerShare: 85 }),
    ];
    const ledger = runLedger(transactions, "FIFO");
    const report = detectWashSales(transactions, ledger.realizedGains);
    expect(report.cleanHarvestCount).toBe(1);
    expect(report.violations).toHaveLength(1);
  });
});

// ─── canHarvestWithoutWashSale ────────────────────────────────────────────

describe("portfolio/washSale — canHarvestWithoutWashSale", () => {
  const history: Transaction[] = [
    txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
    txn({ id: "b2", timestamp: "2024-04-15", shares: 5, pricePerShare: 90 }),
  ];

  it("returns false when a recent buy is within 30 days of proposed sale", () => {
    expect(canHarvestWithoutWashSale(history, "VTI", "2024-05-01")).toBe(false);
  });

  it("returns true when no recent buy is within the window", () => {
    expect(canHarvestWithoutWashSale(history, "VTI", "2024-06-01")).toBe(true);
  });

  it("returns true for a symbol not in history", () => {
    expect(canHarvestWithoutWashSale(history, "BND", "2024-05-01")).toBe(true);
  });

  it("ignores sell transactions when checking", () => {
    const mixed: Transaction[] = [
      txn({ id: "b1", timestamp: "2024-01-01", shares: 10, pricePerShare: 100 }),
      txn({ id: "s1", timestamp: "2024-05-15", kind: "sell", shares: 5, pricePerShare: 80 }),
    ];
    expect(canHarvestWithoutWashSale(mixed, "VTI", "2024-05-20")).toBe(true);
  });
});

// ─── earliestSafeRepurchase ──────────────────────────────────────────────

describe("portfolio/washSale — earliestSafeRepurchase", () => {
  it("returns 31 days after the sale date", () => {
    const safe = earliestSafeRepurchase("2024-06-01");
    expect(safe).toBe("2024-07-02");
  });
  it("handles year boundary", () => {
    const safe = earliestSafeRepurchase("2024-12-15");
    expect(safe).toBe("2025-01-15");
  });
  it("returns the raw string for invalid dates", () => {
    expect(earliestSafeRepurchase("not a date")).toBe("not a date");
  });
});
