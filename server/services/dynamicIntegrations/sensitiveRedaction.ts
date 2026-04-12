/**
 * Sensitive Data Redaction for Dynamic Integrations
 *
 * Sample records flowing through infer_schema / CRM mapping / cross-model
 * distillation can contain highly sensitive content: SSNs, credit card
 * numbers, bank account numbers, API keys, bearer tokens, passwords,
 * private keys. This module redacts them BEFORE records are:
 *
 *   - logged to audit trails
 *   - sent to LLMs for enrichment
 *   - stored as training examples via crossModelDistillation
 *   - exported via serializeSpec for cross-system portability
 *
 * Two-phase approach:
 *   1. Field-name matcher: if the field name looks like a secret (e.g.
 *      password, api_key, secret_key), redact unconditionally
 *   2. Value-pattern matcher: even on unlabeled fields, detect obvious
 *      high-risk patterns (credit card numbers, SSNs, PEM keys,
 *      Authorization: Bearer headers embedded in text)
 *
 * Redaction strategies:
 *   - "mask": replace with `****` (lossy, no recovery)
 *   - "tokenize": replace with a stable `[REDACTED_${type}_${n}]` token
 *     so multiple occurrences of the same value map to the same token
 *     (useful for inference without leaking the actual value)
 *   - "nullify": replace with null
 *
 * Pure-function module. No I/O. Every test runs in memory.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type RedactionStrategy = "mask" | "tokenize" | "nullify";

export type SensitiveCategory =
  | "ssn"
  | "credit_card"
  | "bank_account"
  | "api_key"
  | "bearer_token"
  | "password"
  | "private_key"
  | "jwt"
  | "iban"
  | "passport"
  | "drivers_license";

export interface RedactionRule {
  category: SensitiveCategory;
  // Field name substring patterns (lowered, snake-case)
  fieldNames?: RegExp[];
  // Value regex patterns
  valuePatterns?: RegExp[];
  // Strategy override (defaults to config.strategy)
  strategy?: RedactionStrategy;
}

export interface RedactionConfig {
  strategy?: RedactionStrategy;      // default "mask"
  customRules?: RedactionRule[];      // appended to defaults
  preserveLastN?: number;             // for mask strategy, preserve last N chars (default 4)
  includeDefaults?: boolean;          // default true
}

export interface RedactionReport {
  redactedCount: number;
  byCategory: Record<SensitiveCategory, number>;
  fields: string[];                   // field names that were redacted at least once
}

// ─── Default rules ────────────────────────────────────────────────────────

const DEFAULT_RULES: RedactionRule[] = [
  {
    category: "ssn",
    fieldNames: [/ssn|social_security/],
    valuePatterns: [/\b\d{3}-?\d{2}-?\d{4}\b/],
  },
  {
    category: "credit_card",
    fieldNames: [/card_number|credit_card|cc_num|payment_card/],
    // Basic Luhn-looking 15-19 digit with optional spaces/dashes
    valuePatterns: [/\b(?:\d[ -]*?){13,19}\b/],
  },
  {
    category: "bank_account",
    fieldNames: [/routing|account_number|bank_account|iban|aba/],
    valuePatterns: [
      /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/, // IBAN
      /\b\d{9}\b/, // US routing number (heuristic — 9 digits alone)
    ],
  },
  {
    category: "api_key",
    fieldNames: [/api_key|apikey|api_secret|access_key|consumer_key|consumer_secret/],
    // Long uppercase/lowercase/digit token (20+ chars no spaces)
    valuePatterns: [/^[A-Za-z0-9_\-]{24,}$/],
  },
  {
    category: "bearer_token",
    fieldNames: [/bearer_token|access_token|auth_token|id_token/],
    valuePatterns: [/^Bearer\s+[A-Za-z0-9._\-]{20,}$/i],
  },
  {
    category: "password",
    fieldNames: [/password|passwd|pass_hash|secret/],
    // Passwords don't have a reliable regex pattern
  },
  {
    category: "private_key",
    fieldNames: [/private_key|rsa_private/],
    valuePatterns: [/-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  },
  {
    category: "jwt",
    fieldNames: [/jwt/],
    // JWT format: three base64url-encoded segments separated by dots
    valuePatterns: [/^eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}$/],
  },
  {
    category: "iban",
    fieldNames: [/iban/],
    valuePatterns: [/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/],
  },
  {
    category: "passport",
    fieldNames: [/passport/],
  },
  {
    category: "drivers_license",
    fieldNames: [/drivers_license|dl_number|license_number/],
  },
];

// ─── Core redaction ──────────────────────────────────────────────────────

function maskValue(value: unknown, preserveLastN: number): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (preserveLastN <= 0) return "*".repeat(str.length);
  if (str.length <= preserveLastN) return "*".repeat(str.length);
  return "*".repeat(str.length - preserveLastN) + str.slice(-preserveLastN);
}

function tokenizeValue(
  category: SensitiveCategory,
  value: unknown,
  tokenMap: Map<string, string>,
): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const key = `${category}::${str}`;
  const existing = tokenMap.get(key);
  if (existing) return existing;
  const token = `[REDACTED_${category.toUpperCase()}_${tokenMap.size + 1}]`;
  tokenMap.set(key, token);
  return token;
}

function applyStrategy(
  value: unknown,
  strategy: RedactionStrategy,
  category: SensitiveCategory,
  config: Required<Pick<RedactionConfig, "preserveLastN">>,
  tokenMap: Map<string, string>,
): unknown {
  if (value === null || value === undefined) return value;
  switch (strategy) {
    case "nullify":
      return null;
    case "tokenize":
      return tokenizeValue(category, value, tokenMap);
    case "mask":
    default:
      return maskValue(value, config.preserveLastN);
  }
}

function findMatchingRule(
  fieldName: string,
  value: unknown,
  rules: RedactionRule[],
): RedactionRule | null {
  const normalizedName = fieldName.toLowerCase();
  // First pass: field-name match
  for (const rule of rules) {
    if (rule.fieldNames) {
      for (const re of rule.fieldNames) {
        if (re.test(normalizedName)) return rule;
      }
    }
  }
  // Second pass: value-pattern match (only for strings)
  if (typeof value === "string") {
    for (const rule of rules) {
      if (rule.valuePatterns) {
        for (const re of rule.valuePatterns) {
          if (re.test(value)) return rule;
        }
      }
    }
  }
  return null;
}

// ─── Main entry points ────────────────────────────────────────────────────

/**
 * Redact sensitive values from a single record. Returns a new record +
 * a report of what was redacted.
 */
export function redactRecord(
  record: Record<string, unknown>,
  config: RedactionConfig = {},
  tokenMap: Map<string, string> = new Map(),
): { record: Record<string, unknown>; report: RedactionReport } {
  const strategy = config.strategy ?? "mask";
  const preserveLastN = config.preserveLastN ?? 4;
  const rules = [
    ...(config.includeDefaults !== false ? DEFAULT_RULES : []),
    ...(config.customRules ?? []),
  ];

  const out: Record<string, unknown> = {};
  const report: RedactionReport = {
    redactedCount: 0,
    byCategory: {
      ssn: 0,
      credit_card: 0,
      bank_account: 0,
      api_key: 0,
      bearer_token: 0,
      password: 0,
      private_key: 0,
      jwt: 0,
      iban: 0,
      passport: 0,
      drivers_license: 0,
    },
    fields: [],
  };

  for (const [key, value] of Object.entries(record)) {
    const rule = findMatchingRule(key, value, rules);
    if (rule) {
      const effectiveStrategy = rule.strategy ?? strategy;
      out[key] = applyStrategy(
        value,
        effectiveStrategy,
        rule.category,
        { preserveLastN },
        tokenMap,
      );
      report.redactedCount++;
      report.byCategory[rule.category]++;
      if (!report.fields.includes(key)) report.fields.push(key);
    } else {
      out[key] = value;
    }
  }

  return { record: out, report };
}

/**
 * Redact an array of records. Share a tokenMap across records so the
 * same sensitive value maps to the same token across the whole batch
 * (critical for referential-integrity tokenization).
 */
export function redactRecords(
  records: Array<Record<string, unknown>>,
  config: RedactionConfig = {},
): { records: Array<Record<string, unknown>>; report: RedactionReport } {
  const tokenMap = new Map<string, string>();
  const aggregateReport: RedactionReport = {
    redactedCount: 0,
    byCategory: {
      ssn: 0,
      credit_card: 0,
      bank_account: 0,
      api_key: 0,
      bearer_token: 0,
      password: 0,
      private_key: 0,
      jwt: 0,
      iban: 0,
      passport: 0,
      drivers_license: 0,
    },
    fields: [],
  };
  const out: Array<Record<string, unknown>> = [];
  for (const rec of records) {
    const { record, report } = redactRecord(rec, config, tokenMap);
    out.push(record);
    aggregateReport.redactedCount += report.redactedCount;
    for (const cat of Object.keys(aggregateReport.byCategory) as SensitiveCategory[]) {
      aggregateReport.byCategory[cat] += report.byCategory[cat];
    }
    for (const field of report.fields) {
      if (!aggregateReport.fields.includes(field)) aggregateReport.fields.push(field);
    }
  }
  return { records: out, report: aggregateReport };
}

/**
 * One-line summary of a redaction report for logs / audit trail.
 */
export function summarizeRedaction(report: RedactionReport): string {
  if (report.redactedCount === 0) return "No sensitive data detected";
  const parts: string[] = [`${report.redactedCount} redacted`];
  for (const [cat, count] of Object.entries(report.byCategory)) {
    if (count > 0) parts.push(`${cat}=${count}`);
  }
  parts.push(`fields=[${report.fields.slice(0, 5).join(",")}]`);
  return parts.join(" · ");
}
