/**
 * Cadence Engine Router
 * ======================
 * Expert Panel A — Convergence Pass
 * 
 * Procedures:
 *   - cadenceEngine.listCadences: List available cadences from library
 *   - cadenceEngine.getCadenceDetail: Get cadence details by ID
 *   - cadenceEngine.enrollLead: Enroll a lead in a cadence
 *   - cadenceEngine.getEnrollments: List enrollments for current user
 *   - cadenceEngine.pauseEnrollment / resumeEnrollment / stopEnrollment
 *   - cadenceEngine.draftTouch / logTouch: Draft and log touches
 *   - cadenceEngine.analyzeReply: Classify reply and auto-route
 *   - cadenceEngine.scoreRecruit / scoreHnwProspect: Scoring
 *   - cadenceEngine.getMeddpicc / updateMeddpicc: MEDDPICC
 *   - cadenceEngine.auditTouch / getAuditSummary: Compliance
 *   - cadenceEngine.assessTransition / pipelineCoverage: Pattern transition
 *   - cadenceEngine.optOut / getGlobalRules
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import {
  cadenceEnrollments, cadenceTouchLog, cadenceComplianceAudit,
  cadenceOptOutRegistry, meddpiccScores, recruitDimensionScores,
  hnwNarrativeScores, patternTransitionAssessments, leadPipeline,
} from "../../drizzle/schema";
import { CADENCE_LIBRARY, getCadence, GLOBAL_RULES } from "../services/cadenceEngine";
import { scoreRecruitCandidate } from "../services/recruitScoring";
import { scoreHnwProspect } from "../services/hnwNarrativeScoring";
import { analyzeReply, processOptOut, calculateOooReschedule } from "../services/replyAnalysis";
import { draftCadenceTouch, validateDraftForSend } from "../services/cadenceTouchDrafting";
import { auditMessage, generateMonthlySummary } from "../services/complianceAudit";
import { assessTransition, calculatePipelineCoverage, type PatternMetrics } from "../services/patternTransition";
import {
  completeMeddpiccFromTranscript,
  countCompletedFields,
  createEmptyMeddpicc,
  identifyFocusAreas,
  mergeMeddpiccStates,
  checkTranscriptCompliance,
  determineStageRecommendation,
} from "../services/meddpiccFieldCompletion";
import { logger } from "../_core/logger";

const log = logger.child({ module: "cadenceEngineRouter" });

async function requireDb() {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export const cadenceEngineRouter = router({
  // ─── Cadence Library ─────────────────────────────────────────────────

  listCadences: protectedProcedure.query(async () => {
    return CADENCE_LIBRARY.map(c => ({ id: c.id, name: c.name, pattern: c.pattern, touches: c.touches.length, channels: [...new Set(c.touches.map(t => t.channel))] }));
  }),

  getCadenceDetail: protectedProcedure
    .input(z.object({ cadenceId: z.string() }))
    .query(async ({ input }) => {
      return getCadence(input.cadenceId) || null;
    }),

  getGlobalRules: protectedProcedure.query(async () => {
    return GLOBAL_RULES;
  }),

  // ─── Enrollment Management ───────────────────────────────────────────

  enrollLead: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      cadenceId: z.string(),
      esiPreApprovalId: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const cadence = getCadence(input.cadenceId);
      if (!cadence) throw new Error(`Cadence ${input.cadenceId} not found`);

      const existing = await db.select().from(cadenceEnrollments)
        .where(and(
          eq(cadenceEnrollments.userId, ctx.user.id),
          eq(cadenceEnrollments.leadId, input.leadId),
          eq(cadenceEnrollments.status, "active"),
        ));
      if (existing.length > 0) throw new Error("Lead is already enrolled in an active cadence");

      const optedOut = await db.select().from(cadenceOptOutRegistry)
        .where(and(
          eq(cadenceOptOutRegistry.userId, ctx.user.id),
          eq(cadenceOptOutRegistry.leadId, input.leadId),
        ));
      if (optedOut.length > 0) throw new Error("Lead has opted out of all communications");

      const now = Date.now();
      const [result] = await db.insert(cadenceEnrollments).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        cadenceId: input.cadenceId,
        totalTouches: cadence.touches.length,
        enrolledAt: now,
        nextTouchDueAt: now,
        esiPreApprovalId: input.esiPreApprovalId,
        metadata: input.metadata,
      });

      log.info("Enrolled lead %d in cadence %s", input.leadId, input.cadenceId);
      return { enrollmentId: result.insertId, cadenceId: input.cadenceId, totalTouches: cadence.touches.length };
    }),

  getEnrollments: protectedProcedure
    .input(z.object({
      leadId: z.number().optional(),
      status: z.enum(["active", "paused", "completed", "stopped", "opted_out"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select().from(cadenceEnrollments)
        .where(eq(cadenceEnrollments.userId, ctx.user.id))
        .orderBy(desc(cadenceEnrollments.enrolledAt));
      let filtered = rows;
      if (input?.leadId) filtered = filtered.filter(r => r.leadId === input.leadId);
      if (input?.status) filtered = filtered.filter(r => r.status === input.status);
      return filtered;
    }),

  pauseEnrollment: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(cadenceEnrollments)
        .set({ status: "paused", pausedAt: Date.now(), pauseReason: input.reason || "Manual pause" })
        .where(and(eq(cadenceEnrollments.id, input.enrollmentId), eq(cadenceEnrollments.userId, ctx.user.id)));
      return { success: true };
    }),

  resumeEnrollment: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(cadenceEnrollments)
        .set({ status: "active", pausedAt: null, pauseReason: null, nextTouchDueAt: Date.now() })
        .where(and(eq(cadenceEnrollments.id, input.enrollmentId), eq(cadenceEnrollments.userId, ctx.user.id)));
      return { success: true };
    }),

  stopEnrollment: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(cadenceEnrollments)
        .set({ status: "stopped", stoppedAt: Date.now(), stopReason: input.reason })
        .where(and(eq(cadenceEnrollments.id, input.enrollmentId), eq(cadenceEnrollments.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Touch Drafting & Logging ────────────────────────────────────────

  draftTouch: protectedProcedure
    .input(z.object({
      enrollmentId: z.number(),
      prospectData: z.record(z.string()),
      personalizationInputs: z.record(z.string()),
      senderSignatureBlock: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [enrollment] = await db.select().from(cadenceEnrollments)
        .where(and(eq(cadenceEnrollments.id, input.enrollmentId), eq(cadenceEnrollments.userId, ctx.user.id)));
      if (!enrollment) throw new Error("Enrollment not found");
      if (enrollment.status !== "active") throw new Error("Enrollment is not active");

      const nextTouch = (enrollment.currentTouchNumber || 0) + 1;
      if (nextTouch > enrollment.totalTouches) throw new Error("All touches completed");

      const draft = await draftCadenceTouch({
        cadenceId: enrollment.cadenceId,
        touchNumber: nextTouch,
        prospectData: input.prospectData,
        personalizationInputs: input.personalizationInputs,
        esiPreApprovalId: enrollment.esiPreApprovalId || "",
        senderSignatureBlock: input.senderSignatureBlock,
      });

      const issues = validateDraftForSend(draft);
      return { draft, issues, readyToSend: issues.length === 0 };
    }),

  logTouch: protectedProcedure
    .input(z.object({
      enrollmentId: z.number(),
      leadId: z.number(),
      cadenceId: z.string(),
      touchNumber: z.number(),
      channel: z.string(),
      status: z.enum(["drafted", "approved", "sent", "delivered", "opened", "replied", "bounced", "failed", "skipped"]),
      subjectLine: z.string().optional(),
      bodyPreview: z.string().optional(),
      esiPreApprovalId: z.string().optional(),
      complianceGrade: z.enum(["Pass", "Conditional Pass", "Fail"]).optional(),
      complianceNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const now = Date.now();
      const [result] = await db.insert(cadenceTouchLog).values({
        enrollmentId: input.enrollmentId,
        userId: ctx.user.id,
        leadId: input.leadId,
        cadenceId: input.cadenceId,
        touchNumber: input.touchNumber,
        channel: input.channel,
        status: input.status,
        subjectLine: input.subjectLine,
        bodyPreview: input.bodyPreview?.substring(0, 500),
        esiPreApprovalId: input.esiPreApprovalId,
        complianceGrade: input.complianceGrade,
        complianceNotes: input.complianceNotes,
        sentAt: input.status === "sent" ? now : undefined,
        createdAt: now,
      });

      if (input.status === "sent") {
        const cadence = getCadence(input.cadenceId);
        const nextTouchNumber = input.touchNumber + 1;
        const isComplete = nextTouchNumber > (cadence?.touches.length || 0);
        await db.update(cadenceEnrollments)
          .set({
            currentTouchNumber: input.touchNumber,
            status: isComplete ? "completed" : "active",
            completedAt: isComplete ? now : undefined,
            nextTouchDueAt: isComplete ? undefined : now + (cadence?.touches[input.touchNumber]?.delayDays || 7) * 86400000,
          })
          .where(eq(cadenceEnrollments.id, input.enrollmentId));
      }

      return { touchLogId: result.insertId };
    }),

  // ─── Reply Analysis ──────────────────────────────────────────────────

  analyzeReply: protectedProcedure
    .input(z.object({
      replyText: z.string(),
      cadenceId: z.string(),
      touchNumber: z.number(),
      prospectName: z.string(),
      prospectCompany: z.string().optional(),
      channel: z.enum(["email", "LinkedIn", "phone", "sms"]),
      previousTouchSubject: z.string().optional(),
      enrollmentId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const analysis = await analyzeReply({
        replyText: input.replyText,
        cadenceId: input.cadenceId,
        touchNumber: input.touchNumber,
        prospectName: input.prospectName,
        prospectCompany: input.prospectCompany,
        channel: input.channel,
        previousTouchSubject: input.previousTouchSubject,
      });

      if (analysis.shouldPauseCadence) {
        await db.update(cadenceEnrollments)
          .set({ status: "paused", pausedAt: Date.now(), pauseReason: `Reply classified as: ${analysis.classification}` })
          .where(and(eq(cadenceEnrollments.id, input.enrollmentId), eq(cadenceEnrollments.userId, ctx.user.id)));
      }

      if (analysis.classification === "opt_out") {
        const [enrollment] = await db.select().from(cadenceEnrollments)
          .where(eq(cadenceEnrollments.id, input.enrollmentId));
        if (enrollment) {
          await db.insert(cadenceOptOutRegistry).values({
            userId: ctx.user.id,
            leadId: enrollment.leadId,
            optOutChannel: input.channel,
            optOutText: input.replyText,
            optOutAt: Date.now(),
            processedBy: "system",
            referenceId: `REPLY-${Date.now()}`,
          });
          await db.update(cadenceEnrollments)
            .set({ status: "opted_out", stoppedAt: Date.now(), stopReason: "Opt-out received" })
            .where(eq(cadenceEnrollments.id, input.enrollmentId));
        }
      }

      if (analysis.classification === "out_of_office" && analysis.oooReturnDate) {
        const rescheduleAt = calculateOooReschedule(analysis.oooReturnDate);
        if (rescheduleAt) {
          await db.update(cadenceEnrollments)
            .set({ nextTouchDueAt: rescheduleAt })
            .where(eq(cadenceEnrollments.id, input.enrollmentId));
        }
      }

      return analysis;
    }),

  // ─── Scoring ─────────────────────────────────────────────────────────

  scoreRecruit: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      candidateName: z.string(),
      candidateCurrentFirm: z.string().optional(),
      candidateCredentials: z.string().optional(),
      candidateGeography: z.string().optional(),
      candidateLinkedinData: z.string().optional(),
      candidateBrokercheckData: z.string().optional(),
      candidateEngagementHistory: z.string().optional(),
      candidateReferralSource: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await scoreRecruitCandidate(input);

      await db.insert(recruitDimensionScores).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        productionFit: result.scores.productionFit.score,
        culturalFit: result.scores.culturalFit.score,
        geographicFit: result.scores.geographicFit.score,
        networkLeverage: result.scores.networkLeverage.score,
        compliancePosture: result.scores.compliancePosture.score,
        engagementSignal: result.scores.engagementSignal.score,
        compositeScore: result.compositeScore,
        tier: result.tier,
        cascadePotentialCount: result.cascadePotential.estimatedColleaguesUnlockable,
        cascadeRationale: result.cascadePotential.rationale,
        priorityActionsJson: result.priorityActions,
        fullResultJson: result,
        scoredAt: Date.now(),
      });

      return result;
    }),

  scoreHnwProspect: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      prospectName: z.string(),
      prospectCompany: z.string().optional(),
      prospectRole: z.string().optional(),
      prospectGeography: z.string().optional(),
      wealthSignal: z.string().optional(),
      linkedinData: z.string().optional(),
      publicRecords: z.string().optional(),
      mutualConnections: z.string().optional(),
      priorOutreach: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await scoreHnwProspect(input);

      await db.insert(hnwNarrativeScores).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        wealthSignalStrength: result.narrativeScore.wealthSignalStrength,
        funnelFit: result.narrativeScore.fitWithHnwFunnel,
        engagementDifficulty: result.narrativeScore.engagementDifficultyEstimate,
        summaryParagraph: result.narrativeScore.summaryParagraph,
        recommendedCadence: result.recommendedCadence,
        personalizationJson: result.personalizationInputs,
        complianceFlagsJson: result.complianceFlags,
        scoredAt: Date.now(),
      });

      return result;
    }),

  // ─── MEDDPICC ────────────────────────────────────────────────────────

  getMeddpicc: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db.select().from(meddpiccScores)
        .where(and(eq(meddpiccScores.userId, ctx.user.id), eq(meddpiccScores.leadId, input.leadId)))
        .orderBy(desc(meddpiccScores.lastScoredAt))
        .limit(1);
      return row || null;
    }),

  updateMeddpicc: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      metrics: z.number().min(0).max(10),
      economicBuyer: z.number().min(0).max(10),
      decisionCriteria: z.number().min(0).max(10),
      decisionProcess: z.number().min(0).max(10),
      paperProcess: z.number().min(0).max(10),
      identifyPain: z.number().min(0).max(10),
      champion: z.number().min(0).max(10),
      competition: z.number().min(0).max(10),
      notes: z.record(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const composite = (input.metrics + input.economicBuyer + input.decisionCriteria +
        input.decisionProcess + input.paperProcess + input.identifyPain +
        input.champion + input.competition) / 8 * 10;
      const tier = composite >= 80 ? "Tier 1" : composite >= 65 ? "Tier 2" : composite >= 50 ? "Tier 3" : "Hold";

      await db.insert(meddpiccScores).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        metrics: input.metrics,
        economicBuyer: input.economicBuyer,
        decisionCriteria: input.decisionCriteria,
        decisionProcess: input.decisionProcess,
        paperProcess: input.paperProcess,
        identifyPain: input.identifyPain,
        champion: input.champion,
        competition: input.competition,
        compositeScore: composite.toFixed(2),
        tier,
        notesJson: input.notes,
        lastScoredAt: Date.now(),
        scoredBy: ctx.user.name || "system",
      });

      return { composite: Math.round(composite), tier };
    }),

  // ─── Compliance Audit ────────────────────────────────────────────────

  auditTouch: protectedProcedure
    .input(z.object({
      touchLogId: z.number(),
      body: z.string(),
      channel: z.string(),
      esiPreApprovalId: z.string(),
      auditType: z.enum(["daily_random", "monthly_full", "ad_hoc"]).default("ad_hoc"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = auditMessage({
        messageId: `TOUCH-${input.touchLogId}`,
        body: input.body,
        channel: input.channel,
        esiPreApprovalId: input.esiPreApprovalId,
        auditType: input.auditType,
      });

      await db.insert(cadenceComplianceAudit).values({
        userId: ctx.user.id,
        auditId: result.auditId,
        auditType: input.auditType,
        touchLogId: input.touchLogId,
        grade: result.grade,
        findingsJson: result.findings,
        remediationJson: result.remediation,
        auditorNotes: result.auditorNotes,
        createdAt: Date.now(),
      });

      return result;
    }),

  getAuditSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db.select().from(cadenceComplianceAudit)
      .where(eq(cadenceComplianceAudit.userId, ctx.user.id))
      .orderBy(desc(cadenceComplianceAudit.createdAt))
      .limit(100);

    const audits = rows.map(r => ({
      auditId: r.auditId,
      messageId: `TOUCH-${r.touchLogId}`,
      auditType: r.auditType as "daily_random" | "monthly_full" | "ad_hoc",
      timestamp: Number(r.createdAt),
      grade: r.grade as "Pass" | "Conditional Pass" | "Fail",
      complianceCheck: {} as any,
      findings: (r.findingsJson as string[]) || [],
      remediation: (r.remediationJson as string[]) || [],
      auditorNotes: r.auditorNotes || "",
    }));

    const summary = generateMonthlySummary(audits);
    const monthlyNarrative = summary.totalAudited > 0
      ? `${summary.period}: ${summary.totalAudited} audits — ${summary.passCount} Pass, ${summary.conditionalPassCount} Conditional, ${summary.failCount} Fail (${(summary.passRate * 100).toFixed(0)}% pass rate). Grade: ${summary.overallGrade}.`
      : "No audits recorded this period.";
    return { ...summary, audits, monthlyNarrative };
  }),

  // ─── Pattern Transition ──────────────────────────────────────────────

  assessTransition: protectedProcedure
    .input(z.object({
      aumSignedThisMonth: z.number(),
      dealsAbove500K: z.number(),
      activeAffiliates: z.number(),
      newProducersOnboarded: z.number(),
      totalPipelineValue: z.number(),
      conversionRate: z.number(),
      avgDealSize: z.number(),
      monthlyRecurringRevenue: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = assessTransition(input as PatternMetrics);

      await db.insert(patternTransitionAssessments).values({
        userId: ctx.user.id,
        currentPattern: result.currentPattern,
        readinessScore: result.readinessScore,
        recommendation: result.recommendation,
        rationale: result.rationale,
        metricsJson: result.metrics,
        gatingFactorsJson: result.gatingFactors,
        nextReviewDate: result.nextReviewDate,
        assessedAt: Date.now(),
      });

      return result;
    }),

  pipelineCoverage: protectedProcedure
    .input(z.object({
      discoveryValue: z.number(),
      solutionDesignValue: z.number(),
      validationValue: z.number(),
      commitValue: z.number(),
      targetQuotaValue: z.number(),
    }))
    .query(async ({ input }) => {
      return calculatePipelineCoverage(input);
    }),

  // ─── Opt-Out ─────────────────────────────────────────────────────────

  optOut: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      channel: z.string(),
      optOutText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const record = processOptOut({
        prospectId: input.leadId,
        channel: input.channel,
        optOutText: input.optOutText || "Manual opt-out",
      });

      await db.insert(cadenceOptOutRegistry).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        optOutChannel: input.channel,
        optOutText: input.optOutText || "Manual opt-out",
        optOutAt: record.optOutTimestamp,
        processedBy: ctx.user.name || "system",
        referenceId: `MANUAL-${Date.now()}`,
      });

      const activeEnrollments = await db.select().from(cadenceEnrollments)
        .where(and(
          eq(cadenceEnrollments.userId, ctx.user.id),
          eq(cadenceEnrollments.leadId, input.leadId),
          eq(cadenceEnrollments.status, "active"),
        ));
      for (const enrollment of activeEnrollments) {
        await db.update(cadenceEnrollments)
          .set({ status: "opted_out", stoppedAt: Date.now(), stopReason: "Universal opt-out" })
          .where(eq(cadenceEnrollments.id, enrollment.id));
      }

      return { success: true, scope: "all_channels" };
    }),

  // ─── Weekly Summary Generation (Prompt 8) ────────────────────────────

  generateWeeklySummary: protectedProcedure
    .input(z.object({
      weekStartDate: z.string(),
      weekEndDate: z.string(),
      headlineMetric: z.object({
        name: z.string(),
        value: z.number(),
        unit: z.string(),
        weekOverWeekChange: z.number(),
        isPositive: z.boolean(),
      }),
      pipelineCoverage: z.object({
        discoveryValue: z.number(),
        solutionDesignValue: z.number(),
        validationValue: z.number(),
        commitValue: z.number(),
        targetQuotaValue: z.number(),
        coverageHealth: z.enum(["healthy", "at_risk", "critical"]),
      }),
      funnelSnapshots: z.array(z.object({
        funnelName: z.string(),
        leadsEntered: z.number(),
        leadsQualified: z.number(),
        leadsConverted: z.number(),
        conversionRate: z.number(),
        avgDaysInPipeline: z.number(),
        totalPipelineValue: z.number(),
        touchesSent: z.number(),
        repliesReceived: z.number(),
        replyRate: z.number(),
        meetingsBooked: z.number(),
      })),
      complianceHealth: z.object({
        totalTouchesSent: z.number(),
        touchesAudited: z.number(),
        auditPassRate: z.number(),
        failCount: z.number(),
        conditionalPassCount: z.number(),
        topFindings: z.array(z.string()),
        esiExpiringThisMonth: z.number(),
        optOutsProcessed: z.number(),
      }),
      variances: z.array(z.object({
        metric: z.string(),
        expected: z.number(),
        actual: z.number(),
        variancePct: z.number(),
        direction: z.enum(["above", "below"]),
        severity: z.enum(["minor", "moderate", "critical"]),
      })),
      actionItems: z.array(z.object({
        id: z.string(),
        description: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        dueDate: z.string(),
        assignedTo: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "overdue"]),
      })),
      nextWeekFocus: z.array(z.string()),
      currentPattern: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { generateWeeklySummary } = await import("../services/weeklySummaryGeneration");
      return generateWeeklySummary({
        advisorName: ctx.user.name || "Advisor",
        ...input,
      });
    }),

  buildStaticSummary: protectedProcedure
    .input(z.object({
      weekStartDate: z.string(),
      weekEndDate: z.string(),
      headlineMetric: z.object({
        name: z.string(),
        value: z.number(),
        unit: z.string(),
        weekOverWeekChange: z.number(),
        isPositive: z.boolean(),
      }),
      pipelineCoverage: z.object({
        discoveryValue: z.number(),
        solutionDesignValue: z.number(),
        validationValue: z.number(),
        commitValue: z.number(),
        targetQuotaValue: z.number(),
        coverageHealth: z.enum(["healthy", "at_risk", "critical"]),
      }),
      funnelSnapshots: z.array(z.any()),
      complianceHealth: z.any(),
      variances: z.array(z.any()),
      actionItems: z.array(z.any()),
      nextWeekFocus: z.array(z.string()),
      currentPattern: z.string(),
    }))
    .query(({ ctx, input }) => {
      const { buildStaticSummary } = require("../services/weeklySummaryGeneration");
      return buildStaticSummary({
        advisorName: ctx.user.name || "Advisor",
        ...input,
      });
    }),

  // ─── Cadence Variant Creation (Prompt 9) ─────────────────────────────

  createVariant: protectedProcedure
    .input(z.object({
      baseCadenceId: z.string(),
      variantType: z.enum(["geographic", "compliance", "audience", "channel_shift"]),
      variantName: z.string(),
      variantDescription: z.string(),
      adaptationRules: z.object({
        geography: z.string().optional(),
        complianceOverlay: z.string().optional(),
        audienceSegment: z.string().optional(),
        channelPreference: z.string().optional(),
        toneAdjustment: z.string().optional(),
        excludeChannels: z.array(z.string()).optional(),
      }),
      esiPreApprovalId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { createCadenceVariant } = await import("../services/cadenceVariantCreation");
      return createCadenceVariant(input);
    }),

  validateVariant: protectedProcedure
    .input(z.object({
      touches: z.array(z.object({
        channel: z.string(),
        day: z.number(),
        subject: z.string().nullable(),
        body: z.string(),
      })),
    }))
    .query(({ input }) => {
      const { validateVariant } = require("../services/cadenceVariantCreation");
      return validateVariant({
        variantCadenceId: "validation-check",
        variantName: "Validation",
        baseCadenceId: "unknown",
        variantType: "geographic",
        touches: input.touches,
        adaptationNotes: [],
        complianceNotes: [],
        createdAt: Date.now(),
      });
    }),

  listBaseCadences: protectedProcedure.query(async () => {
    const { listBaseCadences } = await import("../services/cadenceVariantCreation");
    return listBaseCadences();
  }),

  // ─── Funnel Metrics (v10 spec) ───────────────────────────────────────

  calculateFunnelMetrics: protectedProcedure
    .input(z.object({
      funnelId: z.string(),
      funnelName: z.string(),
      period: z.object({ startDate: z.string(), endDate: z.string() }),
      spend: z.number(),
      touchesSent: z.number(),
      leadsEntered: z.number(),
      leadsQualified: z.number(),
      leadsSolutionDesign: z.number(),
      leadsValidation: z.number(),
      leadsCommit: z.number(),
      leadsConverted: z.number(),
      avgDaysToConvert: z.number(),
      revenue: z.number(),
      cogs: z.number(),
      avgClientRetentionMonths: z.number(),
      referralsGenerated: z.number(),
      referralConversions: z.number(),
      referralRevenue: z.number(),
      referralSpend: z.number(),
    }))
    .query(({ input }) => {
      const { calculateFunnelMetrics } = require("../services/funnelMetrics");
      return calculateFunnelMetrics(input);
    }),

  getExpectedMetrics: protectedProcedure.query(async () => {
    const { getExpectedMetrics } = await import("../services/funnelMetrics");
    return getExpectedMetrics();
  }),

  // ─── MEDDPICC Field Completion (Prompt 5) ────────────────────────────

  completeMeddpiccFromTranscript: protectedProcedure
    .input(z.object({
      opportunityId: z.string(),
      prospectName: z.string(),
      callTranscript: z.string(),
      leadId: z.number(),
      currentMeddpiccState: z.record(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      log.info({ userId: ctx.user.id, leadId: input.leadId }, "MEDDPICC field completion from transcript");

      // Run compliance check on transcript first
      const complianceCheck = checkTranscriptCompliance(input.callTranscript);
      if (complianceCheck.hasSsnOrTin) {
        log.warn({ leadId: input.leadId }, "SSN/TIN detected in transcript — blocking analysis");
        return {
          blocked: true,
          reason: "Potential SSN/TIN detected in transcript. Please redact before analysis.",
          complianceWarnings: complianceCheck.warnings,
        };
      }

      // Run LLM-powered MEDDPICC extraction
      const result = await completeMeddpiccFromTranscript({
        opportunityId: input.opportunityId,
        prospectName: input.prospectName,
        callTranscript: input.callTranscript,
        currentMeddpiccState: input.currentMeddpiccState as any,
      });

      // Persist to meddpicc_scores table
      await db.insert(meddpiccScores).values({
        userId: ctx.user.id,
        leadId: input.leadId,
        metrics: result.fields.metrics.confidence === "High" ? 10 : result.fields.metrics.confidence === "Medium" ? 7 : 3,
        economicBuyer: result.fields.economicBuyer.confidence === "High" ? 10 : result.fields.economicBuyer.confidence === "Medium" ? 7 : 3,
        decisionCriteria: result.fields.decisionCriteria.confidence === "High" ? 10 : result.fields.decisionCriteria.confidence === "Medium" ? 7 : 3,
        decisionProcess: result.fields.decisionProcess.confidence === "High" ? 10 : result.fields.decisionProcess.confidence === "Medium" ? 7 : 3,
        paperProcess: result.fields.paperProcess.confidence === "High" ? 10 : result.fields.paperProcess.confidence === "Medium" ? 7 : 3,
        identifyPain: result.fields.identifyPain.confidence === "High" ? 10 : result.fields.identifyPain.confidence === "Medium" ? 7 : 3,
        champion: result.fields.champion.confidence === "High" ? 10 : result.fields.champion.confidence === "Medium" ? 7 : 3,
        competition: result.fields.competition.confidence === "High" ? 10 : result.fields.competition.confidence === "Medium" ? 7 : 3,
        overallScore: result.fieldsComplete * 10, // 0-80 scale
        lastScoredAt: new Date(),
      });

      return {
        blocked: false,
        result,
        complianceWarnings: complianceCheck.warnings,
      };
    }),

  checkTranscriptCompliance: protectedProcedure
    .input(z.object({ transcript: z.string() }))
    .query(({ input }) => {
      return checkTranscriptCompliance(input.transcript);
    }),

  getMeddpiccFocusAreas: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db.select().from(meddpiccScores)
        .where(and(eq(meddpiccScores.userId, ctx.user.id), eq(meddpiccScores.leadId, input.leadId)))
        .orderBy(desc(meddpiccScores.lastScoredAt))
        .limit(1);

      if (!row) {
        const empty = createEmptyMeddpicc();
        return {
          fieldsComplete: 0,
          focusAreas: identifyFocusAreas(empty),
          stageRecommendation: "Maintain Discovery" as const,
        };
      }

      // Reconstruct fields from numeric scores
      const scoreToConfidence = (s: number) => s >= 8 ? "High" as const : s >= 5 ? "Medium" as const : "Low" as const;
      const fields = createEmptyMeddpicc();
      fields.metrics.confidence = scoreToConfidence(row.metrics ?? 0);
      fields.economicBuyer.confidence = scoreToConfidence(row.economicBuyer ?? 0);
      fields.decisionCriteria.confidence = scoreToConfidence(row.decisionCriteria ?? 0);
      fields.decisionProcess.confidence = scoreToConfidence(row.decisionProcess ?? 0);
      fields.paperProcess.confidence = scoreToConfidence(row.paperProcess ?? 0);
      fields.identifyPain.confidence = scoreToConfidence(row.identifyPain ?? 0);
      fields.champion.confidence = scoreToConfidence(row.champion ?? 0);
      fields.competition.confidence = scoreToConfidence(row.competition ?? 0);

      // Mark non-Low fields as discovered
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
        if (fields[key].confidence !== "Low") {
          fields[key].value = "Discovered";
        }
      }

      const complete = countCompletedFields(fields);
      return {
        fieldsComplete: complete,
        focusAreas: identifyFocusAreas(fields),
        stageRecommendation: determineStageRecommendation(fields, complete),
      };
    }),

  /* ─── Cascade Tracking: Tier 1 colleague auto-queue ───────────────── */
  getCascadeCandidates: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db.select()
      .from(recruitDimensionScores)
      .where(and(
        eq(recruitDimensionScores.userId, ctx.user.id),
        eq(recruitDimensionScores.tier, "Tier 1"),
        gte(recruitDimensionScores.cascadePotentialCount, 5),
      ))
      .orderBy(desc(recruitDimensionScores.cascadePotentialCount));

    const leadIds = rows.map(r => r.leadId);
    let leadMap: Record<number, { name: string; company: string }> = {};
    if (leadIds.length > 0) {
      const leads = await db.select({
        id: leadPipeline.id,
        firstName: leadPipeline.firstName,
        lastName: leadPipeline.lastName,
        company: leadPipeline.source,
      }).from(leadPipeline).where(inArray(leadPipeline.id, leadIds));
      leadMap = Object.fromEntries(leads.map(l => [
        l.id,
        { name: [l.firstName, l.lastName].filter(Boolean).join(" ") || `Lead #${l.id}`, company: l.company || "" },
      ]));
    }

    // Also check which leads have completed cadences (for auto-queue status)
    const completedEnrollments = leadIds.length > 0
      ? await db.select()
          .from(cadenceEnrollments)
          .where(and(
            eq(cadenceEnrollments.userId, ctx.user.id),
            eq(cadenceEnrollments.status, "completed"),
            inArray(cadenceEnrollments.leadId, leadIds),
          ))
      : [];
    const completedLeadIds = new Set(completedEnrollments.map(e => e.leadId));

    return rows.map(r => ({
      id: r.id,
      leadId: r.leadId,
      leadName: leadMap[r.leadId]?.name ?? `Lead #${r.leadId}`,
      leadCompany: leadMap[r.leadId]?.company ?? "",
      compositeScore: r.compositeScore ?? 0,
      tier: r.tier ?? "Tier 1",
      cascadePotentialCount: r.cascadePotentialCount ?? 0,
      cascadeRationale: r.cascadeRationale ?? "",
      priorityActions: (r.priorityActionsJson as string[]) ?? [],
      scoredAt: r.scoredAt,
      cadenceCompleted: completedLeadIds.has(r.leadId),
      status: completedLeadIds.has(r.leadId) ? "ready_for_cascade" as const : "in_cadence" as const,
    }));
  }),
});
