/**
 * Task #50 — Graduated Autonomy Service
 * Progressive trust levels for AI actions based on user interaction history.
 *
 * MIGRATED: In-memory Map → Drizzle DB persistence (userAutonomyProfiles table).
 * Uses write-through cache for read performance.
 */
import { getDb } from "../db";
import { userAutonomyProfiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

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

// Write-through cache
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

async function loadFromDb(userId: number): Promise<AutonomyProfile | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(userAutonomyProfiles).where(eq(userAutonomyProfiles.userId, userId)).limit(1);
    if (!row) return null;
    return {
      userId,
      level: row.level as AutonomyLevel,
      trustScore: row.trustScore ?? 0,
      totalInteractions: row.totalInteractions ?? 0,
      successfulActions: row.successfulActions ?? 0,
      overriddenActions: row.overriddenActions ?? 0,
      escalations: row.escalations ?? 0,
      lastEscalation: row.lastEscalation ? new Date(row.lastEscalation).toISOString() : undefined,
      levelHistory: (row.levelHistory as AutonomyProfile["levelHistory"]) ?? [],
    };
  } catch (err) {
    logger.warn({ err, userId }, "graduatedAutonomy: DB read failed, using cache/default");
    return null;
  }
}

async function persistToDb(profile: AutonomyProfile): Promise<void> {
  try {
    const db = getDb();
    const [existing] = await db.select({ id: userAutonomyProfiles.id }).from(userAutonomyProfiles).where(eq(userAutonomyProfiles.userId, profile.userId)).limit(1);
    const data = {
      level: profile.level as any,
      trustScore: profile.trustScore,
      totalInteractions: profile.totalInteractions,
      successfulActions: profile.successfulActions,
      overriddenActions: profile.overriddenActions,
      escalations: profile.escalations,
      lastEscalation: profile.lastEscalation ? new Date(profile.lastEscalation) : null,
      levelHistory: profile.levelHistory,
    };
    if (existing) {
      await db.update(userAutonomyProfiles).set(data).where(eq(userAutonomyProfiles.userId, profile.userId));
    } else {
      await db.insert(userAutonomyProfiles).values({ userId: profile.userId, ...data });
    }
  } catch (err) {
    logger.warn({ err, userId: profile.userId }, "graduatedAutonomy: DB write failed, cache still valid");
  }
}

export async function getProfile(userId: number): Promise<AutonomyProfile> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  const dbProfile = await loadFromDb(userId);
  if (dbProfile) { profileCache.set(userId, dbProfile); return dbProfile; }
  const profile = defaultProfile(userId);
  profileCache.set(userId, profile);
  await persistToDb(profile);
  return profile;
}

export async function recordInteraction(userId: number, success: boolean, overridden: boolean, escalated: boolean): Promise<AutonomyProfile> {
  const profile = await getProfile(userId);
  profile.totalInteractions++;
  if (success) profile.successfulActions++;
  if (overridden) profile.overriddenActions++;
  if (escalated) { profile.escalations++; profile.lastEscalation = new Date().toISOString(); }

  const successRate = profile.totalInteractions > 0 ? profile.successfulActions / profile.totalInteractions : 0;
  const overrideRate = profile.totalInteractions > 0 ? profile.overriddenActions / profile.totalInteractions : 0;
  const escalationRate = profile.totalInteractions > 0 ? profile.escalations / profile.totalInteractions : 0;
  profile.trustScore = Math.round(Math.max(0, Math.min(100, successRate * 60 + (1 - overrideRate) * 25 + (1 - escalationRate) * 15)));

  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  for (let i = levels.length - 1; i >= 0; i--) {
    const threshold = LEVEL_THRESHOLDS[levels[i]];
    if (profile.trustScore >= threshold.minTrustScore && profile.totalInteractions >= threshold.minInteractions && escalationRate <= threshold.maxEscalationRate) {
      if (profile.level !== levels[i]) {
        profile.level = levels[i];
        profile.levelHistory.push({ level: levels[i], achievedAt: new Date().toISOString(), reason: `Trust score: ${profile.trustScore}, Interactions: ${profile.totalInteractions}` });
      }
      break;
    }
  }

  profileCache.set(userId, profile);
  await persistToDb(profile);
  return profile;
}

export async function canPerformAction(userId: number, action: string): Promise<{ allowed: boolean; confirmationRequired: boolean; reason: string }> {
  const profile = await getProfile(userId);
  const actionDef = AUTONOMY_ACTIONS.find(a => a.action === action);
  if (!actionDef) return { allowed: false, confirmationRequired: false, reason: "Unknown action" };
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const userLevelIdx = levels.indexOf(profile.level);
  const requiredLevelIdx = levels.indexOf(actionDef.requiredLevel);
  if (userLevelIdx >= requiredLevelIdx) {
    return { allowed: true, confirmationRequired: actionDef.confirmationRequired && userLevelIdx === requiredLevelIdx, reason: `Level ${profile.level} meets requirement ${actionDef.requiredLevel}` };
  }
  return { allowed: false, confirmationRequired: false, reason: `Level ${profile.level} insufficient for ${actionDef.requiredLevel}` };
}

export async function getAvailableActions(userId: number): Promise<AutonomyAction[]> {
  const profile = await getProfile(userId);
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const userLevelIdx = levels.indexOf(profile.level);
  return AUTONOMY_ACTIONS.filter(a => levels.indexOf(a.requiredLevel) <= userLevelIdx);
}

export async function getLevelProgress(userId: number): Promise<{ currentLevel: AutonomyLevel; nextLevel: AutonomyLevel | null; progress: number }> {
  const profile = await getProfile(userId);
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
