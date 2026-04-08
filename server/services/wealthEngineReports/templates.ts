/**
 * WealthBridge wealth-engine report templates — Phase 5A.
 *
 * Four PDF templates as pure functions that turn engine output into
 * `ReportSection[]` arrays ready to feed into the existing
 * `pdfGenerator.generateFinancialReport()`.
 *
 *  1. Executive Summary    — 1 page (key metrics + top 3 strategies)
 *  2. Complete Financial Plan — 8-12 pages (full HE projection + bands)
 *  3. Practice Growth Plan — 4-6 pages (BIE forward + practice → wealth)
 *  4. Prospect Preview     — 2 pages (anonymized benchmarks + CTA)
 *
 * Templates are pure: no DB, no network. The orchestrator (Phase 5
 * tRPC procedure) is responsible for fetching engine outputs and
 * passing them in. This lets us unit test the section composition
 * without running a real PDF render.
 */

import {
  type SimulationSnapshot,
  type HolisticSnapshot,
  type ComparisonRow,
  type WinnersMap,
  type BIEYearResult,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
} from "../../shared/calculators";
import type { ReportSection } from "../pdfGenerator";

// ─── Shared formatters ────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmtCurrency(n);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 1: Executive Summary (1 page)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutiveSummaryInput {
  clientName: string;
  horizon: number;
  finalSnapshot: HolisticSnapshot;
  winners: WinnersMap;
  topStrategies: ComparisonRow[]; // top 3 by totalValue
}

export function buildExecutiveSummary(
  input: ExecutiveSummaryInput,
): ReportSection[] {
  const f = input.finalSnapshot;
  return [
    {
      title: "Executive Summary",
      summary: `Year ${input.horizon} headline projection for ${input.clientName}.`,
      data: {
        kind: "executive_summary",
        horizon: input.horizon,
        keyMetrics: [
          { label: "Total Value", value: fmtCompact(f.totalValue) },
          { label: "Liquid Wealth", value: fmtCompact(f.totalLiquidWealth) },
          { label: "Death Benefit", value: fmtCompact(f.productDeathBenefit) },
          { label: "Living Benefits", value: fmtCompact(f.productLivingBenefit) },
          { label: "Tax Savings (cumulative)", value: fmtCompact(f.totalTaxSavings) },
          { label: "Net Value", value: fmtCompact(f.netValue) },
          { label: "ROI", value: f.roi > 0 ? `${f.roi.toFixed(1)}x` : "—" },
        ],
        winners: Object.entries(input.winners).map(([metric, w]) => ({
          metric,
          name: w.name,
          value: fmtCompact(w.value),
        })),
        top3: input.topStrategies.slice(0, 3).map((s) => ({
          name: s.name,
          totalValue: fmtCompact(s.totalValue),
          netValue: fmtCompact(s.netValue),
          roi: s.roi > 0 ? `${s.roi.toFixed(1)}x` : "—",
        })),
      },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 2: Complete Financial Plan (8-12 pages)
// ═══════════════════════════════════════════════════════════════════════════

export interface CompletePlanInput {
  clientName: string;
  horizon: number;
  projection: HolisticSnapshot[];
  monteCarloFinal?: { p10: number; p25: number; p50: number; p75: number; p90: number };
  comparison: ComparisonRow[];
  winners: WinnersMap;
}

export function buildCompletePlan(
  input: CompletePlanInput,
): ReportSection[] {
  const final = input.projection[input.projection.length - 1];
  const sections: ReportSection[] = [
    // 1. Exec summary
    ...buildExecutiveSummary({
      clientName: input.clientName,
      horizon: input.horizon,
      finalSnapshot: final,
      winners: input.winners,
      topStrategies: input.comparison.slice(0, 3),
    }),
    // 2. Year-by-year projection
    {
      title: "Year-by-Year Projection",
      summary: `Holistic Engine projection across ${input.horizon} years.`,
      data: {
        kind: "year_by_year",
        rows: input.projection.map((s) => ({
          year: s.year,
          age: s.age,
          totalLiquidWealth: fmtCompact(s.totalLiquidWealth),
          totalProtection: fmtCompact(s.totalProtection),
          totalValue: fmtCompact(s.totalValue),
          netValue: fmtCompact(s.netValue),
        })),
      },
    },
  ];

  // 3. Monte Carlo bands
  if (input.monteCarloFinal) {
    sections.push({
      title: "Monte Carlo Confidence Bands",
      summary:
        "1,000-trial simulation with Box-Muller normal returns (15% annual std dev). Returns capped at -40% to +60% per year.",
      data: {
        kind: "monte_carlo",
        finalYear: input.horizon,
        bands: [
          { label: "p10", value: fmtCompact(input.monteCarloFinal.p10) },
          { label: "p25", value: fmtCompact(input.monteCarloFinal.p25) },
          { label: "p50 (median)", value: fmtCompact(input.monteCarloFinal.p50) },
          { label: "p75", value: fmtCompact(input.monteCarloFinal.p75) },
          { label: "p90", value: fmtCompact(input.monteCarloFinal.p90) },
        ],
      },
    });
  }

  // 4. Strategy comparison
  sections.push({
    title: "Strategy Comparison",
    summary: `WealthBridge vs the peer set at year ${input.horizon}.`,
    data: {
      kind: "strategy_comparison",
      rows: input.comparison.map((r) => ({
        name: r.name,
        totalValue: fmtCompact(r.totalValue),
        netValue: fmtCompact(r.netValue),
        roi: r.roi > 0 ? `${r.roi.toFixed(1)}x` : "—",
        totalProtection: fmtCompact(r.totalProtection),
        totalTaxSavings: fmtCompact(r.totalTaxSavings),
      })),
      winners: Object.entries(input.winners).map(([metric, w]) => ({
        metric,
        name: w.name,
      })),
    },
  });

  // 5. Methodology
  sections.push({
    title: "Methodology & Disclosures",
    summary: "How these projections were generated.",
    data: {
      kind: "methodology",
      blocks: [
        { label: "UWE", text: METHODOLOGY_DISCLOSURE.uwe },
        { label: "BIE", text: METHODOLOGY_DISCLOSURE.bie },
        { label: "HE", text: METHODOLOGY_DISCLOSURE.he },
        { label: "Monte Carlo", text: METHODOLOGY_DISCLOSURE.mc },
        { label: "Disclaimer", text: METHODOLOGY_DISCLOSURE.disclaimer },
      ],
    },
  });

  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 3: Practice Growth Plan (4-6 pages — UNIQUE)
// ═══════════════════════════════════════════════════════════════════════════

export interface PracticeGrowthInput {
  clientName: string;
  role: string;
  bizYears: BIEYearResult[];
  holisticYears: HolisticSnapshot[];
  hierarchyTimeline?: Array<{ year: number; role: string; income: number }>;
}

export function buildPracticeGrowthPlan(
  input: PracticeGrowthInput,
): ReportSection[] {
  const finalBiz = input.bizYears[input.bizYears.length - 1];
  const finalHolistic = input.holisticYears[input.holisticYears.length - 1];

  return [
    {
      title: "Practice Growth Plan",
      summary: `Practice income trajectory + personal wealth bridge for a ${input.role}.`,
      data: {
        kind: "practice_growth_overview",
        finalYear: finalBiz?.year ?? 0,
        practiceIncomeFinal: fmtCompact(finalBiz?.totalIncome ?? 0),
        cumulativePracticeIncome: fmtCompact(finalBiz?.cumulativeIncome ?? 0),
        liquidWealthFinal: fmtCompact(finalHolistic?.totalLiquidWealth ?? 0),
      },
    },
    {
      title: "Income by Track",
      data: {
        kind: "biz_track_breakdown",
        rows: input.bizYears.map((y) => ({
          year: y.year,
          totalIncome: fmtCompact(y.totalIncome),
          override: fmtCompact(y.streams.override?.income ?? 0),
          aum: fmtCompact(y.streams.aum?.income ?? 0),
          affiliateA: fmtCompact(y.streams.affA?.income ?? 0),
          affiliateB: fmtCompact(y.streams.affB?.income ?? 0),
          affiliateC: fmtCompact(y.streams.affC?.income ?? 0),
          affiliateD: fmtCompact(y.streams.affD?.income ?? 0),
          channels: fmtCompact(y.streams.channels?.income ?? 0),
        })),
      },
    },
    ...(input.hierarchyTimeline
      ? [
          {
            title: "Hierarchy Advancement Timeline",
            data: {
              kind: "hierarchy_timeline",
              rows: input.hierarchyTimeline.map((h) => ({
                year: h.year,
                role: h.role,
                income: fmtCompact(h.income),
              })),
            },
          } satisfies ReportSection,
        ]
      : []),
    {
      title: "Practice → Wealth Bridge",
      summary: "Year-by-year mapping of practice income to personal liquid wealth.",
      data: {
        kind: "practice_to_wealth",
        rows: input.holisticYears.map((y, i) => ({
          year: y.year,
          age: y.age,
          practiceIncome: fmtCompact(input.bizYears[i]?.totalIncome ?? 0),
          liquidWealth: fmtCompact(y.totalLiquidWealth),
          taxSavings: fmtCompact(y.totalTaxSavings),
        })),
      },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 4: Prospect Preview (2 pages)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProspectPreviewInput {
  prospectName?: string;
  age: number;
  income: number;
  /** Anonymized benchmark snapshot — pulled from INDUSTRY_BENCHMARKS */
}

export function buildProspectPreview(
  input: ProspectPreviewInput,
): ReportSection[] {
  return [
    {
      title: "Your Financial Snapshot vs. National Benchmarks",
      summary: `A teaser comparing where you stand against US benchmarks for age ${input.age}, income ${fmtCompact(input.income)}.`,
      data: {
        kind: "prospect_benchmarks",
        benchmarks: [
          {
            label: "National personal savings rate",
            value: `${(((INDUSTRY_BENCHMARKS.savingsRate.national ?? 0) * 100).toFixed(1))}%`,
          },
          {
            label: "Investor behavior gap",
            value: `${(((INDUSTRY_BENCHMARKS.investorBehaviorGap.gap ?? 0) * 100).toFixed(1))}%/yr`,
          },
          {
            label: "Americans without adequate life coverage",
            value: `${(((INDUSTRY_BENCHMARKS.lifeInsuranceGap.pct ?? 0) * 100).toFixed(0))}%`,
          },
          {
            label: "Americans without a will",
            value: `${(((INDUSTRY_BENCHMARKS.estatePlanningGap.pct ?? 0) * 100).toFixed(0))}%`,
          },
          {
            label: "Vanguard Advisor Alpha",
            value: `${(((INDUSTRY_BENCHMARKS.advisorAlpha.value ?? 0) * 100).toFixed(1))}%/yr`,
          },
        ],
      },
    },
    {
      title: "Start Your Personalized Plan",
      summary: "Run the full Strategy Comparison to see where WealthBridge stacks up vs every peer alternative.",
      data: {
        kind: "prospect_cta",
        nextStep: "Visit /wealth-engine/quick-quote for a 3-minute personalized snapshot.",
      },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Section enricher — adds a "client" key for the PDF generator metadata
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Helper to ensure every ReportSection has a stable shape the existing
 * pdfGenerator can render. Pure helper used by the orchestrator
 * (server/services/wealthEngineReports/generator.ts).
 */
export function withDefaults(sections: ReportSection[]): ReportSection[] {
  return sections.map((s) => ({
    ...s,
    summary: s.summary ?? "",
    data: s.data ?? {},
  }));
}

// Re-export the type the orchestrator passes through
export type WealthReportTemplate =
  | "executive_summary"
  | "complete_plan"
  | "practice_growth"
  | "prospect_preview";

// Type guard used by the tRPC procedure
export function isValidTemplate(s: string): s is WealthReportTemplate {
  return ["executive_summary", "complete_plan", "practice_growth", "prospect_preview"].includes(s);
}

// Re-export commonly-needed types for the orchestrator + tests
export type { SimulationSnapshot };
