/**
 * planningHierarchy.ts — tRPC router for the Unified Hierarchical Planning Architecture.
 * Exposes forward/backward planning, roll-up/roll-down, PFR management,
 * client goals, rich references, and shared assumptions.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as phDb from "../services/planningHierarchy/db";

const planningNodeInput = z.object({
  parentId: z.number().optional(),
  level: z.enum(["platform", "region", "team", "advisor", "client", "goal", "strategy", "implementation"]),
  entityType: z.string(),
  entityId: z.number(),
  label: z.string().optional(),
  forwardTarget: z.string().optional(),
  forwardTargetDate: z.string().optional(),
  forwardMilestones: z.any().optional(),
  forwardAssumptions: z.any().optional(),
  backwardRequiredInput: z.string().optional(),
  backwardRequiredDate: z.string().optional(),
  backwardSteps: z.any().optional(),
  currentValue: z.string().optional(),
  gapValue: z.string().optional(),
  gapPercentage: z.string().optional(),
  probabilityOfSuccess: z.string().optional(),
  reasoningChain: z.any().optional(),
  alternativesConsidered: z.any().optional(),
  suitabilityScore: z.string().optional(),
  complianceFlags: z.any().optional(),
  status: z.enum(["draft", "active", "review", "archived"]).optional(),
});

const clientGoalInput = z.object({
  clientId: z.number(),
  advisorId: z.number().optional(),
  planningNodeId: z.number().optional(),
  goalCategory: z.enum([
    "protection", "retirement", "estate", "tax", "education", "debt",
    "growth", "business", "cash_flow", "premium_finance", "ilit",
    "exec_comp", "charitable", "legacy", "healthcare",
  ]),
  goalName: z.string(),
  goalDescription: z.string().optional(),
  targetAmount: z.string().optional(),
  currentAmount: z.string().optional(),
  targetDate: z.string().optional(),
  timeHorizonYears: z.number().optional(),
  priorityRank: z.number().optional(),
  probabilityOfSuccess: z.string().optional(),
  confidenceIntervalLow: z.string().optional(),
  confidenceIntervalHigh: z.string().optional(),
  dependsOnGoals: z.any().optional(),
  conflictsWithGoals: z.any().optional(),
  status: z.enum([
    "identified", "agreed", "in_progress", "on_track",
    "at_risk", "achieved", "deferred", "abandoned",
  ]).optional(),
});

export const planningHierarchyRouter = router({
  // ─── PLANNING NODES ──────────────────────────────────────────────────

  createNode: protectedProcedure
    .input(planningNodeInput)
    .mutation(async ({ ctx, input }) => {
      const id = await phDb.createPlanningNode({
        ...input,
        ownerId: ctx.user.id,
        parentId: input.parentId ?? null,
      } as any);
      return { id };
    }),

  getNode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return phDb.getPlanningNode(input.id);
    }),

  getChildren: protectedProcedure
    .input(z.object({ parentId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getChildNodes(input.parentId);
    }),

  getRoots: protectedProcedure
    .query(async ({ ctx }) => {
      return phDb.getRootNodes(ctx.user.id);
    }),

  getByLevel: protectedProcedure
    .input(z.object({ level: z.string() }))
    .query(async ({ ctx, input }) => {
      return phDb.getNodesByLevel(ctx.user.id, input.level);
    }),

  getByEntity: protectedProcedure
    .input(z.object({ entityType: z.string(), entityId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getNodesByEntity(input.entityType, input.entityId);
    }),

  updateNode: protectedProcedure
    .input(z.object({ id: z.number(), data: planningNodeInput.partial() }))
    .mutation(async ({ input }) => {
      await phDb.updatePlanningNode(input.id, input.data as any);
      return { success: true };
    }),

  // Roll-up / Roll-down
  rollUp: protectedProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ input }) => {
      return phDb.rollUpValue(input.nodeId);
    }),

  getAncestors: protectedProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getAncestorChain(input.nodeId);
    }),

  getDescendants: protectedProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getDescendantIds(input.nodeId);
    }),

  // ─── CLIENT GOALS ────────────────────────────────────────────────────

  createGoal: protectedProcedure
    .input(clientGoalInput)
    .mutation(async ({ input }) => {
      const id = await phDb.createClientGoal(input as any);
      return { id };
    }),

  getGoals: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getClientGoals(input.clientId);
    }),

  getAdvisorGoals: protectedProcedure
    .query(async ({ ctx }) => {
      return phDb.getGoalsByAdvisor(ctx.user.id);
    }),

  updateGoal: protectedProcedure
    .input(z.object({ id: z.number(), data: clientGoalInput.partial() }))
    .mutation(async ({ input }) => {
      await phDb.updateClientGoal(input.id, input.data as any);
      return { success: true };
    }),

  // ─── REFERENCES ──────────────────────────────────────────────────────

  addReference: protectedProcedure
    .input(z.object({
      planningNodeId: z.number(),
      refType: z.enum([
        "regulatory", "academic", "carrier", "market_data",
        "case_law", "internal", "illustration", "fact_sheet",
      ]),
      title: z.string(),
      citation: z.string().optional(),
      url: z.string().optional(),
      relevance: z.string().optional(),
      dateAccessed: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await phDb.addReference(input as any);
      return { id };
    }),

  getReferences: protectedProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getReferencesForNode(input.nodeId);
    }),

  // ─── PFR (Personal Financial Reviews) ────────────────────────────────

  createPFR: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      planningNodeId: z.number().optional(),
      reviewType: z.enum(["initial", "annual", "life_event", "regulatory", "ad_hoc"]),
      reviewDate: z.string(),
      sectionsIncluded: z.any().optional(),
      calculatorOutputsSnapshot: z.any().optional(),
      goalHierarchySnapshot: z.any().optional(),
      recommendationsSnapshot: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await phDb.createPFR({
        ...input,
        advisorId: ctx.user.id,
      } as any);
      return { id };
    }),

  getClientPFRs: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getClientPFRs(input.clientId);
    }),

  getMyPFRs: protectedProcedure
    .query(async ({ ctx }) => {
      return phDb.getAdvisorPFRs(ctx.user.id);
    }),

  updatePFR: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        advisorApprovedAt: z.string().optional(),
        clientAcknowledgedAt: z.string().optional(),
        complianceReviewStatus: z.enum(["pending", "approved", "flagged", "escalated"]).optional(),
        documentUrl: z.string().optional(),
        documentKey: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await phDb.updatePFR(input.id, input.data as any);
      return { success: true };
    }),

  // ─── CLIENT DISCOVERY ────────────────────────────────────────────────

  upsertDiscovery: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      valuesPriorities: z.any().optional(),
      riskAttitudes: z.any().optional(),
      familyDynamics: z.any().optional(),
      healthStatus: z.any().optional(),
      employerBenefits: z.any().optional(),
      existingDocuments: z.any().optional(),
      anticipatedLifeEvents: z.any().optional(),
      preferredContactMethod: z.string().optional(),
      preferredMeetingFrequency: z.string().optional(),
      preferredReportDetailLevel: z.enum(["summary", "standard", "detailed"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await phDb.upsertClientDiscovery({
        ...input,
        advisorId: ctx.user.id,
      } as any);
      return { id };
    }),

  getDiscovery: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return phDb.getClientDiscovery(input.clientId);
    }),

  // ─── PLANNING ASSUMPTIONS ────────────────────────────────────────────

  upsertAssumptions: protectedProcedure
    .input(z.object({
      scope: z.enum(["platform", "firm", "advisor", "client"]).optional(),
      scopeEntityId: z.number().optional(),
      inflationRate: z.string().optional(),
      equityReturn: z.string().optional(),
      bondReturn: z.string().optional(),
      riskFreeRate: z.string().optional(),
      taxBracketFederal: z.string().optional(),
      taxBracketState: z.string().optional(),
      capitalGainsRate: z.string().optional(),
      estateExemption: z.string().optional(),
      sofrRate: z.string().optional(),
      mortalityTable: z.string().optional(),
      customAssumptions: z.any().optional(),
      source: z.enum(["manual", "fred_api", "market_data", "firm_default"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await phDb.upsertPlanningAssumptions({
        ...input,
        ownerId: ctx.user.id,
      } as any);
      return { id };
    }),

  getAssumptions: protectedProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return phDb.getAssumptions(ctx.user.id, input?.scope);
    }),

  resolveAssumptions: protectedProcedure
    .input(z.object({ clientId: z.number(), advisorId: z.number().optional() }))
    .query(async ({ input }) => {
      return phDb.resolveEffectiveAssumptions(input.clientId, input.advisorId);
    }),

  // ─── PFR GENERATION ───────────────────────────────────────────────────

  generatePFR: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      reviewType: z.enum(["initial", "annual", "life_event", "regulatory", "ad_hoc"]),
      planningNodeId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { generatePFR } = await import("../services/planningHierarchy/pfrGenerator");
      const pfr = await generatePFR({
        clientId: input.clientId,
        advisorId: ctx.user.id,
        reviewType: input.reviewType,
        planningNodeId: input.planningNodeId,
      });
      return pfr;
    }),

  listPFRs: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { listPFRs } = await import("../services/planningHierarchy/pfrGenerator");
      return listPFRs(input.clientId);
    }),

  getPFR: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getPFR } = await import("../services/planningHierarchy/pfrGenerator");
      return getPFR(input.id);
    }),

  // ─── ALSO MY CLIENT CROSS-CASCADE ─────────────────────────────────────

  bridgeContactToClient: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      financialProfile: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // When an advisor marks a contact as "Also My Client",
      // create a client-level planning node linked to the advisor's practice node.
      // 1. Find or create the advisor's practice-level root node
      let advisorRoots = await phDb.getRootNodes(ctx.user.id);
      let practiceNode = advisorRoots.find(n => n.level === "advisor" && n.entityType === "advisor");
      if (!practiceNode) {
        const id = await phDb.createPlanningNode({
          parentId: null,
          level: "advisor",
          entityType: "advisor",
          entityId: ctx.user.id,
          ownerId: ctx.user.id,
          label: "My Practice",
          status: "active",
        } as any);
        practiceNode = await phDb.getPlanningNode(id);
      }

      // 2. Create a client-level node under the practice node
      const clientNodeId = await phDb.createPlanningNode({
        parentId: practiceNode!.id,
        level: "client",
        entityType: "client",
        entityId: input.contactId,
        ownerId: ctx.user.id,
        label: `Client #${input.contactId}`,
        status: "active",
        metadata: {
          bridgedFrom: "also_my_client",
          bridgedAt: new Date().toISOString(),
          financialProfile: input.financialProfile ?? null,
        },
      } as any);

      // 3. Trigger roll-up so the practice node aggregates the new client
      const rollUp = await phDb.rollUpValue(practiceNode!.id);

      return { clientNodeId, practiceNodeId: practiceNode!.id, rollUp };
    }),

  // ─── FULL TREE ────────────────────────────────────────────────────────

  getFullTree: protectedProcedure
    .input(z.object({ rootNodeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Build a full tree from the user's root nodes
      const roots = input?.rootNodeId
        ? [await phDb.getPlanningNode(input.rootNodeId)].filter(Boolean)
        : await phDb.getRootNodes(ctx.user.id);

      async function buildTree(node: any): Promise<any> {
        const children = await phDb.getChildNodes(node.id);
        const refs = await phDb.getReferencesForNode(node.id);
        return {
          ...node,
          references: refs,
          children: await Promise.all(children.map(buildTree)),
        };
      }

      return Promise.all(roots.map(buildTree));
    }),

  // ─── SHARED ASSUMPTIONS (hierarchy-resolved) ──────────────────────────

  resolveSharedAssumptions: protectedProcedure
    .input(z.object({
      clientId: z.number().optional(),
      advisorId: z.number().optional(),
      teamId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { resolveAssumptions } = await import("../services/planningHierarchy/sharedAssumptions");
      return resolveAssumptions(
        ctx.user.id,
        input?.clientId,
        input?.advisorId ?? ctx.user.id,
        input?.teamId,
      );
    }),

  setSharedAssumption: protectedProcedure
    .input(z.object({
      scope: z.enum(["platform", "team", "advisor", "client"]),
      scopeEntityId: z.number().nullable().optional(),
      key: z.string(),
      value: z.number(),
      label: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { setAssumption } = await import("../services/planningHierarchy/sharedAssumptions");
      await setAssumption(
        ctx.user.id,
        input.scope,
        input.scopeEntityId ?? null,
        input.key,
        input.value,
        input.label,
        input.source,
      );
      return { success: true };
    }),

  getDefaultAssumptions: protectedProcedure
    .query(async () => {
      const { DEFAULT_ASSUMPTIONS } = await import("../services/planningHierarchy/sharedAssumptions");
      return DEFAULT_ASSUMPTIONS;
    }),

  getScopeAssumptions: protectedProcedure
    .input(z.object({
      scope: z.enum(["platform", "team", "advisor", "client"]),
      scopeEntityId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { getAssumptionsForScope } = await import("../services/planningHierarchy/sharedAssumptions");
      return getAssumptionsForScope(ctx.user.id, input.scope, input.scopeEntityId);
    }),

  // ─── RECOMMENDATION → GOAL LINKING ────────────────────────────────────

  linkRecommendationToGoals: protectedProcedure
    .input(z.object({
      recommendationId: z.number(),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { linkRecommendationToGoals } = await import("../services/planningHierarchy/recommendationGoalLinker");
      return linkRecommendationToGoals(
        input.recommendationId,
        ctx.user.id,
        input.clientId,
      );
    }),

  recalculateGoalProbability: protectedProcedure
    .input(z.object({ goalId: z.number() }))
    .mutation(async ({ input }) => {
      const { recalculateGoalProbability } = await import("../services/planningHierarchy/recommendationGoalLinker");
      return recalculateGoalProbability(input.goalId);
    }),

  // ─── SUITABILITY GATE ─────────────────────────────────────────────────

  checkSuitabilityGate: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { checkSuitabilityGate } = await import("../services/planningHierarchy/recommendationGoalLinker");
      return checkSuitabilityGate(input.userId);
    }),

  // ─── COMPLIANCE ATTESTATION ───────────────────────────────────────────

  generateComplianceAttestation: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      documentId: z.number(),
      attestationType: z.enum(["pfr_delivery", "recommendation", "replacement_analysis"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { generateComplianceAttestation } = await import("../services/planningHierarchy/recommendationGoalLinker");
      return generateComplianceAttestation(
        ctx.user.id,
        input.clientId,
        input.documentId,
        input.attestationType,
      );
    }),

  validateReasoningChain: protectedProcedure
    .input(z.object({ chain: z.any() }))
    .query(async ({ input }) => {
      const { validateReasoningChain } = await import("../services/planningHierarchy/recommendationGoalLinker");
      const missing = validateReasoningChain(input.chain);
      return { valid: missing.length === 0, missingFields: missing };
    }),

  // ─── ALSO MY CLIENT SYNC ─────────────────────────────────────────────

  syncClientToPlanning: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      profileData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { syncClientToPlanning } = await import("../services/planningHierarchy/alsoMyClientSync");
      return syncClientToPlanning(input.clientId, ctx.user.id, input.profileData);
    }),

  syncPracticeToClients: protectedProcedure
    .input(z.object({
      changeType: z.enum(["rate_update", "product_update", "regulatory_alert", "assumption_change"]),
      changeData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { syncPracticeToClients } = await import("../services/planningHierarchy/alsoMyClientSync");
      return syncPracticeToClients(ctx.user.id, input.changeType, input.changeData);
    }),

  verifyRollUpConsistency: protectedProcedure
    .query(async ({ ctx }) => {
      const { verifyRollUpConsistency } = await import("../services/planningHierarchy/alsoMyClientSync");
      return verifyRollUpConsistency(ctx.user.id);
    }),

  // ─── POLICY DELIVERY & FREE LOOK ─────────────────────────────────────

  createPolicyDelivery: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      clientId: z.number(),
      policyNumber: z.string(),
      carrierName: z.string(),
      productType: z.string(),
      faceAmount: z.number().optional(),
      annualPremium: z.number().optional(),
      freeLookDays: z.number().optional(),
      planningNodeId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createPolicyDelivery } = await import("../services/planningHierarchy/advancedWorkflows");
      const id = await createPolicyDelivery({ ...input, advisorId: ctx.user.id });
      return { id };
    }),

  listPolicyDeliveries: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { listPolicyDeliveries } = await import("../services/planningHierarchy/advancedWorkflows");
      return listPolicyDeliveries(ctx.user.id, input ?? {});
    }),

  getPolicyDelivery: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getPolicyDelivery } = await import("../services/planningHierarchy/advancedWorkflows");
      return getPolicyDelivery(input.id);
    }),

  recordDelivery: protectedProcedure
    .input(z.object({
      id: z.number(),
      deliveredAt: z.number(),
      deliveryMethod: z.enum(["in_person", "mail", "electronic", "video_call"]),
      deliveryReceiptUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { recordDelivery } = await import("../services/planningHierarchy/advancedWorkflows");
      return recordDelivery(input.id, input);
    }),

  recordClientAcknowledgment: protectedProcedure
    .input(z.object({ id: z.number(), signatureUrl: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { recordClientAcknowledgment } = await import("../services/planningHierarchy/advancedWorkflows");
      return recordClientAcknowledgment(input.id, input.signatureUrl);
    }),

  exerciseFreeLook: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { exerciseFreeLook } = await import("../services/planningHierarchy/advancedWorkflows");
      return exerciseFreeLook(input.id);
    }),

  getFreeLookAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const { getFreeLookAlerts } = await import("../services/planningHierarchy/advancedWorkflows");
      return getFreeLookAlerts(ctx.user.id);
    }),

  expireFreeLookPeriods: protectedProcedure
    .mutation(async () => {
      const { expireFreeLookPeriods } = await import("../services/planningHierarchy/advancedWorkflows");
      const count = await expireFreeLookPeriods();
      return { expired: count };
    }),

  // ─── 1035 EXCHANGE ANALYSIS ──────────────────────────────────────────

  createExchangeAnalysis: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      existingPolicyNumber: z.string().optional(),
      existingCarrier: z.string().optional(),
      existingProductType: z.string().optional(),
      existingCashValue: z.number().optional(),
      existingSurrenderValue: z.number().optional(),
      existingSurrenderCharge: z.number().optional(),
      existingDeathBenefit: z.number().optional(),
      existingAnnualPremium: z.number().optional(),
      existingLoanBalance: z.number().optional(),
      existingCostBasis: z.number().optional(),
      proposedCarrier: z.string().optional(),
      proposedProductType: z.string().optional(),
      proposedDeathBenefit: z.number().optional(),
      proposedAnnualPremium: z.number().optional(),
      planningNodeId: z.number().optional(),
      goalId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createExchangeAnalysis, compute1035Comparison } = await import("../services/planningHierarchy/advancedWorkflows");
      const comparison = compute1035Comparison(
        {
          cashValue: input.existingCashValue ?? 0,
          surrenderValue: input.existingSurrenderValue ?? 0,
          surrenderCharge: input.existingSurrenderCharge ?? 0,
          deathBenefit: input.existingDeathBenefit ?? 0,
          annualPremium: input.existingAnnualPremium ?? 0,
          loanBalance: input.existingLoanBalance ?? 0,
          costBasis: input.existingCostBasis ?? 0,
        },
        {
          deathBenefit: input.proposedDeathBenefit ?? 0,
          annualPremium: input.proposedAnnualPremium ?? 0,
        }
      );
      const id = await createExchangeAnalysis({
        ...input,
        advisorId: ctx.user.id,
        comparisonJson: comparison,
        status: "draft",
      });
      return { id, comparison };
    }),

  getExchangeAnalysis: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getExchangeAnalysis } = await import("../services/planningHierarchy/advancedWorkflows");
      return getExchangeAnalysis(input.id);
    }),

  listExchangeAnalyses: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { listExchangeAnalyses } = await import("../services/planningHierarchy/advancedWorkflows");
      return listExchangeAnalyses(ctx.user.id, input?.clientId);
    }),

  updateExchangeStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "analysis_complete", "client_reviewed", "approved", "submitted", "completed", "cancelled"]),
      recommendationAction: z.enum(["exchange", "keep_existing", "supplement", "needs_further_review"]).optional(),
      recommendationSummary: z.string().optional(),
      suitabilityRationale: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateExchangeAnalysis } = await import("../services/planningHierarchy/advancedWorkflows");
      return updateExchangeAnalysis(input.id, input);
    }),

  // ─── BENEFICIARY REVIEW ──────────────────────────────────────────────

  createBeneficiaryReview: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      policyOrAccountRef: z.string(),
      accountType: z.enum(["life_insurance", "annuity", "ira", "401k", "roth_ira", "brokerage", "trust", "bank", "other"]),
      carrierOrCustodian: z.string().optional(),
      currentBeneficiariesJson: z.any().optional(),
      reviewTrigger: z.enum(["annual_review", "life_event", "estate_plan_change", "divorce", "death", "new_policy", "client_request", "regulatory"]).optional(),
      lifeEventDescription: z.string().optional(),
      planningNodeId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createBeneficiaryReview } = await import("../services/planningHierarchy/advancedWorkflows");
      const id = await createBeneficiaryReview({ ...input, advisorId: ctx.user.id });
      return { id };
    }),

  getBeneficiaryReview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getBeneficiaryReview } = await import("../services/planningHierarchy/advancedWorkflows");
      return getBeneficiaryReview(input.id);
    }),

  listBeneficiaryReviews: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { listBeneficiaryReviews } = await import("../services/planningHierarchy/advancedWorkflows");
      return listBeneficiaryReviews(ctx.user.id, input?.clientId);
    }),

  updateBeneficiaryReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      proposedBeneficiariesJson: z.any().optional(),
      estateAlignmentNotes: z.string().optional(),
      taxImplicationsNotes: z.string().optional(),
      perStirpesVsPerCapita: z.enum(["per_stirpes", "per_capita", "not_applicable"]).optional(),
      changeRequired: z.boolean().optional(),
      status: z.enum(["pending_review", "reviewed", "changes_needed", "changes_submitted", "confirmed", "no_changes_needed"]).optional(),
      nextReviewDate: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateBeneficiaryReview } = await import("../services/planningHierarchy/advancedWorkflows");
      return updateBeneficiaryReview(input.id, input);
    }),

  analyzeBeneficiaries: protectedProcedure
    .input(z.object({
      beneficiaries: z.array(z.object({
        name: z.string(),
        relationship: z.string(),
        percentage: z.number(),
        type: z.enum(["primary", "contingent"]),
        isMinor: z.boolean().optional(),
        isTrust: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { analyzeBeneficiaryDesignations } = await import("../services/planningHierarchy/advancedWorkflows");
      return analyzeBeneficiaryDesignations(input.beneficiaries);
    }),

  getBeneficiaryReviewsDue: protectedProcedure
    .query(async ({ ctx }) => {
      const { getBeneficiaryReviewsDue } = await import("../services/planningHierarchy/advancedWorkflows");
      return getBeneficiaryReviewsDue(ctx.user.id);
    }),

  // ─── TAX RETURN REVIEW ───────────────────────────────────────────────

  createTaxReturnReview: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      taxYear: z.number(),
      filingStatus: z.enum(["single", "married_filing_jointly", "married_filing_separately", "head_of_household", "qualifying_widow"]).optional(),
      documentUrl: z.string().optional(),
      planningNodeId: z.number().optional(),
      goalId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createTaxReturnReview } = await import("../services/planningHierarchy/advancedWorkflows");
      const id = await createTaxReturnReview({ ...input, advisorId: ctx.user.id });
      return { id };
    }),

  getTaxReturnReview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getTaxReturnReview } = await import("../services/planningHierarchy/advancedWorkflows");
      return getTaxReturnReview(input.id);
    }),

  listTaxReturnReviews: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { listTaxReturnReviews } = await import("../services/planningHierarchy/advancedWorkflows");
      return listTaxReturnReviews(ctx.user.id, input?.clientId);
    }),

  updateTaxReturnReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      adjustedGrossIncome: z.number().optional(),
      taxableIncome: z.number().optional(),
      totalTaxLiability: z.number().optional(),
      filingStatus: z.enum(["single", "married_filing_jointly", "married_filing_separately", "head_of_household", "qualifying_widow"]).optional(),
      capitalGainsShortTerm: z.number().optional(),
      capitalGainsLongTerm: z.number().optional(),
      dividendIncome: z.number().optional(),
      interestIncome: z.number().optional(),
      businessIncome: z.number().optional(),
      rentalIncome: z.number().optional(),
      retirementDistributions: z.number().optional(),
      charitableDeductions: z.number().optional(),
      mortgageInterest: z.number().optional(),
      saltDeductions: z.number().optional(),
      itemizedVsStandard: z.enum(["itemized", "standard"]).optional(),
      status: z.enum(["pending_upload", "uploaded", "under_review", "reviewed", "action_items_created", "completed"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateTaxReturnReview } = await import("../services/planningHierarchy/advancedWorkflows");
      return updateTaxReturnReview(input.id, input);
    }),

  analyzeTaxReturn: protectedProcedure
    .input(z.object({
      adjustedGrossIncome: z.number(),
      taxableIncome: z.number(),
      totalTaxLiability: z.number(),
      filingStatus: z.string(),
      capitalGainsShortTerm: z.number().optional(),
      capitalGainsLongTerm: z.number().optional(),
      dividendIncome: z.number().optional(),
      interestIncome: z.number().optional(),
      businessIncome: z.number().optional(),
      rentalIncome: z.number().optional(),
      retirementDistributions: z.number().optional(),
      charitableDeductions: z.number().optional(),
      mortgageInterest: z.number().optional(),
      saltDeductions: z.number().optional(),
      itemizedVsStandard: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { analyzeTaxReturn } = await import("../services/planningHierarchy/advancedWorkflows");
      return analyzeTaxReturn(input);
    }),

  // ─── BENCHMARK COMPARISONS ───────────────────────────────────────────

  computeBenchmarks: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      age: z.number(),
      annualIncome: z.number(),
      savingsRate: z.number().optional(),
      totalDebt: z.number().optional(),
      emergencyFundBalance: z.number().optional(),
      monthlyExpenses: z.number().optional(),
      retirementSavings: z.number().optional(),
      lifeInsuranceCoverage: z.number().optional(),
      netWorth: z.number().optional(),
      effectiveTaxRate: z.number().optional(),
      planningNodeId: z.number().optional(),
      goalId: z.number().optional(),
      persist: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { computeBenchmarks, saveBenchmarkSnapshot } = await import("../services/planningHierarchy/benchmarkEngine");
      const result = computeBenchmarks(input);
      if (input.persist !== false) {
        await saveBenchmarkSnapshot(ctx.user.id, input.clientId, result, input.planningNodeId, input.goalId);
      }
      return result;
    }),

  getLatestBenchmarks: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getLatestBenchmarks } = await import("../services/planningHierarchy/benchmarkEngine");
      return getLatestBenchmarks(ctx.user.id, input.clientId);
    }),

  // ─── PFR EXPORT ──────────────────────────────────────────────────────

  exportPFR: protectedProcedure
    .input(z.object({
      pfrId: z.number().optional(),
      clientId: z.number().optional(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      format: z.enum(["html", "markdown"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { exportPFR } = await import("../services/planningHierarchy/pfrExport");
      return exportPFR({
        ...input,
        advisorId: ctx.user.id,
      });
    }),

  // ─── WEALTH ENGINE OPTIMIZATION ─────────────────────────────────────

  computeCollateralTracking: protectedProcedure
    .input(z.object({
      projections: z.array(z.object({
        year: z.number(),
        policyValue: z.number(),
        loanBalance: z.number(),
        netEquity: z.number(),
      })),
      maxLTV: z.number().min(50).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const { computeCollateralTracking } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return computeCollateralTracking(input.projections, input.maxLTV);
    }),

  modelExitStrategies: protectedProcedure
    .input(z.object({
      projections: z.array(z.object({
        year: z.number(),
        policyValue: z.number(),
        loanBalance: z.number(),
        netEquity: z.number(),
        deathBenefit: z.number(),
        cumulativeCashOutlay: z.number(),
      })),
      costBasis: z.number().optional(),
      marginalTaxRate: z.number().min(0).max(0.5).optional(),
    }))
    .mutation(async ({ input }) => {
      const { modelExitStrategies, getExitRecommendation } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      const strategies = modelExitStrategies(input.projections, input.costBasis, input.marginalTaxRate);
      const recommendation = getExitRecommendation(strategies);
      return { strategies, recommendation };
    }),

  evaluateSeniorProtections: protectedProcedure
    .input(z.object({
      age: z.number().min(18).max(120),
      productType: z.string(),
      transactionAmount: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const { evaluateSeniorProtections } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return evaluateSeniorProtections(input.age, input.productType, input.transactionAmount);
    }),

  aggregateGaps: protectedProcedure
    .input(z.object({
      outcomes: z.array(z.object({
        planArea: z.string(),
        targetMetric: z.string().optional(),
        targetValue: z.number().optional(),
        currentValue: z.number().optional(),
        gapValue: z.number().optional(),
        gapPercentage: z.number().optional(),
      })),
      calculatorResults: z.object({
        retirement: z.object({ projectedBalance: z.number(), targetBalance: z.number() }).optional(),
        insurance: z.object({ currentCoverage: z.number(), recommendedCoverage: z.number() }).optional(),
        estate: z.object({ currentValue: z.number(), targetValue: z.number() }).optional(),
        tax: z.object({ currentRate: z.number(), targetRate: z.number() }).optional(),
        debt: z.object({ currentDebt: z.number(), targetDebt: z.number() }).optional(),
        savings: z.object({ currentRate: z.number(), targetRate: z.number() }).optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const { aggregateGaps } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return aggregateGaps(input.outcomes, input.calculatorResults);
    }),

  checkMarketingCompliance: protectedProcedure
    .input(z.object({
      hasPerformanceData: z.boolean().optional(),
      hasTestimonials: z.boolean().optional(),
      hasEndorsements: z.boolean().optional(),
      hasHypotheticalPerformance: z.boolean().optional(),
      hasBacktestedPerformance: z.boolean().optional(),
      hasPredictions: z.boolean().optional(),
      hasGuarantees: z.boolean().optional(),
      targetAudience: z.enum(["retail", "institutional", "qualified"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { checkMarketingRuleCompliance } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return checkMarketingRuleCompliance(input);
    }),
});
