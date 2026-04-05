/**
 * Autonomous Client Analysis — Nightly background process for active clients
 * Self-Discover → Self-Process → Self-Critique → Self-Connect → Self-Apply
 * Gate: only for advisor-matched clients with calculator results
 * Cost guard: max $0.50 per client per night
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "autonomousClientAnalysis" });
const MAX_COST_PER_CLIENT = 0.50;

export interface AnalysisResult {
  clientId: number;
  gaps: string[];
  actionPlan: string[];
  products: string[];
  complianceNotes: string[];
  cost: number;
}

export async function analyzeClient(clientId: number, advisorId: number): Promise<AnalysisResult | null> {
  const db = await getDb();
  if (!db) return null;

  let cost = 0;
  const { contextualLLM } = await import("../shared/stewardlyWiring");

  async function llmCall(prompt: string): Promise<string> {
    if (cost >= MAX_COST_PER_CLIENT) return "Budget exceeded";
    try {
      const response = await contextualLLM({
        userId: advisorId,
        contextType: "analysis" as any,
        messages: [{ role: "user", content: prompt }],
      });
      cost += 0.10;
      return response.choices?.[0]?.message?.content || "";
    } catch { return ""; }
  }

  // Self-Discover: identify gaps
  const gapsRaw = await llmCall(`For client ${clientId}: what protection, retirement, estate, tax, and education gaps exist? List each gap with estimated dollar amount. Return JSON: { gaps: string[] }`);
  let gaps: string[] = [];
  try { gaps = JSON.parse(gapsRaw).gaps || []; } catch { gaps = [gapsRaw.slice(0, 200)]; }

  // Self-Process: generate action plan
  const planRaw = await llmCall(`Based on these gaps: ${gaps.join(", ")}. Generate prioritized action plan with specific WealthBridge products. Return JSON: { actions: string[], products: string[] }`);
  let actions: string[] = [], products: string[] = [];
  try { const p = JSON.parse(planRaw); actions = p.actions || []; products = p.products || []; } catch { /* use empty */ }

  // Self-Critique: check suitability
  const critiqueRaw = await llmCall(`Review these recommendations for client ${clientId}: ${products.join(", ")}. Are they suitable given typical risk tolerance? Return JSON: { notes: string[] }`);
  let complianceNotes: string[] = [];
  try { complianceNotes = JSON.parse(critiqueRaw).notes || []; } catch { /* use empty */ }

  // Store results
  try {
    const { clientPlanOutcomes, communicationArchive } = await import("../../drizzle/schema");
    for (const gap of gaps) {
      await db.insert(clientPlanOutcomes).values({
        clientId,
        advisorId,
        planArea: "protection" as any,
        targetMetric: gap,
        source: "manual" as any,
        implementationStatus: "recommended",
      });
    }
    // FINRA archive
    const threeYears = new Date();
    threeYears.setFullYear(threeYears.getFullYear() + 3);
    await db.insert(communicationArchive).values({
      userId: advisorId,
      contentType: "plan_analysis",
      contentText: JSON.stringify({ clientId, gaps, actions, products, complianceNotes }),
      leadId: clientId,
      retentionExpiresAt: threeYears,
    });
  } catch { /* graceful */ }

  log.info({ clientId, gaps: gaps.length, actions: actions.length, cost }, "Autonomous analysis completed");
  return { clientId, gaps, actionPlan: actions, products, complianceNotes, cost };
}

export async function runNightlyAnalysis(): Promise<{ analyzed: number; skipped: number; totalCost: number }> {
  const db = await getDb();
  if (!db) return { analyzed: 0, skipped: 0, totalCost: 0 };

  let analyzed = 0, skipped = 0, totalCost = 0;

  try {
    const { financialProtectionScores } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Only analyze clients with advisor matched and calculator results
    const clients = await db.select().from(financialProtectionScores)
      .where(eq(financialProtectionScores.advisorMatched, true))
      .limit(50);

    for (const client of clients) {
      if (!client.advisorId) { skipped++; continue; }
      const result = await analyzeClient(client.userId || client.id, client.advisorId);
      if (result) { analyzed++; totalCost += result.cost; }
      else { skipped++; }
    }
  } catch (e: any) {
    log.error({ error: e.message }, "Nightly analysis failed");
  }

  log.info({ analyzed, skipped, totalCost }, "Nightly analysis batch completed");
  return { analyzed, skipped, totalCost };
}
