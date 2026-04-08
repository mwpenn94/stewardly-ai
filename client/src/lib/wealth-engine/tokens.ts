/**
 * WealthBridge wealth-engine design tokens.
 *
 * Single source of truth for colors, animation timings, and visual
 * patterns used by every wealth-engine React component. Matches the
 * v7 HTML palette exactly so the TypeScript port looks identical to
 * users who have seen the HTML calculators.
 *
 * Used by:
 *  - All Phase 4 React components (Retirement, TaxPlanning, etc.)
 *  - The animations module (Phase 4D) for consistent spring configs
 *  - The PDF report templates (Phase 5A) for chart image rendering
 */

export const chartTokens = {
  colors: {
    // Brand
    wealthbridge: "#16A34A", // WB green — primary strategy + winner
    gold: "#C9A84C", // accent (highlights, milestones)
    navy: "#0B1D3A", // primary background (presentation mode)

    // Practice income — always visually distinct from market/portfolio
    practiceIncome: "#0891B2", // teal

    // Strategy colors from v7 HTML (Company-Plan mapping)
    strategies: {
      wealthbridge: "#16A34A",
      captivemutual: "#1E40AF",
      wirehouse: "#2563EB",
      ria: "#7C3AED",
      communitybd: "#0891B2",
      diy: "#64748B",
      donothing: "#DC2626",
      bestoverall: "#F59E0B",
    },

    // Semantic
    positive: "#16A34A",
    warning: "#F59E0B",
    danger: "#DC2626",
    neutral: "#64748B",

    // Monte Carlo band overlays (lighter for p25/p75, lightest for p10/p90)
    monteCarloBand: {
      core: "rgba(22, 163, 74, 0.25)", // p25-p75
      outer: "rgba(22, 163, 74, 0.10)", // p10-p90
      median: "#16A34A",
    },
  },

  animation: {
    // Durations (ms)
    fast: 200, // hover, slider response
    medium: 500, // chart transitions, toggles
    slow: 1200, // initial draw, Monte Carlo fan
    countUp: 800, // number rolls to target

    // Framer Motion spring presets
    spring: {
      soft: { type: "spring" as const, stiffness: 120, damping: 20 },
      crisp: { type: "spring" as const, stiffness: 170, damping: 26 },
      bouncy: { type: "spring" as const, stiffness: 220, damping: 14 },
    },

    // Stagger presets for list entrance
    stagger: {
      fast: 0.03,
      medium: 0.08,
      slow: 0.14,
    },
  },

  patterns: {
    // SVG crosshatch pattern def for practice income slices. Consumed
    // via <defs><pattern id={patterns.practiceIncomeId}>...</pattern></defs>
    practiceIncomeId: "wb-practice-income-hatch",
    practiceIncomeStroke: "#0891B2",
    practiceIncomeStrokeWidth: 1.5,
    practiceIncomeSpacing: 6,
  },

  typography: {
    // Tabular numerals for chart labels so the digits line up
    numericFont: {
      fontVariantNumeric: "tabular-nums",
      fontFeatureSettings: '"tnum"',
    },
  },
} as const;

export type ChartTokens = typeof chartTokens;
