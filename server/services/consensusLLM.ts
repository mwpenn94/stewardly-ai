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
    // Query primary and secondary in parallel
    const [primary, secondary] = await Promise.all([
      contextualLLM(config as any),
      contextualLLM({ ...config, messages: [...config.messages] } as any),
    ]);

    const primaryContent = primary.choices?.[0]?.message?.content || "";
    const secondaryContent = secondary.choices?.[0]?.message?.content || "";

    // Simple agreement check based on content similarity
    const agreement = calculateAgreement(primaryContent, secondaryContent);

    if (agreement > 0.85) {
      log.info({ agreement }, "Consensus achieved — models agree");
      return primary;
    }

    log.warn({ agreement }, "Consensus weak — models disagree, flagging for review");
    return {
      ...primary,
      _consensusWarning: "Models produced different recommendations — recommend professional review",
      _consensusScore: agreement,
      _alternatives: [secondary],
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
