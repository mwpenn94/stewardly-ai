/**
 * v6 Feature Routers — Part F Calculators & Operational Tools
 *
 * Tax Projector, SS Optimizer, HSA Optimizer, Medicare Navigator,
 * Charitable Giving Optimizer, Divorce Financial Analyzer,
 * Education Planner, Task Engine, Communications Engine, Fee Billing
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

import { projectTax, projectMultiYear, compareRothConversion, type TaxInput } from "../taxProjector";
import { optimizeSS, type SSInput } from "../ssOptimizer";
import { optimizeHSA, type HSAInput } from "../hsaOptimizer";
import { navigateMedicare, type MedicareInput } from "../medicareNavigator";
import { optimizeCharitable, type CharitableInput } from "../charitableOptimizer";
import { analyzeDivorce, type DivorceInput, type DivorceAsset } from "../divorceFinancial";
import { planEducation, type EducationPlanInput } from "../educationPlanner";
import { generateTaskSummary, suggestTasks, type TaskInput } from "../taskEngine";
import { getTemplates, getTemplate, generateDraft, type CommInput } from "../commsEngine";
import { calculateFee, compareFeeModels, type FeeInput } from "../feeBilling";

// ─── TAX PROJECTOR ROUTER ──────────────────────────────────────
export const taxProjectorRouter = router({
  project: protectedProcedure
    .input(z.object({
      filingStatus: z.enum(["single", "mfj", "hoh"]),
      wages: z.number().default(0),
      selfEmploymentIncome: z.number().default(0),
      interestIncome: z.number().default(0),
      dividendIncome: z.number().default(0),
      ordinaryDividends: z.number().default(0),
      shortTermCapGains: z.number().default(0),
      longTermCapGains: z.number().default(0),
      rentalIncome: z.number().default(0),
      otherIncome: z.number().default(0),
      rothConversion: z.number().default(0),
      itemizedDeductions: z.number().default(0),
      retirementContributions: z.number().default(0),
      hsaContributions: z.number().default(0),
      stateCode: z.string().default("TX"),
      dependents: z.number().default(0),
      year: z.number().default(new Date().getFullYear()),
    }))
    .mutation(({ input }) => projectTax(input as TaxInput)),

  multiYear: protectedProcedure
    .input(z.object({
      filingStatus: z.enum(["single", "mfj", "hoh"]),
      wages: z.number().default(0),
      selfEmploymentIncome: z.number().default(0),
      interestIncome: z.number().default(0),
      dividendIncome: z.number().default(0),
      ordinaryDividends: z.number().default(0),
      shortTermCapGains: z.number().default(0),
      longTermCapGains: z.number().default(0),
      rentalIncome: z.number().default(0),
      otherIncome: z.number().default(0),
      rothConversion: z.number().default(0),
      itemizedDeductions: z.number().default(0),
      retirementContributions: z.number().default(0),
      hsaContributions: z.number().default(0),
      stateCode: z.string().default("TX"),
      dependents: z.number().default(0),
      year: z.number().default(new Date().getFullYear()),
      years: z.number().min(1).max(30).default(5),
      inflationRate: z.number().default(0.03),
    }))
    .mutation(({ input }) => {
      const { years, inflationRate, ...taxInput } = input;
      return projectMultiYear(taxInput as TaxInput, years, inflationRate);
    }),

  rothComparison: protectedProcedure
    .input(z.object({
      filingStatus: z.enum(["single", "mfj", "hoh"]),
      wages: z.number().default(0),
      selfEmploymentIncome: z.number().default(0),
      interestIncome: z.number().default(0),
      dividendIncome: z.number().default(0),
      ordinaryDividends: z.number().default(0),
      shortTermCapGains: z.number().default(0),
      longTermCapGains: z.number().default(0),
      rentalIncome: z.number().default(0),
      otherIncome: z.number().default(0),
      rothConversion: z.number().default(0),
      itemizedDeductions: z.number().default(0),
      retirementContributions: z.number().default(0),
      hsaContributions: z.number().default(0),
      stateCode: z.string().default("TX"),
      dependents: z.number().default(0),
      year: z.number().default(new Date().getFullYear()),
      conversionAmounts: z.array(z.number()),
    }))
    .mutation(({ input }) => {
      const { conversionAmounts, ...taxInput } = input;
      return compareRothConversion(taxInput as TaxInput, conversionAmounts);
    }),
});

// ─── SOCIAL SECURITY OPTIMIZER ROUTER ──────────────────────────
export const ssOptimizerRouter = router({
  optimize: protectedProcedure
    .input(z.object({
      birthYear: z.number(),
      birthMonth: z.number().min(1).max(12).default(1),
      earningsHistory: z.array(z.object({
        year: z.number(),
        earnings: z.number(),
      })).default([]),
      estimatedPIA: z.number().optional(),
      spouseBirthYear: z.number().optional(),
      spousePIA: z.number().optional(),
      filingStatus: z.enum(["single", "married"]).default("single"),
      lifeExpectancy: z.number().default(85),
      spouseLifeExpectancy: z.number().optional(),
      discountRate: z.number().default(0.03),
    }))
    .mutation(({ input }) => optimizeSS(input as SSInput)),
});

// ─── HSA OPTIMIZER ROUTER ──────────────────────────────────────
export const hsaOptimizerRouter = router({
  optimize: protectedProcedure
    .input(z.object({
      age: z.number().min(18).max(80),
      coverageType: z.enum(["self", "family"]),
      currentBalance: z.number().default(0),
      annualContribution: z.number(),
      employerContribution: z.number().optional(),
      annualMedicalExpenses: z.number(),
      investmentReturn: z.number().optional(),
      marginalTaxRate: z.number(),
      stateTaxRate: z.number(),
      yearsToRetirement: z.number(),
      yearsInRetirement: z.number().optional(),
      expectedRetirementMedicalExpenses: z.number().optional(),
    }))
    .mutation(({ input }) => optimizeHSA(input as HSAInput)),
});

// ─── MEDICARE NAVIGATOR ROUTER ─────────────────────────────────
export const medicareRouter = router({
  navigate: protectedProcedure
    .input(z.object({
      age: z.number().min(50).max(80),
      retirementAge: z.number(),
      magi: z.number(),
      filingStatus: z.enum(["single", "mfj"]),
      hasEmployerCoverage: z.boolean().default(false),
      monthlyPrescriptionCosts: z.number().default(0),
      expectedAnnualMedical: z.number().default(5000),
      preferredDoctors: z.number().optional(),
      travelFrequency: z.enum(["none", "moderate", "heavy"]).optional(),
      chronicConditions: z.number().optional(),
      yearsToModel: z.number().optional(),
    }))
    .mutation(({ input }) => navigateMedicare(input as MedicareInput)),
});

// ─── CHARITABLE GIVING OPTIMIZER ROUTER ────────────────────────
export const charitableRouter = router({
  optimize: protectedProcedure
    .input(z.object({
      annualDonationGoal: z.number(),
      marginalTaxRate: z.number(),
      stateTaxRate: z.number(),
      age: z.number(),
      filingStatus: z.enum(["single", "mfj"]),
      agi: z.number(),
      appreciatedStockValue: z.number().optional(),
      appreciatedStockBasis: z.number().optional(),
      iraBalance: z.number().optional(),
      rmdRequired: z.boolean().optional(),
      itemizesDeductions: z.boolean(),
      standardDeduction: z.number().optional(),
      currentItemizedDeductions: z.number().optional(),
      yearsToModel: z.number().optional(),
    }))
    .mutation(({ input }) => optimizeCharitable(input as CharitableInput)),
});

// ─── DIVORCE FINANCIAL ANALYZER ROUTER ─────────────────────────
export const divorceRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      assets: z.array(z.object({
        name: z.string(),
        type: z.enum(["cash", "retirement_pretax", "retirement_roth", "brokerage", "real_estate", "business", "stock_options", "other"]),
        fairMarketValue: z.number(),
        costBasis: z.number().optional(),
        classification: z.enum(["marital", "separate", "commingled"]),
        owner: z.enum(["spouse1", "spouse2", "joint"]),
        notes: z.string().optional(),
      })),
      spouse1Income: z.number(),
      spouse2Income: z.number(),
      spouse1Age: z.number(),
      spouse2Age: z.number(),
      yearsMarried: z.number(),
      childrenCount: z.number().default(0),
      childrenAges: z.array(z.number()).default([]),
      state: z.string(),
      filingStatus: z.enum(["mfj_current", "single_post"]).default("mfj_current"),
      marginalRate: z.number(),
      alimonyAnnual: z.number().optional(),
      alimonyYears: z.number().optional(),
      childSupportMonthly: z.number().optional(),
    }))
    .mutation(({ input }) => analyzeDivorce(input as DivorceInput)),
});

// ─── EDUCATION PLANNER ROUTER ──────────────────────────────────
export const educationPlannerRouter = router({
  plan: protectedProcedure
    .input(z.object({
      childAge: z.number().min(0).max(18),
      childName: z.string().optional(),
      targetAge: z.number().default(18),
      annualCostToday: z.number(),
      yearsOfSchool: z.number().default(4),
      currentSavings: z.number().default(0),
      monthlyContribution: z.number(),
      investmentReturn: z.number().optional(),
      inflationRate: z.number().optional(),
      marginalTaxRate: z.number(),
      stateTaxRate: z.number(),
      state529Deduction: z.boolean().optional(),
      state529DeductionMax: z.number().optional(),
    }))
    .mutation(({ input }) => planEducation(input as EducationPlanInput)),
});

// ─── TASK ENGINE ROUTER ────────────────────────────────────────
export const taskEngineRouter = router({
  summary: protectedProcedure
    .input(z.object({
      tasks: z.array(z.object({
        id: z.number(),
        title: z.string(),
        status: z.string(),
        priority: z.string().optional(),
        category: z.string().optional(),
        dueDate: z.string().optional(),
      })),
    }))
    .mutation(({ input }) => generateTaskSummary(input.tasks)),

  suggest: protectedProcedure
    .input(z.object({
      lastReviewDate: z.string().optional(),
      hasOpenItems: z.boolean().optional(),
      upcomingBirthday: z.boolean().optional(),
      recentLifeEvent: z.string().optional(),
      portfolioNeedsRebalance: z.boolean().optional(),
    }))
    .mutation(({ input }) => suggestTasks(input)),
});

// ─── COMMUNICATIONS ENGINE ROUTER ──────────────────────────────
export const commsRouter = router({
  templates: protectedProcedure
    .input(z.object({
      category: z.enum([
        "review_reminder", "market_update", "birthday", "life_event",
        "onboarding", "compliance", "general", "referral_thank_you", "annual_summary",
      ]).optional(),
    }).optional())
    .query(({ input }) => getTemplates(input?.category)),

  template: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => getTemplate(input.id)),

  generate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      variables: z.record(z.string(), z.string()),
      channel: z.enum(["email", "sms", "letter", "portal_message"]).optional(),
      scheduledAt: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const draft = generateDraft(input as CommInput);
      if (!draft) throw new Error("Template not found");
      return draft;
    }),
});

// ─── FEE BILLING ROUTER ───────────────────────────────────────
export const feeBillingRouter = router({
  calculate: protectedProcedure
    .input(z.object({
      model: z.enum(["aum_flat", "aum_tiered", "flat_fee", "hourly", "retainer", "performance"]),
      aum: z.number().optional(),
      aumTiers: z.array(z.object({ upTo: z.number(), rate: z.number() })).optional(),
      flatRate: z.number().optional(),
      flatFeeAnnual: z.number().optional(),
      hourlyRate: z.number().optional(),
      hoursPerQuarter: z.number().optional(),
      retainerMonthly: z.number().optional(),
      performanceFeeRate: z.number().optional(),
      benchmarkReturn: z.number().optional(),
      actualReturn: z.number().optional(),
      billingFrequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]),
      householdDiscount: z.number().optional(),
      minimumFee: z.number().optional(),
    }))
    .mutation(({ input }) => calculateFee(input as FeeInput)),

  compare: protectedProcedure
    .input(z.object({
      aum: z.number(),
      years: z.number().default(20),
      returnRate: z.number().default(0.07),
    }))
    .mutation(({ input }) => compareFeeModels(input.aum, input.years, input.returnRate)),
});
