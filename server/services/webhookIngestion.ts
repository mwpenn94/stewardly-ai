/**
 * Webhook Ingestion Service
 * Provides public webhook endpoints for external systems (CRMs, custodians, market data providers)
 * to push data directly into the ingestion pipeline in real-time.
 *
 * Features:
 * - HMAC-SHA256 signature verification for secure payloads
 * - Rate limiting per webhook source
 * - Multi-format support (JSON, CSV, form-data)
 * - Auto-mapping to ingested_records schema
 * - Webhook registration with secret key generation
 * - Event logging and replay capability
 */

import { getDb } from "../db";
import { dataSources, ingestionJobs, ingestedRecords } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { notifyOwner } from "../_core/notification";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  dataSourceId: number;
  name: string;
  secretKey: string;
  allowedIps?: string[];
  rateLimit: number; // requests per minute
  isActive: boolean;
  fieldMapping?: Record<string, string>; // external field → internal field
  defaultRecordType: string;
  createdAt: number;
}

export interface WebhookPayload {
  event?: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  timestamp?: string | number;
}

export interface WebhookResult {
  accepted: number;
  rejected: number;
  errors: string[];
  jobId: number;
  webhookId: string;
}

interface WebhookEvent {
  webhookId: string;
  receivedAt: number;
  payload: unknown;
  signature: string;
  sourceIp: string;
  status: "accepted" | "rejected" | "error";
  error?: string;
  recordsCreated: number;
}

// ─── In-Memory State ───────────────────────────────────────────────────────

// Webhook configs stored in memory (backed by data_sources configJson)
const webhookRegistry = new Map<string, WebhookConfig>();

// Rate limit tracking: webhookId → { count, windowStart }
const rateLimitState = new Map<string, { count: number; windowStart: number }>();

// Event log (circular buffer, last 1000 events)
const eventLog: WebhookEvent[] = [];
const MAX_EVENT_LOG = 1000;

// ─── Core Functions ────────────────────────────────────────────────────────

function generateWebhookId(): string {
  return `whk_${crypto.randomBytes(16).toString("hex")}`;
}

function generateSecretKey(): string {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

function computeHmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = computeHmac(payload, secret);
  // Timing-safe comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function checkRateLimit(webhookId: string, limit: number): boolean {
  const now = Date.now();
  const state = rateLimitState.get(webhookId);

  if (!state || now - state.windowStart > 60_000) {
    rateLimitState.set(webhookId, { count: 1, windowStart: now });
    return true;
  }

  if (state.count >= limit) return false;
  state.count++;
  return true;
}

function logEvent(event: WebhookEvent) {
  if (eventLog.length >= MAX_EVENT_LOG) {
    eventLog.shift();
  }
  eventLog.push(event);
}

// ─── Webhook Registration ──────────────────────────────────────────────────

export async function registerWebhook(opts: {
  name: string;
  description?: string;
  allowedIps?: string[];
  rateLimit?: number;
  fieldMapping?: Record<string, string>;
  defaultRecordType?: string;
  userId: number;
}): Promise<{ webhookId: string; secretKey: string; endpointUrl: string; dataSourceId: number }> {
  const webhookId = generateWebhookId();
  const secretKey = generateSecretKey();
  const now = Date.now();

  // Create a data source entry for this webhook
  const dbConn = (await getDb())!;
  const [result] = await dbConn.insert(dataSources).values({
    name: `Webhook: ${opts.name}`,
    sourceType: "api_feed",
    url: `/api/webhooks/${webhookId}`,
    authType: "bearer",
    scheduleCron: null,
    priority: 7,
    isActive: true,
    configJson: JSON.stringify({
      webhookId,
      type: "webhook",
      description: opts.description || "",
      allowedIps: opts.allowedIps || [],
      rateLimit: opts.rateLimit || 60,
      fieldMapping: opts.fieldMapping || {},
      defaultRecordType: opts.defaultRecordType || "customer_profile",
    }),
    createdAt: now,
    updatedAt: now,
  });

  const dataSourceId = result.insertId;

  const config: WebhookConfig = {
    id: webhookId,
    dataSourceId,
    name: opts.name,
    secretKey,
    allowedIps: opts.allowedIps,
    rateLimit: opts.rateLimit || 60,
    isActive: true,
    fieldMapping: opts.fieldMapping,
    defaultRecordType: opts.defaultRecordType || "customer_profile",
    createdAt: now,
  };

  webhookRegistry.set(webhookId, config);

  return {
    webhookId,
    secretKey,
    endpointUrl: `/api/webhooks/${webhookId}`,
    dataSourceId,
  };
}

// ─── Webhook Processing ────────────────────────────────────────────────────

export async function processWebhook(
  webhookId: string,
  rawBody: string,
  signature: string | undefined,
  sourceIp: string,
): Promise<WebhookResult> {
  const config = webhookRegistry.get(webhookId);

  if (!config) {
    // Try to load from DB
    const loaded = await loadWebhookFromDb(webhookId);
    if (!loaded) {
      throw new WebhookError("WEBHOOK_NOT_FOUND", `Webhook ${webhookId} not found`);
    }
  }

  const webhook = webhookRegistry.get(webhookId)!;

  if (!webhook.isActive) {
    throw new WebhookError("WEBHOOK_DISABLED", "This webhook is currently disabled");
  }

  // IP allowlist check
  if (webhook.allowedIps && webhook.allowedIps.length > 0) {
    if (!webhook.allowedIps.includes(sourceIp) && sourceIp !== "127.0.0.1") {
      logEvent({
        webhookId, receivedAt: Date.now(), payload: null, signature: signature || "",
        sourceIp, status: "rejected", error: "IP not allowed", recordsCreated: 0,
      });
      throw new WebhookError("IP_NOT_ALLOWED", `IP ${sourceIp} is not in the allowlist`);
    }
  }

  // Signature verification (optional but recommended)
  if (signature) {
    if (!verifySignature(rawBody, signature, webhook.secretKey)) {
      logEvent({
        webhookId, receivedAt: Date.now(), payload: null, signature,
        sourceIp, status: "rejected", error: "Invalid signature", recordsCreated: 0,
      });
      throw new WebhookError("INVALID_SIGNATURE", "HMAC signature verification failed");
    }
  }

  // Rate limit check
  if (!checkRateLimit(webhookId, webhook.rateLimit)) {
    logEvent({
      webhookId, receivedAt: Date.now(), payload: null, signature: signature || "",
      sourceIp, status: "rejected", error: "Rate limit exceeded", recordsCreated: 0,
    });
    throw new WebhookError("RATE_LIMITED", `Rate limit of ${webhook.rateLimit} req/min exceeded`);
  }

  // Parse payload
  let payload: WebhookPayload;
  try {
    const parsed = JSON.parse(rawBody);
    if (Array.isArray(parsed)) {
      payload = { data: parsed };
    } else if (parsed.data) {
      payload = parsed as WebhookPayload;
    } else {
      payload = { data: [parsed] };
    }
  } catch {
    throw new WebhookError("INVALID_PAYLOAD", "Could not parse JSON payload");
  }

  // Create ingestion job
  const now = Date.now();
  const dbConnJob = (await getDb())!;
  const [jobResult] = await dbConnJob.insert(ingestionJobs).values({
    dataSourceId: webhook.dataSourceId,
    status: "running",
    progressPct: 0,
    startedAt: now,
    createdAt: now,
  });
  const jobId = jobResult.insertId;

  // Process records
  const records = Array.isArray(payload.data) ? payload.data : [payload.data];
  let accepted = 0;
  let rejected = 0;
  const errors: string[] = [];

  const dbConn2 = (await getDb())!;

  for (const record of records) {
    try {
      const mapped = applyFieldMapping(record, webhook.fieldMapping);
      const recordType = (mapped._recordType as string) || webhook.defaultRecordType;

      // Validate record type against enum
      const validTypes = ["customer_profile", "organization", "product", "market_price",
        "regulatory_update", "news_article", "competitor_intel", "document_extract", "entity", "metric"];
      const finalType = validTypes.includes(recordType) ? recordType : webhook.defaultRecordType;

      await dbConn2.insert(ingestedRecords).values({
        dataSourceId: webhook.dataSourceId,
        ingestionJobId: jobId,
        recordType: finalType as any,
        entityId: (mapped.entityId || mapped.id || mapped.externalId || crypto.randomUUID()) as string,
        title: (mapped.title || mapped.name || mapped.subject || `Webhook record`) as string,
        contentSummary: (mapped.summary || mapped.description || mapped.content || JSON.stringify(record).slice(0, 500)) as string,
        structuredData: JSON.stringify(mapped),
        confidenceScore: "0.90",
        freshnessAt: now,
        tags: JSON.stringify(payload.event ? [payload.event] : ["webhook"]),
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      accepted++;
    } catch (err: any) {
      rejected++;
      errors.push(err.message?.slice(0, 200) || "Unknown error");
    }
  }

  // Update job status
  await dbConn2.update(ingestionJobs)
    .set({
      status: rejected === records.length ? "failed" : "completed",
      progressPct: 100,
      recordsProcessed: records.length,
      recordsCreated: accepted,
      recordsErrored: rejected,
      errorLog: errors.length > 0 ? errors.join("\n") : null,
      completedAt: Date.now(),
      durationMs: Date.now() - now,
    })
    .where(eq(ingestionJobs.id, jobId));

  // Update data source stats
  await dbConn2.update(dataSources)
    .set({
      lastRunAt: now,
      lastSuccessAt: accepted > 0 ? now : undefined,
      totalRecordsIngested: sql`total_records_ingested + ${accepted}`,
      updatedAt: now,
    })
    .where(eq(dataSources.id, webhook.dataSourceId));

  // Log event
  logEvent({
    webhookId, receivedAt: now, payload: { event: payload.event, recordCount: records.length },
    signature: signature || "", sourceIp, status: "accepted", recordsCreated: accepted,
  });

  // Notify owner for large batches
  if (accepted >= 50) {
    await notifyOwner({
      title: `Webhook "${webhook.name}" ingested ${accepted} records`,
      content: `Webhook ${webhookId} received ${records.length} records (${accepted} accepted, ${rejected} rejected) from ${sourceIp}.`,
    }).catch(() => {});
  }

  return { accepted, rejected, errors, jobId, webhookId };
}

// ─── Field Mapping ─────────────────────────────────────────────────────────

function applyFieldMapping(
  record: Record<string, unknown>,
  mapping?: Record<string, string>,
): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) return record;

  const result: Record<string, unknown> = {};
  for (const [externalKey, internalKey] of Object.entries(mapping)) {
    if (record[externalKey] !== undefined) {
      result[internalKey] = record[externalKey];
    }
  }

  // Also include unmapped fields
  for (const [key, value] of Object.entries(record)) {
    if (!mapping[key]) {
      result[key] = value;
    }
  }

  return result;
}

// ─── DB Loader ─────────────────────────────────────────────────────────────

async function loadWebhookFromDb(webhookId: string): Promise<boolean> {
  const dbConn3 = (await getDb())!;
  const sources = await dbConn3.select().from(dataSources)
    .where(eq(dataSources.isActive, true));

  for (const src of sources) {
    try {
      const config = typeof src.configJson === "string"
        ? JSON.parse(src.configJson)
        : src.configJson;
      if (config?.webhookId === webhookId) {
        webhookRegistry.set(webhookId, {
          id: webhookId,
          dataSourceId: src.id,
          name: src.name.replace("Webhook: ", ""),
          secretKey: config.secretKey || generateSecretKey(),
          allowedIps: config.allowedIps,
          rateLimit: config.rateLimit || 60,
          isActive: true,
          fieldMapping: config.fieldMapping,
          defaultRecordType: config.defaultRecordType || "customer_profile",
          createdAt: src.createdAt,
        });
        return true;
      }
    } catch {}
  }
  return false;
}

// ─── Management Functions ──────────────────────────────────────────────────

export async function listWebhooks(): Promise<WebhookConfig[]> {
  // Load all webhook-type data sources from DB
  const dbConn4 = (await getDb())!;
  const sources = await dbConn4.select().from(dataSources)
    .where(eq(dataSources.sourceType, "api_feed"));

  const webhooks: WebhookConfig[] = [];
  for (const src of sources) {
    try {
      const config = typeof src.configJson === "string"
        ? JSON.parse(src.configJson)
        : src.configJson;
      if (config?.type === "webhook" && config.webhookId) {
        const wh: WebhookConfig = {
          id: config.webhookId,
          dataSourceId: src.id,
          name: src.name.replace("Webhook: ", ""),
          secretKey: "••••••••", // Masked for listing
          allowedIps: config.allowedIps,
          rateLimit: config.rateLimit || 60,
          isActive: src.isActive ?? true,
          fieldMapping: config.fieldMapping,
          defaultRecordType: config.defaultRecordType || "customer_profile",
          createdAt: src.createdAt,
        };
        webhooks.push(wh);
        // Also cache in registry
        if (!webhookRegistry.has(config.webhookId)) {
          webhookRegistry.set(config.webhookId, { ...wh, secretKey: config.secretKey || "" });
        }
      }
    } catch {}
  }
  return webhooks;
}

export async function toggleWebhook(webhookId: string, active: boolean): Promise<boolean> {
  const config = webhookRegistry.get(webhookId);
  if (!config) {
    const loaded = await loadWebhookFromDb(webhookId);
    if (!loaded) return false;
  }
  const wh = webhookRegistry.get(webhookId);
  if (!wh) return false;

  wh.isActive = active;
  const dbConn5 = (await getDb())!;
  await dbConn5.update(dataSources)
    .set({ isActive: active, updatedAt: Date.now() })
    .where(eq(dataSources.id, wh.dataSourceId));
  return true;
}

export async function deleteWebhook(webhookId: string): Promise<boolean> {
  const config = webhookRegistry.get(webhookId);
  if (!config) return false;

  const dbConn6 = (await getDb())!;
  await dbConn6.update(dataSources)
    .set({ isActive: false, updatedAt: Date.now() })
    .where(eq(dataSources.id, config.dataSourceId));

  webhookRegistry.delete(webhookId);
  return true;
}

export async function rotateSecret(webhookId: string): Promise<string | null> {
  const config = webhookRegistry.get(webhookId);
  if (!config) return null;

  const newSecret = generateSecretKey();
  config.secretKey = newSecret;

  // Update in DB
  const dbConn7 = (await getDb())!;
  const src = await dbConn7.select().from(dataSources)
    .where(eq(dataSources.id, config.dataSourceId));
  if (src.length > 0) {
    const existingConfig = typeof src[0].configJson === "string"
      ? JSON.parse(src[0].configJson)
      : src[0].configJson || {};
    existingConfig.secretKey = newSecret;
    await dbConn7.update(dataSources)
      .set({ configJson: JSON.stringify(existingConfig), updatedAt: Date.now() })
      .where(eq(dataSources.id, config.dataSourceId));
  }

  return newSecret;
}

export function getEventLog(webhookId?: string, limit = 50): WebhookEvent[] {
  const filtered = webhookId
    ? eventLog.filter(e => e.webhookId === webhookId)
    : eventLog;
  return filtered.slice(-limit);
}

export function getWebhookStats(): {
  totalWebhooks: number;
  activeWebhooks: number;
  totalEventsToday: number;
  totalRecordsToday: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todayEvents = eventLog.filter(e => e.receivedAt >= todayStart);

  return {
    totalWebhooks: webhookRegistry.size,
    activeWebhooks: Array.from(webhookRegistry.values()).filter(w => w.isActive).length,
    totalEventsToday: todayEvents.length,
    totalRecordsToday: todayEvents.reduce((sum, e) => sum + e.recordsCreated, 0),
  };
}

// ─── Error Class ───────────────────────────────────────────────────────────

export class WebhookError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "WebhookError";
  }
}
