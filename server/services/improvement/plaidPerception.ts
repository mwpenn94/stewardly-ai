/**
 * Plaid perception layer — Phase 7A.
 *
 * Bridges the existing `plaidProduction` service to the wealth-engine
 * agent orchestrator. Pure decision functions interpret raw Plaid
 * signals (balance changes, commission deposits, transaction patterns,
 * allocation drift) into agent-ready triggers that the orchestrator
 * can act on.
 *
 * Each `evaluate*` function is pure: it takes a snapshot pair (old vs
 * new) and returns a `PerceptionTrigger | null`. The cron job that
 * polls Plaid wraps these in calls to the orchestrator.
 */

export type PerceptionKind =
  | "balance_divergence"
  | "commission_pattern_change"
  | "large_unexpected_expense"
  | "new_401k_contribution"
  | "allocation_drift";

export interface PerceptionTrigger {
  kind: PerceptionKind;
  severity: "info" | "warn" | "urgent";
  narrative: string;
  metrics: Record<string, number>;
  recommendedAction: string;
}

// ─── Trigger 1: Balance divergence vs projection ─────────────────────────
// Fires when actual balance diverges >10% from the most recent
// projection assumption.

export interface BalanceContext {
  actualBalance: number;
  projectedBalance: number;
  thresholdPct?: number;
}

export function evaluateBalanceDivergence(
  ctx: BalanceContext,
): PerceptionTrigger | null {
  const threshold = ctx.thresholdPct ?? 0.1;
  if (ctx.projectedBalance === 0) return null;
  const delta = ctx.actualBalance - ctx.projectedBalance;
  const pct = Math.abs(delta) / Math.abs(ctx.projectedBalance);
  if (pct < threshold) return null;
  return {
    kind: "balance_divergence",
    severity: pct > 0.2 ? "urgent" : "warn",
    narrative: `Actual balance ($${ctx.actualBalance.toLocaleString()}) diverges from projected ($${ctx.projectedBalance.toLocaleString()}) by ${(pct * 100).toFixed(1)}%.`,
    metrics: {
      actual: ctx.actualBalance,
      projected: ctx.projectedBalance,
      deltaAbs: delta,
      deltaPct: pct,
    },
    recommendedAction: "Re-run holistic simulation with current balance",
  };
}

// ─── Trigger 2: Commission pattern change ────────────────────────────────
// Fires when monthly commission deposits change >25% vs trailing average.

export interface CommissionContext {
  thisMonthCommissions: number;
  trailing12MonthAvg: number;
}

export function evaluateCommissionPatternChange(
  ctx: CommissionContext,
): PerceptionTrigger | null {
  if (ctx.trailing12MonthAvg === 0) return null;
  const delta = ctx.thisMonthCommissions - ctx.trailing12MonthAvg;
  const pct = Math.abs(delta) / ctx.trailing12MonthAvg;
  if (pct < 0.25) return null;
  return {
    kind: "commission_pattern_change",
    severity: "info",
    narrative: `This month's commissions ($${ctx.thisMonthCommissions.toLocaleString()}) ${delta >= 0 ? "above" : "below"} the trailing 12-month average ($${ctx.trailing12MonthAvg.toLocaleString()}) by ${(pct * 100).toFixed(0)}%.`,
    metrics: {
      thisMonth: ctx.thisMonthCommissions,
      avg: ctx.trailing12MonthAvg,
      delta,
      deltaPct: pct,
    },
    recommendedAction: "Update BIE projection with the new run-rate",
  };
}

// ─── Trigger 3: Large unexpected expense ─────────────────────────────────
// Fires when a transaction > $5K or > 10% of monthly income hits an
// uncategorized merchant.

export interface ExpenseContext {
  amount: number;
  monthlyIncome: number;
  isCategorized: boolean;
}

export function evaluateLargeExpense(
  ctx: ExpenseContext,
): PerceptionTrigger | null {
  if (ctx.isCategorized) return null;
  const isMonthlyShare =
    ctx.monthlyIncome > 0 && ctx.amount / ctx.monthlyIncome > 0.1;
  if (ctx.amount < 5000 && !isMonthlyShare) return null;
  return {
    kind: "large_unexpected_expense",
    severity: ctx.amount > 25_000 ? "urgent" : "warn",
    narrative: `Detected an uncategorized expense of $${ctx.amount.toLocaleString()}.`,
    metrics: {
      amount: ctx.amount,
      monthlyIncome: ctx.monthlyIncome,
      pctOfMonthlyIncome: ctx.monthlyIncome > 0 ? ctx.amount / ctx.monthlyIncome : 0,
    },
    recommendedAction: "Tag the expense and update plan assumptions if recurring",
  };
}

// ─── Trigger 4: New 401k contribution ────────────────────────────────────
// Fires when a payroll-tagged contribution lands in a retirement
// account for the first time. Triggers Roth optimizer recalculation.

export interface ContributionContext {
  contributionAmount: number;
  hasExistingContributions: boolean;
}

export function evaluateNew401kContribution(
  ctx: ContributionContext,
): PerceptionTrigger | null {
  if (ctx.hasExistingContributions) return null;
  if (ctx.contributionAmount <= 0) return null;
  return {
    kind: "new_401k_contribution",
    severity: "info",
    narrative: `New 401k contribution of $${ctx.contributionAmount.toLocaleString()} detected. This changes the bracket space available for Roth conversions.`,
    metrics: { contribution: ctx.contributionAmount },
    recommendedAction: "Recalculate Roth optimizer windows",
  };
}

// ─── Trigger 5: Allocation drift ─────────────────────────────────────────
// Fires when current portfolio allocation drifts >5% from the plan's
// target allocation.

export interface AllocationContext {
  currentEquityPct: number;
  targetEquityPct: number;
}

export function evaluateAllocationDrift(
  ctx: AllocationContext,
): PerceptionTrigger | null {
  const drift = Math.abs(ctx.currentEquityPct - ctx.targetEquityPct);
  if (drift < 0.05) return null;
  return {
    kind: "allocation_drift",
    severity: drift > 0.1 ? "warn" : "info",
    narrative: `Equity allocation (${(ctx.currentEquityPct * 100).toFixed(0)}%) drifted ${(drift * 100).toFixed(0)}% from target (${(ctx.targetEquityPct * 100).toFixed(0)}%).`,
    metrics: {
      current: ctx.currentEquityPct,
      target: ctx.targetEquityPct,
      drift,
    },
    recommendedAction: "Suggest rebalancing back to target allocation",
  };
}

// ─── Composite scan ──────────────────────────────────────────────────────
// Run all 5 evaluators against a single Plaid snapshot and return all
// triggers that fired. Used by the cron job in production.

export interface PerceptionSnapshot {
  balance?: BalanceContext;
  commission?: CommissionContext;
  expense?: ExpenseContext;
  contribution?: ContributionContext;
  allocation?: AllocationContext;
}

export function scanForPerceptionTriggers(
  snapshot: PerceptionSnapshot,
): PerceptionTrigger[] {
  const out: PerceptionTrigger[] = [];
  if (snapshot.balance) {
    const t = evaluateBalanceDivergence(snapshot.balance);
    if (t) out.push(t);
  }
  if (snapshot.commission) {
    const t = evaluateCommissionPatternChange(snapshot.commission);
    if (t) out.push(t);
  }
  if (snapshot.expense) {
    const t = evaluateLargeExpense(snapshot.expense);
    if (t) out.push(t);
  }
  if (snapshot.contribution) {
    const t = evaluateNew401kContribution(snapshot.contribution);
    if (t) out.push(t);
  }
  if (snapshot.allocation) {
    const t = evaluateAllocationDrift(snapshot.allocation);
    if (t) out.push(t);
  }
  return out;
}
