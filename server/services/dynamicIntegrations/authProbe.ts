/**
 * Authentication Shape Probe
 *
 * Pass 2's probeAuth only honors user hints and reads a single WWW-Authenticate
 * header. This module does deeper forensics: examine HTTP status codes +
 * response bodies + multiple header signals to pick the right auth style
 * when a third-party source has no documentation.
 *
 * Detection signals (ranked by confidence):
 *   1. WWW-Authenticate header (explicit)        — confidence 0.95
 *   2. 401 + specific error body keywords        — confidence 0.85
 *   3. Header naming conventions (X-API-Key etc) — confidence 0.80
 *   4. OAuth discovery endpoint presence         — confidence 0.78
 *   5. 403 with Bearer-expected body             — confidence 0.75
 *   6. Query param rejection in error body       — confidence 0.70
 *   7. Generic 401/403 → default guess           — confidence 0.40
 *
 * Pure-function module. No HTTP. Callers pass sample request/response
 * data they already collected.
 */

import type { AdapterAuthSpec, AdapterAuthType } from "./adapterGenerator";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthProbeSignal {
  type: AdapterAuthType;
  confidence: number;
  reason: string;
  headerName?: string;
  queryParam?: string;
}

export interface SampleResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  url?: string;
}

export interface ProbeAuthDeepOptions {
  samples: SampleResponse[];              // responses from calling the endpoint without auth
  endpointsTried?: string[];              // optional list of endpoint paths tried
  userHint?: Partial<AdapterAuthSpec>;    // caller-provided hint takes precedence if set
}

// ─── Signal detectors (pure) ───────────────────────────────────────────────

const BEARER_KEYWORDS = [
  /bearer\s+token/i,
  /missing\s+access\s+token/i,
  /invalid\s+access\s+token/i,
  /token\s+(required|missing)/i,
  /jwt/i,
];

const API_KEY_KEYWORDS = [
  /api[-_\s]?key/i,
  /missing\s+api\s+key/i,
  /invalid\s+api\s+key/i,
  /x-api-key/i,
  /x-[a-z0-9]+-key/i, // X-Custom-Key, X-Tenant-Key, etc
];

const BASIC_KEYWORDS = [
  /basic\s+authentication/i,
  /basic\s+auth/i,
  /username\s+and\s+password/i,
  /http\s+basic/i,
];

const OAUTH_KEYWORDS = [
  /oauth[12]/i,
  /scope\s+(required|missing)/i,
  /client_credentials/i,
  /authorization[_\s]+code/i,
];

/**
 * Extract searchable text from a response body for keyword matching.
 */
function bodyToText(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  if (typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {
      return "";
    }
  }
  return String(body);
}

function matchAny(patterns: RegExp[], text: string): boolean {
  for (const p of patterns) if (p.test(text)) return true;
  return false;
}

function lowerHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = String(v);
  }
  return out;
}

// ─── Individual signal detectors ──────────────────────────────────────────

function detectFromWwwAuthenticate(sample: SampleResponse): AuthProbeSignal | null {
  const headers = lowerHeaders(sample.headers);
  const val = headers["www-authenticate"];
  if (!val) return null;
  const lower = val.toLowerCase();
  if (lower.startsWith("bearer")) {
    return { type: "bearer", confidence: 0.95, reason: "WWW-Authenticate: Bearer" };
  }
  if (lower.startsWith("basic")) {
    return { type: "basic", confidence: 0.95, reason: "WWW-Authenticate: Basic" };
  }
  if (lower.includes("oauth")) {
    return { type: "oauth2", confidence: 0.9, reason: "WWW-Authenticate mentions OAuth" };
  }
  return null;
}

function detectFromErrorBody(sample: SampleResponse): AuthProbeSignal | null {
  if (sample.status !== 401 && sample.status !== 403 && sample.status !== 422) return null;
  const text = bodyToText(sample.body);
  if (!text) return null;

  if (matchAny(BEARER_KEYWORDS, text)) {
    return {
      type: "bearer",
      confidence: 0.85,
      reason: `${sample.status} body mentions bearer/JWT token`,
    };
  }
  if (matchAny(API_KEY_KEYWORDS, text)) {
    const headerName = extractApiKeyHeaderName(text) || "X-API-Key";
    return {
      type: "api_key_header",
      confidence: 0.85,
      reason: `${sample.status} body mentions API key`,
      headerName,
    };
  }
  if (matchAny(BASIC_KEYWORDS, text)) {
    return {
      type: "basic",
      confidence: 0.82,
      reason: `${sample.status} body mentions basic auth`,
    };
  }
  if (matchAny(OAUTH_KEYWORDS, text)) {
    return {
      type: "oauth2",
      confidence: 0.8,
      reason: `${sample.status} body mentions OAuth2 scope/flow`,
    };
  }
  return null;
}

function extractApiKeyHeaderName(text: string): string | null {
  // Look for "X-Foo-Key" or "Authorization: X" style hints in error body
  const match = text.match(/([Xx]-[A-Za-z0-9\-]+)/);
  if (match) return match[1];
  return null;
}

function detectFromHeaderConventions(sample: SampleResponse): AuthProbeSignal | null {
  const headers = lowerHeaders(sample.headers);
  // If the server advertises X-RateLimit-* without WWW-Authenticate, it's
  // probably an API-key-based system
  if (headers["x-ratelimit-limit"] || headers["x-ratelimit-remaining"]) {
    return {
      type: "api_key_header",
      confidence: 0.7,
      reason: "X-RateLimit headers present (typical of API-key-auth APIs)",
      headerName: "X-API-Key",
    };
  }
  if (headers["x-request-id"] && sample.status >= 400) {
    // Platform APIs often use bearer tokens
    return {
      type: "bearer",
      confidence: 0.55,
      reason: "X-Request-Id present (typical of modern bearer-auth APIs)",
    };
  }
  return null;
}

function detectOAuthDiscovery(
  sample: SampleResponse,
  endpointsTried: string[],
): AuthProbeSignal | null {
  // If we probed and saw a /oauth/authorize or /.well-known/oauth-authorization-server endpoint
  const url = sample.url || "";
  const tried = endpointsTried.join(" ");
  if (/oauth\/(authorize|token)|\.well-known\/oauth/i.test(url + " " + tried)) {
    return {
      type: "oauth2",
      confidence: 0.78,
      reason: "OAuth discovery endpoint present",
    };
  }
  return null;
}

function detectGenericFailure(sample: SampleResponse): AuthProbeSignal | null {
  if (sample.status === 401 || sample.status === 403) {
    return {
      type: "bearer",
      confidence: 0.4,
      reason: `Generic ${sample.status} — bearer is most common modern default`,
    };
  }
  return null;
}

// ─── Main deep probe ───────────────────────────────────────────────────────

export function probeAuthDeep(options: ProbeAuthDeepOptions): AdapterAuthSpec {
  const { samples, endpointsTried = [], userHint } = options;

  // User hint wins outright if non-unknown
  if (userHint?.type && userHint.type !== "unknown") {
    return {
      type: userHint.type,
      headerName: userHint.headerName,
      queryParam: userHint.queryParam,
      probeConfidence: 1.0,
      notes: [`User-provided auth type: ${userHint.type}`],
    };
  }

  const signals: AuthProbeSignal[] = [];
  for (const sample of samples) {
    const s1 = detectFromWwwAuthenticate(sample);
    if (s1) signals.push(s1);
    const s2 = detectFromErrorBody(sample);
    if (s2) signals.push(s2);
    const s3 = detectFromHeaderConventions(sample);
    if (s3) signals.push(s3);
    const s4 = detectOAuthDiscovery(sample, endpointsTried);
    if (s4) signals.push(s4);
  }
  // Fallback: a generic 401/403 (keep separate from the strong signals)
  if (signals.length === 0) {
    for (const sample of samples) {
      const s = detectGenericFailure(sample);
      if (s) signals.push(s);
    }
  }

  if (signals.length === 0) {
    return {
      type: "unknown",
      probeConfidence: 0,
      notes: [
        "No auth signals detected from samples.",
        "Consider providing explicit userHint or probing with a different endpoint.",
      ],
    };
  }

  // Pick the highest-confidence signal; break ties by detector order
  signals.sort((a, b) => b.confidence - a.confidence);
  const best = signals[0];

  // Aggregate all reasons into notes for transparency
  const notes: string[] = [];
  const seenTypes = new Set<string>();
  for (const s of signals) {
    if (seenTypes.has(s.type)) continue;
    seenTypes.add(s.type);
    notes.push(`${s.type} (${Math.round(s.confidence * 100)}%): ${s.reason}`);
  }

  return {
    type: best.type,
    headerName: best.headerName,
    queryParam: best.queryParam,
    probeConfidence: best.confidence,
    notes,
  };
}

/**
 * Quick one-line summary of what was detected and why, for logs / UI.
 */
export function summarizeAuthProbe(spec: AdapterAuthSpec): string {
  return `auth=${spec.type} · conf=${Math.round(spec.probeConfidence * 100)}% · ${spec.notes.length} signal(s)`;
}
