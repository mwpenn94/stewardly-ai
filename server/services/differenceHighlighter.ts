/**
 * Difference Highlighter — Identify where multi-model responses agree vs disagree
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "differenceHighlighter" });

export interface DifferenceResult {
  agreements: string[];
  disagreements: Array<{ topic: string; primaryPosition: string; secondaryPosition: string; severity: "low" | "medium" | "high" }>;
  overallAgreement: number;
}

export async function highlightDifferences(primary: string, secondary: string): Promise<DifferenceResult> {
  // Extract key claims from each response
  const primaryClaims = extractClaims(primary);
  const secondaryClaims = extractClaims(secondary);

  const agreements: string[] = [];
  const disagreements: DifferenceResult["disagreements"] = [];

  // Compare claims by topic overlap
  for (const pClaim of primaryClaims) {
    const matching = secondaryClaims.find(s => topicOverlap(pClaim, s) > 0.3);
    if (matching) {
      if (contentSimilar(pClaim, matching)) {
        agreements.push(pClaim);
      } else {
        disagreements.push({
          topic: extractTopic(pClaim),
          primaryPosition: pClaim.slice(0, 200),
          secondaryPosition: matching.slice(0, 200),
          severity: hasNumbers(pClaim) || hasNumbers(matching) ? "high" : "medium",
        });
      }
    }
  }

  const total = agreements.length + disagreements.length;
  const overallAgreement = total > 0 ? agreements.length / total : 1;

  return { agreements, disagreements, overallAgreement };
}

function extractClaims(text: string): string[] {
  return text.split(/[.!?]\s+/).filter(s => s.length > 20 && s.length < 500);
}

function topicOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const intersection = Array.from(wordsA).filter(w => wordsB.has(w));
  return wordsA.size > 0 ? intersection.length / wordsA.size : 0;
}

function contentSimilar(a: string, b: string): boolean {
  return topicOverlap(a, b) > 0.5;
}

function extractTopic(claim: string): string {
  return claim.split(/[,;:]/).at(0)?.trim().slice(0, 50) || "General";
}

function hasNumbers(text: string): boolean {
  return /\$[\d,]+|\d+%|\d+\.\d+/.test(text);
}
