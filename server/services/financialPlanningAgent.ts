/**
 * Financial Planning Agent — Multi-step orchestration for comprehensive plans
 * Budget: max 10 LLM calls per plan, max $2.00 per plan
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "financialPlanningAgent" });
const MAX_STEPS = 10;
const MAX_COST = 2.0;

export interface PlanResult {
  clientId: number;
  steps: Array<{ step: string; status: string; findings: string; durationMs: number }>;
  recommendations: Array<{ area: string; product: string; priority: string; reason: string }>;
  complianceFlags: string[];
  totalCost: number;
  totalSteps: number;
}

export async function generateComprehensivePlan(clientId: number, advisorId: number): Promise<PlanResult> {
  const start = Date.now();
  const steps: PlanResult["steps"] = [];
  const recommendations: PlanResult["recommendations"] = [];
  const complianceFlags: string[] = [];
  let totalCost = 0;
  let llmCalls = 0;

  const { contextualLLM } = await import("../shared/stewardlyWiring");

  async function llmStep(stepName: string, prompt: string): Promise<string> {
    if (llmCalls >= MAX_STEPS || totalCost >= MAX_COST) {
      return `Budget exceeded (${llmCalls} calls, $${totalCost.toFixed(2)}) — skipping ${stepName}`;
    }
    const stepStart = Date.now();
    try {
      const response = await contextualLLM({
        userId: advisorId,
        contextType: "analysis" as any,
        messages: [{ role: "user", content: prompt }],
      });
      llmCalls++;
      totalCost += 0.15; // Estimated cost per call
      const content = response.choices?.[0]?.message?.content || "";
      steps.push({ step: stepName, status: "complete", findings: content.slice(0, 500), durationMs: Date.now() - stepStart });
      return content;
    } catch (e: any) {
      steps.push({ step: stepName, status: "failed", findings: e.message, durationMs: Date.now() - stepStart });
      return "";
    }
  }

  // Step 1: Gather client data
  await llmStep("gather", `Summarize all available data for client ${clientId}: profile, calculator results, financial data, enrichment data. List key facts.`);

  // Step 2: Gap analysis
  const gaps = await llmStep("analyze", `For client ${clientId}, analyze gaps across: protection, retirement, estate, tax, education, debt, growth, business. List each gap with estimated dollar amount.`);

  // Step 3: Recommendations
  const recs = await llmStep("recommend", `Based on these gaps: ${gaps.slice(0, 1000)}\nGenerate specific product recommendations with WealthBridge products. Return JSON array: [{area, product, priority, reason}]`);
  try {
    const parsed = JSON.parse(recs);
    if (Array.isArray(parsed)) recommendations.push(...parsed);
  } catch { /* parse error — use raw */ }

  // Step 4: Compliance check
  const compliance = await llmStep("compliance", `Review these recommendations for Reg BI compliance: ${recs.slice(0, 1000)}\nFlag any suitability concerns. Return JSON: {flags: string[]}`);
  try {
    const parsed = JSON.parse(compliance);
    if (parsed.flags) complianceFlags.push(...parsed.flags);
  } catch { /* parse error */ }

  // Step 5: Generate report
  await llmStep("report", `Generate a comprehensive financial plan summary for client ${clientId}. Include: executive summary, gap analysis, recommendations, implementation timeline (14-day/90-day/annual), and compliance notes.`);

  // Archive for FINRA compliance
  const db = await getDb();
  if (db) {
    try {
      const { communicationArchive } = await import("../../drizzle/schema");
      const threeYears = new Date();
      threeYears.setFullYear(threeYears.getFullYear() + 3);
      await db.insert(communicationArchive).values({
        userId: advisorId,
        contentType: "plan_analysis",
        contentText: JSON.stringify({ steps, recommendations, complianceFlags }),
        leadId: clientId,
        retentionExpiresAt: threeYears,
      });
    } catch { /* graceful */ }
  }

  log.info({ clientId, steps: steps.length, llmCalls, totalCost: totalCost.toFixed(2), durationMs: Date.now() - start }, "Comprehensive plan generated");

  return { clientId, steps, recommendations, complianceFlags, totalCost, totalSteps: llmCalls };
}
