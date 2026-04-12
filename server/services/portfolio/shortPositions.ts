/**
 * Short-position tracker — pure extension over the Pass 5 ledger.
 *
 * Shipped by Pass 13 of the hybrid build loop — PARITY-PORT-0003
 * (discovered gap during Pass 5 build — the ledger emits
 * SHORT_POSITION warnings but doesn't actually open a short lot
 * for the caller to track. That's a problem for options and
 * hedging strategies).
 *
 * Design philosophy: ADDITIVE. The Pass 5 ledger.ts module is
 * untouched. This module parses the same Transaction[] input but
 * tracks only the SHORT side — opening short positions on
 * over-sells and closing them on subsequent buys.
 *
 * Invariants (tested):
 *   - Short cover buy against an existing short closes lots FIFO.
 *   - Over-covering a short turns into a long position (warning).
 *   - Short P&L = proceeds - cover cost (INVERSE of long).
 *   - Short lots never mix with long lots of the same symbol.
 *   - All helpers are PURE.
 */

import type {
  Transaction,
  CostBasisMethod,
  RealizedGain,
} from "./ledger";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShortLot {
  /** Original sell transaction that opened the short. */
  openTxnId: string;
  symbol: string;
  /** Still-open short shares (decrements on cover). */
  openShares: number;
  /** Per-share proceeds received when the short was opened. */
  proceedsPerShare: number;
  /** Timestamp of the opening sell. */
  opened: string;
}

export interface ShortPosition {
  symbol: string;
  shortShares: number;
  avgProceedsPerShare: number;
  totalProceeds: number;
  lots: ShortLot[];
}

export interface ShortCoverGain {
  symbol: string;
  shares: number;
  proceedsUSD: number;
  coverCostUSD: number;
  /** proceeds - cover cost (positive = short profit). */
  gainUSD: number;
  openedDate: string;
  coveredDate: string;
  holdingDays: number;
  longTerm: boolean;
  openLotId: string;
  coverTxnId: string;
}

export interface ShortLedgerResult {
  positions: ShortPosition[];
  coverGains: ShortCoverGain[];
  totalShortGain: number;
  warnings: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const LT_HOLDING_DAYS = 365;

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.floor((e - s) / DAY_MS));
}

function nnz(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return n;
}

// ─── Core ─────────────────────────────────────────────────────────────────

/**
 * Scan a transaction list for short positions.
 *
 * The algorithm is INDEPENDENT of the long-position ledger —
 * callers who need both should run this alongside `runLedger` and
 * reconcile the same symbol's results themselves.
 *
 * How we decide what's a short:
 *   1. Track "long exposure" per symbol as a running net of buys
 *      minus sells.
 *   2. When a sell takes long exposure BELOW zero, the excess shares
 *      open a short lot.
 *   3. A subsequent buy covers outstanding shorts FIFO before adding
 *      to long exposure.
 *
 * Splits are passed through to the short lot (same ratio logic).
 * Dividends are treated as buys (they cover shorts first).
 *
 * Pure function — no DB, no fetch.
 */
export function trackShortPositions(
  transactions: readonly Transaction[],
): ShortLedgerResult {
  const warnings: string[] = [];
  const longBalance = new Map<string, number>();
  const shortsBySymbol = new Map<string, ShortLot[]>();
  const coverGains: ShortCoverGain[] = [];

  for (const rawTxn of transactions) {
    if (!rawTxn || typeof rawTxn !== "object") continue;
    const txn: Transaction = {
      ...rawTxn,
      shares: nnz(rawTxn.shares),
      pricePerShare: nnz(rawTxn.pricePerShare),
    };
    // Splits encode ratio in pricePerShare and ship shares=0 — don't
    // early-return on zero shares for split kind.
    if (txn.shares <= 0 && txn.kind !== "split") continue;

    const currentLong = longBalance.get(txn.symbol) ?? 0;
    const openShorts = shortsBySymbol.get(txn.symbol) ?? [];

    switch (txn.kind) {
      case "buy":
      case "transfer_in":
      case "dividend": {
        // Covers shorts FIFO before adding to long.
        let remaining = txn.shares;
        const startedWithShorts = openShorts.length > 0;
        let localShorts = [...openShorts];
        while (remaining > 0 && localShorts.length > 0) {
          const lot = localShorts[0];
          const covered = Math.min(lot.openShares, remaining);
          const holdingDays = daysBetween(lot.opened, txn.timestamp);
          const proceedsUSD = covered * lot.proceedsPerShare;
          const coverCostUSD = covered * txn.pricePerShare;
          coverGains.push({
            symbol: txn.symbol,
            shares: covered,
            proceedsUSD,
            coverCostUSD,
            gainUSD: proceedsUSD - coverCostUSD,
            openedDate: lot.opened,
            coveredDate: txn.timestamp,
            holdingDays,
            longTerm: holdingDays >= LT_HOLDING_DAYS,
            openLotId: lot.openTxnId,
            coverTxnId: txn.id,
          });
          lot.openShares -= covered;
          remaining -= covered;
          if (lot.openShares <= 0) localShorts.shift();
        }
        shortsBySymbol.set(txn.symbol, localShorts);
        // Remaining shares go to long balance.
        if (remaining > 0) {
          longBalance.set(txn.symbol, currentLong + remaining);
          if (startedWithShorts) {
            warnings.push(
              `Buy on ${txn.symbol} at ${txn.timestamp} crossed into long exposure after covering shorts.`,
            );
          }
        }
        break;
      }
      case "sell":
      case "transfer_out": {
        const longAvailable = Math.max(0, currentLong);
        const fromLong = Math.min(longAvailable, txn.shares);
        const toShort = txn.shares - fromLong;

        longBalance.set(txn.symbol, currentLong - fromLong);

        if (toShort > 0) {
          const lot: ShortLot = {
            openTxnId: txn.id,
            symbol: txn.symbol,
            openShares: toShort,
            proceedsPerShare: txn.pricePerShare,
            opened: txn.timestamp,
          };
          const next = [...openShorts, lot];
          shortsBySymbol.set(txn.symbol, next);
          if (currentLong >= 0) {
            warnings.push(
              `Sell of ${txn.shares} ${txn.symbol} on ${txn.timestamp} opened a short position (${toShort} shares).`,
            );
          }
        }
        break;
      }
      case "split": {
        // Apply the split ratio to existing short lots.
        const ratio = txn.pricePerShare;
        if (ratio <= 0 || ratio === 1) break;
        const next = openShorts.map((l) => ({
          ...l,
          openShares: l.openShares * ratio,
          proceedsPerShare: l.proceedsPerShare / ratio,
        }));
        shortsBySymbol.set(txn.symbol, next);
        break;
      }
      default:
        // Other kinds don't affect shorts.
        break;
    }
  }

  const positions = finalizeShortPositions(shortsBySymbol);
  const totalShortGain = coverGains.reduce((s, g) => s + g.gainUSD, 0);
  return {
    positions,
    coverGains,
    totalShortGain,
    warnings,
  };
}

function finalizeShortPositions(
  map: Map<string, ShortLot[]>,
): ShortPosition[] {
  const positions: ShortPosition[] = [];
  const entries = Array.from(map.entries()) as Array<[string, ShortLot[]]>;
  for (const [symbol, lots] of entries) {
    const open = lots.filter((l: ShortLot) => l.openShares > 0);
    if (open.length === 0) continue;
    const shortShares = open.reduce((s: number, l: ShortLot) => s + l.openShares, 0);
    const totalProceeds = open.reduce(
      (s: number, l: ShortLot) => s + l.openShares * l.proceedsPerShare,
      0,
    );
    positions.push({
      symbol,
      shortShares,
      avgProceedsPerShare: shortShares > 0 ? totalProceeds / shortShares : 0,
      totalProceeds,
      lots: open,
    });
  }
  positions.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return positions;
}

/**
 * Unrealized P&L of open short positions at a given set of market
 * prices. Unlike longs, shorts make money when the price FALLS —
 * so `unrealized = (proceedsPerShare - marketPrice) * shortShares`.
 */
export interface ValuedShortPosition extends ShortPosition {
  marketPrice: number;
  marketExposure: number;
  unrealizedGainUSD: number;
}

export function valueShortPositions(
  positions: readonly ShortPosition[],
  prices: ReadonlyArray<{ symbol: string; pricePerShare: number }>,
): ValuedShortPosition[] {
  const priceMap = new Map(prices.map((p) => [p.symbol, p.pricePerShare]));
  return positions.map((p) => {
    const marketPrice = nnz(priceMap.get(p.symbol) ?? 0);
    const marketExposure = p.shortShares * marketPrice;
    const unrealized = p.shortShares * (p.avgProceedsPerShare - marketPrice);
    return {
      ...p,
      marketPrice,
      marketExposure,
      unrealizedGainUSD: unrealized,
    };
  });
}
