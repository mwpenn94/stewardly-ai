/**
 * Task #30 — Predictive Insights + Peer Benchmarks Service
 * Proactive alerts, peer comparison benchmarks, and predictive triggers.
 */
import { getDb } from "../db";
import { predictiveTriggers, benchmarkAggregates } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Peer Benchmark Comparison ───────────────────────────────────────────
export async function getPeerBenchmark(dimension: string, ageBracket?: string, incomeBracket?: string) {
  const db = (await getDb())!;
  const conditions = [eq(benchmarkAggregates.dimension, dimension)];
  if (ageBracket) conditions.push(eq(benchmarkAggregates.ageBracket, ageBracket));
  if (incomeBracket) conditions.push(eq(benchmarkAggregates.incomeBracket, incomeBracket));

  const [benchmark] = await db.select().from(benchmarkAggregates).where(and(...conditions)).limit(1);
  return benchmark;
}

export async function computePercentile(value: number, dimension: string, ageBracket?: string): Promise<number> {
  const benchmark = await getPeerBenchmark(dimension, ageBracket);
  if (!benchmark) return 50; // Default to median

  const p25 = benchmark.percentile25 ?? 0;
  const p50 = benchmark.percentile50 ?? 0;
  const p75 = benchmark.percentile75 ?? 0;

  if (value <= p25) return Math.round((value / p25) * 25);
  if (value <= p50) return 25 + Math.round(((value - p25) / (p50 - p25)) * 25);
  if (value <= p75) return 50 + Math.round(((value - p50) / (p75 - p50)) * 25);
  return Math.min(99, 75 + Math.round(((value - p75) / (p75 * 0.5)) * 24));
}

export async function upsertBenchmark(
  dimension: string,
  ageBracket: string | undefined,
  incomeBracket: string | undefined,
  values: { p25: number; p50: number; p75: number; sampleSize: number }
): Promise<void> {
  const db = (await getDb())!;
  const existing = await getPeerBenchmark(dimension, ageBracket, incomeBracket);

  if (existing) {
    await db.update(benchmarkAggregates).set({
      percentile25: values.p25,
      percentile50: values.p50,
      percentile75: values.p75,
      sampleSize: values.sampleSize,
    }).where(eq(benchmarkAggregates.id, existing.id));
  } else {
    await db.insert(benchmarkAggregates).values({
      dimension,
      ageBracket,
      incomeBracket,
      percentile25: values.p25,
      percentile50: values.p50,
      percentile75: values.p75,
      sampleSize: values.sampleSize,
    });
  }
}

// ─── Predictive Triggers ─────────────────────────────────────────────────
export async function evaluateTriggers(context: Record<string, any>): Promise<Array<{
  triggerId: number;
  triggerType: string;
  actionType: string;
  actionJson: any;
}>> {
  const db = (await getDb())!;
  const triggers = await db.select().from(predictiveTriggers).where(eq(predictiveTriggers.active, true));
  const fired: Array<{ triggerId: number; triggerType: string; actionType: string; actionJson: any }> = [];

  for (const trigger of triggers) {
    const condition = trigger.conditionJson as Record<string, any> | null;
    if (!condition) continue;

    let matches = true;
    for (const [key, expected] of Object.entries(condition)) {
      const actual = context[key];
      if (typeof expected === "object" && expected !== null) {
        if (expected.gt !== undefined && !(actual > expected.gt)) matches = false;
        if (expected.lt !== undefined && !(actual < expected.lt)) matches = false;
        if (expected.eq !== undefined && actual !== expected.eq) matches = false;
      } else if (actual !== expected) {
        matches = false;
      }
    }

    if (matches) {
      fired.push({
        triggerId: trigger.id,
        triggerType: trigger.triggerType,
        actionType: trigger.actionType,
        actionJson: trigger.actionJson,
      });
    }
  }

  return fired;
}

export async function createTrigger(
  triggerType: string,
  conditionJson: Record<string, any>,
  actionType: string,
  actionJson: Record<string, any>
): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.insert(predictiveTriggers).values({
    triggerType, conditionJson, actionType, actionJson,
  }).$returningId();
  return result.id;
}

export async function listTriggers() {
  const db = (await getDb())!;
  return db.select().from(predictiveTriggers).orderBy(desc(predictiveTriggers.createdAt));
}

export async function listBenchmarks() {
  const db = (await getDb())!;
  return db.select().from(benchmarkAggregates).orderBy(desc(benchmarkAggregates.updatedAt));
}
