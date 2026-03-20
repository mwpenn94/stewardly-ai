import { getDb } from "../db";
import { propagationEvents, propagationActions, coachingMessages } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// ─── Layer Hierarchy ────────────────────────────────────────────────────────

const LAYER_ORDER = ["platform", "organization", "manager", "professional", "user"] as const;
type Layer = typeof LAYER_ORDER[number];

// ─── Create Propagation Event ───────────────────────────────────────────────

export async function createPropagationEvent(params: {
  sourceLayer: Layer;
  targetLayer: Layer;
  eventType: "insight" | "alert" | "recommendation" | "compliance" | "milestone" | "risk_change" | "opportunity";
  sourceEntityId?: number;
  targetEntityId?: number;
  payload: Record<string, unknown>;
  priority?: "critical" | "high" | "medium" | "low";
  expiresInHours?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = crypto.randomUUID();
  const expiresAt = params.expiresInHours
    ? new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000)
    : null;

  await db.insert(propagationEvents).values({
    id,
    sourceLayer: params.sourceLayer,
    targetLayer: params.targetLayer,
    eventType: params.eventType,
    sourceEntityId: params.sourceEntityId ?? null,
    targetEntityId: params.targetEntityId ?? null,
    payload: JSON.stringify(params.payload),
    priority: params.priority ?? "medium",
    status: "pending",
    expiresAt,
  });

  return id;
}

// ─── Deliver Events ─────────────────────────────────────────────────────────

export async function deliverPendingEvents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pending = await db.select().from(propagationEvents)
    .where(eq(propagationEvents.status, "pending"))
    .orderBy(
      sql`FIELD(${propagationEvents.priority}, 'critical', 'high', 'medium', 'low')`,
      propagationEvents.createdAt,
    )
    .limit(100);

  let delivered = 0;
  for (const event of pending) {
    await db.update(propagationEvents)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(eq(propagationEvents.id, event.id));
    delivered++;
  }

  return { delivered };
}

// ─── Get Events for Entity ──────────────────────────────────────────────────

export async function getEventsForEntity(
  targetLayer: Layer,
  targetEntityId: number,
  limit = 50,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(propagationEvents)
    .where(and(
      eq(propagationEvents.targetLayer, targetLayer),
      eq(propagationEvents.targetEntityId, targetEntityId),
    ))
    .orderBy(desc(propagationEvents.createdAt))
    .limit(limit);
}

// ─── Record Action on Event ─────────────────────────────────────────────────

export async function recordAction(
  eventId: string,
  actorId: number,
  actionType: "acknowledge" | "act" | "dismiss" | "escalate" | "snooze" | "delegate",
  notes?: string,
  resultData?: Record<string, unknown>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(propagationActions).values({
    id: crypto.randomUUID(),
    eventId,
    actorId,
    actionType,
    notes: notes ?? null,
    resultData: resultData ? JSON.stringify(resultData) : null,
  });

  // Update event status based on action
  const statusMap: Record<string, string> = {
    acknowledge: "acknowledged",
    act: "acted",
    dismiss: "dismissed",
  };

  if (statusMap[actionType]) {
    await db.update(propagationEvents)
      .set({ status: statusMap[actionType] as any })
      .where(eq(propagationEvents.id, eventId));
  }
}

// ─── Cascade Intelligence (Upward/Downward) ─────────────────────────────────

export async function cascadeInsight(params: {
  originLayer: Layer;
  originEntityId: number;
  insight: string;
  insightType: "pattern" | "risk" | "opportunity" | "compliance";
  confidence: number;
  direction: "up" | "down" | "both";
}) {
  const originIndex = LAYER_ORDER.indexOf(params.originLayer);
  const events: string[] = [];

  if (params.direction === "up" || params.direction === "both") {
    // Propagate upward (user -> professional -> manager -> org -> platform)
    for (let i = originIndex - 1; i >= 0; i--) {
      const eventId = await createPropagationEvent({
        sourceLayer: params.originLayer,
        targetLayer: LAYER_ORDER[i],
        eventType: "insight",
        sourceEntityId: params.originEntityId,
        payload: {
          insight: params.insight,
          insightType: params.insightType,
          confidence: params.confidence,
          cascadeDirection: "up",
        },
        priority: params.confidence > 0.8 ? "high" : "medium",
      });
      events.push(eventId);
    }
  }

  if (params.direction === "down" || params.direction === "both") {
    // Propagate downward (platform -> org -> manager -> professional -> user)
    for (let i = originIndex + 1; i < LAYER_ORDER.length; i++) {
      const eventId = await createPropagationEvent({
        sourceLayer: params.originLayer,
        targetLayer: LAYER_ORDER[i],
        eventType: "recommendation",
        sourceEntityId: params.originEntityId,
        payload: {
          insight: params.insight,
          insightType: params.insightType,
          confidence: params.confidence,
          cascadeDirection: "down",
        },
        priority: params.confidence > 0.8 ? "high" : "medium",
      });
      events.push(eventId);
    }
  }

  return events;
}

// ─── Coaching Messages ──────────────────────────────────────────────────────

export async function createCoachingMessage(params: {
  userId: number;
  organizationId?: number;
  messageType: "nudge" | "celebration" | "reminder" | "education" | "insight" | "alert";
  category?: string;
  title: string;
  content: string;
  priority?: "critical" | "high" | "medium" | "low";
  triggerEvent?: string;
  expiresInDays?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = crypto.randomUUID();
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.insert(coachingMessages).values({
    id,
    userId: params.userId,
    organizationId: params.organizationId ?? null,
    messageType: params.messageType,
    category: params.category ?? null,
    title: params.title,
    content: params.content,
    priority: params.priority ?? "medium",
    triggerEvent: params.triggerEvent ?? null,
    status: "pending",
    expiresAt,
  });

  return id;
}

export async function getCoachingMessages(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(coachingMessages)
    .where(eq(coachingMessages.userId, userId))
    .orderBy(
      sql`FIELD(${coachingMessages.priority}, 'critical', 'high', 'medium', 'low')`,
      desc(coachingMessages.createdAt),
    )
    .limit(limit);
}

export async function markCoachingMessageRead(messageId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(coachingMessages)
    .set({ status: "read", readAt: new Date() })
    .where(eq(coachingMessages.id, messageId));
}

// ─── Expire Old Events ─────────────────────────────────────────────────────

export async function expireOldEvents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.update(propagationEvents)
    .set({ status: "expired" })
    .where(and(
      sql`${propagationEvents.expiresAt} IS NOT NULL`,
      sql`${propagationEvents.expiresAt} < NOW()`,
      sql`${propagationEvents.status} IN ('pending', 'delivered')`,
    ));

  return { expired: 0 }; // drizzle doesn't return affected rows easily
}
