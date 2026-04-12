/**
 * Quick Quote Registry — single catalog of every product-line
 * quick-quote flow available in the platform. The new
 * QuickQuoteHub page reads this list to render its tile grid +
 * profile-driven recommendation order, the chat router can use
 * it to suggest the most relevant flow for a given conversation
 * topic, and the agent toolset can introspect it for routing.
 *
 * Pure (non-React) so the test suite can exercise the
 * recommendation logic without pulling in AppShell + wouter.
 *
 * Pass 5 history: ships gap G6 from docs/PARITY.md.
 */

import type { FinancialProfile } from "@shared/financialProfile";

/** Product-line categories for tab grouping in the hub. */
export type QuickQuoteCategory =
  | "wealth"
  | "protection"
  | "income"
  | "tax"
  | "estate"
  | "business";

export interface QuickQuoteEntry {
  /** Stable id (used for analytics + agent routing). */
  id: string;
  /** Display title shown on the hub tile. */
  title: string;
  /** Single-sentence summary. */
  description: string;
  /** Category for tab grouping. */
  category: QuickQuoteCategory;
  /** Wouter route to the quick-quote flow. */
  route: string;
  /** Suggested icon name from lucide-react. The hub renders these. */
  icon: string;
  /** Estimated time-to-result for the user. */
  estimatedMinutes: number;
  /** Field names from FinancialProfile that this flow consumes. */
  consumesFields: (keyof FinancialProfile)[];
  /** Field names from FinancialProfile that this flow writes back. */
  producesFields: (keyof FinancialProfile)[];
  /** True if this flow is currently shipped (rendered in the hub). */
  shipped: boolean;
  /** Layer-scoped visibility — who should see this flow. */
  visibility: ("user" | "advisor" | "manager" | "steward")[];
  /**
   * Lifecycle gate: returns a 0..1 fitness score for a given profile.
   * Used by the hub to rank tiles. Returns 0 when irrelevant
   * (e.g., business income for non-owners).
   */
  fitness: (profile: FinancialProfile) => number;
}

// ─── REGISTRY ─────────────────────────────────────────────────────────────
//
// Order is intentional — the hub renders unranked tiles in this order
// when no profile is loaded. Ranked tiles use the `fitness` callback.

export const QUICK_QUOTE_REGISTRY: QuickQuoteEntry[] = [
  {
    id: "wealth-comparison",
    title: "Wealth Strategy Quick Quote",
    description: "30-year wealth projection across 7 advisor models — instant client proposal.",
    category: "wealth",
    route: "/wealth-engine/quick-quote",
    icon: "Sparkles",
    estimatedMinutes: 3,
    consumesFields: ["age", "income", "savings", "monthlySavings", "dependents", "isBizOwner", "hasHomeowner"],
    producesFields: ["age", "income", "savings", "monthlySavings", "dependents", "isBizOwner", "hasHomeowner", "lifeInsuranceCoverage"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.9, // universally relevant
  },
  {
    id: "holistic-comparison",
    title: "Holistic Comparison",
    description: "Side-by-side liquid wealth: do nothing vs WealthBridge plan, from your saved profile.",
    category: "wealth",
    route: "/wealth-engine/holistic-comparison",
    icon: "Scale",
    estimatedMinutes: 1,
    consumesFields: ["age", "income", "savings", "monthlySavings", "marginalRate"],
    producesFields: [],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => (p.age !== undefined && p.income !== undefined ? 1.0 : 0.4),
  },
  {
    id: "business-income",
    title: "Business Income Quick Quote",
    description: "Advisor 30-year BIE income projection across 7 role presets.",
    category: "business",
    route: "/wealth-engine/business-income-quote",
    icon: "Briefcase",
    estimatedMinutes: 3,
    consumesFields: ["businessRole", "businessRevenue", "businessEmployees"],
    producesFields: ["isBizOwner", "businessRole", "businessRevenue", "businessEmployees"],
    shipped: true,
    visibility: ["advisor", "manager", "steward"],
    fitness: (p) => {
      // Heavy weight when the user is a known business owner / advisor
      if (p.isBizOwner) return 1;
      if (p.businessRole) return 1;
      if (p.businessRevenue) return 1;
      return 0.2;
    },
  },
  {
    id: "retirement-goal",
    title: "Retirement Goal Quote",
    description: "Wealth-engine retirement projection — goal mode, smooth mode, or guardrails.",
    category: "income",
    route: "/wealth-engine/retirement",
    icon: "PiggyBank",
    estimatedMinutes: 2,
    consumesFields: ["age", "income", "savings", "retirementAge"],
    producesFields: ["age", "income", "savings", "retirementAge"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      // Higher fitness for users in their planning years
      const age = p.age ?? 0;
      if (age >= 30 && age <= 65) return 1;
      if (age > 65) return 0.6;
      if (age >= 25) return 0.7;
      return 0.5;
    },
  },
  {
    id: "iul-projection",
    title: "IUL Quick Quote",
    description: "Indexed universal life projection — illustrated rate, cash value, death benefit.",
    category: "protection",
    route: "/calculators",
    icon: "TrendingUp",
    estimatedMinutes: 2,
    consumesFields: ["age", "income"],
    producesFields: ["age", "lifeInsuranceCoverage"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      if (age >= 25 && age <= 60) return 0.9;
      return 0.5;
    },
  },
  {
    id: "premium-finance",
    title: "Premium Finance Quote",
    description: "Leverage analysis for HNW clients — face / premium / loan rate / collateral.",
    category: "protection",
    route: "/calculators",
    icon: "Building2",
    estimatedMinutes: 2,
    consumesFields: ["age", "income", "netWorth"],
    producesFields: [],
    shipped: true,
    visibility: ["advisor", "manager", "steward"],
    fitness: (p) => {
      const nw = p.netWorth ?? 0;
      const inc = p.income ?? 0;
      if (nw >= 1_000_000 || inc >= 250_000) return 1;
      if (nw >= 500_000) return 0.7;
      return 0.3;
    },
  },
  {
    id: "tax-projection",
    title: "Tax Projection",
    description: "Multi-year federal + state tax projection with Roth conversion analysis.",
    category: "tax",
    route: "/tax-planning",
    icon: "DollarSign",
    estimatedMinutes: 2,
    consumesFields: ["income", "filingStatus", "stateOfResidence"],
    producesFields: ["filingStatus", "stateOfResidence"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const inc = p.income ?? 0;
      if (inc >= 200_000) return 1;
      if (inc >= 100_000) return 0.8;
      return 0.5;
    },
  },
  {
    id: "social-security",
    title: "Social Security Optimizer",
    description: "Optimize claiming age — 62 vs FRA vs 70 monthly + cumulative.",
    category: "income",
    route: "/financial-planning",
    icon: "Calculator",
    estimatedMinutes: 1,
    consumesFields: ["age"],
    producesFields: [],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      if (age >= 55) return 1;
      if (age >= 50) return 0.8;
      return 0.4;
    },
  },
  {
    id: "estate-planning",
    title: "Estate Quick Quote",
    description: "Estate exposure + document checklist + beneficiary review.",
    category: "estate",
    route: "/estate",
    icon: "Briefcase",
    estimatedMinutes: 2,
    consumesFields: ["netWorth", "filingStatus", "dependents"],
    producesFields: ["estateGoal"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const nw = p.netWorth ?? 0;
      if (nw >= 5_000_000) return 1;
      if (nw >= 1_000_000) return 0.8;
      if (p.dependents !== undefined && p.dependents > 0) return 0.7;
      return 0.4;
    },
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment",
    description: "Risk tolerance + investment horizon + concentration analysis.",
    category: "protection",
    route: "/risk-assessment",
    icon: "Scale",
    estimatedMinutes: 2,
    consumesFields: ["age", "income", "netWorth"],
    producesFields: ["equitiesReturn"],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.7,
  },
  {
    id: "protection-score",
    title: "Protection Score",
    description: "12-dimension financial protection scoring with gap analysis.",
    category: "protection",
    route: "/financial-protection-score",
    icon: "Shield",
    estimatedMinutes: 2,
    consumesFields: ["age", "income", "savings", "dependents", "lifeInsuranceCoverage"],
    producesFields: [],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.8,
  },
  // Future quotes — shipped: false so they render with a "coming soon" badge.
  {
    id: "ltc-quote",
    title: "LTC Quick Quote",
    description: "Long-term care benefit pool sizing + inflation rider analysis.",
    category: "protection",
    route: "/wealth-engine/quick-quote",
    icon: "Heart",
    estimatedMinutes: 2,
    consumesFields: ["age", "marginalRate"],
    producesFields: ["hasLtc"],
    shipped: false,
    visibility: ["advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      if (age >= 50) return 0.9;
      return 0.3;
    },
  },
  {
    id: "annuity-quote",
    title: "Annuity Quote",
    description: "FIA / SPIA / DIA quote with rollup rate + withdrawal rate sensitivity.",
    category: "income",
    route: "/wealth-engine/quick-quote",
    icon: "PiggyBank",
    estimatedMinutes: 2,
    consumesFields: ["age", "savings", "retirementAge"],
    producesFields: [],
    shipped: false,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      if (age >= 55) return 0.9;
      return 0.4;
    },
  },
  {
    id: "529-quote",
    title: "529 Plan Quote",
    description: "Education funding projection across 18-year horizon.",
    category: "income",
    route: "/calculators",
    icon: "GraduationCap",
    estimatedMinutes: 2,
    consumesFields: ["dependents"],
    producesFields: [],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => (p.dependents !== undefined && p.dependents > 0 ? 0.9 : 0.2),
  },
  {
    id: "charitable-giving",
    title: "Charitable Giving",
    description: "DAF / CRT / appreciated-stock giving optimization.",
    category: "tax",
    route: "/calculators",
    icon: "HandCoins",
    estimatedMinutes: 2,
    consumesFields: ["income", "marginalRate"],
    producesFields: [],
    shipped: true,
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const inc = p.income ?? 0;
      const mr = p.marginalRate ?? 0;
      if (mr >= 0.32 && inc >= 150_000) return 0.8;
      return 0.4;
    },
  },
];

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────

/** Filter the registry by visibility scope (user / advisor / manager / steward). */
export function visibleQuotes(
  scope: "user" | "advisor" | "manager" | "steward",
): QuickQuoteEntry[] {
  return QUICK_QUOTE_REGISTRY.filter((q) => q.visibility.includes(scope));
}

/** Filter to only the shipped (live) quick quotes. */
export function shippedQuotes(entries: QuickQuoteEntry[] = QUICK_QUOTE_REGISTRY): QuickQuoteEntry[] {
  return entries.filter((q) => q.shipped);
}

/** Group quotes by category for tabbed rendering. */
export function groupQuotesByCategory(
  entries: QuickQuoteEntry[] = QUICK_QUOTE_REGISTRY,
): Record<QuickQuoteCategory, QuickQuoteEntry[]> {
  const out: Record<QuickQuoteCategory, QuickQuoteEntry[]> = {
    wealth: [],
    protection: [],
    income: [],
    tax: [],
    estate: [],
    business: [],
  };
  for (const q of entries) {
    out[q.category].push(q);
  }
  return out;
}

/** Lookup a single entry by id. */
export function findQuote(id: string): QuickQuoteEntry | undefined {
  return QUICK_QUOTE_REGISTRY.find((q) => q.id === id);
}

/**
 * Rank quick quotes by fitness against a given profile, descending.
 * Returns a stable tie-break by registry order so the top tile is
 * deterministic across renders.
 */
export function rankByFitness(
  entries: QuickQuoteEntry[],
  profile: FinancialProfile,
): Array<QuickQuoteEntry & { score: number }> {
  return entries
    .map((q, idx) => ({ ...q, score: q.fitness(profile), _idx: idx }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a._idx - b._idx;
    })
    .map(({ _idx: _, ...rest }) => rest);
}

/**
 * Pick the top-N most relevant quick quotes for a profile.
 * Returns the recommendation list the hub uses to decorate the
 * "Recommended for you" row at the top of the page.
 */
export function recommendQuotes(
  profile: FinancialProfile,
  scope: "user" | "advisor" | "manager" | "steward" = "user",
  topN = 4,
): QuickQuoteEntry[] {
  const visible = visibleQuotes(scope).filter((q) => q.shipped);
  return rankByFitness(visible, profile).slice(0, topN);
}

/**
 * Tally how many quick quotes consume each field — useful for
 * the hub to show a "completing this field unlocks N more flows"
 * hint when a field is missing.
 */
export function fieldImpactScore(
  field: keyof FinancialProfile,
  entries: QuickQuoteEntry[] = QUICK_QUOTE_REGISTRY,
): number {
  let count = 0;
  for (const q of entries) {
    if (q.shipped && q.consumesFields.includes(field)) count++;
  }
  return count;
}
