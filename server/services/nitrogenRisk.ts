/**
 * Nitrogen (formerly Riskalyze) Risk Profile Service
 * Phase 3 of Prompt 2: Risk tolerance integration
 */
import { getDb } from "../db";
import { nitrogenRiskProfiles } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../_core/logger";

export interface RiskProfile {
  userId: number;
  riskNumber: number;
  riskCategory: string;
  equityAllocation: number;
  fixedIncomeAllocation: number;
  alternativesAllocation: number;
  cashAllocation: number;
  maxDrawdownTolerance: number;
  timeHorizon: string;
}

function getRiskCategory(riskNumber: number): string {
  if (riskNumber <= 20) return "Conservative";
  if (riskNumber <= 40) return "Moderately Conservative";
  if (riskNumber <= 60) return "Moderate";
  if (riskNumber <= 80) return "Moderately Aggressive";
  return "Aggressive";
}

function getSuggestedAllocation(riskNumber: number): { equity: number; fixed: number; alternatives: number; cash: number } {
  if (riskNumber <= 20) return { equity: 20, fixed: 55, alternatives: 10, cash: 15 };
  if (riskNumber <= 40) return { equity: 40, fixed: 40, alternatives: 10, cash: 10 };
  if (riskNumber <= 60) return { equity: 60, fixed: 25, alternatives: 10, cash: 5 };
  if (riskNumber <= 80) return { equity: 75, fixed: 15, alternatives: 8, cash: 2 };
  return { equity: 90, fixed: 5, alternatives: 4, cash: 1 };
}

function getMaxDrawdown(riskNumber: number): number {
  return Math.round(riskNumber * 0.5);
}

// ─── Nitrogen API Integration ─────────────────────────────────────────────

interface NitrogenConfig {
  apiKey: string;
  baseUrl: string;
}

async function getNitrogenConfig(): Promise<NitrogenConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const { integrationConnections } = await import("../../drizzle/schema");
  const { decrypt } = await import("./encryption");

  const conn = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.providerId, "nitrogen"))
    .limit(1);

  if (conn.length === 0 || !conn[0].credentialsEncrypted) return null;

  try {
    const creds = JSON.parse(decrypt(conn[0].credentialsEncrypted));
    return {
      apiKey: creds.apiKey || creds.api_key || "",
      baseUrl: creds.baseUrl || "https://api.riskalyze.com/v1",
    };
  } catch {
    return null;
  }
}

export async function fetchRiskProfile(userId: number, clientExternalId?: string): Promise<RiskProfile | null> {
  const config = await getNitrogenConfig();

  if (config) {
    try {
      const response = await fetch(`${config.baseUrl}/clients/${clientExternalId ?? userId}/risk-profile`, {
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        const riskNumber = data.risk_number ?? data.riskNumber ?? 50;
        const alloc = getSuggestedAllocation(riskNumber);

        const profile: RiskProfile = {
          userId,
          riskNumber,
          riskCategory: getRiskCategory(riskNumber),
          equityAllocation: alloc.equity,
          fixedIncomeAllocation: alloc.fixed,
          alternativesAllocation: alloc.alternatives,
          cashAllocation: alloc.cash,
          maxDrawdownTolerance: getMaxDrawdown(riskNumber),
          timeHorizon: data.time_horizon ?? "10+ years",
        };

        await saveRiskProfile(profile);
        return profile;
      }
    } catch (e) {
      logger.warn( { operation: "nitrogen" },"[Nitrogen] API call failed, falling back to cached:", e);
    }
  }

  return getCachedRiskProfile(userId);
}

export async function saveRiskProfile(profile: RiskProfile): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Store the main risk number; the schema has nitrogenRiskNumber, portfolioRiskNumber, riskAlignmentScore
  await db.insert(nitrogenRiskProfiles).values({
    userId: profile.userId,
    nitrogenRiskNumber: profile.riskNumber,
    portfolioRiskNumber: null,
    riskAlignmentScore: null,
    lastSyncedAt: Date.now(),
  });
}

export async function getCachedRiskProfile(userId: number): Promise<RiskProfile | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(nitrogenRiskProfiles)
    .where(eq(nitrogenRiskProfiles.userId, userId))
    .orderBy(desc(nitrogenRiskProfiles.createdAt))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  const riskNumber = row.nitrogenRiskNumber ?? 50;
  const alloc = getSuggestedAllocation(riskNumber);

  return {
    userId: row.userId,
    riskNumber,
    riskCategory: getRiskCategory(riskNumber),
    equityAllocation: alloc.equity,
    fixedIncomeAllocation: alloc.fixed,
    alternativesAllocation: alloc.alternatives,
    cashAllocation: alloc.cash,
    maxDrawdownTolerance: getMaxDrawdown(riskNumber),
    timeHorizon: "10+ years",
  };
}

/**
 * Manual risk assessment when Nitrogen API is not connected.
 */
export async function assessRiskManually(userId: number, answers: {
  age: number;
  investmentExperience: "none" | "beginner" | "intermediate" | "advanced";
  timeHorizon: "1-3" | "3-5" | "5-10" | "10+";
  reactionToLoss: "sell_all" | "sell_some" | "hold" | "buy_more";
  incomeStability: "unstable" | "moderate" | "stable" | "very_stable";
  goalPriority: "preservation" | "income" | "growth" | "aggressive_growth";
}): Promise<RiskProfile> {
  let score = 50;

  if (answers.age < 30) score += 15;
  else if (answers.age < 40) score += 10;
  else if (answers.age < 50) score += 5;
  else if (answers.age < 60) score -= 5;
  else if (answers.age < 70) score -= 15;
  else score -= 25;

  const expScores = { none: -15, beginner: -5, intermediate: 5, advanced: 15 };
  score += expScores[answers.investmentExperience];

  const thScores = { "1-3": -20, "3-5": -10, "5-10": 5, "10+": 15 };
  score += thScores[answers.timeHorizon];

  const lossScores = { sell_all: -20, sell_some: -5, hold: 10, buy_more: 20 };
  score += lossScores[answers.reactionToLoss];

  const incScores = { unstable: -10, moderate: 0, stable: 5, very_stable: 10 };
  score += incScores[answers.incomeStability];

  const goalScores = { preservation: -20, income: -5, growth: 10, aggressive_growth: 20 };
  score += goalScores[answers.goalPriority];

  const riskNumber = Math.max(1, Math.min(99, score));
  const alloc = getSuggestedAllocation(riskNumber);

  const profile: RiskProfile = {
    userId,
    riskNumber,
    riskCategory: getRiskCategory(riskNumber),
    equityAllocation: alloc.equity,
    fixedIncomeAllocation: alloc.fixed,
    alternativesAllocation: alloc.alternatives,
    cashAllocation: alloc.cash,
    maxDrawdownTolerance: getMaxDrawdown(riskNumber),
    timeHorizon: answers.timeHorizon + " years",
  };

  await saveRiskProfile(profile);
  return profile;
}

export async function getRiskProfileHistory(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(nitrogenRiskProfiles)
    .where(eq(nitrogenRiskProfiles.userId, userId))
    .orderBy(desc(nitrogenRiskProfiles.createdAt));
}
