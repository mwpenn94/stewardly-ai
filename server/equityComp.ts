/**
 * Equity Compensation Navigator (D8) — Stock Options & RSU Planning
 * 
 * Tracks ISO/NSO/RSU/ESPP grants, models exercise scenarios,
 * calculates AMT exposure, and optimizes exercise timing.
 */
import { getDb } from "./db";
import { equityGrants } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── CRUD ───────────────────────────────────────────────────────
export async function addGrant(data: typeof equityGrants.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(equityGrants).values(data).$returningId();
  return result;
}

export async function getGrants(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(equityGrants).where(eq(equityGrants.userId, userId)).orderBy(desc(equityGrants.updatedAt));
}

export async function updateGrant(id: number, userId: number, data: Partial<typeof equityGrants.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const { userId: _, ...rest } = data;
  await db.update(equityGrants).set(rest).where(eq(equityGrants.id, id));
}

export async function deleteGrant(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(equityGrants).where(eq(equityGrants.id, id));
}

// ─── EXERCISE SCENARIO MODELING ─────────────────────────────────
interface ExerciseScenario {
  name: string;
  sharesExercised: number;
  exerciseCost: number;
  currentValue: number;
  spread: number;
  ordinaryIncomeTax: number;
  amtExposure: number;
  capitalGainsTax: number;
  netProceeds: number;
  holdingPeriod: string;
}

export function modelExerciseScenario(
  grant: {
    grantType: string;
    exercisePrice: number | null;
    currentFMV: number | null;
    sharesVested: number | null;
    sharesExercised: number | null;
  },
  sharesToExercise: number,
  agi: number,
  holdAndSell: "immediate" | "short_term" | "long_term" = "immediate",
): ExerciseScenario {
  const exercisePrice = grant.exercisePrice || 0;
  const fmv = grant.currentFMV || 0;
  const spread = fmv - exercisePrice;
  const totalSpread = spread * sharesToExercise;
  const exerciseCost = exercisePrice * sharesToExercise;
  const currentValue = fmv * sharesToExercise;

  let ordinaryIncomeTax = 0;
  let amtExposure = 0;
  let capitalGainsTax = 0;

  // Estimate marginal tax rate based on AGI
  const marginalRate = agi > 578125 ? 0.37 : agi > 231250 ? 0.35 : agi > 182100 ? 0.32 : agi > 95375 ? 0.24 : 0.22;
  const ltcgRate = agi > 492300 ? 0.20 : agi > 44625 ? 0.15 : 0;

  switch (grant.grantType) {
    case "iso":
      if (holdAndSell === "immediate") {
        // Disqualifying disposition — taxed as ordinary income
        ordinaryIncomeTax = totalSpread * marginalRate;
      } else if (holdAndSell === "short_term") {
        // Still disqualifying if < 1 year from exercise or < 2 years from grant
        ordinaryIncomeTax = totalSpread * marginalRate;
      } else {
        // Qualifying disposition — LTCG rates
        amtExposure = totalSpread * 0.28; // AMT rate on ISO spread
        capitalGainsTax = totalSpread * ltcgRate;
      }
      break;
    case "nso":
      // Always ordinary income on spread at exercise
      ordinaryIncomeTax = totalSpread * marginalRate;
      if (holdAndSell === "long_term") {
        // Additional gains above FMV at exercise get LTCG
        // (simplified — assumes no price change after exercise for this model)
      }
      break;
    case "rsu":
      // Taxed as ordinary income at vesting
      ordinaryIncomeTax = currentValue * marginalRate;
      break;
    case "espp":
      // Discount portion is ordinary income, rest is capital gains
      const discount = Math.min(exercisePrice * 0.15, spread) * sharesToExercise;
      ordinaryIncomeTax = discount * marginalRate;
      if (holdAndSell === "long_term") {
        capitalGainsTax = (totalSpread - discount) * ltcgRate;
      } else {
        ordinaryIncomeTax = totalSpread * marginalRate;
      }
      break;
  }

  const totalTax = ordinaryIncomeTax + amtExposure + capitalGainsTax;
  const netProceeds = currentValue - exerciseCost - totalTax;

  return {
    name: `${grant.grantType.toUpperCase()} — ${holdAndSell} sale`,
    sharesExercised: sharesToExercise,
    exerciseCost: Math.round(exerciseCost * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    spread: Math.round(totalSpread * 100) / 100,
    ordinaryIncomeTax: Math.round(ordinaryIncomeTax * 100) / 100,
    amtExposure: Math.round(amtExposure * 100) / 100,
    capitalGainsTax: Math.round(capitalGainsTax * 100) / 100,
    netProceeds: Math.round(netProceeds * 100) / 100,
    holdingPeriod: holdAndSell,
  };
}

export function compareExerciseStrategies(
  grant: Parameters<typeof modelExerciseScenario>[0],
  sharesToExercise: number,
  agi: number,
): ExerciseScenario[] {
  return [
    modelExerciseScenario(grant, sharesToExercise, agi, "immediate"),
    modelExerciseScenario(grant, sharesToExercise, agi, "short_term"),
    modelExerciseScenario(grant, sharesToExercise, agi, "long_term"),
  ];
}
