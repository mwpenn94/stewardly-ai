import { getDb } from "./db";
import { healthScores } from "../drizzle/schema";
import { eq, desc, gte, and } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface HealthScoreInput {
  // Spend pillar
  monthlyIncome: number;
  monthlySpending: number;
  billsOnTimePercent: number; // 0-100

  // Save pillar
  liquidSavingsMonths: number; // months of expenses in liquid savings
  longTermSavingsProgress: number; // 0-100 (% toward retirement goal)

  // Borrow pillar
  debtToIncomeRatio: number; // 0-1+
  creditUtilization: number; // 0-100

  // Plan pillar
  insuranceAdequacy: number; // 0-100 (coverage vs needs)
  planCompleteness: number; // 0-100 (% of financial plan elements completed)
}

export interface HealthScoreResult {
  totalScore: number; // 0-100
  spendScore: number; // 0-25
  saveScore: number; // 0-25
  borrowScore: number; // 0-25
  planScore: number; // 0-25
  status: "healthy" | "coping" | "vulnerable";
  insights: string[];
  recommendations: string[];
}

// ─── Scoring Functions ─────────────────────────────────────────
function scoreSpend(input: HealthScoreInput): { score: number; insights: string[]; recs: string[] } {
  const insights: string[] = [];
  const recs: string[] = [];

  // Spending < income ratio (0-15 points)
  const spendRatio = input.monthlySpending / Math.max(1, input.monthlyIncome);
  let ratioScore = 0;
  if (spendRatio <= 0.7) ratioScore = 15;
  else if (spendRatio <= 0.8) ratioScore = 12;
  else if (spendRatio <= 0.9) ratioScore = 8;
  else if (spendRatio <= 1.0) ratioScore = 4;
  else { ratioScore = 0; insights.push("Spending exceeds income"); recs.push("Create a spending plan to bring expenses below income"); }

  // Bills on time (0-10 points)
  const billsScore = Math.round((input.billsOnTimePercent / 100) * 10);
  if (input.billsOnTimePercent < 90) {
    insights.push(`${100 - input.billsOnTimePercent}% of bills paid late`);
    recs.push("Set up automatic payments for recurring bills");
  }

  return { score: ratioScore + billsScore, insights, recs };
}

function scoreSave(input: HealthScoreInput): { score: number; insights: string[]; recs: string[] } {
  const insights: string[] = [];
  const recs: string[] = [];

  // Liquid savings months (0-15)
  let liquidScore = 0;
  if (input.liquidSavingsMonths >= 6) liquidScore = 15;
  else if (input.liquidSavingsMonths >= 3) liquidScore = 10;
  else if (input.liquidSavingsMonths >= 1) liquidScore = 5;
  else { liquidScore = 0; insights.push("Less than 1 month of emergency savings"); recs.push("Build emergency fund to cover 3-6 months of expenses"); }

  // Long-term savings progress (0-10)
  const ltScore = Math.round((Math.min(100, input.longTermSavingsProgress) / 100) * 10);
  if (input.longTermSavingsProgress < 50) {
    insights.push("Long-term savings behind target");
    recs.push("Increase retirement contributions or review savings strategy");
  }

  return { score: liquidScore + ltScore, insights, recs };
}

function scoreBorrow(input: HealthScoreInput): { score: number; insights: string[]; recs: string[] } {
  const insights: string[] = [];
  const recs: string[] = [];

  // Debt-to-income (0-15)
  let dtiScore = 0;
  if (input.debtToIncomeRatio <= 0.2) dtiScore = 15;
  else if (input.debtToIncomeRatio <= 0.35) dtiScore = 10;
  else if (input.debtToIncomeRatio <= 0.43) dtiScore = 5;
  else { dtiScore = 0; insights.push("High debt-to-income ratio"); recs.push("Prioritize paying down high-interest debt"); }

  // Credit utilization (0-10)
  let utilScore = 0;
  if (input.creditUtilization <= 10) utilScore = 10;
  else if (input.creditUtilization <= 30) utilScore = 7;
  else if (input.creditUtilization <= 50) utilScore = 4;
  else { utilScore = 0; insights.push("High credit utilization"); recs.push("Pay down credit card balances to below 30% utilization"); }

  return { score: dtiScore + utilScore, insights, recs };
}

function scorePlan(input: HealthScoreInput): { score: number; insights: string[]; recs: string[] } {
  const insights: string[] = [];
  const recs: string[] = [];

  // Insurance adequacy (0-12)
  const insScore = Math.round((Math.min(100, input.insuranceAdequacy) / 100) * 12);
  if (input.insuranceAdequacy < 60) {
    insights.push("Insurance coverage gaps detected");
    recs.push("Review life, disability, and health insurance coverage");
  }

  // Plan completeness (0-13)
  const planScore = Math.round((Math.min(100, input.planCompleteness) / 100) * 13);
  if (input.planCompleteness < 50) {
    insights.push("Financial plan incomplete");
    recs.push("Complete your financial plan including goals, estate planning, and tax strategy");
  }

  return { score: insScore + planScore, insights, recs };
}

// ─── Main Scoring ──────────────────────────────────────────────
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const spend = scoreSpend(input);
  const save = scoreSave(input);
  const borrow = scoreBorrow(input);
  const plan = scorePlan(input);

  const totalScore = spend.score + save.score + borrow.score + plan.score;
  const status: "healthy" | "coping" | "vulnerable" =
    totalScore >= 80 ? "healthy" : totalScore >= 40 ? "coping" : "vulnerable";

  return {
    totalScore,
    spendScore: spend.score,
    saveScore: save.score,
    borrowScore: borrow.score,
    planScore: plan.score,
    status,
    insights: [...spend.insights, ...save.insights, ...borrow.insights, ...plan.insights],
    recommendations: [...spend.recs, ...save.recs, ...borrow.recs, ...plan.recs],
  };
}

// ─── Early Warning ─────────────────────────────────────────────
export interface EarlyWarning {
  type: "score_drop" | "spending_overshoot" | "savings_decline" | "dti_rising";
  severity: "info" | "warning" | "critical";
  message: string;
  alertAdvisor: boolean;
}

export function detectEarlyWarnings(
  currentScore: number,
  previousScore: number | null,
  daysSinceLast: number
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];
  if (previousScore === null) return warnings;

  const drop = previousScore - currentScore;
  const monthlyDrop = drop * (30 / Math.max(1, daysSinceLast));

  if (monthlyDrop > 10) {
    warnings.push({
      type: "score_drop",
      severity: "critical",
      message: `Financial health score dropped ${drop} points (${previousScore} → ${currentScore}). Significant change detected.`,
      alertAdvisor: true,
    });
  } else if (monthlyDrop > 5) {
    warnings.push({
      type: "score_drop",
      severity: "warning",
      message: `Financial health score dropped ${drop} points. Review your recent financial activity.`,
      alertAdvisor: false,
    });
  }

  return warnings;
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveHealthScore(userId: number, result: HealthScoreResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(healthScores).values({
    userId,
    totalScore: result.totalScore,
    spendScore: result.spendScore,
    saveScore: result.saveScore,
    borrowScore: result.borrowScore,
    planScore: result.planScore,
    status: result.status,
    insightsJson: JSON.stringify(result.insights),
    recommendationsJson: JSON.stringify(result.recommendations),
  });
}

export async function getLatestHealthScore(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(healthScores)
    .where(eq(healthScores.userId, userId))
    .orderBy(desc(healthScores.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function getHealthScoreHistory(userId: number, months: number = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(healthScores)
    .where(and(eq(healthScores.userId, userId), gte(healthScores.createdAt, since)))
    .orderBy(desc(healthScores.createdAt));
}
