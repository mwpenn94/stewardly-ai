import { getDb } from "./db";
import { notificationLog } from "../drizzle/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface AmbientInsight {
  type: "market_event" | "life_event" | "plan_deviation" | "opportunity" | "risk_alert" | "education";
  title: string;
  body: string;
  priority: "low" | "medium" | "high" | "critical";
  channel: "in_app" | "digest" | "push";
  actionUrl?: string;
  suppressible: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  channels: ("in_app" | "digest" | "push")[];
  quietHoursStart?: number; // 0-23
  quietHoursEnd?: number;
  maxPerDay: number;
  categories: Record<string, boolean>;
}

// ─── Insight Generation ────────────────────────────────────────
export function generateMarketInsight(event: string, impact: string): AmbientInsight {
  return {
    type: "market_event",
    title: `Market Update: ${event}`,
    body: impact,
    priority: "medium",
    channel: "in_app",
    suppressible: true,
  };
}

export function generateLifeEventInsight(event: string, implications: string[]): AmbientInsight {
  return {
    type: "life_event",
    title: `Life Event Detected: ${event}`,
    body: `This may affect your financial plan. Key implications:\n${implications.map(i => `• ${i}`).join("\n")}`,
    priority: "high",
    channel: "in_app",
    actionUrl: "/chat",
    suppressible: false,
  };
}

export function generatePlanDeviationInsight(category: string, deviation: number): AmbientInsight {
  const severity = Math.abs(deviation) > 20 ? "high" : Math.abs(deviation) > 10 ? "medium" : "low";
  return {
    type: "plan_deviation",
    title: `${category} Plan Deviation`,
    body: `Your ${category.toLowerCase()} is ${Math.abs(deviation).toFixed(0)}% ${deviation > 0 ? "above" : "below"} your target. ${severity === "high" ? "Consider reviewing your plan." : "This is within normal fluctuation."}`,
    priority: severity,
    channel: severity === "high" ? "in_app" : "digest",
    actionUrl: "/plan-adherence",
    suppressible: severity !== "high",
  };
}

export function generateOpportunityInsight(title: string, description: string): AmbientInsight {
  return {
    type: "opportunity",
    title,
    body: description,
    priority: "medium",
    channel: "in_app",
    suppressible: true,
  };
}

// ─── Notification Fatigue Prevention ───────────────────────────
export function shouldSuppress(
  insight: AmbientInsight,
  recentCount: number,
  prefs: NotificationPreferences
): { suppress: boolean; reason?: string } {
  if (!prefs.enabled) return { suppress: true, reason: "Notifications disabled" };

  if (recentCount >= prefs.maxPerDay && insight.suppressible) {
    return { suppress: true, reason: `Daily limit (${prefs.maxPerDay}) reached` };
  }

  const now = new Date().getHours();
  if (prefs.quietHoursStart !== undefined && prefs.quietHoursEnd !== undefined) {
    const inQuietHours = prefs.quietHoursStart < prefs.quietHoursEnd
      ? now >= prefs.quietHoursStart && now < prefs.quietHoursEnd
      : now >= prefs.quietHoursStart || now < prefs.quietHoursEnd;
    if (inQuietHours && insight.priority !== "critical") {
      return { suppress: true, reason: "Quiet hours" };
    }
  }

  if (prefs.categories[insight.type] === false) {
    return { suppress: true, reason: `Category ${insight.type} disabled` };
  }

  return { suppress: false };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveNotification(userId: number, insight: AmbientInsight, suppressedReason?: string) {
  const db = await getDb();
  if (!db) return;
  const channelMap: Record<string, "in_app" | "push" | "sms"> = {
    in_app: "in_app", push: "in_app", digest: "in_app",
  };
  return db.insert(notificationLog).values({
    userId,
    type: insight.type,
    channel: channelMap[insight.channel] || "in_app",
    urgency: insight.priority,
    title: insight.title,
    content: insight.body,
    suppressed: !!suppressedReason,
    suppressionReason: suppressedReason || null,
  });
}

export async function getUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), isNull(notificationLog.readAt)))
    .orderBy(desc(notificationLog.createdAt))
    .limit(50);
}

export async function markNotificationRead(notificationId: number) {
  const db = await getDb();
  if (!db) return;
  return db
    .update(notificationLog)
    .set({ readAt: new Date() })
    .where(eq(notificationLog.id, notificationId));
}

export async function getNotificationHistory(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId))
    .orderBy(desc(notificationLog.createdAt))
    .limit(limit);
}
