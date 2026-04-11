/**
 * CRM Canonical Mapping
 *
 * Given an InferredSchema from ANY source (CRM export, LinkedIn pull,
 * docless API scrape, whatever), map the fields to Stewardly's canonical
 * CRM shape (contact / lead / deal) so downstream services can operate
 * on a normalized representation regardless of source.
 *
 * Strategy:
 *   1. Name-based fuzzy matching (synonym tables per canonical field)
 *   2. Semantic-hint-based matching (email hint → email field, etc.)
 *   3. Value-pattern matching (field shape + sample-value inspection)
 *   4. Confidence scoring per mapping
 *
 * Pure-function module. No I/O.
 */

import type { InferredSchema, InferredField, SemanticHint } from "./schemaInference";

// ─── Canonical CRM shape ───────────────────────────────────────────────────

export type CrmEntityType = "contact" | "lead" | "deal" | "organization" | "task" | "note";

export interface CanonicalField {
  name: string;
  dataType: "string" | "email" | "phone" | "url" | "number" | "currency" | "date" | "boolean" | "enum";
  required: boolean;
  synonyms: string[];       // case-insensitive substrings + normalized aliases
  semanticHints: SemanticHint[];  // inferred fields with any of these hints boost the match
  valuePattern?: RegExp;    // optional regex to validate sample values
  description: string;
}

// Canonical contact schema — used by CRM, lead pipeline, email campaigns
export const CANONICAL_CONTACT_FIELDS: CanonicalField[] = [
  {
    name: "externalId",
    dataType: "string",
    required: false,
    synonyms: ["id", "uuid", "guid", "contact_id", "record_id", "external_id", "primary_key"],
    semanticHints: ["primary_key"],
    description: "Source-side primary key for dedup",
  },
  {
    name: "email",
    dataType: "email",
    required: true,
    synonyms: ["email", "email_address", "e_mail", "work_email", "personal_email", "primary_email"],
    semanticHints: ["email"],
    description: "Primary email address",
  },
  {
    name: "firstName",
    dataType: "string",
    required: false,
    synonyms: ["first_name", "given_name", "firstname", "fname", "first"],
    semanticHints: ["name"],
    description: "First / given name",
  },
  {
    name: "lastName",
    dataType: "string",
    required: false,
    synonyms: ["last_name", "family_name", "surname", "lastname", "lname", "last"],
    semanticHints: ["name"],
    description: "Last / family name",
  },
  {
    name: "fullName",
    dataType: "string",
    required: false,
    synonyms: ["full_name", "name", "display_name", "contact_name", "person_name"],
    semanticHints: ["name"],
    description: "Full name (if first/last aren't separate)",
  },
  {
    name: "phone",
    dataType: "phone",
    required: false,
    synonyms: ["phone", "phone_number", "mobile", "cell", "tel", "telephone", "cell_phone", "mobile_phone"],
    semanticHints: ["phone"],
    description: "Primary phone number",
  },
  {
    name: "company",
    dataType: "string",
    required: false,
    synonyms: ["company", "company_name", "organization", "org", "employer", "account_name", "account", "business"],
    semanticHints: [],
    description: "Company / organization name",
  },
  {
    name: "title",
    dataType: "string",
    required: false,
    synonyms: ["title", "job_title", "position", "role", "job"],
    semanticHints: [],
    description: "Job title / role",
  },
  {
    name: "linkedinUrl",
    dataType: "url",
    required: false,
    synonyms: ["linkedin", "linkedin_url", "linkedin_profile", "li_url", "profile_url"],
    semanticHints: ["url"],
    valuePattern: /linkedin\.com\//i,
    description: "LinkedIn profile URL",
  },
  {
    name: "website",
    dataType: "url",
    required: false,
    synonyms: ["website", "web", "url", "homepage", "site", "company_website"],
    semanticHints: ["url"],
    description: "Website or company URL",
  },
  {
    name: "addressLine1",
    dataType: "string",
    required: false,
    synonyms: ["address", "address_1", "address_line_1", "street", "street_address"],
    semanticHints: ["address"],
    description: "Street address line 1",
  },
  {
    name: "city",
    dataType: "string",
    required: false,
    synonyms: ["city", "town", "locality"],
    semanticHints: ["address"],
    description: "City",
  },
  {
    name: "state",
    dataType: "string",
    required: false,
    synonyms: ["state", "province", "region", "state_code"],
    semanticHints: ["state"],
    description: "State / province",
  },
  {
    name: "zip",
    dataType: "string",
    required: false,
    synonyms: ["zip", "zip_code", "postal_code", "postcode", "postal"],
    semanticHints: ["zip"],
    description: "Postal code",
  },
  {
    name: "country",
    dataType: "string",
    required: false,
    synonyms: ["country", "country_code", "nation"],
    semanticHints: ["country"],
    description: "Country",
  },
  {
    name: "leadSource",
    dataType: "string",
    required: false,
    synonyms: ["source", "lead_source", "campaign", "origin", "referral"],
    semanticHints: [],
    description: "How the lead was acquired",
  },
  {
    name: "status",
    dataType: "enum",
    required: false,
    synonyms: ["status", "stage", "state", "lead_status"],
    semanticHints: ["status"],
    description: "Lead / contact status",
  },
  {
    name: "createdAt",
    dataType: "date",
    required: false,
    synonyms: ["created_at", "created", "date_created", "insert_time", "inserted_at", "added_at"],
    semanticHints: ["timestamp_created"],
    description: "Record creation timestamp",
  },
  {
    name: "updatedAt",
    dataType: "date",
    required: false,
    synonyms: ["updated_at", "updated", "date_updated", "modified_at", "last_modified", "changed_at"],
    semanticHints: ["timestamp_updated"],
    description: "Record last-modified timestamp",
  },
];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CrmFieldMatch {
  canonicalField: string;        // canonical field name (e.g. "email")
  sourceField: string;           // original field name on the source
  normalizedSource: string;      // snake_case source name
  confidence: number;            // 0..1
  matchMethod: "synonym_exact" | "synonym_partial" | "semantic_hint" | "value_pattern" | "type_hint";
  dataType: CanonicalField["dataType"];
  required: boolean;
}

export interface CrmMappingResult {
  entityType: CrmEntityType;
  matches: CrmFieldMatch[];
  unmappedSourceFields: string[];         // source fields that didn't match any canonical
  unmappedCanonicalFields: string[];      // canonical fields with no source counterpart
  missingRequired: string[];              // required canonical fields with no source match
  confidence: number;                     // overall mapping confidence
}

// ─── Scoring ───────────────────────────────────────────────────────────────

function scoreSynonymMatch(sourceName: string, canonical: CanonicalField): { score: number; method: CrmFieldMatch["matchMethod"] } {
  const lowered = sourceName.toLowerCase();
  for (const syn of canonical.synonyms) {
    const lsyn = syn.toLowerCase();
    if (lowered === lsyn) return { score: 1.0, method: "synonym_exact" };
  }
  for (const syn of canonical.synonyms) {
    const lsyn = syn.toLowerCase();
    if (lowered.includes(lsyn)) return { score: 0.85, method: "synonym_partial" };
    if (lsyn.includes(lowered) && lowered.length >= 3) return { score: 0.75, method: "synonym_partial" };
  }
  return { score: 0, method: "synonym_partial" };
}

function scoreSemanticMatch(field: InferredField, canonical: CanonicalField): number {
  if (canonical.semanticHints.length === 0) return 0;
  const fieldHintSet = new Set(field.semanticHints);
  for (const hint of canonical.semanticHints) {
    if (fieldHintSet.has(hint)) return 0.9;
  }
  return 0;
}

function scoreValuePattern(field: InferredField, canonical: CanonicalField): number {
  if (!canonical.valuePattern) return 0;
  for (const ex of field.examples) {
    if (canonical.valuePattern.test(ex)) return 0.88;
  }
  return 0;
}

function scoreTypeMatch(field: InferredField, canonical: CanonicalField): number {
  // Type conversion map
  const matches: Record<CanonicalField["dataType"], string[]> = {
    string: ["string"],
    email: ["email"],
    phone: ["phone"],
    url: ["url"],
    number: ["number", "integer"],
    currency: ["currency", "number", "integer"],
    date: ["date", "datetime", "timestamp"],
    boolean: ["boolean"],
    enum: ["string"],
  };
  if (matches[canonical.dataType].includes(field.type)) return 0.3;
  return 0;
}

function scoreMatch(field: InferredField, canonical: CanonicalField): { score: number; method: CrmFieldMatch["matchMethod"] } {
  const synonymResult = scoreSynonymMatch(field.normalizedName, canonical);
  const semanticScore = scoreSemanticMatch(field, canonical);
  const valuePatternScore = scoreValuePattern(field, canonical);
  const typeScore = scoreTypeMatch(field, canonical);

  // Best of: synonym, semantic, value pattern; tiebreak with type alignment bonus
  const scores: Array<{ score: number; method: CrmFieldMatch["matchMethod"] }> = [];
  if (synonymResult.score > 0) scores.push(synonymResult);
  if (semanticScore > 0) scores.push({ score: semanticScore, method: "semantic_hint" });
  if (valuePatternScore > 0) scores.push({ score: valuePatternScore, method: "value_pattern" });

  if (scores.length === 0 && typeScore > 0) {
    return { score: typeScore, method: "type_hint" };
  }
  if (scores.length === 0) return { score: 0, method: "synonym_partial" };

  // Pick the highest, add a small type-alignment bonus (max 1.0)
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const boosted = Math.min(1, best.score + typeScore * 0.15);
  return { score: boosted, method: best.method };
}

// ─── Main entry point ────────────────────────────────────────────────────

/**
 * Map an inferred schema onto the canonical CRM contact shape. Returns
 * per-field matches with confidence, plus lists of unmapped fields on both
 * sides and any required canonical fields that had no match.
 */
export function mapToCanonicalContact(schema: InferredSchema): CrmMappingResult {
  return mapToCanonical(schema, "contact", CANONICAL_CONTACT_FIELDS);
}

export function mapToCanonical(
  schema: InferredSchema,
  entityType: CrmEntityType,
  canonicalFields: CanonicalField[]
): CrmMappingResult {
  const matches: CrmFieldMatch[] = [];
  const usedCanonicalFields = new Set<string>();
  const usedSourceFields = new Set<string>();

  // For each canonical field, find the best matching source field
  // (greedy: highest-confidence matches win first)
  const allPairs: Array<{
    field: InferredField;
    canonical: CanonicalField;
    score: number;
    method: CrmFieldMatch["matchMethod"];
  }> = [];

  for (const canonical of canonicalFields) {
    for (const field of schema.fields) {
      const { score, method } = scoreMatch(field, canonical);
      // Threshold: type-only matches (0.3) are too weak to be reliable.
      // Require at least synonym/semantic/value-pattern contribution.
      if (score >= 0.5) {
        allPairs.push({ field, canonical, score, method });
      }
    }
  }

  // Sort by score descending, then consume greedily
  allPairs.sort((a, b) => b.score - a.score);
  for (const pair of allPairs) {
    if (usedCanonicalFields.has(pair.canonical.name)) continue;
    if (usedSourceFields.has(pair.field.normalizedName)) continue;
    usedCanonicalFields.add(pair.canonical.name);
    usedSourceFields.add(pair.field.normalizedName);
    matches.push({
      canonicalField: pair.canonical.name,
      sourceField: pair.field.name,
      normalizedSource: pair.field.normalizedName,
      confidence: pair.score,
      matchMethod: pair.method,
      dataType: pair.canonical.dataType,
      required: pair.canonical.required,
    });
  }

  // Derive unmapped lists
  const unmappedSourceFields = schema.fields
    .filter((f) => !usedSourceFields.has(f.normalizedName))
    .map((f) => f.normalizedName);
  const unmappedCanonicalFields = canonicalFields
    .filter((c) => !usedCanonicalFields.has(c.name))
    .map((c) => c.name);
  const missingRequired = canonicalFields
    .filter((c) => c.required && !usedCanonicalFields.has(c.name))
    .map((c) => c.name);

  // Overall confidence: average of match confidences, weighted by required-field coverage
  const avgConfidence = matches.length > 0 ? matches.reduce((s, m) => s + m.confidence, 0) / matches.length : 0;
  const requiredFields = canonicalFields.filter((c) => c.required);
  const requiredCoverage =
    requiredFields.length === 0
      ? 1
      : 1 - missingRequired.length / requiredFields.length;
  const confidence = 0.6 * avgConfidence + 0.4 * requiredCoverage;

  return {
    entityType,
    matches,
    unmappedSourceFields,
    unmappedCanonicalFields,
    missingRequired,
    confidence,
  };
}

// ─── Summary ──────────────────────────────────────────────────────────────

export function summarizeMapping(result: CrmMappingResult): string {
  const parts: string[] = [];
  parts.push(`${result.entityType}`);
  parts.push(`${result.matches.length} mapped`);
  if (result.unmappedSourceFields.length > 0) parts.push(`${result.unmappedSourceFields.length} unmapped source`);
  if (result.missingRequired.length > 0) parts.push(`⚠ missing ${result.missingRequired.join(",")}`);
  parts.push(`conf=${Math.round(result.confidence * 100)}%`);
  return parts.join(" · ");
}
