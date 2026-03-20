/**
 * Digital Asset Estate Planning (D13) — Digital Asset Inventory & Legacy Planning
 * 
 * Tracks digital assets (crypto, accounts, subscriptions),
 * monitors access plan completeness, and generates legacy checklists.
 */
import { getDb } from "./db";
import { digitalAssetInventory } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── CRUD ───────────────────────────────────────────────────────
export async function addDigitalAsset(data: typeof digitalAssetInventory.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(digitalAssetInventory).values(data).$returningId();
  return result;
}

export async function getDigitalAssets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(digitalAssetInventory)
    .where(eq(digitalAssetInventory.userId, userId))
    .orderBy(desc(digitalAssetInventory.updatedAt));
}

export async function updateDigitalAsset(id: number, userId: number, data: Partial<typeof digitalAssetInventory.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const { userId: _, ...rest } = data;
  await db.update(digitalAssetInventory).set(rest).where(eq(digitalAssetInventory.id, id));
}

export async function deleteDigitalAsset(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(digitalAssetInventory).where(eq(digitalAssetInventory.id, id));
}

// ─── ESTATE READINESS SCORE ─────────────────────────────────────
export interface EstateReadinessReport {
  totalAssets: number;
  totalEstimatedValue: number;
  withAccessPlan: number;
  withLegacyContact: number;
  readinessScore: number; // 0-100
  missingItems: string[];
  recommendations: string[];
}

export async function calculateEstateReadiness(userId: number): Promise<EstateReadinessReport> {
  const assets = await getDigitalAssets(userId);
  const total = assets.length;
  const withAccess = assets.filter(a => a.hasAccessPlan).length;
  const withLegacy = assets.filter(a => a.legacyContactSet).length;
  const totalValue = assets.reduce((sum, a) => sum + (a.approximateValue || 0), 0);
  const verified = assets.filter(a => {
    if (!a.lastVerified) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(a.lastVerified) > sixMonthsAgo;
  }).length;

  // Score components
  const accessScore = total > 0 ? (withAccess / total) * 40 : 0;
  const legacyScore = total > 0 ? (withLegacy / total) * 30 : 0;
  const verifiedScore = total > 0 ? (verified / total) * 20 : 0;
  const inventoryScore = total >= 5 ? 10 : (total / 5) * 10;
  const readinessScore = Math.round(accessScore + legacyScore + verifiedScore + inventoryScore);

  const missingItems: string[] = [];
  const recommendations: string[] = [];

  if (total === 0) {
    missingItems.push("No digital assets inventoried");
    recommendations.push("Start by listing your major online accounts: banking, brokerage, email, social media, and any crypto wallets.");
  }
  const noAccess = assets.filter(a => !a.hasAccessPlan);
  if (noAccess.length > 0) {
    missingItems.push(`${noAccess.length} asset(s) without access plan`);
    recommendations.push("Document how a trusted person could access each account. Consider using a password manager with emergency access.");
  }
  const noLegacy = assets.filter(a => !a.legacyContactSet);
  if (noLegacy.length > 0) {
    missingItems.push(`${noLegacy.length} asset(s) without legacy contact`);
    recommendations.push("Set up legacy contacts or inactive account managers where platforms support it (Google, Apple, Facebook).");
  }
  const highValue = assets.filter(a => (a.approximateValue || 0) > 10000 && !a.hasAccessPlan);
  if (highValue.length > 0) {
    recommendations.push(`Priority: ${highValue.length} high-value asset(s) (>$10K) lack access plans.`);
  }

  return {
    totalAssets: total,
    totalEstimatedValue: Math.round(totalValue * 100) / 100,
    withAccessPlan: withAccess,
    withLegacyContact: withLegacy,
    readinessScore,
    missingItems,
    recommendations,
  };
}
