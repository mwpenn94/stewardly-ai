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
        // @ts-expect-error — type assignment mismatch
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

  // ─── SPECIALIZED WORKFLOWS ──────────────────────────────────────────
  generateSpecialNeedsPlan: protectedProcedure
    .input(z.object({
      clientAge: z.number(),
      dependentAge: z.number(),
      dependentName: z.string(),
      disabilityType: z.string(),
      currentBenefits: z.array(z.string()),
      currentAssets: z.number(),
      annualCareExpenses: z.number(),
      existingTrust: z.boolean().optional(),
      trustType: z.string().optional(),
      stateCode: z.string(),
      parentAge: z.number().optional(),
      parentHealth: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateSpecialNeedsPlan } = await import("../services/planningHierarchy/specializedWorkflows");
      return generateSpecialNeedsPlan(input);
    }),

  generateElderCarePlan: protectedProcedure
    .input(z.object({
      clientAge: z.number(),
      healthStatus: z.enum(["excellent", "good", "fair", "poor"]),
      adlLimitations: z.array(z.string()),
      iadlLimitations: z.array(z.string()),
      currentLivingSituation: z.string(),
      monthlyIncome: z.number(),
      totalAssets: z.number(),
      ltcInsurance: z.boolean(),
      ltcDailyBenefit: z.number().optional(),
      ltcBenefitPeriod: z.number().optional(),
      stateCode: z.string(),
      spouseAge: z.number().optional(),
      spouseHealth: z.string().optional(),
      veteranStatus: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateElderCarePlan } = await import("../services/planningHierarchy/specializedWorkflows");
      return generateElderCarePlan(input);
    }),

  generateCrossBorderPlan: protectedProcedure
    .input(z.object({
      citizenshipCountries: z.array(z.string()),
      residenceCountry: z.string(),
      taxResidenceCountries: z.array(z.string()),
      foreignAccounts: z.array(z.object({
        country: z.string(),
        accountType: z.string(),
        maxBalance: z.number(),
      })),
      foreignIncome: z.array(z.object({
        country: z.string(),
        type: z.string(),
        amount: z.number(),
        taxPaid: z.number(),
      })),
      foreignRealEstate: z.array(z.object({
        country: z.string(),
        value: z.number(),
        rentalIncome: z.number().optional(),
      })),
      pficHoldings: z.array(z.object({
        country: z.string(),
        fundName: z.string(),
        value: z.number(),
      })).optional(),
      totalWorldwideIncome: z.number(),
      usTaxFiled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { generateCrossBorderPlan } = await import("../services/planningHierarchy/specializedWorkflows");
      return generateCrossBorderPlan(input);
    }),

  // ─── PFR PDF EXPORT (via tRPC) ──────────────────────────────────────
  exportPFRAsPdf: protectedProcedure
    .input(z.object({
      pfrId: z.number().optional(),
      clientId: z.number().optional(),
      clientName: z.string().optional(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { exportPFR } = await import("../services/planningHierarchy/pfrExport");
      const { generatePFRPdf } = await import("../services/planningHierarchy/pfrPdfGenerator");
      const { storagePut } = await import("../storage");
      const crypto = await import("crypto");
      const pfrResult = await exportPFR({
        pfrId: input.pfrId,
        clientId: input.clientId,
        advisorId: ctx.user.id,
        advisorName: input.advisorName || ctx.user.name || "Advisor",
        firmName: input.firmName || "Stewardly AI",
        format: "markdown",
      });
      const pdfBuffer = await generatePFRPdf({
        clientName: input.clientName || `Client #${input.clientId || "Unknown"}`,
        advisorName: input.advisorName || ctx.user.name || "Advisor",
        firmName: input.firmName || "Stewardly AI",
        generatedAt: pfrResult.generatedAt,
        content: typeof pfrResult === "object" && "content" in pfrResult ? (pfrResult as any).content : "",
      });
      const suffix = crypto.randomBytes(6).toString("hex");
      const key = `pfr-exports/${ctx.user.id}/PFR-${input.clientId || "report"}-${suffix}.pdf`;
      const { url } = await storagePut(key, pdfBuffer, "application/pdf");
      return { url, generatedAt: pfrResult.generatedAt, format: "pdf" };
    }),

  // ─── MEDIUM-PRIORITY WORKFLOWS ──────────────────────────────────────
  generateProspectConversionPlan: protectedProcedure
    .input(z.object({
      prospectName: z.string(),
      prospectEmail: z.string().optional(),
      referralSource: z.string().optional(),
      estimatedAssets: z.number(),
      estimatedIncome: z.number(),
      age: z.number(),
      primaryConcerns: z.array(z.string()),
      currentAdvisor: z.boolean().optional(),
      meetingDate: z.string().optional(),
      stateCode: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { generateProspectConversionPlan } = await import("../services/planningHierarchy/mediumPriorityWorkflows");
      return generateProspectConversionPlan(input);
    }),

  generateEstateDocumentReview: protectedProcedure
    .input(z.object({
      clientAge: z.number(),
      maritalStatus: z.string(),
      stateCode: z.string(),
      hasWill: z.boolean(),
      willDate: z.string().optional(),
      hasTrust: z.boolean(),
      trustType: z.string().optional(),
      trustDate: z.string().optional(),
      hasPOA: z.boolean(),
      hasHealthcareDirective: z.boolean(),
      hasLivingWill: z.boolean(),
      hasBeneficiaryDesignations: z.boolean(),
      estimatedEstate: z.number(),
      hasMinorChildren: z.boolean(),
      hasBlendedFamily: z.boolean(),
      hasBusinessInterests: z.boolean(),
      hasCharitableIntent: z.boolean(),
      lastReviewDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateEstateDocumentReview } = await import("../services/planningHierarchy/mediumPriorityWorkflows");
      return generateEstateDocumentReview(input);
    }),

  generateCharitablePlan: protectedProcedure
    .input(z.object({
      clientAge: z.number(),
      spouseAge: z.number().optional(),
      taxBracket: z.number(),
      stateCode: z.string(),
      annualCharitableGiving: z.number(),
      appreciatedAssets: z.array(z.object({
        type: z.string(),
        value: z.number(),
        costBasis: z.number(),
        holdingPeriod: z.number(),
      })),
      charitableGoals: z.array(z.string()),
      desiredIncome: z.boolean(),
      desiredTaxDeduction: z.boolean(),
      desiredLegacy: z.boolean(),
      estimatedEstate: z.number(),
      totalIncome: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { generateCharitablePlan } = await import("../services/planningHierarchy/mediumPriorityWorkflows");
      return generateCharitablePlan(input);
    }),

  generateDivorcePlan: protectedProcedure
    .input(z.object({
      clientAge: z.number(),
      spouseAge: z.number(),
      marriageYears: z.number(),
      stateCode: z.string(),
      communityPropertyState: z.boolean(),
      totalMaritalAssets: z.number(),
      retirementAccounts: z.array(z.object({
        owner: z.string(),
        type: z.string(),
        balance: z.number(),
      })),
      realEstate: z.array(z.object({
        description: z.string(),
        value: z.number(),
        mortgage: z.number(),
        ownership: z.string(),
      })),
      businessInterests: z.array(z.object({
        name: z.string(),
        estimatedValue: z.number(),
        ownership: z.string(),
      })),
      annualIncome: z.object({ client: z.number(), spouse: z.number() }),
      childrenAges: z.array(z.number()),
      existingPrenup: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { generateDivorcePlan } = await import("../services/planningHierarchy/mediumPriorityWorkflows");
      return generateDivorcePlan(input);
    }),

  generateBusinessSuccessionPlan: protectedProcedure
    .input(z.object({
      businessType: z.string(),
      businessValue: z.number(),
      annualRevenue: z.number(),
      annualProfit: z.number(),
      ownerAge: z.number(),
      ownerHealthStatus: z.string(),
      coOwners: z.array(z.object({ name: z.string(), ownershipPct: z.number(), age: z.number() })),
      keyEmployees: z.array(z.object({ name: z.string(), role: z.string(), critical: z.boolean() })),
      desiredExitTimeline: z.number(),
      preferredSuccessor: z.string(),
      hasBuySellAgreement: z.boolean(),
      hasKeyPersonInsurance: z.boolean(),
      stateCode: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { generateBusinessSuccessionPlan } = await import("../services/planningHierarchy/mediumPriorityWorkflows");
      return generateBusinessSuccessionPlan(input);
    }),

  // ─── CASCADING PLANNING ENGINE ─────────────────────────────────────────
  forwardCascade: protectedProcedure
    .input(z.object({
      parentNodeId: z.number(),
      newTarget: z.number(),
      allocationStrategy: z.enum(["proportional", "equal", "weighted", "manual"]).default("proportional"),
      manualWeights: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { forwardCascade } = await import("../services/planningHierarchy/cascadingEngine");
      const weights = input.manualWeights
        ? Object.fromEntries(Object.entries(input.manualWeights).map(([k, v]) => [Number(k), v]))
        : undefined;
      return forwardCascade(input.parentNodeId, input.newTarget, input.allocationStrategy, weights);
    }),

  deepForwardCascade: protectedProcedure
    .input(z.object({
      rootNodeId: z.number(),
      newTarget: z.number(),
      allocationStrategy: z.enum(["proportional", "equal", "weighted"]).default("proportional"),
      maxDepth: z.number().min(1).max(10).default(8),
    }))
    .mutation(async ({ input }) => {
      const { deepForwardCascade } = await import("../services/planningHierarchy/cascadingEngine");
      return deepForwardCascade(input.rootNodeId, input.newTarget, input.allocationStrategy, input.maxDepth);
    }),

  backwardCascade: protectedProcedure
    .input(z.object({
      changedNodeId: z.number(),
      newValue: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { backwardCascade } = await import("../services/planningHierarchy/cascadingEngine");
      return backwardCascade(input.changedNodeId, input.newValue);
    }),

  checkCrossHierarchyAlignment: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { checkCrossHierarchyAlignment } = await import("../services/planningHierarchy/cascadingEngine");
      return checkCrossHierarchyAlignment(input.clientId);
    }),

  getHierarchySnapshot: protectedProcedure
    .input(z.object({ rootNodeId: z.number() }))
    .query(async ({ input }) => {
      const { getHierarchySnapshot } = await import("../services/planningHierarchy/cascadingEngine");
      return getHierarchySnapshot(input.rootNodeId);
    }),

  buildGoalStrategyMatrix: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { buildGoalStrategyMatrix } = await import("../services/planningHierarchy/cascadingEngine");
      return buildGoalStrategyMatrix(input.clientId);
    }),

  multiLevelGapAnalysis: protectedProcedure
    .input(z.object({ rootNodeId: z.number() }))
    .query(async ({ input }) => {
      const { multiLevelGapAnalysis } = await import("../services/planningHierarchy/cascadingEngine");
      return multiLevelGapAnalysis(input.rootNodeId);
    }),

  previewCascadeImpact: protectedProcedure
    .input(z.object({
      nodeId: z.number(),
      changeType: z.enum(["forward", "backward"]),
      newValue: z.number(),
    }))
    .query(async ({ input }) => {
      const { previewCascadeImpact } = await import("../services/planningHierarchy/cascadingEngine");
      return previewCascadeImpact(input.nodeId, input.changeType, input.newValue);
    }),

  computeGoalExecutionOrder: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { computeGoalExecutionOrder } = await import("../services/planningHierarchy/cascadingEngine");
      return computeGoalExecutionOrder(input.clientId);
    }),

  // ─── CROSS-SERVICE CASCADE INTEGRATION ────────────────────────────

  forwardCascadeWithAssumptions: protectedProcedure
    .input(z.object({ parentNodeId: z.number(), newTarget: z.number(), allocationStrategy: z.enum(["proportional", "equal", "weighted", "manual"]).default("proportional"), timeHorizonYears: z.number().min(1).max(50).default(10) }))
    .mutation(async ({ input }) => {
      const { forwardCascadeWithAssumptions } = await import("../services/planningHierarchy/cascadingEngine");
      return forwardCascadeWithAssumptions(input.parentNodeId, input.newTarget, input.allocationStrategy, input.timeHorizonYears);
    }),

  backwardCascadeWithRecalc: protectedProcedure
    .input(z.object({ changedNodeId: z.number(), newValue: z.number() }))
    .mutation(async ({ input }) => {
      const { backwardCascadeWithRecalc } = await import("../services/planningHierarchy/cascadingEngine");
      return backwardCascadeWithRecalc(input.changedNodeId, input.newValue);
    }),

  getCascadeDataForPFR: protectedProcedure
    .input(z.object({ clientNodeId: z.number() }))
    .query(async ({ input }) => {
      const { getCascadeDataForPFR } = await import("../services/planningHierarchy/cascadingEngine");
      return getCascadeDataForPFR(input.clientNodeId);
    }),

  cascadeBenchmarkComparison: protectedProcedure
    .input(z.object({ clientNodeId: z.number(), peerScores: z.array(z.number()).optional() }))
    .query(async ({ input }) => {
      const { cascadeBenchmarkComparison } = await import("../services/planningHierarchy/cascadingEngine");
      return cascadeBenchmarkComparison(input.clientNodeId, input.peerScores);
    }),

  propagateRecommendation: protectedProcedure
    .input(z.object({ sourceNodeId: z.number(), recommendation: z.object({ type: z.string(), description: z.string(), impact: z.number() }), direction: z.enum(["up", "down", "both"]).default("both") }))
    .mutation(async ({ input }) => {
      const { propagateRecommendation } = await import("../services/planningHierarchy/cascadingEngine");
      return propagateRecommendation(input.sourceNodeId, input.recommendation, input.direction);
    }),

  getCascadeDashboard: protectedProcedure
    .input(z.object({ clientNodeId: z.number() }))
    .query(async ({ input }) => {
      const { getCascadeDashboard } = await import("../services/planningHierarchy/cascadingEngine");
      return getCascadeDashboard(input.clientNodeId);
    }),

  // ─── Pass 119: Engagement Letter Service ─────────────────────

  generateEngagementLetter: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      advisorName: z.string(),
      firmName: z.string().default("Stewardly Financial"),
      scope: z.object({
        financialPlanning: z.boolean().default(true),
        investmentManagement: z.boolean().default(false),
        insurancePlanning: z.boolean().default(true),
        taxPlanning: z.boolean().default(false),
        estatePlanning: z.boolean().default(false),
        retirementPlanning: z.boolean().default(true),
        educationPlanning: z.boolean().default(false),
        debtManagement: z.boolean().default(false),
        businessPlanning: z.boolean().default(false),
        charitablePlanning: z.boolean().default(false),
        specialNeeds: z.boolean().default(false),
        elderCare: z.boolean().default(false),
        divorceFinancial: z.boolean().default(false),
        crossBorder: z.boolean().default(false),
        customServices: z.array(z.string()).default([]),
      }),
      feeSchedule: z.object({
        feeType: z.enum(["aum", "flat", "hourly", "commission", "hybrid"]),
        aum: z.object({ tiers: z.array(z.object({ minAssets: z.number(), maxAssets: z.number().nullable(), bps: z.number() })), minimumFee: z.number().optional() }).optional(),
        flat: z.object({ annualFee: z.number(), services: z.array(z.string()) }).optional(),
        hourly: z.object({ rate: z.number(), estimatedHours: z.number() }).optional(),
        commission: z.object({ note: z.string() }).optional(),
        hybrid: z.object({ components: z.array(z.object({ type: z.string(), amount: z.number(), description: z.string() })) }).optional(),
      }),
      fiduciaryStandard: z.enum(["fiduciary", "suitability", "best-interest"]).default("fiduciary"),
      engagementType: z.enum(["initial", "renewal", "amendment"]).default("initial"),
      effectiveDate: z.string(),
      termMonths: z.number().default(12),
      autoRenew: z.boolean().default(true),
      terminationNoticeDays: z.number().default(30),
      arbitrationClause: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { generateEngagementLetter, saveEngagementLetter } = await import("../services/planningHierarchy/engagementLetterService");
      const data = {
        ...input,
        advisorId: ctx.user.id,
        formCRS: { deliveredAt: null, acknowledgedAt: null, deliveryMethod: "portal" as const, version: "1.0", documentUrl: null },
        advDelivery: { part2ADeliveredAt: null, part2BDeliveredAt: null, acknowledgedAt: null, version: "1.0" },
        privacyPolicyDelivered: false,
        status: "draft" as const,
      };
      const { html, markdown } = await generateEngagementLetter(data);
      const id = await saveEngagementLetter(data, html, markdown);
      return { id, html, markdown };
    }),

  listEngagementLetters: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { listEngagementLetters } = await import("../services/planningHierarchy/engagementLetterService");
      return listEngagementLetters(input.clientId, ctx.user.id);
    }),

  getEngagementLetter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getEngagementLetter } = await import("../services/planningHierarchy/engagementLetterService");
      return getEngagementLetter(input.id);
    }),

  updateEngagementStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "signed", "active", "expired", "terminated"]) }))
    .mutation(async ({ input }) => {
      const { updateEngagementStatus } = await import("../services/planningHierarchy/engagementLetterService");
      return updateEngagementStatus(input.id, input.status);
    }),

  // ─── Pass 119: Year-over-Year Comparison ─────────────────────

  captureSnapshot: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      snapshotType: z.enum(["annual", "quarterly", "milestone", "manual"]).default("manual"),
      label: z.string().default("Snapshot"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { captureSnapshot } = await import("../services/planningHierarchy/yearOverYearService");
      return captureSnapshot(input.clientId, ctx.user.id, input.snapshotType, input.label);
    }),

  getSnapshots: protectedProcedure
    .input(z.object({ clientId: z.number(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const { getSnapshots } = await import("../services/planningHierarchy/yearOverYearService");
      return getSnapshots(input.clientId, input.limit);
    }),

  getYoYComparison: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { generateYoYComparison } = await import("../services/planningHierarchy/yearOverYearService");
      return generateYoYComparison(input.clientId);
    }),

  getPlanAdherence: protectedProcedure
    .input(z.object({ clientId: z.number(), periodLabel: z.string().default("Current Period") }))
    .query(async ({ input }) => {
      const { calculatePlanAdherence } = await import("../services/planningHierarchy/yearOverYearService");
      return calculatePlanAdherence(input.clientId, input.periodLabel);
    }),

  deleteSnapshot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { deleteSnapshot } = await import("../services/planningHierarchy/yearOverYearService");
      return deleteSnapshot(input.id);
    }),

  // ─── Pass 119: Underwriting Status Tracking ──────────────────

  createUnderwritingTracking: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      carrier: z.string(),
      product: z.string(),
      status: z.enum(["submitted", "underwriting", "requirements-pending", "approved", "declined", "withdrawn", "issued", "delivered"]).default("submitted"),
      requirements: z.array(z.object({
        type: z.string(),
        description: z.string(),
        status: z.enum(["pending", "received", "waived"]).default("pending"),
        dueDate: z.string().nullable().default(null),
        receivedDate: z.string().nullable().default(null),
      })).default([]),
      expectedDecisionDate: z.string().nullable().default(null),
      notes: z.string().default(""),
    }))
    .mutation(async ({ input }) => {
      const { saveUnderwritingStatus } = await import("../services/planningHierarchy/engagementLetterService");
      return saveUnderwritingStatus({ ...input, submittedAt: new Date().toISOString(), lastStatusUpdate: new Date().toISOString() });
    }),

  listUnderwritingStatuses: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ input }) => {
      const { listUnderwritingStatuses } = await import("../services/planningHierarchy/engagementLetterService");
      return listUnderwritingStatuses(input.clientId);
    }),

  updateUnderwritingTracking: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      status: z.enum(["submitted", "underwriting", "requirements-pending", "approved", "declined", "withdrawn", "issued", "delivered"]),
      requirements: z.array(z.object({
        type: z.string(),
        description: z.string(),
        status: z.enum(["pending", "received", "waived"]),
        dueDate: z.string().nullable(),
        receivedDate: z.string().nullable(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateUnderwritingStatus } = await import("../services/planningHierarchy/engagementLetterService");
      return updateUnderwritingStatus(input.applicationId, input.status, input.requirements);
    }),

  // ─── Pass 119: Meeting Management Enhancements ───────────────

  generatePreMeetingBrief: protectedProcedure
    .input(z.object({ clientId: z.number(), meetingPurpose: z.string() }))
    .query(async ({ ctx, input }) => {
      const { generatePreMeetingBrief } = await import("../services/planningHierarchy/engagementLetterService");
      return generatePreMeetingBrief(input.clientId, ctx.user.id, input.meetingPurpose);
    }),

  extractActionItems: protectedProcedure
    .input(z.object({ meetingNotes: z.string() }))
    .mutation(async ({ input }) => {
      const { extractActionItems } = await import("../services/planningHierarchy/engagementLetterService");
      return extractActionItems(input.meetingNotes);
    }),

  saveMeetingActionItems: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      meetingId: z.number(),
      items: z.array(z.object({ item: z.string(), assignee: z.string(), dueDate: z.string() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { saveMeetingActionItems } = await import("../services/planningHierarchy/engagementLetterService");
      return saveMeetingActionItems(input.clientId, ctx.user.id, input.meetingId, input.items);
    }),

  listMeetingActionItems: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { listMeetingActionItems } = await import("../services/planningHierarchy/engagementLetterService");
      return listMeetingActionItems(input.clientId);
    }),

  updateActionItemStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "done", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const { updateActionItemStatus } = await import("../services/planningHierarchy/engagementLetterService");
      return updateActionItemStatus(input.id, input.status);
    }),

  // ─── Pass 119: Compliance Audit Enhancements ─────────────────

  generateAuditSample: protectedProcedure
    .input(z.object({
      reviewPeriod: z.string(),
      sampleSize: z.number().default(10),
      reviewType: z.enum(["random", "targeted", "comprehensive"]).default("random"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { generateAuditSample } = await import("../services/planningHierarchy/engagementLetterService");
      return generateAuditSample(ctx.user.id, input.reviewPeriod, input.sampleSize, input.reviewType);
    }),

  saveComplianceAuditSample: protectedProcedure
    .input(z.object({
      reviewPeriod: z.string(),
      sampleSize: z.number(),
      selectedAccounts: z.array(z.number()),
      reviewType: z.enum(["random", "targeted", "comprehensive"]),
      findings: z.array(z.object({
        accountId: z.number(),
        finding: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        resolved: z.boolean(),
      })).default([]),
      reviewDate: z.string(),
      status: z.enum(["pending", "in-progress", "completed", "escalated"]).default("pending"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { saveComplianceAuditSample } = await import("../services/planningHierarchy/engagementLetterService");
      return saveComplianceAuditSample({ ...input, supervisorId: ctx.user.id });
    }),

  listComplianceAuditSamples: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const { listComplianceAuditSamples } = await import("../services/planningHierarchy/engagementLetterService");
      return listComplianceAuditSamples(ctx.user.id);
    }),

  // ─── Pass 119: Privacy Consent Tracking (Reg S-P) ────────────

  recordPrivacyConsent: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      consentType: z.enum(["data-sharing", "third-party", "marketing", "cross-practice"]),
      granted: z.boolean(),
      details: z.string().default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const { recordPrivacyConsent } = await import("../services/planningHierarchy/engagementLetterService");
      return recordPrivacyConsent(input.clientId, ctx.user.id, input.consentType, input.granted, input.details);
    }),

  getPrivacyConsents: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { getPrivacyConsents } = await import("../services/planningHierarchy/engagementLetterService");
      return getPrivacyConsents(input.clientId);
    }),

  // ─── Pass 119: PFR Auto-Archival (FINRA 3-year retention) ────

  archivePFR: protectedProcedure
    .input(z.object({ pfrId: z.number() }))
    .mutation(async ({ input }) => {
      const { archivePFRDocument } = await import("../services/planningHierarchy/engagementLetterService");
      return archivePFRDocument(input.pfrId);
    }),

  listArchivedPFRs: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const { listArchivedPFRs } = await import("../services/planningHierarchy/engagementLetterService");
      return listArchivedPFRs(ctx.user.id);
    }),

  // ─── Pass 119: Suitability & Assumption Drift Detection ──────

  checkSuitabilityStaleness: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { checkSuitabilityStaleness } = await import("../services/planningHierarchy/engagementLetterService");
      return checkSuitabilityStaleness(input.clientId);
    }),

  detectAssumptionDrift: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { detectAssumptionDrift } = await import("../services/planningHierarchy/engagementLetterService");
      return detectAssumptionDrift(input.clientId);
    }),

  // ─── Pass 119: Comprehensive Wealth Engine Optimization ──────

  generateFiduciaryFile: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { generateUnifiedFiduciaryFile } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return generateUnifiedFiduciaryFile(input.clientId, ctx.user.id);
    }),

  detectAssumptionDriftV2: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { detectAssumptionDrift: detectDrift } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return detectDrift(input.clientId);
    }),

  findOrphanedRecommendations: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { findOrphanedRecommendations } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return findOrphanedRecommendations(input.clientId);
    }),

  linkRecommendationToGoal: protectedProcedure
    .input(z.object({ recommendationId: z.number(), goalId: z.number() }))
    .mutation(async ({ input }) => {
      const { linkRecommendationToGoal } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return linkRecommendationToGoal(input.recommendationId, input.goalId);
    }),

  detectDataStaleness: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { detectDataStaleness } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return detectDataStaleness(input.clientId);
    }),

  generatePlanningHealthReport: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { generatePlanningHealthReport } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return generatePlanningHealthReport(input.clientId);
    }),

  validateCrossCalculatorConsistency: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { validateCrossCalculatorConsistency } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return validateCrossCalculatorConsistency(input.clientId);
    }),

  runComprehensiveDiagnostic: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { runComprehensiveDiagnostic } = await import("../services/planningHierarchy/wealthEngineOptimizer");
      return runComprehensiveDiagnostic(input.clientId, ctx.user.id);
    }),

  // ── Pass 120: Unified Client Plan ──────────────────────────────
  getUnifiedClientPlan: protectedProcedure
    .input(z.object({ clientId: z.number(), clientName: z.string().optional() }))
    .query(async ({ input }) => {
      const { getUnifiedClientPlan } = await import("../services/planningHierarchy/unifiedClientPlan");
      return getUnifiedClientPlan(input.clientId);
    }),
  runClientBackwardPlan: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { generateBackPlan } = await import("../services/planningHierarchy/unifiedClientPlan");
      return generateBackPlan(input.clientId);
    }),
  runClientForwardPlan: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { generateForwardPlan } = await import("../services/planningHierarchy/unifiedClientPlan");
      return generateForwardPlan(input.clientId);
    }),
  rollPracticeIncomeToClient: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      rollUpType: z.enum(["percentage", "fixed", "above_threshold"]),
      rollUpValue: z.number(),
      threshold: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getPracticeToClientRollup } = await import("../services/planningHierarchy/unifiedClientPlan");
      // @ts-expect-error — strict mode fix
      return getPracticeToClientRollup(input.clientId, input.rollUpType, input.rollUpValue, input.threshold);
    }),
  cascadeClientPlanAlignment: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      sourceDomain: z.string(),
      changes: z.record(z.string(), z.number()),
    }))
    .mutation(async ({ input }) => {
      const { cascadeClientPlan } = await import("../services/planningHierarchy/unifiedClientPlan");
      return cascadeClientPlan(input.clientId, input.sourceDomain as any, input.changes);
    }),

  // ── Pass 120: Firm Comparison Engine ────────────────────────────
  generateFirmComparison: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      aum: z.number().optional(),
      income: z.number().optional(),
      netWorth: z.number().optional(),
      age: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { generateFirmComparison } = await import("../services/planningHierarchy/firmComparisonEngine");
      return generateFirmComparison(input.clientId, {
        aum: input.aum, income: input.income, netWorth: input.netWorth, age: input.age,
      });
    }),
  compareStrategyAcrossFirms: protectedProcedure
    .input(z.object({ clientId: z.number(), strategyName: z.string() }))
    .query(async ({ input }) => {
      const { compareStrategyAcrossFirms } = await import("../services/planningHierarchy/firmComparisonEngine");
      return compareStrategyAcrossFirms(input.clientId, input.strategyName);
    }),
  getWealthBridgeAdvantage: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { getWealthBridgeAdvantage } = await import("../services/planningHierarchy/firmComparisonEngine");
      return getWealthBridgeAdvantage(input.clientId);
    }),

  // ── Pass 120: Cascade Notifications & Client Summary ───────────
  scanCascadeAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const { scanForCascadeAlerts } = await import("../services/planningHierarchy/cascadeNotifications");
      return scanForCascadeAlerts(ctx.user.id);
    }),
  generateClientFacingSummary: protectedProcedure
    .input(z.object({ clientId: z.number(), clientName: z.string().optional() }))
    .query(async ({ input }) => {
      const { generateClientFacingSummary } = await import("../services/planningHierarchy/cascadeNotifications");
      return generateClientFacingSummary(input.clientId, input.clientName ?? "Client");
    }),
  generateBulkEngagementLetters: protectedProcedure
    .input(z.object({
      clientIds: z.array(z.number()).optional(),
      renewalOnly: z.boolean().optional(),
      feeSchedule: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { generateBulkEngagementLetters } = await import("../services/planningHierarchy/cascadeNotifications");
      return generateBulkEngagementLetters(ctx.user.id, input);
    }),
  // ── Pass 120: Strategy Archetypes & Leader Personas ─────────────
  getAllArchetypes: protectedProcedure
    .query(async () => {
      const { getAllArchetypes } = await import("../services/planningHierarchy/strategyArchetypes");
      return getAllArchetypes();
    }),
  getArchetype: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const { getArchetype } = await import("../services/planningHierarchy/strategyArchetypes");
      return getArchetype(input.id);
    }),
  getAllStrategyCategories: protectedProcedure
    .query(async () => {
      const { getAllStrategyCategories } = await import("../services/planningHierarchy/strategyArchetypes");
      return getAllStrategyCategories();
    }),
  matchClientToArchetypes: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { matchClientToArchetypes } = await import("../services/planningHierarchy/strategyArchetypes");
      return matchClientToArchetypes(input.clientId);
    }),
  compareArchetypes: protectedProcedure
    .input(z.object({ archetypeIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      const { compareArchetypes } = await import("../services/planningHierarchy/strategyArchetypes");
      return compareArchetypes(input.archetypeIds);
    }),
  getArchetypeToolMapping: protectedProcedure
    .input(z.object({ archetypeId: z.string() }))
    .query(async ({ input }) => {
      const { getArchetypeToolMapping } = await import("../services/planningHierarchy/strategyArchetypes");
      return getArchetypeToolMapping(input.archetypeId);
    }),
  getStrategiesForArchetype: protectedProcedure
    .input(z.object({ archetypeId: z.string() }))
    .query(async ({ input }) => {
      const { getStrategiesForArchetype } = await import("../services/planningHierarchy/strategyArchetypes");
      return getStrategiesForArchetype(input.archetypeId);
    }),
});
