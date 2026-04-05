/**
 * AI Enrichment — Use LLM to enrich lead data from available context
 */
import { logger } from "../../_core/logger";
import { rawInvokeLLM as callLLM } from "../../shared/stewardlyWiring";

const log = logger.child({ module: "aiEnrichment" });

export interface LeadContext {
  email?: string;
  name?: string;
  company?: string;
  phone?: string;
  source?: string;
  rawNotes?: string;
}

export interface AIEnrichedData {
  estimatedAge: string | null;
  estimatedIncome: string | null;
  lifeStage: string | null;
  primaryInterest: string | null;
  riskProfile: string | null;
  confidence: number;
  reasoning: string;
}

export async function enrichWithAI(context: LeadContext): Promise<AIEnrichedData | null> {
  try {
    const prompt = `Given the following lead information, estimate their financial profile. Be conservative and honest about confidence levels.

Name: ${context.name || "Unknown"}
Email domain: ${context.email?.split("@")[1] || "Unknown"}
Company: ${context.company || "Unknown"}
Source: ${context.source || "Unknown"}
Notes: ${context.rawNotes || "None"}

Respond in JSON with: estimatedAge (range like "35-44"), estimatedIncome (range like "$75K-$100K"), lifeStage (one of: early_career, mid_career, pre_retirement, retirement, high_net_worth), primaryInterest (one of: retirement_planning, tax_optimization, insurance, estate_planning, investment, general), riskProfile (one of: conservative, moderate, aggressive), confidence (0-1), reasoning (brief explanation).`;

    const response = await callLLM({
      messages: [
        { role: "system", content: "You are a financial data analyst. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              estimatedAge: { type: ["string", "null"] },
              estimatedIncome: { type: ["string", "null"] },
              lifeStage: { type: ["string", "null"] },
              primaryInterest: { type: ["string", "null"] },
              riskProfile: { type: ["string", "null"] },
              confidence: { type: "number" },
              reasoning: { type: "string" },
            },
            required: ["estimatedAge", "estimatedIncome", "lifeStage", "primaryInterest", "riskProfile", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content as string) as AIEnrichedData;
    log.info({ name: context.name, confidence: parsed.confidence }, "AI enrichment complete");
    return parsed;
  } catch (e: any) {
    log.error({ error: e.message }, "AI enrichment failed");
    return null;
  }
}

export async function batchEnrich(leads: LeadContext[]): Promise<Map<string, AIEnrichedData | null>> {
  const results = new Map<string, AIEnrichedData | null>();
  for (const lead of leads) {
    const key = lead.email || lead.name || "unknown";
    results.set(key, await enrichWithAI(lead));
    // Rate limit: 1 per second
    await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}
