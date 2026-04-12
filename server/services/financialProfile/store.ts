/**
 * Server-side persistence layer for the shared financial profile.
 *
 * Backed by the `financial_profiles` table (drizzle migration 0013).
 * Every CRUD operation degrades gracefully when the DB is missing
 * — `getProfile` returns null, `setProfile` becomes a no-op — so the
 * server boots cleanly in environments where the migration hasn't
 * been applied yet.
 *
 * The profile JSON blob is sanitized via the shared
 * `shared/financialProfile.ts` module so client + server agree on
 * field clamping, enum validation, and the canonical shape.
 *
 * Pass 4 history: ships gap G9 from docs/PARITY.md.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { financialProfiles } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";
import {
  type FinancialProfile,
  mergeProfile,
  profileCompleteness,
  sanitizeProfile,
} from "../../../shared/financialProfile";
import {
  detectLifeEvents,
  type LifeEvent,
} from "../../../shared/lifeEventDetector";

/**
 * Read the saved profile for a user. Returns null when no row exists
 * OR when the DB is unavailable (graceful degradation). Callers
 * should treat null as "use the client-side localStorage value".
 */
export async function getProfile(
  userId: number,
): Promise<FinancialProfile | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    if (!row.profileJson || typeof row.profileJson !== "object") {
      return null;
    }
    // The DB stores the canonical shape, but re-run the sanitizer
    // anyway so a corrupted JSON blob can't blow up downstream.
    return sanitizeProfile(row.profileJson as Record<string, unknown>);
  } catch (err) {
    logger.warn(
      { operation: "financialProfile.getProfile", userId },
      "[financialProfile] read failed:",
      err,
    );
    return null;
  }
}

/**
 * Replace the saved profile for a user with a new sanitized value.
 * Upserts on user_id (the unique index in the schema). Silently
 * no-ops when the DB is unavailable.
 *
 * Returns the saved profile (post-sanitization) so the caller can
 * mirror it into the client cache.
 */
export async function setProfile(
  userId: number,
  patch: Partial<FinancialProfile>,
  source: FinancialProfile["source"] = "user",
): Promise<FinancialProfile | null> {
  return (await setProfileWithEvents(userId, patch, source)).profile;
}

/**
 * Same as setProfile but also returns the life events that fired
 * as a result of the transition. Used by the chat pipeline and
 * webhook handlers that want to proactively nudge users after a
 * profile update.
 */
export async function setProfileWithEvents(
  userId: number,
  patch: Partial<FinancialProfile>,
  source: FinancialProfile["source"] = "user",
): Promise<{ profile: FinancialProfile | null; events: LifeEvent[] }> {
  const db = await getDb();
  if (!db) {
    const merged = mergeProfile({}, patch, source);
    return { profile: merged, events: [] };
  }

  try {
    // Read the current row (if any) so we can apply a true patch
    // semantics rather than an overwrite.
    const existing = await getProfile(userId);
    const merged = mergeProfile(existing ?? {}, patch, source);
    const completeness = profileCompleteness(merged);
    const events = detectLifeEvents(existing, merged);

    // mysql2 + drizzle has no portable upsert, so emulate via
    // INSERT … ON DUPLICATE KEY UPDATE via the onDuplicateKeyUpdate
    // chain (drizzle-orm/mysql2).
    await db
      .insert(financialProfiles)
      .values({
        userId,
        version: 1,
        profileJson: merged,
        source: source ?? "user",
        completeness,
      })
      .onDuplicateKeyUpdate({
        set: {
          profileJson: merged,
          source: source ?? "user",
          completeness,
          version: 1,
        },
      });

    return { profile: merged, events };
  } catch (err) {
    logger.warn(
      { operation: "financialProfile.setProfileWithEvents", userId },
      "[financialProfile] write failed:",
      err,
    );
    // Even on write failure, return the sanitized merge so the
    // caller still has consistent in-memory state.
    return { profile: mergeProfile({}, patch, source), events: [] };
  }
}

/**
 * Wholesale replace — drops the existing row and writes the supplied
 * profile as-is (after sanitization). Used for "import from CSV"
 * flows where the new payload is the source of truth.
 */
export async function replaceProfile(
  userId: number,
  next: FinancialProfile,
  source: FinancialProfile["source"] = "user",
): Promise<FinancialProfile | null> {
  const db = await getDb();
  const sanitized = mergeProfile({}, next, source);
  if (!db) return sanitized;

  try {
    const completeness = profileCompleteness(sanitized);
    await db
      .insert(financialProfiles)
      .values({
        userId,
        version: 1,
        profileJson: sanitized,
        source: source ?? "user",
        completeness,
      })
      .onDuplicateKeyUpdate({
        set: {
          profileJson: sanitized,
          source: source ?? "user",
          completeness,
          version: 1,
        },
      });
    return sanitized;
  } catch (err) {
    logger.warn(
      { operation: "financialProfile.replaceProfile", userId },
      "[financialProfile] replace failed:",
      err,
    );
    return sanitized;
  }
}

/**
 * Drop the saved profile entirely. Used by the user-facing
 * "Reset profile" action.
 */
export async function deleteProfile(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .delete(financialProfiles)
      .where(eq(financialProfiles.userId, userId));
  } catch (err) {
    logger.warn(
      { operation: "financialProfile.deleteProfile", userId },
      "[financialProfile] delete failed:",
      err,
    );
  }
}
