import { getDb } from "./db";
import { portalEngagement } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface PortalEvent {
  userId: number;
  eventType: "page_view" | "feature_use" | "document_access" | "tool_use" | "chat_session" | "login";
  pagePath: string;
  featureName?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface EngagementAnalysis {
  userId: number;
  totalSessions: number;
  avgSessionDuration: number;
  topFeatures: FeatureUsage[];
  engagementScore: number; // 0-100
  engagementTrend: "increasing" | "stable" | "declining";
  recommendations: string[];
  adoptionStage: "onboarding" | "exploring" | "regular" | "power_user" | "at_risk";
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  lastUsed: string;
}

export interface PortalHealthMetrics {
  totalUsers: number;
  activeUsers30d: number;
  avgEngagementScore: number;
  featureAdoption: Record<string, number>;
  atRiskUsers: number;
  topFeatures: string[];
}

// ─── Engagement Scoring ────────────────────────────────────────
export function calculateEngagementScore(events: PortalEvent[], dayRange: number = 30): number {
  if (events.length === 0) return 0;

  const uniqueDays = new Set(events.map(e => new Date().toISOString().split("T")[0])).size;
  const featureVariety = new Set(events.filter(e => e.featureName).map(e => e.featureName)).size;
  const totalDuration = events.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

  // Frequency (0-35): how often they visit
  const frequencyScore = Math.min(35, (uniqueDays / dayRange) * 100 * 0.35);

  // Depth (0-30): how many features they use
  const depthScore = Math.min(30, featureVariety * 5);

  // Duration (0-20): how long they spend
  const avgDuration = events.length > 0 ? totalDuration / events.length : 0;
  const durationScore = Math.min(20, (avgDuration / 300) * 20); // 5 min avg = full score

  // Recency (0-15): how recently they visited
  const recencyScore = events.length > 0 ? 15 : 0; // Simplified — events are already filtered

  return Math.round(frequencyScore + depthScore + durationScore + recencyScore);
}

export function determineAdoptionStage(
  score: number,
  daysSinceFirstLogin: number,
  daysSinceLastLogin: number
): "onboarding" | "exploring" | "regular" | "power_user" | "at_risk" {
  if (daysSinceLastLogin > 30) return "at_risk";
  if (daysSinceFirstLogin < 7) return "onboarding";
  if (score >= 75) return "power_user";
  if (score >= 40) return "regular";
  return "exploring";
}

export function generateRecommendations(
  stage: string,
  topFeatures: FeatureUsage[],
  score: number
): string[] {
  const recs: string[] = [];

  switch (stage) {
    case "onboarding":
      recs.push("Complete your financial profile to unlock personalized insights");
      recs.push("Try the AI chat to ask your first financial question");
      recs.push("Explore the Education Center for foundational financial literacy");
      break;
    case "exploring":
      recs.push("Set up your first financial goal to start tracking progress");
      recs.push("Try the calculator tools for retirement or loan planning");
      if (!topFeatures.some(f => f.feature === "education")) {
        recs.push("Check out the Education Center for personalized learning modules");
      }
      break;
    case "regular":
      if (!topFeatures.some(f => f.feature === "equity_comp")) {
        recs.push("If you have stock options or RSUs, try the Equity Compensation planner");
      }
      if (!topFeatures.some(f => f.feature === "digital_assets")) {
        recs.push("Organize your digital asset estate plan for comprehensive coverage");
      }
      break;
    case "power_user":
      recs.push("Share your experience — refer a colleague to Stewardly");
      recs.push("Review your annual financial health report");
      break;
    case "at_risk":
      recs.push("We miss you! Check in to see what's new in your financial plan");
      recs.push("New features have been added since your last visit");
      break;
  }

  return recs;
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function trackPortalEvent(event: PortalEvent) {
  const db = await getDb();
  if (!db) return;
  return db.insert(portalEngagement).values({
    userId: event.userId,
    sessionDate: new Date(),
    loginCount: event.eventType === "login" ? 1 : 0,
    timeSpentSeconds: event.durationSeconds || 0,
    pagesVisited: 1,
    featuresUsed: event.featureName || event.pagePath,
    engagementScore: 0,
  });
}

export async function getUserEngagement(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(portalEngagement)
    .where(eq(portalEngagement.userId, userId))
    .orderBy(desc(portalEngagement.sessionDate))
    .limit(limit);
}

export async function getPortalHealthMetrics() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      totalUsers: sql<number>`COUNT(DISTINCT ${portalEngagement.userId})`,
      totalEvents: sql<number>`COUNT(*)`,
    })
    .from(portalEngagement);
  return rows[0] || null;
}
