/**
 * P1-3: CE Credit Issuance Pipeline
 * Dual-track: self-serve issuance + partnership placeholder
 */
import { getDb } from "../../db";
import { ceCredits } from "../../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function issueCeCredit(params: {
  userId: number;
  trackId: number;
  creditsEarned: number;
  creditType?: "self_serve" | "partnership";
  issuer?: string;
  notes?: string;
}) {
  const db = (await getDb())!;
  const [existing] = await db
    .select()
    .from(ceCredits)
    .where(and(eq(ceCredits.userId, params.userId), eq(ceCredits.trackId, params.trackId), eq(ceCredits.status, "issued")))
    .limit(1);

  if (existing) {
    return { success: false, error: "CE credit already issued for this track", existing };
  }

  const [result] = await db.insert(ceCredits).values({
    userId: params.userId,
    trackId: params.trackId,
    creditsEarned: String(params.creditsEarned),
    creditType: params.creditType || "self_serve",
    status: "issued",
    issuedAt: new Date(),
    issuer: params.issuer || "Stewardly Learning Platform",
    notes: params.notes || null,
  });

  return { success: true, creditId: result.insertId };
}

export async function revokeCeCredit(creditId: number, reason: string) {
  const db = (await getDb())!;
  await db
    .update(ceCredits)
    .set({ status: "revoked", notes: reason })
    .where(eq(ceCredits.id, creditId));
  return { success: true };
}

export async function listUserCredits(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(ceCredits)
    .where(eq(ceCredits.userId, userId))
    .orderBy(desc(ceCredits.createdAt));
}

export async function getCreditSummary(userId: number) {
  const db = (await getDb())!;
  const credits = await db
    .select()
    .from(ceCredits)
    .where(and(eq(ceCredits.userId, userId), eq(ceCredits.status, "issued")));

  const totalCredits = credits.reduce((sum, c) => sum + parseFloat(c.creditsEarned), 0);
  return {
    totalCredits,
    creditCount: credits.length,
    credits,
  };
}

export async function verifyCeCredit(creditId: number) {
  const db = (await getDb())!;
  const [credit] = await db
    .select()
    .from(ceCredits)
    .where(eq(ceCredits.id, creditId))
    .limit(1);

  if (!credit) return { valid: false, error: "Credit not found" };
  if (credit.status !== "issued") return { valid: false, error: `Credit status: ${credit.status}` };
  if (credit.expiresAt && credit.expiresAt < new Date()) return { valid: false, error: "Credit expired" };

  return { valid: true, credit };
}
