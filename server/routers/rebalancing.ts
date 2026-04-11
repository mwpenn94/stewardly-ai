/**
 * Portfolio rebalancing — tRPC router.
 *
 * Thin wrapper over the pure drift engine in
 * `server/services/portfolio/rebalancing.ts`. All math happens in the
 * pure module so tests stay offline; this router only validates
 * payloads, gates access, and converts the result to JSON.
 *
 * Shipped by Pass 2 of the hybrid build loop — closes the simulate
 * side of PARITY-REBAL-0001. The "ingest live portfolios" side (Plaid
 * / custodian API integration) is a follow-up pass.
 *
 * Access: `protectedProcedure` because holding snapshots are
 * caller-supplied and may contain position information. No database
 * writes.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  computeDrift,
  simulateWithNewCash,
  validateTargetAllocation,
  type Holding,
} from "../services/portfolio/rebalancing";

const holdingSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  marketValue: z.number(),
  longTermGainLossUSD: z.number().optional(),
  isCash: z.boolean().optional(),
});

const targetSchema = z.object({
  id: z.string().min(1).max(64),
  targetPct: z.number(),
});

const optionsSchema = z
  .object({
    driftThreshold: z.number().min(0).max(50).optional(),
    cashBufferPct: z.number().min(0).max(100).optional(),
    taxAware: z.boolean().optional(),
  })
  .optional();

const MAX_HOLDINGS = 500;

export const rebalancingRouter = router({
  /**
   * Run the drift engine against a caller-supplied portfolio snapshot.
   * Returns the full RebalanceReport.
   */
  simulate: protectedProcedure
    .input(
      z.object({
        holdings: z.array(holdingSchema).max(MAX_HOLDINGS),
        targets: z.array(targetSchema).max(MAX_HOLDINGS),
        options: optionsSchema,
      }),
    )
    .query(({ input }) =>
      computeDrift(
        input.holdings as Holding[],
        input.targets,
        input.options,
      ),
    ),

  /**
   * Simulate a new-cash deposit — the engine adds `newCashUSD` to the
   * cash sleeve (creating one if needed) and returns the resulting
   * drift report + proposals. Useful for "where should this $50k go?"
   * questions.
   */
  simulateNewCash: protectedProcedure
    .input(
      z.object({
        holdings: z.array(holdingSchema).max(MAX_HOLDINGS),
        targets: z.array(targetSchema).max(MAX_HOLDINGS),
        newCashUSD: z.number().min(0),
        options: optionsSchema,
      }),
    )
    .query(({ input }) =>
      simulateWithNewCash(
        input.holdings as Holding[],
        input.targets,
        input.newCashUSD,
        input.options,
      ),
    ),

  /**
   * Pre-flight check on a target allocation without computing drift.
   * Useful for form validators in the UI.
   */
  validateTargets: protectedProcedure
    .input(z.object({ targets: z.array(targetSchema).max(MAX_HOLDINGS) }))
    .query(({ input }) => validateTargetAllocation(input.targets)),
});
