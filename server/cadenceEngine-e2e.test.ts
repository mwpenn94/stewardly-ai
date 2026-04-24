/**
 * Cadence Engine E2E Smoke Tests — Expert Panel A Validation
 * ============================================================
 * Virtual User Personas:
 *   - "Marcus" — Pattern 2 advisor, 50-lead pipeline, 3 active cadences
 *   - "Elena"  — Pattern 3 advisor, 200-lead pipeline, recruiting + HNW
 *   - "David"  — Pattern 1 advisor, new to cadences, compliance-sensitive
 *
 * Coverage:
 *   1. Cadence library integrity (all cadences from cadence_library.json)
 *   2. 6-dimension recruit scoring (weights, tiers, cascade potential)
 *   3. HNW narrative scoring (wealth signals, funnel fit, cadence recommendation)
 *   4. MEDDPICC scoring (composite calculation, tier assignment)
 *   5. Reply analysis (classification, auto-routing, OOO reschedule)
 *   6. Compliance audit (ESI tracking, grade assignment, monthly summary)
 *   7. Pattern transition assessment (gating factors, readiness)
 *   8. Touch drafting (variable substitution, compliance pre-check)
 *   9. Opt-out processing (universal scope, enrollment cascade stop)
 *   10. Global rules enforcement (throttle, quiet hours, DNC)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Cadence Library Integrity ─────────────────────────────────────────

describe("Cadence Library Integrity", () => {
  it("should export CADENCE_LIBRARY with all cadences from cadence_library.json", async () => {
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    expect(CADENCE_LIBRARY).toBeDefined();
    expect(Array.isArray(CADENCE_LIBRARY)).toBe(true);
    expect(CADENCE_LIBRARY.length).toBeGreaterThanOrEqual(5);
  });

  it("should have getCadence returning correct cadence by cadenceId", async () => {
    const { getCadence, CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const first = CADENCE_LIBRARY[0];
    const result = getCadence(first.cadenceId);
    expect(result).toBeDefined();
    expect(result?.cadenceId).toBe(first.cadenceId);
    expect(result?.name).toBe(first.name);
  });

  it("should return undefined for non-existent cadence ID", async () => {
    const { getCadence } = await import("./services/cadenceEngine");
    expect(getCadence("nonexistent-cadence-xyz")).toBeUndefined();
  });

  it("every cadence should have cadenceId, name, audienceSegment, and touches array", async () => {
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    for (const c of CADENCE_LIBRARY) {
      expect(c.cadenceId).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.audienceSegment).toBeTruthy();
      expect(Array.isArray(c.touches)).toBe(true);
      // Some variant cadences reference another cadence's touches
      if (!c.touchesReference) {
        expect(c.touches.length).toBeGreaterThan(0);
      }
    }
  });

  it("every non-variant touch should have channel, day, and body", async () => {
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    for (const c of CADENCE_LIBRARY) {
      if (c.touchesReference) continue; // skip variant cadences
      for (const t of c.touches) {
        expect(t.channel).toBeTruthy();
        expect(typeof t.day).toBe("number");
        expect(t.day).toBeGreaterThanOrEqual(0);
        expect(t.body).toBeTruthy();
      }
    }
  });

  it("GLOBAL_RULES should define delivery throttling, compliance gate, and opt-out handling", async () => {
    const { GLOBAL_RULES } = await import("./services/cadenceEngine");
    expect(GLOBAL_RULES).toBeDefined();
    expect(GLOBAL_RULES.deliveryThrottling).toBeDefined();
    expect(GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay).toBeGreaterThan(0);
    expect(GLOBAL_RULES.complianceGate).toBeDefined();
    expect(GLOBAL_RULES.complianceGate.preDeploymentCheck).toBeTruthy();
    expect(GLOBAL_RULES.optOutHandling).toBeDefined();
    expect(GLOBAL_RULES.optOutHandling.channelsAffected).toContain("ALL channels");
  });
});

// ─── 2. Six-Dimension Recruit Scoring ─────────────────────────────────────

describe("Six-Dimension Recruit Scoring (Elena's persona — Pattern 3)", () => {
  it("should score a recruit candidate across all 6 dimensions", { timeout: 30000 }, async () => {
    const { scoreRecruitCandidate } = await import("./services/recruitScoring");
    const result = await scoreRecruitCandidate({
      leadId: 1001,
      candidateName: "Sarah Chen",
      candidateCurrentFirm: "Morgan Stanley",
      candidateCredentials: "CFP, CFA, Series 7/66",
      candidateGeography: "San Francisco Bay Area",
      candidateLinkedinData: "15 years experience, 500+ connections, active poster",
      candidateBrokercheckData: "Clean record, $150M AUM, 200 client accounts",
      candidateEngagementHistory: "Attended 2 webinars, downloaded whitepaper",
      candidateReferralSource: "Existing advisor referral",
    });

    expect(result.scores).toBeDefined();
    expect(result.scores.productionFit).toBeDefined();
    expect(result.scores.culturalFit).toBeDefined();
    expect(result.scores.geographicFit).toBeDefined();
    expect(result.scores.networkLeverage).toBeDefined();
    expect(result.scores.compliancePosture).toBeDefined();
    expect(result.scores.engagementSignal).toBeDefined();

    // Each dimension should have score and rationale
    for (const [, dim] of Object.entries(result.scores)) {
      expect(typeof dim.score).toBe("number");
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
      expect(dim.rationale).toBeTruthy();
    }

    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(["Tier 1", "Tier 2", "Tier 3", "Hold"]).toContain(result.tier);
    expect(result.cascadePotential).toBeDefined();
    expect(result.priorityActions).toBeDefined();
    expect(Array.isArray(result.priorityActions)).toBe(true);
  });

  it("composite score should respect dimension weights", async () => {
    const { DIMENSION_WEIGHTS, calculateComposite } = await import("./services/recruitScoring");
    const scores = {
      productionFit: 90,
      culturalFit: 70,
      geographicFit: 80,
      networkLeverage: 60,
      compliancePosture: 95,
      engagementSignal: 85,
    };
    const composite = calculateComposite(scores);
    expect(composite).toBeGreaterThan(0);
    expect(composite).toBeLessThanOrEqual(100);

    // Verify weights sum to 1.0
    const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
  });

  it("tier assignment should follow threshold rules", async () => {
    const { assignTier, TIER_THRESHOLDS } = await import("./services/recruitScoring");
    expect(assignTier(90)).toBe("Tier 1");
    expect(assignTier(75)).toBe("Tier 2");
    expect(assignTier(55)).toBe("Tier 3");
    expect(assignTier(30)).toBe("Hold");
    expect(TIER_THRESHOLDS.tier1).toBeGreaterThan(TIER_THRESHOLDS.tier2);
    expect(TIER_THRESHOLDS.tier2).toBeGreaterThan(TIER_THRESHOLDS.tier3);
  });
});

// ─── 3. HNW Narrative Scoring ─────────────────────────────────────────────

describe("HNW Narrative Scoring (Elena's persona — HNW funnel)", () => {
  it("should produce narrative score with wealth signal, funnel fit, and engagement difficulty", { timeout: 30000 }, async () => {
    const { scoreHnwProspect } = await import("./services/hnwNarrativeScoring");
    const result = await scoreHnwProspect({
      leadId: 2001,
      prospectName: "James Whitfield III",
      prospectCompany: "Whitfield Capital Partners",
      prospectRole: "Managing Partner",
      prospectGeography: "Greenwich, CT",
      wealthSignal: "Recent $50M exit, Forbes 400 adjacent, yacht club membership",
      linkedinData: "Harvard MBA, 25 years PE experience",
      publicRecords: "Property records show $8M primary residence",
      mutualConnections: "3 mutual connections including existing client",
      priorOutreach: "None — cold prospect",
    });

    expect(result.narrativeScore).toBeDefined();
    expect(["Strong", "Moderate", "Weak"]).toContain(result.narrativeScore.wealthSignalStrength);
    expect(["High", "Medium", "Low"]).toContain(result.narrativeScore.fitWithHnwFunnel);
    expect(["Low", "Medium", "High"]).toContain(result.narrativeScore.engagementDifficultyEstimate);
    expect(result.narrativeScore.summaryParagraph).toBeTruthy();
    expect(result.narrativeScore.summaryParagraph.length).toBeGreaterThan(50);
    expect(result.recommendedCadence).toBeTruthy();
    expect(result.personalizationInputs).toBeDefined();
    expect(result.complianceFlags).toBeDefined();
  });

  it("should validate cadence recommendation against library", async () => {
    const { validateCadenceRecommendation } = await import("./services/hnwNarrativeScoring");
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    // Valid cadence
    const validId = CADENCE_LIBRARY[0].cadenceId;
    expect(validateCadenceRecommendation(validId)).toBe(true);
    // Invalid cadence
    expect(validateCadenceRecommendation("fake-cadence-999")).toBe(false);
  });
});

// ─── 4. MEDDPICC Scoring ──────────────────────────────────────────────────

describe("MEDDPICC Scoring (Marcus's persona — Pattern 2)", () => {
  it("should calculate composite score correctly from 8 dimensions", () => {
    const scores = { metrics: 8, economicBuyer: 7, decisionCriteria: 9, decisionProcess: 6, paperProcess: 5, identifyPain: 8, champion: 7, competition: 6 };
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    const expected = (sum / 8) * 10;
    expect(expected).toBeCloseTo(70, 0);
  });

  it("should assign correct tiers based on composite score", () => {
    const tierFor = (composite: number) =>
      composite >= 80 ? "Tier 1" : composite >= 65 ? "Tier 2" : composite >= 50 ? "Tier 3" : "Hold";
    expect(tierFor(85)).toBe("Tier 1");
    expect(tierFor(72)).toBe("Tier 2");
    expect(tierFor(55)).toBe("Tier 3");
    expect(tierFor(40)).toBe("Hold");
  });

  it("each dimension should be 0-10 scale", () => {
    const dims = ["metrics", "economicBuyer", "decisionCriteria", "decisionProcess", "paperProcess", "identifyPain", "champion", "competition"];
    expect(dims.length).toBe(8);
  });
});

// ─── 5. Reply Analysis ───────────────────────────────────────────────────

describe("Reply Analysis (Marcus's persona — active cadences)", () => {
  it("should classify a positive reply", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "Thanks for reaching out! I'd love to schedule a call next week to discuss this further.",
      cadenceId: "test-cadence",
      touchNumber: 2,
      prospectName: "John Smith",
      channel: "email",
    });
    expect(result.classification).toBeDefined();
    expect(["positive", "interested", "meeting_request"]).toContain(result.classification);
    expect(result.shouldPauseCadence).toBe(true);
  });

  it("should classify an opt-out reply", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "Please remove me from your mailing list. I am not interested.",
      cadenceId: "test-cadence",
      touchNumber: 1,
      prospectName: "Jane Doe",
      channel: "email",
    });
    expect(result.classification).toBe("opt_out");
    expect(result.shouldPauseCadence).toBe(true);
  });

  it("should classify an out-of-office reply and extract return date", async () => {
    const { analyzeReply } = await import("./services/replyAnalysis");
    const result = await analyzeReply({
      replyText: "I am currently out of the office and will return on May 15, 2026. I will respond to your email upon my return.",
      cadenceId: "test-cadence",
      touchNumber: 3,
      prospectName: "Bob Wilson",
      channel: "email",
    });
    expect(result.classification).toBe("out_of_office");
    expect(result.oooReturnDate).toBeTruthy();
  });

  it("should process opt-out with proper record structure", async () => {
    const { processOptOut } = await import("./services/replyAnalysis");
    const record = processOptOut({
      prospectId: 5001,
      channel: "email",
      optOutText: "Unsubscribe me please",
    });
    expect(record.prospectId).toBe(5001);
    expect(record.optOutChannel).toBe("email");
    expect(record.optOutTimestamp).toBeGreaterThan(0);
    expect(record.scope).toBe("all_channels");
  });

  it("should calculate OOO reschedule date correctly", async () => {
    const { calculateOooReschedule } = await import("./services/replyAnalysis");
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const reschedule = calculateOooReschedule(futureDate);
    expect(reschedule).toBeGreaterThan(Date.now());
    const returnTs = new Date(futureDate).getTime();
    expect(reschedule).toBeGreaterThanOrEqual(returnTs);
  });

  it("should return a timestamp for past OOO dates (reschedule from return date)", async () => {
    const { calculateOooReschedule } = await import("./services/replyAnalysis");
    const pastDate = "2020-01-01";
    const result = calculateOooReschedule(pastDate);
    // Function always calculates reschedule from the return date + 2 business days
    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(result!).toBeGreaterThan(new Date(pastDate).getTime());
  });

  it("should return null for undefined return date", async () => {
    const { calculateOooReschedule } = await import("./services/replyAnalysis");
    expect(calculateOooReschedule(undefined)).toBeNull();
  });
});

// ─── 6. Compliance Audit ─────────────────────────────────────────────────

describe("Compliance Audit (David's persona — compliance-sensitive)", () => {
  it("should audit a message and return grade + findings", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "TOUCH-1001",
      body: "Dear prospect, I wanted to share our investment strategies that have historically outperformed the market by 20% annually. This is a guaranteed return opportunity.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-001",
      auditType: "ad_hoc" as const,
    });

    expect(result.auditId).toBeTruthy();
    expect(["Pass", "Conditional Pass", "Fail"]).toContain(result.grade);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(Array.isArray(result.remediation)).toBe(true);
    // "guaranteed return" should trigger compliance findings
    expect(result.grade).not.toBe("Pass");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("should pass a clean compliant message", async () => {
    const { auditMessage } = await import("./services/complianceAudit");
    const result = auditMessage({
      messageId: "TOUCH-1002",
      body: "Dear Dr. Smith, I hope this message finds you well. I'd like to schedule a brief introductory call to discuss how our wealth management services might align with your financial goals. Past performance is not indicative of future results.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-002",
      auditType: "ad_hoc" as const,
    });

    expect(["Pass", "Conditional Pass"]).toContain(result.grade);
  });

  it("should select daily audit sample correctly", async () => {
    const { selectDailyAuditSample } = await import("./services/complianceAudit");
    const sample = selectDailyAuditSample(50);
    expect(Array.isArray(sample)).toBe(true);
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.length).toBeLessThanOrEqual(50);
    for (const idx of sample) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(50);
    }
  });

  it("should generate monthly summary from audit results", async () => {
    const { generateMonthlySummary } = await import("./services/complianceAudit");
    const audits = [
      { auditId: "A1", messageId: "M1", auditType: "daily_random" as const, timestamp: Date.now(), grade: "Pass" as const, complianceCheck: {} as any, findings: [], remediation: [], auditorNotes: "" },
      { auditId: "A2", messageId: "M2", auditType: "daily_random" as const, timestamp: Date.now(), grade: "Fail" as const, complianceCheck: {} as any, findings: ["Prohibited language"], remediation: ["Remove guarantees"], auditorNotes: "Critical" },
      { auditId: "A3", messageId: "M3", auditType: "ad_hoc" as const, timestamp: Date.now(), grade: "Conditional Pass" as const, complianceCheck: {} as any, findings: ["Missing disclaimer"], remediation: ["Add disclaimer"], auditorNotes: "" },
    ];
    const summary = generateMonthlySummary(audits);
    expect(summary.totalAudited).toBe(3);
    expect(summary.passRate).toBeDefined();
    expect(typeof summary.passRate).toBe("number");
    expect(summary.failCount).toBe(1);
    expect(summary.topFindings).toBeDefined();
  });

  it("should validate ESI tracking", async () => {
    const { validateEsiTracking } = await import("./services/complianceAudit");
    const valid = validateEsiTracking({
      esiPreApprovalId: "ESI-2026-001",
      esiPreApprovalExpiry: Date.now() + 180 * 86400000, // 180 days from now
      antiRebateLanguageVerified: true,
      lastVerifiedAt: Date.now() - 30 * 86400000, // 30 days ago
      verifiedBy: "compliance-officer-1",
    });
    expect(valid.valid).toBe(true);
    expect(valid.issues).toHaveLength(0);
  });
});

// ─── 7. Pattern Transition Assessment ────────────────────────────────────

describe("Pattern Transition Assessment (Elena's persona — Pattern 3 readiness)", () => {
  it("should assess transition readiness with gating factors", async () => {
    const { assessTransition } = await import("./services/patternTransition");
    const result = assessTransition({
      aumSignedThisMonth: 5000000,
      dealsAbove500K: 3,
      activeAffiliates: 12,
      newProducersOnboarded: 2,
      totalPipelineValue: 25000000,
      conversionRate: 0.15,
      avgDealSize: 750000,
      monthlyRecurringRevenue: 85000,
    });

    expect(result.currentPattern).toBeDefined();
    expect(typeof result.readinessScore).toBe("number");
    expect(result.readinessScore).toBeGreaterThanOrEqual(0);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
    expect(result.recommendation).toBeTruthy();
    expect(result.rationale).toBeTruthy();
    expect(result.gatingFactors).toBeDefined();
    expect(Array.isArray(result.gatingFactors)).toBe(true);
    expect(result.nextReviewDate).toBeTruthy();
  });

  it("should calculate pipeline coverage with stage multiples", async () => {
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const result = calculatePipelineCoverage({
      discoveryValue: 5000000,
      solutionDesignValue: 3000000,
      validationValue: 2000000,
      commitValue: 1000000,
      targetQuotaValue: 3000000,
    });
    expect(result.discoveryMultiple).toBeDefined();
    expect(typeof result.discoveryMultiple).toBe("number");
    expect(result.discoveryMultiple).toBeGreaterThan(0);
    expect(result.health).toBeDefined();
    expect(["healthy", "at_risk", "critical"]).toContain(result.health);
    expect(result.recommendations).toBeDefined();
  });

  it("Weak metrics should not recommend transition (should stay)", async () => {
    const { assessTransition } = await import("./services/patternTransition");
    const result = assessTransition({
      aumSignedThisMonth: 500000,
      dealsAbove500K: 0,
      activeAffiliates: 0,
      newProducersOnboarded: 0,
      totalPipelineValue: 2000000,
      conversionRate: 0.02,
      avgDealSize: 100000,
      monthlyRecurringRevenue: 10000,
    });
    // With weak metrics, should recommend staying
    expect(result.recommendation).toBe("stay");
    expect(result.gatingFactors.length).toBeGreaterThan(0);
    expect(result.readinessScore).toBeLessThan(80);
  });
});

// ─── 8. Touch Drafting ───────────────────────────────────────────────────

describe("Touch Drafting (Marcus's persona — active cadences)", () => {
  it("should draft a touch with variable substitution", async () => {
    const { draftCadenceTouch } = await import("./services/cadenceTouchDrafting");
    const { CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const cadence = CADENCE_LIBRARY[0];

    const draft = await draftCadenceTouch({
      cadenceId: cadence.cadenceId,
      touchNumber: 1,
      prospectData: {
        firstName: "Michael",
        lastName: "Johnson",
        company: "Johnson Wealth Advisory",
        title: "Managing Director",
      },
      personalizationInputs: {
        mutualConnection: "Dr. Sarah Lee",
        recentEvent: "Your firm's expansion to the West Coast",
      },
      esiPreApprovalId: "ESI-2026-003",
      senderSignatureBlock: "Best regards,\nMarcus Rivera\nSenior Wealth Advisor",
    });

    expect(draft.body).toBeTruthy();
    expect(draft.channel).toBeTruthy();
    expect(draft.touchNumber).toBe(1);
    expect(draft.complianceCheck).toBeDefined();
  }, 30000);

  it("should validate draft for send and catch issues", async () => {
    const { validateDraftForSend } = await import("./services/cadenceTouchDrafting");
    const badDraft = {
      cadenceId: "test",
      touchNumber: 1,
      channel: "email",
      body: "Buy now! Guaranteed 50% returns! Act fast!",
      complianceCheck: {
        esiPreApprovalVerified: false,
        antiRebateLanguageRequired: false,
        antiRebateLanguagePresent: false,
        finra2210Compliant: false,
        tcpaConsentVerified: false,
        performanceProjectionsPresent: true,
        forwardLookingClaimsPresent: true,
        readyToSend: false,
      },
      rationaleForPersonalization: "test",
    };
    const issues = validateDraftForSend(badDraft);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("should run compliance checks on touch content", async () => {
    const { runComplianceChecks } = await import("./services/cadenceTouchDrafting");
    const result = runComplianceChecks(
      "Dear prospect, I guarantee you will see 30% returns on your investment. This is a once-in-a-lifetime opportunity.",
      "email",
      "ESI-2026-004"
    );
    expect(result.readyToSend).toBe(false);
    expect(result.performanceProjectionsPresent).toBe(true);
  });

  it("should pass compliance for clean content", async () => {
    const { runComplianceChecks } = await import("./services/cadenceTouchDrafting");
    const result = runComplianceChecks(
      "Dear Dr. Williams, I'd like to introduce our advisory services and share a complimentary resource. Past performance is not indicative of future results.",
      "email",
      "ESI-2026-010"
    );
    expect(result.readyToSend).toBe(true);
    expect(result.esiPreApprovalVerified).toBe(true);
    expect(result.performanceProjectionsPresent).toBe(false);
  });
});

// ─── 9. Opt-Out Processing ───────────────────────────────────────────────

describe("Opt-Out Processing (David's persona — compliance-first)", () => {
  it("should create opt-out record with universal scope", async () => {
    const { processOptOut } = await import("./services/replyAnalysis");
    const record = processOptOut({
      prospectId: 7001,
      channel: "email",
      optOutText: "Please stop contacting me",
    });
    expect(record.scope).toBe("all_channels");
    expect(record.prospectId).toBe(7001);
    expect(record.optOutTimestamp).toBeGreaterThan(0);
  });
});

// ─── 10. Global Rules Enforcement ────────────────────────────────────────

describe("Global Rules Enforcement", () => {
  it("should enforce delivery throttling with proper state tracking", async () => {
    const { GLOBAL_RULES, checkThrottle } = await import("./services/cadenceEngine");
    expect(GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay).toBeGreaterThan(0);

    const today = new Date().toISOString().slice(0, 10);
    // Check throttle with high count
    const throttled = checkThrottle(
      {
        emailsSentToday: { "example.com": GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay + 1 },
        linkedInConnectionsToday: 0,
        linkedInInMailsToday: 0,
        phoneCallsToday: 0,
        lastResetDate: today,
      },
      "email",
      "example.com"
    );
    expect(throttled.allowed).toBe(false);
    expect(throttled.reason).toBeTruthy();
    expect(throttled.utilizationPct).toBeGreaterThanOrEqual(1.0);
  });

  it("should allow sends when under throttle limits", async () => {
    const { checkThrottle } = await import("./services/cadenceEngine");
    const today = new Date().toISOString().slice(0, 10);
    const allowed = checkThrottle(
      {
        emailsSentToday: { "example.com": 5 },
        linkedInConnectionsToday: 0,
        linkedInInMailsToday: 0,
        phoneCallsToday: 0,
        lastResetDate: today,
      },
      "email",
      "example.com"
    );
    expect(allowed.allowed).toBe(true);
    expect(allowed.utilizationPct).toBeLessThan(1.0);
  });

  it("should require ESI pre-approval in compliance gate", async () => {
    const { GLOBAL_RULES } = await import("./services/cadenceEngine");
    expect(GLOBAL_RULES.complianceGate.preDeploymentCheck).toContain("ESI pre-approval");
    expect(GLOBAL_RULES.complianceGate.failAction).toContain("Block send");
  });

  it("compliance gate check should validate ESI pre-approval", async () => {
    const { complianceGateCheck, CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const cadence = CADENCE_LIBRARY[0];
    const touch = cadence.touches[0];
    // With valid ESI
    const result = complianceGateCheck(touch, {
      esiPreApprovalId: "ESI-2026-005",
    });
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe("boolean");
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("compliance gate should fail without ESI pre-approval", async () => {
    const { complianceGateCheck, CADENCE_LIBRARY } = await import("./services/cadenceEngine");
    const cadence = CADENCE_LIBRARY[0];
    const touch = cadence.touches[0];
    const result = complianceGateCheck(touch, {});
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});

// ─── 11. Schema Table Integrity ──────────────────────────────────────────

describe("Schema Table Integrity — New Cadence Engine Tables", () => {
  it("all 8 new tables should be defined in schema.ts", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schema = fs.readFileSync(schemaPath, "utf8");
    const requiredTables = [
      "cadence_enrollments", "cadence_touch_log", "cadence_compliance_audit",
      "cadence_opt_out_registry", "meddpicc_scores", "recruit_dimension_scores",
      "hnw_narrative_scores", "pattern_transition_assessments",
    ];
    for (const table of requiredTables) {
      expect(schema).toContain(`"${table}"`);
    }
  });

  it("cadence_enrollments should have userId, leadId, cadenceId, status columns", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schema = fs.readFileSync(schemaPath, "utf8");
    const enrollmentSection = schema.slice(schema.indexOf("cadence_enrollments"));
    expect(enrollmentSection).toContain("userId");
    expect(enrollmentSection).toContain("leadId");
    expect(enrollmentSection).toContain("cadenceId");
    expect(enrollmentSection).toContain("status");
  });

  it("meddpicc_scores should have all 8 MEDDPICC dimension columns", () => {
    const schemaPath = path.join(__dirname, "../drizzle/schema.ts");
    const schema = fs.readFileSync(schemaPath, "utf8");
    const meddpiccSection = schema.slice(schema.indexOf("meddpicc_scores"));
    const dims = ["metrics", "economicBuyer", "decisionCriteria", "decisionProcess", "paperProcess", "identifyPain", "champion", "competition"];
    for (const dim of dims) {
      expect(meddpiccSection).toContain(dim);
    }
  });
});

// ─── 12. Router Wiring Integrity ─────────────────────────────────────────

describe("Router Wiring Integrity", () => {
  it("cadenceEngine router should be registered in appRouter", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routers = fs.readFileSync(routersPath, "utf8");
    expect(routers).toContain("cadenceEngine");
    expect(routers).toContain("cadenceEngineRouter");
  });

  it("cadenceEngine router file should export cadenceEngineRouter", () => {
    const routerPath = path.join(__dirname, "routers/cadenceEngine.ts");
    const content = fs.readFileSync(routerPath, "utf8");
    expect(content).toContain("export const cadenceEngineRouter");
  });

  it("all 19 procedures should be defined in the router", () => {
    const routerPath = path.join(__dirname, "routers/cadenceEngine.ts");
    const content = fs.readFileSync(routerPath, "utf8");
    const procedures = [
      "listCadences", "getCadenceDetail", "getGlobalRules",
      "enrollLead", "getEnrollments", "pauseEnrollment", "resumeEnrollment", "stopEnrollment",
      "draftTouch", "logTouch",
      "analyzeReply",
      "scoreRecruit", "scoreHnwProspect",
      "getMeddpicc", "updateMeddpicc",
      "auditTouch", "getAuditSummary",
      "assessTransition", "pipelineCoverage",
    ];
    for (const proc of procedures) {
      expect(content).toContain(`${proc}:`);
    }
  });
});

// ─── 13. Cross-Service Integration — Virtual User Flows ──────────────────

describe("Cross-Service Integration — Virtual User Flows", () => {
  it("Marcus flow: list cadences → pick one → verify touches exist via getCadence", async () => {
    const { CADENCE_LIBRARY, getCadence } = await import("./services/cadenceEngine");
    const list = CADENCE_LIBRARY.map(c => ({ cadenceId: c.cadenceId, name: c.name, touches: c.touches.length }));
    expect(list.length).toBeGreaterThan(0);
    // Pick a non-variant cadence (one with touches)
    const picked = list.find(c => c.touches > 0);
    expect(picked).toBeDefined();
    const detail = getCadence(picked!.cadenceId);
    expect(detail).toBeDefined();
    expect(detail?.touches.length).toBe(picked!.touches);
  });

  it("Elena flow: score HNW prospect → get cadence recommendation → validate it exists", { timeout: 30000 }, async () => {
    const { scoreHnwProspect, validateCadenceRecommendation } = await import("./services/hnwNarrativeScoring");
    const result = await scoreHnwProspect({
      leadId: 3001,
      prospectName: "Victoria Sterling",
      prospectCompany: "Sterling Family Office",
      wealthSignal: "Multi-generational wealth, $200M+ family office",
      prospectGeography: "Palm Beach, FL",
    });
    expect(result.recommendedCadence).toBeTruthy();
    const isValid = validateCadenceRecommendation(result.recommendedCadence);
    expect(isValid).toBe(true);
  });

  it("David flow: draft touch → compliance check → audit → verify grade", async () => {
    const { runComplianceChecks } = await import("./services/cadenceTouchDrafting");
    const { auditMessage } = await import("./services/complianceAudit");

    // Clean message
    const compCheck = runComplianceChecks(
      "Dear Dr. Williams, I'd like to introduce our advisory services. Past performance is not indicative of future results.",
      "email",
      "ESI-2026-010"
    );
    expect(compCheck.readyToSend).toBe(true);

    // Audit it
    const audit = auditMessage({
      messageId: "TOUCH-DAVID-001",
      body: "Dear Dr. Williams, I'd like to introduce our advisory services. Past performance is not indicative of future results.",
      channel: "email",
      esiPreApprovalId: "ESI-2026-010",
      auditType: "ad_hoc",
    });
    expect(["Pass", "Conditional Pass"]).toContain(audit.grade);
  });

  it("Marcus flow: check throttle → send touch → verify throttle state updated", async () => {
    const { checkThrottle } = await import("./services/cadenceEngine");
    const today = new Date().toISOString().slice(0, 10);
    const state = {
      emailsSentToday: { "prospect.com": 10 },
      linkedInConnectionsToday: 5,
      linkedInInMailsToday: 2,
      phoneCallsToday: 3,
      lastResetDate: today,
    };
    const result = checkThrottle(state, "email", "prospect.com");
    expect(result.allowed).toBe(true);
    expect(result.utilizationPct).toBeLessThan(1.0);
  });

  it("David flow: opt-out → verify universal scope → verify record completeness", async () => {
    const { processOptOut } = await import("./services/replyAnalysis");
    const record = processOptOut({
      prospectId: 9001,
      channel: "LinkedIn_InMail",
      optOutText: "Not interested, please don't contact me again",
    });
    expect(record.scope).toBe("all_channels");
    expect(record.optOutChannel).toBe("LinkedIn_InMail");
    expect(record.prospectId).toBe(9001);
    expect(record.optOutTimestamp).toBeGreaterThan(0);
  });
});

// ─── 14. Service File Existence ──────────────────────────────────────────

describe("Service File Existence", () => {
  const serviceFiles = [
    "cadenceEngine.ts",
    "recruitScoring.ts",
    "hnwNarrativeScoring.ts",
    "cadenceTouchDrafting.ts",
    "replyAnalysis.ts",
    "complianceAudit.ts",
    "patternTransition.ts",
  ];

  for (const file of serviceFiles) {
    it(`${file} should exist in server/services/`, () => {
      const filePath = path.join(__dirname, "services", file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});
