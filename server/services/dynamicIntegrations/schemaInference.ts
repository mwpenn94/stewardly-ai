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
  /** Normalized (lowercase, underscored) leaf name — derived from path. */
  normalizedName: string;
  /** Raw leaf name — last segment of the dot-path. */
  name: string;
  /** Whether this field looks required (present in >90% of records). */
  isRequiredSuggested: boolean;
  /** Whether this looks like a primary key candidate. */
  isPrimaryKeyCandidate: boolean;
  /** Whether this looks read-only (id, created_at, etc.). */
  isReadOnlySuggested: boolean;
  /** Semantic hints derived from field name + type patterns. */
  semanticHints: SemanticHint[];
  /** Number of non-null samples observed. */
  sampleCount: number;
  /** Fraction of records where this field was null/missing. */
  nullRate: number;
  /** Fraction of distinct values vs total values. */
  uniqueRate: number;
}

/** Semantic hint types for field classification. */
export type SemanticHint =
  | "email"
  | "phone"
  | "url"
  | "name"
  | "first_name"
  | "last_name"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "primary_key"
  | "foreign_key"
  | "timestamp_created"
  | "timestamp_updated"
  | "currency"
  | "percentage"
  | "description"
  | "status"
  | "tag"
  | "date"
  | "identifier"
  | "category"
  | "quantity"
  | "unknown";

/**
 * Alias for FieldSchema — downstream modules (adapterGenerator, crmCanonicalMap,
 * schemaDrift) use this name for the enriched per-field representation.
 */
export type InferredField = FieldSchema;

export interface InferredSchema {
  recordCount: number;
  fields: FieldSchema[];
  /**
   * Best guess at the record-identifier field (`id`, `uuid`, `slug`, `key`, ...).
   * Falls back to the first `unique===true` string field, else undefined.
   */
  primaryKey?: string;
  /** Best guess at a timestamp/date field for ordering. */
  timestampField?: string | null;
  /** Overall confidence score (0-1). */
  confidence?: number;
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
  result.timestampField = detectTimestampField(fields);
  result.confidence = fields.length > 0
    ? fields.reduce((s, f) => s + f.confidence, 0) / fields.length
    : 0;
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
 * Enrich FieldSchema entries with computed fields (name, normalizedName,
 * semantic hints, rates, etc.) after the core inference is done.
 */
function enrichFields(fields: FieldSchema[], recordCount: number): void {
  const PK_PATTERNS = /^(id|_id|uuid|slug|key|pk)$/i;
  const READONLY_PATTERNS = /^(id|_id|uuid|created_at|createdAt|updated_at|updatedAt|__v|_rev)$/i;
  const TS_PATTERNS = /(?:created|updated|modified|timestamp|date|_at|At)$/i;

  const SEMANTIC_MAP: Array<[RegExp, SemanticHint]> = [
    [/email/i, "email"],
    [/phone|mobile|tel/i, "phone"],
    [/url|link|href|website/i, "url"],
    [/^name$|full_?name|display_?name/i, "name"],
    [/first_?name|fname|given/i, "first_name"],
    [/last_?name|lname|surname|family/i, "last_name"],
    [/address|street/i, "address"],
    [/city/i, "city"],
    [/state|province|region/i, "state"],
    [/zip|postal/i, "zip"],
    [/country/i, "country"],
    [/status/i, "status"],
    [/tag|label|category/i, "tag"],
    [/desc|description|summary|note/i, "description"],
    [/price|amount|cost|fee|total/i, "currency"],
    [/percent|rate|ratio/i, "percentage"],
  ];

  for (const f of fields) {
    const leaf = f.path.includes(".") ? f.path.split(".").pop()! : f.path;
    f.name = leaf;
    f.normalizedName = leaf.toLowerCase().replace(/[^a-z0-9]/g, "_");
    f.sampleCount = f.nonNullCount;
    f.nullRate = recordCount > 0 ? 1 - (f.nonNullCount / recordCount) : 0;
    f.uniqueRate = f.nonNullCount > 0 ? f.distinctCount / f.nonNullCount : 0;
    f.isRequiredSuggested = recordCount > 0 && f.presentCount / recordCount > 0.9;
    f.isPrimaryKeyCandidate = PK_PATTERNS.test(leaf) || (f.unique && f.type === "string");
    f.isReadOnlySuggested = READONLY_PATTERNS.test(leaf);

    const hints: SemanticHint[] = [];
    // Type-based hints
    if (f.type === "email") hints.push("email");
    if (f.type === "url") hints.push("url");
    if (f.type === "phone") hints.push("phone");
    if (f.type === "currency") hints.push("currency");
    if (f.type === "percentage") hints.push("percentage");
    // Name-based hints
    for (const [re, hint] of SEMANTIC_MAP) {
      if (re.test(leaf) && !hints.includes(hint)) hints.push(hint);
    }
    if (PK_PATTERNS.test(leaf)) hints.push("primary_key");
    if (TS_PATTERNS.test(leaf) && (f.type === "date" || f.type === "datetime")) {
      if (/created/i.test(leaf)) hints.push("timestamp_created");
      if (/updated|modified/i.test(leaf)) hints.push("timestamp_updated");
    }
    f.semanticHints = hints;
  }
}

/**
 * Detect a timestamp field for ordering.
 */
function detectTimestampField(fields: FieldSchema[]): string | null {
  const candidates = fields.filter(
    (f) => (f.type === "datetime" || f.type === "date") && f.semanticHints?.some(h => h === "timestamp_created" || h === "timestamp_updated")
  );
  return candidates[0]?.path ?? null;
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

// ─── toInferredField + ExtendedInferredSchema ────────────────────────────

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

/** Convert a (possibly partial) FieldSchema to a fully-populated InferredField. */
export function toInferredField(f: Partial<FieldSchema> & Pick<FieldSchema, "path" | "type" | "seenTypes" | "nullable" | "presentCount" | "nonNullCount" | "distinctCount" | "unique" | "samples" | "confidence">): InferredField {
  const total = f.presentCount || 1;
  return {
    ...f,
    normalizedName: normalizeFieldName(f.path),
    name: f.path.split(".").pop() ?? f.path,
    isRequiredSuggested: !f.nullable && f.presentCount > 0,
    semanticHints: deriveSemanticHints(f as FieldSchema),
    sampleCount: f.presentCount,
    nullRate: 1 - (f.nonNullCount / total),
    uniqueRate: f.nonNullCount > 0 ? f.distinctCount / f.nonNullCount : 0,
    isPrimaryKeyCandidate: f.unique && !f.nullable && f.type !== "boolean" && f.type !== "mixed",
    isReadOnlySuggested: f.isReadOnlySuggested ?? false,
  } as InferredField;
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
