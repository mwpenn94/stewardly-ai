/**
 * Runtime Record Sanitizer
 *
 * Every public entrypoint in this module accepts arbitrary records from
 * third parties (API responses, CSV uploads, scraped tables). That data is
 * untrusted. A malicious or malformed payload could:
 *
 *   - Crash inference with circular references
 *   - Blow memory with deeply nested objects
 *   - Poison field names with prototype-pollution keys (__proto__, constructor)
 *   - Waste compute on pathologically-large string values
 *   - Inject control characters into downstream logs
 *
 * This module is the defense layer. Every record passes through
 * `sanitizeRecord` before it reaches inferSchema / schema drift / CRM
 * mapping / personalization hint extraction.
 *
 * Pure function. No I/O. Defensively copies every value.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SanitizeOptions {
  maxDepth?: number;              // default 6
  maxKeys?: number;               // default 500 (per level)
  maxStringLength?: number;       // default 50_000 chars
  maxArrayLength?: number;        // default 1000
  allowPrototypeKeys?: boolean;   // default false — blocks __proto__/constructor
  truncateStrings?: boolean;      // default true (rather than reject)
}

export interface SanitizeReport {
  recordCount: number;
  droppedKeys: string[];
  truncatedStrings: number;
  truncatedArrays: number;
  circularCutoffs: number;
  depthViolations: number;
  totalViolations: number;
}

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// ─── Core sanitizer (single record) ───────────────────────────────────────

function sanitizeValue(
  value: unknown,
  options: Required<SanitizeOptions>,
  report: SanitizeReport,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Strip control characters that could corrupt logs
    const stripped = value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
    if (stripped.length > options.maxStringLength) {
      report.truncatedStrings++;
      return options.truncateStrings
        ? stripped.slice(0, options.maxStringLength)
        : null;
    }
    return stripped;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "function" || typeof value === "symbol") {
    // Functions/symbols shouldn't appear in JSON-like payloads; drop them
    report.totalViolations++;
    return null;
  }
  if (typeof value !== "object") return value;

  // Circular reference detection
  if (seen.has(value as object)) {
    report.circularCutoffs++;
    return null;
  }
  seen.add(value as object);

  if (depth >= options.maxDepth) {
    report.depthViolations++;
    return null;
  }

  if (Array.isArray(value)) {
    const truncated = value.length > options.maxArrayLength;
    if (truncated) report.truncatedArrays++;
    const arr = value.slice(0, options.maxArrayLength);
    return arr.map((item) => sanitizeValue(item, options, report, depth + 1, seen));
  }

  // Object branch
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  const capped = entries.slice(0, options.maxKeys);
  if (entries.length > options.maxKeys) {
    report.totalViolations++;
  }
  for (const [key, v] of capped) {
    if (!options.allowPrototypeKeys && PROTOTYPE_KEYS.has(key)) {
      report.droppedKeys.push(key);
      continue;
    }
    // Keys with control characters get stripped/dropped
    const cleanKey = key.replace(/[\u0000-\u001f\u007f]/g, "");
    if (!cleanKey) {
      report.droppedKeys.push(key);
      continue;
    }
    out[cleanKey] = sanitizeValue(v, options, report, depth + 1, seen);
  }
  return out;
}

// ─── Public entrypoints ───────────────────────────────────────────────────

/**
 * Sanitize a single record. Returns a defensively-copied object plus a
 * report of every policy violation encountered. Always safe to pass the
 * result to inferSchema / downstream services.
 */
export function sanitizeRecord(
  record: unknown,
  options: SanitizeOptions = {},
): { record: Record<string, unknown>; report: SanitizeReport } {
  const opts: Required<SanitizeOptions> = {
    maxDepth: options.maxDepth ?? 6,
    maxKeys: options.maxKeys ?? 500,
    maxStringLength: options.maxStringLength ?? 50_000,
    maxArrayLength: options.maxArrayLength ?? 1000,
    allowPrototypeKeys: options.allowPrototypeKeys ?? false,
    truncateStrings: options.truncateStrings ?? true,
  };
  const report: SanitizeReport = {
    recordCount: 1,
    droppedKeys: [],
    truncatedStrings: 0,
    truncatedArrays: 0,
    circularCutoffs: 0,
    depthViolations: 0,
    totalViolations: 0,
  };
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { record: {}, report };
  }
  const sanitized = sanitizeValue(record, opts, report, 0, new WeakSet()) as
    | Record<string, unknown>
    | null;
  return {
    record: sanitized && typeof sanitized === "object" ? sanitized : {},
    report,
  };
}

/**
 * Sanitize an array of records. Batches the reports so the caller sees a
 * single aggregate view.
 */
export function sanitizeRecords(
  records: unknown[],
  options: SanitizeOptions = {},
): { records: Array<Record<string, unknown>>; report: SanitizeReport } {
  const aggregate: SanitizeReport = {
    recordCount: 0,
    droppedKeys: [],
    truncatedStrings: 0,
    truncatedArrays: 0,
    circularCutoffs: 0,
    depthViolations: 0,
    totalViolations: 0,
  };
  const out: Array<Record<string, unknown>> = [];
  for (const r of records) {
    const { record, report } = sanitizeRecord(r, options);
    if (Object.keys(record).length === 0) continue;
    out.push(record);
    aggregate.recordCount++;
    aggregate.truncatedStrings += report.truncatedStrings;
    aggregate.truncatedArrays += report.truncatedArrays;
    aggregate.circularCutoffs += report.circularCutoffs;
    aggregate.depthViolations += report.depthViolations;
    aggregate.totalViolations += report.totalViolations;
    for (const k of report.droppedKeys) {
      if (!aggregate.droppedKeys.includes(k)) aggregate.droppedKeys.push(k);
    }
  }
  return { records: out, report: aggregate };
}

/**
 * One-line summary of a sanitization report for logs + audit trail.
 */
export function summarizeSanitize(report: SanitizeReport): string {
  const parts: string[] = [`${report.recordCount} records`];
  if (report.truncatedStrings > 0) parts.push(`${report.truncatedStrings} strings truncated`);
  if (report.truncatedArrays > 0) parts.push(`${report.truncatedArrays} arrays truncated`);
  if (report.circularCutoffs > 0) parts.push(`${report.circularCutoffs} circular refs`);
  if (report.depthViolations > 0) parts.push(`${report.depthViolations} depth cutoffs`);
  if (report.droppedKeys.length > 0) parts.push(`${report.droppedKeys.length} dangerous keys dropped`);
  if (parts.length === 1) parts.push("clean");
  return parts.join(" · ");
}
