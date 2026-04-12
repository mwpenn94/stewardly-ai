/**
 * Comparables — competitive gap tracker.
 *
 * Read-only router that exposes the curated catalog in
 * `server/services/comparables/data.ts` plus the pure scoring helpers
 * in `scoring.ts`. Surfaces everything the `/comparables` admin UI
 * needs to render the gap matrix, leaderboards, and priority
 * recommendations.
 *
 * Gated on `protectedProcedure` so any signed-in user can view the
 * dashboard — the data is not user-specific and contains no PII, but
 * gating prevents accidental public exposure of strategy-sensitive
 * notes. If the org decides this should be admin-only, flip to
 * `adminProcedure` here and in the `/comparables` route guard.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  COMPARABLES,
  FEATURE_AXES,
  CATEGORY_LABELS,
  type ComparableApp,
  type FeatureAxisId,
} from "../services/comparables/data";
import {
  buildGapMatrix,
  overallSummary,
  overallRanking,
  priorityRecommendations,
  groupByCategory,
  appSummaries,
  leadersForAxis,
} from "../services/comparables/scoring";

// Derive FeatureAxisId union dynamically for zod so new axes flow
// through without a second source of truth.
const axisIds = FEATURE_AXES.map((a) => a.id) as [FeatureAxisId, ...FeatureAxisId[]];
const axisSchema = z.enum(axisIds);

export const comparablesRouter = router({
  /**
   * The full list of feature axes with Stewardly's current score.
   * Used for the rubric header of the gap matrix.
   */
  listAxes: protectedProcedure.query(() => FEATURE_AXES),

  /**
   * Category labels for filters + group headers.
   */
  listCategories: protectedProcedure.query(() => CATEGORY_LABELS),

  /**
   * The full comparable catalog, optionally filtered by category or
   * launch status. Returns lightweight apps (no derived scores).
   */
  listComparables: protectedProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          status: z.enum(["shipping", "beta", "planned", "rumored"]).optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      let pool: readonly ComparableApp[] = COMPARABLES;
      if (input?.category) {
        pool = pool.filter((a) => a.category === input.category);
      }
      if (input?.status) {
        pool = pool.filter((a) => a.status === input.status);
      }
      return pool.map((app) => ({ ...app }));
    }),

  /**
   * Single comparable by id, with its full feature declaration.
   */
  getComparable: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => {
      const app = COMPARABLES.find((a) => a.id === input.id);
      if (!app) return null;
      return { ...app };
    }),

  /**
   * Full gap matrix — one row per axis with Stewardly score, best
   * external, gap, and top-3 leaders.
   */
  gapMatrix: protectedProcedure.query(() => buildGapMatrix()),

  /**
   * Headline dashboard summary — total, percentage, band counts,
   * Stewardly's rank in the overall leaderboard.
   */
  summary: protectedProcedure.query(() => overallSummary()),

  /**
   * Ordered leaderboard across Stewardly + every comparable.
   */
  ranking: protectedProcedure.query(() => overallRanking()),

  /**
   * Top priority recommendations (trailing axes sorted by gap desc).
   */
  priorities: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(({ input }) => priorityRecommendations(input?.limit ?? 5)),

  /**
   * Comparables bucketed by category for the grouped view in the UI.
   */
  byCategory: protectedProcedure.query(() => groupByCategory()),

  /**
   * Per-app summary with total score + # of axes each app beats
   * Stewardly on.
   */
  appSummaries: protectedProcedure.query(() => appSummaries()),

  /**
   * Top-N comparables on a specific axis (for the axis deep-dive
   * drawer in the UI).
   */
  leadersForAxis: protectedProcedure
    .input(
      z.object({
        axis: axisSchema,
        limit: z.number().int().min(1).max(20).optional(),
      }),
    )
    .query(({ input }) => leadersForAxis(input.axis, input.limit ?? 3)),
});
