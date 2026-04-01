/**
 * Compliance Copilot (A4 enhanced) — Content Classification & Risk-Tiered Routing
 * 
 * Classifies every AI response into 4 tiers:
 *   1. General Education → auto-approved
 *   2. Product Discussion → auto-approved with disclaimers
 *   3. Personalized Recommendation → auto-modified with caveats
 *   4. Investment Advice → human review required
 * 
 * Maintains immutable audit trail with reasoning chains.
 */
import { getDb } from "./db";
import { complianceAudit, privacyAudit } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { contextualLLM as invokeLLM } from "./shared/stewardlyWiring"

// ─── TYPES ──────────────────────────────────────────────────────
export type ContentClassification =
  | "general_education"
  | "product_discussion"
  | "personalized_recommendation"
  | "investment_advice";

export type ReviewTier =
  | "auto_approved"
  | "auto_modified"
  | "human_review"
  | "blocked";

export interface ClassificationResult {
  classification: ContentClassification;
  confidence: number;
  flags: string[];
  reasoningChain: string[];
  suggestedModifications: string[];
  reviewTier: ReviewTier;
}

// ─── CLASSIFICATION ENGINE ──────────────────────────────────────
const CLASSIFICATION_PROMPT = `You are a financial compliance classifier. Analyze the AI response and classify it.

Classification tiers:
1. "general_education" — Generic financial concepts, definitions, market overviews. No specific recommendations.
2. "product_discussion" — Discusses specific products/funds/carriers but doesn't recommend for this user specifically.
3. "personalized_recommendation" — Suggests specific actions for this user based on their situation.
4. "investment_advice" — Specific buy/sell/hold recommendations, portfolio allocation advice, or tax strategies.

Also flag:
- "forward_looking" — Contains predictions about market performance
- "guarantee_language" — Uses words like "guaranteed", "certain", "will definitely"
- "suitability_gap" — Recommendation without adequate suitability data
- "regulatory_reference" — References specific regulations or tax codes

Return ONLY valid JSON:
{"classification":"...","confidence":0.95,"flags":["..."],"reasoningChain":["step1","step2"],"suggestedModifications":["add disclaimer about..."]}`;

export async function classifyContent(
  aiResponse: string,
  userContext: { hasSuitability: boolean; focus: string },
): Promise<ClassificationResult> {
  try {
    const resp = await contextualLLM({ userId: 0, contextType: "compliance",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        {
          role: "user",
          content: `AI Response: "${aiResponse.substring(0, 3000)}"\n\nUser context: suitability=${userContext.hasSuitability}, focus=${userContext.focus}`,
        },
      ],
    });
    const raw = typeof resp.choices[0]?.message?.content === "string"
      ? resp.choices[0].message.content.trim()
      : "{}";
    const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr);
    // Determine review tier based on classification
    let reviewTier: ReviewTier = "auto_approved";
    if (parsed.classification === "investment_advice") {
      reviewTier = "human_review";
    } else if (parsed.classification === "personalized_recommendation") {
      reviewTier = "auto_modified";
    } else if (parsed.flags?.includes("guarantee_language")) {
      reviewTier = "blocked";
    }
    return {
      classification: parsed.classification || "general_education",
      confidence: parsed.confidence || 0.5,
      flags: parsed.flags || [],
      reasoningChain: parsed.reasoningChain || [],
      suggestedModifications: parsed.suggestedModifications || [],
      reviewTier,
    };
  } catch {
    return {
      classification: "general_education",
      confidence: 0.5,
      flags: [],
      reasoningChain: ["Classification failed, defaulting to general_education"],
      suggestedModifications: [],
      reviewTier: "auto_approved",
    };
  }
}

// ─── AUTO-MODIFICATION ──────────────────────────────────────────
const DISCLAIMERS: Record<ContentClassification, string> = {
  general_education: "",
  product_discussion: "\n\n---\n*This information is for educational purposes only and does not constitute a recommendation to purchase any specific product. Please consult with a qualified financial professional before making decisions.*",
  personalized_recommendation: "\n\n---\n*This suggestion is based on the information you've shared and general financial principles. It is not a substitute for professional financial advice tailored to your complete situation. Consider consulting a licensed financial advisor.*",
  investment_advice: "\n\n---\n*⚠️ This response contains investment-related content that should be reviewed by a qualified professional before acting upon. Past performance does not guarantee future results. All investments carry risk.*",
};

export function applyModifications(
  content: string,
  result: ClassificationResult,
): { content: string; modifications: string[] } {
  const modifications: string[] = [];
  let modified = content;
  // Add appropriate disclaimer
  const disclaimer = DISCLAIMERS[result.classification];
  if (disclaimer) {
    modified += disclaimer;
    modifications.push(`Added ${result.classification} disclaimer`);
  }
  // Strip guarantee language if flagged
  if (result.flags.includes("guarantee_language")) {
    modified = modified
      .replace(/\bguaranteed?\b/gi, "potentially")
      .replace(/\bwill definitely\b/gi, "may")
      .replace(/\bcertain to\b/gi, "likely to");
    modifications.push("Softened guarantee language");
  }
  return { content: modified, modifications };
}

// ─── AUDIT TRAIL ────────────────────────────────────────────────
export async function logComplianceAudit(data: {
  messageId: number;
  userId: number;
  conversationId?: number;
  result: ClassificationResult;
  modelVersion?: string;
  promptHash?: string;
  deliveryStatus?: "delivered" | "held" | "blocked" | "modified";
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(complianceAudit).values({
    messageId: data.messageId,
    userId: data.userId,
    conversationId: data.conversationId,
    classification: data.result.classification,
    confidenceScore: data.result.confidence,
    flagsJson: data.result.flags,
    reasoningChainJson: data.result.reasoningChain,
    modificationsJson: data.result.suggestedModifications,
    reviewTier: data.result.reviewTier,
    modelVersion: data.modelVersion,
    promptHash: data.promptHash,
    deliveryStatus: data.deliveryStatus || "delivered",
  });
}

export async function getComplianceAuditLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(complianceAudit)
    .where(eq(complianceAudit.userId, userId))
    .orderBy(desc(complianceAudit.createdAt))
    .limit(limit);
}

// ─── PRIVACY AUDIT ──────────────────────────────────────────────
export async function logPrivacyAudit(data: {
  userId: number;
  apiCallPurpose: string;
  dataCategories: string[];
  piiMasked: boolean;
  modelUsed?: string;
  tokensSent?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(privacyAudit).values(data);
}

export async function getPrivacyAuditLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(privacyAudit)
    .where(eq(privacyAudit.userId, userId))
    .orderBy(desc(privacyAudit.createdAt))
    .limit(limit);
}
