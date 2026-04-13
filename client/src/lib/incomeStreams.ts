/**
 * incomeStreams.ts — Multiple Income Stream modeling for the Calculator hierarchy.
 *
 * Each stream has a source label, amount, frequency, tax treatment, growth rate,
 * and an optional pillar affinity (Plan / Protect / Grow). The roll-up functions
 * aggregate streams into a single annualIncome figure and per-pillar contribution
 * weights, which feed into the holistic scoring engine.
 *
 * Designed to be extendable for team/sub-accounts, colleagues, and org-wide use.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type TaxTreatment = "ordinary" | "self_employment" | "capital_gains" | "tax_free" | "passive" | "mixed";
export type Frequency = "annual" | "monthly" | "quarterly" | "weekly" | "biweekly";
export type PillarAffinity = "plan" | "protect" | "grow" | "mixed";

export interface IncomeStream {
  id: string;
  label: string;
  source: string; // e.g. "W-2 Employment", "1099 Contract", "Rental Property", "Dividends"
  amount: number; // per-period amount
  frequency: Frequency;
  taxTreatment: TaxTreatment;
  growthRate: number; // annual growth rate as decimal (0.03 = 3%)
  pillarAffinity: PillarAffinity;
  isActive: boolean;
  notes?: string;
}

export interface StreamRollup {
  totalAnnualIncome: number;
  totalMonthlyIncome: number;
  streams: IncomeStream[];
  byPillar: { plan: number; protect: number; grow: number };
  byTax: Record<TaxTreatment, number>;
  diversificationScore: number; // 0-3 scale
  effectiveTaxRate: number; // estimated blended rate
  projectedGrowth5yr: number; // total income in 5 years
}

export interface StreamContribution {
  streamId: string;
  label: string;
  annualAmount: number;
  pctOfTotal: number;
  pillarAffinity: PillarAffinity;
  taxEfficiency: "high" | "medium" | "low";
}

// ─── Constants ──────────────────────────────────────────────────────

const FREQUENCY_MULTIPLIER: Record<Frequency, number> = {
  annual: 1,
  monthly: 12,
  quarterly: 4,
  weekly: 52,
  biweekly: 26,
};

const TAX_RATE_ESTIMATE: Record<TaxTreatment, number> = {
  ordinary: 0.28,
  self_employment: 0.35,
  capital_gains: 0.18,
  tax_free: 0,
  passive: 0.22,
  mixed: 0.25,
};

const TAX_EFFICIENCY: Record<TaxTreatment, "high" | "medium" | "low"> = {
  tax_free: "high",
  capital_gains: "high",
  passive: "medium",
  ordinary: "medium",
  mixed: "medium",
  self_employment: "low",
};

export const SOURCE_PRESETS: { label: string; source: string; taxTreatment: TaxTreatment; pillarAffinity: PillarAffinity }[] = [
  { label: "W-2 Salary", source: "W-2 Employment", taxTreatment: "ordinary", pillarAffinity: "plan" },
  { label: "Spouse W-2", source: "W-2 Employment (Spouse)", taxTreatment: "ordinary", pillarAffinity: "plan" },
  { label: "1099 Contract", source: "1099 Contract", taxTreatment: "self_employment", pillarAffinity: "plan" },
  { label: "Business Income", source: "Business / Practice", taxTreatment: "self_employment", pillarAffinity: "grow" },
  { label: "Rental Income", source: "Rental Property", taxTreatment: "passive", pillarAffinity: "grow" },
  { label: "Dividend Income", source: "Dividends", taxTreatment: "capital_gains", pillarAffinity: "grow" },
  { label: "Interest Income", source: "Interest / Bonds", taxTreatment: "ordinary", pillarAffinity: "protect" },
  { label: "Capital Gains", source: "Long-Term Capital Gains", taxTreatment: "capital_gains", pillarAffinity: "grow" },
  { label: "Social Security", source: "Social Security", taxTreatment: "mixed", pillarAffinity: "protect" },
  { label: "Pension", source: "Pension", taxTreatment: "ordinary", pillarAffinity: "protect" },
  { label: "Annuity Income", source: "Annuity", taxTreatment: "mixed", pillarAffinity: "protect" },
  { label: "IUL Distributions", source: "IUL Policy Loans", taxTreatment: "tax_free", pillarAffinity: "grow" },
  { label: "Royalties", source: "Royalties / IP", taxTreatment: "passive", pillarAffinity: "grow" },
  { label: "Other Income", source: "Other", taxTreatment: "ordinary", pillarAffinity: "mixed" },
];

// ─── Helpers ────────────────────────────────────────────────────────

export function annualize(stream: IncomeStream): number {
  return stream.amount * FREQUENCY_MULTIPLIER[stream.frequency];
}

export function createStream(preset: typeof SOURCE_PRESETS[number], amount: number, frequency: Frequency = "annual", growthRate = 0.03): IncomeStream {
  return {
    id: `${preset.source.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
    label: preset.label,
    source: preset.source,
    amount,
    frequency,
    taxTreatment: preset.taxTreatment,
    growthRate,
    pillarAffinity: preset.pillarAffinity,
    isActive: true,
  };
}

/**
 * Build streams from a FinancialProfile's income fields.
 * This bridges the existing profile format to the multi-stream model.
 */
export function profileToStreams(profile: Record<string, any>): IncomeStream[] {
  const streams: IncomeStream[] = [];
  const n = (v: any) => (typeof v === "number" && v > 0 ? v : 0);

  if (n(profile.annualIncome ?? profile.income)) {
    streams.push(createStream(SOURCE_PRESETS[0], n(profile.annualIncome ?? profile.income), "annual", 0.03));
  }
  if (n(profile.spouseIncome)) {
    streams.push(createStream(SOURCE_PRESETS[1], n(profile.spouseIncome), "annual", 0.03));
  }
  if (n(profile.selfEmploymentIncome)) {
    streams.push(createStream(SOURCE_PRESETS[2], n(profile.selfEmploymentIncome), "annual", 0.04));
  }
  if (n(profile.rentalIncome)) {
    streams.push(createStream(SOURCE_PRESETS[4], n(profile.rentalIncome), "annual", 0.025));
  }
  if (n(profile.dividendIncome)) {
    streams.push(createStream(SOURCE_PRESETS[5], n(profile.dividendIncome), "annual", 0.02));
  }
  if (n(profile.interestIncome)) {
    streams.push(createStream(SOURCE_PRESETS[6], n(profile.interestIncome), "annual", 0.01));
  }
  if (n(profile.longTermCapGains)) {
    streams.push(createStream(SOURCE_PRESETS[7], n(profile.longTermCapGains), "annual", 0.05));
  }
  return streams;
}

// ─── Roll-up ────────────────────────────────────────────────────────

export function rollUpStreams(streams: IncomeStream[]): StreamRollup {
  const active = streams.filter(s => s.isActive);
  const totalAnnual = active.reduce((sum, s) => sum + annualize(s), 0);

  const byPillar = { plan: 0, protect: 0, grow: 0 };
  const byTax: Record<TaxTreatment, number> = {
    ordinary: 0, self_employment: 0, capital_gains: 0, tax_free: 0, passive: 0, mixed: 0,
  };

  for (const s of active) {
    const annual = annualize(s);
    if (s.pillarAffinity === "mixed") {
      byPillar.plan += annual / 3;
      byPillar.protect += annual / 3;
      byPillar.grow += annual / 3;
    } else {
      byPillar[s.pillarAffinity] += annual;
    }
    byTax[s.taxTreatment] += annual;
  }

  // Diversification score (0-3): based on number of distinct sources and pillar spread
  const distinctSources = new Set(active.map(s => s.source)).size;
  const pillarSpread = [byPillar.plan, byPillar.protect, byPillar.grow].filter(v => v > 0).length;
  const diversificationScore = Math.min(3, Math.round(
    (distinctSources >= 5 ? 1.5 : distinctSources >= 3 ? 1 : distinctSources >= 2 ? 0.5 : 0) +
    (pillarSpread === 3 ? 1.5 : pillarSpread === 2 ? 0.75 : 0)
  ));

  // Blended effective tax rate
  const weightedTaxRate = totalAnnual > 0
    ? active.reduce((sum, s) => sum + annualize(s) * TAX_RATE_ESTIMATE[s.taxTreatment], 0) / totalAnnual
    : 0;

  // 5-year projection with per-stream growth
  const projected5yr = active.reduce((sum, s) => {
    const annual = annualize(s);
    return sum + annual * Math.pow(1 + s.growthRate, 5);
  }, 0);

  return {
    totalAnnualIncome: Math.round(totalAnnual),
    totalMonthlyIncome: Math.round(totalAnnual / 12),
    streams: active,
    byPillar: {
      plan: Math.round(byPillar.plan),
      protect: Math.round(byPillar.protect),
      grow: Math.round(byPillar.grow),
    },
    byTax,
    diversificationScore,
    effectiveTaxRate: Math.round(weightedTaxRate * 100) / 100,
    projectedGrowth5yr: Math.round(projected5yr),
  };
}

/**
 * Get per-stream contribution details for the UI.
 */
export function getStreamContributions(streams: IncomeStream[]): StreamContribution[] {
  const active = streams.filter(s => s.isActive);
  const total = active.reduce((sum, s) => sum + annualize(s), 0);
  return active.map(s => {
    const annual = annualize(s);
    return {
      streamId: s.id,
      label: s.label,
      annualAmount: Math.round(annual),
      pctOfTotal: total > 0 ? Math.round(annual / total * 100) : 0,
      pillarAffinity: s.pillarAffinity,
      taxEfficiency: TAX_EFFICIENCY[s.taxTreatment],
    };
  }).sort((a, b) => b.annualAmount - a.annualAmount);
}

/**
 * Project income streams forward N years, returning per-year totals.
 */
export function projectStreams(streams: IncomeStream[], years: number): { year: number; total: number; byPillar: { plan: number; protect: number; grow: number } }[] {
  const active = streams.filter(s => s.isActive);
  const result: { year: number; total: number; byPillar: { plan: number; protect: number; grow: number } }[] = [];

  for (let y = 0; y <= years; y++) {
    const byPillar = { plan: 0, protect: 0, grow: 0 };
    let total = 0;
    for (const s of active) {
      const annual = annualize(s) * Math.pow(1 + s.growthRate, y);
      total += annual;
      if (s.pillarAffinity === "mixed") {
        byPillar.plan += annual / 3;
        byPillar.protect += annual / 3;
        byPillar.grow += annual / 3;
      } else {
        byPillar[s.pillarAffinity] += annual;
      }
    }
    result.push({
      year: y,
      total: Math.round(total),
      byPillar: { plan: Math.round(byPillar.plan), protect: Math.round(byPillar.protect), grow: Math.round(byPillar.grow) },
    });
  }
  return result;
}
