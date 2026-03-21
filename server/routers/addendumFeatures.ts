/**
 * Addendum Features Router — Tasks #21-36
 * Maps to actual service function signatures
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as promptAB from "../services/promptABTesting";
import * as prescreen from "../services/compliancePrescreening";
import * as canary from "../services/canaryDeployment";
import * as kg from "../services/knowledgeGraphDynamic";
import * as whatIf from "../services/whatIfScenarios";
import * as adaptive from "../services/adaptiveContext";
import * as errorHandling from "../services/errorHandling";
import * as calcPersist from "../services/calculatorPersistence";
import * as predictive from "../services/predictiveInsights";
import * as regMonitor from "../services/regulatoryMonitor";
import * as onboarding from "../services/roleOnboarding";
import * as suitability from "../services/productSuitability";
import * as disclaimers from "../services/dynamicDisclaimers";
import * as escalation from "../services/proactiveEscalation";
import * as literacy from "../services/financialLiteracy";

export const addendumFeaturesRouter = router({
  // ─── Task #21: Prompt A/B Testing ──────────────────────────────────
  promptAB: router({
    assignVariant: protectedProcedure
      .input(z.object({ experimentId: z.number(), conversationId: z.number() }))
      .mutation(async ({ input }) => promptAB.assignVariant(input.experimentId, input.conversationId)),

    recordFeedback: protectedProcedure
      .input(z.object({
        experimentId: z.number(),
        variantLabel: z.enum(["A", "B"]),
        positive: z.boolean(),
        latencyMs: z.number().optional(),
      }))
      .mutation(async ({ input }) => promptAB.recordExperimentFeedback(input.experimentId, input.variantLabel, input.positive, input.latencyMs)),

    checkSignificance: protectedProcedure
      .input(z.object({ experimentId: z.number() }))
      .query(async ({ input }) => ({ significant: await promptAB.checkSignificance(input.experimentId) })),

    runRegression: protectedProcedure
      .input(z.object({ variantId: z.number() }))
      .mutation(async ({ input }) => ({ passed: await promptAB.runRegressionTests(input.variantId) })),

    activeExperiments: protectedProcedure
      .query(async () => promptAB.getActiveExperiments()),

    history: protectedProcedure
      .query(async () => promptAB.getExperimentHistory()),

    goldenTests: protectedProcedure
      .query(async () => promptAB.getGoldenTests()),

    regressionRuns: protectedProcedure
      .query(async () => promptAB.getRegressionRuns()),
  }),

  // ─── Task #22: Compliance Pre-Screening ────────────────────────────
  prescreen: router({
    check: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        messageId: z.number(),
        responseText: z.string(),
      }))
      .mutation(async ({ input }) => prescreen.prescreenResponse(input.conversationId, input.messageId, input.responseText)),

    conversationScore: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => prescreen.getConversationComplianceScore(input.conversationId)),

    history: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => prescreen.getPrescreeningHistory(input.conversationId)),

    flagged: protectedProcedure
      .query(async () => prescreen.getFlaggedConversations()),
  }),

  // ─── Task #23: Canary Deployment ───────────────────────────────────
  canary: router({
    preDeployChecklist: protectedProcedure
      .mutation(async () => canary.runPreDeployChecklist()),

    create: protectedProcedure
      .input(z.object({
        version: z.string(),
        description: z.string().optional(),
        rolloutPercentage: z.number().optional(),
        maxErrorRate: z.number().optional(),
      }))
      .mutation(async ({ input }) => canary.createDeployment(input)),

    updateRollout: protectedProcedure
      .input(z.object({ deploymentId: z.number(), percentage: z.number(), errorRate: z.number().optional() }))
      .mutation(async ({ input }) => canary.updateRollout(input.deploymentId, input.percentage, input.errorRate)),

    history: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => canary.getDeploymentHistory(input?.limit)),

    latestChecks: protectedProcedure
      .query(async () => canary.getLatestChecks()),

    current: protectedProcedure
      .query(async () => canary.getCurrentDeployment()),
  }),

  // ─── Task #24: Dynamic Knowledge Graph ─────────────────────────────
  knowledgeGraph: router({
    processText: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => kg.processTextForGraph(input.text)),

    extractEntities: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => kg.extractEntitiesFromText(input.text)),

    neighborhood: protectedProcedure
      .input(z.object({ entityId: z.number(), depth: z.number().optional() }))
      .query(async ({ input }) => kg.getEntityNeighborhood(input.entityId, input.depth)),

    search: protectedProcedure
      .input(z.object({ query: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => kg.searchEntities(input.query, input.limit)),

    stats: protectedProcedure
      .query(async () => kg.getGraphStats()),
  }),

  // ─── Task #25: What-If Scenarios ───────────────────────────────────
  whatIf: router({
    runScenario: protectedProcedure
      .input(z.object({
        scenarioName: z.string(),
        modelType: z.string(),
        portfolio: z.array(z.object({ assetClass: z.string(), percentage: z.number() })),
        params: z.any(),
        baseRunId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => whatIf.runWhatIfScenario(ctx.user.id, input.scenarioName, input.modelType, input.portfolio, input.params, input.baseRunId)),

    runBacktest: protectedProcedure
      .input(z.object({
        modelType: z.string(),
        historicalEvent: z.string(),
        portfolio: z.array(z.object({ assetClass: z.string(), percentage: z.number() })),
      }))
      .mutation(async ({ input, ctx }) => whatIf.runBacktest(ctx.user.id, input.modelType, input.historicalEvent, input.portfolio)),

    userScenarios: protectedProcedure
      .query(async ({ ctx }) => whatIf.getUserScenarios(ctx.user.id)),

    userBacktests: protectedProcedure
      .query(async ({ ctx }) => whatIf.getUserBacktests(ctx.user.id)),

    historicalEvents: publicProcedure
      .query(async () => whatIf.HISTORICAL_EVENTS),
  }),

  // ─── Task #26: Adaptive Context ────────────────────────────────────
  adaptiveContext: router({
    assemble: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        messageId: z.number().optional(),
        layers: z.array(z.any()),
        userMessage: z.string(),
        conversationLength: z.number(),
      }))
      .mutation(async ({ input }) => adaptive.assembleContext(input.conversationId, input.messageId, input.layers, input.userMessage, input.conversationLength)),

    detectComplexity: publicProcedure
      .input(z.object({ message: z.string(), conversationLength: z.number() }))
      .query(async ({ input }) => ({ level: adaptive.detectComplexity(input.message, input.conversationLength) })),

    assemblyLog: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => adaptive.getAssemblyLog(input.conversationId)),

    stats: protectedProcedure
      .query(async () => adaptive.getContextStats()),
  }),

  // ─── Task #27: Error Handling ──────────────────────────────────────
  errorHandling: router({
    logError: protectedProcedure
      .input(z.object({
        type: z.string(),
        message: z.string(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        context: z.any().optional(),
        stack: z.string().optional(),
        userId: z.number().optional(),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input }) => errorHandling.logError(input)),

    circuitState: protectedProcedure
      .input(z.object({ serviceName: z.string() }))
      .query(async ({ input }) => ({ state: errorHandling.getCircuitState(input.serviceName) })),

    recentErrors: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => errorHandling.getRecentErrors(input?.limit)),

    stats: protectedProcedure
      .query(async () => errorHandling.getErrorStats()),

    resolve: protectedProcedure
      .input(z.object({ errorId: z.number() }))
      .mutation(async ({ input }) => errorHandling.resolveError(input.errorId)),
  }),

  // ─── Task #29: Calculator Persistence ──────────────────────────────
  calculatorPersistence: router({
    save: protectedProcedure
      .input(z.object({
        calculatorType: z.string(),
        name: z.string(),
        inputs: z.any(),
        results: z.any(),
      }))
      .mutation(async ({ input, ctx }) => ({ id: await calcPersist.saveScenario(ctx.user.id, input.calculatorType, input.name, input.inputs, input.results) })),

    list: protectedProcedure
      .input(z.object({ calculatorType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => calcPersist.getUserScenarios(ctx.user.id, input?.calculatorType)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => calcPersist.getScenario(input.id, ctx.user.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => calcPersist.deleteScenario(input.id, ctx.user.id)),

    compare: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input, ctx }) => calcPersist.compareScenarios(input.ids, ctx.user.id)),
  }),

  // ─── Task #30: Predictive Insights ─────────────────────────────────
  predictiveInsights: router({
    benchmark: protectedProcedure
      .input(z.object({ dimension: z.string(), ageBracket: z.string().optional(), incomeBracket: z.string().optional() }))
      .query(async ({ input }) => predictive.getPeerBenchmark(input.dimension, input.ageBracket, input.incomeBracket)),

    percentile: protectedProcedure
      .input(z.object({ value: z.number(), dimension: z.string(), ageBracket: z.string().optional() }))
      .query(async ({ input }) => ({ percentile: await predictive.computePercentile(input.value, input.dimension, input.ageBracket) })),

    evaluateTriggers: protectedProcedure
      .input(z.object({ context: z.record(z.string(), z.any()) }))
      .mutation(async ({ input }) => predictive.evaluateTriggers(input.context)),

    triggers: protectedProcedure
      .query(async () => predictive.listTriggers()),

    benchmarks: protectedProcedure
      .query(async () => predictive.listBenchmarks()),
  }),

  // ─── Task #31: Regulatory Monitor ──────────────────────────────────
  regulatoryMonitor: router({
    ingest: protectedProcedure
      .input(z.object({
        source: z.string(),
        title: z.string(),
        summary: z.string().optional(),
        categories: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => regMonitor.ingestRegulatoryUpdate(input)),

    recentUpdates: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => regMonitor.getRecentUpdates(input?.limit)),

    impactAnalyses: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => regMonitor.getImpactAnalyses(input?.limit)),

    weeklyBriefs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => regMonitor.getWeeklyBriefs(input?.limit)),

    generateBrief: protectedProcedure
      .mutation(async () => ({ briefId: await regMonitor.generateWeeklyBrief() })),

    alerts: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => regMonitor.getAlerts(input?.limit)),

    disclaimer: protectedProcedure
      .input(z.object({ topic: z.string() }))
      .query(async ({ input }) => regMonitor.getCurrentDisclaimer(input.topic)),
  }),

  // ─── Task #32: Role Onboarding ─────────────────────────────────────
  onboarding: router({
    initialize: protectedProcedure
      .input(z.object({
        path: z.enum(["advisor", "client", "admin"]),
        skipBasics: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => onboarding.initializeOnboarding(ctx.user.id, input.path, input.skipBasics)),

    completeStep: protectedProcedure
      .input(z.object({
        path: z.enum(["advisor", "client", "admin"]),
        stepId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => onboarding.completeStep(ctx.user.id, input.path, input.stepId)),

    progress: protectedProcedure
      .input(z.object({ path: z.enum(["advisor", "client", "admin"]).optional() }).optional())
      .query(async ({ input, ctx }) => onboarding.getOnboardingProgress(ctx.user.id, input?.path)),

    steps: publicProcedure
      .input(z.object({ path: z.enum(["advisor", "client", "admin"]) }))
      .query(async ({ input }) => onboarding.getOnboardingSteps(input.path)),
  }),

  // ─── Task #33: Product Suitability ─────────────────────────────────
  productSuitability: router({
    evaluate: protectedProcedure
      .input(z.object({
        productId: z.number(),
        dimensions: z.array(z.any()),
      }))
      .mutation(async ({ input, ctx }) => suitability.evaluateProductSuitability(input.productId, ctx.user.id, input.dimensions)),

    userEvaluations: protectedProcedure
      .query(async ({ ctx }) => suitability.getProductEvaluations(ctx.user.id)),
  }),

  // ─── Task #34: Dynamic Disclaimers ─────────────────────────────────
  disclaimers: router({
    detectTopic: publicProcedure
      .input(z.object({ message: z.string() }))
      .query(async ({ input }) => ({ topic: disclaimers.detectTopic(input.message) })),

    handleTopicChange: protectedProcedure
      .input(z.object({ conversationId: z.number(), messageId: z.number(), message: z.string() }))
      .mutation(async ({ input }) => disclaimers.handleTopicChange(input.conversationId, input.messageId, input.message)),

    trackInteraction: protectedProcedure
      .input(z.object({ disclaimerId: z.number(), action: z.enum(["shown", "scrolled", "clicked", "acknowledged"]) }))
      .mutation(async ({ input, ctx }) => disclaimers.trackDisclaimerInteraction(input.disclaimerId, ctx.user.id, input.action)),

    engagement: protectedProcedure
      .input(z.object({ disclaimerId: z.number() }))
      .query(async ({ input }) => disclaimers.getDisclaimerEngagement(input.disclaimerId)),

    topicHistory: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => disclaimers.getConversationTopicHistory(input.conversationId)),

    all: protectedProcedure
      .query(async () => disclaimers.getAllDisclaimers()),
  }),

  // ─── Task #35: Proactive Escalation ────────────────────────────────
  escalation: router({
    rules: publicProcedure
      .query(async () => escalation.getEscalationRules()),
  }),

  // ─── Task #36: Financial Literacy ──────────────────────────────────
  literacy: router({
    assess: protectedProcedure
      .input(z.object({ messages: z.array(z.string()) }))
      .mutation(async ({ input }) => literacy.assessLiteracy(input.messages)),

    setGuardrail: protectedProcedure
      .input(z.object({ guardrailType: z.string(), value: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => ({ id: await literacy.setGuardrail(ctx.user.id, input.guardrailType, input.value, input.reason) })),

    guardrails: protectedProcedure
      .query(async ({ ctx }) => literacy.getUserGuardrails(ctx.user.id)),

    removeGuardrail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => literacy.removeGuardrail(input.id, ctx.user.id)),
  }),
});
