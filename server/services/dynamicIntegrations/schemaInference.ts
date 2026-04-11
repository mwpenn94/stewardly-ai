/**
 * Dynamic Schema Inference Engine
 *
 * Takes arbitrary sample records (JSON-shaped rows) from any source — CSV,
 * JSON API, XML blob, database export, even a web scrape — and infers a
 * typed schema PLUS semantic hints (email / phone / url / currency / date / id)
 * PLUS primary-key candidates PLUS CRUD field-role suggestions (read-only vs
 * writable, required vs optional).
 *
 * Designed as the foundation for the "docless integrations" problem: when a
 * third-party source has no documented schema but you can get sample data,
 * this module produces a high-confidence best-guess contract you can build
 * the rest of the CRUD pipeline around.
 *
 * Pure-function module. No I/O. No database. No network. All tests run
 * against in-memory input.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type InferredType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "timestamp"
  | "uuid"
  | "email"
  | "phone"
  | "url"
  | "currency"
  | "percentage"
  | "json"
  | "array"
  | "null"
  | "mixed";

export type SemanticHint =
  | "primary_key"
  | "foreign_key"
  | "email"
  | "phone"
  | "url"
  | "name"
  | "address"
  | "country"
  | "state"
  | "zip"
  | "currency_amount"
  | "percentage"
  | "ssn"
  | "ein"
  | "tax_id"
  | "account_number"
  | "policy_number"
  | "confirmation_number"
  | "status"
  | "type"
  | "category"
  | "tag"
  | "timestamp_created"
  | "timestamp_updated"
  | "timestamp_event"
  | "descriptive_text"
  | "large_text"
  | "boolean_flag"
  | "enum"
  | "nested_object"
  | "collection";

export interface InferredField {
  name: string;                    // original key
  normalizedName: string;          // snake_case
  type: InferredType;              // best-guess base type
  typeDistribution: Record<InferredType, number>; // frequency map
  nullable: boolean;               // any null / undefined / "" values seen
  nullRate: number;                // 0..1
  uniqueRate: number;              // 0..1 (unique count / non-null count)
  sampleCount: number;             // non-null samples considered
  minLength?: number;              // for strings
  maxLength?: number;              // for strings
  avgLength?: number;              // for strings
  minValue?: number;               // for numbers
  maxValue?: number;               // for numbers
  distinctValues?: string[];       // populated if enum-like (<=20 unique)
  semanticHints: SemanticHint[];   // ranked; strongest first
  confidence: number;              // 0..1 overall field confidence
  isPrimaryKeyCandidate: boolean;
  isForeignKeyCandidate: boolean;
  isReadOnlySuggested: boolean;    // e.g. id/created_at/updated_at
  isRequiredSuggested: boolean;    // low null rate + high uniqueness
  examples: string[];              // up to 3 short examples
}

export interface InferredSchema {
  recordCount: number;
  fields: InferredField[];
  primaryKey: string | null;       // most likely PK (normalized name)
  timestampField: string | null;   // most likely "updated_at" surrogate
  detectedCollection: string | null; // heuristic: the name of a nested array, if any
  confidence: number;              // rollup confidence
  warnings: string[];              // non-fatal issues the caller should know about
}

export interface CrudFieldSuggestion {
  field: string;
  role: "identifier" | "readable" | "writable" | "derived" | "skip";
  reason: string;
}

export interface CrudMapping {
  primaryKey: string | null;
  identifier: CrudFieldSuggestion[];
  readable: CrudFieldSuggestion[];
  writable: CrudFieldSuggestion[];
  derived: CrudFieldSuggestion[];  // timestamps, computed
  skip: CrudFieldSuggestion[];     // mixed / unstable / empty
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
const URL_RE = /^(https?:\/\/|www\.)/i;
const PHONE_RE = /^[+()\-.\s0-9]{7,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/;
const SSN_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const EIN_RE = /^\d{2}-?\d{7}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const STATE_RE = /^[A-Z]{2}$/;
const COUNTRY_RE = /^[A-Z]{2,3}$/;
const CURRENCY_PREFIX_RE = /^\s*[$€£¥]\s*-?[0-9,]+(\.\d+)?/;
const PERCENT_RE = /^-?\d+(\.\d+)?\s*%$/;
const INTEGER_RE = /^-?\d+$/;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const EPOCH_MS_MIN = 946684800000;  // Jan 1 2000
const EPOCH_MS_MAX = 4102444800000; // Jan 1 2100
const EPOCH_S_MIN = 946684800;
const EPOCH_S_MAX = 4102444800;

export function normalizeFieldName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-.]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function detectValueType(value: unknown): InferredType {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "json";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "mixed";
    if (Number.isInteger(value)) {
      // Epoch timestamp heuristic
      if (value >= EPOCH_MS_MIN && value <= EPOCH_MS_MAX) return "timestamp";
      if (value >= EPOCH_S_MIN && value <= EPOCH_S_MAX) return "timestamp";
      return "integer";
    }
    return "number";
  }
  if (typeof value !== "string") return "mixed";
  const trimmed = value.trim();
  if (!trimmed) return "null";
  if (UUID_RE.test(trimmed)) return "uuid";
  if (EMAIL_RE.test(trimmed)) return "email";
  if (URL_RE.test(trimmed)) return "url";
  if (ISO_DATETIME_RE.test(trimmed)) return "datetime";
  if (ISO_DATE_RE.test(trimmed)) return "date";
  if (CURRENCY_PREFIX_RE.test(trimmed)) return "currency";
  if (PERCENT_RE.test(trimmed)) return "percentage";
  if (INTEGER_RE.test(trimmed)) return "integer";
  if (NUMERIC_RE.test(trimmed)) return "number";
  if (trimmed.length >= 7 && PHONE_RE.test(trimmed)) {
    const digitCount = (trimmed.match(/\d/g) || []).length;
    if (digitCount >= 7) return "phone";
  }
  return "string";
}

function pickDominantType(distribution: Record<string, number>): InferredType {
  let total = 0;
  for (const [t, c] of Object.entries(distribution)) {
    if (t !== "null") total += c;
  }
  if (total === 0) return "null";

  let best: InferredType = "mixed";
  let bestCount = 0;
  for (const [t, count] of Object.entries(distribution)) {
    if (t === "null") continue;
    if (count > bestCount) {
      best = t as InferredType;
      bestCount = count;
    }
  }
  // No single type has a plurality → mark as mixed
  if (bestCount / total < 0.5) return "mixed";
  return best;
}

function deriveSemanticHints(
  name: string,
  field: Omit<InferredField, "semanticHints" | "confidence" | "isPrimaryKeyCandidate" | "isForeignKeyCandidate" | "isReadOnlySuggested" | "isRequiredSuggested" | "examples">,
  _samples: unknown[]
): SemanticHint[] {
  const hints: SemanticHint[] = [];
  const n = field.normalizedName;

  // Type-derived hints
  if (field.type === "email") hints.push("email");
  if (field.type === "phone") hints.push("phone");
  if (field.type === "url") hints.push("url");
  if (field.type === "percentage") hints.push("percentage");
  if (field.type === "currency") hints.push("currency_amount");

  // Name-derived hints
  // Primary key: bare `id`/`uuid`/`guid` only — NOT `foo_id` (that's FK)
  if (n === "id" || n === "uuid" || n === "guid") hints.push("primary_key");
  if (/_id$/.test(n) && n !== "id") hints.push("foreign_key");
  if (/(created|inserted|added).*at$/.test(n) || n === "created") hints.push("timestamp_created");
  if (/(updated|modified|changed).*at$/.test(n) || n === "updated") hints.push("timestamp_updated");
  if (/(occurred|happened|event|timestamp|date_time).*/.test(n)) hints.push("timestamp_event");
  if (/^(email|email_address|e_mail)$/.test(n)) hints.push("email");
  if (/(phone|mobile|tel|cell)/.test(n)) hints.push("phone");
  if (/(url|link|website|site)/.test(n)) hints.push("url");
  if (/(first|last|full|display|given|family)_?name$/.test(n) || n === "name") hints.push("name");
  if (/(address|street|city)/.test(n)) hints.push("address");
  if (/^(country|country_code)$/.test(n)) hints.push("country");
  if (/^(state|province|region)$/.test(n)) hints.push("state");
  if (/^(zip|postal|postcode)(_code)?$/.test(n)) hints.push("zip");
  if (/^(status|state|stage)$/.test(n)) hints.push("status");
  if (/^(type|kind)$/.test(n)) hints.push("type");
  if (/^(category|group|class)$/.test(n)) hints.push("category");
  if (/^(tag|tags|label|labels)$/.test(n)) hints.push("tag");
  if (/(currency|amount|price|cost|balance|total|fee|premium)/.test(n) && (field.type === "number" || field.type === "integer" || field.type === "currency")) hints.push("currency_amount");
  if (/(percent|rate|ratio)/.test(n) && (field.type === "number" || field.type === "percentage")) hints.push("percentage");
  if (/ssn|social_security/.test(n)) hints.push("ssn");
  if (/(ein|employer_id|tax_id)/.test(n)) hints.push("tax_id");
  if (/(policy)_?(number|num|id|no)$/.test(n)) hints.push("policy_number");
  if (/account_?(number|num|id|no)$/.test(n)) hints.push("account_number");
  if (/(confirmation|ref|reference|tracking)_?(number|num|id|no)$/.test(n)) hints.push("confirmation_number");

  // Structural hints
  if (field.type === "boolean") hints.push("boolean_flag");
  if (field.type === "array") hints.push("collection");
  if (field.type === "json") hints.push("nested_object");

  // Length-derived hints
  if (field.type === "string" && typeof field.avgLength === "number" && field.avgLength > 200) {
    hints.push("large_text");
  } else if (field.type === "string" && field.distinctValues && field.distinctValues.length <= 20 && field.distinctValues.length >= 2) {
    hints.push("enum");
  } else if (field.type === "string" && hints.length === 0) {
    hints.push("descriptive_text");
  }

  // Unique pass — dedupe while preserving order
  const seen = new Set<string>();
  return hints.filter((h) => (seen.has(h) ? false : (seen.add(h), true)));
}

// ─── Field inference ──────────────────────────────────────────────────────

function inferField(name: string, samples: unknown[]): InferredField {
  const normalizedName = normalizeFieldName(name);
  const dist: Record<string, number> = {};
  const nonNull: unknown[] = [];
  const seenValues = new Set<string>();
  let nullCount = 0;
  let totalLength = 0;
  let minLength = Infinity;
  let maxLength = -Infinity;
  let minValue = Infinity;
  let maxValue = -Infinity;

  for (const raw of samples) {
    const t = detectValueType(raw);
    dist[t] = (dist[t] || 0) + 1;
    if (t === "null") {
      nullCount++;
      continue;
    }
    nonNull.push(raw);

    const stringifiable =
      typeof raw === "string"
        ? raw
        : typeof raw === "number" || typeof raw === "boolean"
          ? String(raw)
          : JSON.stringify(raw);
    seenValues.add(stringifiable);

    if (typeof raw === "string") {
      const len = raw.length;
      totalLength += len;
      if (len < minLength) minLength = len;
      if (len > maxLength) maxLength = len;
    }
    if (typeof raw === "number") {
      if (raw < minValue) minValue = raw;
      if (raw > maxValue) maxValue = raw;
    }
  }

  const totalType = pickDominantType(dist);
  const uniqueRate = nonNull.length > 0 ? seenValues.size / nonNull.length : 0;
  const nullRate = samples.length > 0 ? nullCount / samples.length : 0;
  const avgLength = nonNull.length > 0 && minLength !== Infinity ? Math.round(totalLength / nonNull.length) : undefined;

  const distinctValues =
    seenValues.size <= 20 && totalType === "string"
      ? Array.from(seenValues).slice(0, 20)
      : undefined;

  const baseField = {
    name,
    normalizedName,
    type: totalType,
    typeDistribution: dist as Record<InferredType, number>,
    nullable: nullCount > 0,
    nullRate,
    uniqueRate,
    sampleCount: nonNull.length,
    minLength: minLength === Infinity ? undefined : minLength,
    maxLength: maxLength === -Infinity ? undefined : maxLength,
    avgLength,
    minValue: minValue === Infinity ? undefined : minValue,
    maxValue: maxValue === -Infinity ? undefined : maxValue,
    distinctValues,
  };

  const semanticHints = deriveSemanticHints(name, baseField, nonNull);

  // Confidence: high when type distribution is consistent + low null rate
  const totalSeen = samples.length || 1;
  const dominantFrac = (dist[totalType] || 0) / totalSeen;
  const typeHomogeneity = nonNull.length === 0 ? 0.5 : (dist[totalType] || 0) / nonNull.length;
  const confidence = Math.max(
    0,
    Math.min(1, 0.6 * typeHomogeneity + 0.3 * (1 - nullRate) + 0.1 * dominantFrac)
  );

  const isPrimaryKeyCandidate =
    uniqueRate >= 0.95 &&
    nullRate === 0 &&
    (semanticHints.includes("primary_key") ||
      totalType === "uuid" ||
      (/^id$/i.test(normalizedName) && (totalType === "integer" || totalType === "string")));

  const isForeignKeyCandidate =
    semanticHints.includes("foreign_key") && !isPrimaryKeyCandidate;

  const isReadOnlySuggested =
    isPrimaryKeyCandidate ||
    semanticHints.includes("timestamp_created") ||
    semanticHints.includes("timestamp_updated");

  const isRequiredSuggested = nullRate === 0 && totalType !== "null" && !isReadOnlySuggested;

  const examples = Array.from(seenValues)
    .slice(0, 3)
    .map((v) => (v.length > 80 ? v.slice(0, 77) + "..." : v));

  return {
    ...baseField,
    semanticHints,
    confidence,
    isPrimaryKeyCandidate,
    isForeignKeyCandidate,
    isReadOnlySuggested,
    isRequiredSuggested,
    examples,
  };
}

// ─── Top-level inference ──────────────────────────────────────────────────

export function inferSchema(records: Array<Record<string, unknown>>): InferredSchema {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      recordCount: 0,
      fields: [],
      primaryKey: null,
      timestampField: null,
      detectedCollection: null,
      confidence: 0,
      warnings: ["No records supplied"],
    };
  }

  const warnings: string[] = [];
  // Collect every field name across every record
  const fieldNames = new Set<string>();
  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    for (const k of Object.keys(rec)) fieldNames.add(k);
  }

  if (fieldNames.size === 0) {
    return {
      recordCount: records.length,
      fields: [],
      primaryKey: null,
      timestampField: null,
      detectedCollection: null,
      confidence: 0,
      warnings: ["Records have no inspectable fields"],
    };
  }

  // Check for sparse fields (present in less than 50% of records)
  const sparseThreshold = 0.5;

  const fields: InferredField[] = [];
  for (const name of Array.from(fieldNames)) {
    const samples = records.map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>)[name] : null));
    const presentCount = samples.filter((s) => s !== undefined).length;
    if (presentCount / records.length < sparseThreshold && records.length > 4) {
      warnings.push(`Field "${name}" present in only ${presentCount}/${records.length} records`);
    }
    fields.push(inferField(name, samples));
  }

  // Sort fields: identifier first, then required, then optional
  fields.sort((a, b) => {
    if (a.isPrimaryKeyCandidate !== b.isPrimaryKeyCandidate) return a.isPrimaryKeyCandidate ? -1 : 1;
    if (a.isRequiredSuggested !== b.isRequiredSuggested) return a.isRequiredSuggested ? -1 : 1;
    return a.normalizedName.localeCompare(b.normalizedName);
  });

  // Pick the best primary key candidate
  const pkField = fields.find((f) => f.isPrimaryKeyCandidate) || null;

  // Pick the best timestamp field
  let timestampField: InferredField | null = null;
  for (const f of fields) {
    if (f.semanticHints.includes("timestamp_updated")) {
      timestampField = f;
      break;
    }
  }
  if (!timestampField) {
    for (const f of fields) {
      if (f.semanticHints.includes("timestamp_created") || f.semanticHints.includes("timestamp_event")) {
        timestampField = f;
        break;
      }
    }
  }

  // Collection detection: find a field whose values are always arrays
  let collectionField: InferredField | null = null;
  for (const f of fields) {
    if (f.type === "array" && f.nullRate < 0.3) {
      collectionField = f;
      break;
    }
  }

  const fieldConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
  const warningsPenalty = Math.min(0.3, warnings.length * 0.05);
  const overallConfidence = Math.max(0, fieldConfidence - warningsPenalty);

  return {
    recordCount: records.length,
    fields,
    primaryKey: pkField?.normalizedName || null,
    timestampField: timestampField?.normalizedName || null,
    detectedCollection: collectionField?.normalizedName || null,
    confidence: overallConfidence,
    warnings,
  };
}

/**
 * Given a parsed schema, recommend CRUD field roles. Useful for wizard UIs
 * and for auto-generating the read/write field map of a dynamic adapter.
 */
export function suggestCrudMapping(schema: InferredSchema): CrudMapping {
  const identifier: CrudFieldSuggestion[] = [];
  const readable: CrudFieldSuggestion[] = [];
  const writable: CrudFieldSuggestion[] = [];
  const derived: CrudFieldSuggestion[] = [];
  const skip: CrudFieldSuggestion[] = [];

  for (const f of schema.fields) {
    if (f.isPrimaryKeyCandidate) {
      identifier.push({
        field: f.normalizedName,
        role: "identifier",
        reason: `${f.type} with ${Math.round(f.uniqueRate * 100)}% uniqueness, no nulls`,
      });
      continue;
    }

    if (f.type === "mixed") {
      skip.push({
        field: f.normalizedName,
        role: "skip",
        reason: "Value type is inconsistent across records — needs human review",
      });
      continue;
    }

    if (f.sampleCount === 0) {
      skip.push({
        field: f.normalizedName,
        role: "skip",
        reason: "No non-null samples observed",
      });
      continue;
    }

    if (f.semanticHints.includes("timestamp_created") || f.semanticHints.includes("timestamp_updated")) {
      derived.push({
        field: f.normalizedName,
        role: "derived",
        reason: `${f.semanticHints[0]} — managed by source, read-only`,
      });
      continue;
    }

    if (f.isReadOnlySuggested) {
      readable.push({
        field: f.normalizedName,
        role: "readable",
        reason: "System field, suggested read-only",
      });
      continue;
    }

    writable.push({
      field: f.normalizedName,
      role: "writable",
      reason: `${f.type}${f.isRequiredSuggested ? " (required)" : " (optional)"}${f.semanticHints.length > 0 ? ` · ${f.semanticHints[0]}` : ""}`,
    });
  }

  return {
    primaryKey: schema.primaryKey,
    identifier,
    readable,
    writable,
    derived,
    skip,
  };
}

/**
 * Merge two schemas (e.g. from two paginated sample batches) into a single
 * schema that reflects everything seen. Union field set, accumulate type
 * distribution, re-run confidence math.
 */
export function mergeSchemas(a: InferredSchema, b: InferredSchema): InferredSchema {
  const map = new Map<string, InferredField>();
  for (const f of a.fields) map.set(f.normalizedName, f);
  for (const f of b.fields) {
    const existing = map.get(f.normalizedName);
    if (!existing) {
      map.set(f.normalizedName, f);
      continue;
    }
    // Merge type distribution
    const merged: Record<string, number> = { ...(existing.typeDistribution as Record<string, number>) };
    for (const [t, c] of Object.entries(f.typeDistribution)) {
      merged[t] = (merged[t] || 0) + c;
    }
    const sampleCount = existing.sampleCount + f.sampleCount;
    const uniqueRate = (existing.uniqueRate * existing.sampleCount + f.uniqueRate * f.sampleCount) / (sampleCount || 1);
    map.set(f.normalizedName, {
      ...existing,
      type: pickDominantType(merged),
      typeDistribution: merged as Record<InferredType, number>,
      sampleCount,
      uniqueRate,
      nullable: existing.nullable || f.nullable,
      nullRate: (existing.nullRate + f.nullRate) / 2,
      examples: Array.from(new Set([...existing.examples, ...f.examples])).slice(0, 3),
      confidence: Math.max(existing.confidence, f.confidence),
    });
  }

  const merged: InferredSchema = {
    recordCount: a.recordCount + b.recordCount,
    fields: Array.from(map.values()),
    primaryKey: a.primaryKey || b.primaryKey,
    timestampField: a.timestampField || b.timestampField,
    detectedCollection: a.detectedCollection || b.detectedCollection,
    confidence: (a.confidence + b.confidence) / 2,
    warnings: Array.from(new Set([...a.warnings, ...b.warnings])),
  };
  return merged;
}

/**
 * Produce a short human-readable summary of an inferred schema. Used by
 * the Code Chat agent + the Integrations UI wizard.
 */
export function summarizeSchema(schema: InferredSchema): string {
  if (schema.fields.length === 0) return "Empty schema (no fields detected)";
  const parts: string[] = [];
  parts.push(`${schema.recordCount} records × ${schema.fields.length} fields`);
  parts.push(`confidence ${Math.round(schema.confidence * 100)}%`);
  if (schema.primaryKey) parts.push(`pk=${schema.primaryKey}`);
  if (schema.timestampField) parts.push(`ts=${schema.timestampField}`);
  if (schema.warnings.length) parts.push(`${schema.warnings.length} warning(s)`);
  return parts.join(" · ");
}
