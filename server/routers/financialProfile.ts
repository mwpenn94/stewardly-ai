/**
 * financialProfileRouter — server-side persistence for the shared
 * financial profile (gap G9 in docs/PARITY.md).
 *
 * Backed by `server/services/financialProfile/store.ts` and the
 * `financial_profiles` table (drizzle migration 0013). Every
 * procedure degrades gracefully when the DB is missing — get
 * returns null, set returns the sanitized patch.
 *
 * Routes:
 *   financialProfile.get        — read the current user's profile
 *   financialProfile.set        — patch the current user's profile
 *   financialProfile.replace    — wholesale replace
 *   financialProfile.delete     — drop the row
 *
 * Every procedure is `protectedProcedure` — there is no public
 * read because financial data is PII.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  deleteProfile,
  getProfile,
  replaceProfile,
  setProfile,
} from "../services/financialProfile/store";

// Allow every field — the shared sanitizer will drop unknowns + clamp
// out-of-range values. Using `passthrough` so the schema is permissive
// at the wire level and the canonical sanitization happens server-side
// in the store.
const ProfilePatchSchema = z
  .object({
    age: z.number().optional(),
    income: z.number().optional(),
    netWorth: z.number().optional(),
    savings: z.number().optional(),
    monthlySavings: z.number().optional(),
    dependents: z.number().optional(),
    mortgage: z.number().optional(),
    debts: z.number().optional(),
    marginalRate: z.number().optional(),
    equitiesReturn: z.number().optional(),
    existingInsurance: z.number().optional(),
    isBizOwner: z.boolean().optional(),

    retirementAge: z.number().optional(),
    yearsInRetirement: z.number().optional(),
    desiredRetirementIncome: z.number().optional(),

    stateOfResidence: z.string().max(4).optional(),
    filingStatus: z.enum(["single", "mfj", "mfs", "hoh", "qw"]).optional(),
    estateGoal: z
      .enum(["minimize_tax", "maximize_gift", "charitable", "none"])
      .optional(),

    lifeInsuranceCoverage: z.number().optional(),
    hasLtc: z.boolean().optional(),
    hasDisability: z.boolean().optional(),
    hasHomeowner: z.boolean().optional(),

    businessRevenue: z.number().optional(),
    businessEmployees: z.number().optional(),
    businessRole: z
      .enum(["new", "exp", "sa", "dir", "md", "rvp", "partner"])
      .optional(),
  })
  .passthrough();

const SourceSchema = z
  .enum(["user", "quick_quote", "advisor_intake", "csv_import", "api"])
  .optional();

export const financialProfileRouter = router({
  // ── READ ───────────────────────────────────────────────────────────
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getProfile(ctx.user.id);
    return { profile };
  }),

  // ── PATCH (merge over existing) ────────────────────────────────────
  set: protectedProcedure
    .input(
      z.object({
        patch: ProfilePatchSchema,
        source: SourceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await setProfile(
        ctx.user.id,
        input.patch as Record<string, unknown>,
        input.source,
      );
      return { profile };
    }),

  // ── REPLACE (wholesale overwrite) ──────────────────────────────────
  replace: protectedProcedure
    .input(
      z.object({
        profile: ProfilePatchSchema,
        source: SourceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await replaceProfile(
        ctx.user.id,
        input.profile as Record<string, unknown>,
        input.source,
      );
      return { profile };
    }),

  // ── DELETE ─────────────────────────────────────────────────────────
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteProfile(ctx.user.id);
    return { ok: true };
  }),
});
