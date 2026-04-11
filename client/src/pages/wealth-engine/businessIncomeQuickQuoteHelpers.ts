/**
 * Pure (non-React) helpers for the BusinessIncomeQuickQuote page.
 *
 * Extracted into a separate module so the test suite can exercise
 * the shape-mapping logic without pulling the React component tree
 * (AppShell / wouter / etc) into node-environment vitest runs.
 *
 * The page at `./BusinessIncomeQuickQuote.tsx` re-exports these via
 * `export *` so downstream importers see a single surface.
 */

import type { FinancialProfile } from "@/stores/financialProfile";

// ─── Canonical role → preset key mapping ────────────────────────────────
// NOTE: keep in sync with server/routers/wealthEngine.ts projectBizIncome
// enum. `partner` has no preset of its own (it's inside strategicPartner).
export const ROLE_OPTIONS = [
  { key: "new", label: "New Associate", presetKey: "newAssociate" },
  { key: "exp", label: "Experienced Pro", presetKey: "experiencedPro" },
  { key: "sa", label: "Senior Associate", presetKey: "experiencedPro" },
  { key: "dir", label: "Director", presetKey: "director" },
  { key: "md", label: "Managing Director", presetKey: "md" },
  { key: "rvp", label: "Regional Vice President", presetKey: "rvp" },
  { key: "partner", label: "Strategic Partner", presetKey: "strategicPartner" },
] as const;

export type BizRoleKey = (typeof ROLE_OPTIONS)[number]["key"];

/**
 * Map the shared FinancialProfile into this page's local state shape.
 * Pure, tested separately.
 */
export function profileToBizQuickQuote(p: FinancialProfile): {
  role?: BizRoleKey;
  personalGDC?: number;
  teamSize?: number;
} {
  const out: {
    role?: BizRoleKey;
    personalGDC?: number;
    teamSize?: number;
  } = {};
  if (p.businessRole) out.role = p.businessRole;
  if (p.businessRevenue !== undefined) out.personalGDC = p.businessRevenue;
  if (p.businessEmployees !== undefined) out.teamSize = p.businessEmployees;
  return out;
}

/**
 * Translate the BIE projection payload into a compact summary.
 * The real BIE returns a rich YearResult with per-stream breakdowns;
 * this helper only needs { year, totalIncome } tuples.
 */
export function summarizeBizProjection(
  years: Array<{ year?: number; totalIncome?: number }> | undefined,
): { totalEarnings: number; peakYear: number; peakIncome: number; avgIncome: number } {
  if (!years || years.length === 0) {
    return { totalEarnings: 0, peakYear: 0, peakIncome: 0, avgIncome: 0 };
  }
  let total = 0;
  let peakYear = 0;
  let peakIncome = 0;
  for (const y of years) {
    const inc = y.totalIncome ?? 0;
    total += inc;
    if (inc > peakIncome) {
      peakIncome = inc;
      peakYear = y.year ?? 0;
    }
  }
  return {
    totalEarnings: total,
    peakYear,
    peakIncome,
    avgIncome: total / years.length,
  };
}
