/**
 * Task #22 — Compliance Pre-Screening Service
 * Pre-screens every AI response for unsuitable recommendations, promissory language,
 * unauthorized practice, concentration risk, and missing disclosures.
 * Maintains per-conversation compliance scores.
 */
import { getDb } from "../db";
import { compliancePrescreening, conversationComplianceScores } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"
import { contextualLLM } from "./contextualLLM";

export type ComplianceCheckType = "unsuitable_recommendation" | "promissory_language" | "unauthorized_practice" | "concentration_risk" | "missing_disclosure";
export type ComplianceSeverity = "low" | "medium" | "high" | "critical";
export type ComplianceAction = "passed" | "warning_injected" | "held_for_review";

interface PrescreenResult {
  passed: boolean;
  checks: Array<{
    checkType: ComplianceCheckType;
    severity: ComplianceSeverity;
    details: string;
    action: ComplianceAction;
  }>;
  modifiedResponse?: string;
  conversationScore: number;
}

// ─── Pattern-Based Fast Checks ───────────────────────────────────────────
const PROMISSORY_PATTERNS = [
  /\bguarantee[ds]?\b/i, /\bwill\s+(definitely|certainly|always)\b/i,
  /\bpromise\b/i, /\brisk[- ]?free\b/i, /\bsure\s+thing\b/i,
  /\bcan'?t\s+lose\b/i, /\b100%\s+safe\b/i,
];
const UNAUTHORIZED_PATTERNS = [
  /\byou\s+should\s+(buy|sell|invest\s+in)\b/i,
  /\bI\s+recommend\s+(buying|selling|investing)\b/i,
  /\bmy\s+advice\s+is\s+to\s+(buy|sell)\b/i,
];
const CONCENTRATION_PATTERNS = [
  /\bput\s+(all|everything|100%)\s+(in|into)\b/i,
  /\ball[- ]in\s+on\b/i,
];

export async function prescreenResponse(
  conversationId: number,
  messageId: number,
  responseText: string
): Promise<PrescreenResult> {
  const checks: PrescreenResult["checks"] = [];

  // Fast pattern checks
  for (const pattern of PROMISSORY_PATTERNS) {
    if (pattern.test(responseText)) {
      checks.push({
        checkType: "promissory_language",
        severity: "high",
        details: `Detected promissory language matching: ${pattern.source}`,
        action: "warning_injected",
      });
      break;
    }
  }

  for (const pattern of UNAUTHORIZED_PATTERNS) {
    if (pattern.test(responseText)) {
      checks.push({
        checkType: "unauthorized_practice",
        severity: "critical",
        details: `Detected unauthorized advisory language matching: ${pattern.source}`,
        action: "held_for_review",
      });
      break;
    }
  }

  for (const pattern of CONCENTRATION_PATTERNS) {
    if (pattern.test(responseText)) {
      checks.push({
        checkType: "concentration_risk",
        severity: "medium",
        details: `Detected concentration risk language matching: ${pattern.source}`,
        action: "warning_injected",
      });
      break;
    }
  }

  // Check for missing disclosure on financial topics
  const financialTopics = /\b(invest|portfolio|stock|bond|fund|retirement|401k|ira|annuit|insurance)\b/i;
  const hasDisclosure = /\b(not\s+financial\s+advice|consult\s+a?\s*(qualified|licensed|professional)|disclaimer|for\s+informational\s+purposes)\b/i;
  if (financialTopics.test(responseText) && !hasDisclosure.test(responseText)) {
    checks.push({
      checkType: "missing_disclosure",
      severity: "low",
      details: "Financial topic discussed without standard disclosure",
      action: "warning_injected",
    });
  }

  // Persist checks
  const db = (await getDb())!;
  for (const check of checks) {
    await db.insert(compliancePrescreening).values({
      messageId,
      conversationId,
      checkType: check.checkType,
      severity: check.severity,
      details: check.details,
      actionTaken: check.action,
    });
  }

  // Update conversation compliance score
  const score = await updateConversationScore(conversationId, checks);

  // Modify response if needed
  let modifiedResponse: string | undefined;
  const needsHold = checks.some(c => c.action === "held_for_review");
  const needsWarning = checks.some(c => c.action === "warning_injected");

  if (needsHold) {
    modifiedResponse = "[This response has been held for compliance review. A human advisor will review and release it shortly.]";
  } else if (needsWarning) {
    const disclaimer = "\n\n---\n*Disclaimer: This information is for educational purposes only and does not constitute financial, legal, or tax advice. Please consult a qualified professional before making financial decisions.*";
    modifiedResponse = responseText + disclaimer;
  }

  return {
    passed: checks.length === 0,
    checks,
    modifiedResponse,
    conversationScore: score,
  };
}

// ─── Conversation Score ──────────────────────────────────────────────────
async function updateConversationScore(
  conversationId: number,
  checks: PrescreenResult["checks"]
): Promise<number> {
  const db = (await getDb())!;
  const [existing] = await db.select().from(conversationComplianceScores)
    .where(eq(conversationComplianceScores.conversationId, conversationId)).limit(1);

  const checksRun = (existing?.checksRun ?? 0) + 1;
  const checksPassed = (existing?.checksPassed ?? 0) + (checks.length === 0 ? 1 : 0);
  const score = Math.round((checksPassed / checksRun) * 100);
  const flaggedForReview = checks.some(c => c.severity === "critical") || score < 70;

  if (existing) {
    await db.update(conversationComplianceScores).set({
      score, checksRun, checksPassed, flaggedForReview,
    }).where(eq(conversationComplianceScores.id, existing.id));
  } else {
    await db.insert(conversationComplianceScores).values({
      conversationId, score, checksRun, checksPassed, flaggedForReview,
    });
  }

  return score;
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getConversationComplianceScore(conversationId: number) {
  const db = (await getDb())!;
  const [score] = await db.select().from(conversationComplianceScores)
    .where(eq(conversationComplianceScores.conversationId, conversationId)).limit(1);
  return score ?? { score: 100, checksRun: 0, checksPassed: 0, flaggedForReview: false };
}

export async function getPrescreeningHistory(conversationId: number) {
  const db = (await getDb())!;
  return db.select().from(compliancePrescreening)
    .where(eq(compliancePrescreening.conversationId, conversationId))
    .orderBy(desc(compliancePrescreening.createdAt)).limit(50);
}

export async function getFlaggedConversations() {
  const db = (await getDb())!;
  return db.select().from(conversationComplianceScores)
    .where(eq(conversationComplianceScores.flaggedForReview, true))
    .orderBy(desc(conversationComplianceScores.lastUpdated));
}
