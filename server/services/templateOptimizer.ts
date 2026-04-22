/**
 * Template Optimizer — Monthly test of AI response templates across models
 * Auto-select best model per template domain based on measured quality
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "templateOptimizer" });

export interface OptimizationResult {
  templateId: number;
  model: string;
  domain: string;
  avgScore: number;
  sampleCount: number;
}

export async function optimizeTemplates(): Promise<OptimizationResult[]> {
  const db = await getDb();
  if (!db) return [];

  const results: OptimizationResult[] = [];
  const models = ["gemini-2.5-flash", "gpt-4o", "claude-sonnet-4"];
  const domains = ["protection", "retirement", "estate", "tax", "education", "growth", "business", "cash_flow"];

  const { invokeLLM } = await import("../_core/llm");
  const { templateOptimizationResults } = await import("../../drizzle/schema");

  // Test prompts per domain for evaluation
  const TEST_PROMPTS: Record<string, string[]> = {
    protection: ["What life insurance coverage do I need for a family of 4?", "Compare term vs whole life insurance", "How much disability insurance should I carry?"],
    retirement: ["How much should I save for retirement at age 35?", "Compare Roth IRA vs Traditional IRA", "What is a safe withdrawal rate?"],
    estate: ["Do I need a living trust?", "How can I minimize estate taxes?", "What documents do I need for estate planning?"],
    tax: ["What tax deductions can I claim as a W-2 employee?", "How does tax-loss harvesting work?", "Should I contribute to pre-tax or Roth 401k?"],
    education: ["How much should I save in a 529 plan?", "Compare 529 vs UTMA accounts", "What financial literacy topics should I teach my kids?"],
    growth: ["How should I allocate my investment portfolio?", "What is dollar cost averaging?", "Compare index funds vs actively managed funds"],
    business: ["What business structure is best for tax purposes?", "How do I set up a SEP IRA?", "What insurance does a small business need?"],
    cash_flow: ["How do I create a monthly budget?", "What is the 50/30/20 rule?", "How much emergency fund should I have?"],
  };

  for (const domain of domains) {
    const prompts = TEST_PROMPTS[domain] ?? [`Provide financial advice about ${domain}`];
    for (const model of models) {
      let totalScore = 0;
      let sampleCount = 0;
      for (const prompt of prompts) {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: `You are a financial advisor specializing in ${domain}. Provide clear, actionable, compliant advice.` },
              { role: "user", content: prompt },
            ],
          });
          const content = response?.choices?.[0]?.message?.content ?? "";
          // Score the response using LLM-as-judge
          const evalResponse = await invokeLLM({
            messages: [
              { role: "system", content: "Rate the following financial advice response on a scale of 0.0 to 1.0 based on: accuracy, clarity, actionability, and compliance. Return ONLY a JSON object with a 'score' field." },
              { role: "user", content: `Domain: ${domain}\nQuestion: ${prompt}\nResponse: ${content.slice(0, 2000)}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "quality_score",
                strict: true,
                schema: { type: "object", properties: { score: { type: "number" } }, required: ["score"], additionalProperties: false },
              },
            },
          });
          const parsed = JSON.parse(evalResponse?.choices?.[0]?.message?.content ?? "{}");
          totalScore += Math.max(0, Math.min(1, parsed.score ?? 0.5));
          sampleCount++;
        } catch (err) {
          log.warn({ domain, model, err }, "Template eval failed for one prompt");
        }
      }
      const avgScore = sampleCount > 0 ? Math.round((totalScore / sampleCount) * 100) / 100 : 0;
      const result = { templateId: domains.indexOf(domain) + 1, model, domain, avgScore, sampleCount };
      results.push(result);
      try {
        await db.insert(templateOptimizationResults).values({
          templateId: result.templateId,
          model: result.model,
          domain: result.domain,
          avgScore: String(result.avgScore),
          sampleCount: result.sampleCount,
        });
      } catch { /* graceful */ }
    }
  }

  log.info({ domains: domains.length, models: models.length, total: results.length }, "Template optimization completed");
  return results;
}

export async function getBestModelForDomain(domain: string): Promise<string> {
  const db = await getDb();
  if (!db) return "gemini-2.5-flash";

  try {
    const { templateOptimizationResults } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    const [best] = await db.select().from(templateOptimizationResults)
      .where(eq(templateOptimizationResults.domain, domain))
      .orderBy(desc(templateOptimizationResults.avgScore))
      .limit(1);

    return best?.model || "gemini-2.5-flash";
  } catch {
    return "gemini-2.5-flash";
  }
}
