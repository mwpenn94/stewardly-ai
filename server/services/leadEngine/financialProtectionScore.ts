/**
 * Financial Protection Score — Consumer-facing 12-dimension suitability rebrand
 * Mobile-first (320px min). Score 0-100 free; personalized plan gated behind email.
 */
import { getDb } from "../../db";

export interface ProtectionScoreResult {
  overallScore: number;
  dimensions: Array<{ name: string; score: number; maxScore: number; priority: "high" | "medium" | "low" }>;
  improvementPriorities: string[];
  productRecommendations: Array<{ product: string; reason: string }>;
}

const DIMENSIONS = [
  { key: "life_insurance", name: "Life Insurance", weight: 12 },
  { key: "disability", name: "Disability Income", weight: 10 },
  { key: "emergency_fund", name: "Emergency Fund", weight: 8 },
  { key: "retirement", name: "Retirement Savings", weight: 10 },
  { key: "estate_plan", name: "Estate Planning", weight: 8 },
  { key: "health_insurance", name: "Health Coverage", weight: 8 },
  { key: "debt_management", name: "Debt Management", weight: 8 },
  { key: "investment_diversification", name: "Investment Mix", weight: 8 },
  { key: "tax_efficiency", name: "Tax Efficiency", weight: 7 },
  { key: "education_funding", name: "Education Funding", weight: 7 },
  { key: "long_term_care", name: "Long-Term Care", weight: 7 },
  { key: "property_casualty", name: "Property & Casualty", weight: 7 },
];

export function calculateScore(answers: Record<string, number>): ProtectionScoreResult {
  let totalScore = 0;
  let totalWeight = 0;
  const dimensions: ProtectionScoreResult["dimensions"] = [];
  const priorities: string[] = [];
  const recommendations: Array<{ product: string; reason: string }> = [];

  for (const dim of DIMENSIONS) {
    const raw = answers[dim.key] ?? 0; // 0-10 input
    const weighted = (raw / 10) * dim.weight;
    totalScore += weighted;
    totalWeight += dim.weight;

    const pct = Math.round((raw / 10) * 100);
    const priority = pct < 40 ? "high" : pct < 70 ? "medium" : "low";

    dimensions.push({ name: dim.name, score: pct, maxScore: 100, priority });

    if (priority === "high") {
      priorities.push(dim.name);
      if (dim.key === "life_insurance") recommendations.push({ product: "Term Life + IUL", reason: "Close protection gap" });
      if (dim.key === "disability") recommendations.push({ product: "Disability Insurance", reason: "Protect income" });
      if (dim.key === "retirement") recommendations.push({ product: "IUL / FIA", reason: "Tax-advantaged growth" });
      if (dim.key === "estate_plan") recommendations.push({ product: "Estate Plan + ILIT", reason: "Protect estate" });
    }
  }

  const overall = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  return { overallScore: overall, dimensions, improvementPriorities: priorities, productRecommendations: recommendations };
}

export async function saveScore(params: {
  userId?: number; sessionId?: string; emailHash?: string; firstName?: string;
  result: ProtectionScoreResult;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { financialProtectionScores } = await import("../../../drizzle/schema");
    const [row] = await db.insert(financialProtectionScores).values({
      userId: params.userId,
      sessionId: params.sessionId,
      emailHash: params.emailHash,
      firstName: params.firstName,
      overallScore: params.result.overallScore,
      dimensionScores: params.result.dimensions as any,
      improvementPriorities: params.result.improvementPriorities as any,
      productRecommendations: params.result.productRecommendations as any,
    }).$returningId();
    return row.id;
  } catch {
    return null;
  }
}
