/**
 * Life Event Detector — diffs two financial profile snapshots
 * and returns the significant life events that should trigger
 * proactive recommendations.
 *
 * Used by the QuickQuoteHub and the server-side
 * quickQuoteSuggestions pipeline. Entirely pure so it can run on
 * both client + server without additional infrastructure.
 *
 * Event taxonomy (pass 12):
 *
 *   marriage      — filingStatus transitioned to "mfj" or "mfs"
 *   divorce       — filingStatus left "mfj"/"mfs" for "single"/"hoh"
 *   new_dependent — dependents count went up by ≥1
 *   empty_nest    — dependents count went down to 0
 *   business_entry- isBizOwner transitioned false → true
 *   business_exit - isBizOwner transitioned true → false
 *   hnw_crossing  — netWorth crossed $1M, $5M, $10M upward
 *   income_spike  — income jumped ≥25%
 *   income_drop   — income fell ≥25%
 *   retirement_approach — age crossed 55 (pre-retirement planning)
 *   retirement    — age crossed retirementAge
 *   estate_exposure    — netWorth crossed the federal exemption
 *
 * Each event carries a severity tier (low/medium/high), a
 * suggested calculator route, and a short narrative the UI can
 * render above the recommendations row.
 *
 * Pass 12 history: ships gap G14 from docs/PARITY.md.
 */

import type { FinancialProfile } from "./financialProfile";

export type LifeEventKey =
  | "marriage"
  | "divorce"
  | "new_dependent"
  | "empty_nest"
  | "business_entry"
  | "business_exit"
  | "hnw_crossing"
  | "income_spike"
  | "income_drop"
  | "retirement_approach"
  | "retirement"
  | "estate_exposure";

export type LifeEventSeverity = "low" | "medium" | "high";

export interface LifeEvent {
  key: LifeEventKey;
  severity: LifeEventSeverity;
  title: string;
  description: string;
  /** Route to send the user for the relevant calculator. */
  suggestedRoute: string;
  /** Suggested quick-quote id (matches the client registry). */
  suggestedQuoteId: string;
  /** Optional numeric delta for UIs that want to show the diff. */
  delta?: number;
}

/** HNW thresholds in ascending order — each crossing upward fires. */
const HNW_THRESHOLDS = [1_000_000, 5_000_000, 10_000_000];

/** Estate exemption (2026 MFJ); adjust when sunset lands. */
const ESTATE_EXEMPTION_MFJ = 27_220_000;
const ESTATE_EXEMPTION_SINGLE = 13_610_000;

/**
 * Diff two profile snapshots and return the detected events.
 * Order matters — high-severity events are returned first so the
 * UI can truncate the list if space is tight.
 *
 * `prev` is optional — on first use (no prior profile) no events
 * fire. This keeps the initial quick-quote experience clean.
 */
export function detectLifeEvents(
  prev: FinancialProfile | null | undefined,
  next: FinancialProfile,
): LifeEvent[] {
  if (!prev) return [];

  const events: LifeEvent[] = [];

  // ── Marriage / divorce ───────────────────────────────────────────
  if (prev.filingStatus !== next.filingStatus) {
    const wasPaired =
      prev.filingStatus === "mfj" || prev.filingStatus === "mfs";
    const isPaired =
      next.filingStatus === "mfj" || next.filingStatus === "mfs";
    if (!wasPaired && isPaired) {
      events.push({
        key: "marriage",
        severity: "high",
        title: "New filing status: married",
        description:
          "Review life insurance, beneficiary designations, and joint tax bracket strategies.",
        suggestedRoute: "/wealth-engine/quick-quote",
        suggestedQuoteId: "wealth-comparison",
      });
    } else if (wasPaired && !isPaired) {
      events.push({
        key: "divorce",
        severity: "high",
        title: "Filing status changed away from married",
        description:
          "Re-run tax projection, review beneficiaries, and update estate documents.",
        suggestedRoute: "/tax-planning",
        suggestedQuoteId: "tax-projection",
      });
    }
  }

  // ── Dependents ──────────────────────────────────────────────────
  if (prev.dependents !== next.dependents) {
    const was = prev.dependents ?? 0;
    const now = next.dependents ?? 0;
    if (now > was) {
      events.push({
        key: "new_dependent",
        severity: "high",
        title: `New dependent${now - was > 1 ? "s" : ""}`,
        description:
          "Consider increasing life insurance, starting a 529, and updating beneficiary designations.",
        suggestedRoute: "/financial-protection-score",
        suggestedQuoteId: "protection-score",
        delta: now - was,
      });
    } else if (now === 0 && was > 0) {
      events.push({
        key: "empty_nest",
        severity: "medium",
        title: "Dependents dropped to zero",
        description:
          "Re-evaluate life insurance needs and redirect savings toward retirement.",
        suggestedRoute: "/wealth-engine/retirement",
        suggestedQuoteId: "retirement-goal",
      });
    }
  }

  // ── Business owner status ──────────────────────────────────────
  if (prev.isBizOwner !== next.isBizOwner) {
    if (next.isBizOwner) {
      events.push({
        key: "business_entry",
        severity: "high",
        title: "New business owner status",
        description:
          "Project practice income, evaluate retirement plans (SEP/Solo 401k), and review entity structure.",
        suggestedRoute: "/wealth-engine/business-income-quote",
        suggestedQuoteId: "business-income",
      });
    } else {
      events.push({
        key: "business_exit",
        severity: "medium",
        title: "No longer a business owner",
        description:
          "Review rollover options, succession outcome, and tax impact of the exit.",
        suggestedRoute: "/tax-planning",
        suggestedQuoteId: "tax-projection",
      });
    }
  }

  // ── HNW threshold crossings (net worth upward) ─────────────────
  if (
    typeof prev.netWorth === "number" &&
    typeof next.netWorth === "number" &&
    next.netWorth > prev.netWorth
  ) {
    for (const threshold of HNW_THRESHOLDS) {
      if (prev.netWorth < threshold && next.netWorth >= threshold) {
        events.push({
          key: "hnw_crossing",
          severity: "medium",
          title: `Net worth crossed $${(threshold / 1_000_000).toFixed(0)}M`,
          description:
            "Consider premium financing leverage and advanced estate strategies.",
          suggestedRoute: "/wealth-engine/hub",
          suggestedQuoteId: "premium-finance",
          delta: next.netWorth - prev.netWorth,
        });
      }
    }
  }

  // ── Income spike/drop ─────────────────────────────────────────
  if (
    typeof prev.income === "number" &&
    typeof next.income === "number" &&
    prev.income > 0
  ) {
    const pct = (next.income - prev.income) / prev.income;
    if (pct >= 0.25) {
      events.push({
        key: "income_spike",
        severity: "medium",
        title: `Income increased ${Math.round(pct * 100)}%`,
        description:
          "Re-run tax projection and evaluate Roth conversion windows at the new bracket.",
        suggestedRoute: "/tax-planning",
        suggestedQuoteId: "tax-projection",
        delta: next.income - prev.income,
      });
    } else if (pct <= -0.25) {
      events.push({
        key: "income_drop",
        severity: "high",
        title: `Income decreased ${Math.round(Math.abs(pct) * 100)}%`,
        description:
          "Consider Roth conversions at the lower rate, and re-run retirement projection for funding adequacy.",
        suggestedRoute: "/wealth-engine/retirement",
        suggestedQuoteId: "retirement-goal",
        delta: next.income - prev.income,
      });
    }
  }

  // ── Retirement approach / retirement ──────────────────────────
  if (
    typeof prev.age === "number" &&
    typeof next.age === "number" &&
    next.age > prev.age
  ) {
    // Crossing 55 triggers pre-retirement planning
    if (prev.age < 55 && next.age >= 55) {
      events.push({
        key: "retirement_approach",
        severity: "medium",
        title: "Pre-retirement window (age 55+)",
        description:
          "Review catch-up contributions, Social Security claiming strategies, and retirement income gap.",
        suggestedRoute: "/wealth-engine/retirement",
        suggestedQuoteId: "retirement-goal",
      });
    }
    // Crossing the user's stated retirement age fires a decumulation alert
    if (
      typeof next.retirementAge === "number" &&
      prev.age < next.retirementAge &&
      next.age >= next.retirementAge
    ) {
      events.push({
        key: "retirement",
        severity: "high",
        title: "Retirement age reached",
        description:
          "Switch from accumulation planning to decumulation: Social Security claim timing, withdrawal rate, guardrails.",
        suggestedRoute: "/financial-planning",
        suggestedQuoteId: "social-security",
      });
    }
  }

  // ── Estate exposure (net worth over federal exemption) ────────
  if (typeof next.netWorth === "number") {
    const exemption =
      next.filingStatus === "mfj"
        ? ESTATE_EXEMPTION_MFJ
        : ESTATE_EXEMPTION_SINGLE;
    const wasExposed =
      typeof prev.netWorth === "number" &&
      prev.netWorth > exemption;
    const isExposed = next.netWorth > exemption;
    if (!wasExposed && isExposed) {
      events.push({
        key: "estate_exposure",
        severity: "high",
        title: "Estate now over federal exemption",
        description:
          "Taxable estate has triggered. Review ILITs, GRATs, gifting strategies, and charitable remainder trusts.",
        suggestedRoute: "/estate",
        suggestedQuoteId: "estate-planning",
      });
    }
  }

  // High first, medium, low — stable tie-break by insertion order
  const severityRank: Record<LifeEventSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return events.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/** Short aggregate summary for the header chip. */
export function summarizeEvents(events: LifeEvent[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
  topEvent: LifeEvent | null;
} {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const e of events) {
    if (e.severity === "high") high++;
    else if (e.severity === "medium") medium++;
    else low++;
  }
  return {
    total: events.length,
    high,
    medium,
    low,
    topEvent: events[0] ?? null,
  };
}
