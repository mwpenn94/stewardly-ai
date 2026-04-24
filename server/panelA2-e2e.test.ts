/**
 * Expert Panel A2 — E2E Smoke Tests
 * ===================================
 * Covers all 10 GAP-A2 items with 3 virtual user personas:
 *
 *   Marcus Chen — Senior advisor, Pattern 4, HNW + COI funnels
 *   Elena Rodriguez — Recruiting manager, recruit + affiliate funnels
 *   David Thompson — Operations director, compliance + metrics focus
 *
 * Each test exercises the service layer directly (no DB required)
 * to validate that the People Engine and Data Engine functions
 * are wired correctly and produce valid outputs.
 */
import { describe, it, expect } from "vitest";

// ─── GAP-A2-01: Cadence Engine Core (OutreachAutomation wiring) ─────────
describe("GAP-A2-01: Cadence Engine Core Services", () => {
  it("should list cadences from CADENCE_LIBRARY", async () => {
    const { CADENCE_LIBRARY, getCadence } = await import("./services/cadenceEngine");
    expect(CADENCE_LIBRARY.length).toBeGreaterThanOrEqual(5);
    const hnw = getCadence("HNW_PROSPECT_12TOUCH_v1");
    expect(hnw).toBeDefined();
    expect(hnw!.touches.length).toBeGreaterThan(0);
    expect(hnw!.audienceSegment).toBeTruthy();
    expect(hnw!.esiPreApprovalRequired).toBe(true);
  });

  it("should render a touch with variable substitution", async () => {
    const { getCadence, renderTouch } = await import("./services/cadenceEngine");
    const cadence = getCadence("HNW_PROSPECT_12TOUCH_v1");
    expect(cadence).toBeDefined();
    const touch = cadence!.touches[0];
    const rendered = renderTouch(touch, {
      prospect_first_name: "Marcus",
      prospect_company: "Chen Wealth Group",
      sender_name: "Mike Penn",
    });
    expect(rendered.body).toBeTruthy();
    expect(rendered.body).not.toContain("{{prospect_first_name}}");
  });

  it("should check compliance gate for a touch", async () => {
    const { getCadence, complianceGateCheck } = await import("./services/cadenceEngine");
    const cadence = getCadence("HNW_PROSPECT_12TOUCH_v1");
    const touch = cadence!.touches[0];
    // Missing ESI should fail
    const result = complianceGateCheck(touch, { esiPreApprovalId: "" });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    // Valid ESI should pass (for email channel)
    const result2 = complianceGateCheck(touch, { esiPreApprovalId: "ESI-2026-001" });
    if (touch.channel === "email") {
      expect(result2.passed).toBe(true);
    }
  });

  it("should check delivery throttle limits", async () => {
    const { checkThrottle, GLOBAL_RULES } = await import("./services/cadenceEngine");
    const state = {
      emailsSentToday: { "example.com": 0 },
      linkedInConnectionsToday: 0,
      linkedInInMailsToday: 0,
      phoneCallsToday: 0,
      lastResetDate: new Date().toISOString().slice(0, 10),
    };
    const result = checkThrottle(state, "email", "example.com");
    expect(result.allowed).toBe(true);
    expect(result.utilizationPct).toBeDefined();
    expect(GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay).toBe(50);
  });

  it("should classify replies correctly", async () => {
    const { classifyReply } = await import("./services/cadenceEngine");
    const optOut = classifyReply("Please unsubscribe me from all emails");
    expect(optOut.classification).toBe("opt_out");
    expect(optOut.shouldPauseCadence).toBe(true);

    const interested = classifyReply("Yes, I'd love to meet next week to discuss retirement planning");
    expect(interested.classification).toBe("interested");
    expect(interested.shouldPauseCadence).toBe(true);

    const ooo = classifyReply("I am out of the office until May 5th. I will respond when I return.");
    expect(ooo.classification).toBe("out_of_office");
    expect(ooo.shouldPauseCadence).toBe(false);
  });

  it("should recommend cadences based on segment and context", async () => {
    const { recommendCadence } = await import("./services/cadenceEngine");
    const hnwRec = recommendCadence({ segment: "hnw", state: "AZ" });
    expect(hnwRec).toBe("HNW_PROSPECT_12TOUCH_v1");

    const nmRec = recommendCadence({ segment: "hnw", state: "NM" });
    expect(nmRec).toBe("HNW_PROSPECT_NM_12TOUCH_v1");

    const dormant = recommendCadence({ segment: "hnw", daysSinceLastContact: 120 });
    expect(dormant).toBe("DORMANT_REENGAGEMENT_v1");

    const affiliate = recommendCadence({ segment: "affiliate", isAffiliate: true });
    expect(affiliate).toBe("STEWARDLY_AFFILIATE_ONBOARDING_v1");
  });

  it("should get global rules with all required fields", async () => {
    const { GLOBAL_RULES } = await import("./services/cadenceEngine");
    expect(GLOBAL_RULES.optOutHandling).toBeDefined();
    expect(GLOBAL_RULES.replyHandling).toBeDefined();
    expect(GLOBAL_RULES.deliveryThrottling).toBeDefined();
    expect(GLOBAL_RULES.complianceGate).toBeDefined();
    expect(GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay).toBeGreaterThan(0);
  });
});

// ─── GAP-A2-02: Weekly Summary Generation ───────────────────────────────
describe("GAP-A2-02: Weekly Summary Generation", () => {
  it("Marcus Chen: should build a static weekly summary with all sections", async () => {
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
        {
          funnelName: "COI Maintenance",
          leadsEntered: 5,
          leadsQualified: 5,
          leadsConverted: 1,
          conversionRate: 0.20,
          avgDaysInPipeline: 30,
          totalPipelineValue: 800000,
          touchesSent: 20,
          repliesReceived: 8,
          replyRate: 0.40,
          meetingsBooked: 3,
        },
      ],
      complianceHealth: {
        totalTouchesSent: 68,
        touchesAudited: 10,
        auditPassRate: 0.90,
        failCount: 1,
        conditionalPassCount: 1,
        topFindings: ["Missing ESI reference in touch 3"],
        esiExpiringThisMonth: 0,
        optOutsProcessed: 2,
      },
      variances: [
        {
          metric: "Reply Rate",
          expected: 0.25,
          actual: 0.292,
          variancePct: 16.8,
          direction: "above",
          severity: "minor",
        },
      ],
      actionItems: [
        {
          id: "AI-001",
          description: "Follow up with Dr. Williams on retirement planning proposal",
          priority: "high",
          dueDate: "2026-04-22",
          assignedTo: "Marcus Chen",
          status: "pending",
        },
      ],
      nextWeekFocus: ["Close Dr. Williams proposal", "Schedule 3 new HNW discovery calls"],
      currentPattern: "Pattern 4",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(100);
    expect(result).toContain("Marcus Chen");
    expect(result).toContain("Pipeline");
    expect(result).toContain("HNW Prospect");
  });
});

// ─── GAP-A2-03: Compliance Audit Services ───────────────────────────────
describe("GAP-A2-03: Cadence Compliance Dashboard Services", () => {
  it("David Thompson: should audit a compliant message as Pass", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "msg-001",
      body: "Hi John, I'd like to discuss your retirement planning options. Our team at WealthBridge Financial Group can help you evaluate your current portfolio allocation.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-001",
      auditType: "daily_random",
    });
    expect(result.auditId).toBeTruthy();
    expect(result.grade).toBe("Pass");
    expect(result.findings).toBeDefined();
  });

  it("David Thompson: should audit a non-compliant message as Fail", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "msg-002",
      body: "We are the best advisor in Arizona and we guarantee 20% annual returns on all investments. You can't lose money with us!",
      channel: "email",
      esiPreApprovalId: "ESI-2026-001",
      auditType: "monthly_full",
    });
    expect(["Conditional Pass", "Fail"]).toContain(result.grade);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("David Thompson: should generate monthly audit summary", async () => {
    const { auditMessage, generateMonthlySummary } = await import("./services/complianceAudit");
    const audits = [
      auditMessage({ messageId: "a1", body: "Hi, let's discuss your financial goals.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "a2", body: "We guarantee 15% returns!", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "a3", body: "Following up on our estate planning conversation.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "monthly_full" }),
    ];
    const summary = generateMonthlySummary(audits);
    expect(summary.totalAudited).toBe(3);
    expect(summary.passRate).toBeDefined();
    expect(summary.failCount).toBeGreaterThanOrEqual(1);
    expect(summary.topFindings).toBeDefined();
    expect(summary.overallGrade).toBeDefined();
  });

  it("David Thompson: should select daily audit sample", async () => {
    const { selectDailyAuditSample } = await import("./services/complianceAudit");
    const sample = selectDailyAuditSample(20);
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.length).toBeLessThanOrEqual(2);
    sample.forEach(idx => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(20);
    });
  });

  it("David Thompson: should validate ESI tracking", async () => {
    const { validateEsiTracking } = await import("./services/complianceAudit");
    const valid = validateEsiTracking({
      esiPreApprovalId: "ESI-2026-001",
      esiPreApprovalExpiry: Date.now() + 86400000 * 30,
      antiRebateLanguageVerified: true,
      lastVerifiedAt: Date.now(),
    });
    expect(valid.valid).toBe(true);
    expect(valid.issues.length).toBe(0);

    const expired = validateEsiTracking({
      esiPreApprovalId: "ESI-2025-OLD",
      esiPreApprovalExpiry: Date.now() - 86400000,
      antiRebateLanguageVerified: false,
      lastVerifiedAt: Date.now() - 86400000 * 60,
    });
    expect(expired.valid).toBe(false);
    expect(expired.issues.length).toBeGreaterThan(0);
  });
});

// ─── GAP-A2-04: Cadence Enrollment (CadenceEnrollmentDialog) ────────────
describe("GAP-A2-04: Cadence Enrollment Services", () => {
  it("Marcus Chen: should get cadence detail for enrollment dialog", async () => {
    const { getCadence, CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    // Verify all cadences in library are retrievable
    for (const c of CADENCE_LIBRARY) {
      const detail = getCadence(c.cadenceId);
      expect(detail).toBeDefined();
      expect(detail!.name).toBeTruthy();
      expect(detail!.audienceSegment).toBeTruthy();
    }
  });

  it("Marcus Chen: should validate cadence recommendations for HNW", async () => {
    const { validateCadenceRecommendation } = await import("./services/hnwNarrativeScoring");
    expect(validateCadenceRecommendation("HNW_PROSPECT_12TOUCH_v1")).toBe(true);
    expect(validateCadenceRecommendation("HNW_PROSPECT_NM_12TOUCH_v1")).toBe(true);
    expect(validateCadenceRecommendation("INVALID_CADENCE")).toBe(false);
  });
});

// ─── GAP-A2-05: Touch Draft Review (TouchDraftReview) ───────────────────
describe("GAP-A2-05: Touch Drafting & Validation", () => {
  it("Marcus Chen: should validate draft for send — clean draft passes", async () => {
    const { validateDraftForSend } = await import("./services/cadenceTouchDrafting");
    const cleanDraft = {
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 1,
      channel: "email",
      subjectLine: "Retirement Planning Discussion",
      body: "Hi Marcus, I'd like to discuss your retirement planning options. Our team at WealthBridge Financial Group specializes in comprehensive wealth management for high-net-worth individuals in the Arizona region.",
      complianceCheck: {
        esiPreApprovalVerified: true,
        antiRebateLanguageRequired: false,
        antiRebateLanguagePresent: false,
        finra2210Compliant: true,
        tcpaConsentVerified: false,
        performanceProjectionsPresent: false,
        forwardLookingClaimsPresent: false,
        readyToSend: true,
      },
      rationaleForPersonalization: "Tailored for HNW medical professional",
    };
    const issues = validateDraftForSend(cleanDraft);
    expect(issues.length).toBe(0);
  });

  it("Marcus Chen: should flag issues in a bad draft", async () => {
    const { validateDraftForSend } = await import("./services/cadenceTouchDrafting");
    const badDraft = {
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 1,
      channel: "email",
      subjectLine: "",
      body: "Hi {{prospect_first_name}}, we guarantee 20% returns!",
      complianceCheck: {
        esiPreApprovalVerified: false,
        antiRebateLanguageRequired: true,
        antiRebateLanguagePresent: false,
        finra2210Compliant: false,
        tcpaConsentVerified: false,
        performanceProjectionsPresent: true,
        forwardLookingClaimsPresent: true,
        readyToSend: false,
      },
      rationaleForPersonalization: "",
    };
    const issues = validateDraftForSend(badDraft);
    expect(issues.length).toBeGreaterThan(0);
  });
});

// ─── GAP-A2-06: MEDDPICC Scorecard ─────────────────────────────────────
describe("GAP-A2-06: MEDDPICC Scorecard Services", () => {
  it("Marcus Chen: should create empty MEDDPICC and count fields", async () => {
    const { createEmptyMeddpicc, countCompletedFields } = await import("./services/meddpiccFieldCompletion");
    const empty = createEmptyMeddpicc();
    expect(empty.metrics).toBeDefined();
    expect(empty.economicBuyer).toBeDefined();
    expect(empty.champion).toBeDefined();
    expect(empty.competition).toBeDefined();
    const count = countCompletedFields(empty);
    expect(count).toBe(0);
  });

  it("Marcus Chen: should determine stage recommendation", async () => {
    const { createEmptyMeddpicc, determineStageRecommendation } = await import("./services/meddpiccFieldCompletion");
    const empty = createEmptyMeddpicc();
    const rec = determineStageRecommendation(empty, 0);
    expect(rec).toBe("Maintain Discovery");
  });

  it("Marcus Chen: should identify focus areas for empty MEDDPICC", async () => {
    const { createEmptyMeddpicc, identifyFocusAreas } = await import("./services/meddpiccFieldCompletion");
    const empty = createEmptyMeddpicc();
    const areas = identifyFocusAreas(empty);
    expect(areas.length).toBeGreaterThan(0);
    expect(areas.length).toBe(4); // identifyFocusAreas returns top 4 focus areas
  });

  it("Marcus Chen: should merge MEDDPICC states correctly", async () => {
    const { createEmptyMeddpicc, mergeMeddpiccStates, countCompletedFields } = await import("./services/meddpiccFieldCompletion");
    const existing = createEmptyMeddpicc();
    existing.metrics = { value: "AUM growth target: $5M", confidence: "Medium", evidenceQuote: "We're looking to grow by 5M" };
    const newAnalysis = createEmptyMeddpicc();
    newAnalysis.metrics = { value: "AUM growth target: $5M, timeline Q3", confidence: "High", evidenceQuote: "We need this by Q3" };
    newAnalysis.economicBuyer = { value: "CFO Sarah Williams", confidence: "High", evidenceQuote: "Sarah makes all financial decisions" };
    const merged = mergeMeddpiccStates(existing, newAnalysis);
    expect(merged.metrics.confidence).toBe("High"); // Higher confidence wins
    expect(merged.economicBuyer.confidence).toBe("High");
    expect(countCompletedFields(merged)).toBeGreaterThanOrEqual(2);
  });

  it("Marcus Chen: should check transcript compliance", async () => {
    const { checkTranscriptCompliance } = await import("./services/meddpiccFieldCompletion");
    const clean = checkTranscriptCompliance("We discussed retirement planning and portfolio allocation strategies.");
    expect(clean.hasSsnOrTin).toBe(false);
    // The function always adds at least 1 warning ("No compliance flags detected") when clean
    expect(clean.warnings.length).toBeGreaterThanOrEqual(1);
    expect(clean.warnings[0]).toContain("No compliance flags");

    const dirty = checkTranscriptCompliance("My SSN is 123-45-6789 and I want to open an account.");
    expect(dirty.hasSsnOrTin).toBe(true);
    expect(dirty.warnings.length).toBeGreaterThan(0);
  });
});

// ─── GAP-A2-07: Funnel Metrics Panel ───────────────────────────────────
describe("GAP-A2-07: Funnel Metrics Calculation", () => {
  it("Elena Rodriguez: should calculate recruit funnel metrics", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "recruit",
      funnelName: "Recruit (New Associates + Experienced Professionals)",
      period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 15000,
      touchesSent: 120,
      leadsEntered: 25,
      leadsQualified: 12,
      leadsSolutionDesign: 8,
      leadsValidation: 5,
      leadsCommit: 3,
      leadsConverted: 2,
      avgDaysToConvert: 60,
      revenue: 80000,
      cogs: 20000,
      avgClientRetentionMonths: 36,
      referralsGenerated: 4,
      referralConversions: 1,
      referralRevenue: 35000,
      referralSpend: 2000,
    });
    expect(result.funnelId).toBe("recruit");
    expect(result.costs.cac).toBeGreaterThan(0);
    expect(result.revenue.roi).toBeDefined();
    expect(result.ltv.avgClientLtv).toBeGreaterThan(0);
    expect(result.extendedNetwork.referralsGenerated).toBe(4);
    expect(result.conversionFunnel.entered).toBe(25);
    expect(result.conversionFunnel.converted).toBe(2);
    expect(result.benchmarks).toBeDefined();
  });

  it("Marcus Chen: should calculate HNW funnel metrics", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "hnw",
      funnelName: "HNW Prospect",
      period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 8000,
      touchesSent: 96,
      leadsEntered: 15,
      leadsQualified: 10,
      leadsSolutionDesign: 6,
      leadsValidation: 4,
      leadsCommit: 2,
      leadsConverted: 1,
      avgDaysToConvert: 45,
      revenue: 120000,
      cogs: 15000,
      avgClientRetentionMonths: 60,
      referralsGenerated: 3,
      referralConversions: 1,
      referralRevenue: 80000,
      referralSpend: 1000,
    });
    expect(result.funnelId).toBe("hnw");
    expect(result.revenue.grossMarginPct).toBeGreaterThan(0);
    expect(result.ltv.ltvToCacRatio).toBeGreaterThan(0);
  });

  it("Elena Rodriguez: should calculate funnel rollup across multiple funnels", async () => {
    const { calculateFunnelMetrics, calculateFunnelRollup } = await import("./services/funnelMetrics");
    const recruit = calculateFunnelMetrics({
      funnelId: "recruit", funnelName: "Recruit", period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 15000, touchesSent: 120, leadsEntered: 25, leadsQualified: 12,
      leadsSolutionDesign: 8, leadsValidation: 5, leadsCommit: 3, leadsConverted: 2,
      avgDaysToConvert: 60, revenue: 80000, cogs: 20000, avgClientRetentionMonths: 36,
      referralsGenerated: 4, referralConversions: 1, referralRevenue: 35000, referralSpend: 2000,
    });
    const hnw = calculateFunnelMetrics({
      funnelId: "hnw", funnelName: "HNW", period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 8000, touchesSent: 96, leadsEntered: 15, leadsQualified: 10,
      leadsSolutionDesign: 6, leadsValidation: 4, leadsCommit: 2, leadsConverted: 1,
      avgDaysToConvert: 45, revenue: 120000, cogs: 15000, avgClientRetentionMonths: 60,
      referralsGenerated: 3, referralConversions: 1, referralRevenue: 80000, referralSpend: 1000,
    });
    const rollup = calculateFunnelRollup([recruit, hnw]);
    expect(rollup.totalFunnels).toBe(2);
    expect(rollup.totalSpend).toBe(23000);
    expect(rollup.totalRevenue).toBe(200000);
    expect(rollup.blendedCac).toBeGreaterThan(0);
    expect(rollup.blendedRoi).toBeGreaterThan(0);
    expect(rollup.overallConversionRate).toBeGreaterThan(0);
    expect(rollup.bestPerformingFunnel).toBeTruthy();
  });

  it("David Thompson: should get expected metrics for all funnels", async () => {
    const { getExpectedMetrics } = await import("./services/funnelMetrics");
    const expected = getExpectedMetrics();
    expect(expected.length).toBeGreaterThanOrEqual(3);
    for (const e of expected) {
      expect(e.funnelId).toBeTruthy();
      expect(e.expectedCac).toBeGreaterThan(0);
      expect(e.expectedRoi).toBeGreaterThan(0);
      expect(e.expectedLtv).toBeGreaterThan(0);
      expect(e.reasoning).toBeTruthy();
    }
  });
});

// ─── GAP-A2-08: Pattern Transition Assessment ──────────────────────────
describe("GAP-A2-08: Pattern Transition & Pipeline Coverage", () => {
  it("Marcus Chen: should assess Pattern 4 metrics (stay recommendation)", async () => {
    const { assessTransition, PATTERN_THRESHOLDS } = await import("./services/patternTransition");
    const result = assessTransition({
      aumSignedThisMonth: 500000,
      dealsAbove500K: 0,
      activeAffiliates: 1,
      newProducersOnboarded: 0,
      totalPipelineValue: 3000000,
      conversionRate: 0.03,
      avgDealSize: 150000,
      monthlyRecurringRevenue: 8000,
    });
    expect(result.currentPattern).toBe("Pattern 4");
    expect(result.recommendation).toBe("stay");
    expect(result.readinessScore).toBeLessThan(80);
    expect(result.rationale).toBeTruthy();
    expect(result.gatingFactors.length).toBeGreaterThan(0);
    expect(result.nextReviewDate).toBeTruthy();
    expect(PATTERN_THRESHOLDS.pattern4to5.minMonthlyAum).toBe(2_000_000);
  });

  it("Marcus Chen: should assess Pattern 4 → 5 transition readiness", async () => {
    const { assessTransition } = await import("./services/patternTransition");
    const result = assessTransition({
      aumSignedThisMonth: 3000000,
      dealsAbove500K: 3,
      activeAffiliates: 5,
      newProducersOnboarded: 2,
      totalPipelineValue: 15000000,
      conversionRate: 0.08,
      avgDealSize: 400000,
      monthlyRecurringRevenue: 25000,
    });
    expect(["prepare_transition", "transition_ready"]).toContain(result.recommendation);
    expect(result.readinessScore).toBeGreaterThan(50);
  });

  it("David Thompson: should calculate pipeline coverage", async () => {
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const coverage = calculatePipelineCoverage({
      discoveryValue: 15000000,
      solutionDesignValue: 8000000,
      validationValue: 4000000,
      commitValue: 2000000,
      targetQuotaValue: 1000000,
    });
    expect(coverage.discoveryMultiple).toBeGreaterThan(0);
    expect(coverage.solutionDesignMultiple).toBeGreaterThan(0);
    expect(["healthy", "at_risk", "critical"]).toContain(coverage.health);
    expect(coverage.recommendations).toBeDefined();
  });

  it("David Thompson: should flag critical pipeline coverage", async () => {
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const coverage = calculatePipelineCoverage({
      discoveryValue: 500000,
      solutionDesignValue: 200000,
      validationValue: 100000,
      commitValue: 50000,
      targetQuotaValue: 1000000,
    });
    expect(["at_risk", "critical"]).toContain(coverage.health);
    expect(coverage.recommendations.length).toBeGreaterThan(0);
  });
});

// ─── GAP-A2-09: Reply Analysis (ReplyInbox) ────────────────────────────
describe("GAP-A2-09: Reply Analysis & Routing", () => {
  it("Marcus Chen: should analyze an interested reply with context", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "Hi Mike, thanks for reaching out. I'd love to schedule a call to discuss retirement planning. How does next Tuesday at 2pm work?",
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 3,
      prospectName: "Dr. Williams",
      prospectCompany: "Williams Medical Group",
      channel: "email",
      previousTouchSubject: "Retirement Planning for Medical Professionals",
    });
    expect(result.classification).toBe("interested");
    expect(result.shouldPauseCadence).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.keyPhrases).toBeDefined();
    expect(result.urgency).toBeDefined();
  });

  it("Marcus Chen: should analyze an opt-out reply", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "Please remove me from your mailing list. I am not interested in your services.",
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 2,
      prospectName: "John Smith",
      channel: "email",
    });
    expect(result.classification).toBe("opt_out");
    expect(result.shouldPauseCadence).toBe(true);
  });

  it("Elena Rodriguez: should process opt-out correctly", async () => {
    const { processOptOut } = await import("./services/replyAnalysis");
    const result = processOptOut({
      prospectId: 42,
      channel: "email",
      optOutText: "Please stop contacting me",
    });
    expect(result.prospectId).toBe(42);
    expect(result.optOutTimestamp).toBeGreaterThan(0);
    expect(result.scope).toBe("all_channels");
  });
});

// ─── GAP-A2-10: Recruit Scoring Panel ──────────────────────────────────
describe("GAP-A2-10: Recruit & HNW Scoring", () => {
  it("Elena Rodriguez: should calculate composite score and assign tier", async () => {
    const { calculateComposite, assignTier, DIMENSION_WEIGHTS, TIER_THRESHOLDS } = await import("./services/recruitScoring");
    const scores = {
      productionFit: 85,
      culturalFit: 75,
      geographicFit: 90,
      networkLeverage: 80,
      compliancePosture: 95,
      engagementSignal: 70,
    };
    const composite = calculateComposite(scores);
    expect(composite).toBeGreaterThan(0);
    expect(composite).toBeLessThanOrEqual(100);
    const tier = assignTier(composite);
    expect(["Tier 1", "Tier 2", "Tier 3", "Hold"]).toContain(tier);
    // Verify weights sum to 1
    const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.01);
    expect(TIER_THRESHOLDS.tier1).toBe(80);
  });

  it("Elena Rodriguez: should validate cadence recommendation for recruit", async () => {
    const { validateCadenceRecommendation } = await import("./services/hnwNarrativeScoring");
    expect(validateCadenceRecommendation("RECRUIT_TIER1_12TOUCH_v1")).toBe(true);
    expect(validateCadenceRecommendation("COI_MAINTENANCE_QUARTERLY_v1")).toBe(true);
    expect(validateCadenceRecommendation("NONEXISTENT_v1")).toBe(false);
  });
});

// ─── GAP-A2-VARIANT: Cadence Variant Creation ──────────────────────────
describe("Cadence Variant Creation & Validation", () => {
  it("Elena Rodriguez: should list base cadences", async () => {
    const { listBaseCadences } = await import("./services/cadenceVariantCreation");
    const bases = listBaseCadences();
    expect(bases.length).toBeGreaterThanOrEqual(5);
    for (const b of bases) {
      expect(b.cadenceId).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.audienceSegment).toBeTruthy();
      expect(b.touchCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("David Thompson: should validate a variant with valid touches", async () => {
    const { validateVariant } = await import("./services/cadenceVariantCreation");
    const result = validateVariant({
      variantCadenceId: "TEST_VARIANT_v1",
      variantName: "Test Geographic Variant",
      baseCadenceId: "HNW_PROSPECT_12TOUCH_v1",
      variantType: "geographic",
      touches: [
        { touchNumber: 1, day: 0, channel: "email" as any, subjectLine: "Introduction", body: "Hi, I'd like to introduce our services for the New Mexico region. We specialize in comprehensive wealth management.", complianceNotes: "ESI approved" },
        { touchNumber: 2, day: 3, channel: "LinkedIn_InMail" as any, subjectLine: null, body: "Following up on my email about wealth management services in the Southwest region.", complianceNotes: "ESI approved" },
      ],
      adaptationNotes: ["Geographic adaptation for NM"],
      complianceNotes: ["NM state compliance overlay applied"],
      createdAt: Date.now(),
    });
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });
});

// ─── CROSS-CUTTING: Virtual User Full Workflow ─────────────────────────
describe("Cross-Cutting: Full Advisor Workflow (Marcus Chen)", () => {
  it("should execute a complete advisor workflow: recommend → classify → audit → coverage → summary", async () => {
    const { recommendCadence, classifyReply, GLOBAL_RULES } = await import("./services/cadenceEngine");
    const { auditMessage, generateMonthlySummary } = await import("./services/complianceAudit");
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");

    // Step 1: Recommend cadence for HNW prospect
    const cadenceId = recommendCadence({ segment: "hnw", state: "AZ" });
    expect(cadenceId).toBe("HNW_PROSPECT_12TOUCH_v1");

    // Step 2: Classify a reply
    const reply = classifyReply("Yes, I'd love to meet. How about Thursday?");
    expect(reply.classification).toBe("interested");

    // Step 3: Audit touches
    const audit1 = auditMessage({
      messageId: "wf-001",
      body: "Hi Dr. Williams, I'd like to discuss retirement planning options tailored for medical professionals.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-001",
      auditType: "daily_random",
    });
    expect(audit1.grade).toBe("Pass");

    // Step 4: Calculate pipeline coverage
    const coverage = calculatePipelineCoverage({
      discoveryValue: 15000000,
      solutionDesignValue: 8000000,
      validationValue: 4000000,
      commitValue: 2000000,
      targetQuotaValue: 1000000,
    });
    expect(["healthy", "at_risk", "critical"]).toContain(coverage.health);

    // Step 5: Build weekly summary
    const summary = buildStaticSummary({
      advisorName: "Marcus Chen",
      weekStartDate: "2026-04-14",
      weekEndDate: "2026-04-20",
      headlineMetric: { name: "Pipeline Value", value: 4500000, unit: "USD", weekOverWeekChange: 12.5, isPositive: true },
      pipelineCoverage: { discoveryValue: 15000000, solutionDesignValue: 8000000, validationValue: 4000000, commitValue: 2000000, targetQuotaValue: 1000000, coverageHealth: coverage.health },
      funnelSnapshots: [{ funnelName: "HNW", leadsEntered: 12, leadsQualified: 8, leadsConverted: 2, conversionRate: 0.167, avgDaysInPipeline: 45, totalPipelineValue: 3200000, touchesSent: 48, repliesReceived: 14, replyRate: 0.292, meetingsBooked: 5 }],
      complianceHealth: { totalTouchesSent: 48, touchesAudited: 5, auditPassRate: 1.0, failCount: 0, conditionalPassCount: 0, topFindings: [], esiExpiringThisMonth: 0, optOutsProcessed: 0 },
      variances: [],
      actionItems: [],
      nextWeekFocus: ["Close Dr. Williams proposal"],
      currentPattern: "Pattern 4",
    });
    expect(summary).toContain("Marcus Chen");
  });
});

describe("Cross-Cutting: Recruiting Manager Workflow (Elena Rodriguez)", () => {
  it("should execute recruit scoring → funnel metrics → rollup", async () => {
    const { calculateComposite, assignTier } = await import("./services/recruitScoring");
    const { calculateFunnelMetrics, calculateFunnelRollup, getExpectedMetrics } = await import("./services/funnelMetrics");

    // Step 1: Score a recruit candidate
    const composite = calculateComposite({
      productionFit: 82,
      culturalFit: 78,
      geographicFit: 85,
      networkLeverage: 90,
      compliancePosture: 88,
      engagementSignal: 75,
    });
    const tier = assignTier(composite);
    expect(["Tier 1", "Tier 2"]).toContain(tier);

    // Step 2: Calculate funnel metrics
    const recruitMetrics = calculateFunnelMetrics({
      funnelId: "recruit",
      funnelName: "Recruit",
      period: { startDate: "2026-04-01", endDate: "2026-04-30" },
      spend: 15000,
      touchesSent: 120,
      leadsEntered: 25,
      leadsQualified: 12,
      leadsSolutionDesign: 8,
      leadsValidation: 5,
      leadsCommit: 3,
      leadsConverted: 2,
      avgDaysToConvert: 60,
      revenue: 80000,
      cogs: 20000,
      avgClientRetentionMonths: 36,
      referralsGenerated: 4,
      referralConversions: 1,
      referralRevenue: 35000,
      referralSpend: 2000,
    });
    expect(recruitMetrics.costs.cac).toBeGreaterThan(0);

    // Step 3: Compare against expected metrics
    const expected = getExpectedMetrics();
    const recruitExpected = expected.find(e => e.funnelId === "recruit");
    expect(recruitExpected).toBeDefined();
    expect(recruitExpected!.expectedCac).toBeGreaterThan(0);

    // Step 4: Rollup
    const rollup = calculateFunnelRollup([recruitMetrics]);
    expect(rollup.totalFunnels).toBe(1);
    expect(rollup.blendedCac).toBeGreaterThan(0);
  });
});

describe("Cross-Cutting: Operations Director Workflow (David Thompson)", () => {
  it("should execute compliance audit → pattern assessment → pipeline coverage", async () => {
    const { auditMessage, generateMonthlySummary, selectDailyAuditSample, validateEsiTracking } = await import("./services/complianceAudit");
    const { assessTransition, calculatePipelineCoverage } = await import("./services/patternTransition");

    // Step 1: Run compliance audits
    const audits = [
      auditMessage({ messageId: "ops-001", body: "Hi, let's discuss your financial goals and retirement planning.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "ops-002", body: "We guarantee the best returns in the industry!", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "daily_random" }),
      auditMessage({ messageId: "ops-003", body: "Following up on our estate planning discussion.", channel: "email", esiPreApprovalId: "ESI-2026-001", auditType: "monthly_full" }),
    ];
    const summary = generateMonthlySummary(audits);
    expect(summary.totalAudited).toBe(3);
    expect(summary.failCount).toBeGreaterThanOrEqual(1);

    // Step 2: Validate ESI tracking
    const esi = validateEsiTracking({
      esiPreApprovalId: "ESI-2026-001",
      esiPreApprovalExpiry: Date.now() + 86400000 * 30,
      antiRebateLanguageVerified: true,
      lastVerifiedAt: Date.now(),
    });
    expect(esi.valid).toBe(true);

    // Step 3: Assess pattern transition
    const transition = assessTransition({
      aumSignedThisMonth: 1500000,
      dealsAbove500K: 1,
      activeAffiliates: 2,
      newProducersOnboarded: 1,
      totalPipelineValue: 8000000,
      conversionRate: 0.05,
      avgDealSize: 200000,
      monthlyRecurringRevenue: 12000,
    });
    expect(transition.currentPattern).toBe("Pattern 4");
    expect(transition.recommendation).toBeDefined();

    // Step 4: Pipeline coverage
    const coverage = calculatePipelineCoverage({
      discoveryValue: 10000000,
      solutionDesignValue: 5000000,
      validationValue: 3000000,
      commitValue: 1500000,
      targetQuotaValue: 1000000,
    });
    expect(["healthy", "at_risk", "critical"]).toContain(coverage.health);

    // Step 5: Daily audit sample
    const sample = selectDailyAuditSample(15);
    expect(sample.length).toBeGreaterThan(0);
  });
});
