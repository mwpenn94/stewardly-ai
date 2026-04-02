/**
 * Task #35 — Proactive Escalation + Video Consultation Service
 * Detects when human intervention is needed, manages professional availability,
 * and handles consultation booking with Daily.co video rooms.
 */
import { getDb } from "../db";
import {
  proactiveEscalationRules, professionalAvailability,
  consultationBookings,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Escalation Detection ────────────────────────────────────────────────
interface EscalationContext {
  sentimentScore?: number;
  complianceScore?: number;
  complexityLevel?: string;
  consecutiveNegative?: number;
  topicSensitivity?: string;
  userRequestedHuman?: boolean;
}

export async function checkEscalationNeeded(context: EscalationContext): Promise<{
  shouldEscalate: boolean;
  reason?: string;
  urgency: "low" | "medium" | "high";
}> {
  // Hard triggers
  if (context.userRequestedHuman) {
    return { shouldEscalate: true, reason: "User explicitly requested human advisor", urgency: "high" };
  }
  if (context.complianceScore !== undefined && context.complianceScore < 50) {
    return { shouldEscalate: true, reason: "Compliance score critically low", urgency: "high" };
  }
  if (context.sentimentScore !== undefined && context.sentimentScore < -0.5) {
    return { shouldEscalate: true, reason: "Negative sentiment detected", urgency: "medium" };
  }
  if ((context.consecutiveNegative ?? 0) >= 3) {
    return { shouldEscalate: true, reason: "Multiple consecutive negative interactions", urgency: "medium" };
  }
  if (context.topicSensitivity === "high") {
    return { shouldEscalate: true, reason: "High-sensitivity topic requires human review", urgency: "medium" };
  }

  // Check custom rules
  const db = await getDb(); if (!db) return null as any;
  const rules = await db.select().from(proactiveEscalationRules).where(eq(proactiveEscalationRules.active, true));
  for (const rule of rules) {
    const threshold = rule.threshold ?? 0;
    const contextValue = (context as any)[rule.triggerType];
    if (contextValue !== undefined && contextValue < threshold) {
      return { shouldEscalate: true, reason: rule.conditionText ?? rule.triggerType, urgency: "medium" };
    }
  }

  return { shouldEscalate: false, urgency: "low" };
}

// ─── Professional Availability ───────────────────────────────────────────
export async function setAvailability(professionalId: number, slots: Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone?: string;
}>): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  // Clear existing
  await db.delete(professionalAvailability).where(eq(professionalAvailability.professionalId, professionalId));
  // Insert new
  for (const slot of slots) {
    await db.insert(professionalAvailability).values({
      professionalId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timezone: slot.timezone ?? "America/New_York",
    });
  }
}

export async function getAvailability(professionalId: number) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(professionalAvailability)
    .where(eq(professionalAvailability.professionalId, professionalId));
}

// ─── Consultation Booking ────────────────────────────────────────────────
export async function bookConsultation(params: {
  userId: number;
  professionalId: number;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string;
}): Promise<{ id: number; dailyRoomUrl: string }> {
  const db = await getDb(); if (!db) return null as any;

  // Generate a Daily.co room URL (placeholder — real impl would call Daily API)
  const roomName = `stewardly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dailyRoomUrl = `https://stewardly.daily.co/${roomName}`;

  const [result] = await db.insert(consultationBookings).values({
    userId: params.userId,
    professionalId: params.professionalId,
    scheduledAt: params.scheduledAt,
    durationMinutes: params.durationMinutes ?? 30,
    dailyRoomUrl,
    notes: params.notes,
    status: "scheduled",
  }).$returningId();

  return { id: result.id, dailyRoomUrl };
}

export async function updateBookingStatus(
  bookingId: number,
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled"
): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  await db.update(consultationBookings).set({ status }).where(eq(consultationBookings.id, bookingId));
}

export async function getUserBookings(userId: number) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(consultationBookings)
    .where(eq(consultationBookings.userId, userId))
    .orderBy(desc(consultationBookings.scheduledAt));
}

// ─── Escalation Rules CRUD ───────────────────────────────────────────────
export async function createEscalationRule(params: {
  triggerType: string;
  conditionText?: string;
  threshold?: number;
}): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const [result] = await db.insert(proactiveEscalationRules).values({
    triggerType: params.triggerType,
    conditionText: params.conditionText,
    threshold: params.threshold,
  }).$returningId();
  return result.id;
}

export async function getEscalationRules() {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(proactiveEscalationRules).orderBy(desc(proactiveEscalationRules.createdAt));
}
