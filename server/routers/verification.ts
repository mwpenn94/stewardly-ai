import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  runVerification,
  saveVerificationResult,
  saveBadges,
  getVerificationsForProfessional,
  getBadgesForProfessional,
  getLatestRates,
  fetchPremiumFinanceRates,
  savePremiumFinanceRates,
  scheduleVerification,
  getDueVerifications,
  verifySECIAPD,
  verifyCFPBoard,
  verifyNASBA,
  verifyNMLS,
  verifyStateBar,
  verifyNIPR,
  verifyMartindale,
  verifyIBBA,
  type VerificationSource,
} from "../services/verification";
import { getDb } from "../db";
import { professionals, premiumFinanceRates } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const verificationRouter = router({
  // ─── Verify a professional (run all applicable checks) ────────────
  verifyProfessional: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      crdNumber: z.string().optional(),
      nmlsId: z.string().optional(),
      barNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager" && ctx.user.role !== "advisor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only advisors, managers, or admins can trigger verification" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [prof] = await db.select().from(professionals).where(eq(professionals.id, input.professionalId)).limit(1);
      if (!prof) throw new TRPCError({ code: "NOT_FOUND", message: "Professional not found" });

      const credentials = [
        ...(Array.isArray(prof.credentials) ? prof.credentials as string[] : []),
        ...(Array.isArray(prof.licenses) ? prof.licenses as string[] : []),
      ];

      const results = await runVerification(
        input.professionalId,
        prof.name,
        credentials,
        prof.state || undefined,
        input.crdNumber,
        input.nmlsId,
        input.barNumber,
      );

      // Save results and badges
      const savedResults = [];
      for (const result of results) {
        const vId = await saveVerificationResult(input.professionalId, result);
        if (result.badges && result.badges.length > 0) {
          await saveBadges(input.professionalId, result.badges, vId);
        }
        // Schedule re-verification
        await scheduleVerification(input.professionalId, result.source, 30);
        savedResults.push({ ...result, verificationId: vId });
      }

      return { professionalId: input.professionalId, results: savedResults };
    }),

  // ─── Single source verification ───────────────────────────────────
  verifySingle: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      source: z.enum([
        "finra_brokercheck", "sec_iapd", "cfp_board", "nasba_cpaverify",
        "nipr_pdb", "nmls", "state_bar", "ibba", "martindale", "avvo",
      ]),
      name: z.string(),
      state: z.string().optional(),
      crdNumber: z.string().optional(),
      nmlsId: z.string().optional(),
      barNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager" && ctx.user.role !== "advisor") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      let result;
      switch (input.source) {
        case "sec_iapd": result = await verifySECIAPD(input.name, input.crdNumber); break;
        case "cfp_board": result = await verifyCFPBoard(input.name, input.state); break;
        case "nasba_cpaverify": result = await verifyNASBA(input.name, input.state); break;
        case "nmls": result = await verifyNMLS(input.nmlsId || ""); break;
        case "state_bar": result = await verifyStateBar(input.name, input.state || "CA", input.barNumber); break;
        case "nipr_pdb": result = await verifyNIPR(input.name, input.state || ""); break;
        case "martindale": result = await verifyMartindale(input.name, input.state); break;
        case "ibba": result = await verifyIBBA(input.name); break;
        default: result = await verifySECIAPD(input.name, input.crdNumber);
      }
      const vId = await saveVerificationResult(input.professionalId, result);
      if (result.badges && result.badges.length > 0) {
        await saveBadges(input.professionalId, result.badges, vId);
      }
      return { ...result, verificationId: vId };
    }),

  // ─── Get verifications for a professional ─────────────────────────
  getVerifications: protectedProcedure
    .input(z.object({ professionalId: z.number() }))
    .query(async ({ input }) => {
      return getVerificationsForProfessional(input.professionalId);
    }),

  // ─── Get badges for a professional ────────────────────────────────
  getBadges: protectedProcedure
    .input(z.object({ professionalId: z.number() }))
    .query(async ({ input }) => {
      return getBadgesForProfessional(input.professionalId);
    }),

  // ─── Premium Finance Rates ────────────────────────────────────────
  getLatestRates: protectedProcedure
    .query(async () => {
      return getLatestRates();
    }),

  refreshRates: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const rates = await fetchPremiumFinanceRates();
      await savePremiumFinanceRates(rates);
      return rates;
    }),

  // ─── Scheduled verification management ────────────────────────────
  getDueSchedules: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getDueVerifications();
    }),

  // ─── n8n Webhook endpoint for external verification results ───────
  webhookVerification: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      source: z.enum([
        "finra_brokercheck", "sec_iapd", "cfp_board", "nasba_cpaverify",
        "nipr_pdb", "nmls", "state_bar", "ibba", "martindale", "avvo",
      ]),
      status: z.enum(["verified", "not_found", "flagged", "expired", "pending"]),
      externalId: z.string().optional(),
      externalUrl: z.string().optional(),
      rawData: z.record(z.string(), z.unknown()).optional(),
      disclosures: z.array(z.record(z.string(), z.unknown())).optional(),
      licenseStates: z.array(z.string()).optional(),
      badges: z.array(z.object({
        type: z.string(),
        label: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const vId = await saveVerificationResult(input.professionalId, {
        source: input.source,
        status: input.status,
        externalId: input.externalId,
        externalUrl: input.externalUrl,
        rawData: input.rawData,
        disclosures: input.disclosures as any,
        licenseStates: input.licenseStates,
        badges: input.badges,
      }, "n8n_workflow");
      if (input.badges && input.badges.length > 0) {
        await saveBadges(input.professionalId, input.badges, vId);
      }
      return { verificationId: vId, status: input.status };
    }),
  // ─── Rate History for SOFR Sparkline ─────────────────────────────
  getRateHistory: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(premiumFinanceRates)
        .orderBy(desc(premiumFinanceRates.rateDate))
        .limit(input.days);
      return rows.reverse();
    }),
});
