/**
 * URL Hallucination Guardrail
 *
 * Prevents the AI from fabricating URLs that were not present in the source
 * context (tool output, RAG results, web search results). The RICH MEDIA
 * guidance in prompts.ts encourages the model to cite URLs, so this guardrail
 * ensures only legitimate URLs are passed through.
 *
 * Usage:
 *   import { detectHallucinatedURLs } from "./shared/guardrails/urlHallucination";
 *   const result = detectHallucinatedURLs(aiResponse, sourceContext);
 *   if (result.hallucinated.length > 0) flag or strip the URLs
 */

/** Well-known authoritative domains that are always considered legitimate */
const TRUSTED_DOMAINS = [
  "irs.gov",
  "sec.gov",
  "finra.org",
  "fred.stlouisfed.org",
  "treasury.gov",
  "ssa.gov",
  "medicare.gov",
  "healthcare.gov",
  "investor.gov",
  "consumerfinance.gov",
  "youtube.com",
  "youtu.be",
  "congress.gov",
  "bls.gov",
  "census.gov",
  "fdic.gov",
  "occ.gov",
  "federalreserve.gov",
  "doi.org",
  "wikipedia.org",
] as const;

export interface URLHallucinationResult {
  /** URLs in the response that were NOT found in source context or trusted domains */
  hallucinated: string[];
  /** URLs that are either in source context or on trusted domains */
  legitimate: string[];
  /** Total unique URLs found in the response */
  totalURLs: number;
  /** Whether the response passes the guardrail (no hallucinated URLs) */
  passed: boolean;
}

/** Extract unique URLs from text */
export function extractURLsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>\])+,]+/g;
  return Array.from(new Set(text.match(urlRegex) || []));
}

/**
 * Detect hallucinated URLs in an AI response by comparing against source context.
 *
 * @param aiResponse - The AI-generated response text
 * @param sourceContext - Combined text from tool outputs, RAG results, and web search results
 * @returns URLHallucinationResult with hallucinated and legitimate URL lists
 */
export function detectHallucinatedURLs(
  aiResponse: string,
  sourceContext: string
): URLHallucinationResult {
  const responseURLs = extractURLsFromText(aiResponse);
  const sourceURLs = new Set(extractURLsFromText(sourceContext));

  const hallucinated: string[] = [];
  const legitimate: string[] = [];

  for (const url of responseURLs) {
    const isTrustedDomain = TRUSTED_DOMAINS.some((d) => url.includes(d));
    const isInSource = sourceURLs.has(url);

    if (isInSource || isTrustedDomain) {
      legitimate.push(url);
    } else {
      hallucinated.push(url);
    }
  }

  return {
    hallucinated,
    legitimate,
    totalURLs: responseURLs.length,
    passed: hallucinated.length === 0,
  };
}

/**
 * Strip hallucinated URLs from AI response text, replacing them with a warning.
 * Useful as a post-processing step before sending the response to the client.
 */
export function stripHallucinatedURLs(
  aiResponse: string,
  sourceContext: string
): { cleaned: string; strippedCount: number } {
  const { hallucinated } = detectHallucinatedURLs(aiResponse, sourceContext);
  let cleaned = aiResponse;
  let strippedCount = 0;

  for (const url of hallucinated) {
    cleaned = cleaned.replace(url, "[URL removed — source not verified]");
    strippedCount++;
  }

  return { cleaned, strippedCount };
}
