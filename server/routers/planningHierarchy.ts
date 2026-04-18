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
});
