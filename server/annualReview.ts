import { getDb } from "./db";
import { annualReviews } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface ReviewInput {
  userId: number;
  professionalId?: number;
  year: number;
  // Financial snapshot
  totalAssets: number;
  totalLiabilities: number;
  annualIncome: number;
  annualExpenses: number;
  investmentReturns: number; // percentage
  // Goals progress
  goalsProgress: GoalProgress[];
  // Life changes
  lifeChanges: string[];
  // Insurance review
  insurancePolicies: InsuranceSnapshot[];
  // Estate planning
  estateDocsCurrent: boolean;
  beneficiariesReviewed: boolean;
}

export interface GoalProgress {
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  onTrack: boolean;
}

export interface InsuranceSnapshot {
  type: string;
  provider: string;
  coverage: number;
  premium: number;
  expirationDate?: string;
  adequate: boolean;
}

export interface ReviewPacket {
  year: number;
  generatedAt: string;
  sections: ReviewSection[];
  overallScore: number; // 0-100
  keyFindings: string[];
  actionItems: ActionItem[];
  nextReviewDate: string;
}

export interface ReviewSection {
  title: string;
  score: number; // 0-100
  status: "excellent" | "good" | "needs_attention" | "critical";
  summary: string;
  details: string[];
}

export interface ActionItem {
  priority: "high" | "medium" | "low";
  category: string;
  description: string;
  deadline?: string;
}

// ─── Review Generation ─────────────────────────────────────────
export function generateAnnualReview(input: ReviewInput): ReviewPacket {
  const sections: ReviewSection[] = [];
  const actionItems: ActionItem[] = [];
  const keyFindings: string[] = [];

  // 1. Net Worth Analysis
  const netWorth = input.totalAssets - input.totalLiabilities;
  const debtToAsset = input.totalAssets > 0 ? input.totalLiabilities / input.totalAssets : 1;
  const nwScore = debtToAsset < 0.2 ? 90 : debtToAsset < 0.4 ? 70 : debtToAsset < 0.6 ? 50 : 30;
  sections.push({
    title: "Net Worth",
    score: nwScore,
    status: nwScore >= 80 ? "excellent" : nwScore >= 60 ? "good" : nwScore >= 40 ? "needs_attention" : "critical",
    summary: `Net worth: $${netWorth.toLocaleString()}. Debt-to-asset ratio: ${(debtToAsset * 100).toFixed(1)}%.`,
    details: [
      `Total assets: $${input.totalAssets.toLocaleString()}`,
      `Total liabilities: $${input.totalLiabilities.toLocaleString()}`,
      `Debt-to-asset ratio: ${(debtToAsset * 100).toFixed(1)}%`,
    ],
  });
  if (debtToAsset > 0.5) {
    actionItems.push({ priority: "high", category: "Debt", description: "Develop debt reduction strategy — debt-to-asset ratio exceeds 50%", deadline: "Q1" });
    keyFindings.push("Debt-to-asset ratio is elevated and should be addressed");
  }

  // 2. Cash Flow
  const savingsRate = input.annualIncome > 0 ? (input.annualIncome - input.annualExpenses) / input.annualIncome : 0;
  const cfScore = savingsRate >= 0.2 ? 90 : savingsRate >= 0.1 ? 70 : savingsRate >= 0.05 ? 50 : 25;
  sections.push({
    title: "Cash Flow & Savings",
    score: cfScore,
    status: cfScore >= 80 ? "excellent" : cfScore >= 60 ? "good" : cfScore >= 40 ? "needs_attention" : "critical",
    summary: `Savings rate: ${(savingsRate * 100).toFixed(1)}%. Annual surplus: $${(input.annualIncome - input.annualExpenses).toLocaleString()}.`,
    details: [
      `Annual income: $${input.annualIncome.toLocaleString()}`,
      `Annual expenses: $${input.annualExpenses.toLocaleString()}`,
      `Savings rate: ${(savingsRate * 100).toFixed(1)}%`,
    ],
  });
  if (savingsRate < 0.1) {
    actionItems.push({ priority: "high", category: "Savings", description: "Increase savings rate to at least 10% of income" });
    keyFindings.push("Savings rate is below recommended 10% threshold");
  }

  // 3. Investment Performance
  const invScore = input.investmentReturns >= 8 ? 85 : input.investmentReturns >= 5 ? 70 : input.investmentReturns >= 0 ? 50 : 25;
  sections.push({
    title: "Investment Performance",
    score: invScore,
    status: invScore >= 80 ? "excellent" : invScore >= 60 ? "good" : invScore >= 40 ? "needs_attention" : "critical",
    summary: `Portfolio return: ${input.investmentReturns.toFixed(1)}% for ${input.year}.`,
    details: [
      `Annual return: ${input.investmentReturns.toFixed(1)}%`,
      `Market context: Returns should be evaluated against appropriate benchmarks`,
    ],
  });

  // 4. Goals Progress
  const onTrackGoals = input.goalsProgress.filter(g => g.onTrack).length;
  const totalGoals = input.goalsProgress.length;
  const goalScore = totalGoals > 0 ? Math.round((onTrackGoals / totalGoals) * 100) : 50;
  sections.push({
    title: "Goals Progress",
    score: goalScore,
    status: goalScore >= 80 ? "excellent" : goalScore >= 60 ? "good" : goalScore >= 40 ? "needs_attention" : "critical",
    summary: `${onTrackGoals} of ${totalGoals} goals on track.`,
    details: input.goalsProgress.map(g => {
      const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount * 100).toFixed(0) : "0";
      return `${g.goalName}: ${pct}% funded ($${g.currentAmount.toLocaleString()} / $${g.targetAmount.toLocaleString()}) — ${g.onTrack ? "On Track" : "Behind"}`;
    }),
  });
  const behindGoals = input.goalsProgress.filter(g => !g.onTrack);
  for (const g of behindGoals) {
    actionItems.push({ priority: "medium", category: "Goals", description: `Review funding strategy for "${g.goalName}" — currently behind target` });
  }
  if (behindGoals.length > 0) keyFindings.push(`${behindGoals.length} goal(s) are behind schedule`);

  // 5. Insurance Review
  const inadequatePolicies = input.insurancePolicies.filter(p => !p.adequate);
  const insScore = inadequatePolicies.length === 0 ? 85 : inadequatePolicies.length <= 1 ? 60 : 35;
  sections.push({
    title: "Insurance Coverage",
    score: insScore,
    status: insScore >= 80 ? "excellent" : insScore >= 60 ? "good" : insScore >= 40 ? "needs_attention" : "critical",
    summary: `${input.insurancePolicies.length} policies reviewed. ${inadequatePolicies.length} need attention.`,
    details: input.insurancePolicies.map(p => `${p.type}: $${p.coverage.toLocaleString()} coverage, $${p.premium.toLocaleString()}/yr — ${p.adequate ? "Adequate" : "REVIEW NEEDED"}`),
  });
  for (const p of inadequatePolicies) {
    actionItems.push({ priority: "high", category: "Insurance", description: `Review ${p.type} coverage — currently inadequate` });
  }

  // 6. Estate Planning
  const estateScore = input.estateDocsCurrent && input.beneficiariesReviewed ? 90 : input.estateDocsCurrent ? 65 : 30;
  sections.push({
    title: "Estate Planning",
    score: estateScore,
    status: estateScore >= 80 ? "excellent" : estateScore >= 60 ? "good" : estateScore >= 40 ? "needs_attention" : "critical",
    summary: `Documents ${input.estateDocsCurrent ? "current" : "need updating"}. Beneficiaries ${input.beneficiariesReviewed ? "reviewed" : "need review"}.`,
    details: [
      `Estate documents: ${input.estateDocsCurrent ? "Current" : "Need updating"}`,
      `Beneficiary designations: ${input.beneficiariesReviewed ? "Reviewed" : "Need review"}`,
    ],
  });
  if (!input.estateDocsCurrent) {
    actionItems.push({ priority: "high", category: "Estate", description: "Update estate planning documents" });
    keyFindings.push("Estate planning documents are out of date");
  }
  if (!input.beneficiariesReviewed) {
    actionItems.push({ priority: "medium", category: "Estate", description: "Review and update beneficiary designations" });
  }

  // 7. Life Changes
  if (input.lifeChanges.length > 0) {
    sections.push({
      title: "Life Changes",
      score: 50, // Neutral — changes need assessment
      status: "needs_attention",
      summary: `${input.lifeChanges.length} life change(s) reported this year that may impact your financial plan.`,
      details: input.lifeChanges.map(c => `• ${c}`),
    });
    keyFindings.push(`${input.lifeChanges.length} life change(s) may require plan adjustments`);
    for (const change of input.lifeChanges) {
      actionItems.push({ priority: "medium", category: "Life Changes", description: `Assess financial impact of: ${change}` });
    }
  }

  // Overall score
  const overallScore = Math.round(sections.reduce((sum, s) => sum + s.score, 0) / sections.length);

  if (keyFindings.length === 0) keyFindings.push("Financial plan is on track across all major dimensions");

  return {
    year: input.year,
    generatedAt: new Date().toISOString(),
    sections,
    overallScore,
    keyFindings,
    actionItems: actionItems.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    }),
    nextReviewDate: `${input.year + 1}-01-15`,
  };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveReviewPacket(userId: number, packet: ReviewPacket) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(annualReviews).values({
    clientId: userId,
    professionalId: 0,
    phase: "document",
    status: "completed",
    completedDate: new Date(),
    prepReportJson: JSON.stringify({ year: packet.year, overallScore: packet.overallScore, sections: packet.sections, keyFindings: packet.keyFindings }),
    actionItemsJson: JSON.stringify(packet.actionItems),
  });
}

export async function getUserReviews(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(annualReviews)
    .where(eq(annualReviews.clientId, userId))
    .orderBy(desc(annualReviews.createdAt));
}
