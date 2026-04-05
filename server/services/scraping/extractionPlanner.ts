/**
 * Extraction Planner — Plan data extraction strategies for providers
 */
import { logger } from "../../_core/logger";
import { checkTos } from "./tosChecker";

const log = logger.child({ module: "extractionPlanner" });

export type ExtractionMethod = "api" | "rss" | "structured_html" | "pdf_parse" | "manual";

export interface ExtractionPlan {
  provider: string;
  method: ExtractionMethod;
  endpoints: string[];
  schedule: string; // cron expression
  rateLimitRpm: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  dataFields: string[];
  estimatedRecords: number;
  tosCleared: boolean;
}

const KNOWN_APIS: Record<string, { method: ExtractionMethod; endpoints: string[]; rateLimitRpm: number }> = {
  "fred.stlouisfed.org": { method: "api", endpoints: ["https://api.stlouisfed.org/fred/series/observations"], rateLimitRpm: 120 },
  "api.census.gov": { method: "api", endpoints: ["https://api.census.gov/data"], rateLimitRpm: 500 },
  "sec.gov": { method: "api", endpoints: ["https://efts.sec.gov/LATEST/search-index"], rateLimitRpm: 10 },
  "irs.gov": { method: "pdf_parse", endpoints: ["https://www.irs.gov/pub/irs-pdf/"], rateLimitRpm: 5 },
};

export async function createPlan(
  provider: string,
  dataFields: string[],
  estimatedRecords = 100
): Promise<ExtractionPlan> {
  const tos = await checkTos(provider);
  const known = KNOWN_APIS[provider];

  if (known) {
    log.info({ provider, method: known.method }, "Using known API extraction plan");
    return {
      provider, method: known.method, endpoints: known.endpoints,
      schedule: "0 0 6 * * *", rateLimitRpm: known.rateLimitRpm,
      retryPolicy: { maxRetries: 3, backoffMs: 2000 },
      dataFields, estimatedRecords, tosCleared: tos.allowed,
    };
  }

  // Default: conservative plan
  return {
    provider, method: tos.allowed ? "structured_html" : "manual",
    endpoints: [`https://${provider}`],
    schedule: "0 0 2 * * 0", // Weekly Sunday 2am
    rateLimitRpm: 5,
    retryPolicy: { maxRetries: 2, backoffMs: 5000 },
    dataFields, estimatedRecords, tosCleared: tos.allowed,
  };
}

export async function batchPlan(
  providers: Array<{ domain: string; fields: string[]; records?: number }>
): Promise<ExtractionPlan[]> {
  return Promise.all(providers.map((p) => createPlan(p.domain, p.fields, p.records)));
}
