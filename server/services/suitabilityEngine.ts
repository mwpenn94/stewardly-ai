import { getDb } from "../db";
import { suitabilityProfiles, suitabilityDimensions, suitabilityChangeEvents, suitabilityQuestionsQueue, suitabilityHouseholdLinks } from "../../drizzle/schema";
import { eq, and, desc, asc, lte, isNull, sql } from "drizzle-orm";
import crypto from "crypto";

// ─── 12-Dimension Suitability Model ─────────────────────────────────────────
export const SUITABILITY_DIMENSIONS = [
  { key: "risk_tolerance", label: "Risk Tolerance", category: "investment", decayRate: 0.005 },
  { key: "time_horizon", label: "Time Horizon", category: "investment", decayRate: 0.002 },
  { key: "liquidity_needs", label: "Liquidity Needs", category: "financial", decayRate: 0.01 },
  { key: "income_stability", label: "Income Stability", category: "financial", decayRate: 0.008 },
  { key: "tax_situation", label: "Tax Situation", category: "financial", decayRate: 0.015 },
  { key: "insurance_coverage", label: "Insurance Coverage", category: "protection", decayRate: 0.005 },
  { key: "estate_planning", label: "Estate Planning", category: "protection", decayRate: 0.003 },
  { key: "debt_profile", label: "Debt Profile", category: "financial", decayRate: 0.01 },
  { key: "life_stage", label: "Life Stage", category: "personal", decayRate: 0.001 },
  { key: "financial_knowledge", label: "Financial Knowledge", category: "personal", decayRate: 0.002 },
  { key: "goals_alignment", label: "Goals Alignment", category: "planning", decayRate: 0.008 },
  { key: "behavioral_tendencies", label: "Behavioral Tendencies", category: "behavioral", decayRate: 0.003 },
] as const;

type DimensionKey = typeof SUITABILITY_DIMENSIONS[number]["key"];

// ─── Profile Management ─────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: number, organizationId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(suitabilityProfiles)
    .where(eq(suitabilityProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const id = crypto.randomUUID();
  await db.insert(suitabilityProfiles).values({
    id,
    userId: userId,
    organizationId: organizationId ?? null,
    overallScore: null,
    confidenceLevel: 0,
    dataCompleteness: 0,
    status: "draft",
  });

  // Initialize all 12 dimensions
  for (const dim of SUITABILITY_DIMENSIONS) {
    await db.insert(suitabilityDimensions).values({
      id: crypto.randomUUID(),
      profileId: id,
      dimensionKey: dim.key,
      dimensionLabel: dim.label,
      value: null,
      score: null,
      confidence: 0,
      sources: JSON.stringify([]),
      decayRate: dim.decayRate,
    });
  }

  const [profile] = await db.select().from(suitabilityProfiles)
    .where(eq(suitabilityProfiles.id, id));
  return profile;
}

export async function getProfileWithDimensions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const profile = await getOrCreateProfile(userId);
  const dimensions = await db.select().from(suitabilityDimensions)
    .where(eq(suitabilityDimensions.profileId, profile.id));
  return { ...profile, dimensions };
}

// ─── Dimension Updates ──────────────────────────────────────────────────────

export async function updateDimension(
  profileId: string,
  dimensionKey: DimensionKey,
  value: unknown,
  score: number,
  confidence: number,
  source: string,
  triggeredBy?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [dim] = await db.select().from(suitabilityDimensions)
    .where(and(
      eq(suitabilityDimensions.profileId, profileId),
      eq(suitabilityDimensions.dimensionKey, dimensionKey),
    ));

  if (!dim) return null;

  // Record change event
  await db.insert(suitabilityChangeEvents).values({
    id: crypto.randomUUID(),
    profileId,
    dimensionKey,
    changeType: triggeredBy ? "advisor_update" : "user_input",
    previousValue: dim.value,
    newValue: JSON.stringify(value),
    source,
    confidence,
    triggeredBy: triggeredBy ?? null,
  });

  // Update dimension
  const existingSources: string[] = Array.isArray(dim.sources) ? dim.sources : [];
  const updatedSources = Array.from(new Set([...existingSources, source]));

  await db.update(suitabilityDimensions)
    .set({
      value: JSON.stringify(value),
      score,
      confidence: Math.min(1, confidence),
      sources: JSON.stringify(updatedSources),
      lastUpdatedAt: new Date(),
    })
    .where(eq(suitabilityDimensions.id, dim.id));

  return dim;
}

// ─── Synthesis (Aggregate all dimensions into overall profile) ──────────────

export async function synthesizeProfile(profileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const dimensions = await db.select().from(suitabilityDimensions)
    .where(eq(suitabilityDimensions.profileId, profileId));

  const scored = dimensions.filter((d: any) => d.score !== null);
  if (scored.length === 0) return null;

  const totalWeight = scored.reduce((sum: number, d: any) => sum + (d.confidence ?? 0), 0);
  const weightedScore = scored.reduce((sum: number, d: any) => sum + (d.score ?? 0) * (d.confidence ?? 0), 0);
  const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const dataCompleteness = scored.length / SUITABILITY_DIMENSIONS.length;
  const avgConfidence = scored.reduce((sum: number, d: any) => sum + (d.confidence ?? 0), 0) / scored.length;

  const dimensionScores: Record<string, number> = {};
  for (const d of dimensions) {
    dimensionScores[d.dimensionKey] = d.score ?? 0;
  }

  await db!.update(suitabilityProfiles)
    .set({
      overallScore,
      confidenceLevel: avgConfidence,
      dataCompleteness,
      lastSynthesizedAt: new Date(),
      synthesisVersion: sql`${suitabilityProfiles.synthesisVersion} + 1`,
      dimensionScores: JSON.stringify(dimensionScores),
      status: dataCompleteness >= 0.5 ? "active" : "draft",
    })
    .where(eq(suitabilityProfiles.id, profileId));

  return { overallScore, confidenceLevel: avgConfidence, dataCompleteness, dimensionScores };
}

// ─── Confidence Decay ───────────────────────────────────────────────────────

export async function applyConfidenceDecay() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const allDimensions = await db.select().from(suitabilityDimensions)
    .where(sql`${suitabilityDimensions.confidence} > 0`);

  let decayed = 0;
  for (const dim of allDimensions) {
    const daysSinceUpdate = (Date.now() - new Date(dim.lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 1) continue;

    const decay = (dim.decayRate ?? 0.01) * daysSinceUpdate;
    const newConfidence = Math.max(0, (dim.confidence ?? 0) - decay);

    if (Math.abs(newConfidence - (dim.confidence ?? 0)) > 0.001) {
      await db.update(suitabilityDimensions)
        .set({ confidence: newConfidence })
        .where(eq(suitabilityDimensions.id, dim.id));
      decayed++;
    }
  }
  return { decayed };
}

// ─── Progressive Profiling Questions ────────────────────────────────────────

export async function generateQuestions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const profile = await getOrCreateProfile(userId);
  const dimensions = await db.select().from(suitabilityDimensions)
    .where(eq(suitabilityDimensions.profileId, profile.id))
    .orderBy(asc(suitabilityDimensions.confidence));

  // Find lowest-confidence dimensions that need data
  const needsData = dimensions.filter((d: any) => (d.confidence ?? 0) < 0.5).slice(0, 3);

  const questions = needsData.map((dim: any) => ({
    id: crypto.randomUUID(),
    userId,
    dimensionKey: dim.dimensionKey,
    question: getQuestionForDimension(dim.dimensionKey),
    questionType: "multiple_choice" as const,
    options: JSON.stringify(getOptionsForDimension(dim.dimensionKey)),
    priority: Math.round((1 - (dim.confidence ?? 0)) * 100),
    status: "pending" as const,
  }));

  // Insert questions
  for (const q of questions) {
    await db.insert(suitabilityQuestionsQueue).values(q);
  }

  return questions;
}

export async function getPendingQuestions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(suitabilityQuestionsQueue)
    .where(and(
      eq(suitabilityQuestionsQueue.userId, userId),
      eq(suitabilityQuestionsQueue.status, "pending"),
    ))
    .orderBy(desc(suitabilityQuestionsQueue.priority))
    .limit(5);
}

// ─── Household Links ────────────────────────────────────────────────────────

export async function linkHousehold(primaryUserId: number, linkedUserId: number, relationship: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = crypto.randomUUID();
  await db.insert(suitabilityHouseholdLinks).values({
    id,
    primaryUserId,
    linkedUserId,
    relationship: relationship as any,
    sharedDimensions: JSON.stringify(["life_stage", "tax_situation", "estate_planning"]),
    isActive: true,
  });
  return id;
}

export async function getHouseholdMembers(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(suitabilityHouseholdLinks)
    .where(eq(suitabilityHouseholdLinks.primaryUserId, userId));
}

// ─── Change History ─────────────────────────────────────────────────────────

export async function getChangeHistory(profileId: string, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(suitabilityChangeEvents)
    .where(eq(suitabilityChangeEvents.profileId, profileId))
    .orderBy(desc(suitabilityChangeEvents.createdAt))
    .limit(limit);
}

// ─── Helper: Questions per dimension ────────────────────────────────────────

function getQuestionForDimension(key: string): string {
  const questions: Record<string, string> = {
    risk_tolerance: "How would you describe your comfort level with investment risk?",
    time_horizon: "When do you expect to need access to your invested funds?",
    liquidity_needs: "How important is it to have quick access to your money?",
    income_stability: "How stable and predictable is your current income?",
    tax_situation: "What is your current tax filing status and approximate bracket?",
    insurance_coverage: "How would you rate your current insurance coverage?",
    estate_planning: "Have you completed any estate planning documents?",
    debt_profile: "How would you describe your current debt situation?",
    life_stage: "Which life stage best describes your current situation?",
    financial_knowledge: "How would you rate your financial knowledge?",
    goals_alignment: "What are your top financial priorities right now?",
    behavioral_tendencies: "How do you typically react when markets decline significantly?",
  };
  return questions[key] || "Tell us more about your financial situation.";
}

function getOptionsForDimension(key: string): string[] {
  const options: Record<string, string[]> = {
    risk_tolerance: ["Very conservative", "Conservative", "Moderate", "Aggressive", "Very aggressive"],
    time_horizon: ["Less than 1 year", "1-3 years", "3-5 years", "5-10 years", "10+ years"],
    liquidity_needs: ["Very high — need access anytime", "High", "Moderate", "Low", "Very low — can lock up funds"],
    income_stability: ["Very stable (salary/pension)", "Mostly stable", "Variable", "Unstable", "No current income"],
    tax_situation: ["0-12% bracket", "12-22% bracket", "22-32% bracket", "32-37% bracket", "37%+ bracket"],
    insurance_coverage: ["Fully covered", "Mostly covered", "Partially covered", "Minimally covered", "No coverage"],
    estate_planning: ["Complete plan", "Partial plan", "Just a will", "Nothing yet", "Not sure"],
    debt_profile: ["Debt-free", "Low debt", "Moderate debt", "High debt", "Overwhelming debt"],
    life_stage: ["Starting career", "Building career", "Peak earning", "Pre-retirement", "Retired"],
    financial_knowledge: ["Expert", "Advanced", "Intermediate", "Basic", "Beginner"],
    goals_alignment: ["Retirement savings", "Wealth building", "Debt reduction", "Education funding", "Estate transfer"],
    behavioral_tendencies: ["Buy more (opportunity)", "Hold steady", "Get nervous but hold", "Sell some", "Sell everything"],
  };
  return options[key] || ["Option A", "Option B", "Option C"];
}
