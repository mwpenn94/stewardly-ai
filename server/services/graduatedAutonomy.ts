/**
 * Task #50 — Graduated Autonomy Service
 * Progressive trust levels for AI actions based on user interaction history
 */

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

// In-memory profiles
const profiles = new Map<number, AutonomyProfile>();

export function getProfile(userId: number): AutonomyProfile {
  if (!profiles.has(userId)) {
    profiles.set(userId, {
      userId,
      level: "supervised",
      trustScore: 0,
      totalInteractions: 0,
      successfulActions: 0,
      overriddenActions: 0,
      escalations: 0,
      levelHistory: [{ level: "supervised", achievedAt: new Date().toISOString(), reason: "Initial level" }],
    });
  }
  return profiles.get(userId)!;
}

export function recordInteraction(userId: number, success: boolean, overridden: boolean, escalated: boolean): AutonomyProfile {
  const profile = getProfile(userId);
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

  return profile;
}

export function canPerformAction(userId: number, action: string): { allowed: boolean; confirmationRequired: boolean; reason: string } {
  const profile = getProfile(userId);
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

export function getAvailableActions(userId: number): AutonomyAction[] {
  const profile = getProfile(userId);
  const levels: AutonomyLevel[] = ["supervised", "guided", "semi_autonomous", "autonomous"];
  const userLevelIdx = levels.indexOf(profile.level);
  return AUTONOMY_ACTIONS.filter(a => levels.indexOf(a.requiredLevel) <= userLevelIdx);
}

export function getLevelProgress(userId: number): { currentLevel: AutonomyLevel; nextLevel: AutonomyLevel | null; progress: number } {
  const profile = getProfile(userId);
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
