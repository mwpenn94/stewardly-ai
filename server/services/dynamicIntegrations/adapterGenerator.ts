/**
 * Dynamic CRUD Adapter Generator
 *
 * Given an InferredSchema (from schemaInference.ts) plus optional connection
 * hints (endpoint URL, auth style, sample request body), produce a declarative
 * AdapterSpec that describes how to perform every CRUD operation against the
 * source. The AdapterSpec is the "universal DSL" that the DataIngestion
 * orchestrator can execute without bespoke integration code per source.
 *
 * Pure-function module. No I/O. No network. Every input is explicit.
 *
 * Design goals:
 *   1. Run on zero-docs sources — produce a best-guess spec from schema alone.
 *   2. Accept progressive improvements — each additional hint refines the spec.
 *   3. Emit a full readiness report so the caller knows what's missing.
 *   4. Emit example curl commands for human verification.
 */

import type { InferredSchema, InferredField, SemanticHint, ExtendedInferredSchema } from "./schemaInference";
import { toInferredField } from "./schemaInference";

// ─── Types ─────────────────────────────────────────────────────────────────

export type AdapterAuthType = "none" | "api_key_header" | "api_key_query" | "bearer" | "basic" | "oauth2" | "unknown";

export interface AdapterAuthSpec {
  type: AdapterAuthType;
  headerName?: string;          // for api_key_header
  queryParam?: string;          // for api_key_query
  tokenUrl?: string;            // for oauth2
  scopes?: string[];            // for oauth2
  probeConfidence: number;      // 0..1
  notes: string[];              // what the generator detected vs guessed
}

export interface AdapterEndpointSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathTemplate: string;         // e.g. "/users/{id}" or "/users"
  queryParams?: Record<string, string>;
  bodyShape?: "json" | "form" | "none";
  responseRecordPath?: string;  // JSON path to the array of records (e.g. "data", "items", "results")
  pagination?: AdapterPaginationSpec;
  successStatus?: number;
}

export interface AdapterPaginationSpec {
  style: "offset" | "cursor" | "page" | "link_header" | "none";
  offsetParam?: string;
  limitParam?: string;
  pageParam?: string;
  cursorParam?: string;
  cursorPath?: string;          // JSON path inside response for next cursor
  maxPageSize?: number;
}

export interface AdapterRateLimitSpec {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  burstBudget?: number;
  retryAfterHeader?: string;    // e.g. "Retry-After"
  backoffStrategy: "exponential" | "linear" | "fixed";
  maxRetries: number;
}

export interface AdapterFieldMapping {
  canonicalName: string;        // stewardly-side field name
  sourceName: string;           // third-party field name (original)
  direction: "read" | "write" | "both" | "identifier" | "derived" | "skip";
  transform?: "parse_date" | "parse_currency" | "parse_percent" | "string" | "number" | "boolean" | "json_stringify";
  required: boolean;
  confidence: number;
  hints: SemanticHint[];
}

export interface AdapterSpec {
  name: string;
  version: string;              // semver; bumped by the generator when schema changes
  baseUrl?: string;
  auth: AdapterAuthSpec;
  endpoints: {
    list?: AdapterEndpointSpec;
    get?: AdapterEndpointSpec;
    create?: AdapterEndpointSpec;
    update?: AdapterEndpointSpec;
    delete?: AdapterEndpointSpec;
  };
  rateLimit: AdapterRateLimitSpec;
  fieldMappings: AdapterFieldMapping[];
  primaryKey: string | null;
  timestampField: string | null;
  confidence: number;           // overall spec confidence
  readinessReport: ReadinessReport;
}

export interface ReadinessReport {
  ready: boolean;               // true if the spec is executable as-is
  missingRequired: string[];    // things the caller must provide before it can run
  suggestedUserActions: string[]; // things the caller should consider
  warnings: string[];
}

export interface GenerateAdapterOptions {
  name: string;
  baseUrl?: string;
  authHint?: {
    type?: AdapterAuthType;
    headerName?: string;
    queryParam?: string;
  };
  listEndpoint?: string;        // path (not full URL) for the list endpoint
  collectionPath?: string;      // JSON path where records live in list response
  paginationHint?: Partial<AdapterPaginationSpec>;
  rateLimitHint?: Partial<AdapterRateLimitSpec>;
  sampleListResponse?: unknown; // actual response JSON for probe
}

// ─── Auth probe ────────────────────────────────────────────────────────────

/**
 * Probe an optional sample response for auth clues. If no probe data is
 * available, return best-guess `unknown` auth with a suggestion list.
 */
export function probeAuth(
  sampleHeaders?: Record<string, string>,
  hint?: GenerateAdapterOptions["authHint"]
): AdapterAuthSpec {
  // Explicit hint wins
  if (hint?.type && hint.type !== "unknown") {
    const spec: AdapterAuthSpec = {
      type: hint.type,
      probeConfidence: 1,
      notes: [`User-provided auth type: ${hint.type}`],
    };
    if (hint.headerName) spec.headerName = hint.headerName;
    if (hint.queryParam) spec.queryParam = hint.queryParam;
    return spec;
  }

  const notes: string[] = [];
  // Look at response headers for clues
  if (sampleHeaders) {
    const lowerHeaders = Object.fromEntries(
      Object.entries(sampleHeaders).map(([k, v]) => [k.toLowerCase(), v])
    );
    if (lowerHeaders["www-authenticate"]) {
      const val = lowerHeaders["www-authenticate"].toLowerCase();
      if (val.startsWith("bearer")) {
        return {
          type: "bearer",
          probeConfidence: 0.85,
          notes: ["Detected Bearer auth from WWW-Authenticate header"],
        };
      }
      if (val.startsWith("basic")) {
        return {
          type: "basic",
          probeConfidence: 0.85,
          notes: ["Detected Basic auth from WWW-Authenticate header"],
        };
      }
    }
    if (lowerHeaders["x-ratelimit-limit"] || lowerHeaders["x-api-version"]) {
      notes.push("Source looks API-like but auth style not detectable — try api_key_header");
    }
  }

  return {
    type: "unknown",
    probeConfidence: 0,
    notes: [
      "Auth type could not be detected automatically.",
      "Try: bearer (most modern APIs), api_key_header (with X-API-Key), or oauth2.",
      ...notes,
    ],
  };
}

// ─── Pagination probe ──────────────────────────────────────────────────────

/**
 * Given a sample list response body, detect pagination style.
 *
 * Supported styles:
 *   - `offset` — offset=N&limit=M
 *   - `page`   — page=N&per_page=M
 *   - `cursor` — returns next_cursor/next_page_token/nextToken
 *   - `link_header` — Link: <url>; rel="next" (needs sampleHeaders)
 *   - `none`
 */
export function probePagination(
  body: unknown,
  sampleHeaders?: Record<string, string>,
  hint?: Partial<AdapterPaginationSpec>
): AdapterPaginationSpec {
  if (hint?.style) {
    return { style: "none", ...hint } as AdapterPaginationSpec;
  }

  // Link header pagination
  if (sampleHeaders) {
    const linkHeader = Object.entries(sampleHeaders).find(([k]) => k.toLowerCase() === "link")?.[1];
    if (linkHeader && /rel="next"/.test(linkHeader)) {
      return { style: "link_header", maxPageSize: 100 };
    }
  }

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const keys = Object.keys(obj).map((k) => k.toLowerCase());
    // Cursor-style keys
    for (const cursorKey of ["next_cursor", "nextcursor", "next_page_token", "nextpagetoken", "next_token", "nexttoken", "cursor", "next"]) {
      if (keys.includes(cursorKey)) {
        return {
          style: "cursor",
          cursorParam: "cursor",
          cursorPath: cursorKey,
          maxPageSize: 100,
        };
      }
    }
    // Offset-style
    if (keys.includes("offset") && keys.includes("limit")) {
      return {
        style: "offset",
        offsetParam: "offset",
        limitParam: "limit",
        maxPageSize: 100,
      };
    }
    // Page-style
    if (keys.includes("page") || keys.includes("current_page")) {
      return {
        style: "page",
        pageParam: "page",
        limitParam: keys.includes("per_page") ? "per_page" : "limit",
        maxPageSize: 100,
      };
    }
    // Total-count-only (offset fallback)
    if (keys.includes("total") || keys.includes("total_count") || keys.includes("count")) {
      return {
        style: "offset",
        offsetParam: "offset",
        limitParam: "limit",
        maxPageSize: 100,
      };
    }
  }

  return { style: "none" };
}

// ─── Collection path detection ─────────────────────────────────────────────

/**
 * Detect where in the response body the records live. Most APIs wrap the
 * array under a key like `data`, `items`, `results`, `records`, or at the
 * root of the response.
 */
export function detectCollectionPath(body: unknown): string {
  if (Array.isArray(body)) return ""; // root array
  if (!body || typeof body !== "object") return "";
  const obj = body as Record<string, unknown>;
  const preferredKeys = ["data", "items", "results", "records", "rows", "entries", "hits", "values"];
  for (const key of preferredKeys) {
    if (Array.isArray(obj[key])) return key;
  }
  // Fallback: first array field
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return k;
  }
  return "";
}

// ─── Field mapping ─────────────────────────────────────────────────────────

function mapTransform(field: InferredField): AdapterFieldMapping["transform"] {
  const t = field.type as string;
  switch (t) {
    case "date":
    case "datetime":
    case "timestamp":
      return "parse_date";
    case "currency":
      return "parse_currency";
    case "percentage":
      return "parse_percent";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
    case "array":
      return "json_stringify";
    default:
      return "string";
  }
}

function mapDirection(field: InferredField): AdapterFieldMapping["direction"] {
  if (field.semanticHints.includes("timestamp_created") || field.semanticHints.includes("timestamp_updated")) return "derived";
  if (field.isPrimaryKeyCandidate) return "identifier";
  if (field.type === "mixed") return "skip";
  if (field.sampleCount === 0) return "skip";
  if (field.isReadOnlySuggested) return "read";
  return "both";
}

export function generateFieldMappings(schema: InferredSchema): AdapterFieldMapping[] {
  return schema.fields.map(toInferredField).map((f) => ({
    canonicalName: f.normalizedName,
    sourceName: f.name,
    direction: mapDirection(f),
    transform: mapTransform(f),
    required: f.isRequiredSuggested ?? false,
    confidence: f.confidence,
    hints: f.semanticHints ?? [],
  }));
}

// ─── Full adapter generation ───────────────────────────────────────────────

/**
 * Main entry point: given an inferred schema + options, produce the
 * full AdapterSpec.
 */
export function generateAdapter(
  schema: InferredSchema,
  options: GenerateAdapterOptions
): AdapterSpec {
  const auth = probeAuth(undefined, options.authHint);
  const collectionPath = options.collectionPath ?? detectCollectionPath(options.sampleListResponse);
  const pagination = probePagination(options.sampleListResponse, undefined, options.paginationHint);
  const fieldMappings = generateFieldMappings(schema);

  // Derive list endpoint path
  const listPath = options.listEndpoint || "/";

  // Derive get endpoint if PK known
  const pk = schema.primaryKey;
  const getPath = pk ? `${listPath.replace(/\/$/, "")}/{${pk}}` : undefined;

  const endpoints: AdapterSpec["endpoints"] = {};
  endpoints.list = {
    method: "GET",
    pathTemplate: listPath,
    responseRecordPath: collectionPath,
    pagination,
    successStatus: 200,
  };
  if (getPath) {
    endpoints.get = {
      method: "GET",
      pathTemplate: getPath,
      successStatus: 200,
    };
    endpoints.update = {
      method: "PATCH",
      pathTemplate: getPath,
      bodyShape: "json",
      successStatus: 200,
    };
    endpoints.delete = {
      method: "DELETE",
      pathTemplate: getPath,
      successStatus: 204,
    };
  }
  endpoints.create = {
    method: "POST",
    pathTemplate: listPath,
    bodyShape: "json",
    successStatus: 201,
  };

  const rateLimit: AdapterRateLimitSpec = {
    requestsPerSecond: options.rateLimitHint?.requestsPerSecond ?? 5,
    requestsPerMinute: options.rateLimitHint?.requestsPerMinute ?? 60,
    burstBudget: options.rateLimitHint?.burstBudget ?? 10,
    retryAfterHeader: options.rateLimitHint?.retryAfterHeader ?? "Retry-After",
    backoffStrategy: options.rateLimitHint?.backoffStrategy ?? "exponential",
    maxRetries: options.rateLimitHint?.maxRetries ?? 3,
  };

  const readiness = buildReadinessReport({
    hasBaseUrl: Boolean(options.baseUrl),
    authType: auth.type,
    hasPrimaryKey: Boolean(pk),
    hasListPath: Boolean(options.listEndpoint),
    hasCollectionPath: Boolean(collectionPath) || Array.isArray(options.sampleListResponse),
    hasPaginationProbe: Boolean(options.sampleListResponse) || Boolean(options.paginationHint),
    writableFieldCount: fieldMappings.filter((m) => m.direction === "both").length,
  });

  // Weighted confidence: combine schema confidence + auth probe + readiness
  const readyBonus = readiness.ready ? 0.1 : 0;
  const confidence = Math.max(
    0,
    Math.min(1, 0.5 * (schema.confidence ?? 0) + 0.3 * auth.probeConfidence + 0.1 + readyBonus)
  );

  // Version derivation: short schema fingerprint
  const version = `0.1.0-${fingerprintSchema(schema)}`;

  return {
    name: options.name,
    version,
    baseUrl: options.baseUrl,
    auth,
    endpoints,
    rateLimit,
    fieldMappings,
    primaryKey: pk ?? null,
    timestampField: schema.timestampField ?? null,
    confidence,
    readinessReport: readiness,
  };
}

// ─── Readiness report ──────────────────────────────────────────────────────

function buildReadinessReport(input: {
  hasBaseUrl: boolean;
  authType: AdapterAuthType;
  hasPrimaryKey: boolean;
  hasListPath: boolean;
  hasCollectionPath: boolean;
  hasPaginationProbe: boolean;
  writableFieldCount: number;
}): ReadinessReport {
  const missingRequired: string[] = [];
  const suggestedUserActions: string[] = [];
  const warnings: string[] = [];

  if (!input.hasBaseUrl) missingRequired.push("baseUrl");
  if (input.authType === "unknown") missingRequired.push("auth.type");
  if (!input.hasListPath) suggestedUserActions.push("Provide listEndpoint path (defaulted to '/')");
  if (!input.hasCollectionPath) suggestedUserActions.push("Provide a sample response to detect where records live (collectionPath)");
  if (!input.hasPaginationProbe) suggestedUserActions.push("Provide a sample response or explicit pagination hint");
  if (!input.hasPrimaryKey) {
    warnings.push("No primary key detected — get/update/delete endpoints will be disabled until PK is assigned");
  }
  if (input.writableFieldCount === 0) {
    warnings.push("No writable fields detected — this adapter is read-only");
  }

  return {
    ready: missingRequired.length === 0,
    missingRequired,
    suggestedUserActions,
    warnings,
  };
}

// ─── Utility: schema fingerprint ───────────────────────────────────────────

function fingerprintSchema(schema: InferredSchema): string {
  const parts = schema.fields.map((f) => `${(f as any).normalizedName ?? f.path}:${f.type}`).sort();
  let hash = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ─── Example curl generation ──────────────────────────────────────────────

/**
 * Produce example curl commands for each endpoint, useful for humans
 * to verify the spec before wiring it into the orchestrator.
 */
export function buildCurlExamples(spec: AdapterSpec): Record<string, string> {
  const out: Record<string, string> = {};
  const base = spec.baseUrl || "https://api.example.com";
  const authHeader = buildAuthHeader(spec.auth);

  for (const [key, ep] of Object.entries(spec.endpoints)) {
    if (!ep) continue;
    const url = `${base}${ep.pathTemplate.replace(/\{(\w+)\}/g, "<$1>")}`;
    const headers = [authHeader, ep.bodyShape === "json" ? `-H "Content-Type: application/json"` : null]
      .filter(Boolean)
      .join(" ");
    const data = ep.bodyShape === "json" ? ` -d '{"field":"value"}'` : "";
    out[key] = `curl -X ${ep.method} ${headers} "${url}"${data}`.trim();
  }
  return out;
}

function buildAuthHeader(auth: AdapterAuthSpec): string {
  switch (auth.type) {
    case "bearer":
      return `-H "Authorization: Bearer $TOKEN"`;
    case "api_key_header":
      return `-H "${auth.headerName || "X-API-Key"}: $API_KEY"`;
    case "api_key_query":
      return `# api key goes in query param: ?${auth.queryParam || "api_key"}=$API_KEY`;
    case "basic":
      return `-u "$USERNAME:$PASSWORD"`;
    case "oauth2":
      return `-H "Authorization: Bearer $OAUTH_TOKEN"`;
    case "none":
      return "";
    default:
      return `# auth unknown — add appropriate header`;
  }
}

/**
 * Summarize an adapter spec in one line for the Code Chat tool / UI badge.
 */
export function summarizeAdapter(spec: AdapterSpec): string {
  const parts: string[] = [];
  parts.push(spec.name);
  parts.push(`auth=${spec.auth.type}`);
  parts.push(`pk=${spec.primaryKey || "—"}`);
  const eps = Object.keys(spec.endpoints).length;
  parts.push(`${eps} endpoints`);
  parts.push(`conf=${Math.round(spec.confidence * 100)}%`);
  if (!spec.readinessReport.ready) parts.push(`⚠ ${spec.readinessReport.missingRequired.length} missing`);
  return parts.join(" · ");
}
