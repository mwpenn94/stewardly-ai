/**
 * Scenarios Router — Save, list, compare, update calculator scenarios with version history.
 *
 * Uses the existing `calculator_scenarios` table.
 * Each scenario stores the full inputs + results JSON for comparison.
 * Version history is stored in resultsJson.versionHistory (up to 20 versions).
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
      const db = (await getDb())!;
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

      return rows.map(r => {
        const results = (r.resultsJson as any) || {};
        const versionCount = Array.isArray(results.versionHistory) ? results.versionHistory.length : 0;
        return {
          id: r.id,
          name: r.name,
          inputsJson: r.inputsJson as Record<string, any>,
          resultsJson: r.resultsJson as Record<string, any>,
          createdAt: r.createdAt.getTime(),
          updatedAt: r.updatedAt.getTime(),
          versionCount,
        };
      });
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
      const db = (await getDb())!;
      // Per-user scenario count limit
      const MAX_SCENARIOS_PER_USER = 50;
      const existing = await db
        .select({ id: calculatorScenarios.id })
        .from(calculatorScenarios)
        .where(eq(calculatorScenarios.userId, ctx.user.id));
      if (existing.length >= MAX_SCENARIOS_PER_USER) {
        throw new Error(`You have reached the maximum of ${MAX_SCENARIOS_PER_USER} saved scenarios. Please delete some before saving new ones.`);
      }
      const [result] = await db.insert(calculatorScenarios).values({
        userId: ctx.user.id,
        calculatorType: input.calculatorType,
        name: input.name,
        inputsJson: input.inputsJson,
        resultsJson: { ...input.resultsJson, versionHistory: [] },
      });
      return { id: result.insertId, success: true };
    }),

  /** Update a scenario — archives previous version in versionHistory */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      inputsJson: z.any(),
      resultsJson: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Fetch current version to archive
      const [existing] = await db
        .select()
        .from(calculatorScenarios)
        .where(
          and(
            eq(calculatorScenarios.id, input.id),
            eq(calculatorScenarios.userId, ctx.user.id),
          ),
        );
      if (!existing) throw new Error("Scenario not found");

      // Archive previous version
      const prevResults = (existing.resultsJson as any) || {};
      const history = Array.isArray(prevResults.versionHistory) ? [...prevResults.versionHistory] : [];
      history.push({
        timestamp: existing.updatedAt.getTime(),
        inputsJson: existing.inputsJson,
        resultsJson: { ...prevResults, versionHistory: undefined },
      });
      // Keep last 20 versions max
      const trimmedHistory = history.slice(-20);

      const newResults = {
        ...(input.resultsJson || {}),
        versionHistory: trimmedHistory,
      };

      await db
        .update(calculatorScenarios)
        .set({
          ...(input.name ? { name: input.name } : {}),
          inputsJson: input.inputsJson,
          resultsJson: newResults,
        })
        .where(
          and(
            eq(calculatorScenarios.id, input.id),
            eq(calculatorScenarios.userId, ctx.user.id),
          ),
        );
      return { success: true, versionsCount: trimmedHistory.length };
    }),

  /** Get version history for a scenario */
  history: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [row] = await db
        .select()
        .from(calculatorScenarios)
        .where(
          and(
            eq(calculatorScenarios.id, input.id),
            eq(calculatorScenarios.userId, ctx.user.id),
          ),
        );
      if (!row) return { versions: [], current: null };
      const results = (row.resultsJson as any) || {};
      const history = Array.isArray(results.versionHistory) ? results.versionHistory : [];
      return {
        current: {
          timestamp: row.updatedAt.getTime(),
          inputsJson: row.inputsJson,
          resultsJson: { ...results, versionHistory: undefined },
        },
        versions: history.map((v: any, i: number) => ({
          version: i + 1,
          timestamp: v.timestamp,
          inputsJson: v.inputsJson,
          resultsJson: v.resultsJson,
        })),
      };
    }),

  /** Delete a scenario */
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
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
