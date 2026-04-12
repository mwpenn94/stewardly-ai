/**
 * Auto-Quality Rater — lightweight heuristic scoring of AI responses.
 *
 * Scores every unrated assistant message on a 0.0–1.0 scale using
 * structural heuristics (no LLM call required). The improvement engine's
 * DEPTH signal reads from `quality_ratings` — this module populates it.
 *
 * Heuristic dimensions:
 *   1. Length adequacy (too short = low effort, too long = unfocused)
 *   2. Structural richness (headings, lists, code blocks, links)
 *   3. Compliance markers (disclaimers when financial advice is given)
 *   4. Hallucination proxy (contains fabricated-looking URLs)
 *   5. Coherence proxy (sentence count vs content length ratio)
 *
 * Called by the scheduler every 6 hours to backfill recent messages.
 */

import { logger } from "../../_core/logger";

// ── Pure scoring functions (unit-testable without DB) ──────────────────────

export interface QualityScore {
  overall: number; // 0.0–1.0
  dimensions: {
    lengthAdequacy: number;
    structuralRichness: number;
    complianceAwareness: number;
    hallucinationRisk: number; // inverted: 1.0 = no risk, 0.0 = high risk
    coherence: number;
  };
  reasoning: string;
}

/** Score length adequacy: penalize very short (<50 chars) and very long (>8000 chars) */
export function scoreLengthAdequacy(content: string): number {
  const len = content.length;
  if (len < 20) return 0.1;
  if (len < 50) return 0.3;
  if (len < 100) return 0.5;
  if (len <= 4000) return 1.0; // sweet spot
  if (len <= 8000) return 0.8;
  return 0.6; // very long responses lose focus
}

/** Score structural richness: headings, bullet lists, code blocks, bold text */
export function scoreStructuralRichness(content: string): number {
  let score = 0.3; // base score for any response

  const hasHeadings = /^#{1,4}\s/m.test(content);
  const hasBullets = /^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const hasBold = /\*\*[^*]+\*\*/.test(content);
  const hasTable = /\|.*\|.*\|/.test(content);

  if (hasHeadings) score += 0.15;
  if (hasBullets) score += 0.2;
  if (hasCodeBlock) score += 0.15;
  if (hasBold) score += 0.1;
  if (hasTable) score += 0.1;

  return Math.min(1.0, score);
}

/** Score compliance awareness: financial disclaimers when advice-like content */
export function scoreComplianceAwareness(content: string): number {
  const lcContent = content.toLowerCase();

  // Check if the response contains financial advice signals
  const adviceSignals = [
    "recommend", "should invest", "you should", "i suggest",
    "best strategy", "optimal", "consider investing",
    "portfolio", "allocation", "retirement plan",
  ];
  const hasAdvice = adviceSignals.some(s => lcContent.includes(s));

  if (!hasAdvice) return 1.0; // No advice given, compliance not needed

  // If advice is given, check for disclaimers
  const disclaimerSignals = [
    "not financial advice", "consult", "professional",
    "disclaimer", "individual circumstances", "past performance",
    "does not guarantee", "general information", "not a recommendation",
    "seek qualified", "licensed", "fiduciary",
  ];
  const hasDisclaimer = disclaimerSignals.some(s => lcContent.includes(s));

  return hasDisclaimer ? 1.0 : 0.4;
}

/** Score hallucination risk: detect fabricated-looking URLs */
export function scoreHallucinationRisk(content: string): number {
  // Extract URLs
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const urls = content.match(urlPattern) || [];

  if (urls.length === 0) return 1.0; // No URLs = no hallucination risk

  // Known trusted domains
  const trustedDomains = new Set([
    "irs.gov", "sec.gov", "finra.org", "treasury.gov",
    "ssa.gov", "healthcare.gov", "medicare.gov",
    "youtube.com", "wikipedia.org", "investopedia.com",
    "github.com", "stackoverflow.com", "docs.google.com",
    "arxiv.org", "nber.org", "federalreserve.gov",
  ]);

  let suspicious = 0;
  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      // Check if it's a known trusted domain
      const isTrusted = Array.from(trustedDomains).some(d => hostname.endsWith(d));
      if (!isTrusted) {
        // Check for suspicious patterns: random subdomains, very long paths
        if (hostname.split(".").length > 3 || url.length > 200) {
          suspicious++;
        }
      }
    } catch {
      suspicious++; // Malformed URL
    }
  }

  if (suspicious === 0) return 1.0;
  if (suspicious <= 1) return 0.7;
  return 0.3;
}

/** Score coherence: ratio of sentences to content length */
export function scoreCoherence(content: string): number {
  // Strip code blocks and URLs for cleaner analysis
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .trim();

  if (cleaned.length < 20) return 0.5;

  // Count sentences (rough heuristic)
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length === 0) return 0.3;

  // Ideal: ~100-200 chars per sentence
  const avgLength = cleaned.length / sentences.length;
  if (avgLength >= 50 && avgLength <= 300) return 1.0;
  if (avgLength >= 30 && avgLength <= 500) return 0.7;
  return 0.4;
}

/** Compute overall quality score from an assistant message's content */
export function scoreResponse(content: string): QualityScore {
  if (!content || typeof content !== "string") {
    return {
      overall: 0,
      dimensions: {
        lengthAdequacy: 0,
        structuralRichness: 0,
        complianceAwareness: 0,
        hallucinationRisk: 0,
        coherence: 0,
      },
      reasoning: "Empty or invalid response content",
    };
  }

  const dimensions = {
    lengthAdequacy: scoreLengthAdequacy(content),
    structuralRichness: scoreStructuralRichness(content),
    complianceAwareness: scoreComplianceAwareness(content),
    hallucinationRisk: scoreHallucinationRisk(content),
    coherence: scoreCoherence(content),
  };

  // Weighted average — compliance and hallucination matter most
  const weights = {
    lengthAdequacy: 0.15,
    structuralRichness: 0.15,
    complianceAwareness: 0.30,
    hallucinationRisk: 0.25,
    coherence: 0.15,
  };

  const overall = Object.entries(dimensions).reduce(
    (sum, [key, val]) => sum + val * weights[key as keyof typeof weights],
    0,
  );

  const lowDimensions = Object.entries(dimensions)
    .filter(([, val]) => val < 0.5)
    .map(([key]) => key);

  const reasoning = lowDimensions.length === 0
    ? "All quality dimensions within acceptable range"
    : `Low scores on: ${lowDimensions.join(", ")}`;

  return { overall, dimensions, reasoning };
}

// ── DB backfill (called by scheduler) ──────────────────────────────────────

/**
 * Backfill quality ratings for recent unrated assistant messages.
 * Runs against the last 24h of messages, skipping any already rated.
 */
export async function backfillQualityRatings(db: any): Promise<{
  scanned: number;
  rated: number;
  avgScore: number;
}> {
  let scanned = 0;
  let rated = 0;
  let totalScore = 0;

  try {
    const { messages, qualityRatings } = await import("../../../drizzle/schema");
    const { and, gte, eq, sql, notInArray } = await import("drizzle-orm");

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get IDs of already-rated messages
    const alreadyRated = await db
      .select({ messageId: qualityRatings.messageId })
      .from(qualityRatings)
      .where(gte(qualityRatings.createdAt, oneDayAgo));

    const ratedIds = new Set(alreadyRated.map((r: any) => r.messageId));

    // Get recent assistant messages
    const recentMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        conversationId: messages.conversationId,
      })
      .from(messages)
      .where(
        and(
          gte(messages.createdAt, oneDayAgo),
          eq(messages.role, "assistant"),
        ),
      )
      .limit(200);

    scanned = recentMessages.length;

    for (const msg of recentMessages) {
      if (ratedIds.has(msg.id)) continue;

      const content = typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);

      if (!content || content.length < 10) continue;

      const score = scoreResponse(content);

      try {
        await db.insert(qualityRatings).values({
          messageId: msg.id,
          conversationId: msg.conversationId,
          score: score.overall,
          reasoning: score.reasoning,
          improvementSuggestions: JSON.stringify(score.dimensions),
        });
        rated++;
        totalScore += score.overall;
      } catch {
        // Skip individual insert errors (e.g., duplicates)
      }
    }
  } catch (e) {
    logger.warn(
      { operation: "autoQualityRater" },
      `Quality rating backfill failed: ${e}`,
    );
  }

  return {
    scanned,
    rated,
    avgScore: rated > 0 ? totalScore / rated : 0,
  };
}
