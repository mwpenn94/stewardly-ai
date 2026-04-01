/**
 * Task #50 — Graduated Autonomy Service (DB-Persisted)
 * Progressive trust levels for AI actions based on user interaction history.
 *
 * MIGRATION: Converted from in-memory Map to DB-backed persistence
 * using the existing `agent_autonomy_levels` table. Falls back to
 * in-memory cache for fast reads with write-through to DB.
 */

import { getDb } from "../db";
import { agentAutonomyLevels } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const log = logger.child({ module: "graduatedAutonomy" });

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

// Write-through cache for fast reads
const profileCache = new Map<number, AutonomyProfile>();

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

/**
 * Load profile from DB, falling back to in-memory cache or default.
 */
async function loadProfile(userId: number): Promise<AutonomyProfile> {
  // Check cache first
  if (profileCache.has(userId)) {
    return profileCache.get(userId)!;
  }

  try {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select()
        .from(agentAutonomyLevels)
        .where(eq(agentAutonomyLevels.agentTemplateId, userId))
        .limit(1);

      if (row) {
        const profile: AutonomyProfile = {
          userId,
          level: INT_TO_LEVEL[row.currentLevel ?? 1] ?? "supervised",
          trustScore: 0,
          totalInteractions: (row.level1Runs ?? 0) + (row.level2Runs ?? 0),
          successfulActions: row.level2Runs ?? 0,
          overriddenActions: 0,
          escalations: 0,
          levelHistory: [{ level: INT_TO_LEVEL[row.currentLevel ?? 1] ?? "supervised", achievedAt: (row.promotedAt ?? new Date()).toISOString(), reason: "Loaded from DB" }],
        };
        // Recalculate trust score
        if (profile.totalInteractions > 0) {
          profile.trustScore = Math.round((profile.successfulActions / profile.totalInteractions) * 100 * 100) / 100;
        }
        profileCache.set(userId, profile);
        return profile;
      }
    }
  } catch (err) {
    log.warn({ userId, error: String(err) }, "Failed to load autonomy profile from DB, using default");
  }

  const profile = defaultProfile(userId);
  profileCache.set(userId, profile);
  return profile;
}

/**
 * Persist profile to DB (write-through).
 */
async function persistProfile(profile: AutonomyProfile): Promise<void> {
  profileCache.set(profile.userId, profile);

  try {
    const db = await getDb();
    if (!db) return;

    const data = {
      currentLevel: LEVEL_TO_INT[profile.level] ?? 1,
      level1Runs: profile.totalInteractions,
      level2Runs: profile.successfulActions,
      promotedAt: profile.levelHistory.length > 1
        ? new Date(profile.levelHistory[profile.levelHistory.length - 1].achievedAt)
        : undefined,
    };

    const [existing] = await db
      .select()
      .from(agentAutonomyLevels)
      .where(eq(agentAutonomyLevels.agentTemplateId, profile.userId))
      .limit(1);

    if (existing) {
      await db
        .update(agentAutonomyLevels)
        .set(data)
        .where(eq(agentAutonomyLevels.agentTemplateId, profile.userId));
    } else {
      await db.insert(agentAutonomyLevels).values({
        agentTemplateId: profile.userId,
        ...data,
      });
    }
  } catch (err) {
    log.warn({ userId: profile.userId, error: String(err) }, "Failed to persist autonomy profile to DB");
  }
}

export async function getProfile(userId: number): Promise<AutonomyProfile> {
  return loadProfile(userId);
}

export async function recordInteraction(userId: number, success: boolean, overridden: boolean, escalated: boolean): Promise<AutonomyProfile> {
  const profile = await loadProfile(userId);
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
    (successRate * 60 + (1 - overrideRate) * 25 + (1 - escalationRate) * 15) * 100
  ) / 100;

  // Check for level upgrade
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  for (let i = levels.length - 1; i >= 0; i--) {
    const threshold = LEVEL_THRESHOLDS[levels[i]];
    if (
      profile.trustScore >= threshold.minTrustScore &&
      profile.totalInteractions >= threshold.minInteractions &&
      escalationRate <= threshold.maxEscalationRate
    ) {
      if (profile.level !== levels[i]) {
        profile.level = levels[i];
        profile.levelHistory.push({
          level: levels[i],
          achievedAt: new Date().toISOString(),
          reason: `Trust score: ${profile.trustScore}, Interactions: ${profile.totalInteractions}`,
        });
      }
      break;
    }
  }

  // Persist to DB
  await persistProfile(profile);

  return profile;
}

export async function canPerformAction(userId: number, action: string): Promise<{ allowed: boolean; confirmationRequired: boolean; reason: string }> {
  const profile = await loadProfile(userId);
  const actionDef = AUTONOMY_ACTIONS.find(a => a.action === action);
  if (!actionDef) return { allowed: false, confirmationRequired: false, reason: "Unknown action" };

  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const userLevelIdx = levels.indexOf(profile.level);
  const requiredLevelIdx = levels.indexOf(actionDef.requiredLevel);

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
}

export async function getAvailableActions(userId: number): Promise<AutonomyAction[]> {
  const profile = await loadProfile(userId);
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const userLevelIdx = levels.indexOf(profile.level);
  return AUTONOMY_ACTIONS.filter(a => levels.indexOf(a.requiredLevel) <= userLevelIdx);
}

export async function getLevelProgress(userId: number): Promise<{ currentLevel: AutonomyLevel; nextLevel: AutonomyLevel | null; progress: number }> {
  const profile = await loadProfile(userId);
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const currentIdx = levels.indexOf(profile.level);
  const nextLevel = currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;

  if (!nextLevel) return { currentLevel: profile.level, nextLevel: null, progress: 100 };

  const threshold = LEVEL_THRESHOLDS[nextLevel];
  const trustProgress = Math.min(100, (profile.trustScore / threshold.minTrustScore) * 100);
  const interactionProgress = Math.min(100, (profile.totalInteractions / threshold.minInteractions) * 100);
  const progress = Math.round((trustProgress + interactionProgress) / 2);

  return { currentLevel: profile.level, nextLevel, progress };
}
