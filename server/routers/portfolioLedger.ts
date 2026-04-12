/**
 * Portfolio ledger — tRPC router.
 *
 * Thin wrapper over the pure ledger engine in
 * `server/services/portfolio/ledger.ts`. All math lives in the pure
 * module so tests run offline; this router only validates payloads
 * and converts the result to JSON.
 *
 * Shipped by Pass 5 of the hybrid build loop — closes PARITY-PORT-0001
 * (portfolio accounting) AND PARITY-TAX-0002 (per-lot basis) with a
 * single shared primitive.
 *
 * Access: `protectedProcedure` because transaction history contains
 * position-sensitive information. No database writes — the ledger
 * takes a snapshot from the caller and returns computed positions.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  runLedger,
  valuePositions,
  splitRealized,
  lossHarvestCandidates,
  type Transaction,
  type MarketPrice,
} from "../services/portfolio/ledger";
import {
  detectWashSales,
  canHarvestWithoutWashSale,
  earliestSafeRepurchase,
} from "../services/portfolio/washSale";
import {
  trackShortPositions,
  valueShortPositions,
} from "../services/portfolio/shortPositions";

const txnKindSchema = z.enum([
  "buy",
  "sell",
  "dividend",
  "split",
  "transfer_in",
  "transfer_out",
]);

const transactionSchema = z.object({
  id: z.string().min(1).max(64),
  symbol: z.string().min(1).max(64),
  timestamp: z.string().min(1),
  kind: txnKindSchema,
  shares: z.number(),
  pricePerShare: z.number(),
  feesUSD: z.number().optional(),
  againstLotId: z.string().optional(),
});

const methodSchema = z.enum([
  "FIFO",
  "LIFO",
  "HIFO",
  "LCFO",
  "avgCost",
  "specific",
]);

const priceSchema = z.object({
  symbol: z.string().min(1).max(64),
  pricePerShare: z.number(),
});

const MAX_TXNS = 10_000;

export const portfolioLedgerRouter = router({
  /**
   * Run a transaction list through the ledger using the specified
   * cost-basis method. Returns positions + realized gains.
   */
  run: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        method: methodSchema.optional(),
      }),
    )
    .query(({ input }) =>
      runLedger(input.transactions as Transaction[], input.method ?? "FIFO"),
    ),

  /**
   * Same as `run` but also attaches market values + unrealized P&L
   * when prices are provided.
   */
  valueWithPrices: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        prices: z.array(priceSchema).max(MAX_TXNS),
        method: methodSchema.optional(),
      }),
    )
    .query(({ input }) => {
      const ledger = runLedger(
        input.transactions as Transaction[],
        input.method ?? "FIFO",
      );
      const valued = valuePositions(
        ledger.positions,
        input.prices as MarketPrice[],
      );
      const realized = splitRealized(ledger.realizedGains);
      return {
        ...ledger,
        positions: valued,
        realizedSplit: realized,
      };
    }),

  /**
   * Loss-harvest candidate picker. Given the current ledger + market
   * prices, returns the lots with the largest unrealized losses
   * (sorted ascending).
   */
  lossHarvest: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        prices: z.array(priceSchema).max(MAX_TXNS),
        minLossUSD: z.number().min(0).optional(),
        method: methodSchema.optional(),
      }),
    )
    .query(({ input }) => {
      const ledger = runLedger(
        input.transactions as Transaction[],
        input.method ?? "FIFO",
      );
      const valued = valuePositions(
        ledger.positions,
        input.prices as MarketPrice[],
      );
      return lossHarvestCandidates(valued, input.minLossUSD ?? 100);
    }),

  /**
   * Wash sale detector — scan the ledger's realized losses for IRS
   * §1091 wash sale violations (any BUY of the same symbol within
   * ±30 days of a loss sale disallows the loss). Pass 9 extension.
   */
  detectWashSales: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        method: methodSchema.optional(),
      }),
    )
    .query(({ input }) => {
      const ledger = runLedger(
        input.transactions as Transaction[],
        input.method ?? "FIFO",
      );
      return detectWashSales(
        input.transactions as Transaction[],
        ledger.realizedGains,
      );
    }),

  /** Ask whether a given sell date is "safe" (no recent buy of same symbol). */
  canHarvest: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        symbol: z.string().min(1).max(64),
        saleDate: z.string().min(1),
      }),
    )
    .query(({ input }) => ({
      canHarvest: canHarvestWithoutWashSale(
        input.transactions as Transaction[],
        input.symbol,
        input.saleDate,
      ),
      earliestSafeRepurchase: earliestSafeRepurchase(input.saleDate),
    })),

  /**
   * Short-position tracker (Pass 13, PARITY-PORT-0003). Scans the
   * same transaction list used by `run` but looks for sells that
   * exceed long exposure (opening short lots) and buys that cover
   * outstanding shorts (recording cover gains).
   */
  trackShorts: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
      }),
    )
    .query(({ input }) => trackShortPositions(input.transactions as Transaction[])),

  /** Attach market prices to open short positions for unrealized P&L. */
  valueShorts: protectedProcedure
    .input(
      z.object({
        transactions: z.array(transactionSchema).max(MAX_TXNS),
        prices: z.array(priceSchema).max(MAX_TXNS),
      }),
    )
    .query(({ input }) => {
      const tracked = trackShortPositions(input.transactions as Transaction[]);
      return {
        ...tracked,
        positions: valueShortPositions(
          tracked.positions,
          input.prices as MarketPrice[],
        ),
      };
    }),
});
