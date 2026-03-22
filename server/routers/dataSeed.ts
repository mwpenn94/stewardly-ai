import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { runFullSeed, getSeedStatus } from "../services/dataSeedOrchestrator";
import { getTaxBrackets, getStandardDeduction, getCapitalGainsRates, getContributionLimits } from "../services/taxParameters";
import { calculatePIA, calculateAIME, getBenefitAtAge, calculateSpousalBenefit, calculateSurvivorBenefit, optimizeClaimingStrategy, getLifeExpectancy } from "../services/ssaParameters";
import { calculateIrmaa, getHsaCutoffDate, getRetirementHealthcareCostEstimate, getPartBPremium } from "../services/medicareParameters";
import { getCarrierByName, getCarriersByMinRating, getProductsByType, searchProducts, checkPremiumFinanceEligibility } from "../services/insuranceData";

export const dataSeedRouter = router({
  // ─── Admin: Run Full Seed ──────────────────────────────────────────────
  runSeed: protectedProcedure.mutation(async () => {
    return runFullSeed();
  }),

  seedStatus: protectedProcedure.query(async () => {
    return getSeedStatus();
  }),

  // ─── Tax Parameters ────────────────────────────────────────────────────
  taxBrackets: publicProcedure
    .input(z.object({ year: z.number().default(2025), filingStatus: z.string().default("single") }))
    .query(async ({ input }) => {
      return getTaxBrackets(input.year, input.filingStatus);
    }),

  standardDeduction: publicProcedure
    .input(z.object({ year: z.number().default(2025), filingStatus: z.string().default("single") }))
    .query(async ({ input }) => {
      return getStandardDeduction(input.year, input.filingStatus);
    }),

  capitalGainsRates: publicProcedure
    .input(z.object({ year: z.number().default(2025) }))
    .query(async ({ input }) => {
      return getCapitalGainsRates(input.year);
    }),

  retirementLimits: publicProcedure
    .input(z.object({ year: z.number().default(2025) }))
    .query(async ({ input }) => {
      return getContributionLimits(input.year);
    }),

  // ─── SSA / Social Security ─────────────────────────────────────────────
  calculatePIA: publicProcedure
    .input(z.object({ aime: z.number() }))
    .query(({ input }) => {
      return { pia: calculatePIA(input.aime) };
    }),

  calculateAIME: publicProcedure
    .input(z.object({ earningsHistory: z.array(z.number()) }))
    .query(({ input }) => {
      return { aime: calculateAIME(input.earningsHistory) };
    }),

  ssaBenefitAtAge: publicProcedure
    .input(z.object({ pia: z.number(), claimingAge: z.number(), fraAge: z.number().default(67) }))
    .query(({ input }) => {
      return { monthlyBenefit: getBenefitAtAge(input.pia, input.claimingAge, input.fraAge) };
    }),

  ssaClaimingStrategy: publicProcedure
    .input(z.object({ pia: z.number(), fraAge: z.number().default(67) }))
    .query(({ input }) => {
      return optimizeClaimingStrategy(input.pia, input.fraAge);
    }),

  ssaSpousalBenefit: publicProcedure
    .input(z.object({ workerPia: z.number(), ownPia: z.number() }))
    .query(({ input }) => {
      return { spousalBenefit: calculateSpousalBenefit(input.workerPia, input.ownPia) };
    }),

  ssaSurvivorBenefit: publicProcedure
    .input(z.object({ deceasedPia: z.number(), survivorOwnPia: z.number() }))
    .query(({ input }) => {
      return { survivorBenefit: calculateSurvivorBenefit(input.deceasedPia, input.survivorOwnPia) };
    }),

  lifeExpectancy: publicProcedure
    .input(z.object({ age: z.number(), sex: z.enum(["male", "female"]) }))
    .query(async ({ input }) => {
      return { lifeExpectancy: await getLifeExpectancy(input.age, input.sex) };
    }),

  // ─── Medicare / IRMAA ──────────────────────────────────────────────────
  irmaaCalculator: publicProcedure
    .input(z.object({
      magi: z.number(),
      filingStatus: z.enum(["single", "married_filing_jointly"]),
    }))
    .query(({ input }) => {
      return calculateIrmaa(input.magi, input.filingStatus);
    }),

  hsaCutoff: publicProcedure
    .input(z.object({ birthDate: z.string() }))
    .query(({ input }) => {
      return getHsaCutoffDate(new Date(input.birthDate));
    }),

  healthcareCostEstimate: publicProcedure
    .input(z.object({ currentAge: z.number(), sex: z.enum(["male", "female"]) }))
    .query(({ input }) => {
      return getRetirementHealthcareCostEstimate(input.currentAge, input.sex);
    }),

  partBPremium: publicProcedure
    .input(z.object({ year: z.number().default(2025) }))
    .query(async ({ input }) => {
      return { premium: await getPartBPremium(input.year) };
    }),

  // ─── Insurance Carriers & Products ─────────────────────────────────────
  searchCarriers: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return getCarrierByName(input.name);
    }),

  carriersByRating: publicProcedure
    .input(z.object({ minRating: z.number().default(11) }))
    .query(async ({ input }) => {
      return getCarriersByMinRating(input.minRating);
    }),

  productsByType: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ input }) => {
      return getProductsByType(input.type);
    }),

  searchProducts: publicProcedure
    .input(z.object({ query: z.string(), category: z.string().optional() }))
    .query(async ({ input }) => {
      return searchProducts(input.query, input.category);
    }),

  premiumFinanceEligibility: publicProcedure
    .input(z.object({ carrierId: z.number() }))
    .query(async ({ input }) => {
      return checkPremiumFinanceEligibility(input.carrierId);
    }),
});
