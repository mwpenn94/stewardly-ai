/**
 * Consensus LLM — Query 2-3 models for high-stakes financial recommendations
 * Use for: suitability, product recommendations, tax strategies, estate plans
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "consensusLLM" });

export interface ConsensusResult {
  primary: any;
  consensusScore: number;
  consensusWarning?: string;
  alternatives?: any[];
  agreements?: string[];
  disagreements?: Array<{ topic: string; primaryPosition: string; secondaryPosition: string }>;
}

export async function consensusLLM(config: {
  userId?: number;
  contextType?: string;
  messages: Array<{ role: string; content: any }>;
  requireConsensus?: boolean;
  consensusWeights?: { primary: number; secondary: number };
  [key: string]: any;
}): Promise<any> {
  const { contextualLLM } = await import("../shared/stewardlyWiring");

  if (!config.requireConsensus) {
    return contextualLLM(config as any);
  }

  try {
    // Query genuinely different model families through Forge for real consensus
    const primaryModel = "claude-sonnet-4-20250514"; // Anthropic
    const secondaryModel = "gpt-4o";                  // OpenAI
    const tertiaryModel = "gemini-2.5-pro";            // Google

    const models = [primaryModel, secondaryModel];
    if (config.consensusWeights?.primary === 0.5) {
      // Equal weight = true consensus, add third model
      models.push(tertiaryModel);
    }

    const results = await Promise.all(
      models.map(model =>
        contextualLLM({ ...config, model, messages: [...config.messages] } as any)
          .catch(() => null) // Don't fail if one model is unavailable
      )
    );

    const validResults = results.filter(r => r != null);
    if (validResults.length === 0) {
      throw new Error("All consensus models failed");
    }

    const primary = validResults[0];
    const primaryContent = primary.choices?.[0]?.message?.content || "";

    if (validResults.length === 1) {
      // Only one model responded — return it with warning
      return { ...primary, _consensusWarning: "Only one model responded — consensus unavailable" };
    }

    const secondaryContent = validResults[1].choices?.[0]?.message?.content || "";
    const agreement = calculateAgreement(primaryContent, secondaryContent);

    const modelsUsed = models.slice(0, validResults.length);
    log.info({ agreement, modelsUsed }, `Consensus: ${modelsUsed.length} models, agreement ${(agreement * 100).toFixed(0)}%`);

    if (agreement > 0.85) {
      return { ...primary, _consensusScore: agreement, _modelsUsed: modelsUsed };
    }

    return {
      ...primary,
      _consensusWarning: `Models disagree (${(agreement * 100).toFixed(0)}% agreement) — recommend professional review`,
      _consensusScore: agreement,
      _modelsUsed: modelsUsed,
      _alternatives: validResults.slice(1),
    };
  } catch (e: any) {
    log.error({ error: e.message }, "Consensus failed — falling back to single model");
    return contextualLLM(config as any);
  }
}

function calculateAgreement(a: string, b: string): number {
  if (!a || !b) return 0;
  // Simple word overlap metric
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = Array.from(wordsA).filter(w => wordsB.has(w));
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB)));
  return union.size > 0 ? intersection.length / union.size : 0;
}
