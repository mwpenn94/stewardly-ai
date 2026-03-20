/**
 * v5 Feature Routers — Plan Adherence, LTC Planner, Financial Health Score,
 * Client Segmentation, Practice Intelligence, Business Exit Planner,
 * Constitutional Finance, Ambient Finance, Workflow Orchestrator,
 * Annual Review Engine, Client Portal Optimizer
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

import {
  computeAdherence, getAdherenceHistory, savePlanAdherence,
  type AdherenceTarget,
} from "../planAdherence";
import {
  analyzeLtc, saveLtcAnalysis, type LtcInput,
} from "../ltcPlanner";
import {
  calculateHealthScore, type HealthScoreInput,
} from "../financialHealthScore";
import {
  classifyClient, saveSegmentation, getClientSegment,
  getSegmentsByProfessional, type SegmentationInput,
} from "../clientSegmentation";
import {
  analyzePractice, savePracticeMetrics, getLatestPracticeMetrics,
  type PracticeInput,
} from "../practiceIntelligence";
import {
  analyzeBusinessExit, saveExitPlan, getUserExitPlans,
  type ExitPlanInput,
} from "../businessExitPlanner";
import {
  checkConstitutionalCompliance, autoModifyResponse,
  CONSTITUTIONAL_PRINCIPLES, getViolationHistory,
} from "../constitutionalFinance";
import {
  generateMarketInsight, generateLifeEventInsight,
  generatePlanDeviationInsight, generateOpportunityInsight,
  shouldSuppress, saveNotification, getUnreadNotifications,
  markNotificationRead, getNotificationHistory,
  type NotificationPreferences,
} from "../ambientFinance";
import {
  DEFAULT_CHAINS, saveEventChain, getEventChains,
  executeChain, getExecutionLog,
} from "../workflowOrchestrator";
import {
  generateAnnualReview, saveReviewPacket, getUserReviews,
  type ReviewInput,
} from "../annualReview";
import {
  trackPortalEvent, getUserEngagement, getPortalHealthMetrics,
  calculateEngagementScore, determineAdoptionStage,
  generateRecommendations, type PortalEvent,
} from "../clientPortalOptimizer";

// ─── PLAN ADHERENCE ROUTER ─────────────────────────────────────
export const planAdherenceRouter = router({
  check: protectedProcedure
    .input(z.object({
      targets: z.array(z.object({
        category: z.enum(["savings", "spending", "investment", "debt"]),
        label: z.string(),
        targetMonthly: z.number(),
        actualMonthly: z.number(),
        unit: z.string().default("$"),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = computeAdherence(input.targets as AdherenceTarget[]);
      await savePlanAdherence(ctx.user.id, result);
      return result;
    }),
  history: protectedProcedure.query(({ ctx }) => getAdherenceHistory(ctx.user.id)),
});

// ─── LTC PLANNER ROUTER ────────────────────────────────────────
export const ltcPlannerRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      currentAge: z.number().min(18).max(100),
      gender: z.enum(["male", "female"]),
      state: z.string().min(2).max(2),
      healthStatus: z.enum(["excellent", "good", "fair", "poor"]),
      annualIncome: z.number().min(0),
      liquidAssets: z.number().min(0),
      monthlyExpenses: z.number().min(0),
      hasLtcInsurance: z.boolean(),
      familyHistory: z.boolean(),
      maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const ltcInput: LtcInput = { ...input };
      const result = analyzeLtc(ltcInput);
      await saveLtcAnalysis(ctx.user.id, ltcInput, result);
      return result;
    }),
});

// ─── FINANCIAL HEALTH SCORE ROUTER ──────────────────────────────
export const financialHealthRouter = router({
  calculate: protectedProcedure
    .input(z.object({
      monthlyIncome: z.number().min(0),
      monthlySpending: z.number().min(0),
      billsOnTimePercent: z.number().min(0).max(100),
      liquidSavingsMonths: z.number().min(0),
      longTermSavingsProgress: z.number().min(0).max(100),
      debtToIncomeRatio: z.number().min(0),
      creditUtilization: z.number().min(0).max(100),
      insuranceAdequacy: z.number().min(0).max(100),
      planCompleteness: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = calculateHealthScore(input);
      const { saveHealthScore } = await import("../financialHealthScore");
      await saveHealthScore(ctx.user.id, result);
      return result;
    }),
});

// ─── CLIENT SEGMENTATION ROUTER ─────────────────────────────────
export const clientSegmentationRouter = router({
  classify: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      aum: z.number(),
      annualRevenue: z.number(),
      referralsGenerated: z.number(),
      netNewAssets12m: z.number(),
      aumGrowthRate: z.number(),
      productPenetration: z.number(),
      meetingsAttended12m: z.number(),
      responseTimeAvgHours: z.number(),
      portalLoginFrequency: z.number(),
      tenureYears: z.number(),
      satisfactionScore: z.number(),
      advocacyScore: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const segInput: SegmentationInput = { professionalId: ctx.user.id, ...input };
      const result = classifyClient(segInput);
      await saveSegmentation(segInput, result);
      return result;
    }),
  getSegment: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => getClientSegment(input.clientId)),
  listSegments: protectedProcedure.query(({ ctx }) => getSegmentsByProfessional(ctx.user.id)),
});

// ─── PRACTICE INTELLIGENCE ROUTER ───────────────────────────────
export const practiceIntelligenceRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      totalAum: z.number(),
      clientCount: z.number(),
      annualRevenue: z.number(),
      netNewClients: z.number(),
      referralConversionRate: z.number(),
      clientRetentionRate: z.number(),
      avgMeetingPrepMinutes: z.number(),
      complianceCompletionRate: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const practiceInput: PracticeInput = { professionalId: ctx.user.id, ...input };
      const analysis = analyzePractice(practiceInput);
      await savePracticeMetrics(practiceInput, analysis);
      return analysis;
    }),
  latest: protectedProcedure.query(({ ctx }) => getLatestPracticeMetrics(ctx.user.id)),
});

// ─── BUSINESS EXIT PLANNER ROUTER ───────────────────────────────
export const businessExitRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      businessName: z.string().min(1),
      businessType: z.string(),
      annualRevenue: z.number(),
      annualProfit: z.number(),
      employeeCount: z.number(),
      ownerHoursPerWeek: z.number(),
      yearsInBusiness: z.number(),
      keyEmployeeDependence: z.number().min(0).max(100),
      customerConcentration: z.number().min(0).max(100),
      recurringRevenuePercent: z.number().min(0).max(100),
      preferredTimeline: z.number(),
      preferredPath: z.enum(["sale", "merger", "esop", "family", "ipo", "liquidation"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const exitInput: ExitPlanInput = { userId: ctx.user.id, ...input };
      const result = analyzeBusinessExit(exitInput);
      await saveExitPlan(exitInput, result);
      return result;
    }),
  history: protectedProcedure.query(({ ctx }) => getUserExitPlans(ctx.user.id)),
});

// ─── CONSTITUTIONAL FINANCE ROUTER ──────────────────────────────
export const constitutionalRouter = router({
  principles: protectedProcedure.query(() => CONSTITUTIONAL_PRINCIPLES),
  check: protectedProcedure
    .input(z.object({ response: z.string() }))
    .mutation(({ input }) => {
      const result = checkConstitutionalCompliance(input.response);
      if (!result.passed) {
        result.modifiedResponse = autoModifyResponse(input.response, result.violations);
      }
      return result;
    }),
  violationHistory: protectedProcedure.query(() => getViolationHistory()),
});

// ─── AMBIENT FINANCE ROUTER ─────────────────────────────────────
export const ambientRouter = router({
  unread: protectedProcedure.query(({ ctx }) => getUnreadNotifications(ctx.user.id)),
  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .query(({ ctx, input }) => getNotificationHistory(ctx.user.id, input?.limit || 100)),
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(({ input }) => markNotificationRead(input.notificationId)),
  testInsight: protectedProcedure
    .input(z.object({
      type: z.enum(["market_event", "life_event", "plan_deviation", "opportunity"]),
      title: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      let insight;
      switch (input.type) {
        case "market_event":
          insight = generateMarketInsight(input.title, input.body);
          break;
        case "life_event":
          insight = generateLifeEventInsight(input.title, [input.body]);
          break;
        case "plan_deviation":
          insight = generatePlanDeviationInsight(input.title, 15);
          break;
        default:
          insight = generateOpportunityInsight(input.title, input.body);
      }
      const prefs: NotificationPreferences = {
        enabled: true, channels: ["in_app"], maxPerDay: 20,
        categories: { market_event: true, life_event: true, plan_deviation: true, opportunity: true },
      };
      const suppression = shouldSuppress(insight, 0, prefs);
      await saveNotification(ctx.user.id, insight, suppression.suppress ? suppression.reason : undefined);
      return { insight, suppressed: suppression.suppress, reason: suppression.reason };
    }),
});

// ─── WORKFLOW ORCHESTRATOR ROUTER ────────────────────────────────
export const workflowOrchestratorRouter = router({
  chains: protectedProcedure.query(() => getEventChains()),
  defaultChains: protectedProcedure.query(() => DEFAULT_CHAINS),
  createChain: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      eventType: z.string(),
      actions: z.array(z.object({
        type: z.enum(["notification", "task_create", "email", "flag", "escalate", "schedule_meeting"]),
        target: z.enum(["client", "advisor", "admin", "system"]),
        config: z.record(z.string(), z.unknown()),
      })),
      isActive: z.boolean().default(true),
    }))
    .mutation(({ input }) => {
      const chain = { ...input, eventType: input.eventType as any };
      return saveEventChain(chain);
    }),
  execute: protectedProcedure
    .input(z.object({ chainId: z.number(), eventSource: z.string() }))
    .mutation(async ({ input }) => {
      const chains = await getEventChains();
      const chain = chains.find((c: any) => c.id === input.chainId);
      if (!chain) throw new Error("Chain not found");
      return executeChain({
        id: chain.id,
        name: chain.name,
        eventType: chain.eventType as any,
        actions: typeof chain.actionsJson === "string" ? JSON.parse(chain.actionsJson) : [],
        isActive: chain.isActive ?? true,
      }, input.eventSource);
    }),
  executionLog: protectedProcedure.query(() => getExecutionLog()),
});

// ─── ANNUAL REVIEW ROUTER ───────────────────────────────────────
export const annualReviewRouter = router({
  generate: protectedProcedure
    .input(z.object({
      year: z.number(),
      totalAssets: z.number(),
      totalLiabilities: z.number(),
      annualIncome: z.number(),
      annualExpenses: z.number(),
      investmentReturns: z.number(),
      goalsProgress: z.array(z.object({
        goalName: z.string(),
        targetAmount: z.number(),
        currentAmount: z.number(),
        targetDate: z.string(),
        onTrack: z.boolean(),
      })),
      lifeChanges: z.array(z.string()),
      insurancePolicies: z.array(z.object({
        type: z.string(),
        provider: z.string(),
        coverage: z.number(),
        premium: z.number(),
        expirationDate: z.string().optional(),
        adequate: z.boolean(),
      })),
      estateDocsCurrent: z.boolean(),
      beneficiariesReviewed: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reviewInput: ReviewInput = { userId: ctx.user.id, ...input };
      const packet = generateAnnualReview(reviewInput);
      await saveReviewPacket(ctx.user.id, packet);
      return packet;
    }),
  history: protectedProcedure.query(({ ctx }) => getUserReviews(ctx.user.id)),
});

// ─── CLIENT PORTAL OPTIMIZER ROUTER ─────────────────────────────
export const portalOptimizerRouter = router({
  trackEvent: protectedProcedure
    .input(z.object({
      eventType: z.enum(["page_view", "feature_use", "document_access", "tool_use", "chat_session", "login"]),
      pagePath: z.string(),
      featureName: z.string().optional(),
      durationSeconds: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const event: PortalEvent = { userId: ctx.user.id, ...input };
      return trackPortalEvent(event);
    }),
  engagement: protectedProcedure.query(async ({ ctx }) => {
    const events = await getUserEngagement(ctx.user.id);
    const score = calculateEngagementScore(
      events.map((e: any) => ({
        userId: e.userId,
        eventType: "feature_use" as const,
        pagePath: "",
        featureName: e.featuresUsed,
        durationSeconds: e.timeSpentSeconds,
      })),
      30
    );
    const stage = determineAdoptionStage(score, 30, 0);
    const recommendations = generateRecommendations(stage, [], score);
    return { score, stage, recommendations, recentEvents: events.slice(0, 20) };
  }),
  healthMetrics: protectedProcedure.query(() => getPortalHealthMetrics()),
});
