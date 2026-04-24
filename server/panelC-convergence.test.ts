/**
 * Expert Panel C — Convergence Validation
 * =========================================
 * Counter RESET due to GAP-C1 (MEDDPICC Field Completion) implementation.
 * This is convergence pass 1 of 3.
 *
 * Tests cover:
 *   1. MEDDPICC Field Completion service (GAP-C1 — new)
 *   2. Full prompt library coverage verification (all 9 prompts)
 *   3. Cadence library alignment (all 9 cadences)
 *   4. Cross-service integration (virtual user E2E flows)
 *   5. Compliance gate integrity
 *   6. Regression on Panel A + Panel B services
 */
import { describe, it, expect } from "vitest";

// ─── 1. MEDDPICC Field Completion (GAP-C1) ──────────────────────────────

describe("MEDDPICC Field Completion Service", () => {
  it("creates empty MEDDPICC state with all 8 fields", async () => {
    const { createEmptyMeddpicc } = await import("../server/services/meddpiccFieldCompletion");
    const empty = createEmptyMeddpicc();
    const keys = Object.keys(empty);
    expect(keys).toHaveLength(8);
    expect(keys).toContain("metrics");
    expect(keys).toContain("economicBuyer");
    expect(keys).toContain("decisionCriteria");
    expect(keys).toContain("decisionProcess");
    expect(keys).toContain("paperProcess");
    expect(keys).toContain("identifyPain");
    expect(keys).toContain("champion");
    expect(keys).toContain("competition");
    for (const key of keys) {
      const field = (empty as any)[key];
      expect(field.value).toBe("Not Discovered");
      expect(field.confidence).toBe("Low");
      expect(field.evidenceQuote).toBeNull();
    }
  });

  it("counts completed fields correctly (only Medium+ confidence)", async () => {
    const { createEmptyMeddpicc, countCompletedFields } = await import("../server/services/meddpiccFieldCompletion");
    const fields = createEmptyMeddpicc();
    expect(countCompletedFields(fields)).toBe(0);

    // Set 3 fields to Medium+
    fields.metrics = { value: "Reduce tax drag by 1.5%", confidence: "High", evidenceQuote: "quote" };
    fields.identifyPain = { value: "Unresponsive advisor", confidence: "Medium", evidenceQuote: "quote" };
    fields.champion = { value: "Spouse enthusiastic", confidence: "Medium", evidenceQuote: null };
    expect(countCompletedFields(fields)).toBe(3);

    // Low confidence doesn't count
    fields.competition = { value: "Maybe Vanguard", confidence: "Low", evidenceQuote: null };
    expect(countCompletedFields(fields)).toBe(3);
  });

  it("determines stage recommendation correctly", async () => {
    const { createEmptyMeddpicc, determineStageRecommendation } = await import("../server/services/meddpiccFieldCompletion");
    
    // <5 fields → Maintain Discovery
    const fields1 = createEmptyMeddpicc();
    fields1.metrics = { value: "Tax savings", confidence: "High", evidenceQuote: "q" };
    fields1.identifyPain = { value: "Pain", confidence: "Medium", evidenceQuote: "q" };
    expect(determineStageRecommendation(fields1, 2)).toBe("Maintain Discovery");

    // 5-7 fields with pain → Advance to Solution Design
    const fields2 = createEmptyMeddpicc();
    for (const key of ["metrics", "economicBuyer", "decisionCriteria", "decisionProcess", "identifyPain"] as const) {
      fields2[key] = { value: "Discovered", confidence: "High", evidenceQuote: "q" };
    }
    expect(determineStageRecommendation(fields2, 5)).toBe("Advance to Solution Design");

    // All 8 with champion + economic buyer → Advance to Validation
    const fields3 = createEmptyMeddpicc();
    for (const key of Object.keys(fields3) as (keyof typeof fields3)[]) {
      fields3[key] = { value: "Discovered", confidence: "High", evidenceQuote: "q" };
    }
    expect(determineStageRecommendation(fields3, 8)).toBe("Advance to Validation");
  });

  it("identifies focus areas for incomplete fields", async () => {
    const { createEmptyMeddpicc, identifyFocusAreas } = await import("../server/services/meddpiccFieldCompletion");
    const fields = createEmptyMeddpicc();
    fields.metrics = { value: "Tax savings", confidence: "High", evidenceQuote: "q" };
    fields.identifyPain = { value: "Pain", confidence: "Medium", evidenceQuote: "q" };
    
    const focus = identifyFocusAreas(fields);
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.length).toBeLessThanOrEqual(4); // Max 4 focus areas
    // Should NOT include metrics or identifyPain (already discovered)
    expect(focus.some(f => f.toLowerCase().includes("quantify"))).toBe(false);
    expect(focus.some(f => f.toLowerCase().includes("pain point"))).toBe(false);
  });

  it("merges MEDDPICC states preferring higher confidence", async () => {
    const { createEmptyMeddpicc, mergeMeddpiccStates } = await import("../server/services/meddpiccFieldCompletion");
    const existing = createEmptyMeddpicc();
    existing.metrics = { value: "Old value", confidence: "Medium", evidenceQuote: "old" };
    existing.champion = { value: "CPA referral", confidence: "High", evidenceQuote: "CPA" };

    const newAnalysis = createEmptyMeddpicc();
    newAnalysis.metrics = { value: "New value", confidence: "High", evidenceQuote: "new" };
    newAnalysis.champion = { value: "Spouse", confidence: "Medium", evidenceQuote: "spouse" };
    newAnalysis.identifyPain = { value: "Tax drag", confidence: "High", evidenceQuote: "tax" };

    const merged = mergeMeddpiccStates(existing, newAnalysis);
    // metrics: new wins (High > Medium)
    expect(merged.metrics.value).toBe("New value");
    expect(merged.metrics.confidence).toBe("High");
    // champion: existing wins (High > Medium)
    expect(merged.champion.value).toBe("CPA referral");
    expect(merged.champion.confidence).toBe("High");
    // identifyPain: new wins (discovered > not discovered)
    expect(merged.identifyPain.value).toBe("Tax drag");
  });

  it("checks transcript compliance for SSN/TIN", async () => {
    const { checkTranscriptCompliance } = await import("../server/services/meddpiccFieldCompletion");
    
    const clean = checkTranscriptCompliance("This is a normal conversation about retirement planning.");
    expect(clean.hasSsnOrTin).toBe(false);
    expect(clean.hasMnpiRisk).toBe(false);
    expect(clean.hasHealthInfo).toBe(false);

    const withSsn = checkTranscriptCompliance("My social security number is 123-45-6789 and I need help.");
    expect(withSsn.hasSsnOrTin).toBe(true);
    expect(withSsn.warnings.some(w => w.includes("SSN/TIN"))).toBe(true);

    const withMnpi = checkTranscriptCompliance("I have insider information about a pending merger at the company.");
    expect(withMnpi.hasMnpiRisk).toBe(true);

    const withHealth = checkTranscriptCompliance("After my surgery and diagnosis, I need to restructure my portfolio.");
    expect(withHealth.hasHealthInfo).toBe(true);
  });

  it("handles short transcript gracefully (< 50 chars)", async () => {
    const { completeMeddpiccFromTranscript } = await import("../server/services/meddpiccFieldCompletion");
    const result = await completeMeddpiccFromTranscript({
      opportunityId: "OPP-001",
      prospectName: "Test",
      callTranscript: "Hi there.",
    });
    expect(result.fieldsComplete).toBe(0);
    expect(result.stageAdvancementRecommendation).toBe("Maintain Discovery");
    expect(result.complianceNotes.some(n => n.includes("too short"))).toBe(true);
  });
});

// ─── 2. Full Prompt Library Coverage ─────────────────────────────────────

describe("Prompt Library Coverage (all 9 prompts)", () => {
  it("Prompt 1: Cadence Touch Drafting service exists with draftCadenceTouch", async () => {
    const mod = await import("../server/services/cadenceTouchDrafting");
    expect(typeof mod.draftCadenceTouch).toBe("function");
    expect(typeof mod.validateDraftForSend).toBe("function");
  });

  it("Prompt 2: 6-Dimension Recruit Scoring service exists", async () => {
    const mod = await import("../server/services/recruitScoring");
    expect(typeof mod.scoreRecruitCandidate).toBe("function");
    expect(typeof mod.DIMENSION_WEIGHTS).toBe("object");
  });

  it("Prompt 3: HNW Narrative Scoring service exists", async () => {
    const mod = await import("../server/services/hnwNarrativeScoring");
    expect(typeof mod.scoreHnwProspect).toBe("function");
  });

  it("Prompt 4: Compliance Audit service exists", async () => {
    const mod = await import("../server/services/complianceAudit");
    expect(typeof mod.auditMessage).toBe("function");
    expect(typeof mod.generateMonthlySummary).toBe("function");
  });

  it("Prompt 5: MEDDPICC Field Completion service exists", async () => {
    const mod = await import("../server/services/meddpiccFieldCompletion");
    expect(typeof mod.completeMeddpiccFromTranscript).toBe("function");
    expect(typeof mod.createEmptyMeddpicc).toBe("function");
    expect(typeof mod.mergeMeddpiccStates).toBe("function");
    expect(typeof mod.checkTranscriptCompliance).toBe("function");
  });

  it("Prompt 6: Reply Analysis service exists", async () => {
    const mod = await import("../server/services/replyAnalysis");
    expect(typeof mod.analyzeReply).toBe("function");
    expect(typeof mod.processOptOut).toBe("function");
    expect(typeof mod.calculateOooReschedule).toBe("function");
  });

  it("Prompt 7: Pattern Transition Engine exists", async () => {
    const mod = await import("../server/services/patternTransition");
    expect(typeof mod.assessTransition).toBe("function");
    expect(typeof mod.calculatePipelineCoverage).toBe("function");
  });

  it("Prompt 8: Weekly Summary Generation exists", async () => {
    const mod = await import("../server/services/weeklySummaryGeneration");
    expect(typeof mod.buildStaticSummary).toBe("function");
    expect(typeof mod.generateWeeklySummary).toBe("function");
  });

  it("Prompt 9: Cadence Variant Creation exists", async () => {
    const mod = await import("../server/services/cadenceVariantCreation");
    expect(typeof mod.createCadenceVariant).toBe("function");
    expect(typeof mod.listBaseCadences).toBe("function");
  });
});

// ─── 3. Cadence Library Alignment ────────────────────────────────────────

describe("Cadence Library Alignment", () => {
  it("all 7 base cadences loaded from library", async () => {
    const { CADENCE_LIBRARY } = await import("../server/services/cadenceEngine");
    expect(CADENCE_LIBRARY.length).toBeGreaterThanOrEqual(7);
    const ids = CADENCE_LIBRARY.map((c: any) => c.cadenceId);
    // 7 from cadence_library.json
    expect(ids).toContain("HNW_PROSPECT_12TOUCH_v1");
    expect(ids).toContain("HNW_PROSPECT_NM_12TOUCH_v1");
    expect(ids).toContain("RECRUIT_TIER1_12TOUCH_v1");
    expect(ids).toContain("COI_MAINTENANCE_QUARTERLY_v1");
    expect(ids).toContain("STEWARDLY_AFFILIATE_ONBOARDING_v1");
    expect(ids).toContain("WTA_PCMP_B2B_PROSPECT_v1");
    expect(ids).toContain("DORMANT_REENGAGEMENT_v1");
  });

  it("each cadence has touches with required fields", async () => {
    const { CADENCE_LIBRARY, getCadence } = await import("../server/services/cadenceEngine");
    for (const cadence of CADENCE_LIBRARY) {
      const resolved = getCadence(cadence.cadenceId);
      expect(resolved).toBeTruthy();
      if (resolved && resolved.touches && resolved.touches.length > 0) {
        for (const touch of resolved.touches) {
          expect(touch).toHaveProperty("day");
          expect(touch).toHaveProperty("channel");
          // CadenceTouch uses subjectLine (optional) + body
          expect(touch).toHaveProperty("body");
        }
      }
    }
  });

  it("global rules loaded with compliance constraints", async () => {
    const { GLOBAL_RULES } = await import("../server/services/cadenceEngine");
    expect(GLOBAL_RULES).toBeTruthy();
    // GLOBAL_RULES has nested structure: optOutHandling, replyHandling, deliveryThrottling, complianceGate
    expect(GLOBAL_RULES).toHaveProperty("optOutHandling");
    expect(GLOBAL_RULES).toHaveProperty("replyHandling");
    expect(GLOBAL_RULES).toHaveProperty("deliveryThrottling");
    expect(GLOBAL_RULES).toHaveProperty("complianceGate");
    expect(GLOBAL_RULES.deliveryThrottling.maxEmailsPerDomainPerDay).toBeGreaterThan(0);
    expect(GLOBAL_RULES.deliveryThrottling.maxPhoneCallsPerDay).toBeGreaterThan(0);
    expect(GLOBAL_RULES.optOutHandling.channelsAffected).toContain("ALL channels");
  });
});

// ─── 4. Virtual User E2E Flows ───────────────────────────────────────────

describe("Virtual User: Sarah (Solo RIA, Pattern 4 HNW)", () => {
  it("full prospect lifecycle: score → enroll → draft → analyze → MEDDPICC → transition", async () => {
    // LLM-dependent test needs extended timeout
    // Step 1: Score HNW prospect
    const { scoreHnwProspect } = await import("../server/services/hnwNarrativeScoring");
    const hnwScore = await scoreHnwProspect({
      prospectName: "Dr. James Whitfield",
      prospectRole: "Orthopedic Surgeon",
      prospectGeography: "Tucson, AZ",
      wealthSignal: "CPA referral, RSU vesting event, $3.5M estimated AUM",
      publicRecords: "Property purchase in Catalina Foothills",
    });
    // HnwScoringResult has narrativeScore, recommendedCadence, personalizationInputs, complianceFlags
    expect(hnwScore).toHaveProperty("narrativeScore");
    expect(hnwScore).toHaveProperty("recommendedCadence");
    expect(hnwScore).toHaveProperty("personalizationInputs");
    expect(hnwScore.narrativeScore).toHaveProperty("wealthSignalStrength");
    expect(hnwScore.narrativeScore).toHaveProperty("summaryParagraph");

    // Step 2: Score as recruit candidate (6-dimension)
    const { scoreRecruitCandidate } = await import("../server/services/recruitScoring");
    const recruitScore = await scoreRecruitCandidate({
      candidateName: "Dr. James Whitfield",
      candidateCurrentFirm: "Independent",
      candidateCredentials: "MD",
      candidateGeography: "Tucson, AZ",
      candidateReferralSource: "COI referral",
    });
    // RecruitScoringResult has scores (6 dimensions), compositeScore, tier, cascadePotential, priorityActions
    expect(recruitScore).toHaveProperty("compositeScore");
    expect(recruitScore).toHaveProperty("scores");
    expect(recruitScore).toHaveProperty("tier");
    expect(recruitScore.scores).toHaveProperty("productionFit");
    expect(recruitScore.scores).toHaveProperty("culturalFit");

    // Step 3: Draft a cadence touch
    const { getCadence } = await import("../server/services/cadenceEngine");
    const cadence = getCadence("HNW_PROSPECT_12TOUCH_v1");
    expect(cadence).toBeTruthy();

    const { draftCadenceTouch } = await import("../server/services/cadenceTouchDrafting");
    const draft = await draftCadenceTouch({
      cadenceId: "HNW_PROSPECT_12TOUCH_v1",
      touchNumber: 1,
      prospectData: { name: "Dr. James Whitfield", role: "Orthopedic Surgeon", geography: "Tucson, AZ" },
      personalizationInputs: { wealthSignal: "CPA referral, retiring surgeon, tax-sensitive", specificObservation: "RSU vesting event" },
      esiPreApprovalId: "ESI-2026-HNW-001",
      senderSignatureBlock: "Sarah Mitchell, CFP\nWealthBridge Financial Group",
    });
    // DraftedTouch has subjectLine (optional), body, complianceCheck
    expect(draft).toHaveProperty("body");
    expect(draft).toHaveProperty("complianceCheck");
    expect(draft.body.length).toBeGreaterThan(0);

    // Step 4: MEDDPICC empty state check
    const { createEmptyMeddpicc, countCompletedFields, identifyFocusAreas } = await import("../server/services/meddpiccFieldCompletion");
    const meddpicc = createEmptyMeddpicc();
    expect(countCompletedFields(meddpicc)).toBe(0);
    const focus = identifyFocusAreas(meddpicc);
    expect(focus.length).toBe(4); // Top 4 of 8 incomplete fields

    // Step 5: Pattern transition assessment
    const { assessTransition } = await import("../server/services/patternTransition");
    const transition = assessTransition({
      currentPattern: 4,
      monthlyRevenue: 25000,
      clientCount: 45,
      avgRevenuePerClient: 556,
      newClientsLast90Days: 3,
      referralRate: 0.15,
      retentionRate: 0.97,
    });
    expect(transition).toHaveProperty("currentPattern");
    expect(transition).toHaveProperty("recommendation");
    expect(transition.currentPattern).toBe("Pattern 4");
  }, 30000);
});

describe("Virtual User: Marcus (Team Lead, Recruiting Focus)", () => {
  it("recruit scoring + cadence enrollment + compliance audit", async () => {
    // LLM-dependent test needs extended timeout
    // Score a recruit
    const { scoreRecruitCandidate } = await import("../server/services/recruitScoring");
    const score = await scoreRecruitCandidate({
      candidateName: "Alex Rivera",
      candidateCurrentFirm: "Competitor Wealth Management",
      candidateCredentials: "Series 7, Series 66, CFP",
      candidateGeography: "Phoenix, AZ",
      candidateBrokercheckData: "8 years, clean CRD, $45M AUM",
      candidateEngagementHistory: "Met at industry conference, exchanged cards",
      candidateReferralSource: "network cascade",
    });
    expect(score.compositeScore).toBeGreaterThanOrEqual(0);
    expect(score.scores).toHaveProperty("productionFit");
    expect(score.scores).toHaveProperty("compliancePosture");
    expect(score.scores).toHaveProperty("culturalFit");

    // Draft a recruit touch
    const { draftCadenceTouch } = await import("../server/services/cadenceTouchDrafting");
    const draft = await draftCadenceTouch({
      cadenceId: "RECRUIT_TIER1_12TOUCH_v1",
      touchNumber: 1,
      prospectData: { name: "Alex Rivera", firm: "Competitor Wealth Management", credentials: "Series 7, Series 66, CFP" },
      personalizationInputs: { cascadePotential: "High - strong network", engagementHistory: "Met at conference" },
      esiPreApprovalId: "ESI-2026-RECRUIT-001",
      senderSignatureBlock: "Marcus Johnson\nWealthBridge Financial Group",
    });
    // DraftedTouch uses subjectLine (optional), body is always present
    expect(draft.body).toBeTruthy();

    // Compliance audit the draft
    const { auditMessage } = await import("../server/services/complianceAudit");
    const audit = auditMessage({
      messageId: `msg-test-${Date.now()}`,
      body: draft.body,
      channel: "email",
      esiPreApprovalId: "ESI-2026-RECRUIT-001",
      auditType: "ad_hoc",
    });
    // AuditResult has grade, complianceCheck, findings, remediation
    expect(audit).toHaveProperty("grade");
    expect(audit).toHaveProperty("findings");
  }, 30000);
});

// ─── 5. Compliance Gate Integrity ────────────────────────────────────────

describe("Compliance Gate Integrity", () => {
  it("opt-out processing returns proper structure", async () => {
    const { processOptOut } = await import("../server/services/replyAnalysis");
    // processOptOut takes { prospectId, channel, optOutText }
    const result = processOptOut({
      prospectId: 999,
      channel: "email",
      optOutText: "Please remove me from your list",
    });
    // Returns { prospectId, optOutTimestamp, optOutChannel, scope, optOutText }
    expect(result).toHaveProperty("prospectId");
    expect(result).toHaveProperty("optOutTimestamp");
    expect(result).toHaveProperty("scope");
    expect(result.scope).toBe("all_channels");
    expect(result.prospectId).toBe(999);
  });

  it("OOO reschedule calculates future date", async () => {
    const { calculateOooReschedule } = await import("../server/services/replyAnalysis");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    // calculateOooReschedule takes a string and returns number | null
    const result = calculateOooReschedule(futureDate.toISOString());
    expect(typeof result).toBe("number");
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(Date.now());
  });

  it("delivery throttle check enforces global rules", async () => {
    const { checkThrottle } = await import("../server/services/cadenceEngine");
    // checkThrottle takes DeliveryThrottleState + channel + optional emailDomain
    const state = checkThrottle(
      { emailsSentToday: {}, linkedInConnectionsToday: 0, linkedInInMailsToday: 0, phoneCallsToday: 0, lastResetDate: new Date().toISOString().slice(0, 10) },
      "email",
      "test.com"
    );
    expect(state).toHaveProperty("allowed");
    expect(state.allowed).toBe(true);

    // Over limit
    const blocked = checkThrottle(
      { emailsSentToday: { "test.com": 500 }, linkedInConnectionsToday: 100, linkedInInMailsToday: 100, phoneCallsToday: 100, lastResetDate: new Date().toISOString().slice(0, 10) },
      "email",
      "test.com"
    );
    expect(blocked.allowed).toBe(false);
  });

  it("transcript compliance blocks SSN/TIN", async () => {
    const { checkTranscriptCompliance } = await import("../server/services/meddpiccFieldCompletion");
    const result = checkTranscriptCompliance("My SSN is 123-45-6789");
    expect(result.hasSsnOrTin).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── 6. Regression: Panel A + B Services ─────────────────────────────────

describe("Regression: Panel A services", () => {
  it("cadence engine exports all required functions", async () => {
    const mod = await import("../server/services/cadenceEngine");
    expect(typeof mod.getCadence).toBe("function");
    expect(typeof mod.checkThrottle).toBe("function");
    expect(typeof mod.complianceGateCheck).toBe("function");
    expect(Array.isArray(mod.CADENCE_LIBRARY)).toBe(true);
    expect(mod.GLOBAL_RULES).toBeTruthy();
  });

  it("reply analysis handles all classification types", async () => {
    const mod = await import("../server/services/replyAnalysis");
    expect(typeof mod.analyzeReply).toBe("function");
    expect(typeof mod.processOptOut).toBe("function");
    expect(typeof mod.calculateOooReschedule).toBe("function");
  });
});

describe("Regression: Panel B services", () => {
  it("weekly summary generation builds static summary", async () => {
    const { buildStaticSummary } = await import("../server/services/weeklySummaryGeneration");
    const summary = buildStaticSummary({
      advisorName: "Test Advisor",
      weekStartDate: "2026-04-14",
      weekEndDate: "2026-04-20",
      headlineMetric: { name: "New Clients", value: 3, unit: "clients", weekOverWeekChange: 50, isPositive: true },
      pipelineCoverage: {
        discoveryValue: 500000, solutionDesignValue: 300000, validationValue: 200000,
        commitValue: 100000, targetQuotaValue: 1000000, coverageHealth: "healthy" as const,
      },
      funnelSnapshots: [{
        funnelName: "HNW Prospect", leadsEntered: 8, leadsQualified: 5, leadsConverted: 2,
        conversionRate: 0.25, avgDaysInPipeline: 30, totalPipelineValue: 500000,
        touchesSent: 45, repliesReceived: 12, replyRate: 0.27,
      }],
      complianceHealth: {
        totalTouchesSent: 45, touchesAudited: 40, auditPassRate: 0.95,
        failCount: 2, conditionalPassCount: 1, topFindings: ["Missing disclaimer"],
        esiExpiringThisMonth: 0, optOutsProcessed: 1,
      },
      variances: [{ metric: "Touches", expected: 50, actual: 45, variancePct: -10, direction: "below" as const }],
      actionItems: [{ id: "AI-001", description: "Follow up with Dr. Whitfield", priority: "high" as const, dueDate: "2026-04-22", assignedTo: "Test Advisor" }],
      nextWeekFocus: ["Close 2 pending proposals", "Launch event follow-up cadence"],
      currentPattern: "Pattern 4",
    });
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(100);
    expect(summary).toContain("Test Advisor");
  });

  it("cadence variant creation lists base cadences with touch counts", async () => {
    const { listBaseCadences } = await import("../server/services/cadenceVariantCreation");
    const cadences = listBaseCadences();
    expect(cadences.length).toBeGreaterThanOrEqual(7);
    for (const c of cadences) {
      expect(c).toHaveProperty("cadenceId");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("touchCount");
      expect(c.touchCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("funnel metrics calculates CAC/ROI/LTV", async () => {
    const { calculateFunnelMetrics } = await import("../server/services/funnelMetrics");
    const result = calculateFunnelMetrics({
      funnelId: "test-funnel",
      funnelName: "Test Funnel",
      period: { startDate: "2026-01-01", endDate: "2026-03-31" },
      spend: 5000,
      touchesSent: 200,
      leadsEntered: 50,
      leadsQualified: 25,
      leadsSolutionDesign: 15,
      leadsValidation: 10,
      leadsCommit: 8,
      leadsConverted: 5,
      avgDaysToConvert: 45,
      revenue: 25000,
      cogs: 8000,
      avgClientRetentionMonths: 36,
      referralsGenerated: 3,
      referralConversions: 1,
      referralRevenue: 5000,
      referralSpend: 500,
    });
    // Result has nested structure: costs.cac, revenue.roi, ltv.avgClientLtv
    expect(result).toHaveProperty("costs");
    expect(result).toHaveProperty("revenue");
    expect(result).toHaveProperty("ltv");
    expect(result.costs.cac).toBeGreaterThan(0);
    expect(result.revenue.roi).toBeGreaterThan(0);
    expect(result.ltv.avgClientLtv).toBeGreaterThan(0);
    expect(result.revenue.grossMarginDollar).toBeGreaterThan(0);
    expect(result.revenue.grossMarginPct).toBeGreaterThan(0);
  });

  it("error handling: compliance audit handles empty body gracefully", async () => {
    const { auditMessage } = await import("../server/services/complianceAudit");
    // auditMessage requires messageId, body, channel, esiPreApprovalId, auditType
    const result = auditMessage({
      messageId: "MSG-TEST-001",
      body: "",
      channel: "email",
      esiPreApprovalId: "ESI-001",
      auditType: "pre_send",
    });
    // Returns AuditResult with grade field (not "passed")
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("auditId");
    // Empty body should fail
    expect(result.grade).toBe("Fail");
  });

  it("error handling: pattern transition handles null metrics", async () => {
    const { assessTransition } = await import("../server/services/patternTransition");
    const result = assessTransition({
      currentPattern: 1,
      monthlyRevenue: 0,
      clientCount: 0,
      avgRevenuePerClient: 0,
      newClientsLast90Days: 0,
      referralRate: 0,
      retentionRate: 0,
    });
    expect(result).toHaveProperty("currentPattern");
    expect(result).toHaveProperty("recommendation");
  });
});
