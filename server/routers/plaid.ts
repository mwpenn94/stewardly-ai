/**
 * Plaid Router — Bank Account Linking
 *
 * Pass 57: tRPC procedures for Plaid integration.
 * - createLinkToken: Generate a Plaid Link token for the UI
 * - exchangeToken: Exchange public token for access token
 * - getAccounts: Fetch linked accounts with balances
 * - getTransactions: Fetch recent transactions
 * - getStatus: Check if Plaid is configured
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  getTransactions,
  getBalances,
  isPlaidConfigured,
  getPlaidEnvironment,
} from "../services/plaidService";

export const plaidRouter = router({
  /** Check Plaid configuration status */
  status: publicProcedure.query(() => ({
    configured: isPlaidConfigured(),
    environment: getPlaidEnvironment(),
    mockMode: !isPlaidConfigured(),
  })),

  /** Create a Plaid Link token for the frontend */
  createLinkToken: protectedProcedure
    .input(z.object({
      redirectUri: z.string().url().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      return createLinkToken({
        userId: String(ctx.user!.id),
        redirectUri: input?.redirectUri,
      });
    }),

  /** Exchange a public token from Plaid Link for an access token */
  exchangeToken: protectedProcedure
    .input(z.object({
      publicToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      return exchangePublicToken(input.publicToken);
    }),

  /** Get accounts for a linked item */
  getAccounts: protectedProcedure
    .input(z.object({
      accessToken: z.string(),
    }))
    .query(async ({ input }) => {
      return getAccounts(input.accessToken);
    }),

  /** Get account balances */
  getBalances: protectedProcedure
    .input(z.object({
      accessToken: z.string(),
    }))
    .query(async ({ input }) => {
      return getBalances(input.accessToken);
    }),

  /** Get transactions for a date range */
  getTransactions: protectedProcedure
    .input(z.object({
      accessToken: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      return getTransactions(input.accessToken, input.startDate, input.endDate);
    }),
});
