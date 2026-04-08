/**
 * EMBA Learning — licensure & CE credit tracking service.
 *
 * Wraps the `learning_licenses` and `learning_ce_credits` tables with
 * graceful degradation: if the DB is unavailable (unit tests, cold
 * start) every function returns an empty list / no-op rather than
 * throwing, so the Learning Home UI and the ReAct agent still work.
 *
 * This is the data layer for:
 *   - the /learning/licenses React page
 *   - the `check_license_status` ReAct agent tool
 *   - the weekly licenseLifecycle cron job
 */

import { getDb } from "../../db";
import {
  learningLicenses,
  learningCeCredits,
  type LearningLicense,
} from "../../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/licenses" });

export interface LicenseAlert {
  licenseId: number;
  licenseType: string;
  alertType: "expiration_warning" | "ce_credits_needed" | "expired";
  daysOut: number | null;
  message: string;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

export function daysUntil(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const target = typeof date === "string" ? new Date(date) : date;
  if (isNaN(target.getTime())) return null;
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Pure: derive alert entries from license rows. Split from the DB read
 * so it is trivially testable.
 */
export function deriveLicenseAlerts(
  licenses: Array<Pick<LearningLicense, "id" | "licenseType" | "status" | "expirationDate" | "ceDeadline" | "ceCreditsRequired" | "ceCreditsCompleted">>,
  now = new Date(),
): LicenseAlert[] {
  const alerts: LicenseAlert[] = [];
  for (const lic of licenses) {
    // Already expired
    if (lic.status === "expired") {
      alerts.push({
        licenseId: lic.id,
        licenseType: lic.licenseType,
        alertType: "expired",
        daysOut: null,
        message: `${lic.licenseType} is expired — renewal required.`,
      });
      continue;
    }

    // Expiration approaching (180 days)
    const expDays = daysUntil(lic.expirationDate as any, now);
    if (expDays !== null && expDays >= 0 && expDays < 180) {
      alerts.push({
        licenseId: lic.id,
        licenseType: lic.licenseType,
        alertType: "expiration_warning",
        daysOut: expDays,
        message: `${lic.licenseType} expires in ${expDays} days.`,
      });
    }

    // CE credits insufficient + deadline within 90 days
    const ceDays = daysUntil(lic.ceDeadline as any, now);
    const required = lic.ceCreditsRequired ?? 0;
    const completed = lic.ceCreditsCompleted ?? 0;
    if (required > completed && ceDays !== null && ceDays >= 0 && ceDays < 90) {
      alerts.push({
        licenseId: lic.id,
        licenseType: lic.licenseType,
        alertType: "ce_credits_needed",
        daysOut: ceDays,
        message: `${required - completed} CE credits needed in ${ceDays} days for ${lic.licenseType}.`,
      });
    }
  }
  return alerts;
}

// ─── DB-backed operations ────────────────────────────────────────────────

export async function getUserLicenses(userId: number): Promise<LearningLicense[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(learningLicenses).where(eq(learningLicenses.userId, userId));
  } catch (err) {
    log.warn({ err: String(err) }, "getUserLicenses failed");
    return [];
  }
}

export async function addLicense(data: {
  userId: number;
  licenseType: string;
  licenseState?: string | null;
  licenseNumber?: string | null;
  issueDate?: Date | null;
  expirationDate?: Date | null;
  status?: "active" | "expired" | "pending" | "suspended";
  ceCreditsRequired?: number;
  ceCreditsCompleted?: number;
  ceDeadline?: Date | null;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningLicenses).values({
      userId: data.userId,
      licenseType: data.licenseType,
      licenseState: data.licenseState ?? null,
      licenseNumber: data.licenseNumber ?? null,
      issueDate: data.issueDate ? (data.issueDate.toISOString().slice(0, 10) as any) : null,
      expirationDate: data.expirationDate ? (data.expirationDate.toISOString().slice(0, 10) as any) : null,
      status: data.status ?? "active",
      ceCreditsRequired: data.ceCreditsRequired ?? 0,
      ceCreditsCompleted: data.ceCreditsCompleted ?? 0,
      ceDeadline: data.ceDeadline ? (data.ceDeadline.toISOString().slice(0, 10) as any) : null,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "addLicense failed");
    return null;
  }
}

export async function updateLicense(
  id: number,
  userId: number,
  patch: Partial<{
    licenseType: string;
    licenseState: string | null;
    licenseNumber: string | null;
    expirationDate: Date | null;
    status: "active" | "expired" | "pending" | "suspended";
    ceCreditsRequired: number;
    ceCreditsCompleted: number;
    ceDeadline: Date | null;
  }>,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if ((k === "expirationDate" || k === "ceDeadline") && v instanceof Date) {
        values[k] = v.toISOString().slice(0, 10);
      } else {
        values[k] = v;
      }
    }
    if (Object.keys(values).length === 0) return true;
    await db
      .update(learningLicenses)
      .set(values as any)
      .where(and(eq(learningLicenses.id, id), eq(learningLicenses.userId, userId)));
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "updateLicense failed");
    return false;
  }
}

export async function deleteLicense(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .delete(learningLicenses)
      .where(and(eq(learningLicenses.id, id), eq(learningLicenses.userId, userId)));
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "deleteLicense failed");
    return false;
  }
}

// ─── CE credits ──────────────────────────────────────────────────────────

export async function addCECredit(data: {
  userId: number;
  licenseId: number;
  creditType?: string;
  creditHours: number;
  completedDate?: Date | null;
  providerName?: string;
  courseTitle?: string;
  certificateUrl?: string;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningCeCredits).values({
      userId: data.userId,
      licenseId: data.licenseId,
      creditType: data.creditType ?? null,
      creditHours: String(data.creditHours),
      completedDate: data.completedDate ? (data.completedDate.toISOString().slice(0, 10) as any) : null,
      providerName: data.providerName ?? null,
      courseTitle: data.courseTitle ?? null,
      certificateUrl: data.certificateUrl ?? null,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "addCECredit failed");
    return null;
  }
}

export async function getCECreditsForLicense(licenseId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningCeCredits)
      .where(eq(learningCeCredits.licenseId, licenseId))
      .orderBy(desc(learningCeCredits.completedDate));
  } catch (err) {
    log.warn({ err: String(err) }, "getCECreditsForLicense failed");
    return [];
  }
}

export async function getLicenseAlerts(userId: number): Promise<LicenseAlert[]> {
  const licenses = await getUserLicenses(userId);
  return deriveLicenseAlerts(licenses as any);
}

// ─── Aggregate CE progress ────────────────────────────────────────────────
export async function getCEProgress(userId: number): Promise<{
  licenseId: number;
  licenseType: string;
  required: number;
  completed: number;
  percent: number;
}[]> {
  const licenses = await getUserLicenses(userId);
  return licenses.map((lic) => {
    const required = lic.ceCreditsRequired ?? 0;
    const completed = lic.ceCreditsCompleted ?? 0;
    const percent = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 100;
    return {
      licenseId: lic.id,
      licenseType: lic.licenseType,
      required,
      completed,
      percent,
    };
  });
}
