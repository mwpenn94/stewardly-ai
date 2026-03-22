/**
 * eSignature Tracking Service
 * Phase 5 of Prompt 2: DocuSign / Dropbox Sign integration
 */
import { getDb } from "../db";
import { esignatureTracking } from "../../drizzle/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

export type EsignatureProvider = "docusign" | "dropbox_sign" | "manual";
export type EsignatureStatus = "created" | "sent" | "delivered" | "viewed" | "signed" | "completed" | "declined" | "voided" | "expired";

export interface CreateEnvelopeInput {
  professionalId: number;
  clientUserId?: number;
  provider: EsignatureProvider;
  documentType?: string;
  relatedProductId?: number;
  relatedQuoteId?: number;
}

export interface UpdateEnvelopeInput {
  envelopeId: string;
  status: EsignatureStatus;
}

// ─── Provider Config ──────────────────────────────────────────────────────

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  accountId?: string;
}

async function getProviderConfig(provider: EsignatureProvider): Promise<ProviderConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const { integrationConnections } = await import("../../drizzle/schema");
  const { decrypt } = await import("./encryption");

  const providerId = provider === "docusign" ? "docusign" : provider === "dropbox_sign" ? "dropbox_sign" : null;
  if (!providerId) return null;

  const conn = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.providerId, providerId))
    .limit(1);

  if (conn.length === 0 || !conn[0].credentialsEncrypted) return null;

  try {
    const creds = JSON.parse(decrypt(conn[0].credentialsEncrypted));
    return {
      apiKey: creds.apiKey || creds.api_key || "",
      baseUrl: creds.baseUrl || (provider === "docusign" ? "https://demo.docusign.net/restapi/v2.1" : "https://api.hellosign.com/v3"),
      accountId: creds.accountId || creds.account_id,
    };
  } catch {
    return null;
  }
}

// ─── Envelope Management ──────────────────────────────────────────────────

function generateEnvelopeId(): string {
  return `ENV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function createEnvelope(input: CreateEnvelopeInput): Promise<{ envelopeId: string; status: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const envelopeId = generateEnvelopeId();
  const config = await getProviderConfig(input.provider);

  let externalEnvelopeId: string | null = null;

  // Try to create envelope via provider API
  if (config && input.provider === "docusign") {
    try {
      const response = await fetch(`${config.baseUrl}/accounts/${config.accountId}/envelopes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailSubject: `Please sign: ${input.documentType || "Document"}`,
          status: "created",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        externalEnvelopeId = data.envelopeId;
      }
    } catch (e) {
      console.warn("[eSignature] DocuSign API call failed, using local tracking:", e);
    }
  }

  await db.insert(esignatureTracking).values({
    professionalId: input.professionalId,
    clientUserId: input.clientUserId ?? null,
    envelopeId: externalEnvelopeId || envelopeId,
    provider: input.provider,
    documentType: input.documentType ?? null,
    status: "created",
    sentAt: null,
    signedAt: null,
    completedAt: null,
    relatedProductId: input.relatedProductId ?? null,
    relatedQuoteId: input.relatedQuoteId ?? null,
  });

  return { envelopeId: externalEnvelopeId || envelopeId, status: "created" };
}

export async function updateEnvelopeStatus(input: UpdateEnvelopeInput): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = Date.now();
  const updates: Record<string, any> = { status: input.status };

  if (input.status === "sent") updates.sentAt = now;
  if (input.status === "signed") updates.signedAt = now;
  if (input.status === "completed") updates.completedAt = now;

  await db.update(esignatureTracking)
    .set(updates)
    .where(eq(esignatureTracking.envelopeId, input.envelopeId));
}

export async function getEnvelopesByProfessional(professionalId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(esignatureTracking)
    .where(eq(esignatureTracking.professionalId, professionalId))
    .orderBy(desc(esignatureTracking.createdAt));
}

export async function getEnvelopesByClient(clientUserId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(esignatureTracking)
    .where(eq(esignatureTracking.clientUserId, clientUserId))
    .orderBy(desc(esignatureTracking.createdAt));
}

export async function getEnvelopeByEnvelopeId(envelopeId: string): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(esignatureTracking)
    .where(eq(esignatureTracking.envelopeId, envelopeId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function getPendingEnvelopes(professionalId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(esignatureTracking)
    .where(and(
      eq(esignatureTracking.professionalId, professionalId),
      isNull(esignatureTracking.completedAt),
    ))
    .orderBy(desc(esignatureTracking.createdAt));
}

export async function getSignatureStats(professionalId: number): Promise<{
  total: number;
  pending: number;
  completed: number;
  avgCompletionDays: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, completed: 0, avgCompletionDays: 0 };

  const rows = await db.select().from(esignatureTracking)
    .where(eq(esignatureTracking.professionalId, professionalId));

  const total = rows.length;
  const completed = rows.filter(r => r.status === "completed").length;
  const pending = rows.filter(r => !["completed", "declined", "voided", "expired"].includes(r.status)).length;

  const completedWithTimes = rows.filter(r => r.sentAt && r.completedAt);
  const avgMs = completedWithTimes.length > 0
    ? completedWithTimes.reduce((sum, r) => sum + ((r.completedAt ?? 0) - (r.sentAt ?? 0)), 0) / completedWithTimes.length
    : 0;
  const avgCompletionDays = Math.round(avgMs / (1000 * 60 * 60 * 24) * 10) / 10;

  return { total, pending, completed, avgCompletionDays };
}

// ─── Webhook Handler ──────────────────────────────────────────────────────

export async function handleWebhook(provider: EsignatureProvider, payload: any): Promise<void> {
  let envelopeId: string | undefined;
  let status: EsignatureStatus | undefined;

  if (provider === "docusign") {
    envelopeId = payload?.data?.envelopeId || payload?.envelopeId;
    const dsStatus = payload?.data?.envelopeSummary?.status || payload?.status;
    status = mapDocuSignStatus(dsStatus);
  } else if (provider === "dropbox_sign") {
    envelopeId = payload?.signature_request?.signature_request_id;
    const dsStatus = payload?.event?.event_type;
    status = mapDropboxSignStatus(dsStatus);
  }

  if (envelopeId && status) {
    await updateEnvelopeStatus({ envelopeId, status });
  }
}

function mapDocuSignStatus(dsStatus: string): EsignatureStatus {
  const map: Record<string, EsignatureStatus> = {
    created: "created",
    sent: "sent",
    delivered: "delivered",
    completed: "completed",
    declined: "declined",
    voided: "voided",
  };
  return map[dsStatus?.toLowerCase()] ?? "sent";
}

function mapDropboxSignStatus(eventType: string): EsignatureStatus {
  const map: Record<string, EsignatureStatus> = {
    signature_request_sent: "sent",
    signature_request_viewed: "viewed",
    signature_request_signed: "signed",
    signature_request_all_signed: "completed",
    signature_request_declined: "declined",
    signature_request_expired: "expired",
  };
  return map[eventType?.toLowerCase()] ?? "sent";
}
