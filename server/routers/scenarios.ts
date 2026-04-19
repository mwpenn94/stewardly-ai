/**
 * Scenarios Router — Save, list, compare calculator scenarios.
 *
 * Uses the existing `calculator_scenarios` table.
 * Each scenario stores the full inputs + results JSON for comparison.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { calculatorScenarios } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const scenariosRouter = router({
  /** List all scenarios for the current user */
  list: protectedProcedure
    .input(z.object({
      calculatorType: z.string().default("wealth_engine"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(calculatorScenarios)
        .where(
          and(
            eq(calculatorScenarios.userId, ctx.user.id),
            eq(calculatorScenarios.calculatorType, input.calculatorType),
          ),
        )
        .orderBy(desc(calculatorScenarios.updatedAt));

      return rows.map(r => ({
        id: r.id,
        name: r.name,
        inputsJson: r.inputsJson as Record<string, any>,
        resultsJson: r.resultsJson as Record<string, any>,
        createdAt: r.createdAt.getTime(),
        updatedAt: r.updatedAt.getTime(),
      }));
    }),

  /** Save a new scenario */
  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      calculatorType: z.string().default("wealth_engine"),
      inputsJson: z.any(),
      resultsJson: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [result] = await db.insert(calculatorScenarios).values({
        userId: ctx.user.id,
        calculatorType: input.calculatorType,
        name: input.name,
        inputsJson: input.inputsJson,
        resultsJson: input.resultsJson,
      });
      return { id: result.insertId, success: true };
    }),

  /** Delete a scenario */
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db
        .delete(calculatorScenarios)
        .where(
          and(
            eq(calculatorScenarios.id, input.id),
            eq(calculatorScenarios.userId, ctx.user.id),
          ),
        );
      return { success: true };
    }),
});
