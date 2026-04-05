/**
 * Premium Finance Router — SOFR rates and history
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const premiumFinanceRouter = router({
  getRates: protectedProcedure.query(async () => {
    const { fetchLatestSofr } = await import("../services/premiumFinance/premiumFinanceRates");
    return fetchLatestSofr();
  }),

  getRateHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const { getRateHistory } = await import("../services/premiumFinance/premiumFinanceRates");
      return getRateHistory(input?.limit || 30);
    }),
});
