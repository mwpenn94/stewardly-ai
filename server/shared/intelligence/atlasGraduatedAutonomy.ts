/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS Graduated Autonomy — DB-Persisted Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replaces the in-memory Map<number, AutonomyProfile> from
 * server/services/graduatedAutonomy.ts with a DB-persisted version
 * that uses the agentAutonomyLevels table.
 *
 * Key improvements over the original:
 *   1. State persists across server restarts (DB-backed)
 *   2. TiDB numeric coercion applied at DB boundary (P-02)
 *   3. model_version tracked on autonomy decisions
 *   4. Quality scores normalized through normalizeQualityScore
 *
 * The API surface is intentionally compatible with the original service
 * to minimize migration effort in routers/aiPlatform.ts.
 */

import { persistAutonomyLevel, loadAutonomyLevel, getModelVersion } from "./atlasWiring";
import { normalizeQualityScore } from "./types";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type AutonomyLevel = "supervised" | "guided" | "semi_autonomous" | "autonomous";

export interface AutonomyProfile {
  userId: number;
  level: AutonomyLevel;
  trustScore: number;
  totalInteractions: number;
  successfulActions: number;
  overriddenActions: number;
  escalations: number;
  lastEscalation?: string;
  levelHistory: Array<{ level: AutonomyLevel; achievedAt: string; reason: string }>;
  modelVersion: string;
}

export interface AutonomyAction {
  action: string;
  requiredLevel: AutonomyLevel;
  description: string;
  confirmationRequired: boolean;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

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

// ─── DB-BACKED PROFILE CACHE ────────────────────────────────────────────────
//
// Profiles are loaded from DB on first access and cached in memory.
// Writes go to both the cache and the DB.

const profileCache = new Map<number, AutonomyProfile>();

function levelFromInt(level: number): AutonomyLevel {
  if (level >= 4) return "autonomous";
  if (level >= 3) return "semi_autonomous";
  if (level >= 2) return "guided";
  return "supervised";
}

function levelToInt(level: AutonomyLevel): number {
  switch (level) {
    case "autonomous": return 4;
    case "semi_autonomous": return 3;
    case "guided": return 2;
    case "supervised": return 1;
    default: return 1;
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

export async function getProfile(userId: number, agentTemplateId: number = 1): Promise<AutonomyProfile> {
  if (profileCache.has(userId)) {
    return profileCache.get(userId)!;
  }

  // Try loading from DB
  const dbLevel = await loadAutonomyLevel(agentTemplateId);

  const profile: AutonomyProfile = dbLevel
    ? {
        userId,
        level: levelFromInt(dbLevel.currentLevel),
        trustScore: 0,
        totalInteractions: dbLevel.level1Runs + dbLevel.level2Runs,
        successfulActions: dbLevel.level1Runs + dbLevel.level2Runs,
        overriddenActions: 0,
        escalations: 0,
        levelHistory: [{
          level: levelFromInt(dbLevel.currentLevel),
          achievedAt: dbLevel.promotedAt?.toISOString() ?? new Date().toISOString(),
          reason: "Loaded from DB",
        }],
        modelVersion: getModelVersion(),
      }
    : {
        userId,
        level: "supervised",
        trustScore: 0,
        totalInteractions: 0,
        successfulActions: 0,
        overriddenActions: 0,
        escalations: 0,
        levelHistory: [{ level: "supervised", achievedAt: new Date().toISOString(), reason: "Initial level" }],
        modelVersion: getModelVersion(),
      };

  profileCache.set(userId, profile);
  return profile;
}

export async function recordInteraction(
  userId: number,
  success: boolean,
  overridden: boolean,
  escalated: boolean,
  agentTemplateId: number = 1,
): Promise<AutonomyProfile> {
  const profile = await getProfile(userId, agentTemplateId);
  profile.totalInteractions++;
  if (success) profile.successfulActions++;
  if (overridden) profile.overriddenActions++;
  if (escalated) {
    profile.escalations++;
    profile.lastEscalation = new Date().toISOString();
  }

  // Recalculate trust score (normalized to 0-1 via normalizeQualityScore)
  const successRate = profile.totalInteractions > 0 ? profile.successfulActions / profile.totalInteractions : 0;
  const overrideRate = profile.totalInteractions > 0 ? profile.overriddenActions / profile.totalInteractions : 0;
  const escalationRate = profile.totalInteractions > 0 ? profile.escalations / profile.totalInteractions : 0;

  const rawScore = (successRate * 60 + (1 - overrideRate) * 25 + (1 - escalationRate) * 15);
  profile.trustScore = Math.round(normalizeQualityScore(rawScore) * 10000) / 100;

  // Check for level upgrade
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

  profile.modelVersion = getModelVersion();

  // Persist to DB
  const currentLevelInt = levelToInt(profile.level);
  await persistAutonomyLevel(
    agentTemplateId,
    currentLevelInt,
    profile.level === "supervised" ? profile.totalInteractions : 0,
    profile.level !== "supervised" ? profile.totalInteractions : 0,
    undefined,
  );

  return profile;
}

export async function canPerformAction(
  userId: number,
  action: string,
  agentTemplateId: number = 1,
): Promise<{ allowed: boolean; confirmationRequired: boolean; reason: string }> {
  const profile = await getProfile(userId, agentTemplateId);
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
}

export async function getAvailableActions(userId: number, agentTemplateId: number = 1): Promise<AutonomyAction[]> {
  const profile = await getProfile(userId, agentTemplateId);
  const userLevelIdx = LEVELS.indexOf(profile.level);
  return AUTONOMY_ACTIONS.filter((a) => LEVELS.indexOf(a.requiredLevel) <= userLevelIdx);
}

export async function getLevelProgress(userId: number, agentTemplateId: number = 1): Promise<{
  currentLevel: AutonomyLevel;
  nextLevel: AutonomyLevel | null;
  progress: number;
  modelVersion: string;
}> {
  const profile = await getProfile(userId, agentTemplateId);
  const currentIdx = LEVELS.indexOf(profile.level);
  const nextLevel = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null;

  if (!nextLevel) return { currentLevel: profile.level, nextLevel: null, progress: 100, modelVersion: getModelVersion() };

  const threshold = LEVEL_THRESHOLDS[nextLevel];
  const trustProgress = Math.min(100, (profile.trustScore / threshold.minTrustScore) * 100);
  const interactionProgress = Math.min(100, (profile.totalInteractions / threshold.minInteractions) * 100);
  const progress = Math.round((trustProgress + interactionProgress) / 2);

  return { currentLevel: profile.level, nextLevel, progress, modelVersion: getModelVersion() };
}

/**
 * Clear the in-memory cache (useful for testing).
 */
export function clearProfileCache(): void {
  profileCache.clear();
}
