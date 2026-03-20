/**
 * COI Network Intelligence (B8) — Center of Influence Management
 * 
 * Tracks referral relationships with CPAs, attorneys, insurance agents,
 * and other professionals. Monitors reciprocity and suggests introductions.
 */
import { getDb } from "./db";
import { coiContacts, referrals } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── COI CONTACTS ───────────────────────────────────────────────
export async function addCoiContact(data: typeof coiContacts.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(coiContacts).values(data).$returningId();
  return result;
}

export async function getCoiContacts(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coiContacts)
    .where(eq(coiContacts.professionalId, professionalId))
    .orderBy(desc(coiContacts.updatedAt));
}

export async function updateCoiContact(id: number, professionalId: number, data: Partial<typeof coiContacts.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const { professionalId: _, ...rest } = data;
  await db.update(coiContacts).set(rest).where(
    and(eq(coiContacts.id, id), eq(coiContacts.professionalId, professionalId))
  );
}

export async function deleteCoiContact(id: number, professionalId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(coiContacts).where(
    and(eq(coiContacts.id, id), eq(coiContacts.professionalId, professionalId))
  );
}

// ─── REFERRALS ──────────────────────────────────────────────────
export async function addReferral(data: typeof referrals.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(referrals).values(data).$returningId();
  // Update referral counts
  await db.update(coiContacts).set({
    referralsSent: (await db.select().from(referrals)
      .where(and(eq(referrals.fromProfessionalId, data.fromProfessionalId), eq(referrals.toCoiId, data.toCoiId)))).length,
  }).where(eq(coiContacts.id, data.toCoiId));
  return result;
}

export async function getReferrals(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals)
    .where(eq(referrals.fromProfessionalId, professionalId))
    .orderBy(desc(referrals.createdAt));
}

export async function updateReferralOutcome(id: number, outcome: "pending" | "accepted" | "completed" | "declined") {
  const db = await getDb();
  if (!db) return;
  await db.update(referrals).set({ outcome }).where(eq(referrals.id, id));
}

// ─── NETWORK ANALYTICS ─────────────────────────────────────────
export interface NetworkAnalytics {
  totalContacts: number;
  bySpecialty: Record<string, number>;
  byStrength: Record<string, number>;
  totalReferralsSent: number;
  totalReferralsReceived: number;
  reciprocityScore: number; // 0-100
  dormantContacts: number; // No activity in 90 days
}

export async function getNetworkAnalytics(professionalId: number): Promise<NetworkAnalytics> {
  const contacts = await getCoiContacts(professionalId);
  const refs = await getReferrals(professionalId);

  const bySpecialty: Record<string, number> = {};
  const byStrength: Record<string, number> = {};
  let totalSent = 0;
  let totalReceived = 0;

  for (const c of contacts) {
    bySpecialty[c.specialty] = (bySpecialty[c.specialty] || 0) + 1;
    byStrength[c.relationshipStrength || "new"] = (byStrength[c.relationshipStrength || "new"] || 0) + 1;
    totalSent += c.referralsSent || 0;
    totalReceived += c.referralsReceived || 0;
  }

  const reciprocityScore = totalSent + totalReceived > 0
    ? Math.round((Math.min(totalSent, totalReceived) / Math.max(totalSent, totalReceived)) * 100)
    : 0;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const dormant = contacts.filter(c => new Date(c.updatedAt) < ninetyDaysAgo).length;

  return {
    totalContacts: contacts.length,
    bySpecialty,
    byStrength,
    totalReferralsSent: totalSent,
    totalReferralsReceived: totalReceived,
    reciprocityScore,
    dormantContacts: dormant,
  };
}
