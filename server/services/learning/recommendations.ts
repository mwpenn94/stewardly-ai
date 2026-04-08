/**
 * EMBA Learning — cross-system study recommendations (Task 5B, 5C).
 *
 * Fuses signals from:
 *   - SRS mastery (what's due, what's weak)
 *   - Licensure state (CE deadlines, exam prep needs)
 *   - Calculator usage (which engines the user touched recently)
 *
 * Used by the `recommend_study_content` ReAct agent tool and by the
 * Learning Home dashboard. Pure-ish: the fusion logic is broken out
 * so it can be unit-tested without DB dependencies.
 */

import { getUserMastery, getMasterySummary } from "./mastery";
import { getUserLicenses, deriveLicenseAlerts } from "./licenses";

export interface StudyRecommendation {
  priority: number; // 1 = highest
  reason: string;
  action: string;
  trackSlug?: string;
  licenseType?: string;
  estimatedMinutes?: number;
}

// ─── Calculator → track mapping ──────────────────────────────────────────
// Used by the `onCalculatorCompletion` proactive trigger.
export const CALCULATOR_TRACK_MAP: Record<string, string[]> = {
  rothExplorer: ["cfp", "financial_planning", "series66"],
  calculateGuardrails: ["cfp", "financial_planning"],
  projectBizIncome: ["general_insurance", "life_health"],
  stressTest: ["series7", "sie"],
  backtest: ["series7", "investment_advisory"],
  autoSelectProducts: ["life_health", "premium_financing"],
  holisticSimulate: ["cfp", "estate_planning"],
  uweSimulate: ["cfp", "financial_planning"],
  bieSimulate: ["life_health", "premium_financing"],
  heSimulate: ["cfp", "estate_planning"],
};

/**
 * Pure: fuse signals into a prioritized recommendation list. Split
 * from the DB calls so tests can drive it deterministically.
 */
export function fuseRecommendations(inputs: {
  dueCount: number;
  masteryPct: number;
  licenseAlerts: { licenseType: string; alertType: string; daysOut: number | null; message: string }[];
  recentCalculators: string[];
  weakTrackSlugs: string[];
}): StudyRecommendation[] {
  const recs: StudyRecommendation[] = [];

  // Priority 1: SRS items due for review (memory decay)
  if (inputs.dueCount > 0) {
    recs.push({
      priority: 1,
      reason: `${inputs.dueCount} items are due for review — your memory is decaying on these.`,
      action: "Start a 10-minute review session",
      estimatedMinutes: 10,
    });
  }

  // Priority 2: CE credits approaching deadline
  for (const a of inputs.licenseAlerts) {
    if (a.alertType === "ce_credits_needed") {
      recs.push({
        priority: 2,
        reason: a.message,
        action: "Complete CE modules",
        licenseType: a.licenseType,
        estimatedMinutes: 60,
      });
    }
  }

  // Priority 3: License expiration warnings
  for (const a of inputs.licenseAlerts) {
    if (a.alertType === "expiration_warning" && a.daysOut !== null && a.daysOut < 90) {
      recs.push({
        priority: 3,
        reason: a.message,
        action: "Schedule license renewal",
        licenseType: a.licenseType,
        estimatedMinutes: 15,
      });
    }
  }

  // Priority 4: Calculator-informed training suggestions
  const seen = new Set<string>();
  for (const calc of inputs.recentCalculators) {
    const tracks = CALCULATOR_TRACK_MAP[calc] ?? [];
    for (const slug of tracks) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      if (inputs.weakTrackSlugs.includes(slug)) {
        recs.push({
          priority: 4,
          reason: `You recently used ${calc} — brushing up on ${slug} will sharpen your recommendations.`,
          action: "Study 1 chapter",
          trackSlug: slug,
          estimatedMinutes: 20,
        });
      }
    }
  }

  // Priority 5: Low overall mastery — general broadening
  if (inputs.masteryPct < 40 && recs.length < 3) {
    recs.push({
      priority: 5,
      reason: `Overall mastery is ${inputs.masteryPct}% — consider a broader daily study habit.`,
      action: "Open Study Session",
      estimatedMinutes: 15,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

// ─── DB-backed convenience wrapper ───────────────────────────────────────

export async function recommendStudyContent(
  userId: number,
  recentCalculators: string[] = [],
): Promise<StudyRecommendation[]> {
  const summary = await getMasterySummary(userId);
  const licenses = await getUserLicenses(userId);
  const alerts = deriveLicenseAlerts(licenses as any);

  // Gather weak track slugs from mastery items whose itemKey matches "track:<slug>:*"
  const mastery = await getUserMastery(userId);
  const weakTrackCounts: Record<string, { total: number; unmastered: number }> = {};
  for (const m of mastery) {
    const match = /^track:([^:]+):/.exec(m.itemKey);
    if (!match) continue;
    const slug = match[1];
    const bucket = weakTrackCounts[slug] || (weakTrackCounts[slug] = { total: 0, unmastered: 0 });
    bucket.total += 1;
    if (!m.mastered) bucket.unmastered += 1;
  }
  const weakTrackSlugs = Object.entries(weakTrackCounts)
    .filter(([, v]) => v.total > 0 && v.unmastered / v.total > 0.3)
    .map(([slug]) => slug);

  return fuseRecommendations({
    dueCount: summary.dueNow,
    masteryPct: summary.masteryPct,
    licenseAlerts: alerts,
    recentCalculators,
    weakTrackSlugs,
  });
}
