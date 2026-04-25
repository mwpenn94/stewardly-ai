/**
 * Task #46 — Field-Level Sharing Controls Service
 * Granular per-field visibility controls for user profiles and data.
 *
 * Pass 84: Migrated from in-memory Map to DB-backed fieldSharingControls table.
 * In-memory cache used as read-through layer; writes go to DB first.
 */
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { fieldSharingControls } from "../../drizzle/schema";
import { logger } from "../_core/logger";

export type VisibilityLevel = "private" | "professional" | "management" | "admin" | "public";

export interface FieldSharingRule {
  fieldName: string;
  displayName: string;
  category: "personal" | "financial" | "professional" | "suitability" | "preferences";
  defaultVisibility: VisibilityLevel;
  userOverridable: boolean;
  sensitivityLevel: "low" | "medium" | "high" | "critical";
}

const FIELD_RULES: FieldSharingRule[] = [
  // Personal
  { fieldName: "name", displayName: "Full Name", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "email", displayName: "Email Address", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "age", displayName: "Age", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "zipCode", displayName: "ZIP Code", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  { fieldName: "familySituation", displayName: "Family Situation", category: "personal", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  // Financial
  { fieldName: "incomeRange", displayName: "Income Range", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "savingsRange", displayName: "Savings Range", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "investmentSummary", displayName: "Investment Summary", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "critical" },
  { fieldName: "insuranceSummary", displayName: "Insurance Summary", category: "financial", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "high" },
  { fieldName: "estateExposure", displayName: "Estate Exposure", category: "financial", defaultVisibility: "management", userOverridable: true, sensitivityLevel: "critical" },
  // Professional
  { fieldName: "jobTitle", displayName: "Job Title", category: "professional", defaultVisibility: "public", userOverridable: true, sensitivityLevel: "low" },
  { fieldName: "employerName", displayName: "Employer", category: "professional", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "medium" },
  // Suitability
  { fieldName: "riskTolerance", displayName: "Risk Tolerance", category: "suitability", defaultVisibility: "professional", userOverridable: false, sensitivityLevel: "high" },
  { fieldName: "investmentHorizon", displayName: "Investment Horizon", category: "suitability", defaultVisibility: "professional", userOverridable: false, sensitivityLevel: "medium" },
  { fieldName: "suitabilityScore", displayName: "Suitability Score", category: "suitability", defaultVisibility: "management", userOverridable: false, sensitivityLevel: "high" },
  // Preferences
  { fieldName: "focusPreference", displayName: "Focus Mode", category: "preferences", defaultVisibility: "private", userOverridable: true, sensitivityLevel: "low" },
  { fieldName: "styleProfile", displayName: "Communication Style", category: "preferences", defaultVisibility: "professional", userOverridable: true, sensitivityLevel: "low" },
];

/* ─── Read-through cache: populated from DB on first access per user ─── */
const userOverridesCache = new Map<string, VisibilityLevel>();
const loadedUsers = new Set<number>();

async function ensureUserLoaded(userId: number): Promise<void> {
  if (loadedUsers.has(userId)) return;
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db
      .select()
      .from(fieldSharingControls)
      .where(eq(fieldSharingControls.userId, userId));
    for (const row of rows) {
      if (row.shareWithRole) {
        userOverridesCache.set(`${userId}:${row.fieldName}`, row.shareWithRole as VisibilityLevel);
      }
    }
    loadedUsers.add(userId);
  } catch (e) {
    logger.warn({ err: e }, "[FieldSharing] Failed to load overrides from DB, using defaults");
  }
}

export function getFieldRules(category?: string): FieldSharingRule[] {
  if (category) return FIELD_RULES.filter(r => r.category === category);
  return [...FIELD_RULES];
}

export async function getFieldVisibility(userId: number, fieldName: string): Promise<VisibilityLevel> {
  await ensureUserLoaded(userId);
  const override = userOverridesCache.get(`${userId}:${fieldName}`);
  if (override) return override;
  const rule = FIELD_RULES.find(r => r.fieldName === fieldName);
  return rule?.defaultVisibility ?? "private";
}

export async function setFieldVisibility(userId: number, fieldName: string, visibility: VisibilityLevel): Promise<boolean> {
  const rule = FIELD_RULES.find(r => r.fieldName === fieldName);
  if (!rule || !rule.userOverridable) return false;

  // Write to DB first
  try {
    const db = await getDb();
    if (db) {
      // Upsert: delete existing then insert
      await db.delete(fieldSharingControls).where(
        and(
          eq(fieldSharingControls.userId, userId),
          eq(fieldSharingControls.fieldName, fieldName),
        ),
      );
      await db.insert(fieldSharingControls).values({
        userId,
        fieldName,
        shareWithRole: visibility,
      });
    }
  } catch (e) {
    logger.error({ err: e }, "[FieldSharing] Failed to persist override to DB");
    // Still update cache so current session works
  }

  // Update cache
  userOverridesCache.set(`${userId}:${fieldName}`, visibility);
  return true;
}

export async function getUserFieldOverrides(userId: number): Promise<Record<string, VisibilityLevel>> {
  await ensureUserLoaded(userId);
  const overrides: Record<string, VisibilityLevel> = {};
  const prefix = `${userId}:`;
  for (const key of Array.from(userOverridesCache.keys())) {
    if (key.startsWith(prefix)) {
      overrides[key.replace(prefix, "")] = userOverridesCache.get(key)!;
    }
  }
  return overrides;
}

const VISIBILITY_HIERARCHY: Record<VisibilityLevel, number> = {
  private: 0, professional: 1, management: 2, admin: 3, public: 4,
};

export function canViewField(viewerRole: string, fieldVisibility: VisibilityLevel): boolean {
  const roleToVisibility: Record<string, VisibilityLevel> = {
    user: "private", advisor: "professional", professional: "professional",
    manager: "management", admin: "admin",
  };
  const viewerLevel = VISIBILITY_HIERARCHY[roleToVisibility[viewerRole] ?? "private"];
  const fieldLevel = VISIBILITY_HIERARCHY[fieldVisibility];
  return viewerLevel >= fieldLevel || fieldVisibility === "public";
}

export async function filterFieldsForViewer(data: Record<string, any>, userId: number, viewerRole: string): Promise<Record<string, any>> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const visibility = await getFieldVisibility(userId, key);
    if (canViewField(viewerRole, visibility)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
