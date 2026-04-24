/**
 * Expert Panel B — VALIDATE: Extended E2E Smoke Tests
 * =====================================================
 * Tests all Panel B optimizations (GAP-B1 through GAP-B4) plus
 * regression checks on Panel A services.
 * 
 * Virtual User Personas:
 *   Marcus Chen — Senior advisor, Pattern 4, HNW + COI funnels
 *   Elena Rodriguez — Recruiting manager, recruit + affiliate funnels
 *   David Thompson — Operations director, compliance + metrics focus
 */
import { describe, it, expect } from "vitest";

// ─── GAP-B1: Weekly Summary Generation ──────────────────────────────────

describe("Weekly Summary Generation (GAP-B1 — Prompt 8)", () => {
  it("should import generateWeeklySummary and buildStaticSummary", async () => {
    const mod = await import("./services/weeklySummaryGeneration");
    expect(typeof mod.generateWeeklySummary).toBe("function");
    expect(typeof mod.buildStaticSummary).toBe("function");
  });

  it("should build a static summary as markdown string with required sections", async () => {
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");
    const result = buildStaticSummary({
      advisorName: "Marcus Chen",
      weekStartDate: "2026-04-14",
      weekEndDate: "2026-04-20",
      headlineMetric: {
        name: "Pipeline Value",
        value: 4500000,
        unit: "USD",
        weekOverWeekChange: 12.5,
        isPositive: true,
      },
      pipelineCoverage: {
        discoveryValue: 15000000,
        solutionDesignValue: 8000000,
        validationValue: 4000000,
        commitValue: 2000000,
        targetQuotaValue: 1000000,
        coverageHealth: "healthy",
      },
      funnelSnapshots: [
        {
          funnelName: "HNW Prospect",
          leadsEntered: 12,
          leadsQualified: 8,
          leadsConverted: 2,
          conversionRate: 0.167,
          avgDaysInPipeline: 45,
          totalPipelineValue: 3200000,
          touchesSent: 48,
          repliesReceived: 14,
          replyRate: 0.292,
          meetingsBooked: 5,
        },
      ],
      complianceHealth: {
        totalTouchesSent: 48,
        touchesAudited: 4,
        auditPassRate: 1.0,
        failCount: 0,
        conditionalPassCount: 0,
        topFindings: [],
        esiExpiringThisMonth: 0,
        optOutsProcessed: 1,
      },
      variances: [
        {
          metric: "Reply Rate",
          expected: 0.25,
          actual: 0.292,
          variancePct: 16.8,
          direction: "above" as const,
          severity: "minor" as const,
        },
      ],
      actionItems: [
        {
          id: "AI-001",
          description: "Follow up with Dr. Patel on estate planning proposal",
          priority: "high" as const,
          dueDate: "2026-04-22",
          assignedTo: "Marcus Chen",
          status: "pending" as const,
        },
      ],
      nextWeekFocus: [
        "Close 2 HNW prospects in validation stage",
        "Schedule 3 new discovery meetings",
      ],
      currentPattern: "Pattern 4",
    });

    // buildStaticSummary returns a markdown string
    expect(typeof result).toBe("string");
    expect(result).toContain("Marcus Chen");
    expect(result).toContain("Pipeline Coverage");
    expect(result).toContain("HNW Prospect");
    expect(result).toContain("Headline");
    expect(result).toContain("Compliance");
  });

  it("should handle empty funnelSnapshots gracefully", async () => {
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");
    const result = buildStaticSummary({
      advisorName: "Test Advisor",
      weekStartDate: "2026-04-14",
      weekEndDate: "2026-04-20",
      headlineMetric: {
        name: "Pipeline Value",
        value: 0,
        unit: "USD",
        weekOverWeekChange: 0,
        isPositive: false,
      },
      pipelineCoverage: {
        discoveryValue: 0,
        solutionDesignValue: 0,
        validationValue: 0,
        commitValue: 0,
        targetQuotaValue: 1000000,
        coverageHealth: "critical",
      },
      funnelSnapshots: [],
      complianceHealth: {
        totalTouchesSent: 0,
        touchesAudited: 0,
        auditPassRate: 1.0,
        failCount: 0,
        conditionalPassCount: 0,
        topFindings: [],
        esiExpiringThisMonth: 0,
        optOutsProcessed: 0,
      },
      variances: [],
      actionItems: [],
      nextWeekFocus: [],
      currentPattern: "Pattern 4",
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("Test Advisor");
  });
});

// ─── GAP-B2: Cadence Variant Creation ───────────────────────────────────

describe("Cadence Variant Creation (GAP-B2 — Prompt 9)", () => {
  it("should import createCadenceVariant, validateVariant, and listBaseCadences", async () => {
    const mod = await import("./services/cadenceVariantCreation");
    expect(typeof mod.createCadenceVariant).toBe("function");
    expect(typeof mod.validateVariant).toBe("function");
    expect(typeof mod.listBaseCadences).toBe("function");
  });

  it("should list all base cadences from the cadence library", async () => {
    const { listBaseCadences } = await import("./services/cadenceVariantCreation");
    const cadences = listBaseCadences();
    expect(Array.isArray(cadences)).toBe(true);
    expect(cadences.length).toBeGreaterThanOrEqual(6);
    for (const c of cadences) {
      expect(c.cadenceId).toBeDefined();
      expect(c.name).toBeDefined();
      // listBaseCadences returns touchCount, not touches array
      expect(typeof c.touchCount).toBe("number");
      expect(c.touchCount).toBeGreaterThan(0);
    }
  });

  it("should create a geographic variant of a base cadence", async () => {
    const { createCadenceVariant, listBaseCadences } = await import("./services/cadenceVariantCreation");
    const baseCadences = listBaseCadences();
    const baseCadence = baseCadences[0];

    const variant = await createCadenceVariant({
      baseCadenceId: baseCadence.cadenceId,
      variantType: "geographic",
      variantName: `${baseCadence.name} — Arizona`,
      variantDescription: "Arizona-specific variant with ARS § 20-451 compliance overlay",
      adaptationRules: {
        geography: "Arizona",
        complianceOverlay: "ARS § 20-451 anti-rebate language required",
        toneAdjustment: "Warm, relationship-focused",
      },
    });

    expect(variant).toBeDefined();
    expect(variant.variantCadenceId).toBeDefined();
    expect(variant.baseCadenceId).toBe(baseCadence.cadenceId);
    expect(variant.variantType).toBe("geographic");
    expect(variant.touches).toBeDefined();
    expect(Array.isArray(variant.touches)).toBe(true);
    expect(variant.touches.length).toBeGreaterThan(0);
    expect(variant.complianceNotes).toBeDefined();
  }, 20000);

  it("should create a compliance variant with channel exclusions", async () => {
    const { createCadenceVariant, listBaseCadences } = await import("./services/cadenceVariantCreation");
    const baseCadences = listBaseCadences();
    const baseCadence = baseCadences[0];

    const variant = await createCadenceVariant({
      baseCadenceId: baseCadence.cadenceId,
      variantType: "compliance",
      variantName: `${baseCadence.name} — No Phone`,
      variantDescription: "Compliance variant excluding phone channel for TCPA-sensitive leads",
      adaptationRules: {
        complianceOverlay: "TCPA strict — no phone outreach",
        excludeChannels: ["phone"],
      },
    });

    expect(variant).toBeDefined();
    expect(variant.variantType).toBe("compliance");
    // Should not have phone touches
    const phoneTouch = variant.touches.find((t: any) => t.channel === "phone");
    expect(phoneTouch).toBeUndefined();
  }, 20000);

  it("should validate a variant's touches for compliance", async () => {
    const { validateVariant } = await import("./services/cadenceVariantCreation");
    const result = validateVariant({
      variantCadenceId: "test-variant",
      variantName: "Test Variant",
      baseCadenceId: "HNW_PROSPECT_12TOUCH_v1",
      variantType: "geographic",
      touches: [
        { touchNumber: 1, day: 1, channel: "email", subjectLine: "Introduction", body: "Hello {{first_name}}, I'd like to introduce...", complianceNotes: "" },
        { touchNumber: 2, day: 3, channel: "LinkedIn_InMail", body: "Hi {{first_name}}, I noticed your profile...", complianceNotes: "" },
        { touchNumber: 3, day: 7, channel: "email", subjectLine: "Follow up", body: "Just checking in...", complianceNotes: "" },
      ],
      adaptationNotes: [],
      complianceNotes: [],
      createdAt: Date.now(),
    });

    expect(result).toBeDefined();
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("should throw on invalid cadence ID", async () => {
    const { createCadenceVariant } = await import("./services/cadenceVariantCreation");
    await expect(createCadenceVariant({
      baseCadenceId: "nonexistent-cadence-999",
      variantType: "audience",
      variantName: "Test Invalid",
      variantDescription: "Should handle missing base cadence",
      adaptationRules: {},
    })).rejects.toThrow("not found");
  });
});

// ─── GAP-B3: Funnel Metrics with CAC/ROI/LTV ───────────────────────────

describe("Funnel Metrics — CAC/ROI/LTV (GAP-B3)", () => {
  it("should import calculateFunnelMetrics, calculateFunnelRollup, and getExpectedMetrics", async () => {
    const mod = await import("./services/funnelMetrics");
    expect(typeof mod.calculateFunnelMetrics).toBe("function");
    expect(typeof mod.calculateFunnelRollup).toBe("function");
    expect(typeof mod.getExpectedMetrics).toBe("function");
  });

  it("should calculate HNW funnel metrics with correct CAC/ROI/LTV", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "hnw",
      funnelName: "HNW Prospect",
      period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 25000,
      touchesSent: 500,
      leadsEntered: 50,
      leadsQualified: 30,
      leadsSolutionDesign: 15,
      leadsValidation: 8,
      leadsCommit: 5,
      leadsConverted: 3,
      avgDaysToConvert: 60,
      revenue: 180000,
      cogs: 20000,
      avgClientRetentionMonths: 60,
      referralsGenerated: 5,
      referralConversions: 2,
      referralRevenue: 120000,
      referralSpend: 5000,
    });

    expect(result.funnelId).toBe("hnw");
    expect(result.costs.cac).toBeCloseTo(25000 / 3, 0); // ~$8333
    expect(result.costs.leadsGenerated).toBe(50);
    expect(result.costs.leadsConverted).toBe(3);
    expect(result.revenue.totalRevenue).toBe(180000);
    expect(result.revenue.roi).toBeCloseTo((180000 - 25000) / 25000, 2); // 6.2
    expect(result.revenue.grossMarginDollar).toBe(160000); // 180k - 20k COGS
    expect(result.ltv.avgClientLtv).toBeGreaterThan(0);
    expect(result.ltv.ltvToCacRatio).toBeGreaterThan(0);
    expect(result.extendedNetwork.referralsGenerated).toBe(5);
    expect(result.extendedNetwork.networkMultiplier).toBeGreaterThan(1);
    expect(result.conversionFunnel.entered).toBe(50);
    expect(result.conversionFunnel.converted).toBe(3);
    expect(result.conversionFunnel.conversionRate).toBeCloseTo(0.06, 2);
    expect(result.benchmarks).toBeDefined();
    expect(["above", "at", "below"]).toContain(result.benchmarks.performanceVsBenchmark);
  });

  it("should calculate recruit funnel metrics", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "recruit",
      funnelName: "Recruit (New Associates)",
      period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 50000,
      touchesSent: 300,
      leadsEntered: 40,
      leadsQualified: 20,
      leadsSolutionDesign: 10,
      leadsValidation: 6,
      leadsCommit: 4,
      leadsConverted: 2,
      avgDaysToConvert: 90,
      revenue: 200000,
      cogs: 30000,
      avgClientRetentionMonths: 48,
      referralsGenerated: 3,
      referralConversions: 1,
      referralRevenue: 80000,
      referralSpend: 10000,
    });

    expect(result.funnelId).toBe("recruit");
    expect(result.costs.cac).toBe(25000); // 50k / 2
    expect(result.revenue.roi).toBeCloseTo(3.0, 1); // (200k - 50k) / 50k = 3.0
  });

  it("should handle zero conversions without division errors", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "coi",
      funnelName: "COI",
      period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 5000,
      touchesSent: 100,
      leadsEntered: 10,
      leadsQualified: 5,
      leadsSolutionDesign: 2,
      leadsValidation: 0,
      leadsCommit: 0,
      leadsConverted: 0,
      avgDaysToConvert: 0,
      revenue: 0,
      cogs: 0,
      avgClientRetentionMonths: 0,
      referralsGenerated: 0,
      referralConversions: 0,
      referralRevenue: 0,
      referralSpend: 0,
    });

    expect(result.costs.cac).toBe(0); // safeDiv returns 0
    expect(result.revenue.roi).toBe(-1); // (0 - 5000) / 5000 = -1
    expect(result.ltv.avgClientLtv).toBe(0);
    expect(Number.isFinite(result.ltv.paybackMonths)).toBe(true);
  });

  it("should calculate funnel rollup across multiple funnels", async () => {
    const { calculateFunnelMetrics, calculateFunnelRollup } = await import("./services/funnelMetrics");

    const hnw = calculateFunnelMetrics({
      funnelId: "hnw", funnelName: "HNW", period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 25000, touchesSent: 500, leadsEntered: 50, leadsQualified: 30,
      leadsSolutionDesign: 15, leadsValidation: 8, leadsCommit: 5, leadsConverted: 3,
      avgDaysToConvert: 60, revenue: 180000, cogs: 20000, avgClientRetentionMonths: 60,
      referralsGenerated: 5, referralConversions: 2, referralRevenue: 120000, referralSpend: 5000,
    });

    const coi = calculateFunnelMetrics({
      funnelId: "coi", funnelName: "COI", period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 8000, touchesSent: 200, leadsEntered: 20, leadsQualified: 15,
      leadsSolutionDesign: 10, leadsValidation: 7, leadsCommit: 5, leadsConverted: 4,
      avgDaysToConvert: 30, revenue: 100000, cogs: 10000, avgClientRetentionMonths: 48,
      referralsGenerated: 8, referralConversions: 3, referralRevenue: 90000, referralSpend: 3000,
    });

    const rollup = calculateFunnelRollup([hnw, coi]);

    expect(rollup.totalFunnels).toBe(2);
    expect(rollup.totalSpend).toBe(33000);
    expect(rollup.totalRevenue).toBe(280000);
    expect(rollup.totalLeadsGenerated).toBe(70);
    expect(rollup.totalLeadsConverted).toBe(7);
    expect(rollup.blendedCac).toBeCloseTo(33000 / 7, 0);
    expect(rollup.blendedRoi).toBeCloseTo((280000 - 33000) / 33000, 2);
    expect(rollup.bestPerformingFunnel).toBeDefined();
    expect(rollup.worstPerformingFunnel).toBeDefined();
  });

  it("should return expected metrics for all 6 funnels", async () => {
    const { getExpectedMetrics } = await import("./services/funnelMetrics");
    const expected = getExpectedMetrics();
    expect(expected.length).toBe(6);
    const funnelIds = expected.map((e: any) => e.funnelId);
    expect(funnelIds).toContain("recruit");
    expect(funnelIds).toContain("hnw");
    expect(funnelIds).toContain("coi");
    expect(funnelIds).toContain("b2b");
    expect(funnelIds).toContain("dormant");
    expect(funnelIds).toContain("affiliate");
    for (const m of expected) {
      expect(m.expectedCac).toBeGreaterThan(0);
      expect(m.expectedRoi).toBeGreaterThan(0);
      expect(m.expectedLtv).toBeGreaterThan(0);
      expect(m.reasoning).toBeDefined();
      expect(m.reasoning.length).toBeGreaterThan(50);
    }
  });

  it("should handle empty rollup gracefully", async () => {
    const { calculateFunnelRollup } = await import("./services/funnelMetrics");
    const rollup = calculateFunnelRollup([]);
    expect(rollup.totalFunnels).toBe(0);
    expect(rollup.blendedCac).toBe(0);
    expect(rollup.blendedRoi).toBe(0);
    expect(rollup.bestPerformingFunnel).toBe("N/A");
  });
});

// ─── GAP-B4: Error Handling Hardening ───────────────────────────────────

describe("Error Handling Hardening (GAP-B4)", () => {
  it("complianceAudit.auditMessage should return Fail grade on empty body", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "test-err",
      body: "",
      channel: "email",
      esiPreApprovalId: "",
      auditType: "ad_hoc",
    });
    expect(result).toBeDefined();
    expect(result.auditId).toBeDefined();
    expect(result.grade).toBe("Fail");
  });

  it("complianceAudit.selectDailyAuditSample should handle negative input", async () => {
    const { selectDailyAuditSample } = await import("./services/complianceAudit");
    const result = selectDailyAuditSample(-5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("complianceAudit.generateMonthlySummary should handle empty array", async () => {
    const { generateMonthlySummary } = await import("./services/complianceAudit");
    const result = generateMonthlySummary([]);
    expect(result).toBeDefined();
    expect(result.totalAudited).toBe(0);
    expect(result.overallGrade).toBe("Pass");
  });

  it("complianceAudit.validateEsiTracking should handle null input", async () => {
    const { validateEsiTracking } = await import("./services/complianceAudit");
    const result = validateEsiTracking(null as any);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("patternTransition.assessTransition should handle null metrics", async () => {
    const { assessTransition } = await import("./services/patternTransition");
    const result = assessTransition(null as any);
    expect(result).toBeDefined();
    expect(result.recommendation).toBe("stay");
    expect(result.rationale.toLowerCase()).toContain("error");
  });

  it("patternTransition.calculatePipelineCoverage should handle null pipeline", async () => {
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const result = calculatePipelineCoverage(null as any);
    expect(result).toBeDefined();
    expect(result.health).toBe("critical");
  });
});

// ─── Regression: Panel A Services Still Working ─────────────────────────

describe("Regression — Panel A Services", () => {
  it("cadenceEngine core functions still work", async () => {
    const mod = await import("./services/cadenceEngine");
    expect(typeof mod.getCadence).toBe("function");
    expect(typeof mod.complianceGateCheck).toBe("function");
    expect(typeof mod.checkThrottle).toBe("function");
    // calculateOooReschedule is in replyAnalysis, not cadenceEngine
    expect(typeof mod.classifyReply).toBe("function");
    expect(typeof mod.recommendCadence).toBe("function");

    const cadence = mod.getCadence("HNW_PROSPECT_12TOUCH_v1");
    expect(cadence).toBeDefined();
    expect(cadence!.name).toBeDefined();
    expect(cadence!.touches.length).toBeGreaterThan(0);
  });

  it("recruitScoring still produces 6-dimension scores", async () => {
    const { scoreRecruitCandidate } = await import("./services/recruitScoring");
    const result = await scoreRecruitCandidate({
      candidateName: "Regression Test",
      candidateCurrentFirm: "Edward Jones",
      candidateCredentials: "CFP, Series 7, Series 66",
      candidateGeography: "Tucson, AZ",
      candidateEngagementHistory: "Opened 3 emails, replied once",
      candidateReferralSource: "COI referral",
    });
    expect(result.scores).toBeDefined();
    expect(Object.keys(result.scores).length).toBe(6);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.tier).toBeDefined();
  }, 15000);

  it("hnwNarrativeScoring still produces narrative scores", async () => {
    const { scoreHnwProspect } = await import("./services/hnwNarrativeScoring");
    const result = await scoreHnwProspect({
      prospectName: "Regression Test HNW",
      prospectGeography: "Scottsdale, AZ",
      wealthSignal: "Business owner, real estate portfolio",
      priorOutreach: "Opened 3 emails, clicked 1 link",
    });
    expect(result.narrativeScore).toBeDefined();
    expect(result.narrativeScore.wealthSignalStrength).toBeDefined();
    expect(result.narrativeScore.fitWithHnwFunnel).toBeDefined();
    expect(result.narrativeScore.engagementDifficultyEstimate).toBeDefined();
    expect(result.narrativeScore.summaryParagraph).toBeDefined();
    expect(result.recommendedCadence).toBeDefined();
  }, 15000);

  it("replyAnalysis still classifies replies", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "Thanks for reaching out! I'd love to schedule a call next week.",
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 3,
      prospectName: "Regression Lead",
      channel: "email",
      previousTouchSubject: "Financial planning discussion",
    });
    expect(result.classification).toBeDefined();
    // ReplyClassification includes: interested, objection, info_request, opt_out, out_of_office, wrong_person, unclassified
    expect(["interested", "objection", "info_request", "opt_out", "out_of_office", "wrong_person", "unclassified"]).toContain(result.classification);
  }, 15000);
});

// ─── Cross-Service Integration: David's Operations Flow ─────────────────

describe("Cross-Service Integration — David's Operations Flow", () => {
  it("should calculate funnel metrics → assess transition → generate compliance summary", async () => {
    const { calculateFunnelMetrics, calculateFunnelRollup } = await import("./services/funnelMetrics");
    const { assessTransition, calculatePipelineCoverage } = await import("./services/patternTransition");
    const { generateMonthlySummary, auditMessage } = await import("./services/complianceAudit");

    // Step 1: Calculate funnel metrics for David's funnels
    const hnwMetrics = calculateFunnelMetrics({
      funnelId: "hnw", funnelName: "HNW", period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 15000, touchesSent: 300, leadsEntered: 30, leadsQualified: 18,
      leadsSolutionDesign: 10, leadsValidation: 6, leadsCommit: 4, leadsConverted: 2,
      avgDaysToConvert: 45, revenue: 120000, cogs: 15000, avgClientRetentionMonths: 60,
      referralsGenerated: 3, referralConversions: 1, referralRevenue: 60000, referralSpend: 2000,
    });

    const coiMetrics = calculateFunnelMetrics({
      funnelId: "coi", funnelName: "COI", period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 5000, touchesSent: 150, leadsEntered: 15, leadsQualified: 10,
      leadsSolutionDesign: 7, leadsValidation: 5, leadsCommit: 3, leadsConverted: 2,
      avgDaysToConvert: 25, revenue: 60000, cogs: 8000, avgClientRetentionMonths: 48,
      referralsGenerated: 6, referralConversions: 2, referralRevenue: 50000, referralSpend: 1500,
    });

    const rollup = calculateFunnelRollup([hnwMetrics, coiMetrics]);
    expect(rollup.totalFunnels).toBe(2);
    expect(rollup.blendedRoi).toBeGreaterThan(0);

    // Step 2: Assess pattern transition readiness
    const transition = assessTransition({
      aumSignedThisMonth: 1_800_000,
      dealsAbove500K: 1,
      activeAffiliates: 2,
      newProducersOnboarded: 1,
      totalPipelineValue: rollup.totalRevenue * 3,
      conversionRate: rollup.overallConversionRate,
      avgDealSize: rollup.totalRevenue / (rollup.totalLeadsConverted || 1),
      monthlyRecurringRevenue: 12000,
    });
    expect(transition.recommendation).toBeDefined();
    expect(["stay", "prepare_transition", "transition_ready"]).toContain(transition.recommendation);

    // Step 3: Pipeline coverage check
    const coverage = calculatePipelineCoverage({
      discoveryValue: 10000000,
      solutionDesignValue: 5000000,
      validationValue: 3000000,
      commitValue: 1500000,
      targetQuotaValue: 1000000,
    });
    expect(["healthy", "at_risk", "critical"]).toContain(coverage.health);

    // Step 4: Run compliance audits and generate summary
    const audits = [
      auditMessage({ messageId: "msg-001", body: "Hi John, I'd like to discuss your retirement planning options.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "msg-002", body: "Dear Sarah, our firm is the best advisor in Arizona and we guarantee 20% returns.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "msg-003", body: "Hi Mike, following up on our conversation about estate planning.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "monthly_full" }),
    ];

    const summary = generateMonthlySummary(audits);
    expect(summary.totalAudited).toBe(3);
    // "best advisor" + "guarantee 20% returns" should trigger compliance failures
    expect(summary.failCount).toBeGreaterThanOrEqual(1);
    expect(summary.passRate).toBeLessThan(1);
  });
});
