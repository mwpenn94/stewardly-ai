/**
 * Quick Quote Suggestions — server-side topic detection + ranking
 * for the AI agent to recommend the right quick-quote flow during
 * a chat conversation.
 *
 * The client-side QuickQuoteHub (pass 5) renders a static grid
 * driven by FinancialProfile fitness; this service goes the other
 * direction — given a free-form chat message and an optional saved
 * profile, return the top-N quick-quote routes the user should be
 * sent to.
 *
 * Pure (no DB, no LLM). Both the chat router and the agent ReAct
 * loop can call this without spinning up additional infrastructure.
 *
 * Pass 6 history: ships the AI/agent integration angle and bridges
 * the QuickQuoteHub from pass 5 with the existing chat pipeline.
 */

import type { FinancialProfile } from "../../../shared/financialProfile";

/** Catalog of quick quotes the chat agent knows about. Mirrors
 *  the client-side registry's shipped entries — no need to share
 *  the React side because we only need topic + route + scope. */
export interface ServerQuickQuoteEntry {
  id: string;
  title: string;
  route: string;
  category:
    | "wealth"
    | "protection"
    | "income"
    | "tax"
    | "estate"
    | "business";
  /** Substring patterns that boost this entry when found in the
   *  user's message. Lowercased; pure substring match. */
  topicKeywords: string[];
  /** Visibility scope, mirrors the client-side registry. */
  visibility: ("user" | "advisor" | "manager" | "steward")[];
  /** Profile fitness — same semantics as the client registry. */
  fitness: (profile: FinancialProfile) => number;
}

export const SERVER_QUOTE_REGISTRY: ServerQuickQuoteEntry[] = [
  {
    id: "wealth-comparison",
    title: "Wealth Strategy Quick Quote",
    route: "/wealth-engine/quick-quote",
    category: "wealth",
    topicKeywords: [
      "wealth",
      "compare",
      "strategy",
      "advisor",
      "wealthbridge",
      "proposal",
      "projection",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.9,
  },
  {
    id: "holistic-comparison",
    title: "Holistic Comparison",
    route: "/wealth-engine/holistic-comparison",
    category: "wealth",
    topicKeywords: [
      "do nothing",
      "vs",
      "side by side",
      "alternative",
      "compare strategy",
      "what if",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => (p.age !== undefined && p.income !== undefined ? 1 : 0.4),
  },
  {
    id: "business-income",
    title: "Business Income Quick Quote",
    route: "/wealth-engine/business-income-quote",
    category: "business",
    topicKeywords: [
      "practice",
      "gdc",
      "production",
      "team",
      "override",
      "rvp",
      "managing director",
      "advisor income",
      "biz",
      "business income",
      "associate",
      "director",
    ],
    visibility: ["advisor", "manager", "steward"],
    fitness: (p) =>
      p.isBizOwner || p.businessRole || p.businessRevenue ? 1 : 0.2,
  },
  {
    id: "retirement-goal",
    title: "Retirement Quick Quote",
    route: "/wealth-engine/retirement",
    category: "income",
    topicKeywords: [
      "retire",
      "retirement",
      "401k",
      "ira",
      "withdrawal",
      "pension",
      "decumulation",
      "monte carlo",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      if (age >= 30 && age <= 65) return 1;
      return 0.6;
    },
  },
  {
    id: "iul-projection",
    title: "IUL Quick Quote",
    route: "/calculators",
    category: "protection",
    topicKeywords: [
      "iul",
      "indexed universal life",
      "permanent life",
      "cash value",
      "life insurance",
      "death benefit",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const age = p.age ?? 0;
      return age >= 25 && age <= 60 ? 0.9 : 0.5;
    },
  },
  {
    id: "premium-finance",
    title: "Premium Finance Quote",
    route: "/calculators",
    category: "protection",
    topicKeywords: [
      "premium finance",
      "leverage",
      "loan",
      "high net worth",
      "hnw",
      "premfin",
      "collateral",
    ],
    visibility: ["advisor", "manager", "steward"],
    fitness: (p) => {
      const nw = p.netWorth ?? 0;
      const inc = p.income ?? 0;
      return nw >= 1_000_000 || inc >= 250_000 ? 1 : 0.3;
    },
  },
  {
    id: "tax-projection",
    title: "Tax Projection",
    route: "/tax-planning",
    category: "tax",
    topicKeywords: [
      "tax",
      "marginal rate",
      "bracket",
      "roth",
      "conversion",
      "deduction",
      "itemized",
      "filing",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const inc = p.income ?? 0;
      return inc >= 100_000 ? 1 : 0.5;
    },
  },
  {
    id: "social-security",
    title: "Social Security Optimizer",
    route: "/financial-planning",
    category: "income",
    topicKeywords: [
      "social security",
      "ssa",
      "fra",
      "claiming",
      "spousal benefit",
      "benefit",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => ((p.age ?? 0) >= 55 ? 1 : 0.4),
  },
  {
    id: "estate-planning",
    title: "Estate Quick Quote",
    route: "/estate",
    category: "estate",
    topicKeywords: [
      "estate",
      "trust",
      "will",
      "beneficiary",
      "estate tax",
      "inherit",
      "gifting",
      "intestate",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const nw = p.netWorth ?? 0;
      if (nw >= 5_000_000) return 1;
      if (nw >= 1_000_000) return 0.8;
      return 0.4;
    },
  },
  {
    id: "529-quote",
    title: "529 Plan Quote",
    route: "/calculators",
    category: "income",
    topicKeywords: [
      "529",
      "college",
      "education",
      "tuition",
      "child savings",
      "education funding",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => (p.dependents !== undefined && p.dependents > 0 ? 0.9 : 0.2),
  },
  {
    id: "charitable-giving",
    title: "Charitable Giving",
    route: "/calculators",
    category: "tax",
    topicKeywords: [
      "donate",
      "donation",
      "charitable",
      "giving",
      "daf",
      "charitable trust",
      "philanthropy",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: (p) => {
      const inc = p.income ?? 0;
      const mr = p.marginalRate ?? 0;
      return mr >= 0.32 && inc >= 150_000 ? 0.8 : 0.4;
    },
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment",
    route: "/risk-assessment",
    category: "protection",
    topicKeywords: [
      "risk",
      "tolerance",
      "volatility",
      "drawdown",
      "horizon",
      "concentration",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.7,
  },
  {
    id: "protection-score",
    title: "Protection Score",
    route: "/financial-protection-score",
    category: "protection",
    topicKeywords: [
      "protection",
      "score",
      "gap",
      "12 dimension",
      "coverage",
      "insurance gap",
    ],
    visibility: ["user", "advisor", "manager", "steward"],
    fitness: () => 0.8,
  },
];

/**
 * Score how strongly a chat message matches an entry's topic
 * keywords. Pure substring scan, case-insensitive, returns 0..1
 * (saturating at 3 hits for normalization purposes).
 */
export function topicScore(message: string, entry: ServerQuickQuoteEntry): number {
  if (!message) return 0;
  const lower = message.toLowerCase();
  let hits = 0;
  for (const kw of entry.topicKeywords) {
    if (lower.includes(kw)) hits++;
  }
  if (hits === 0) return 0;
  return Math.min(1, hits / 3);
}

/** Combined score: 60% topic match + 40% profile fitness. */
export function combinedScore(
  message: string,
  profile: FinancialProfile,
  entry: ServerQuickQuoteEntry,
): number {
  const topic = topicScore(message, entry);
  const fitness = entry.fitness(profile);
  return topic * 0.6 + fitness * 0.4;
}

export interface QuickQuoteSuggestion {
  id: string;
  title: string;
  route: string;
  category: ServerQuickQuoteEntry["category"];
  score: number;
  reasoning: string;
}

/**
 * Top-N quick-quote suggestions for a free-form chat message,
 * ranked by combined topic + fitness score, filtered by scope.
 *
 * If `message` is empty, falls back to pure profile fitness so the
 * agent can ask "what's the best fit for this user" without a
 * specific topic.
 */
export function suggestQuickQuotes(opts: {
  message?: string;
  profile?: FinancialProfile;
  scope?: "user" | "advisor" | "manager" | "steward";
  topN?: number;
  /** Minimum combined score below which suggestions are dropped. */
  minScore?: number;
}): QuickQuoteSuggestion[] {
  const {
    message = "",
    profile = {},
    scope = "user",
    topN = 3,
    minScore = 0,
  } = opts;

  const visible = SERVER_QUOTE_REGISTRY.filter((e) =>
    e.visibility.includes(scope),
  );

  const scored = visible.map((entry, idx) => {
    const topic = topicScore(message, entry);
    const fitness = entry.fitness(profile);
    const score = message
      ? combinedScore(message, profile, entry)
      : fitness;
    return {
      id: entry.id,
      title: entry.title,
      route: entry.route,
      category: entry.category,
      score,
      reasoning: buildReasoning(topic, fitness, message, entry),
      _idx: idx,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._idx - b._idx;
  });

  return scored
    .filter((s) => s.score > minScore)
    .slice(0, topN)
    .map(({ _idx: _, ...rest }) => rest);
}

function buildReasoning(
  topic: number,
  fitness: number,
  message: string,
  entry: ServerQuickQuoteEntry,
): string {
  const parts: string[] = [];
  if (topic > 0) {
    const matched = entry.topicKeywords
      .filter((k) => message.toLowerCase().includes(k))
      .slice(0, 3);
    parts.push(`matches your message (${matched.join(", ")})`);
  }
  if (fitness >= 0.9) {
    parts.push("strong profile fit");
  } else if (fitness >= 0.6) {
    parts.push("good profile fit");
  } else if (fitness > 0) {
    parts.push("partial profile fit");
  }
  if (parts.length === 0) return "general recommendation";
  return parts.join(" · ");
}
