/**
 * Enrichment Orchestrator — Waterfall: PDL → Clearbit → Apollo → AI fallback
 * DISCARD any race/ethnicity/health/political/sexual-orientation data
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "enrichment" });

const PROHIBITED_FIELDS = ["race", "ethnicity", "health", "political", "sexual_orientation", "religion", "disability"];

export interface EnrichmentResult {
  source: string;
  confidence: number;
  data: Record<string, unknown>;
  fieldsEnriched: string[];
}

export async function enrichLead(params: {
  email?: string;
  name?: string;
  company?: string;
  linkedinUrl?: string;
}): Promise<EnrichmentResult | null> {
  // Waterfall: check env keys and use first available
  if (process.env.PDL_API_KEY) {
    const result = await tryPdl(params);
    if (result) return sanitize(result, 0.85, "pdl");
  }

  if (process.env.CLEARBIT_API_KEY) {
    const result = await tryClearbit(params);
    if (result) return sanitize(result, 0.80, "clearbit");
  }

  if (process.env.APOLLO_API_KEY) {
    const result = await tryApollo(params);
    if (result) return sanitize(result, 0.75, "apollo");
  }

  // AI fallback
  return tryAiEnrichment(params);
}

function sanitize(data: Record<string, unknown>, confidence: number, source: string): EnrichmentResult {
  // Remove prohibited fields (fair lending compliance)
  for (const field of PROHIBITED_FIELDS) {
    delete data[field];
    for (const key of Object.keys(data)) {
      if (key.toLowerCase().includes(field)) delete data[key];
    }
  }

  return {
    source,
    confidence,
    data,
    fieldsEnriched: Object.keys(data).filter(k => data[k] != null),
  };
}

async function tryPdl(_params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  log.info("PDL enrichment — stub (env-gated)");
  return null;
}

async function tryClearbit(_params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  log.info("Clearbit enrichment — stub (env-gated)");
  return null;
}

async function tryApollo(_params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  log.info("Apollo enrichment — stub (env-gated)");
  return null;
}

async function tryAiEnrichment(params: Record<string, unknown>): Promise<EnrichmentResult | null> {
  try {
    const { contextualLLM } = await import("../../shared/stewardlyWiring");
    const prompt = `Research this person and return structured data: ${JSON.stringify(params)}. Return JSON with fields: title, company, industry, location, estimatedIncome, linkedin.`;

    const response = await contextualLLM({
      contextType: "analysis" as any,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content);
      return sanitize(parsed, 0.45, "ai_inference");
    } catch {
      return { source: "ai_inference", confidence: 0.40, data: { rawResponse: content }, fieldsEnriched: [] };
    }
  } catch (e: any) {
    log.warn({ error: e.message }, "AI enrichment failed");
    return null;
  }
}
