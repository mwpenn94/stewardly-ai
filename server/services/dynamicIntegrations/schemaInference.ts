/**
 * Dynamic Integration — Schema Inference
 *
 * Pure functional module that takes a set of sample records and derives a
 * probabilistic schema: per-field inferred type, nullability, cardinality,
 * unique-ness, sample values, and confidence. Used to let the UI preview
 * what an undocumented data source looks like before the user commits to
 * a blueprint, and to auto-draft initial field mappings for the sink.
 *
 * No DB, no network, no LLM — easy to unit-test and reuse in the client.
 */

/** Canonical type space produced by the inferencer. */
export type InferredType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "url"
  | "phone"
  | "currency"
  | "percentage"
  | "enum"
  | "array"
  | "object"
  | "null"
  | "unknown"
  | "timestamp"
  | "json"
  | "mixed";

export interface FieldSchema {
  /** Dot-path to the field within a record (e.g. "user.address.zip"). */
  path: string;
  /** Best-guess type. */
  type: InferredType;
  /** All types ever observed for this field, in frequency order. */
  seenTypes: InferredType[];
  /** True if any record had this field set to null/undefined or missing. */
  nullable: boolean;
  /** Number of records that had this field at all. */
  presentCount: number;
  /** Number of records with a non-null value. */
  nonNullCount: number;
  /** Distinct-value count (capped at 100 for memory safety). */
  distinctCount: number;
  /** True when distinctCount === nonNullCount && nonNullCount > 1. */
  unique: boolean;
  /** Up to 5 sample values drawn from the record set (strings, truncated). */
  samples: string[];
  /** 0-1 confidence that `type` is correct. */
  confidence: number;
  /** If type==="enum", the distinct values (≤20). */
  enumValues?: string[];
}

export interface InferredSchema {
  recordCount: number;
  fields: InferredField[];
  /**
   * Best guess at the record-identifier field (`id`, `uuid`, `slug`, `key`, ...).
   * Falls back to the first `unique===true` string field, else undefined.
   */
  primaryKey?: string;
}

const MAX_SAMPLES_PER_FIELD = 5;
const MAX_DISTINCT_TRACK = 100;
const ENUM_MAX_DISTINCT = 20;
const ENUM_MIN_RECORDS = 3;
const MAX_SAMPLE_STRING_LEN = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const PHONE_RE = /^\+?[\d\-\s()]{7,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const CURRENCY_RE = /^[\$€£¥]\s?-?\d+(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:,\d{3})*(?:\.\d+)?\s?(?:USD|EUR|GBP|JPY)$/i;
const PERCENT_RE = /^-?\d+(?:\.\d+)?\s?%$/;
const INTEGER_RE = /^-?\d+$/;
const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

/** Classify a single raw value. Safe on any input. */
export function classifyValue(value: unknown): InferredType {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value !== "string") return "unknown";

  const s = value.trim();
  if (s === "") return "null";
  // lowercase-normalized true/false tokens
  const lc = s.toLowerCase();
  if (lc === "true" || lc === "false") return "boolean";
  // Order matters: integer check must beat number.
  if (INTEGER_RE.test(s)) return "integer";
  if (NUMBER_RE.test(s)) return "number";
  if (CURRENCY_RE.test(s)) return "currency";
  if (PERCENT_RE.test(s)) return "percentage";
  if (EMAIL_RE.test(s)) return "email";
  if (URL_RE.test(s)) return "url";
  // Date formats must be checked before phone — "2026-04-11" otherwise
  // matches the phone regex because it's digits + dashes.
  if (ISO_DATETIME_RE.test(s)) return "datetime";
  if (ISO_DATE_RE.test(s)) return "date";
  if (PHONE_RE.test(s) && /\d/.test(s) && countDigits(s) >= 7) return "phone";
  return "string";
}

function countDigits(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) n++;
  return n;
}

/** Flatten a record into `{ "a.b.c": value }`. Arrays get "[*]" placeholder. */
export function flattenRecord(
  rec: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (rec === null || rec === undefined) {
    if (prefix) out[prefix] = rec;
    return out;
  }
  if (Array.isArray(rec)) {
    // Arrays: record the array itself once so the caller sees `type: "array"`.
    out[prefix || "[]"] = rec;
    return out;
  }
  if (typeof rec !== "object") {
    out[prefix || "value"] = rec;
    return out;
  }
  const obj = rec as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0 && prefix) {
    out[prefix] = obj;
    return out;
  }
  for (const k of keys) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flattenRecord(v, nextKey, out);
    } else {
      out[nextKey] = v;
    }
  }
  return out;
}

function truncateSample(value: unknown): string {
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s == null) s = String(value);
  if (s.length > MAX_SAMPLE_STRING_LEN) s = s.slice(0, MAX_SAMPLE_STRING_LEN) + "…";
  return s;
}

/** Pure: take an array of records and return an InferredSchema. */
export function inferSchema(records: unknown[]): InferredSchema {
  const result: InferredSchema = { recordCount: records.length, fields: [] };
  if (records.length === 0) return result;

  // path -> accumulator
  interface Acc {
    types: Map<InferredType, number>;
    presentCount: number;
    nonNullCount: number;
    samples: string[];
    sampleSet: Set<string>;
    distinctValues: Set<string>;
    overflowedDistinct: boolean;
  }
  const acc = new Map<string, Acc>();

  for (const rec of records) {
    const flat = flattenRecord(rec);
    for (const [path, value] of Object.entries(flat)) {
      let a = acc.get(path);
      if (!a) {
        a = {
          types: new Map(),
          presentCount: 0,
          nonNullCount: 0,
          samples: [],
          sampleSet: new Set<string>(),
          distinctValues: new Set<string>(),
          overflowedDistinct: false,
        };
        acc.set(path, a);
      }
      a.presentCount++;
      const t = classifyValue(value);
      a.types.set(t, (a.types.get(t) ?? 0) + 1);
      if (t !== "null") {
        a.nonNullCount++;
        // Sample tracking (dedup by stringified form).
        const sample = truncateSample(value);
        if (!a.sampleSet.has(sample) && a.samples.length < MAX_SAMPLES_PER_FIELD) {
          a.samples.push(sample);
          a.sampleSet.add(sample);
        }
        // Distinct-value tracking (cardinality).
        if (!a.overflowedDistinct) {
          a.distinctValues.add(sample);
          if (a.distinctValues.size > MAX_DISTINCT_TRACK) {
            a.overflowedDistinct = true;
            a.distinctValues.clear();
          }
        }
      }
    }
  }

  const fields: InferredField[] = [];
  const accEntries = Array.from(acc.entries());
  for (const [path, a] of accEntries) {
    // Build seenTypes in descending frequency (excluding "null" — that feeds nullable).
    const typeEntries = Array.from(a.types.entries()) as [InferredType, number][];
    const seenTypes: InferredType[] = typeEntries
      .sort((x, y) => y[1] - x[1])
      .map((entry) => entry[0]);
    const nullableFromTypes = a.types.has("null");
    // nullable if any record had null OR field was missing on some records
    const nullable = nullableFromTypes || a.presentCount < records.length;

    // Primary type = most frequent non-null type; if only null, type === "null".
    const nonNullTypes = seenTypes.filter((t) => t !== "null");
    let primary: InferredType = nonNullTypes[0] ?? "null";

    // If both integer and number show up, number wins.
    if (nonNullTypes.includes("number") && nonNullTypes.includes("integer")) {
      primary = "number";
    }
    // If we see both scalar and structural types (array/object), it's mixed.
    const hasStructural = nonNullTypes.some((t) => t === "array" || t === "object");
    const hasScalar = nonNullTypes.some((t) => t !== "array" && t !== "object");
    if (hasStructural && hasScalar && nonNullTypes.length > 1) {
      primary = "mixed";
    }
    // If "string" + any richer type show up, the richer type wins (email/date/etc.)
    // as long as it dominates; else fall back to string.
    const richerTypes: InferredType[] = [
      "email", "url", "phone", "currency", "percentage", "datetime", "date",
    ];
    const richer = nonNullTypes.find((t) => richerTypes.includes(t));
    if (richer) {
      const richerCount = a.types.get(richer) ?? 0;
      if (richerCount >= Math.ceil(a.nonNullCount * 0.9)) {
        primary = richer;
      } else {
        primary = "string";
      }
    }

    // Confidence: share of the dominant type among non-null observations.
    const nonNullObs = a.nonNullCount;
    const topCount = nonNullObs > 0 ? Math.max(...nonNullTypes.map((t) => a.types.get(t) ?? 0)) : 0;
    let confidence = nonNullObs > 0 ? topCount / nonNullObs : 0;
    if (nonNullObs === 0) confidence = 0;
    // Shrink confidence for tiny samples.
    if (records.length < 3) confidence *= 0.75;

    const distinctCount = a.overflowedDistinct ? MAX_DISTINCT_TRACK + 1 : a.distinctValues.size;
    const unique = nonNullObs > 1 && !a.overflowedDistinct && a.distinctValues.size === nonNullObs;

    // Enum detection: small cardinality relative to records + string-ish type.
    let enumValues: string[] | undefined;
    const enumEligible =
      records.length >= ENUM_MIN_RECORDS &&
      !a.overflowedDistinct &&
      a.distinctValues.size > 1 &&
      a.distinctValues.size <= ENUM_MAX_DISTINCT &&
      nonNullObs >= a.distinctValues.size * 2;
    if (enumEligible && (primary === "string" || primary === "integer")) {
      primary = "enum";
      enumValues = Array.from(a.distinctValues).sort();
    }

    fields.push(toInferredField({
      path,
      type: primary,
      seenTypes,
      nullable,
      presentCount: a.presentCount,
      nonNullCount: nonNullObs,
      distinctCount,
      unique,
      samples: a.samples,
      confidence: Math.round(confidence * 100) / 100,
      enumValues,
    }));
  }

  fields.sort((x, y) => {
    // Stable ordering: primary-key candidates first, then by non-null count desc.
    const xKey = isIdLike(x.path) ? 0 : 1;
    const yKey = isIdLike(y.path) ? 0 : 1;
    if (xKey !== yKey) return xKey - yKey;
    if (x.nonNullCount !== y.nonNullCount) return y.nonNullCount - x.nonNullCount;
    return x.path.localeCompare(y.path);
  });

  result.fields = fields;
  result.primaryKey = pickPrimaryKey(fields);
  return result;
}

const ID_LIKE = new Set(["id", "uuid", "slug", "key", "identifier", "ref", "code"]);

function isIdLike(path: string): boolean {
  const lastSegment = path.split(".").pop() ?? path;
  const norm = lastSegment.toLowerCase();
  if (ID_LIKE.has(norm)) return true;
  return norm.endsWith("_id") || norm.endsWith("id") && norm.length <= 8;
}

function pickPrimaryKey(fields: InferredField[]): string | undefined {
  const candidates = fields.filter((f) => isIdLike(f.path) && f.unique && f.nullable === false);
  if (candidates.length > 0) return candidates[0].path;
  // Fall back to any unique non-null string/integer field with an identifier-like hint.
  const fallback = fields.find(
    (f) =>
      f.unique &&
      !f.nullable &&
      (f.type === "string" || f.type === "integer" || f.type === "enum") &&
      f.semanticHints.includes("identifier"),
  );
  return fallback?.path;
}

/**
 * Build a machine-usable summary of the schema for persistence in the
 * blueprint_samples table. Drops long sample strings to keep JSON small.
 */
export function schemaToPersisted(schema: InferredSchema): {
  recordCount: number;
  primaryKey: string | null;
  fields: Array<{
    path: string;
    type: InferredType;
    nullable: boolean;
    unique: boolean;
    samples: string[];
    confidence: number;
    enumValues?: string[];
  }>;
} {
  return {
    recordCount: schema.recordCount,
    primaryKey: schema.primaryKey ?? null,
    fields: schema.fields.map((f) => ({
      path: f.path,
      type: f.type,
      nullable: f.nullable,
      unique: f.unique,
      samples: f.samples.slice(0, 3),
      confidence: f.confidence,
      enumValues: f.enumValues,
    })),
  };
}

// ─── Backward-compat aliases & stubs ────────────────────────────────────

/** Alias for FieldSchema — used by adapterGenerator, crmCanonicalMap, schemaDrift. */
export type InferredField = FieldSchema & {
  /** Normalized snake_case name derived from path. */
  normalizedName: string;
  /** Suggested name for display. */
  name: string;
  /** Whether the field looks required based on nullability. */
  isRequiredSuggested: boolean;
  /** Semantic hints (e.g. "email", "phone", "name"). */
  semanticHints: SemanticHint[];
  /** Alias for presentCount — used by drift detector. */
  sampleCount: number;
  /** Ratio of null values (0-1). */
  nullRate: number;
  /** Ratio of unique values (0-1). */
  uniqueRate: number;
  /** Whether this field is a candidate for primary key. */
  isPrimaryKeyCandidate: boolean;
  /** Whether this field should be read-only in generated UIs. */
  isReadOnlySuggested?: boolean;
};

/** Semantic hint tag for a field. */
export type SemanticHint =
  | "email"
  | "phone"
  | "name"
  | "address"
  | "date"
  | "currency"
  | "identifier"
  | "url"
  | "description"
  | "status"
  | "category"
  | "quantity"
  | "percentage"
  | "timestamp_created"
  | "timestamp_updated"
  | "primary_key"
  | "state"
  | "zip"
  | "country"
  | "unknown";

/** Derive semantic hints from a FieldSchema. */
function deriveSemanticHints(f: FieldSchema): SemanticHint[] {
  const hints: SemanticHint[] = [];
  const lp = f.path.toLowerCase();
  if (f.type === "email" || lp.includes("email")) hints.push("email");
  if (f.type === "phone" || lp.includes("phone") || lp.includes("tel")) hints.push("phone");
  if (f.type === "url" || lp.includes("url") || lp.includes("website")) hints.push("url");
  if (f.type === "date" || f.type === "datetime" || lp.includes("date") || lp.includes("time")) hints.push("date");
  if (f.type === "currency" || lp.includes("price") || lp.includes("amount") || lp.includes("cost")) hints.push("currency");
  if (f.type === "percentage" || lp.includes("rate") || lp.includes("percent")) hints.push("percentage");
  if (lp.includes("name") || lp.includes("first") || lp.includes("last")) hints.push("name");
  if (lp.includes("address") || lp.includes("street") || lp.includes("city") || lp.includes("zip")) hints.push("address");
  if (lp.includes("id") || lp.includes("key") || lp.includes("uuid")) hints.push("identifier");
  if (lp.includes("status") || lp.includes("state")) hints.push("status");
  if (lp.includes("category") || lp.includes("type") || lp.includes("kind")) hints.push("category");
  if (lp.includes("count") || lp.includes("quantity") || lp.includes("qty")) hints.push("quantity");
  if (lp.includes("desc") || lp.includes("note") || lp.includes("comment")) hints.push("description");
  if (lp.includes("created") && (f.type === "date" || f.type === "datetime" || f.type === "timestamp")) hints.push("timestamp_created");
  if ((lp.includes("updated") || lp.includes("modified")) && (f.type === "date" || f.type === "datetime" || f.type === "timestamp")) hints.push("timestamp_updated");
  if (hints.length === 0) hints.push("unknown");
  return hints;
}

/** Normalize a dot-path to snake_case. */
function normalizeFieldName(path: string): string {
  return path
    .replace(/\[\*\]/g, "")
    .replace(/\./g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Convert FieldSchema to InferredField with extra derived properties. */
export function toInferredField(f: FieldSchema): InferredField {
  const total = f.presentCount || 1;
  return {
    ...f,
    normalizedName: normalizeFieldName(f.path),
    name: f.path.split(".").pop() ?? f.path,
    isRequiredSuggested: !f.nullable && f.presentCount > 0,
    semanticHints: deriveSemanticHints(f),
    sampleCount: f.presentCount,
    nullRate: 1 - (f.nonNullCount / total),
    uniqueRate: f.nonNullCount > 0 ? f.distinctCount / f.nonNullCount : 0,
    isPrimaryKeyCandidate: f.unique && !f.nullable && f.type !== "boolean" && f.type !== "mixed",
  };
}

/** Extended InferredSchema with extra metadata. */
export interface ExtendedInferredSchema extends InferredSchema {
  confidence: number;
  timestampField: string | null;
}

/** Merge multiple schemas into one (union of fields). */
export function mergeSchemas(schemas: InferredSchema[]): InferredSchema {
  if (schemas.length === 0) return { recordCount: 0, fields: [] };
  if (schemas.length === 1) return schemas[0];

  const fieldMap = new Map<string, InferredField>();
  let totalRecords = 0;

  for (const schema of schemas) {
    totalRecords += schema.recordCount;
    for (const field of schema.fields) {
      const existing = fieldMap.get(field.path);
      if (!existing) {
        fieldMap.set(field.path, { ...field } as InferredField);
      } else {
        existing.presentCount += field.presentCount;
        existing.nonNullCount += field.nonNullCount;
        existing.nullable = existing.nullable || field.nullable;
        existing.unique = existing.unique && field.unique;
        existing.distinctCount = Math.max(existing.distinctCount, field.distinctCount);
        if (existing.confidence > field.confidence) {
          // keep higher confidence type
        } else {
          existing.type = field.type;
          existing.confidence = field.confidence;
        }
        const sampleSet = new Set<string>([...existing.samples, ...field.samples]);
        existing.samples = Array.from(sampleSet).slice(0, 5);
      }
    }
  }

  return {
    recordCount: totalRecords,
    fields: Array.from(fieldMap.values()),
    primaryKey: schemas.find(s => s.primaryKey)?.primaryKey,
  };
}

/** Suggest CRUD mapping for a schema (which fields map to create/read/update/delete). */
export function suggestCrudMapping(schema: InferredSchema): {
  identifierField: string | null;
  displayField: string | null;
  searchableFields: string[];
  sortableFields: string[];
  filterableFields: string[];
} {
  const fields = schema.fields.map(toInferredField);
  const idField = fields.find(f => f.semanticHints.includes("identifier") && f.unique);
  const nameField = fields.find(f => f.semanticHints.includes("name"));
  const searchable = fields
    .filter(f => f.type === "string" && !f.semanticHints.includes("identifier"))
    .map(f => f.path);
  const sortable = fields
    .filter(f => ["number", "integer", "date", "datetime", "currency"].includes(f.type))
    .map(f => f.path);
  const filterable = fields
    .filter(f => f.type === "enum" || f.semanticHints.includes("status") || f.semanticHints.includes("category"))
    .map(f => f.path);

  return {
    identifierField: idField?.path ?? schema.primaryKey ?? null,
    displayField: nameField?.path ?? fields.find(f => f.type === "string")?.path ?? null,
    searchableFields: searchable.slice(0, 10),
    sortableFields: sortable.slice(0, 10),
    filterableFields: filterable.slice(0, 10),
  };
}

/** Summarize a schema into a human-readable string. */
export function summarizeSchema(schema: InferredSchema): string {
  const lines: string[] = [
    `Schema: ${schema.recordCount} records, ${schema.fields.length} fields`,
  ];
  if (schema.primaryKey) lines.push(`Primary key: ${schema.primaryKey}`);
  for (const f of schema.fields.slice(0, 20)) {
    const nullable = f.nullable ? "?" : "";
    lines.push(`  ${f.path}: ${f.type}${nullable} (${Math.round(f.confidence * 100)}% confidence)`);
  }
  if (schema.fields.length > 20) {
    lines.push(`  ... and ${schema.fields.length - 20} more fields`);
  }
  return lines.join("\n");
}
