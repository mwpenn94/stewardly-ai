/**
 * v4 Feature Routers — Memory Engine, Knowledge Graph, Education,
 * Student Loans, Equity Comp, Digital Assets, COI Network
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  extractMemoriesFromMessage, saveExtractedMemories,
  generateEpisodeSummary, saveEpisodeSummary,
  assembleMemoryContext, getEpisodes,
} from "../memoryEngine";
import {
  addNode, getNodes, updateNode, deleteNode,
  addEdge, getEdges, deleteEdge, getFullGraph,
  assembleGraphContext,
} from "../knowledgeGraph";
import {
  classifyContent, applyModifications,
  logComplianceAudit, getComplianceAuditLog,
  logPrivacyAudit, getPrivacyAuditLog,
} from "../complianceCopilot";
import {
  getModules, getModuleById, getUserProgress,
  startModule, completeModule, recommendModules,
  seedEducationModules,
} from "../educationEngine";
import {
  addLoan, getLoans, updateLoan, deleteLoan,
  compareAllScenarios, calculateStandardRepayment,
} from "../studentLoanOptimizer";
import {
  addGrant, getGrants, updateGrant, deleteGrant,
  compareExerciseStrategies,
} from "../equityComp";
import {
  addDigitalAsset, getDigitalAssets, updateDigitalAsset,
  deleteDigitalAsset, calculateEstateReadiness,
} from "../digitalAssetEstate";
import {
  addCoiContact, getCoiContacts, updateCoiContact, deleteCoiContact,
  addReferral, getReferrals, updateReferralOutcome,
  getNetworkAnalytics,
} from "../coiNetwork";

// ─── KNOWLEDGE GRAPH ROUTER ────────────────────────────────────
export const knowledgeGraphRouter = router({
  getGraph: protectedProcedure.query(({ ctx }) => getFullGraph(ctx.user.id)),
  getNodes: protectedProcedure
    .input(z.object({ nodeType: z.string().optional() }).optional())
    .query(({ ctx, input }) => getNodes(ctx.user.id, input?.nodeType)),
  addNode: protectedProcedure
    .input(z.object({
      nodeType: z.enum(["person", "account", "goal", "insurance", "property", "liability", "income", "tax", "estate", "product", "regulation", "document", "advisor", "beneficiary"]),
      label: z.string().min(1),
      dataJson: z.any().optional(),
      status: z.enum(["active", "inactive", "pending"]).optional(),
    }))
    .mutation(({ ctx, input }) => addNode({ userId: ctx.user.id, ...input })),
  updateNode: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      dataJson: z.any().optional(),
      status: z.enum(["active", "inactive", "pending"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateNode(id, ctx.user.id, data);
    }),
  deleteNode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteNode(input.id, ctx.user.id)),
  addEdge: protectedProcedure
    .input(z.object({
      sourceNodeId: z.number(),
      targetNodeId: z.number(),
      edgeType: z.enum(["owns", "benefits_from", "funds", "pays", "governs", "depends_on", "conflicts_with", "beneficiary_of", "manages", "insures", "employs", "related_to"]),
      weight: z.number().optional(),
      metadataJson: z.any().optional(),
    }))
    .mutation(({ ctx, input }) => addEdge({ userId: ctx.user.id, ...input })),
  deleteEdge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteEdge(input.id, ctx.user.id)),
});

// ─── EDUCATION ROUTER ──────────────────────────────────────────
export const educationRouter = router({
  modules: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      await seedEducationModules(); // Ensure seeded
      return getModules(input?.category);
    }),
  module: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getModuleById(input.id)),
  progress: protectedProcedure.query(({ ctx }) => getUserProgress(ctx.user.id)),
  start: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .mutation(({ ctx, input }) => startModule(ctx.user.id, input.moduleId)),
  complete: protectedProcedure
    .input(z.object({ moduleId: z.number(), score: z.number().optional() }))
    .mutation(({ ctx, input }) => completeModule(ctx.user.id, input.moduleId, input.score)),
  recommended: protectedProcedure.query(async ({ ctx }) => {
    await seedEducationModules();
    return recommendModules(ctx.user.id);
  }),
});

// ─── STUDENT LOANS ROUTER ──────────────────────────────────────
export const studentLoansRouter = router({
  list: protectedProcedure.query(({ ctx }) => getLoans(ctx.user.id)),
  add: protectedProcedure
    .input(z.object({
      servicer: z.string().optional(),
      balance: z.number().positive(),
      rate: z.number().min(0),
      loanType: z.enum(["subsidized", "unsubsidized", "plus", "grad_plus", "private", "consolidation"]),
      repaymentPlan: z.string().optional(),
      paymentsMade: z.number().optional(),
      remainingTerm: z.number().optional(),
      pslfQualifyingPayments: z.number().optional(),
      pslfEligible: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => addLoan({ userId: ctx.user.id, ...input })),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      servicer: z.string().optional(),
      balance: z.number().optional(),
      rate: z.number().optional(),
      repaymentPlan: z.string().optional(),
      paymentsMade: z.number().optional(),
      remainingTerm: z.number().optional(),
      pslfQualifyingPayments: z.number().optional(),
      pslfEligible: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateLoan(id, ctx.user.id, data as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteLoan(input.id, ctx.user.id)),
  compare: protectedProcedure
    .input(z.object({
      balance: z.number().positive(),
      rate: z.number().min(0),
      agi: z.number().positive(),
      familySize: z.number().min(1).default(1),
      pslfEligible: z.boolean().default(false),
    }))
    .query(({ input }) => compareAllScenarios(input.balance, input.rate, input.agi, input.familySize, input.pslfEligible)),
});

// ─── EQUITY COMPENSATION ROUTER ────────────────────────────────
export const equityCompRouter = router({
  list: protectedProcedure.query(({ ctx }) => getGrants(ctx.user.id)),
  add: protectedProcedure
    .input(z.object({
      grantType: z.enum(["iso", "nso", "rsu", "espp"]),
      company: z.string().min(1),
      grantDate: z.string().optional(),
      vestingSchedule: z.any().optional(),
      exercisePrice: z.number().optional(),
      currentFMV: z.number().optional(),
      sharesGranted: z.number().optional(),
      sharesVested: z.number().optional(),
      sharesExercised: z.number().optional(),
      expirationDate: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { grantDate, expirationDate, ...rest } = input;
      return addGrant({
        userId: ctx.user.id,
        ...rest,
        grantDate: grantDate ? new Date(grantDate) : undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      currentFMV: z.number().optional(),
      sharesVested: z.number().optional(),
      sharesExercised: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateGrant(id, ctx.user.id, data as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteGrant(input.id, ctx.user.id)),
  modelExercise: protectedProcedure
    .input(z.object({
      grantType: z.string(),
      exercisePrice: z.number().nullable(),
      currentFMV: z.number().nullable(),
      sharesVested: z.number().nullable(),
      sharesExercised: z.number().nullable(),
      sharesToExercise: z.number().positive(),
      agi: z.number().positive(),
    }))
    .query(({ input }) => {
      const { sharesToExercise, agi, ...grant } = input;
      return compareExerciseStrategies(grant, sharesToExercise, agi);
    }),
});

// ─── DIGITAL ASSETS ROUTER ─────────────────────────────────────
export const digitalAssetsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getDigitalAssets(ctx.user.id)),
  add: protectedProcedure
    .input(z.object({
      assetType: z.enum(["crypto_wallet", "exchange_account", "brokerage", "bank", "social_media", "email", "cloud_storage", "loyalty_program", "domain", "digital_content", "other"]),
      platform: z.string().min(1),
      approximateValue: z.number().optional(),
      accessMethod: z.string().optional(),
      hasAccessPlan: z.boolean().optional(),
      legacyContactSet: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addDigitalAsset({ userId: ctx.user.id, ...input })),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      platform: z.string().optional(),
      approximateValue: z.number().optional(),
      accessMethod: z.string().optional(),
      hasAccessPlan: z.boolean().optional(),
      legacyContactSet: z.boolean().optional(),
      notes: z.string().optional(),
      lastVerified: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, lastVerified, ...data } = input;
      return updateDigitalAsset(id, ctx.user.id, {
        ...data,
        lastVerified: lastVerified ? new Date(lastVerified) : undefined,
      } as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDigitalAsset(input.id, ctx.user.id)),
  readiness: protectedProcedure.query(({ ctx }) => calculateEstateReadiness(ctx.user.id)),
});

// ─── COI NETWORK ROUTER ────────────────────────────────────────
export const coiRouter = router({
  contacts: protectedProcedure.query(({ ctx }) => getCoiContacts(ctx.user.id)),
  addContact: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      coiFirm: z.string().optional(),
      specialty: z.enum(["cpa", "attorney", "insurance_agent", "mortgage_broker", "real_estate", "other"]),
      contactJson: z.any().optional(),
      relationshipStrength: z.enum(["strong", "moderate", "new"]).optional(),
    }))
    .mutation(({ ctx, input }) => addCoiContact({ professionalId: ctx.user.id, ...input })),
  updateContact: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      coiFirm: z.string().optional(),
      contactJson: z.any().optional(),
      relationshipStrength: z.enum(["strong", "moderate", "new"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateCoiContact(id, ctx.user.id, data as any);
    }),
  deleteContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteCoiContact(input.id, ctx.user.id)),
  addReferral: protectedProcedure
    .input(z.object({
      toCoiId: z.number(),
      clientId: z.number().optional(),
      reason: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addReferral({ fromProfessionalId: ctx.user.id, ...input })),
  referrals: protectedProcedure.query(({ ctx }) => getReferrals(ctx.user.id)),
  updateReferral: protectedProcedure
    .input(z.object({
      id: z.number(),
      outcome: z.enum(["pending", "accepted", "completed", "declined"]),
    }))
    .mutation(({ input }) => updateReferralOutcome(input.id, input.outcome)),
  analytics: protectedProcedure.query(({ ctx }) => getNetworkAnalytics(ctx.user.id)),
});

// ─── COMPLIANCE COPILOT ROUTER ──────────────────────────────────
export const complianceCopilotRouter = router({
  auditLog: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => getComplianceAuditLog(ctx.user.id, input?.limit)),
  privacyLog: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => getPrivacyAuditLog(ctx.user.id, input?.limit)),
});

// ─── MEMORY EPISODES ROUTER ────────────────────────────────────
export const memoryEpisodesRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => getEpisodes(ctx.user.id, input?.limit)),
});
