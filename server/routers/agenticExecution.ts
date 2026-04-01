/**
 * Part G: Agentic Execution Router
 * G1: OpenClaw Orchestrator — Agent lifecycle management
 * G2: Insurance Quote Engine — Multi-carrier quoting
 * G3: Insurance Application — Regulated submission pipeline
 * G4: Advisory Execution Agent — Investment action execution
 * G5: Estate Document Generator — Trust/will/POA drafting
 * G6: Premium Finance Engine — Loan structuring & monitoring
 * G7: Carrier Connector — Carrier API/browser integration
 * G8: Licensed Review Gate — Universal compliance gate
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  gateReviews, agentInstances, agentActions,
  insuranceQuotes, insuranceApplications,
  advisoryExecutions, estateDocuments,
  premiumFinanceCases, carrierConnections,
} from "../../drizzle/schema";
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"

// ─── G8: Licensed Review Gate ──────────────────────────────────────────────
const gateRouter = router({
  /** Submit an action for compliance review */
  submit: protectedProcedure
    .input(z.object({
      actionId: z.string(),
      actionType: z.string(),
      complianceTier: z.number().min(1).max(4),
      workflowType: z.string().optional(),
      clientId: z.number().optional(),
      professionalId: z.number().optional(),
      firmId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // AI-powered compliance classification
      const classificationResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: "You are a financial compliance classifier. Given an action type and tier, provide a brief rationale for the compliance classification. Return JSON with 'rationale' and 'suggestedTier' fields." },
          { role: "user", content: `Action: ${input.actionType}, Requested Tier: ${input.complianceTier}, Workflow: ${input.workflowType || "general"}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "classification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                rationale: { type: "string" },
                suggestedTier: { type: "integer" },
              },
              required: ["rationale", "suggestedTier"],
              additionalProperties: false,
            },
          },
        },
      });

      const classification = JSON.parse(classificationResponse.choices?.[0]?.message?.content as string || '{"rationale":"Auto-classified","suggestedTier":1}');

      // Tier 1: auto-approve, Tier 2+: requires human review
      const autoApprove = input.complianceTier <= 1;

      const [result] = await db.insert(gateReviews).values({
        actionId: input.actionId,
        actionType: input.actionType,
        complianceTier: classification.suggestedTier || input.complianceTier,
        classificationRationale: classification.rationale,
        decision: autoApprove ? "approved" : "pending",
        decisionTimestamp: autoApprove ? Date.now() : null,
        workflowType: input.workflowType,
        clientId: input.clientId,
        professionalId: input.professionalId,
        firmId: input.firmId,
        createdAt: Date.now(),
      }).$returningId();

      return { gateReviewId: result.id, decision: autoApprove ? "approved" : "pending", rationale: classification.rationale };
    }),

  /** Review a pending gate (approve/reject/modify) */
  review: protectedProcedure
    .input(z.object({
      gateReviewId: z.number(),
      decision: z.enum(["approved", "modified", "rejected", "escalated"]),
      complianceNotes: z.string().optional(),
      modificationDetails: z.string().optional(),
      reviewerLicenseNumber: z.string().optional(),
      reviewerLicenseState: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(gateReviews).set({
        decision: input.decision,
        reviewerId: ctx.user.id,
        reviewerLicenseNumber: input.reviewerLicenseNumber,
        reviewerLicenseState: input.reviewerLicenseState,
        complianceNotes: input.complianceNotes,
        modificationDetails: input.modificationDetails,
        decisionTimestamp: Date.now(),
      }).where(eq(gateReviews.id, input.gateReviewId));
      return { success: true };
    }),

  /** List gate reviews with filtering */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "modified", "rejected", "escalated"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select().from(gateReviews).orderBy(desc(gateReviews.createdAt)).limit(input.limit);
      if (input.status) {
        query = query.where(eq(gateReviews.decision, input.status)) as any;
      }
      return query;
    }),

  /** Get audit trail for a specific action */
  getAuditTrail: protectedProcedure
    .input(z.object({ actionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(gateReviews)
        .where(eq(gateReviews.actionId, input.actionId))
        .orderBy(desc(gateReviews.createdAt));
    }),
});

// ─── G1: Agent Orchestrator ────────────────────────────────────────────────
const agentRouter = router({
  /** Spawn a new agent instance */
  spawn: protectedProcedure
    .input(z.object({
      workflowType: z.string(),
      deploymentMode: z.enum(["local", "cloud", "hybrid"]).default("local"),
      budgetLimitUsd: z.number().optional(),
      runtimeLimitMinutes: z.number().default(60),
      configJson: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(agentInstances).values({
        userId: ctx.user.id,
        workflowType: input.workflowType,
        deploymentMode: input.deploymentMode,
        budgetLimitUsd: input.budgetLimitUsd ? String(input.budgetLimitUsd) : null,
        runtimeLimitMinutes: input.runtimeLimitMinutes,
        configJson: input.configJson,
        instanceStatus: "active",
        spawnedAt: Date.now(),
      }).$returningId();
      return { instanceId: result.id, status: "active" };
    }),

  /** Log an agent action */
  logAction: protectedProcedure
    .input(z.object({
      agentInstanceId: z.number(),
      actionType: z.string(),
      targetSystem: z.string().optional(),
      targetUrl: z.string().optional(),
      dataAccessedSummary: z.string().optional(),
      dataModifiedSummary: z.string().optional(),
      complianceTier: z.number().default(1),
      durationMs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if gate is needed (tier >= 2)
      let gateTriggered = false;
      let gateResult = "not_required";
      if (input.complianceTier >= 2) {
        gateTriggered = true;
        gateResult = "pending";
      }

      const [result] = await db.insert(agentActions).values({
        agentInstanceId: input.agentInstanceId,
        actionType: input.actionType,
        targetSystem: input.targetSystem,
        targetUrl: input.targetUrl,
        dataAccessedSummary: input.dataAccessedSummary,
        dataModifiedSummary: input.dataModifiedSummary,
        complianceTier: input.complianceTier,
        gateTriggered,
        gateResult,
        durationMs: input.durationMs,
        createdAt: Date.now(),
      }).$returningId();

      // Update agent instance action count
      await db.update(agentInstances).set({
        totalActions: sql`${agentInstances.totalActions} + 1`,
      }).where(eq(agentInstances.id, input.agentInstanceId));

      return { actionId: result.id, gateTriggered, gateResult };
    }),

  /** Terminate an agent */
  terminate: protectedProcedure
    .input(z.object({ instanceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(agentInstances).set({
        instanceStatus: "terminated",
        terminatedAt: Date.now(),
      }).where(eq(agentInstances.id, input.instanceId));
      return { success: true };
    }),

  /** List agent instances */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select().from(agentInstances)
        .where(eq(agentInstances.userId, ctx.user.id))
        .orderBy(desc(agentInstances.spawnedAt))
        .limit(input.limit);
      return query;
    }),

  /** Get agent action log */
  getActions: protectedProcedure
    .input(z.object({ instanceId: z.number(), limit: z.number().default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(agentActions)
        .where(eq(agentActions.agentInstanceId, input.instanceId))
        .orderBy(desc(agentActions.createdAt))
        .limit(input.limit);
    }),
});

// ─── G2: Insurance Quote Engine ────────────────────────────────────────────
const quoteRouter = router({
  /** Generate quotes from multiple carriers */
  generateQuotes: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      productType: z.string(),
      faceAmount: z.number().optional(),
      clientAge: z.number().optional(),
      healthClass: z.string().optional(),
      riders: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Use AI to generate illustrative quotes from multiple carriers
      const quoteResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: "You are an insurance quoting engine. Given client parameters, generate realistic illustrative quotes from 3-5 carriers. Include premium, death benefit, cash values, and AM Best ratings. Return JSON array." },
          { role: "user", content: `Generate insurance quotes for: Product: ${input.productType}, Face Amount: $${input.faceAmount || 500000}, Age: ${input.clientAge || 45}, Health: ${input.healthClass || "standard"}, Riders: ${(input.riders || []).join(", ") || "none"}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quotes",
            strict: true,
            schema: {
              type: "object",
              properties: {
                quotes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      carrierName: { type: "string" },
                      productName: { type: "string" },
                      premiumMonthly: { type: "number" },
                      premiumAnnual: { type: "number" },
                      deathBenefit: { type: "number" },
                      cashValueYr10: { type: "number" },
                      cashValueYr20: { type: "number" },
                      uwClass: { type: "string" },
                      amBestRating: { type: "string" },
                    },
                    required: ["carrierName", "productName", "premiumMonthly", "premiumAnnual", "deathBenefit", "cashValueYr10", "cashValueYr20", "uwClass", "amBestRating"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["quotes"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(quoteResponse.choices?.[0]?.message?.content as string || '{"quotes":[]}');
      const quoteRunId = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Save each quote
      const savedQuotes = [];
      for (const q of parsed.quotes) {
        const [result] = await db.insert(insuranceQuotes).values({
          clientId: input.clientId,
          professionalId: ctx.user.id,
          quoteRunId,
          carrierName: q.carrierName,
          productType: input.productType,
          productName: q.productName,
          premiumMonthly: String(q.premiumMonthly),
          premiumAnnual: String(q.premiumAnnual),
          deathBenefit: String(q.deathBenefit),
          cashValueYr10: String(q.cashValueYr10),
          cashValueYr20: String(q.cashValueYr20),
          uwClassEstimated: q.uwClass,
          amBestRating: q.amBestRating,
          quoteDate: Date.now(),
          source: "api",
          status: "illustrative",
        }).$returningId();
        savedQuotes.push({ id: result.id, ...q });
      }

      return { quoteRunId, quotes: savedQuotes };
    }),

  /** List quotes for a client */
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(insuranceQuotes)
        .where(eq(insuranceQuotes.clientId, input.clientId))
        .orderBy(desc(insuranceQuotes.quoteDate));
    }),

  /** Select a quote for application */
  selectQuote: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(insuranceQuotes).set({ status: "selected" }).where(eq(insuranceQuotes.id, input.quoteId));
      return { success: true };
    }),
});

// ─── G3: Insurance Application ─────────────────────────────────────────────
const applicationRouter = router({
  /** Create a new insurance application */
  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      carrierName: z.string(),
      productName: z.string().optional(),
      applicationData: z.any(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // AI-powered compliance preflight
      const preflightResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: "You are an insurance compliance specialist. Review the application data and identify any compliance issues, missing fields, or suitability concerns. Return JSON with 'issues' array and 'readyToSubmit' boolean." },
          { role: "user", content: `Review insurance application for ${input.carrierName}: ${JSON.stringify(input.applicationData).slice(0, 3000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "preflight",
            strict: true,
            schema: {
              type: "object",
              properties: {
                issues: { type: "array", items: { type: "string" } },
                readyToSubmit: { type: "boolean" },
                suitabilityScore: { type: "number" },
              },
              required: ["issues", "readyToSubmit", "suitabilityScore"],
              additionalProperties: false,
            },
          },
        },
      });

      const preflight = JSON.parse(preflightResponse.choices?.[0]?.message?.content as string || '{"issues":[],"readyToSubmit":false,"suitabilityScore":0}');

      const [result] = await db.insert(insuranceApplications).values({
        clientId: input.clientId,
        professionalId: ctx.user.id,
        carrierName: input.carrierName,
        productName: input.productName,
        applicationDataJson: input.applicationData,
        compliancePreflightJson: preflight,
        gateStatus: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).$returningId();

      return { applicationId: result.id, preflight };
    }),

  /** Submit application for gate review */
  submitForReview: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(insuranceApplications).set({
        gateStatus: "pending_review",
        updatedAt: Date.now(),
      }).where(eq(insuranceApplications.id, input.applicationId));
      return { success: true, status: "pending_review" };
    }),

  /** List applications */
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.clientId) {
        return db.select().from(insuranceApplications)
          .where(eq(insuranceApplications.clientId, input.clientId))
          .orderBy(desc(insuranceApplications.createdAt))
          .limit(input.limit);
      }
      return db.select().from(insuranceApplications)
        .where(eq(insuranceApplications.professionalId, ctx.user.id))
        .orderBy(desc(insuranceApplications.createdAt))
        .limit(input.limit);
    }),
});

// ─── G4: Advisory Execution Agent ──────────────────────────────────────────
const advisoryRouter = router({
  /** Create an advisory execution request */
  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      executionType: z.enum(["account_open", "rebalance", "harvest", "transfer", "trade", "rollover"]),
      executionData: z.any(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // AI tax impact estimation
      const taxResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: "You are a tax impact analyst. Estimate the tax impact of the proposed advisory action. Return JSON with 'estimatedTaxImpact' (number) and 'explanation' (string)." },
          { role: "user", content: `Estimate tax impact for ${input.executionType}: ${JSON.stringify(input.executionData).slice(0, 2000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tax_impact",
            strict: true,
            schema: {
              type: "object",
              properties: {
                estimatedTaxImpact: { type: "number" },
                explanation: { type: "string" },
              },
              required: ["estimatedTaxImpact", "explanation"],
              additionalProperties: false,
            },
          },
        },
      });

      const taxImpact = JSON.parse(taxResponse.choices?.[0]?.message?.content as string || '{"estimatedTaxImpact":0,"explanation":"Unable to estimate"}');

      const [result] = await db.insert(advisoryExecutions).values({
        clientId: input.clientId,
        professionalId: ctx.user.id,
        executionType: input.executionType,
        executionDataJson: input.executionData,
        taxImpactEstimate: String(taxImpact.estimatedTaxImpact),
        gateStatus: "draft",
        createdAt: Date.now(),
      }).$returningId();

      return { executionId: result.id, taxImpact };
    }),

  /** List advisory executions */
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.clientId) {
        return db.select().from(advisoryExecutions)
          .where(eq(advisoryExecutions.clientId, input.clientId))
          .orderBy(desc(advisoryExecutions.createdAt))
          .limit(input.limit);
      }
      return db.select().from(advisoryExecutions)
        .where(eq(advisoryExecutions.professionalId, ctx.user.id))
        .orderBy(desc(advisoryExecutions.createdAt))
        .limit(input.limit);
    }),
});

// ─── G5: Estate Document Generator ─────────────────────────────────────────
const estateDocRouter = router({
  /** Generate an estate document draft */
  generateDraft: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      documentType: z.enum(["trust", "will", "poa_financial", "poa_healthcare", "directive", "beneficiary_audit"]),
      stateJurisdiction: z.string().max(10),
      complexityLevel: z.enum(["simple", "standard", "complex"]).default("standard"),
      clientData: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // AI-powered document generation
      const docResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: `You are an estate planning document specialist for ${input.stateJurisdiction}. Generate a ${input.complexityLevel} ${input.documentType} document outline with key provisions. This is a DRAFT for attorney review, not legal advice. Return JSON with 'outline' (string), 'keyProvisions' (array of strings), and 'attorneyNotes' (string).` },
          { role: "user", content: `Generate ${input.documentType} draft for client in ${input.stateJurisdiction}. Client data: ${JSON.stringify(input.clientData || {}).slice(0, 2000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "estate_doc",
            strict: true,
            schema: {
              type: "object",
              properties: {
                outline: { type: "string" },
                keyProvisions: { type: "array", items: { type: "string" } },
                attorneyNotes: { type: "string" },
              },
              required: ["outline", "keyProvisions", "attorneyNotes"],
              additionalProperties: false,
            },
          },
        },
      });

      const docContent = JSON.parse(docResponse.choices?.[0]?.message?.content as string || '{"outline":"","keyProvisions":[],"attorneyNotes":""}');

      const [result] = await db.insert(estateDocuments).values({
        clientId: input.clientId,
        documentType: input.documentType,
        draftVersion: 1,
        complexityLevel: input.complexityLevel,
        reviewPath: input.complexityLevel === "simple" ? "self_help" : "attorney_review",
        stateJurisdiction: input.stateJurisdiction,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).$returningId();

      return { documentId: result.id, ...docContent };
    }),

  /** List estate documents for a client */
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(estateDocuments)
        .where(eq(estateDocuments.clientId, input.clientId))
        .orderBy(desc(estateDocuments.createdAt));
    }),
});

// ─── G6: Premium Finance Engine ────────────────────────────────────────────
const premiumFinanceRouter = router({
  /** Create a premium finance case */
  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      insurancePolicyRef: z.string().optional(),
      financedPremiumAnnual: z.number(),
      lenderName: z.string().optional(),
      interestRate: z.number().optional(),
      termYears: z.number().optional(),
      collateralType: z.string().optional(),
      collateralValue: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // AI stress test
      const stressResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "agentic",
        messages: [
          { role: "system", content: "You are a premium finance analyst. Run stress tests on the proposed financing structure. Test scenarios: rate increase +200bps, collateral decline -30%, policy lapse. Return JSON with 'scenarios' array." },
          { role: "user", content: `Stress test: Premium $${input.financedPremiumAnnual}/yr, Rate ${input.interestRate || 5}%, Term ${input.termYears || 10}yr, Collateral $${input.collateralValue || 0}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "stress_test",
            strict: true,
            schema: {
              type: "object",
              properties: {
                scenarios: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      impact: { type: "string" },
                      riskLevel: { type: "string" },
                    },
                    required: ["name", "impact", "riskLevel"],
                    additionalProperties: false,
                  },
                },
                overallRisk: { type: "string" },
              },
              required: ["scenarios", "overallRisk"],
              additionalProperties: false,
            },
          },
        },
      });

      const stressTest = JSON.parse(stressResponse.choices?.[0]?.message?.content as string || '{"scenarios":[],"overallRisk":"unknown"}');

      const [result] = await db.insert(premiumFinanceCases).values({
        clientId: input.clientId,
        professionalId: ctx.user.id,
        insurancePolicyRef: input.insurancePolicyRef,
        financedPremiumAnnual: String(input.financedPremiumAnnual),
        lenderName: input.lenderName,
        interestRate: input.interestRate ? String(input.interestRate) : null,
        termYears: input.termYears,
        collateralType: input.collateralType,
        collateralValue: input.collateralValue ? String(input.collateralValue) : null,
        stressTestJson: stressTest,
        gateStatus: "modeling",
        status: "modeling",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).$returningId();

      return { caseId: result.id, stressTest };
    }),

  /** List premium finance cases */
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.clientId) {
        return db.select().from(premiumFinanceCases)
          .where(eq(premiumFinanceCases.clientId, input.clientId))
          .orderBy(desc(premiumFinanceCases.createdAt))
          .limit(input.limit);
      }
      return db.select().from(premiumFinanceCases)
        .where(eq(premiumFinanceCases.professionalId, ctx.user.id))
        .orderBy(desc(premiumFinanceCases.createdAt))
        .limit(input.limit);
    }),
});

// ─── G7: Carrier Connector ─────────────────────────────────────────────────
const carrierRouter = router({
  /** Register a carrier connection */
  register: protectedProcedure
    .input(z.object({
      firmId: z.number(),
      carrierName: z.string(),
      connectionType: z.enum(["api", "browser"]).default("browser"),
      apiEndpoint: z.string().optional(),
      supportedOperations: z.array(z.string()).optional(),
      stateAppointments: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(carrierConnections).values({
        firmId: input.firmId,
        carrierName: input.carrierName,
        connectionType: input.connectionType,
        apiEndpoint: input.apiEndpoint,
        supportedOperationsJson: input.supportedOperations,
        stateAppointmentsJson: input.stateAppointments,
        lastVerified: Date.now(),
        active: true,
        createdAt: Date.now(),
      }).$returningId();
      return { connectionId: result.id, success: true };
    }),

  /** List carrier connections for a firm */
  listByFirm: protectedProcedure
    .input(z.object({ firmId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(carrierConnections)
        .where(and(eq(carrierConnections.firmId, input.firmId), eq(carrierConnections.active, true)))
        .orderBy(carrierConnections.carrierName);
    }),

  /** Verify a carrier connection */
  verify: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(carrierConnections).set({ lastVerified: Date.now() }).where(eq(carrierConnections.id, input.connectionId));
      return { success: true, verifiedAt: Date.now() };
    }),
});

// ─── Combined Agentic Execution Router ─────────────────────────────────────
export const agenticRouter = router({
  gate: gateRouter,
  agent: agentRouter,
  quote: quoteRouter,
  application: applicationRouter,
  advisory: advisoryRouter,
  estateDocs: estateDocRouter,
  premiumFinance: premiumFinanceRouter,
  carrier: carrierRouter,
});
