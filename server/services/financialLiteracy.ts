/**
 * Task #36 — Financial Literacy Detection Service
 * Detects user sophistication level from conversation patterns,
 * adjusts explanation depth, and manages user guardrails.
 */
import { getDb } from "../db";
import { userGuardrails } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

type LiteracyLevel = "beginner" | "intermediate" | "advanced" | "professional";

interface LiteracyAssessment {
  level: LiteracyLevel;
  confidence: number;
  indicators: string[];
  recommendedTone: string;
  explanationDepth: "simplified" | "standard" | "technical";
}

// ─── Vocabulary Indicators ───────────────────────────────────────────────
const ADVANCED_TERMS = [
  "alpha", "beta", "sharpe ratio", "standard deviation", "correlation",
  "duration", "convexity", "yield curve", "basis points", "delta",
  "theta", "vega", "implied volatility", "monte carlo", "efficient frontier",
  "modern portfolio theory", "capm", "black-scholes", "rebalancing frequency",
];
const INTERMEDIATE_TERMS = [
  "diversification", "asset allocation", "expense ratio", "compound interest",
  "dollar cost averaging", "index fund", "etf", "roth", "traditional ira",
  "capital gains", "dividend", "p/e ratio", "market cap", "bonds",
];
const BEGINNER_INDICATORS = [
  "what is", "how does", "explain", "i don't understand",
  "what does that mean", "in simple terms", "for beginners",
];

// ─── Assess Literacy ─────────────────────────────────────────────────────
export function assessLiteracy(messages: string[]): LiteracyAssessment {
  const combined = messages.join(" ").toLowerCase();
  const indicators: string[] = [];

  let advancedCount = 0;
  let intermediateCount = 0;
  let beginnerCount = 0;

  for (const term of ADVANCED_TERMS) {
    if (combined.includes(term)) { advancedCount++; indicators.push(`advanced: ${term}`); }
  }
  for (const term of INTERMEDIATE_TERMS) {
    if (combined.includes(term)) { intermediateCount++; indicators.push(`intermediate: ${term}`); }
  }
  for (const term of BEGINNER_INDICATORS) {
    if (combined.includes(term)) { beginnerCount++; indicators.push(`beginner: ${term}`); }
  }

  // Score
  const total = advancedCount + intermediateCount + beginnerCount;
  let level: LiteracyLevel = "intermediate";
  let confidence = 0.5;

  if (advancedCount >= 3) { level = "professional"; confidence = Math.min(0.95, 0.6 + advancedCount * 0.05); }
  else if (advancedCount >= 1 && intermediateCount >= 2) { level = "advanced"; confidence = 0.7; }
  else if (beginnerCount >= 2 && advancedCount === 0) { level = "beginner"; confidence = 0.75; }
  else if (intermediateCount >= 2) { level = "intermediate"; confidence = 0.65; }

  const toneMap: Record<LiteracyLevel, string> = {
    beginner: "Use simple language, avoid jargon, provide analogies and examples",
    intermediate: "Use standard financial terminology with brief explanations when needed",
    advanced: "Use technical language freely, focus on analysis and nuance",
    professional: "Assume deep expertise, use precise technical terms, focus on edge cases",
  };

  const depthMap: Record<LiteracyLevel, "simplified" | "standard" | "technical"> = {
    beginner: "simplified",
    intermediate: "standard",
    advanced: "technical",
    professional: "technical",
  };

  return {
    level,
    confidence,
    indicators: indicators.slice(0, 10),
    recommendedTone: toneMap[level],
    explanationDepth: depthMap[level],
  };
}

// ─── User Guardrails ─────────────────────────────────────────────────────
export async function setGuardrail(userId: number, guardrailType: string, value: string, reason?: string): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.insert(userGuardrails).values({
    userId, guardrailType, value, reason,
  }).$returningId();
  return result.id;
}

export async function getUserGuardrails(userId: number) {
  const db = (await getDb())!;
  return db.select().from(userGuardrails)
    .where(eq(userGuardrails.userId, userId))
    .orderBy(desc(userGuardrails.createdAt));
}

export async function removeGuardrail(id: number, userId: number): Promise<void> {
  const db = (await getDb())!;
  await db.delete(userGuardrails).where(and(eq(userGuardrails.id, id), eq(userGuardrails.userId, userId)));
}
