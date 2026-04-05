/**
 * Model Comparison — Query multiple models and return side-by-side responses
 * Gate behind professional/manager role (not client-facing)
 * Cost: 3x single query — show estimated cost before execution
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "modelComparison" });

export interface ComparisonResult {
  models: Array<{
    model: string;
    response: string;
    tokens: { input: number; output: number };
    durationMs: number;
  }>;
  estimatedCost: number;
  comparisonSummary?: string;
}

export function estimateCost(prompt: string, modelCount: number): number {
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const costPerModel = (estimatedTokens * 0.003 + 500 * 0.015) / 1000; // rough estimate
  return Math.round(costPerModel * modelCount * 100) / 100;
}

export async function compareModels(params: {
  prompt: string;
  models?: string[];
  userId: number;
}): Promise<ComparisonResult> {
  const { contextualLLM } = await import("../shared/stewardlyWiring");

  const models = params.models || ["gemini-2.5-flash", "gpt-4o", "claude-sonnet-4"];
  const results: ComparisonResult["models"] = [];

  const cost = estimateCost(params.prompt, models.length);

  // Query all models in parallel
  const promises = models.map(async (model) => {
    const start = Date.now();
    try {
      const response = await contextualLLM({
        userId: params.userId,
        contextType: "analysis" as any,
        messages: [{ role: "user", content: params.prompt }],
      });
      const content = response.choices?.[0]?.message?.content || "";
      return {
        model,
        response: content,
        tokens: { input: response.usage?.prompt_tokens || 0, output: response.usage?.completion_tokens || 0 },
        durationMs: Date.now() - start,
      };
    } catch (e: any) {
      return { model, response: `Error: ${e.message}`, tokens: { input: 0, output: 0 }, durationMs: Date.now() - start };
    }
  });

  const settled = await Promise.all(promises);
  results.push(...settled);

  log.info({ userId: params.userId, modelCount: models.length, cost }, "Model comparison completed");

  return { models: results, estimatedCost: cost };
}
