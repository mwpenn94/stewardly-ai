/**
 * Extraction Executor — Execute data extraction plans with rate limiting and retry
 */
import { logger } from "../../_core/logger";
import type { ExtractionPlan } from "./extractionPlanner";

const log = logger.child({ module: "extractionExecutor" });

export interface ExtractionResult {
  provider: string;
  success: boolean;
  recordsExtracted: number;
  errors: string[];
  duration: number;
  executedAt: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function execute(plan: ExtractionPlan): Promise<ExtractionResult> {
  const start = Date.now();
  const errors: string[] = [];
  let totalRecords = 0;

  if (!plan.tosCleared) {
    return { provider: plan.provider, success: false, recordsExtracted: 0, errors: ["ToS not cleared — extraction blocked"], duration: Date.now() - start, executedAt: Date.now() };
  }

  if (plan.method === "manual") {
    return { provider: plan.provider, success: false, recordsExtracted: 0, errors: ["Manual extraction required — automated access not available"], duration: Date.now() - start, executedAt: Date.now() };
  }

  const delayBetweenRequests = Math.ceil(60000 / plan.rateLimitRpm);

  for (const endpoint of plan.endpoints) {
    let attempt = 0;
    let success = false;

    while (attempt <= plan.retryPolicy.maxRetries && !success) {
      try {
        const res = await fetch(endpoint, {
          headers: { "User-Agent": "StewardlyBot/1.0 (+https://stewardly.manus.space/bot)" },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await res.json();
          const records = Array.isArray(data) ? data.length : (data.results?.length ?? data.observations?.length ?? 1);
          totalRecords += records;
        } else {
          const text = await res.text();
          totalRecords += text.length > 0 ? 1 : 0;
        }

        success = true;
        log.info({ provider: plan.provider, endpoint, records: totalRecords }, "Endpoint extracted");
      } catch (e: any) {
        attempt++;
        if (attempt <= plan.retryPolicy.maxRetries) {
          log.warn({ provider: plan.provider, attempt, error: e.message }, "Extraction retry");
          await sleep(plan.retryPolicy.backoffMs * attempt);
        } else {
          errors.push(`${endpoint}: ${e.message}`);
        }
      }
    }

    await sleep(delayBetweenRequests);
  }

  return {
    provider: plan.provider,
    success: errors.length === 0,
    recordsExtracted: totalRecords,
    errors,
    duration: Date.now() - start,
    executedAt: Date.now(),
  };
}

export async function batchExecute(plans: ExtractionPlan[]): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];
  for (const plan of plans) {
    results.push(await execute(plan));
  }
  return results;
}
