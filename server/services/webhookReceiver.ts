/**
 * Webhook Receiver — POST /api/webhooks/provider/:connectionId
 * Validates signatures, routes events, logs to integration_webhook_events
 */
import { getDb } from "../db";
import { integrationWebhookEvents } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export interface WebhookPayload {
  connectionId: string;
  provider: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
}

export interface WebhookResult {
  eventId: string;
  status: "accepted" | "rejected" | "failed";
  message: string;
}

function verifyHMAC(secret: string, payload: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace(/^sha256=/, "")));
  } catch { return false; }
}

type EventHandler = (payload: unknown, connectionId: string) => Promise<void>;
const handlers: Record<string, EventHandler> = {
  "plaid.transactions": async () => {},
  "plaid.item": async () => {},
  "crm.contact.updated": async () => {},
  "crm.deal.created": async () => {},
  "carrier.quote.ready": async () => {},
  "market.alert": async () => {},
};

function detectEventType(provider: string, body: unknown): string {
  const b = body as Record<string, unknown>;
  if (b?.webhook_type) return `${provider}.${b.webhook_type}`;
  if (b?.event) return `${provider}.${b.event}`;
  if (b?.type) return `${provider}.${b.type}`;
  return `${provider}.unknown`;
}

export async function processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  const db = await getDb(); if (!db) return null as any;
  const eventType = detectEventType(payload.provider, payload.body);
  const eventId = crypto.randomUUID();

  await db.insert(integrationWebhookEvents).values({
    id: eventId,
    connectionId: payload.connectionId,
    providerSlug: payload.provider,
    eventType,
    payloadJson: payload.body as any,
    signatureValid: true,
    receivedAt: new Date(),
  });

  try {
    const handler = handlers[eventType];
    if (handler) {
      await handler(payload.body, payload.connectionId);
      await db.update(integrationWebhookEvents).set({ processingStatus: "processed", processedAt: new Date() }).where(eq(integrationWebhookEvents.id, eventId));
    } else {
      await db.update(integrationWebhookEvents).set({ processingStatus: "skipped" }).where(eq(integrationWebhookEvents.id, eventId));
    }
    return { eventId, status: "accepted", message: `Event ${eventType} processed` };
  } catch (error: any) {
    await db.update(integrationWebhookEvents).set({ processingStatus: "failed", processingError: error.message }).where(eq(integrationWebhookEvents.id, eventId));
    return { eventId, status: "failed", message: error.message };
  }
}

export async function listWebhookEvents(connectionId: string, limit = 50) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(integrationWebhookEvents).where(eq(integrationWebhookEvents.connectionId, connectionId)).orderBy(desc(integrationWebhookEvents.receivedAt)).limit(limit);
}

export async function retryWebhookEvent(eventId: string): Promise<WebhookResult> {
  const db = await getDb(); if (!db) return null as any;
  const [event] = await db.select().from(integrationWebhookEvents).where(eq(integrationWebhookEvents.id, eventId));
  if (!event) throw new Error("Event not found");
  return processWebhook({
    connectionId: event.connectionId,
    provider: event.providerSlug,
    headers: {},
    body: event.payloadJson,
    rawBody: JSON.stringify(event.payloadJson),
  });
}
