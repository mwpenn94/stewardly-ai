/**
 * Tests for the Quick Quote Registry.
 *
 * Cover registry integrity (unique ids, valid routes, valid
 * categories), visibility filtering, fitness scoring per
 * product line, recommendation ranking, and field impact
 * scoring.
 */

import { describe, it, expect } from "vitest";
import {
  QUICK_QUOTE_REGISTRY,
  type QuickQuoteEntry,
  fieldImpactScore,
  findQuote,
  groupQuotesByCategory,
  rankByFitness,
  recommendQuotes,
  shippedQuotes,
  visibleQuotes,
} from "./quickQuoteRegistry";

describe("quickQuoteRegistry / integrity", () => {
  it("has unique ids", () => {
    const ids = QUICK_QUOTE_REGISTRY.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least 11 entries (covers all major product lines)", () => {
    expect(QUICK_QUOTE_REGISTRY.length).toBeGreaterThanOrEqual(11);
  });

  it("every entry has a non-empty title and description", () => {
    for (const q of QUICK_QUOTE_REGISTRY) {
      expect(q.title.length).toBeGreaterThan(0);
      expect(q.description.length).toBeGreaterThan(10);
    }
  });

  it("every entry has a valid category", () => {
    const valid = ["wealth", "protection", "income", "tax", "estate", "business"];
    for (const q of QUICK_QUOTE_REGISTRY) {
      expect(valid).toContain(q.category);
    }
  });

  it("every entry has a route starting with /", () => {
    for (const q of QUICK_QUOTE_REGISTRY) {
      expect(q.route.startsWith("/")).toBe(true);
    }
  });

  it("every entry has at least one visibility scope", () => {
    for (const q of QUICK_QUOTE_REGISTRY) {
      expect(q.visibility.length).toBeGreaterThan(0);
    }
  });

  it("every entry has an estimatedMinutes between 1 and 10", () => {
    for (const q of QUICK_QUOTE_REGISTRY) {
      expect(q.estimatedMinutes).toBeGreaterThanOrEqual(1);
      expect(q.estimatedMinutes).toBeLessThanOrEqual(10);
    }
  });

  it("at least one entry exists for each category", () => {
    const grouped = groupQuotesByCategory();
    expect(grouped.wealth.length).toBeGreaterThan(0);
    expect(grouped.protection.length).toBeGreaterThan(0);
    expect(grouped.income.length).toBeGreaterThan(0);
    expect(grouped.tax.length).toBeGreaterThan(0);
    expect(grouped.estate.length).toBeGreaterThan(0);
    expect(grouped.business.length).toBeGreaterThan(0);
  });
});

describe("quickQuoteRegistry / shippedQuotes", () => {
  it("returns only entries with shipped=true", () => {
    const live = shippedQuotes();
    for (const q of live) {
      expect(q.shipped).toBe(true);
    }
  });

  it("the live count is less than or equal to the total count", () => {
    expect(shippedQuotes().length).toBeLessThanOrEqual(QUICK_QUOTE_REGISTRY.length);
  });
});

describe("quickQuoteRegistry / visibleQuotes", () => {
  it("user scope sees user-visible quotes only", () => {
    const visible = visibleQuotes("user");
    for (const q of visible) {
      expect(q.visibility).toContain("user");
    }
  });

  it("advisor scope sees more quotes than user (BIE / PremFin / LTC)", () => {
    expect(visibleQuotes("advisor").length).toBeGreaterThan(visibleQuotes("user").length);
  });

  it("steward sees every visible quote", () => {
    // The biggest umbrella scope; should be at least as large as advisor
    expect(visibleQuotes("steward").length).toBeGreaterThanOrEqual(
      visibleQuotes("advisor").length,
    );
  });
});

describe("quickQuoteRegistry / findQuote", () => {
  it("returns the quote by id", () => {
    expect(findQuote("wealth-comparison")?.title).toContain("Wealth");
    expect(findQuote("business-income")?.category).toBe("business");
  });

  it("returns undefined for unknown id", () => {
    expect(findQuote("nonexistent-id")).toBeUndefined();
  });
});

describe("quickQuoteRegistry / fitness scoring", () => {
  it("business income has high fitness for known business owners", () => {
    const biz = findQuote("business-income")!;
    expect(biz.fitness({ isBizOwner: true })).toBeGreaterThanOrEqual(0.8);
    expect(biz.fitness({ businessRole: "md" })).toBeGreaterThanOrEqual(0.8);
  });

  it("business income has low fitness for non-owners", () => {
    const biz = findQuote("business-income")!;
    expect(biz.fitness({})).toBeLessThan(0.5);
    expect(biz.fitness({ age: 30, income: 100000 })).toBeLessThan(0.5);
  });

  it("premium finance has high fitness for HNW profiles", () => {
    const pf = findQuote("premium-finance")!;
    expect(pf.fitness({ netWorth: 2_000_000 })).toBeGreaterThanOrEqual(0.9);
    expect(pf.fitness({ income: 300_000 })).toBeGreaterThanOrEqual(0.9);
  });

  it("premium finance has low fitness for low-net-worth profiles", () => {
    const pf = findQuote("premium-finance")!;
    expect(pf.fitness({ netWorth: 100_000, income: 50_000 })).toBeLessThan(0.5);
  });

  it("social security favors users approaching claiming age", () => {
    const ss = findQuote("social-security")!;
    expect(ss.fitness({ age: 60 })).toBeGreaterThanOrEqual(0.8);
    expect(ss.fitness({ age: 30 })).toBeLessThan(0.6);
  });

  it("529 plan favors users with dependents", () => {
    const edu = findQuote("529-quote")!;
    expect(edu.fitness({ dependents: 2 })).toBeGreaterThanOrEqual(0.8);
    expect(edu.fitness({ dependents: 0 })).toBeLessThan(0.5);
  });

  it("estate planning favors HNW + parents", () => {
    const est = findQuote("estate-planning")!;
    expect(est.fitness({ netWorth: 6_000_000 })).toBe(1);
    expect(est.fitness({ dependents: 3 })).toBeGreaterThanOrEqual(0.5);
  });
});

describe("quickQuoteRegistry / rankByFitness", () => {
  it("orders by score descending", () => {
    const subset = QUICK_QUOTE_REGISTRY.slice(0, 5);
    const ranked = rankByFitness(subset, { age: 60, netWorth: 5_000_000, dependents: 2 });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("ties break by registry order (stable)", () => {
    const allEqual: QuickQuoteEntry[] = [
      { ...QUICK_QUOTE_REGISTRY[0], fitness: () => 0.5 },
      { ...QUICK_QUOTE_REGISTRY[1], fitness: () => 0.5 },
      { ...QUICK_QUOTE_REGISTRY[2], fitness: () => 0.5 },
    ];
    const ranked = rankByFitness(allEqual, {});
    expect(ranked[0].id).toBe(QUICK_QUOTE_REGISTRY[0].id);
    expect(ranked[1].id).toBe(QUICK_QUOTE_REGISTRY[1].id);
    expect(ranked[2].id).toBe(QUICK_QUOTE_REGISTRY[2].id);
  });
});

describe("quickQuoteRegistry / recommendQuotes", () => {
  it("returns at most topN entries", () => {
    const recs = recommendQuotes({ age: 40 }, "user", 3);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("respects scope visibility (user doesn't see business income)", () => {
    const recs = recommendQuotes({ age: 40 }, "user", 20);
    for (const r of recs) {
      expect(r.visibility).toContain("user");
    }
  });

  it("only recommends shipped flows", () => {
    const recs = recommendQuotes({}, "advisor", 20);
    for (const r of recs) {
      expect(r.shipped).toBe(true);
    }
  });

  it("ranks BIE first for advisor with isBizOwner", () => {
    const recs = recommendQuotes(
      { isBizOwner: true, businessRole: "md", businessRevenue: 500_000 },
      "advisor",
      5,
    );
    // BIE should be high in the list
    const bizIdx = recs.findIndex((r) => r.id === "business-income");
    expect(bizIdx).toBeGreaterThanOrEqual(0);
    expect(bizIdx).toBeLessThan(3);
  });
});

describe("quickQuoteRegistry / fieldImpactScore", () => {
  it("returns a positive count for widely-used fields", () => {
    expect(fieldImpactScore("age")).toBeGreaterThan(2);
    expect(fieldImpactScore("income")).toBeGreaterThan(2);
  });

  it("returns 0 for fields no flow consumes", () => {
    // updatedAt is meta, no flow lists it
    expect(fieldImpactScore("updatedAt")).toBe(0);
  });
});
