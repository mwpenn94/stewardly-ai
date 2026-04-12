/**
 * Reports (fiduciary) — tRPC router for the cross-module composer.
 *
 * Shipped by Pass 14 of the hybrid build loop. Thin wrapper — all
 * composition happens in `server/services/reports/fiduciaryReport.ts`
 * which is pure.
 *
 * Named `reportsFiduciary.ts` (not `reports.ts`) because the latter
 * already existed pre-loop. Mounted as `appRouter.reportsFiduciary`.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  buildFiduciaryReport,
  type FiduciaryReportInput,
} from "../services/reports/fiduciaryReport";

export const reportsFiduciaryRouter = router({
  /**
   * Build a fiduciary compliance report from whatever inputs the
   * caller supplies. Inputs are passthrough — the composer handles
   * partial data defensively.
   */
  build: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1).max(200),
        advisorName: z.string().min(1).max(200),
        generatedAt: z.string().min(1),
        comparables: z.any().optional(),
        rebalancing: z.any().optional(),
        ledger: z.any().optional(),
        federalTax: z.any().optional(),
        stateTax: z.any().optional(),
        washSales: z.any().optional(),
        shorts: z.any().optional(),
      }),
    )
    .query(({ input }) => buildFiduciaryReport(input as FiduciaryReportInput)),
});
