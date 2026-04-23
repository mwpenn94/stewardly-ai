/**
 * Plaid Router — Bank Account Linking (Production-Hardened)
 *
 * Security: Access tokens are NEVER returned to or accepted from the frontend.
 * Tokens are stored encrypted in plaid_items table and referenced by itemId.
 * All operations use server-side token resolution.
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
import {
  storeEncryptedToken,
  resolveAccessToken,
  getUserPlaidItems,
  deactivatePlaidItem,
} from "../services/plaidTokenStore";

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

  /**
   * Exchange a public token from Plaid Link.
   * Stores the access token encrypted server-side — NEVER returns it to the client.
   * Returns only the itemId for future reference.
   */
  exchangeToken: protectedProcedure
    .input(z.object({
      publicToken: z.string(),
      institutionId: z.string().optional(),
      institutionName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await exchangePublicToken(input.publicToken);

      // Store the access token encrypted — never expose to frontend
      await storeEncryptedToken({
        userId: ctx.user!.id,
        itemId: result.itemId,
        accessToken: result.accessToken,
        institutionId: input.institutionId ?? null,
        institutionName: input.institutionName ?? null,
      });

      // Return only the item ID — access token stays server-side
      return {
        itemId: result.itemId,
        mock: result.mock,
      };
    }),

  /** List all linked Plaid items for the current user */
  listItems: protectedProcedure.query(async ({ ctx }) => {
    return getUserPlaidItems(ctx.user!.id);
  }),

  /** Get accounts for a linked item (by itemId, not access token) */
  getAccounts: protectedProcedure
    .input(z.object({
      itemId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const accessToken = await resolveAccessToken(ctx.user!.id, input.itemId);
      return getAccounts(accessToken);
    }),

  /** Get account balances (by itemId) */
  getBalances: protectedProcedure
    .input(z.object({
      itemId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const accessToken = await resolveAccessToken(ctx.user!.id, input.itemId);
      return getBalances(accessToken);
    }),

  /** Get transactions for a date range (by itemId) */
  getTransactions: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const accessToken = await resolveAccessToken(ctx.user!.id, input.itemId);
      return getTransactions(accessToken, input.startDate, input.endDate);
    }),

  /** Deactivate a linked Plaid item */
  deactivate: protectedProcedure
    .input(z.object({
      itemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await deactivatePlaidItem(ctx.user!.id, input.itemId);
      return { success: true };
    }),
});
