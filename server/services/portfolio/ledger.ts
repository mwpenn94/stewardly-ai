/**
 * Portfolio ledger — pure append-only transaction log with cost-basis
 * tracking, realized/unrealized P&L, and lot-level position view.
 *
 * Shipped by Pass 5 of the hybrid build loop — closes PARITY-PORT-0001
 * (portfolio accounting ledger) AND PARITY-TAX-0002 (per-lot basis
 * tracking) with one shared primitive. Goal: give the rebalancer +
 * tax projector a common source-of-truth for position + basis data
 * without requiring a database migration.
 *
 * Everything here is a PURE FUNCTION (no DB, no fetch, no wall-clock).
 * Tests run offline. The tRPC router in
 * `server/routers/portfolioLedger.ts` is a thin wrapper that accepts
 * a transaction array from the caller.
 *
 * Cost-basis methods supported:
 *   - FIFO  (first in, first out)  — IRS default
 *   - LIFO  (last in, first out)   — covered-call / trader preference
 *   - HIFO  (highest cost first)   — tax-loss harvesting optimizer
 *   - LCFO  (lowest cost first)    — charitable donation optimizer
 *   - avgCost (average cost basis) — mutual fund default
 *   - specific-lot (caller specifies which lot to sell from)
 *
 * Graceful degradation rules:
 *   - Selling more shares than held → ALLOWS partial consumption to
 *     zero, emits a `SHORT_POSITION` warning (short selling is
 *     legal; we don't block it, just flag).
 *   - Buy at negative price → clamps to 0 with warning.
 *   - Future-dated transaction → allowed (caller's choice), no warn.
 *   - Unknown symbol in sell → treated as fresh short with warning.
 *
 * Ordering: transactions are processed in the order provided. Callers
 * who care about chronology should sort by timestamp BEFORE passing
 * the array in. We don't sort internally because:
 *   (a) stable ordering is caller's responsibility, and
 *   (b) sorting on every call is O(n log n) that most callers don't
 *       need (they already have sorted data from the DB).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type TxnKind = "buy" | "sell" | "dividend" | "split" | "transfer_in" | "transfer_out";

export type CostBasisMethod =
  | "FIFO"
  | "LIFO"
  | "HIFO"
  | "LCFO"
  | "avgCost"
  | "specific";

export interface Transaction {
  /** Stable txn id — used by `specific` method + audit trail. */
  id: string;
  /** Ticker / CUSIP / sleeve key — matches Holding.id in rebalancing.ts. */
  symbol: string;
  /** Append-only timestamp. Caller should sort before passing. */
  timestamp: string;
  kind: TxnKind;
  /** Positive share count. For splits, ratio is encoded in pricePerShare. */
  shares: number;
  /** Per-share cost in USD. For dividends, this is the reinvested price; for splits, the ratio multiplier. */
  pricePerShare: number;
  /** Commission or fees (positive number — added to basis on buys, subtracted from proceeds on sells). */
  feesUSD?: number;
  /** For specific-lot sells, the id of the BUY transaction being closed. */
  againstLotId?: string;
}

export interface Lot {
  /** The transaction id that opened this lot. */
  id: string;
  symbol: string;
  /** Shares still open (after any prior partial sells). */
  openShares: number;
  /** Per-share cost basis including allocated fees. */
  costPerShare: number;
  /** Acquisition timestamp. */
  acquired: string;
}

export interface RealizedGain {
  symbol: string;
  shares: number;
  proceedsUSD: number;
  costBasisUSD: number;
  gainUSD: number;
  /** Holding period from lot acquisition to sell timestamp in days. */
  holdingDays: number;
  longTerm: boolean;
  /** Lot id that was closed. */
  lotId: string;
  /** Sell txn id that closed it. */
  saleTxnId: string;
}

export interface Position {
  symbol: string;
  shares: number;
  /** Weighted avg cost across all open lots. */
  avgCostPerShare: number;
  totalCostBasis: number;
  /** Per-lot breakdown for tax-loss harvest + specific-lot sells. */
  lots: Lot[];
}

export interface LedgerResult {
  positions: Position[];
  realizedGains: RealizedGain[];
  totalRealizedGain: number;
  totalFeesPaid: number;
  warnings: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const LT_HOLDING_DAYS = 365; // >1 year = long-term

export function daysBetween(start: string, end: string): number {
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

function makeLot(txn: Transaction): Lot {
  const shares = nnz(txn.shares);
  const price = nnz(txn.pricePerShare);
  const fees = nnz(txn.feesUSD ?? 0);
  // Fees are amortized over the shares — matches IRS basis rules.
  const costPerShare = shares > 0 ? price + fees / shares : price;
  return {
    id: txn.id,
    symbol: txn.symbol,
    openShares: shares,
    costPerShare,
    acquired: txn.timestamp,
  };
}

// ─── Sort helpers per method ──────────────────────────────────────────────

function orderLotsForSell(
  lots: Lot[],
  method: CostBasisMethod,
  againstLotId: string | undefined,
): Lot[] {
  // Return a COPY sorted in the order the sell should consume them.
  const copy = [...lots];
  switch (method) {
    case "FIFO":
      return copy.sort((a, b) => a.acquired.localeCompare(b.acquired));
    case "LIFO":
      return copy.sort((a, b) => b.acquired.localeCompare(a.acquired));
    case "HIFO":
      return copy.sort(
        (a, b) => b.costPerShare - a.costPerShare || a.acquired.localeCompare(b.acquired),
      );
    case "LCFO":
      return copy.sort(
        (a, b) => a.costPerShare - b.costPerShare || a.acquired.localeCompare(b.acquired),
      );
    case "avgCost":
      // avgCost consumes proportionally — caller uses a separate path.
      return copy;
    case "specific": {
      if (!againstLotId) {
        // Fall through to FIFO when no lot id provided.
        return copy.sort((a, b) => a.acquired.localeCompare(b.acquired));
      }
      const target = copy.find((l) => l.id === againstLotId);
      if (!target) return [];
      return [target];
    }
    default:
      return copy.sort((a, b) => a.acquired.localeCompare(b.acquired));
  }
}

// ─── Main ledger ───────────────────────────────────────────────────────────

interface LedgerState {
  // symbol → open lots (chronological, caller pushes)
  lotsBySymbol: Map<string, Lot[]>;
  realized: RealizedGain[];
  totalFees: number;
  warnings: string[];
}

function emptyState(): LedgerState {
  return {
    lotsBySymbol: new Map(),
    realized: [],
    totalFees: 0,
    warnings: [],
  };
}

/**
 * Run a transaction list through the ledger using the specified
 * cost-basis method. Returns positions + realized gains + warnings.
 */
export function runLedger(
  transactions: readonly Transaction[],
  method: CostBasisMethod = "FIFO",
): LedgerResult {
  const state = emptyState();

  for (const raw of transactions) {
    if (!raw || typeof raw !== "object") {
      state.warnings.push(`Skipped non-object transaction.`);
      continue;
    }
    const shares = raw.shares;
    const price = raw.pricePerShare;
    if (!Number.isFinite(shares) || shares < 0) {
      state.warnings.push(`Transaction ${raw.id} has invalid shares (${shares}); treating as 0.`);
    }
    if (!Number.isFinite(price) || price < 0) {
      state.warnings.push(`Transaction ${raw.id} has invalid price (${price}); clamping to 0.`);
    }
    const txn: Transaction = {
      ...raw,
      shares: nnz(shares),
      pricePerShare: nnz(price),
      feesUSD: nnz(raw.feesUSD ?? 0),
    };
    state.totalFees += txn.feesUSD ?? 0;

    switch (txn.kind) {
      case "buy":
      case "transfer_in":
        applyBuy(state, txn);
        break;
      case "sell":
      case "transfer_out":
        applySell(state, txn, method);
        break;
      case "dividend":
        applyDividend(state, txn);
        break;
      case "split":
        applySplit(state, txn);
        break;
      default:
        state.warnings.push(`Unknown txn kind '${(txn as Transaction).kind}' on ${txn.id}.`);
    }
  }

  return finalize(state);
}

function applyBuy(state: LedgerState, txn: Transaction) {
  if (txn.shares <= 0) return;
  const lot = makeLot(txn);
  const list = state.lotsBySymbol.get(txn.symbol) ?? [];
  list.push(lot);
  state.lotsBySymbol.set(txn.symbol, list);
}

function applySell(
  state: LedgerState,
  txn: Transaction,
  method: CostBasisMethod,
) {
  if (txn.shares <= 0) return;
  const lots = state.lotsBySymbol.get(txn.symbol) ?? [];
  if (lots.length === 0) {
    state.warnings.push(
      `SHORT_POSITION: Sell of ${txn.shares} ${txn.symbol} on ${txn.timestamp} — no open lots.`,
    );
    return;
  }

  let remaining = txn.shares;
  const netProceedsPerShare =
    txn.pricePerShare - (txn.feesUSD ?? 0) / Math.max(txn.shares, 1);

  if (method === "avgCost") {
    // Collapse all lots into one virtual lot at the average cost,
    // consume against it, then rebuild a single residual lot.
    const totalShares = lots.reduce((s, l) => s + l.openShares, 0);
    if (totalShares === 0) {
      state.warnings.push(
        `SHORT_POSITION: avgCost sell of ${txn.symbol} with 0 open shares.`,
      );
      return;
    }
    const totalCost = lots.reduce(
      (s, l) => s + l.openShares * l.costPerShare,
      0,
    );
    const avgCost = totalCost / totalShares;
    const consumed = Math.min(totalShares, txn.shares);
    const residual = totalShares - consumed;
    const short = txn.shares - consumed;

    if (consumed > 0) {
      const holdingDays = daysBetween(
        lots[0]?.acquired ?? txn.timestamp,
        txn.timestamp,
      );
      state.realized.push({
        symbol: txn.symbol,
        shares: consumed,
        proceedsUSD: consumed * netProceedsPerShare,
        costBasisUSD: consumed * avgCost,
        gainUSD: consumed * (netProceedsPerShare - avgCost),
        holdingDays,
        longTerm: holdingDays >= LT_HOLDING_DAYS,
        lotId: lots[0]?.id ?? "avg",
        saleTxnId: txn.id,
      });
    }

    if (residual > 0) {
      const earliest = lots[0];
      state.lotsBySymbol.set(txn.symbol, [
        {
          id: `avg-${earliest?.id ?? txn.id}`,
          symbol: txn.symbol,
          openShares: residual,
          costPerShare: avgCost,
          acquired: earliest?.acquired ?? txn.timestamp,
        },
      ]);
    } else {
      state.lotsBySymbol.set(txn.symbol, []);
    }

    if (short > 0) {
      state.warnings.push(
        `SHORT_POSITION: avgCost sell of ${txn.shares} ${txn.symbol} exceeded ${totalShares} open — ${short} shares went short.`,
      );
    }
    return;
  }

  const ordered = orderLotsForSell(lots, method, txn.againstLotId);
  if (method === "specific" && ordered.length === 0) {
    state.warnings.push(
      `SPECIFIC_LOT_NOT_FOUND: txn ${txn.id} asked for lot ${txn.againstLotId} but no matching open lot.`,
    );
    return;
  }

  for (const lot of ordered) {
    if (remaining <= 0) break;
    const consumed = Math.min(lot.openShares, remaining);
    if (consumed <= 0) continue;
    const holdingDays = daysBetween(lot.acquired, txn.timestamp);
    state.realized.push({
      symbol: txn.symbol,
      shares: consumed,
      proceedsUSD: consumed * netProceedsPerShare,
      costBasisUSD: consumed * lot.costPerShare,
      gainUSD: consumed * (netProceedsPerShare - lot.costPerShare),
      holdingDays,
      longTerm: holdingDays >= LT_HOLDING_DAYS,
      lotId: lot.id,
      saleTxnId: txn.id,
    });
    lot.openShares -= consumed;
    remaining -= consumed;
  }

  // Rebuild the symbol's lot list — drop zero-share lots.
  const rebuilt = lots.filter((l) => l.openShares > 0);
  state.lotsBySymbol.set(txn.symbol, rebuilt);

  if (remaining > 0) {
    state.warnings.push(
      `SHORT_POSITION: Sell of ${txn.shares} ${txn.symbol} exceeded open lots by ${remaining} shares.`,
    );
  }
}

function applyDividend(state: LedgerState, txn: Transaction) {
  // Dividends that are reinvested create a new lot; cash dividends
  // are tracked only via totalFees accounting. We treat a dividend
  // as reinvested when shares > 0.
  if (txn.shares > 0) {
    applyBuy(state, txn);
  }
  // Cash dividends are outside the scope of this primitive — caller
  // logs them elsewhere.
}

function applySplit(state: LedgerState, txn: Transaction) {
  // For a split, pricePerShare encodes the ratio (2 = 2-for-1).
  // We multiply every open lot's openShares by the ratio and divide
  // costPerShare by the ratio.
  const ratio = nnz(txn.pricePerShare);
  if (ratio <= 0 || ratio === 1) return;
  const lots = state.lotsBySymbol.get(txn.symbol) ?? [];
  const rebuilt = lots.map((l) => ({
    ...l,
    openShares: l.openShares * ratio,
    costPerShare: l.costPerShare / ratio,
  }));
  state.lotsBySymbol.set(txn.symbol, rebuilt);
}

function finalize(state: LedgerState): LedgerResult {
  const positions: Position[] = [];
  const entries = Array.from(state.lotsBySymbol.entries()) as Array<[string, Lot[]]>;
  for (const [symbol, lots] of entries) {
    const open = lots.filter((l: Lot) => l.openShares > 0);
    if (open.length === 0) continue;
    const shares = open.reduce((s: number, l: Lot) => s + l.openShares, 0);
    const totalCost = open.reduce(
      (s: number, l: Lot) => s + l.openShares * l.costPerShare,
      0,
    );
    positions.push({
      symbol,
      shares,
      avgCostPerShare: shares > 0 ? totalCost / shares : 0,
      totalCostBasis: totalCost,
      lots: open,
    });
  }
  positions.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const totalRealized = state.realized.reduce((s, r) => s + r.gainUSD, 0);
  return {
    positions,
    realizedGains: state.realized,
    totalRealizedGain: totalRealized,
    totalFeesPaid: state.totalFees,
    warnings: state.warnings,
  };
}

// ─── Query helpers ────────────────────────────────────────────────────────

export interface MarketPrice {
  symbol: string;
  /** USD per share at the moment of valuation. */
  pricePerShare: number;
}

export interface ValuedPosition extends Position {
  marketValueUSD: number;
  unrealizedGainUSD: number;
  unrealizedGainPct: number;
}

/** Attach market values to positions. */
export function valuePositions(
  positions: readonly Position[],
  prices: readonly MarketPrice[],
): ValuedPosition[] {
  const priceMap = new Map(prices.map((p) => [p.symbol, p.pricePerShare]));
  return positions.map((p) => {
    const price = nnz(priceMap.get(p.symbol) ?? 0);
    const mv = p.shares * price;
    const gain = mv - p.totalCostBasis;
    const pct = p.totalCostBasis > 0 ? (gain / p.totalCostBasis) * 100 : 0;
    return {
      ...p,
      marketValueUSD: mv,
      unrealizedGainUSD: gain,
      unrealizedGainPct: pct,
    };
  });
}

/** Separate realized gains into ST vs LT. */
export function splitRealized(
  realized: readonly RealizedGain[],
): { shortTerm: number; longTerm: number } {
  let st = 0;
  let lt = 0;
  for (const r of realized) {
    if (r.longTerm) lt += r.gainUSD;
    else st += r.gainUSD;
  }
  return { shortTerm: st, longTerm: lt };
}

/** Pick the best lots to harvest for loss-taking (sorted by gain asc). */
export function lossHarvestCandidates(
  positions: readonly ValuedPosition[],
  minLossUSD = 100,
): Array<{
  symbol: string;
  lotId: string;
  shares: number;
  costBasis: number;
  marketValue: number;
  loss: number;
}> {
  const candidates: Array<{
    symbol: string;
    lotId: string;
    shares: number;
    costBasis: number;
    marketValue: number;
    loss: number;
  }> = [];
  for (const p of positions) {
    const pxPerShare = p.shares > 0 ? p.marketValueUSD / p.shares : 0;
    for (const lot of p.lots) {
      const mv = lot.openShares * pxPerShare;
      const cb = lot.openShares * lot.costPerShare;
      const gain = mv - cb;
      if (gain <= -minLossUSD) {
        candidates.push({
          symbol: p.symbol,
          lotId: lot.id,
          shares: lot.openShares,
          costBasis: cb,
          marketValue: mv,
          loss: gain,
        });
      }
    }
  }
  candidates.sort((a, b) => a.loss - b.loss);
  return candidates;
}
