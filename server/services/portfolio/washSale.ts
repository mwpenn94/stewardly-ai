/**
 * Wash sale detector — IRS §1091 rule edge-case analyzer.
 *
 * Shipped by Pass 9 of the hybrid build loop — PARITY-REBAL-0004
 * (discovered gap during Pass 2/5 — the rebalancer + ledger close
 * losses without checking the 30-day wash sale window).
 *
 * Rule summary (simplified for advisor-facing use):
 *
 *   A wash sale occurs when a taxpayer sells a security at a LOSS
 *   and within 30 days BEFORE OR AFTER the sale, purchases a
 *   SUBSTANTIALLY IDENTICAL security. The disallowed loss is
 *   added to the basis of the replacement shares.
 *
 * Our implementation covers the common case:
 *   - Same ticker = substantially identical.
 *   - Different tickers = NOT substantially identical (the IRS
 *     definition is fuzzier for mutual funds / ETFs tracking the
 *     same index; we defer that to the advisor's judgment).
 *   - Replacement share count up to the size of the loss sale.
 *
 * Everything is a PURE FUNCTION — takes a sorted transaction list
 * plus a set of realized gain rows from the ledger and returns a
 * WashSaleReport. No DB. No fetch.
 */

import type { Transaction, RealizedGain } from "./ledger";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WashSaleViolation {
  /** Sell transaction id that created the disallowed loss. */
  saleTxnId: string;
  /** Symbol sold. */
  symbol: string;
  /** Date of the loss sale. */
  saleDate: string;
  /** Loss amount (negative number). */
  lossUSD: number;
  /** Replacement buy transaction id(s) triggering the wash sale. */
  replacementTxnIds: string[];
  /** Date(s) of the replacement purchases. */
  replacementDates: string[];
  /** Disallowed portion of the loss (positive number — added to basis). */
  disallowedUSD: number;
  /** Remaining allowable loss after the disallowed portion is removed. */
  allowedLossUSD: number;
  /** Human reason string. */
  reason: string;
}

export interface WashSaleReport {
  violations: WashSaleViolation[];
  totalDisallowedUSD: number;
  /** Count of losses that escaped the wash rule (clean harvests). */
  cleanHarvestCount: number;
  /** Detail report for audit — including losses that were NOT violations. */
  analyzedLosses: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const WASH_WINDOW_DAYS = 30;

function daysBetweenAbs(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / DAY_MS;
}

function isBuyKind(t: Transaction): boolean {
  return t.kind === "buy" || t.kind === "transfer_in" || t.kind === "dividend";
}

// ─── Main detector ─────────────────────────────────────────────────────────

/**
 * Scan realized gains for wash sale violations. Each loss is matched
 * against every BUY (same symbol) within ±30 days; if one exists, the
 * loss is disallowed up to the smaller of (loss size, replacement
 * shares). Multiple replacement buys stack.
 *
 * The function is O(gains × transactions) which is fine for the
 * typical advisor portfolio size (<10,000 transactions). For very
 * large datasets a sort + two-pointer sweep would be faster — we can
 * optimize when the test fixture grows past 10k.
 */
export function detectWashSales(
  transactions: readonly Transaction[],
  realized: readonly RealizedGain[],
): WashSaleReport {
  const violations: WashSaleViolation[] = [];
  let cleanHarvestCount = 0;
  let analyzedLosses = 0;

  for (const gain of realized) {
    if (gain.gainUSD >= 0) continue; // only losses can be wash sales
    analyzedLosses += 1;

    const saleDate = findSaleDate(transactions, gain.saleTxnId);
    if (!saleDate) continue;

    // Find all BUY transactions of the same symbol within ±30 days of
    // the sale that are NOT the same txn.
    const replacements: Transaction[] = [];
    let replacementShares = 0;
    for (const txn of transactions) {
      if (!isBuyKind(txn)) continue;
      if (txn.symbol !== gain.symbol) continue;
      if (txn.id === gain.saleTxnId) continue;
      const gap = daysBetweenAbs(txn.timestamp, saleDate);
      if (gap <= WASH_WINDOW_DAYS) {
        replacements.push(txn);
        replacementShares += txn.shares;
      }
    }

    if (replacements.length === 0) {
      cleanHarvestCount += 1;
      continue;
    }

    // Disallowed portion = loss × (min(replacement shares, sold shares) / sold shares)
    const disallowedShares = Math.min(replacementShares, gain.shares);
    const disallowedRatio = gain.shares > 0 ? disallowedShares / gain.shares : 0;
    const disallowedUSD = Math.abs(gain.gainUSD) * disallowedRatio;
    const allowedLossUSD = gain.gainUSD + disallowedUSD; // gainUSD is negative

    violations.push({
      saleTxnId: gain.saleTxnId,
      symbol: gain.symbol,
      saleDate,
      lossUSD: gain.gainUSD,
      replacementTxnIds: replacements.map((r) => r.id),
      replacementDates: replacements.map((r) => r.timestamp),
      disallowedUSD,
      allowedLossUSD,
      reason: buildReason(
        gain.symbol,
        disallowedShares,
        gain.shares,
        replacements.length,
      ),
    });
  }

  const totalDisallowedUSD = violations.reduce(
    (s, v) => s + v.disallowedUSD,
    0,
  );
  return {
    violations,
    totalDisallowedUSD,
    cleanHarvestCount,
    analyzedLosses,
  };
}

function findSaleDate(
  transactions: readonly Transaction[],
  saleTxnId: string,
): string | null {
  for (const t of transactions) {
    if (t.id === saleTxnId) return t.timestamp;
  }
  return null;
}

function buildReason(
  symbol: string,
  disallowedShares: number,
  soldShares: number,
  replacementCount: number,
): string {
  const pct = soldShares > 0 ? (disallowedShares / soldShares) * 100 : 0;
  const fullOrPartial = pct >= 100 ? "full" : `partial (${pct.toFixed(0)}%)`;
  return `${fullOrPartial} wash sale — ${disallowedShares.toFixed(2)} of ${soldShares.toFixed(2)} ${symbol} shares replaced within 30 days across ${replacementCount} buy(s).`;
}

// ─── Advisor-facing helpers ───────────────────────────────────────────────

/**
 * Given a proposed sell date and symbol, return true if selling on
 * that date would be "safe" (no replacement purchases in the past
 * 30 days).
 */
export function canHarvestWithoutWashSale(
  transactions: readonly Transaction[],
  symbol: string,
  saleDate: string,
): boolean {
  for (const txn of transactions) {
    if (!isBuyKind(txn)) continue;
    if (txn.symbol !== symbol) continue;
    const gap = daysBetweenAbs(txn.timestamp, saleDate);
    if (gap <= WASH_WINDOW_DAYS) return false;
  }
  return true;
}

/**
 * Return the earliest date on which a new replacement purchase of
 * `symbol` would NOT trigger the wash rule against a loss sale on
 * `saleDate`.
 */
export function earliestSafeRepurchase(saleDate: string): string {
  const t = new Date(saleDate).getTime();
  if (!Number.isFinite(t)) return saleDate;
  const next = new Date(t + (WASH_WINDOW_DAYS + 1) * DAY_MS);
  return next.toISOString().slice(0, 10);
}
