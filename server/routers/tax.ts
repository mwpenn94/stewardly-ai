/**
 * Tax projector — tRPC router.
 *
 * Thin wrapper over the pure multi-year projector in
 * `server/services/tax/projector.ts`. All math lives in the pure
 * module so tests run offline; this router only validates payloads
 * and converts the result to JSON.
 *
 * Shipped by Pass 4 of the hybrid build loop — PARITY-TAX-0001.
 *
 * Access: `protectedProcedure`. Tax scenarios may contain sensitive
 * income figures; gating keeps them off public endpoints.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  projectYear,
  projectYears,
  projectRothLadder,
  computeRMD,
  irmaaTier,
  summarizeYears,
  type YearContext,
} from "../services/tax/projector";

const filingStatusSchema = z.enum(["single", "mfj", "mfs", "hoh"]);

const yearCtxSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  filingStatus: filingStatusSchema,
  ordinaryIncomeUSD: z.number(),
  longTermCapGainsUSD: z.number(),
  qualifiedDividendsUSD: z.number(),
  traditionalDistributionsUSD: z.number(),
  itemizedDeductionUSD: z.number(),
  aboveTheLineUSD: z.number(),
  primaryAge: z.number().int().min(0).max(120),
  spouseAge: z.number().int().min(0).max(120).optional(),
});

const MAX_YEARS = 30;

export const taxRouter = router({
  /** Project a single tax year. */
  projectYear: protectedProcedure
    .input(yearCtxSchema)
    .query(({ input }) => projectYear(input as YearContext)),

  /** Project multiple tax years in a single call. */
  projectYears: protectedProcedure
    .input(z.object({ years: z.array(yearCtxSchema).max(MAX_YEARS) }))
    .query(({ input }) => {
      const results = projectYears(input.years as YearContext[]);
      return {
        years: results,
        summary: summarizeYears(results),
      };
    }),

  /** Generate a Roth conversion ladder across several years. */
  rothLadder: protectedProcedure
    .input(
      z.object({
        years: z.array(yearCtxSchema).max(MAX_YEARS),
        targetTopRate: z.number().min(0).max(1),
        traditionalBalanceUSD: z.number().min(0),
      }),
    )
    .query(({ input }) =>
      projectRothLadder({
        years: input.years as YearContext[],
        targetTopRate: input.targetTopRate,
        traditionalBalanceUSD: input.traditionalBalanceUSD,
      }),
    ),

  /** RMD calculator using the Uniform Lifetime Table. */
  rmd: protectedProcedure
    .input(
      z.object({
        age: z.number().min(0).max(120),
        priorYearBalance: z.number().min(0),
      }),
    )
    .query(({ input }) => ({
      amount: computeRMD(input.age, input.priorYearBalance),
    })),

  /** IRMAA tier lookup for a MAGI + filing status. */
  irmaa: protectedProcedure
    .input(z.object({ magi: z.number(), status: filingStatusSchema }))
    .query(({ input }) => irmaaTier(input.magi, input.status)),
});
