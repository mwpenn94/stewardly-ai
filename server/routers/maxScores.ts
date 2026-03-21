/**
 * Max-Scores Router — wires all max-scores services (1A-5C) into tRPC
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as llmFailover from "../services/llmFailover";
import * as adaptivePrompts from "../services/adaptivePrompts";
import * as meetingIntelligence from "../services/meetingIntelligence";
import * as regBI from "../services/regBIDocumentation";
import * as mfa from "../services/mfaService";
import * as fairness from "../services/fairnessTesting";
import * as infra from "../services/infrastructureResilience";
import * as webhookReceiver from "../services/webhookReceiver";

export const maxScoresRouter = router({
  // ─── 1A: LLM Failover ─────────────────────────────────────────────────
  llmProviderStatus: protectedProcedure.query(() => llmFailover.getProviderStatus()),
  llmProviderMetrics: adminProcedure.query(() => llmFailover.getProviderMetrics()),
  llmResetProvider: adminProcedure.input(z.object({ providerId: z.string() })).mutation(({ input }) => {
    llmFailover.resetProvider(input.providerId);
    return { success: true };
  }),
  classifyComplexity: protectedProcedure.input(z.object({ message: z.string() })).query(({ input }) => ({
    complexity: llmFailover.classifyComplexity(input.message),
    modelConfig: llmFailover.selectModelForComplexity(llmFailover.classifyComplexity(input.message)),
  })),

  // ─── 1B: Adaptive Prompts ─────────────────────────────────────────────
  getAdaptivePrompts: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(({ ctx, input }) =>
    adaptivePrompts.getAdaptivePrompts(ctx.user.id, input?.limit)
  ),
  generateContextualPrompts: protectedProcedure.input(z.object({ lastMessage: z.string() })).mutation(({ ctx, input }) =>
    adaptivePrompts.generateContextualPrompts(ctx.user.id, input.lastMessage)
  ),

  // ─── 1C: Meeting Intelligence ──────────────────────────────────────────
  generatePreMeetingBrief: protectedProcedure.input(z.object({ clientId: z.number() })).mutation(({ ctx, input }) =>
    meetingIntelligence.generatePreMeetingBrief(ctx.user.id, input.clientId)
  ),
  generateMeetingSummary: protectedProcedure.input(z.object({ transcription: z.string(), meetingId: z.number() })).mutation(({ input }) =>
    meetingIntelligence.generateMeetingSummary(input.transcription, input.meetingId)
  ),
  processTranscription: protectedProcedure.input(z.object({ audioUrl: z.string() })).mutation(({ input }) =>
    meetingIntelligence.processTranscription(input.audioUrl)
  ),

  // ─── 1D: Reg BI Documentation ─────────────────────────────────────────
  generateRegBI: protectedProcedure.input(z.object({
    clientId: z.number(),
    productId: z.number(),
    recommendationSummary: z.string(),
    clientProfile: z.record(z.string(), z.unknown()),
  })).mutation(({ ctx, input }) =>
    regBI.generateRegBIDocumentation({ userId: ctx.user.id, ...input })
  ),

  // ─── 1E: COI Disclosure ────────────────────────────────────────────────
  createCOI: protectedProcedure.input(z.object({
    disclosureType: z.enum(["compensation", "affiliation", "ownership", "referral", "other"]),
    description: z.string(),
    relatedProductId: z.number().optional(),
    severity: z.enum(["low", "medium", "high"]),
  })).mutation(({ ctx, input }) =>
    regBI.createCOIDisclosure({ userId: ctx.user.id, ...input })
  ),
  listCOI: protectedProcedure.query(({ ctx }) => regBI.listCOIDisclosures(ctx.user.id)),
  acknowledgeCOI: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
    regBI.acknowledgeCOI(input.id)
  ),
  detectConflicts: protectedProcedure.input(z.object({ productId: z.number() })).query(({ ctx, input }) =>
    regBI.detectConflicts(ctx.user.id, input.productId)
  ),

  // ─── 1F: Report Builder ────────────────────────────────────────────────
  createReportTemplate: adminProcedure.input(z.object({
    name: z.string(),
    category: z.string(),
    templateBody: z.string(),
    sections: z.unknown().optional(),
    branding: z.unknown().optional(),
  })).mutation(({ ctx, input }) =>
    regBI.createReportTemplate({ ...input, createdBy: ctx.user.id })
  ),
  listReportTemplates: protectedProcedure.query(() => regBI.listReportTemplates()),
  generateReport: protectedProcedure.input(z.object({
    templateId: z.number(),
    clientId: z.number().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  })).mutation(({ ctx, input }) =>
    regBI.generateReport({ userId: ctx.user.id, ...input })
  ),

  // ─── 2A: Model Cards ──────────────────────────────────────────────────
  createModelCard: adminProcedure.input(z.object({
    modelName: z.string(),
    version: z.string(),
    description: z.string(),
    intendedUse: z.string(),
    limitations: z.string(),
    trainingDataSummary: z.string(),
    performanceMetrics: z.record(z.string(), z.unknown()),
    fairnessMetrics: z.record(z.string(), z.unknown()),
    ethicalConsiderations: z.string(),
  })).mutation(({ ctx, input }) =>
    regBI.createModelCard({ ...input, createdBy: ctx.user.id })
  ),
  listModelCards: protectedProcedure.query(() => regBI.listModelCards()),
  getModelCard: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => regBI.getModelCard(input.id)),
  publishModelCard: adminProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => regBI.publishModelCard(input.id)),

  // ─── 2C: Fairness Testing ─────────────────────────────────────────────
  runFairnessTests: adminProcedure.input(z.object({ systemPrompt: z.string() })).mutation(({ input }) =>
    fairness.runFairnessTestSuite(input.systemPrompt)
  ),
  getFairnessTestCases: protectedProcedure.query(() => fairness.FAIRNESS_TEST_CASES),

  // ─── 2D: Performance Monitoring ────────────────────────────────────────
  recordMetric: protectedProcedure.input(z.object({
    metricName: z.string(),
    metricCategory: z.enum(["latency", "throughput", "error_rate", "availability", "ai_quality", "user_satisfaction"]),
    value: z.number(),
    unit: z.string().optional(),
    slaTarget: z.number().optional(),
  })).mutation(({ input }) => regBI.recordMetric(input)),
  getMetricsSummary: protectedProcedure.input(z.object({
    category: z.string().optional(),
  }).optional()).query(({ input }) => regBI.getMetricsSummary(input?.category)),

  // ─── 2E: Recommendation Explanations ───────────────────────────────────
  logRecommendation: protectedProcedure.input(z.object({
    conversationId: z.number().optional(),
    messageId: z.number().optional(),
    productId: z.number().optional(),
    recommendationType: z.enum(["product", "strategy", "action", "allocation", "rebalance"]),
    summary: z.string(),
    reasoning: z.string(),
    factors: z.record(z.string(), z.unknown()),
    confidenceScore: z.number(),
    suitabilityScore: z.number(),
    riskLevel: z.enum(["low", "medium", "high", "very_high"]),
    disclaimers: z.array(z.string()),
  })).mutation(({ ctx, input }) =>
    regBI.logRecommendation({ userId: ctx.user.id, ...input })
  ),
  getRecommendationExplanation: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
    regBI.getRecommendationExplanation(input.id)
  ),
  listRecommendations: protectedProcedure.query(({ ctx }) => regBI.listRecommendations(ctx.user.id)),
  updateRecommendationStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["accepted", "rejected", "implemented", "expired"]),
  })).mutation(({ input }) => regBI.updateRecommendationStatus(input.id, input.status)),

  // ─── 3A: MFA ──────────────────────────────────────────────────────────
  enrollMFA: protectedProcedure.mutation(({ ctx }) => mfa.enrollMFA(ctx.user.id)),
  verifyMFA: protectedProcedure.input(z.object({ code: z.string() })).mutation(({ ctx, input }) =>
    mfa.verifyMFA(ctx.user.id, input.code)
  ),
  getMFAStatus: protectedProcedure.query(({ ctx }) => mfa.getMFAStatus(ctx.user.id)),
  disableMFA: protectedProcedure.mutation(({ ctx }) => mfa.disableMFA(ctx.user.id)),

  // ─── 3B: Security ─────────────────────────────────────────────────────
  getCSPHeaders: adminProcedure.query(() => mfa.getCSPHeaders()),
  checkRateLimit: protectedProcedure.input(z.object({
    key: z.string(),
    maxRequests: z.number(),
    windowMs: z.number(),
  })).query(({ input }) => mfa.checkRateLimit(input.key, input.maxRequests, input.windowMs)),

  // ─── 3D: Privacy ──────────────────────────────────────────────────────
  recordConsent: protectedProcedure.input(z.object({
    consentType: z.enum(["ai_chat", "voice", "doc_upload", "data_sharing", "marketing", "analytics", "third_party"]),
    granted: z.boolean(),
  })).mutation(({ ctx, input }) =>
    mfa.recordConsent({ userId: ctx.user.id, ...input })
  ),
  getConsents: protectedProcedure.query(({ ctx }) => mfa.getConsents(ctx.user.id)),
  generateDSAR: protectedProcedure.mutation(({ ctx }) => mfa.generateDSAR(ctx.user.id)),
  generateROPA: adminProcedure.query(() => mfa.generateROPA()),

  // ─── 4A: Infrastructure ────────────────────────────────────────────────
  systemHealth: adminProcedure.query(() => infra.checkSystemHealth()),
  backupDocs: adminProcedure.query(() => infra.getBackupDocumentation()),

  // ─── 4B.2: Workflow Checkpoint ─────────────────────────────────────────
  createWorkflow: protectedProcedure.input(z.object({
    name: z.string(),
    steps: z.array(z.object({ name: z.string(), input: z.unknown().optional() })),
    maxRetries: z.number().optional(),
  })).mutation(({ input }) => infra.createWorkflow(input.name, input.steps, input.maxRetries)),
  advanceWorkflow: protectedProcedure.input(z.object({ workflowId: z.string(), output: z.unknown().optional() })).mutation(({ input }) =>
    infra.advanceWorkflow(input.workflowId, input.output)
  ),
  failWorkflow: protectedProcedure.input(z.object({ workflowId: z.string(), error: z.string() })).mutation(({ input }) =>
    infra.failWorkflow(input.workflowId, input.error)
  ),
  getWorkflow: protectedProcedure.input(z.object({ workflowId: z.string() })).query(({ input }) => infra.getWorkflow(input.workflowId)),
  listWorkflows: protectedProcedure.query(() => infra.listWorkflows()),

  // ─── 4B.3: Carrier Integration ─────────────────────────────────────────
  getCarrierQuotes: protectedProcedure.input(z.object({
    carrierId: z.string().default("carrier-1"),
    productType: z.enum(["term_life", "whole_life", "universal_life", "annuity", "disability"]),
    applicant: z.object({
      age: z.number(),
      gender: z.string(),
      health: z.string(),
      smoker: z.boolean(),
      state: z.string(),
    }),
    coverage: z.object({
      amount: z.number(),
      term: z.number().optional(),
    }),
  })).mutation(({ input }) => infra.getCarrierQuotes(input)),

  // ─── 4B.4: Paper Trading ───────────────────────────────────────────────
  initPaperPortfolio: protectedProcedure.input(z.object({ initialCash: z.number().optional() }).optional()).mutation(({ ctx, input }) =>
    infra.initPaperPortfolio(ctx.user.id, input?.initialCash)
  ),
  executePaperTrade: protectedProcedure.input(z.object({
    symbol: z.string(),
    action: z.enum(["buy", "sell"]),
    quantity: z.number(),
    price: z.number(),
  })).mutation(({ ctx, input }) =>
    infra.executePaperTrade(ctx.user.id, input.symbol, input.action, input.quantity, input.price)
  ),
  getPaperPortfolio: protectedProcedure.query(({ ctx }) => infra.getPaperPortfolio(ctx.user.id)),

  // ─── 5A: UX Config ────────────────────────────────────────────────────
  getUXConfig: protectedProcedure.query(({ ctx }) => adaptivePrompts.getUXConfig(ctx.user.id)),
  updateUXConfig: protectedProcedure.input(z.object({
    collapsibleThreshold: z.number().optional(),
    animationsEnabled: z.boolean().optional(),
    offlineMode: z.enum(["cache-first", "network-first", "disabled"]).optional(),
    compactMode: z.boolean().optional(),
    fontSize: z.enum(["small", "medium", "large"]).optional(),
    reducedMotion: z.boolean().optional(),
  })).mutation(({ ctx, input }) => adaptivePrompts.updateUXConfig(ctx.user.id, input)),

  // ─── 5B: Multi-Tenant ─────────────────────────────────────────────────
  listTenants: adminProcedure.query(() => adaptivePrompts.listTenants()),
  createTenant: adminProcedure.input(z.object({
    orgId: z.number(),
    brandName: z.string(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    logoUrl: z.string().optional(),
    features: z.array(z.string()),
    maxUsers: z.number(),
    maxConversations: z.number(),
    aiTokenBudget: z.number(),
  })).mutation(({ input }) => adaptivePrompts.createTenant(input)),

  // ─── 5C: Data Ingestion Pipelines ──────────────────────────────────────
  listPipelines: adminProcedure.query(() => adaptivePrompts.listPipelines()),
  getPipelineStatus: adminProcedure.input(z.object({ pipelineId: z.string() })).query(({ input }) =>
    adaptivePrompts.getPipelineStatus(input.pipelineId)
  ),
  triggerSelfHealing: adminProcedure.input(z.object({ pipelineId: z.string() })).mutation(({ input }) =>
    adaptivePrompts.triggerSelfHealing(input.pipelineId)
  ),
  pausePipeline: adminProcedure.input(z.object({ pipelineId: z.string() })).mutation(({ input }) => {
    adaptivePrompts.pausePipeline(input.pipelineId);
    return { success: true };
  }),
  resumePipeline: adminProcedure.input(z.object({ pipelineId: z.string() })).mutation(({ input }) => {
    adaptivePrompts.resumePipeline(input.pipelineId);
    return { success: true };
  }),

  // ─── Webhook Receiver ──────────────────────────────────────────────────
  listWebhookEvents: protectedProcedure.input(z.object({ connectionId: z.string(), limit: z.number().optional() })).query(({ input }) =>
    webhookReceiver.listWebhookEvents(input.connectionId, input.limit)
  ),
  retryWebhookEvent: protectedProcedure.input(z.object({ eventId: z.string() })).mutation(({ input }) =>
    webhookReceiver.retryWebhookEvent(input.eventId)
  ),
});
