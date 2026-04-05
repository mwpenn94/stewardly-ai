/**
 * JSON Parser — Parse JSON files for data import
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "jsonParser" });

export interface JsonParseResult {
  records: Record<string, unknown>[];
  headers: string[];
  totalCount: number;
  errors: string[];
}

export function parseBuffer(buffer: Buffer, options?: { maxRecords?: number; rootPath?: string }): JsonParseResult {
  const maxRecords = options?.maxRecords ?? 50000;
  const errors: string[] = [];

  try {
    const text = buffer.toString("utf-8");
    let data = JSON.parse(text);

    // Navigate to root path if specified (e.g., "data.results")
    if (options?.rootPath) {
      for (const key of options.rootPath.split(".")) {
        data = data?.[key];
      }
    }

    // Normalize to array
    const records: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
    const limited = records.slice(0, maxRecords);

    if (records.length > maxRecords) {
      errors.push(`Truncated: ${records.length} records → ${maxRecords}`);
    }

    const headers = limited.length > 0 ? Object.keys(limited[0]) : [];
    log.info({ records: limited.length }, "JSON parsed");
    return { records: limited, headers, totalCount: limited.length, errors };
  } catch (e: any) {
    log.error({ error: e.message }, "JSON parse failed");
    return { records: [], headers: [], totalCount: 0, errors: [e.message] };
  }
}

/** Detect if JSON is array of objects, nested, or single object */
export function detectStructure(buffer: Buffer): { type: "array" | "object" | "nested"; suggestedRootPath: string | null; recordCount: number } {
  try {
    const data = JSON.parse(buffer.toString("utf-8"));
    if (Array.isArray(data)) return { type: "array", suggestedRootPath: null, recordCount: data.length };

    // Look for array properties
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && (val as unknown[]).length > 0) {
        return { type: "nested", suggestedRootPath: key, recordCount: (val as unknown[]).length };
      }
    }

    return { type: "object", suggestedRootPath: null, recordCount: 1 };
  } catch {
    return { type: "object", suggestedRootPath: null, recordCount: 0 };
  }
}
