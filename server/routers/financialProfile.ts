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
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  deleteProfile,
  getProfile,
  replaceProfile,
  setProfileWithEvents,
} from "../services/financialProfile/store";
import { suggestQuickQuotes } from "../services/quickQuoteSuggestions";
import type { FinancialProfile } from "../../shared/financialProfile";

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
      const { profile, events } = await setProfileWithEvents(
        ctx.user.id,
        input.patch as Record<string, unknown>,
        input.source,
      );
      // Return the detected life events so clients + webhooks can
      // surface proactive nudges (matches gap G14 — server parity).
      return { profile, events };
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

  // ── SUGGEST QUICK QUOTES ───────────────────────────────────────────
  // Returns the top-N quick-quote routes the user should be sent to
  // for a given chat message + saved profile. Used by the chat
  // pipeline to surface contextual CTAs above the message bar.
  // `publicProcedure` so anonymous chat sessions can also receive
  // suggestions — the profile param is optional and defaults to {}.
  suggest: publicProcedure
    .input(
      z.object({
        message: z.string().max(2000).optional(),
        profile: z.record(z.string(), z.unknown()).optional(),
        scope: z
          .enum(["user", "advisor", "manager", "steward"])
          .optional()
          .default("user"),
        topN: z.number().min(1).max(10).optional().default(3),
        minScore: z.number().min(0).max(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Prefer the saved profile when authenticated and the caller
      // didn't supply an explicit one.
      let profile = input.profile as FinancialProfile | undefined;
      if (!profile && ctx.user) {
        const fromDb = await getProfile(ctx.user.id);
        if (fromDb) profile = fromDb;
      }
      const suggestions = suggestQuickQuotes({
        message: input.message,
        profile: profile ?? {},
        scope: input.scope,
        topN: input.topN,
        minScore: input.minScore,
      });
      return { suggestions };
    }),
});
