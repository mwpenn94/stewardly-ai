/**
 * Agent Performance Tracking Service
 *
 * Provides CRUD and analytics for the agent_performance table.
 * Tracks runs, successes, average duration, cost, and satisfaction
 * per agent template to enable graduated autonomy and optimization.
 */
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { agentPerformance, agentTemplates } from "../../drizzle/schema";

export interface PerformanceSnapshot {
  id: number;
  agentTemplateId: number;
  templateName?: string;
  runs: number;
  successes: number;
  successRate: number;
  avgDurationMs: number | null;
  avgCostUsd: number | null;
  avgSatisfactionScore: number | null;
  updatedAt: Date;
}

/** Get or create a performance row for a given agent template */
export async function getOrCreate(agentTemplateId: number): Promise<PerformanceSnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agentPerformance)
    .where(eq(agentPerformance.agentTemplateId, agentTemplateId))
    .limit(1);
  if (rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      agentTemplateId: r.agentTemplateId,
      runs: r.runs ?? 0,
      successes: r.successes ?? 0,
      successRate: (r.runs ?? 0) > 0 ? ((r.successes ?? 0) / (r.runs ?? 1)) * 100 : 0,
      avgDurationMs: r.avgDurationMs,
      avgCostUsd: r.avgCostUsd,
      avgSatisfactionScore: r.avgSatisfactionScore,
      updatedAt: r.updatedAt,
    };
  }
  // Create initial row
  const [inserted] = await db.insert(agentPerformance).values({ agentTemplateId });
  const newId = inserted?.insertId ?? 0;
  return {
    id: Number(newId),
    agentTemplateId,
    runs: 0,
    successes: 0,
    successRate: 0,
    avgDurationMs: null,
    avgCostUsd: null,
    avgSatisfactionScore: null,
    updatedAt: new Date(),
  };
}

/** Record a completed agent run, updating running averages */
export async function recordRun(
  agentTemplateId: number,
  opts: { success: boolean; durationMs?: number; costUsd?: number; satisfactionScore?: number }
): Promise<PerformanceSnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const current = await getOrCreate(agentTemplateId);
  if (!current) return null;

  const newRuns = current.runs + 1;
  const newSuccesses = current.successes + (opts.success ? 1 : 0);

  // Running average for duration
  const newAvgDuration = opts.durationMs != null
    ? current.avgDurationMs != null
      ? Math.round((current.avgDurationMs * current.runs + opts.durationMs) / newRuns)
      : opts.durationMs
    : current.avgDurationMs;

  // Running average for cost
  const newAvgCost = opts.costUsd != null
    ? current.avgCostUsd != null
      ? parseFloat(((current.avgCostUsd * current.runs + opts.costUsd) / newRuns).toFixed(4))
      : opts.costUsd
    : current.avgCostUsd;

  // Running average for satisfaction
  const newAvgSatisfaction = opts.satisfactionScore != null
    ? current.avgSatisfactionScore != null
      ? parseFloat(((current.avgSatisfactionScore * current.runs + opts.satisfactionScore) / newRuns).toFixed(2))
      : opts.satisfactionScore
    : current.avgSatisfactionScore;

  await db.update(agentPerformance)
    .set({
      runs: newRuns,
      successes: newSuccesses,
      avgDurationMs: newAvgDuration,
      avgCostUsd: newAvgCost,
      avgSatisfactionScore: newAvgSatisfaction,
    })
    .where(eq(agentPerformance.id, current.id));

  return {
    ...current,
    runs: newRuns,
    successes: newSuccesses,
    successRate: (newSuccesses / newRuns) * 100,
    avgDurationMs: newAvgDuration,
    avgCostUsd: newAvgCost,
    avgSatisfactionScore: newAvgSatisfaction,
    updatedAt: new Date(),
  };
}

/** List all agent performance records with optional template name join */
export async function listAll(): Promise<PerformanceSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: agentPerformance.id,
    agentTemplateId: agentPerformance.agentTemplateId,
    runs: agentPerformance.runs,
    successes: agentPerformance.successes,
    avgDurationMs: agentPerformance.avgDurationMs,
    avgCostUsd: agentPerformance.avgCostUsd,
    avgSatisfactionScore: agentPerformance.avgSatisfactionScore,
    updatedAt: agentPerformance.updatedAt,
    templateName: agentTemplates.name,
  })
    .from(agentPerformance)
    .leftJoin(agentTemplates, eq(agentPerformance.agentTemplateId, agentTemplates.id))
    .orderBy(desc(agentPerformance.updatedAt));

  return rows.map(r => ({
    id: r.id,
    agentTemplateId: r.agentTemplateId,
    templateName: r.templateName ?? undefined,
    runs: r.runs ?? 0,
    successes: r.successes ?? 0,
    successRate: (r.runs ?? 0) > 0 ? ((r.successes ?? 0) / (r.runs ?? 1)) * 100 : 0,
    avgDurationMs: r.avgDurationMs,
    avgCostUsd: r.avgCostUsd,
    avgSatisfactionScore: r.avgSatisfactionScore,
    updatedAt: r.updatedAt,
  }));
}

/** Get top performing agents by success rate (minimum 5 runs) */
export async function topPerformers(limit = 10): Promise<PerformanceSnapshot[]> {
  const all = await listAll();
  return all
    .filter(a => a.runs >= 5)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, limit);
}

/** Reset performance stats for a template (useful for re-calibration) */
export async function resetStats(agentTemplateId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(agentPerformance)
    .set({ runs: 0, successes: 0, avgDurationMs: null, avgCostUsd: null, avgSatisfactionScore: null })
    .where(eq(agentPerformance.agentTemplateId, agentTemplateId));
  return true;
}
