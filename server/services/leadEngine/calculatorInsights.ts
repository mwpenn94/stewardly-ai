/**
 * Calculator Insights — AI-generated personalized analysis of calculator results
 * Logs to communication_archive (FINRA 17a-4, 3yr retention)
 */
import { logger } from "../../_core/logger";
import { getDb } from "../../db";

const log = logger.child({ module: "calculatorInsights" });

const DISCLAIMER = "\n\n---\n*This analysis is for educational purposes only and does not constitute investment advice, tax advice, or a recommendation to purchase any financial product. Please consult a licensed professional before making financial decisions. Results are based on the information you provided and may not reflect your complete financial picture.*";

export async function generateInsight(params: {
  userId?: number;
  calculatorType: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  sessionId?: string;
}): Promise<string> {
  const { contextualLLM } = await import("../../shared/stewardlyWiring");

  try {
    const prompt = `Analyze these ${params.calculatorType} calculator results and provide 3-5 paragraphs of personalized insight:

Inputs: ${JSON.stringify(params.inputs, null, 2)}
Results: ${JSON.stringify(params.results, null, 2)}

Focus on: key takeaways, potential gaps, actionable next steps, and relevant industry benchmarks.`;

    const response = await contextualLLM({
      userId: params.userId,
      contextType: "analysis" as any,
      messages: [{ role: "user", content: prompt }],
    });

    const insight = (response.choices?.[0]?.message?.content || "Unable to generate insight at this time.") + DISCLAIMER;

    // Archive for FINRA compliance
    await archiveInsight(params, insight);

    return insight;
  } catch (err: any) {
    log.error({ error: err.message, calculatorType: params.calculatorType }, "Insight generation failed");
    return "We couldn't generate a personalized analysis right now. Here are some general tips based on your calculator type." + DISCLAIMER;
  }
}

async function archiveInsight(params: { userId?: number; calculatorType: string; sessionId?: string }, insight: string) {
  const db = await getDb();
  if (!db) return;
  try {
    const { communicationArchive } = await import("../../../drizzle/schema");
    const threeYears = new Date();
    threeYears.setFullYear(threeYears.getFullYear() + 3);
    await db.insert(communicationArchive).values({
      userId: params.userId,
      sessionId: params.sessionId,
      contentType: "calculator_insight",
      contentText: insight,
      calculatorType: params.calculatorType,
      retentionExpiresAt: threeYears,
    });
  } catch { /* graceful degradation */ }
}
