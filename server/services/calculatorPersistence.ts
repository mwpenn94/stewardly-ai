/**
 * Task #29 — Calculator Persistence Service
 * Save/load/compare calculator scenarios across all financial calculators.
 */
import { getDb } from "../db";
import { calculatorScenarios } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export async function saveScenario(
  userId: number,
  calculatorType: string,
  name: string,
  inputs: Record<string, any>,
  results: Record<string, any>
): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const [result] = await db.insert(calculatorScenarios).values({
    userId,
    calculatorType,
    name,
    inputsJson: inputs,
    resultsJson: results,
  }).$returningId();
  return result.id;
}

export async function getUserScenarios(userId: number, calculatorType?: string) {
  const db = await getDb(); if (!db) return null as any;
  const conditions = [eq(calculatorScenarios.userId, userId)];
  if (calculatorType) conditions.push(eq(calculatorScenarios.calculatorType, calculatorType));
  return db.select().from(calculatorScenarios)
    .where(and(...conditions))
    .orderBy(desc(calculatorScenarios.updatedAt)).limit(50);
}

export async function getScenario(id: number, userId: number) {
  const db = await getDb(); if (!db) return null as any;
  const [scenario] = await db.select().from(calculatorScenarios)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId))).limit(1);
  return scenario;
}

export async function updateScenario(
  id: number,
  userId: number,
  updates: { name?: string; inputs?: Record<string, any>; results?: Record<string, any> }
): Promise<boolean> {
  const db = await getDb(); if (!db) return null as any;
  const setObj: Record<string, any> = {};
  if (updates.name) setObj.name = updates.name;
  if (updates.inputs) setObj.inputsJson = updates.inputs;
  if (updates.results) setObj.resultsJson = updates.results;
  await db.update(calculatorScenarios).set(setObj)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId)));
  return true;
}

export async function deleteScenario(id: number, userId: number): Promise<boolean> {
  const db = await getDb(); if (!db) return null as any;
  await db.delete(calculatorScenarios)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId)));
  return true;
}

export async function compareScenarios(ids: number[], userId: number) {
  const db = await getDb(); if (!db) return null as any;
  const scenarios = [];
  for (const id of ids) {
    const [s] = await db.select().from(calculatorScenarios)
      .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId))).limit(1);
    if (s) scenarios.push(s);
  }
  return scenarios;
}
