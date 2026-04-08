/**
 * Phase 5 wealth-engine reports tests — exercise the pure parts of the
 * templates / generator / audio narration / shareable links modules.
 *
 * The PDF generation itself goes through the existing pdfGenerator
 * which is already covered by its own tests; we don't re-render the
 * full PDF here, just verify the section composition is correct.
 */

import { describe, it, expect } from "vitest";

import {
  buildExecutiveSummary,
  buildCompletePlan,
  buildPracticeGrowthPlan,
  buildProspectPreview,
  withDefaults,
  isValidTemplate,
} from "./templates";
import { reportFilename } from "./generator";
import {
  applyPronunciationRules,
  buildListenToPlanScript,
  chaptersFromSections,
} from "./audioNarration";
import {
  encodeShareToken,
  decodeShareToken,
  hashPassword,
  verifyPassword,
  isExpired,
  createShareLink,
} from "./shareableLinks";
import type {
  HolisticSnapshot,
  ComparisonRow,
  WinnersMap,
  BIEYearResult,
} from "../../shared/calculators";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const fakeFinal: HolisticSnapshot = {
  year: 30,
  age: 70,
  bizIncome: 0,
  bizCost: 0,
  bizNetIncome: 0,
  bizStreams: {},
  bizTeamSize: 0,
  bizAUM: 0,
  personalIncome: 240_000,
  totalGrossIncome: 240_000,
  totalTaxes: 60_000,
  totalNetIncome: 180_000,
  annualSavingsContrib: 27_000,
  savingsBalance: 1_500_000,
  productCashValue: 350_000,
  productDeathBenefit: 1_000_000,
  productTaxSaving: 12_000,
  productLivingBenefit: 500_000,
  productLegacyValue: 1_000_000,
  productAnnualCost: 8_000,
  productExpectedValue: 0,
  productDetails: [],
  totalLiquidWealth: 1_850_000,
  totalProtection: 1_500_000,
  totalTaxSavings: 250_000,
  totalValue: 3_600_000,
  totalCost: 240_000,
  netValue: 3_360_000,
  roi: 15,
  cumulativeBizIncome: 0,
  cumulativePersonalIncome: 5_000_000,
  cumulativeTotalIncome: 5_000_000,
  cumulativeTotalCost: 240_000,
  cumulativeNetValue: 3_360_000,
};

const fakeWinners: WinnersMap = {
  totalValue: { name: "WealthBridge Plan", color: "#16A34A", value: 3_600_000 },
  netValue: { name: "WealthBridge Plan", color: "#16A34A", value: 3_360_000 },
  roi: { name: "DIY", color: "#7C3AED", value: 22 },
};

const fakeComparison: ComparisonRow[] = [
  {
    index: 0,
    name: "WealthBridge Plan",
    color: "#16A34A",
    bizIncome: 0,
    bizCumIncome: 0,
    bizTeamSize: 0,
    bizAUM: 0,
    personalProdIncome: 0,
    overrideIncome: 0,
    affiliateIncomeA: 0,
    affiliateIncomeB: 0,
    affiliateIncomeC: 0,
    affiliateIncomeD: 0,
    affiliateTotalIncome: 0,
    partnerIncome: 0,
    channelIncome: 0,
    renewalIncome: 0,
    personalIncome: 240_000,
    totalGrossIncome: 240_000,
    totalNetIncome: 180_000,
    savingsBalance: 1_500_000,
    productCashValue: 350_000,
    totalLiquidWealth: 1_850_000,
    productDeathBenefit: 1_000_000,
    productLivingBenefit: 500_000,
    totalProtection: 1_500_000,
    totalTaxSavings: 250_000,
    totalValue: 3_600_000,
    totalCost: 240_000,
    netValue: 3_360_000,
    roi: 15,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5A — templates
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 5A — wealth-engine report templates", () => {
  describe("buildExecutiveSummary", () => {
    it("returns exactly 1 section", () => {
      const sections = buildExecutiveSummary({
        clientName: "Test Client",
        horizon: 30,
        finalSnapshot: fakeFinal,
        winners: fakeWinners,
        topStrategies: fakeComparison,
      });
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe("Executive Summary");
    });

    it("includes 7 key metrics", () => {
      const sections = buildExecutiveSummary({
        clientName: "Test Client",
        horizon: 30,
        finalSnapshot: fakeFinal,
        winners: fakeWinners,
        topStrategies: fakeComparison,
      });
      const data = sections[0].data as { keyMetrics: Array<{ label: string }> };
      expect(data.keyMetrics.length).toBe(7);
    });

    it("formats values via fmtCompact (M/K shorthand)", () => {
      const sections = buildExecutiveSummary({
        clientName: "Test",
        horizon: 30,
        finalSnapshot: fakeFinal,
        winners: fakeWinners,
        topStrategies: fakeComparison,
      });
      const data = sections[0].data as { keyMetrics: Array<{ label: string; value: string }> };
      const totalValue = data.keyMetrics.find((m) => m.label === "Total Value");
      expect(totalValue?.value).toContain("M");
    });
  });

  describe("buildCompletePlan", () => {
    it("returns at least exec + projection + comparison + methodology sections", () => {
      const sections = buildCompletePlan({
        clientName: "Test",
        horizon: 30,
        projection: [fakeFinal],
        comparison: fakeComparison,
        winners: fakeWinners,
      });
      expect(sections.length).toBeGreaterThanOrEqual(4);
      const titles = sections.map((s) => s.title);
      expect(titles).toContain("Executive Summary");
      expect(titles).toContain("Year-by-Year Projection");
      expect(titles).toContain("Strategy Comparison");
      expect(titles).toContain("Methodology & Disclosures");
    });

    it("adds Monte Carlo section when bands provided", () => {
      const sections = buildCompletePlan({
        clientName: "Test",
        horizon: 30,
        projection: [fakeFinal],
        comparison: fakeComparison,
        winners: fakeWinners,
        monteCarloFinal: { p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 },
      });
      const titles = sections.map((s) => s.title);
      expect(titles).toContain("Monte Carlo Confidence Bands");
    });

    it("omits Monte Carlo section when not provided", () => {
      const sections = buildCompletePlan({
        clientName: "Test",
        horizon: 30,
        projection: [fakeFinal],
        comparison: fakeComparison,
        winners: fakeWinners,
      });
      const titles = sections.map((s) => s.title);
      expect(titles).not.toContain("Monte Carlo Confidence Bands");
    });
  });

  describe("buildPracticeGrowthPlan", () => {
    const fakeBiz: BIEYearResult[] = [
      {
        year: 1,
        streams: {
          override: { income: 50_000 },
          aum: { income: 25_000 },
        },
        totalIncome: 200_000,
        totalCost: 5_000,
        netIncome: 195_000,
        cumulativeIncome: 200_000,
        cumulativeCost: 5_000,
        cumulativeNet: 195_000,
        teamSize: 3,
        aum: 5_000_000,
        monthly: [],
      },
    ];

    it("returns sections including overview + by track + bridge", () => {
      const sections = buildPracticeGrowthPlan({
        clientName: "Test",
        role: "Director",
        bizYears: fakeBiz,
        holisticYears: [fakeFinal],
      });
      const titles = sections.map((s) => s.title);
      expect(titles).toContain("Practice Growth Plan");
      expect(titles).toContain("Income by Track");
      expect(titles).toContain("Practice → Wealth Bridge");
    });

    it("includes hierarchy section only when timeline provided", () => {
      const without = buildPracticeGrowthPlan({
        clientName: "Test",
        role: "Director",
        bizYears: fakeBiz,
        holisticYears: [fakeFinal],
      });
      expect(without.map((s) => s.title)).not.toContain(
        "Hierarchy Advancement Timeline",
      );
      const withTimeline = buildPracticeGrowthPlan({
        clientName: "Test",
        role: "Director",
        bizYears: fakeBiz,
        holisticYears: [fakeFinal],
        hierarchyTimeline: [{ year: 5, role: "MD", income: 250_000 }],
      });
      expect(withTimeline.map((s) => s.title)).toContain(
        "Hierarchy Advancement Timeline",
      );
    });
  });

  describe("buildProspectPreview", () => {
    it("returns exactly 2 sections", () => {
      const sections = buildProspectPreview({ age: 40, income: 120_000 });
      expect(sections.length).toBe(2);
    });

    it("includes 5 benchmark rows from INDUSTRY_BENCHMARKS", () => {
      const sections = buildProspectPreview({ age: 40, income: 120_000 });
      const data = sections[0].data as { benchmarks: unknown[] };
      expect(data.benchmarks.length).toBe(5);
    });
  });

  describe("withDefaults + isValidTemplate + reportFilename", () => {
    it("withDefaults fills missing summary/data", () => {
      const out = withDefaults([{ title: "T", data: undefined }] as never);
      expect(out[0].summary).toBe("");
      expect(out[0].data).toEqual({});
    });

    it("isValidTemplate accepts the 4 templates", () => {
      expect(isValidTemplate("executive_summary")).toBe(true);
      expect(isValidTemplate("complete_plan")).toBe(true);
      expect(isValidTemplate("practice_growth")).toBe(true);
      expect(isValidTemplate("prospect_preview")).toBe(true);
      expect(isValidTemplate("bogus")).toBe(false);
    });

    it("reportFilename produces a safe ISO-dated filename", () => {
      const f = reportFilename("complete_plan", "Jane Doe");
      expect(f).toMatch(/^jane_doe_complete_plan_\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5B — audio narration
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 5B — audio narration", () => {
  describe("applyPronunciationRules", () => {
    it("expands IUL acronym", () => {
      expect(applyPronunciationRules("Run an IUL projection")).toBe(
        "Run an I U L projection",
      );
    });
    it("expands LTC, AUM, GDC", () => {
      expect(applyPronunciationRules("LTC + AUM + GDC")).toBe(
        "long term care + A U M + G D C",
      );
    });
    it("expands $X.XM to natural language", () => {
      expect(applyPronunciationRules("Total: $2.5M")).toBe("Total: $2.5 million");
    });
    it("expands $X.XK to natural language", () => {
      expect(applyPronunciationRules("Saved: $200K")).toBe("Saved: $200 thousand");
    });
    it("leaves unrelated text alone", () => {
      expect(applyPronunciationRules("Hello world")).toBe("Hello world");
    });
  });

  describe("buildListenToPlanScript", () => {
    it("returns 4 chapters: intro / headline / strategy / next-steps", () => {
      const chapters = buildListenToPlanScript({
        clientName: "Jane",
        horizon: 30,
        totalValue: 3_600_000,
        liquidWealth: 1_850_000,
        netValue: 3_360_000,
        topStrategy: "WealthBridge Plan",
      });
      expect(chapters.length).toBe(4);
      expect(chapters[0].id).toBe("intro");
      expect(chapters[1].id).toBe("headline");
      expect(chapters[2].id).toBe("strategy");
      expect(chapters[3].id).toBe("next-steps");
    });

    it("formats headline with millions narration", () => {
      const chapters = buildListenToPlanScript({
        clientName: "Jane",
        horizon: 30,
        totalValue: 3_600_000,
        liquidWealth: 1_850_000,
        netValue: 3_360_000,
        topStrategy: "WealthBridge Plan",
      });
      expect(chapters[1].text).toContain("million");
    });
  });

  describe("chaptersFromSections", () => {
    it("applies pronunciation rules to each chapter", () => {
      const out = chaptersFromSections([
        { id: "a", title: "A", text: "Run an IUL projection" },
      ]);
      expect(out[0].cleaned).toBe("Run an I U L projection");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5C — shareable links
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 5C — shareable links", () => {
  describe("encode/decode round trip", () => {
    it("decodes a freshly encoded token", () => {
      const tok = {
        recordId: "abc-123",
        clientId: "client-1",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        passwordHash: null,
      };
      const encoded = encodeShareToken(tok);
      const decoded = decodeShareToken(encoded);
      expect(decoded?.recordId).toBe("abc-123");
      expect(decoded?.clientId).toBe("client-1");
    });

    it("rejects a tampered signature", () => {
      const tok = {
        recordId: "abc",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        passwordHash: null,
      };
      const encoded = encodeShareToken(tok);
      const tampered = encoded.replace(/\.[^.]+$/, ".tamperedsig");
      expect(decodeShareToken(tampered)).toBeNull();
    });

    it("returns null for malformed input", () => {
      expect(decodeShareToken("not-a-token")).toBeNull();
      expect(decodeShareToken("")).toBeNull();
    });
  });

  describe("password protection", () => {
    it("hashes consistently", () => {
      expect(hashPassword("hunter2")).toBe(hashPassword("hunter2"));
    });

    it("verifyPassword passes when token has no password", () => {
      const tok = {
        recordId: "x",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        passwordHash: null,
      };
      expect(verifyPassword(tok, undefined)).toBe(true);
    });

    it("verifyPassword fails on mismatch", () => {
      const tok = {
        recordId: "x",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        passwordHash: hashPassword("right"),
      };
      expect(verifyPassword(tok, "wrong")).toBe(false);
      expect(verifyPassword(tok, undefined)).toBe(false);
    });

    it("verifyPassword passes on correct password", () => {
      const tok = {
        recordId: "x",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        passwordHash: hashPassword("right"),
      };
      expect(verifyPassword(tok, "right")).toBe(true);
    });
  });

  describe("expiry", () => {
    it("isExpired true when past expiresAt", () => {
      expect(
        isExpired({
          recordId: "x",
          expiresAt: Math.floor(Date.now() / 1000) - 10,
          passwordHash: null,
        }),
      ).toBe(true);
    });

    it("isExpired false when in the future", () => {
      expect(
        isExpired({
          recordId: "x",
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          passwordHash: null,
        }),
      ).toBe(false);
    });
  });

  describe("createShareLink", () => {
    it("defaults to 168-hour expiry", () => {
      const link = createShareLink({ recordId: "abc" });
      const expires = (link.expiresAt.getTime() - Date.now()) / 1000 / 3600;
      expect(expires).toBeGreaterThan(167);
      expect(expires).toBeLessThan(169);
    });

    it("token round-trips through decode", () => {
      const link = createShareLink({
        recordId: "abc",
        clientId: "client-1",
        expiresInHours: 24,
        password: "open-sesame",
      });
      const decoded = decodeShareToken(link.token);
      expect(decoded?.recordId).toBe("abc");
      expect(decoded?.passwordHash).toBe(hashPassword("open-sesame"));
    });
  });
});
