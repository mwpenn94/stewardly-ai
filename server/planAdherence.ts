import { getDb } from "./db";
import { planAdherence } from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface AdherenceTarget {
  category: "savings" | "spending" | "investment" | "debt";
  label: string;
  targetMonthly: number;
  actualMonthly: number;
  unit: string; // "$", "%", "months"
}

export interface AdherenceResult {
  userId: number;
  overallScore: number; // 0-100
  savingsScore: number;
  spendingScore: number;
  investmentScore: number;
  debtScore: number;
  deviations: AdherenceDeviation[];
  interventionTier: 1 | 2 | 3 | 4;
  positiveStreak: number; // consecutive months on-target
  message: string;
}

export interface AdherenceDeviation {
  category: string;
  targetValue: number;
  actualValue: number;
  deviationPct: number;
  monthsDeviated: number;
  trend: "improving" | "stable" | "worsening";
}

// ─── Score Calculation ─────────────────────────────────────────
export function calculateCategoryScore(target: number, actual: number, category: string): number {
  if (target === 0) return 100;

  if (category === "spending" || category === "debt") {
    // Lower is better for spending/debt
    const ratio = actual / target;
    if (ratio <= 1) return 100;
    if (ratio <= 1.1) return 85;
    if (ratio <= 1.2) return 70;
    if (ratio <= 1.3) return 55;
    if (ratio <= 1.5) return 40;
    return Math.max(0, 25 - (ratio - 1.5) * 50);
  } else {
    // Higher is better for savings/investment
    const ratio = actual / target;
    if (ratio >= 1) return 100;
    if (ratio >= 0.9) return 85;
    if (ratio >= 0.8) return 70;
    if (ratio >= 0.7) return 55;
    if (ratio >= 0.5) return 40;
    return Math.max(0, ratio * 50);
  }
}

export function determineInterventionTier(
  overallScore: number,
  monthsDeviated: number
): 1 | 2 | 3 | 4 {
  if (monthsDeviated >= 6 && overallScore < 50) return 4;
  if (monthsDeviated >= 3 && overallScore < 60) return 3;
  if (monthsDeviated >= 2 && overallScore < 75) return 2;
  return 1;
}

export function generateInterventionMessage(
  tier: 1 | 2 | 3 | 4,
  deviations: AdherenceDeviation[],
  score: number
): string {
  const worstDeviation = deviations.sort((a, b) => b.deviationPct - a.deviationPct)[0];

  switch (tier) {
    case 1:
      if (score >= 85) {
        return `Great job! Your financial plan adherence score is ${score}/100. You're on track across all categories.`;
      }
      return `Your ${worstDeviation?.category || "plan"} dipped slightly last month. This happens — small adjustments can get you back on track.`;

    case 2:
      return `Your ${worstDeviation?.category || "spending"} has been about ${Math.abs(worstDeviation?.deviationPct || 0).toFixed(0)}% ${worstDeviation?.category === "spending" ? "above" : "below"} plan for ${worstDeviation?.monthsDeviated || 2}+ months. At this pace, your long-term goals may shift. Consider reviewing your targets.`;

    case 3:
      return `Significant deviation detected in ${worstDeviation?.category || "your plan"} for ${worstDeviation?.monthsDeviated || 3} consecutive months. We recommend scheduling a review with your advisor to reassess your plan.`;

    case 4:
      return `Your actual behavior suggests your plan assumptions may need updating. Would you like to revise your targets based on your current patterns, or meet with your advisor to discuss?`;
  }
}

// ─── Compute Full Adherence ────────────────────────────────────
export function computeAdherence(
  targets: AdherenceTarget[],
  monthsHistory: number = 1
): AdherenceResult {
  const scores: Record<string, number> = {};
  const deviations: AdherenceDeviation[] = [];

  for (const t of targets) {
    const score = calculateCategoryScore(t.targetMonthly, t.actualMonthly, t.category);
    scores[t.category] = score;

    const deviationPct = t.targetMonthly === 0 ? 0 :
      ((t.actualMonthly - t.targetMonthly) / t.targetMonthly) * 100;

    if (Math.abs(deviationPct) > 5) {
      deviations.push({
        category: t.category,
        targetValue: t.targetMonthly,
        actualValue: t.actualMonthly,
        deviationPct,
        monthsDeviated: monthsHistory,
        trend: Math.abs(deviationPct) < 10 ? "improving" : deviationPct > 0 ? "worsening" : "stable",
      });
    }
  }

  const savingsScore = scores["savings"] ?? 100;
  const spendingScore = scores["spending"] ?? 100;
  const investmentScore = scores["investment"] ?? 100;
  const debtScore = scores["debt"] ?? 100;
  const overallScore = Math.round((savingsScore + spendingScore + investmentScore + debtScore) / 4);

  const maxMonthsDeviated = deviations.length > 0
    ? Math.max(...deviations.map(d => d.monthsDeviated))
    : 0;

  const tier = determineInterventionTier(overallScore, maxMonthsDeviated);
  const message = generateInterventionMessage(tier, deviations, overallScore);

  return {
    userId: 0,
    overallScore,
    savingsScore: Math.round(savingsScore),
    spendingScore: Math.round(spendingScore),
    investmentScore: Math.round(investmentScore),
    debtScore: Math.round(debtScore),
    deviations,
    interventionTier: tier,
    positiveStreak: overallScore >= 80 ? monthsHistory : 0,
    message,
  };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function savePlanAdherence(userId: number, result: AdherenceResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Save one row per category
  const categories = ["savings", "spending", "investment", "debt"] as const;
  const scoreMap: Record<string, number> = {
    savings: result.savingsScore,
    spending: result.spendingScore,
    investment: result.investmentScore,
    debt: result.debtScore,
  };
  const tierMap: Record<number, "none" | "gentle" | "contextual" | "advisor_alert" | "plan_revision"> = {
    1: "gentle", 2: "contextual", 3: "advisor_alert", 4: "plan_revision",
  };
  for (const cat of categories) {
    const dev = result.deviations.find(d => d.category === cat);
    await db.insert(planAdherence).values({
      userId,
      category: cat,
      targetValue: dev?.targetValue ?? 0,
      actualValue: dev?.actualValue ?? 0,
      adherenceScore: scoreMap[cat] ?? 100,
      trend: dev?.trend === "worsening" ? "declining" : dev?.trend === "improving" ? "improving" : "stable",
      lastNudgeTier: tierMap[result.interventionTier] ?? "none",
    });
  }
}

export async function getLatestAdherence(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(planAdherence)
    .where(eq(planAdherence.userId, userId))
    .orderBy(desc(planAdherence.createdAt))
    .limit(4);
  return rows;
}

export async function getAdherenceHistory(userId: number, months: number = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(planAdherence)
    .where(and(eq(planAdherence.userId, userId), gte(planAdherence.createdAt, since)))
    .orderBy(desc(planAdherence.createdAt));
}
