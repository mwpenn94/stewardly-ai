/**
 * Universal Adapter DSL — Serialization + Validation
 *
 * Makes AdapterSpec objects portable across the system: store them in the
 * database, ship them between processes, version them, round-trip them
 * through JSON without field reorder drift, and validate untrusted input
 * before feeding it into the runtime.
 *
 * Key properties:
 *   - Stable canonical JSON (keys sorted, arrays preserved) → reproducible
 *     fingerprints regardless of insertion order
 *   - SHA256 fingerprint (Node crypto) → content-addressable storage
 *   - Defensive parser → accepts either a string or a parsed object,
 *     rejects obviously malformed structures, returns a list of validation
 *     errors so the caller can surface them
 *   - Semver bumper → callers can derive a new version when the schema
 *     changes without re-running the generator
 *
 * Pure-function module (except for the one crypto.createHash call). No I/O.
 */

import { createHash } from "crypto";
import type { AdapterSpec } from "./adapterGenerator";

// ─── Canonical JSON serialization ─────────────────────────────────────────

/**
 * Produce a deterministic JSON representation of an arbitrary value by
 * sorting object keys alphabetically at every level. Arrays preserve their
 * original order (order is semantic). Primitives pass through untouched.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonical(value));
}

function toCanonical(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(toCanonical);
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) out[k] = toCanonical(obj[k]);
  return out;
}

// ─── Fingerprint ──────────────────────────────────────────────────────────

/**
 * SHA256 fingerprint of the canonical JSON representation. Used for
 * content-addressable storage + idempotent upserts of adapter rows.
 */
export function fingerprintSpec(spec: AdapterSpec): string {
  const json = canonicalJson(spec);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Shorter fingerprint for UI/version strings (first 12 hex chars).
 */
export function shortFingerprint(spec: AdapterSpec): string {
  return fingerprintSpec(spec).slice(0, 12);
}

// ─── Serialization ────────────────────────────────────────────────────────

export interface SerializedSpec {
  dslVersion: 1;
  fingerprint: string;
  canonical: string;      // canonical JSON string (not re-parsed — preserves order)
  createdAt: number;
}

export function serializeSpec(spec: AdapterSpec): SerializedSpec {
  const canonical = canonicalJson(spec);
  const fingerprint = createHash("sha256").update(canonical, "utf8").digest("hex");
  return {
    dslVersion: 1,
    fingerprint,
    canonical,
    createdAt: Date.now(),
  };
}

// ─── Validation + parsing ────────────────────────────────────────────────

export interface ParseResult {
  spec: AdapterSpec | null;
  errors: string[];
  warnings: string[];
}

const REQUIRED_TOP_LEVEL_KEYS: Array<keyof AdapterSpec> = [
  "name",
  "version",
  "auth",
  "endpoints",
  "rateLimit",
  "fieldMappings",
  "readinessReport",
];

const VALID_AUTH_TYPES = new Set([
  "none",
  "api_key_header",
  "api_key_query",
  "bearer",
  "basic",
  "oauth2",
  "unknown",
]);

const VALID_DIRECTIONS = new Set([
  "read",
  "write",
  "both",
  "identifier",
  "derived",
  "skip",
]);

const VALID_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Parse a JSON string or already-parsed object into a validated AdapterSpec.
 * Returns errors (hard blocks) + warnings (soft issues) so the caller can
 * surface both in a UI form.
 */
export function parseSpec(input: string | unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return {
        spec: null,
        errors: [`Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`],
        warnings: [],
      };
    }
  } else {
    parsed = input;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { spec: null, errors: ["Spec must be an object"], warnings: [] };
  }

  const obj = parsed as Record<string, unknown>;

  // Check required keys
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in obj)) errors.push(`Missing required field: ${key}`);
  }

  // Validate name
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    errors.push("name must be a non-empty string");
  }

  // Validate auth
  if (obj.auth && typeof obj.auth === "object") {
    const auth = obj.auth as Record<string, unknown>;
    if (typeof auth.type !== "string" || !VALID_AUTH_TYPES.has(auth.type as string)) {
      errors.push(`auth.type must be one of: ${Array.from(VALID_AUTH_TYPES).join(", ")}`);
    }
    if (typeof auth.probeConfidence !== "number") {
      warnings.push("auth.probeConfidence should be a number");
    }
  }

  // Validate endpoints
  if (obj.endpoints && typeof obj.endpoints === "object") {
    const endpoints = obj.endpoints as Record<string, unknown>;
    for (const [key, ep] of Object.entries(endpoints)) {
      if (ep && typeof ep === "object") {
        const e = ep as Record<string, unknown>;
        if (typeof e.method !== "string" || !VALID_HTTP_METHODS.has(e.method as string)) {
          errors.push(`endpoints.${key}.method must be one of: ${Array.from(VALID_HTTP_METHODS).join(", ")}`);
        }
        if (typeof e.pathTemplate !== "string") {
          errors.push(`endpoints.${key}.pathTemplate must be a string`);
        }
      }
    }
    if (!endpoints.list) {
      warnings.push("No list endpoint defined — only single-record operations will be possible");
    }
  }

  // Validate fieldMappings
  if (!Array.isArray(obj.fieldMappings)) {
    errors.push("fieldMappings must be an array");
  } else {
    for (let i = 0; i < (obj.fieldMappings as unknown[]).length; i++) {
      const m = (obj.fieldMappings as unknown[])[i];
      if (!m || typeof m !== "object") {
        errors.push(`fieldMappings[${i}] must be an object`);
        continue;
      }
      const mm = m as Record<string, unknown>;
      if (typeof mm.canonicalName !== "string") errors.push(`fieldMappings[${i}].canonicalName required`);
      if (typeof mm.sourceName !== "string") errors.push(`fieldMappings[${i}].sourceName required`);
      if (typeof mm.direction !== "string" || !VALID_DIRECTIONS.has(mm.direction as string)) {
        errors.push(`fieldMappings[${i}].direction must be one of: ${Array.from(VALID_DIRECTIONS).join(", ")}`);
      }
    }
  }

  // Validate baseUrl format if present
  if (obj.baseUrl !== undefined && obj.baseUrl !== null) {
    if (typeof obj.baseUrl !== "string") {
      errors.push("baseUrl must be a string");
    } else if (!/^https?:\/\//.test(obj.baseUrl)) {
      warnings.push("baseUrl should start with http:// or https://");
    }
  }

  // Validate rateLimit
  if (obj.rateLimit && typeof obj.rateLimit === "object") {
    const rl = obj.rateLimit as Record<string, unknown>;
    if (rl.maxRetries !== undefined && typeof rl.maxRetries !== "number") {
      errors.push("rateLimit.maxRetries must be a number");
    }
    if (rl.requestsPerSecond !== undefined && typeof rl.requestsPerSecond !== "number") {
      errors.push("rateLimit.requestsPerSecond must be a number");
    }
  }

  // Validate readinessReport shape (not content — content depends on fresh regen)
  if (obj.readinessReport && typeof obj.readinessReport === "object") {
    const rr = obj.readinessReport as Record<string, unknown>;
    if (typeof rr.ready !== "boolean") errors.push("readinessReport.ready must be boolean");
  }

  if (errors.length > 0) {
    return { spec: null, errors, warnings };
  }

  return { spec: parsed as unknown as AdapterSpec, errors, warnings };
}

/**
 * Parse a SerializedSpec wrapper (as produced by serializeSpec). Verifies
 * fingerprint + DSL version + extracts the inner spec.
 */
export function parseSerialized(input: string | unknown): ParseResult {
  let parsed: unknown;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return {
        spec: null,
        errors: [`Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`],
        warnings: [],
      };
    }
  } else {
    parsed = input;
  }

  if (!parsed || typeof parsed !== "object") {
    return { spec: null, errors: ["SerializedSpec must be an object"], warnings: [] };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.dslVersion !== 1) {
    return {
      spec: null,
      errors: [`Unsupported DSL version: ${String(obj.dslVersion)} (expected 1)`],
      warnings: [],
    };
  }
  if (typeof obj.canonical !== "string") {
    return { spec: null, errors: ["SerializedSpec.canonical must be a string"], warnings: [] };
  }

  const innerResult = parseSpec(obj.canonical);
  if (!innerResult.spec) return innerResult;

  // Verify fingerprint
  const expectedFingerprint = createHash("sha256").update(obj.canonical, "utf8").digest("hex");
  if (obj.fingerprint !== expectedFingerprint) {
    innerResult.warnings.push(
      `Fingerprint mismatch: declared ${String(obj.fingerprint).slice(0, 12)}… vs computed ${expectedFingerprint.slice(0, 12)}…`,
    );
  }

  return innerResult;
}

// ─── Semver bumping ───────────────────────────────────────────────────────

/**
 * Bump the semver version of an AdapterSpec based on the kind of change.
 *  - breaking — major bump
 *  - additive — minor bump
 *  - fix — patch bump
 *
 * Works on the numeric prefix; ignores any -suffix fingerprint tail.
 */
export function bumpVersion(
  currentVersion: string,
  kind: "breaking" | "additive" | "fix",
): string {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) return `${kind === "breaking" ? "1" : "0"}.0.0`;
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  const suffix = match[4] || "";
  switch (kind) {
    case "breaking":
      major++;
      minor = 0;
      patch = 0;
      break;
    case "additive":
      minor++;
      patch = 0;
      break;
    case "fix":
      patch++;
      break;
  }
  return `${major}.${minor}.${patch}${suffix}`;
}
