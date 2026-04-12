/**
 * Natural-Language Prompt Parser for the Onboarding Wizard
 *
 * Lets humans + agents describe a new integration in plain English like:
 *
 *   "Onboard our CRM Acme from https://api.acme.com/v2 with bearer auth,
 *    list endpoint /contacts"
 *
 *   "I have a legacy payroll export, rate limit 2/s, api-key in X-Auth-Key"
 *
 *   "Scrape https://registry.example.org/providers daily"
 *
 * The parser extracts:
 *   - name (derives from explicit or common patterns)
 *   - baseUrl (first http(s) URL in the prompt)
 *   - authHint.type (bearer / api_key_header / api_key_query / basic / oauth2)
 *   - authHint.headerName (if "X-Foo-Key" mentioned)
 *   - authHint.queryParam (if "?api_key=..." mentioned)
 *   - listEndpoint (from "endpoint /path" or "/path" near a verb like "list")
 *   - rateLimitHint.requestsPerSecond (from "rate limit N/s" etc)
 *
 * Pure-function module. No LLM calls. Deterministic regex-based extraction.
 * Returns a partial OnboardingInput that can be merged with the caller's
 * explicit fields (explicit wins).
 */

import type { OnboardingInput } from "./onboardingWizard";
import type { AdapterAuthType } from "./adapterGenerator";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ParsedPrompt {
  name?: string;
  baseUrl?: string;
  listEndpoint?: string;
  authHint?: {
    type: AdapterAuthType;
    headerName?: string;
    queryParam?: string;
  };
  rateLimitHint?: {
    requestsPerSecond?: number;
  };
  confidence: number;          // 0..1 rollup
  warnings: string[];          // soft issues the caller should know about
  matchedPatterns: string[];   // what the parser saw (for debug/transparency)
}

// ─── Extractors ───────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s"'<>]+/i;

function extractBaseUrl(prompt: string): { baseUrl?: string; trailingPath?: string } {
  const match = prompt.match(URL_REGEX);
  if (!match) return {};
  // Strip trailing punctuation
  let url = match[0].replace(/[.,;:!?]+$/, "");
  // Split scheme+host from path
  const schemeHost = url.match(/^(https?:\/\/[^/?#]+)(\/[^?#]*)?/i);
  if (schemeHost) {
    return {
      baseUrl: schemeHost[1],
      trailingPath: schemeHost[2]?.replace(/\/$/, "") || undefined,
    };
  }
  return { baseUrl: url };
}

const AUTH_PATTERNS: Array<{
  type: AdapterAuthType;
  patterns: RegExp[];
  headerNamePattern?: RegExp;
}> = [
  {
    type: "bearer",
    patterns: [
      /bearer[\s-]?(token|auth)?/i,
      /jwt/i,
      /access\s+token/i,
    ],
  },
  {
    type: "api_key_header",
    patterns: [
      /api[\s-]?key.*header/i,
      /x-api-key/i,
      /header[\s-]?(based)?[\s-]?api[\s-]?key/i,
    ],
    headerNamePattern: /([xX]-[A-Za-z][A-Za-z0-9\-_]{1,40})/,
  },
  {
    type: "api_key_query",
    patterns: [
      /api[\s-]?key.*query/i,
      /\?api[_-]?key=/i,
      /query[\s-]?param.*api[\s-]?key/i,
    ],
  },
  {
    type: "basic",
    patterns: [
      /basic\s+auth/i,
      /http\s+basic/i,
      /username.*password/i,
    ],
  },
  {
    type: "oauth2",
    patterns: [
      /oauth2?/i,
      /authorization[\s-]?code/i,
      /client[\s-]?credentials/i,
    ],
  },
  {
    type: "none",
    patterns: [/no\s+auth/i, /public[\s-]?api/i, /anonymous/i],
  },
];

function extractAuthHint(prompt: string): ParsedPrompt["authHint"] | undefined {
  const candidates: Array<{
    type: AdapterAuthType;
    headerName?: string;
    weight: number;
  }> = [];
  for (const spec of AUTH_PATTERNS) {
    for (const re of spec.patterns) {
      if (re.test(prompt)) {
        const candidate: { type: AdapterAuthType; headerName?: string; weight: number } = {
          type: spec.type,
          weight: 1,
        };
        if (spec.headerNamePattern) {
          const m = prompt.match(spec.headerNamePattern);
          if (m) candidate.headerName = m[1];
        }
        candidates.push(candidate);
        break; // one match per spec is enough
      }
    }
  }
  if (candidates.length === 0) return undefined;
  // Pick most specific: api_key_header > api_key_query > bearer > basic > oauth2 > none
  const order: AdapterAuthType[] = [
    "api_key_header",
    "api_key_query",
    "basic",
    "oauth2",
    "bearer",
    "none",
    "unknown",
  ];
  candidates.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return {
    type: candidates[0].type,
    headerName: candidates[0].headerName,
  };
}

function extractListEndpoint(
  prompt: string,
  trailingPathFromUrl?: string,
): string | undefined {
  // 1. "list endpoint /foo" or "endpoint /foo"
  const explicit = prompt.match(/(?:list\s+)?endpoint\s+(\/[a-z0-9_\-/]+)/i);
  if (explicit) return explicit[1];
  // 2. "list /foo" verb pattern
  const verb = prompt.match(/\b(?:list|get|fetch|pull|scrape|read)\s+(\/[a-z0-9_\-/]+)/i);
  if (verb) return verb[1];
  // 3. If we pulled a trailing path off the base URL, use that
  if (trailingPathFromUrl && trailingPathFromUrl !== "/") return trailingPathFromUrl;
  // 4. Standalone slash-prefixed path near the word "endpoint" or "path"
  const standalone = prompt.match(/\b(?:path|route|url)\s+(\/[a-z0-9_\-/]+)/i);
  if (standalone) return standalone[1];
  return undefined;
}

function extractName(prompt: string): string | undefined {
  // "onboard <name>", "integrate <name>", "connect <name>"
  const patterns = [
    /\b(?:onboard|integrate|connect|add|register|source)\s+([A-Z][A-Za-z0-9_\-]{2,40})/i,
    /\bfor\s+([A-Z][A-Za-z0-9_\-]{2,40})/,
    /\bcalled\s+["']?([A-Za-z][A-Za-z0-9_\-]{2,40})["']?/i,
    /\bnamed\s+["']?([A-Za-z][A-Za-z0-9_\-]{2,40})["']?/i,
    /\b(?:our|my|the)\s+([A-Z][A-Za-z0-9_\-]{2,40})\s+(?:CRM|API|source|system|platform|integration)/,
  ];
  for (const re of patterns) {
    const match = prompt.match(re);
    if (match) return match[1];
  }
  // Fallback: domain from URL
  const urlMatch = prompt.match(/https?:\/\/([^./\s]+(?:\.[^./\s]+)+)/i);
  if (urlMatch) {
    const host = urlMatch[1].toLowerCase();
    const parts = host.split(".");
    // Drop "www"; pick first meaningful label
    const meaningful = parts.filter((p) => p !== "www" && p !== "api" && p.length > 1);
    if (meaningful.length > 0) {
      const label = meaningful[0];
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  return undefined;
}

function extractRateLimit(prompt: string): ParsedPrompt["rateLimitHint"] | undefined {
  // "rate limit 5/s", "5 requests per second", "5 rps"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:\/|per)\s*s(?:ec(?:ond)?)?/i,
    /(\d+(?:\.\d+)?)\s*rps\b/i,
    /rate[\s-]?limit(?:ed)?\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:\/|per)?\s*s/i,
  ];
  for (const re of patterns) {
    const match = prompt.match(re);
    if (match) {
      const rps = Number(match[1]);
      if (Number.isFinite(rps) && rps > 0) {
        return { requestsPerSecond: rps };
      }
    }
  }
  return undefined;
}

// ─── Main entry point ────────────────────────────────────────────────────

export function parsePrompt(prompt: string): ParsedPrompt {
  if (!prompt || typeof prompt !== "string") {
    return {
      confidence: 0,
      warnings: ["Empty or invalid prompt"],
      matchedPatterns: [],
    };
  }

  const trimmed = prompt.trim();
  const matchedPatterns: string[] = [];
  const warnings: string[] = [];

  const urlExtraction = extractBaseUrl(trimmed);
  if (urlExtraction.baseUrl) matchedPatterns.push("base_url");

  const authHint = extractAuthHint(trimmed);
  if (authHint) matchedPatterns.push(`auth:${authHint.type}`);

  const listEndpoint = extractListEndpoint(trimmed, urlExtraction.trailingPath);
  if (listEndpoint) matchedPatterns.push("list_endpoint");

  const name = extractName(trimmed);
  if (name) matchedPatterns.push("name");

  const rateLimitHint = extractRateLimit(trimmed);
  if (rateLimitHint) matchedPatterns.push("rate_limit");

  // Warnings
  if (!urlExtraction.baseUrl) warnings.push("No base URL detected in prompt");
  if (!authHint) warnings.push("No auth style detected — defaults to unknown");
  if (!name && !urlExtraction.baseUrl) {
    warnings.push("Neither a name nor a URL was provided");
  }

  // Confidence: fraction of hints matched
  const hintsPossible = 5;
  const hintsFound = matchedPatterns.length;
  const confidence = Math.min(1, hintsFound / hintsPossible);

  return {
    name,
    baseUrl: urlExtraction.baseUrl,
    listEndpoint,
    authHint,
    rateLimitHint,
    confidence,
    warnings,
    matchedPatterns,
  };
}

/**
 * Merge a parsed prompt into a partial OnboardingInput. Explicit values in
 * `overrides` always win over parsed ones — users stay in control.
 */
export function parsedToOnboardingInput(
  parsed: ParsedPrompt,
  overrides: Partial<OnboardingInput> & { sampleRecords: OnboardingInput["sampleRecords"] },
): OnboardingInput {
  return {
    sampleRecords: overrides.sampleRecords,
    name: overrides.name ?? parsed.name ?? "unnamed",
    baseUrl: overrides.baseUrl ?? parsed.baseUrl,
    listEndpoint: overrides.listEndpoint ?? parsed.listEndpoint,
    authHint: overrides.authHint ?? parsed.authHint,
    authProbeSamples: overrides.authProbeSamples,
    collectionPath: overrides.collectionPath,
    sampleListResponse: overrides.sampleListResponse,
    fieldOverrides: overrides.fieldOverrides,
    redaction: overrides.redaction,
    skipRedaction: overrides.skipRedaction,
    skipCrmMapping: overrides.skipCrmMapping,
    skipPersonalizationHints: overrides.skipPersonalizationHints,
  };
}

/**
 * Human-readable one-liner for logs / UI feedback.
 */
export function summarizeParsedPrompt(parsed: ParsedPrompt): string {
  const parts: string[] = [];
  if (parsed.name) parts.push(`name=${parsed.name}`);
  if (parsed.baseUrl) parts.push(`url=${parsed.baseUrl}`);
  if (parsed.authHint) parts.push(`auth=${parsed.authHint.type}`);
  if (parsed.listEndpoint) parts.push(`endpoint=${parsed.listEndpoint}`);
  if (parsed.rateLimitHint?.requestsPerSecond) {
    parts.push(`rps=${parsed.rateLimitHint.requestsPerSecond}`);
  }
  parts.push(`conf=${Math.round(parsed.confidence * 100)}%`);
  return parts.join(" · ");
}
