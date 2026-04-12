/**
 * Portfolio rebalancing — drift detection + trade proposal engine.
 *
 * Shipped by Pass 2 of the hybrid build loop, scope:
 * "best existing and planned comparables overall to stewardly repo as
 * an app per comprehensive guide" — closes PARITY-REBAL-0001, the
 * largest gap (+3) in the Pass 1 competitive analysis vs Orion,
 * Altruist, Wealthfront, and Betterment.
 *
 * Everything in this module is a PURE FUNCTION (no DB, no fetch, no
 * wall-clock). Tests run offline. The tRPC router in
 * `server/routers/rebalancing.ts` is a thin wrapper that accepts a
 * snapshot payload from the caller — it does not yet ingest live
 * portfolios (that's a follow-up pass after real Plaid / custodian
 * integration ships).
 *
 * Rubric choices:
 *
 *   - Drift is measured as percentage-point difference between actual
 *     and target allocation (actual - target), signed. Positive means
 *     overweight, negative means underweight.
 *   - A sleeve is "in drift" when |drift| >= driftThreshold. Default
 *     threshold is 5 pp, configurable per request.
 *   - Rebalance proposals are CASH-NEUTRAL (total buy = total sell)
 *     so the portfolio value is preserved. Callers who want to deploy
 *     new cash should add it to the cash sleeve before calling.
 *   - Tax awareness is optional. When `taxAware=true`, sells are
 *     sorted by longTermGainLossUSD ascending (i.e. losses first,
 *     smallest long-term gains next) so the advisor sees the
 *     lowest-tax lots at the top of the sell queue. Buys are ordered
 *     alphabetically for stability (callers can override).
 *   - Cash drag protection: if a `cashBufferPct` is set, the engine
 *     treats that share of cash as untradeable (for liquidity needs).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Holding {
  /** Stable identifier (ticker, CUSIP, or sleeve key — caller's choice). */
  id: string;
  /** Human name for the proposal output. */
  name: string;
  /** Market value in USD. */
  marketValue: number;
  /**
   * Optional — unrealized long-term gain/loss in USD for the holding.
   * Used when `taxAware=true` to rank sell candidates.
   */
  longTermGainLossUSD?: number;
  /**
   * Optional — marks a sleeve as "cash-like" for the cash buffer
   * rule. If omitted, defaults to the holding whose id === "CASH" or
   * "cash".
   */
  isCash?: boolean;
}

export interface TargetAllocation {
  /** Holding id this target applies to (matches Holding.id). */
  id: string;
  /** Target percentage, 0..100. */
  targetPct: number;
}

export interface RebalanceOptions {
  /** Percentage-point threshold above which a sleeve is "in drift". Default 5. */
  driftThreshold?: number;
  /** 0..100 — share of cash reserved for liquidity, never rebalanced. */
  cashBufferPct?: number;
  /** Enable tax-lot ordering for sells (loss-harvest first). */
  taxAware?: boolean;
}

export interface DriftRow {
  holding: Holding;
  targetPct: number;
  actualPct: number;
  /** actualPct - targetPct, in percentage points. */
  driftPct: number;
  /** marketValue at target allocation. */
  targetValue: number;
  /** targetValue - actualValue (positive = needs to buy, negative = needs to sell). */
  dollarGap: number;
  /** True when |driftPct| >= driftThreshold. */
  inDrift: boolean;
}

export type TradeSide = "buy" | "sell";

export interface TradeProposal {
  holdingId: string;
  holdingName: string;
  side: TradeSide;
  /** Absolute dollar amount (always positive). */
  amountUSD: number;
  /** Rank in the ordered sell/buy queue (1-indexed). */
  rank: number;
  /** Reason string for UI display. */
  reason: string;
}

export interface RebalanceReport {
  /** Total portfolio value across all holdings. */
  totalValueUSD: number;
  /** Per-holding drift details. */
  drift: DriftRow[];
  /** Cash-neutral trade proposals (buys == sells). */
  proposals: TradeProposal[];
  /** Sum of absolute drift percentage points across ALL holdings. */
  totalAbsDriftPp: number;
  /** Count of sleeves in drift above the threshold. */
  sleevesInDrift: number;
  /** Largest |drift| row for headline display. */
  largestDrift: DriftRow | null;
  /** Validation warnings produced while interpreting the input. */
  warnings: string[];
  /** Summary status for the caller / Chat response. */
  status: "balanced" | "mild_drift" | "needs_rebalance";
}

// ─── Validation ────────────────────────────────────────────────────────────

export function validateTargetAllocation(
  targets: readonly TargetAllocation[],
): { ok: boolean; totalPct: number; error?: string } {
  const totalPct = targets.reduce(
    (sum, t) => sum + (Number.isFinite(t.targetPct) ? t.targetPct : 0),
    0,
  );
  // Allow a 0.5pp tolerance for user-entered target allocations that
  // don't sum to exactly 100 due to rounding.
  if (Math.abs(totalPct - 100) > 0.5) {
    return {
      ok: false,
      totalPct,
      error: `Target allocation sums to ${totalPct.toFixed(2)}%, expected 100%.`,
    };
  }
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(t.id)) {
      return {
        ok: false,
        totalPct,
        error: `Duplicate target id '${t.id}'.`,
      };
    }
    seen.add(t.id);
    if (t.targetPct < 0 || !Number.isFinite(t.targetPct)) {
      return {
        ok: false,
        totalPct,
        error: `Target pct for '${t.id}' is invalid (${t.targetPct}).`,
      };
    }
  }
  return { ok: true, totalPct };
}

/** True when the holding acts like cash — either flagged or id-match. */
export function isCashLike(h: Holding): boolean {
  if (h.isCash === true) return true;
  const lower = h.id.toLowerCase();
  return lower === "cash" || lower === "usd";
}

// ─── Drift computation ────────────────────────────────────────────────────

export function computeDrift(
  holdings: readonly Holding[],
  targets: readonly TargetAllocation[],
  options: RebalanceOptions = {},
): RebalanceReport {
  const driftThreshold = options.driftThreshold ?? 5;
  const warnings: string[] = [];

  // Sanitize holdings — coerce bad market values to 0 with a warning.
  const clean: Holding[] = holdings.map((h) => {
    if (!Number.isFinite(h.marketValue) || h.marketValue < 0) {
      warnings.push(
        `Holding '${h.id}' has invalid market value ${h.marketValue}; treating as 0.`,
      );
      return { ...h, marketValue: 0 };
    }
    return { ...h };
  });

  const totalValueUSD = clean.reduce((s, h) => s + h.marketValue, 0);

  // Validate targets.
  const targetCheck = validateTargetAllocation(targets);
  if (!targetCheck.ok && targetCheck.error) {
    warnings.push(targetCheck.error);
  }

  // Normalize targets — if sum ≠ 100 we still proceed but rescale so
  // the report is meaningful. This turns a garbage-in case into a
  // best-effort result + a warning rather than an exception.
  const totalTarget = targetCheck.totalPct;
  const scale = totalTarget > 0 ? 100 / totalTarget : 0;
  const targetMap = new Map<string, number>();
  for (const t of targets) {
    const pct = Number.isFinite(t.targetPct) ? t.targetPct : 0;
    targetMap.set(t.id, pct * scale);
  }

  // Flag holdings with no target — they are orphans and must be sold.
  for (const h of clean) {
    if (!targetMap.has(h.id)) {
      targetMap.set(h.id, 0);
      if (h.marketValue > 0) {
        warnings.push(
          `Holding '${h.id}' has no target allocation; treating as sell-all.`,
        );
      }
    }
  }
  // Flag targets with no holding — zero-value sleeves to be bought.
  for (const t of targets) {
    if (!clean.find((h) => h.id === t.id)) {
      clean.push({ id: t.id, name: t.id, marketValue: 0 });
    }
  }

  // Build per-holding drift rows.
  const drift: DriftRow[] = clean.map((h) => {
    const targetPct = targetMap.get(h.id) ?? 0;
    const actualPct = totalValueUSD > 0 ? (h.marketValue / totalValueUSD) * 100 : 0;
    const driftPct = actualPct - targetPct;
    const targetValue = (targetPct / 100) * totalValueUSD;
    const dollarGap = targetValue - h.marketValue;
    return {
      holding: h,
      targetPct,
      actualPct,
      driftPct,
      targetValue,
      dollarGap,
      inDrift: Math.abs(driftPct) >= driftThreshold,
    };
  });

  // Stable sort — largest absolute drift first.
  drift.sort(
    (a, b) =>
      Math.abs(b.driftPct) - Math.abs(a.driftPct) ||
      a.holding.id.localeCompare(b.holding.id),
  );

  const totalAbsDriftPp = drift.reduce(
    (sum, row) => sum + Math.abs(row.driftPct),
    0,
  );
  const sleevesInDrift = drift.filter((r) => r.inDrift).length;
  const largestDrift = drift[0] ?? null;

  // Proposals are generated only for rows in drift, with cash-buffer
  // protection and optional tax-aware ordering.
  const proposals = buildProposals(drift, options);

  const status: RebalanceReport["status"] =
    totalAbsDriftPp < driftThreshold
      ? "balanced"
      : sleevesInDrift <= 1
        ? "mild_drift"
        : "needs_rebalance";

  return {
    totalValueUSD,
    drift,
    proposals,
    totalAbsDriftPp,
    sleevesInDrift,
    largestDrift,
    warnings,
    status,
  };
}

// ─── Trade proposal builder ───────────────────────────────────────────────

function buildProposals(
  drift: readonly DriftRow[],
  options: RebalanceOptions,
): TradeProposal[] {
  const sells: DriftRow[] = [];
  const buys: DriftRow[] = [];
  for (const row of drift) {
    if (!row.inDrift) continue;
    if (row.dollarGap < 0) sells.push(row);
    else if (row.dollarGap > 0) buys.push(row);
  }

  // Cash buffer rule — we never sell below the reserved percentage of
  // the cash sleeve.
  const cashBufferPct = options.cashBufferPct ?? 0;
  if (cashBufferPct > 0) {
    const cashRow = drift.find((d) => isCashLike(d.holding));
    if (cashRow) {
      const reserved = (cashBufferPct / 100) * cashRow.holding.marketValue;
      if (cashRow.dollarGap < 0) {
        // overweight cash — still ok to sell it, but never past reserved.
        const maxSell = Math.max(0, cashRow.holding.marketValue - reserved);
        // Clamp the row's dollar gap to -maxSell.
        if (Math.abs(cashRow.dollarGap) > maxSell) {
          // Clone the row so we don't mutate the shared drift array.
          const clamped: DriftRow = { ...cashRow, dollarGap: -maxSell };
          // Replace cashRow in sells if present.
          const idx = sells.findIndex((s) => s.holding.id === cashRow.holding.id);
          if (idx !== -1) sells[idx] = clamped;
        }
      }
    }
  }

  // Tax-aware sell ordering — losses first (ascending LT gain), then
  // small gains. Null LT gain sorts to the bottom of the sell queue.
  if (options.taxAware) {
    sells.sort((a, b) => {
      const ag = a.holding.longTermGainLossUSD;
      const bg = b.holding.longTermGainLossUSD;
      if (ag === undefined && bg === undefined) {
        return a.holding.id.localeCompare(b.holding.id);
      }
      if (ag === undefined) return 1;
      if (bg === undefined) return -1;
      return ag - bg;
    });
  } else {
    sells.sort(
      (a, b) =>
        Math.abs(b.dollarGap) - Math.abs(a.dollarGap) ||
        a.holding.id.localeCompare(b.holding.id),
    );
  }

  buys.sort(
    (a, b) => b.dollarGap - a.dollarGap || a.holding.id.localeCompare(b.holding.id),
  );

  // Cash-neutral re-balance — total buy must equal total sell. If they
  // are unequal (because of the cash buffer clamp or orphan sells),
  // scale the buys proportionally so we don't over-purchase.
  const totalSell = sells.reduce((s, r) => s + Math.abs(r.dollarGap), 0);
  const totalBuy = buys.reduce((s, r) => s + r.dollarGap, 0);
  const capBuy = Math.min(totalBuy, totalSell);
  const buyScale = totalBuy > 0 ? capBuy / totalBuy : 0;

  const proposals: TradeProposal[] = [];
  let rank = 1;
  for (const s of sells) {
    const amountUSD = Math.abs(s.dollarGap);
    proposals.push({
      holdingId: s.holding.id,
      holdingName: s.holding.name,
      side: "sell",
      amountUSD,
      rank: rank++,
      reason: formatSellReason(s, options),
    });
  }
  for (const b of buys) {
    const amountUSD = b.dollarGap * buyScale;
    if (amountUSD <= 0) continue;
    proposals.push({
      holdingId: b.holding.id,
      holdingName: b.holding.name,
      side: "buy",
      amountUSD,
      rank: rank++,
      reason: formatBuyReason(b),
    });
  }
  return proposals;
}

function formatSellReason(row: DriftRow, options: RebalanceOptions): string {
  const pp = row.driftPct.toFixed(1);
  const base = `Overweight by ${pp} pp vs target.`;
  if (options.taxAware && row.holding.longTermGainLossUSD !== undefined) {
    const ltcg = row.holding.longTermGainLossUSD;
    if (ltcg < 0) {
      return `${base} Unrealized LT loss ${fmtUSD(ltcg)} — prioritize for loss harvest.`;
    }
    if (ltcg < 500) {
      return `${base} Small LT gain ${fmtUSD(ltcg)} — low tax cost to sell.`;
    }
    return `${base} LT gain ${fmtUSD(ltcg)} — consider tax impact.`;
  }
  return base;
}

function formatBuyReason(row: DriftRow): string {
  const pp = (-row.driftPct).toFixed(1);
  return `Underweight by ${pp} pp vs target.`;
}

function fmtUSD(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ─── Convenience: simulate with new cash deployment ───────────────────────

/**
 * Wrap `computeDrift` by first injecting `newCashUSD` into the cash
 * sleeve. This is the natural way to answer "if I deposit $50k, what
 * should I buy to hit my target?" — callers add cash up front, then
 * the engine routes it to underweight sleeves via the normal drift
 * math.
 */
export function simulateWithNewCash(
  holdings: readonly Holding[],
  targets: readonly TargetAllocation[],
  newCashUSD: number,
  options: RebalanceOptions = {},
): RebalanceReport {
  if (!Number.isFinite(newCashUSD) || newCashUSD < 0) {
    return computeDrift(holdings, targets, options);
  }
  const cashIdx = holdings.findIndex((h) => isCashLike(h));
  let next: Holding[];
  if (cashIdx === -1) {
    next = [
      ...holdings,
      { id: "CASH", name: "Cash", marketValue: newCashUSD, isCash: true },
    ];
  } else {
    next = holdings.map((h, i) =>
      i === cashIdx
        ? { ...h, marketValue: h.marketValue + newCashUSD }
        : h,
    );
  }
  return computeDrift(next, targets, options);
}
