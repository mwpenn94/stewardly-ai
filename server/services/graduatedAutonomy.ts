/**
 * Task #50 — Graduated Autonomy Service (DB-Backed)
 * Progressive trust levels for AI actions based on user interaction history.
 *
 * MIGRATION (Universal Fix P0-7):
 *   Replaced in-memory Map with Drizzle queries against autonomy_levels,
 *   user_capabilities, and escalation_history tables.
 *   Falls back to default trust level 1 if DB read fails.
 */

import { getDb } from "../db";
import { eq, and } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutonomyLevel = "supervised" | "guided" | "semi_autonomous" | "autonomous";

export interface AutonomyProfile {
  userId: number;
  level: AutonomyLevel;
  trustScore: number; // 0-100
  totalInteractions: number;
  successfulActions: number;
  overriddenActions: number;
  escalations: number;
  lastEscalation?: string;
  levelHistory: Array<{ level: AutonomyLevel; achievedAt: string; reason: string }>;
}

export interface AutonomyAction {
  action: string;
  requiredLevel: AutonomyLevel;
  description: string;
  confirmationRequired: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AUTONOMY_ACTIONS: AutonomyAction[] = [
  { action: "send_message", requiredLevel: "supervised", description: "Send chat message", confirmationRequired: false },
  { action: "run_calculator", requiredLevel: "supervised", description: "Execute financial calculator", confirmationRequired: false },
  { action: "search_knowledge", requiredLevel: "supervised", description: "Search knowledge base", confirmationRequired: false },
  { action: "generate_report", requiredLevel: "guided", description: "Generate financial report", confirmationRequired: true },
  { action: "update_profile", requiredLevel: "guided", description: "Update user profile fields", confirmationRequired: true },
  { action: "product_recommendation", requiredLevel: "guided", description: "Make product recommendation", confirmationRequired: true },
  { action: "schedule_meeting", requiredLevel: "semi_autonomous", description: "Schedule meeting with professional", confirmationRequired: true },
  { action: "send_notification", requiredLevel: "semi_autonomous", description: "Send notification to user", confirmationRequired: false },
  { action: "create_document", requiredLevel: "semi_autonomous", description: "Create and save document", confirmationRequired: true },
  { action: "bulk_export", requiredLevel: "autonomous", description: "Export bulk data", confirmationRequired: false },
  { action: "auto_rebalance_suggestion", requiredLevel: "autonomous", description: "Auto-suggest portfolio rebalancing", confirmationRequired: false },
];

const LEVEL_THRESHOLDS: Record<AutonomyLevel, { minTrustScore: number; minInteractions: number; maxEscalationRate: number }> = {
  supervised: { minTrustScore: 0, minInteractions: 0, maxEscalationRate: 1.0 },
  guided: { minTrustScore: 30, minInteractions: 20, maxEscalationRate: 0.2 },
  semi_autonomous: { minTrustScore: 60, minInteractions: 100, maxEscalationRate: 0.1 },
  autonomous: { minTrustScore: 85, minInteractions: 500, maxEscalationRate: 0.05 },
};

const LEVELS: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];

const LEVEL_TO_INT: Record<AutonomyLevel, number> = {
  supervised: 1,
  guided: 2,
  semi_autonomous: 3,
  autonomous: 4,
};

const INT_TO_LEVEL: Record<number, AutonomyLevel> = {
  1: "supervised",
  2: "guided",
  3: "semi_autonomous",
  4: "autonomous",
};

// ─── Schema loader (lazy) ───────────────────────────────────────────────────

let _schema: any = null;
async function getSchema() {
  if (!_schema) {
    try {
      _schema = await import("../../drizzle/schema");
    } catch {
      _schema = null;
    }
  }
  return _schema;
}

// ─── Default profile ────────────────────────────────────────────────────────

function defaultProfile(userId: number): AutonomyProfile {
  return {
    userId,
    level: "supervised",
    trustScore: 0,
    totalInteractions: 0,
    successfulActions: 0,
    overriddenActions: 0,
    escalations: 0,
    levelHistory: [{ level: "supervised", achievedAt: new Date().toISOString(), reason: "Initial level" }],
  };
}

// ─── DB-backed profile row → AutonomyProfile ────────────────────────────────

function rowToProfile(userId: number, row: any): AutonomyProfile {
  return {
    userId,
    level: INT_TO_LEVEL[row.trustLevel] || "supervised",
    trustScore: Number(row.trustScore) || 0,
    totalInteractions: row.totalInteractions ?? 0,
    successfulActions: row.successfulActions ?? 0,
    overriddenActions: row.overriddenActions ?? 0,
    escalations: row.escalations ?? 0,
    lastEscalation: row.lastEscalation ? new Date(row.lastEscalation).toISOString() : undefined,
    levelHistory: Array.isArray(row.levelHistory) ? row.levelHistory : [],
  };
}

// ─── Core DB Operations ─────────────────────────────────────────────────────

export async function getProfile(userId: number): Promise<AutonomyProfile> {
  try {
    const db = await getDb();
    const schema = await getSchema();
    if (!db || !schema?.autonomyLevels) return defaultProfile(userId);

    const [row] = await db.select().from(schema.autonomyLevels)
      .where(and(
        eq(schema.autonomyLevels.userId, userId),
        eq(schema.autonomyLevels.capability, "global"),
      ))
      .limit(1);

    if (!row) {
      // Insert default row
      try {
        await db.insert(schema.autonomyLevels).values({
          userId,
          capability: "global",
          trustLevel: 1,
          trustScore: "0",
          totalInteractions: 0,
          successfulActions: 0,
          overriddenActions: 0,
          escalations: 0,
          levelHistory: [{ level: "supervised", achievedAt: new Date().toISOString(), reason: "Initial level" }],
        });
      } catch {
        // Ignore duplicate key errors from concurrent inserts
      }
      return defaultProfile(userId);
    }

    return rowToProfile(userId, row);
  } catch {
    return defaultProfile(userId);
  }
}

export async function recordInteraction(
  userId: number,
  success: boolean,
  overridden: boolean,
  escalated: boolean,
): Promise<AutonomyProfile> {
  try {
    const db = await getDb();
    const schema = await getSchema();
    if (!db || !schema?.autonomyLevels) return defaultProfile(userId);

    // Get or create profile
    const profile = await getProfile(userId);

    // Update counters
    profile.totalInteractions++;
    if (success) profile.successfulActions++;
    if (overridden) profile.overriddenActions++;
    if (escalated) {
      profile.escalations++;
      profile.lastEscalation = new Date().toISOString();
    }

    // Recalculate trust score
    const successRate = profile.totalInteractions > 0 ? profile.successfulActions / profile.totalInteractions : 0;
    const overrideRate = profile.totalInteractions > 0 ? profile.overriddenActions / profile.totalInteractions : 0;
    const escalationRate = profile.totalInteractions > 0 ? profile.escalations / profile.totalInteractions : 0;
    profile.trustScore = Math.round(
      (successRate * 60 + (1 - overrideRate) * 25 + (1 - escalationRate) * 15) * 100,
    ) / 100;

    // Check for level upgrade
    const previousLevel = profile.level;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      const threshold = LEVEL_THRESHOLDS[LEVELS[i]];
      if (
        profile.trustScore >= threshold.minTrustScore &&
        profile.totalInteractions >= threshold.minInteractions &&
        escalationRate <= threshold.maxEscalationRate
      ) {
        if (profile.level !== LEVELS[i]) {
          profile.level = LEVELS[i];
          profile.levelHistory.push({
            level: LEVELS[i],
            achievedAt: new Date().toISOString(),
            reason: `Trust score: ${profile.trustScore}, Interactions: ${profile.totalInteractions}`,
          });
        }
        break;
      }
    }

    // Persist to DB
    await db.update(schema.autonomyLevels)
      .set({
        trustLevel: LEVEL_TO_INT[profile.level],
        trustScore: String(profile.trustScore),
        totalInteractions: profile.totalInteractions,
        successfulActions: profile.successfulActions,
        overriddenActions: profile.overriddenActions,
        escalations: profile.escalations,
        lastEscalation: profile.lastEscalation ? new Date(profile.lastEscalation) : null,
        levelHistory: profile.levelHistory,
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.autonomyLevels.userId, userId),
        eq(schema.autonomyLevels.capability, "global"),
      ));

    // Record escalation history if level changed
    if (previousLevel !== profile.level && schema.escalationHistory) {
      await db.insert(schema.escalationHistory).values({
        userId,
        action: "level_change",
        previousLevel: LEVEL_TO_INT[previousLevel],
        newLevel: LEVEL_TO_INT[profile.level],
        reason: `Trust score: ${profile.trustScore}, Interactions: ${profile.totalInteractions}`,
      }).catch(() => {});
    }

    // Sync aggregate state to sovereignAutonomyState (read by contextSources)
    if (schema.sovereignAutonomyState) {
      try {
        const [existing] = await db.select({ id: schema.sovereignAutonomyState.id })
          .from(schema.sovereignAutonomyState)
          .where(eq(schema.sovereignAutonomyState.userId, userId))
          .limit(1);

        const stateData = {
          level: profile.level,
          trustScore: String(profile.trustScore),
          totalInteractions: profile.totalInteractions,
          successfulActions: profile.successfulActions,
          overriddenActions: profile.overriddenActions,
          escalations: profile.escalations,
          lastEscalation: profile.lastEscalation ? new Date(profile.lastEscalation) : null,
          levelHistory: profile.levelHistory,
          updatedAt: new Date(),
        };

        if (existing) {
          await db.update(schema.sovereignAutonomyState)
            .set(stateData)
            .where(eq(schema.sovereignAutonomyState.userId, userId));
        } else {
          await db.insert(schema.sovereignAutonomyState).values({
            userId,
            ...stateData,
            modelVersion: "1.0.0",
          });
        }
      } catch {
        // Non-fatal: autonomy_levels is the source of truth, this is a read-optimized copy
      }
    }

    return profile;
  } catch {
    return defaultProfile(userId);
  }
}

export async function canPerformAction(
  userId: number,
  action: string,
): Promise<{ allowed: boolean; confirmationRequired: boolean; reason: string }> {
  try {
    const profile = await getProfile(userId);
    const actionDef = AUTONOMY_ACTIONS.find((a) => a.action === action);
    if (!actionDef) return { allowed: false, confirmationRequired: false, reason: "Unknown action" };

    const userLevelIdx = LEVELS.indexOf(profile.level);
    const requiredLevelIdx = LEVELS.indexOf(actionDef.requiredLevel);

    if (userLevelIdx >= requiredLevelIdx) {
      return {
        allowed: true,
        confirmationRequired: actionDef.confirmationRequired && userLevelIdx === requiredLevelIdx,
        reason: `Level ${profile.level} meets requirement ${actionDef.requiredLevel}`,
      };
    }

    return {
      allowed: false,
      confirmationRequired: false,
      reason: `Level ${profile.level} insufficient for ${actionDef.requiredLevel}`,
    };
  } catch {
    // Fallback: supervised level — allow only supervised actions
    const actionDef = AUTONOMY_ACTIONS.find((a) => a.action === action);
    if (!actionDef) return { allowed: false, confirmationRequired: false, reason: "Unknown action" };
    return {
      allowed: actionDef.requiredLevel === "supervised",
      confirmationRequired: actionDef.confirmationRequired,
      reason: "DB unavailable — defaulting to supervised level",
    };
  }
}

export async function getAvailableActions(userId: number): Promise<AutonomyAction[]> {
  try {
    const profile = await getProfile(userId);
    const userLevelIdx = LEVELS.indexOf(profile.level);
    return AUTONOMY_ACTIONS.filter((a) => LEVELS.indexOf(a.requiredLevel) <= userLevelIdx);
  } catch {
    // Fallback: only supervised actions
    return AUTONOMY_ACTIONS.filter((a) => a.requiredLevel === "supervised");
  }
}

export async function getLevelProgress(userId: number): Promise<{
  currentLevel: AutonomyLevel;
  nextLevel: AutonomyLevel | null;
  progress: number;
}> {
  try {
    const profile = await getProfile(userId);
    const currentIdx = LEVELS.indexOf(profile.level);
    const nextLevel = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null;

    if (!nextLevel) return { currentLevel: profile.level, nextLevel: null, progress: 100 };

    const threshold = LEVEL_THRESHOLDS[nextLevel];
    const trustProgress = Math.min(100, (profile.trustScore / threshold.minTrustScore) * 100);
    const interactionProgress = Math.min(100, (profile.totalInteractions / threshold.minInteractions) * 100);
    const progress = Math.round((trustProgress + interactionProgress) / 2);

    return { currentLevel: profile.level, nextLevel, progress };
  } catch {
    return { currentLevel: "supervised", nextLevel: "guided", progress: 0 };
  }
}
