/**
 * GoHighLevel (GHL) client — v1 Bearer + v2 OAuth2 with token refresh
 * and HMAC webhook verification.
 *
 * Implements Phase 3A of the WealthBridge GHL Integration Spec v5:
 *  - Section 2: dual-version auth (v1 API key static, v2 OAuth2 rotating)
 *  - Section 2.2: token refresh using refresh_token grant
 *  - Section 2.3: required headers (Authorization, Version, X-Stewardly-Source,
 *    X-Idempotency-Key)
 *  - Section 2.4-2.6: contact upsert / update / create
 *  - Inbound: HMAC SHA-256 signature verification with 5-min timestamp skew
 *
 * Credential storage: per-owner rows in the existing
 * `integration_connections` table, with `credentials_encrypted` holding
 * either `{ apiVersion: "v1", apiKey }` or
 * `{ apiVersion: "v2", accessToken, refreshToken, tokenExpiresAt, clientId, clientSecret }`.
 * Encryption is handled by whichever helper Stewardly already uses for
 * that column (we delegate via the Integration services layer below).
 */

import crypto from "crypto";
import { getDb } from "../../db";
import { integrationConnections } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../_core/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GHLApiVersion = "v1" | "v2";

export interface GHLConfigV1 {
  apiVersion: "v1";
  apiKey: string;
  locationId: string;
}

export interface GHLConfigV2 {
  apiVersion: "v2";
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string; // ISO timestamp
  clientId: string;
  clientSecret: string;
  locationId: string;
}

export type GHLConfig = GHLConfigV1 | GHLConfigV2;

export interface GHLContactPayload {
  locationId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // E.164
  tags?: string[];
  customField?: Record<string, string | number | null | undefined>;
}

export interface UpsertResult {
  contactId: string;
  status: "created" | "updated";
  raw?: unknown;
}

// ─── HMAC webhook verification ─────────────────────────────────────────────
// Used for inbound webhooks from GHL. Replay protection: timestamp must
// be within 5 minutes of now.

export function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
  timestamp?: string,
): { valid: boolean; reason?: string } {
  if (!signature) return { valid: false, reason: "missing_signature" };
  if (timestamp) {
    const tsMs = Number(timestamp) * 1000;
    if (!Number.isFinite(tsMs)) return { valid: false, reason: "bad_timestamp" };
    const skew = Math.abs(Date.now() - tsMs);
    if (skew > 5 * 60 * 1000) return { valid: false, reason: "timestamp_skew" };
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  try {
    const a = Buffer.from(signature.replace(/^sha256=/, ""));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return { valid: false, reason: "length_mismatch" };
    return {
      valid: crypto.timingSafeEqual(a, b),
      reason: undefined,
    };
  } catch {
    return { valid: false, reason: "comparison_error" };
  }
}

// ─── Token refresh (v2) ────────────────────────────────────────────────────
// Per spec Section 2.2. Returns the updated config so the caller can
// persist it back to integration_connections.

const GHL_V2_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

export async function refreshAccessToken(
  cfg: GHLConfigV2,
): Promise<GHLConfigV2> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const resp = await fetch(GHL_V2_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GHL token refresh failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const next: GHLConfigV2 = {
    ...cfg,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || cfg.refreshToken,
    tokenExpiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
  return next;
}

// Guard: if the v2 access token is within 60 seconds of expiry, refresh it.
export async function ensureFreshToken(cfg: GHLConfig): Promise<GHLConfig> {
  if (cfg.apiVersion !== "v2") return cfg;
  const expiresMs = Date.parse(cfg.tokenExpiresAt);
  if (!Number.isFinite(expiresMs)) return cfg;
  if (expiresMs - Date.now() > 60_000) return cfg;
  logger.info({ locationId: cfg.locationId }, "GHL v2 token near expiry — refreshing");
  return refreshAccessToken(cfg);
}

// ─── Contact upsert (per spec Section 2.4-2.6) ─────────────────────────────

const GHL_V2_CONTACTS_URL =
  "https://services.leadconnectorhq.com/contacts/upsert";
const GHL_V1_CONTACTS_URL = "https://rest.gohighlevel.com/v1/contacts/";

/**
 * Per spec required headers (Section 2.3):
 *  - Content-Type: application/json
 *  - Authorization: Bearer <token>
 *  - Version: 2021-07-28 (v2 only)
 *  - X-Stewardly-Source: wealthbridge-calculator-v1
 *  - X-Idempotency-Key: <runId>-<timestamp>
 */
export function buildHeaders(
  cfg: GHLConfig,
  idempotencyKey: string,
): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Stewardly-Source": "wealthbridge-calculator-v1",
    "X-Idempotency-Key": idempotencyKey,
  };
  if (cfg.apiVersion === "v2") {
    base["Authorization"] = `Bearer ${cfg.accessToken}`;
    base["Version"] = "2021-07-28";
  } else {
    base["Authorization"] = `Bearer ${cfg.apiKey}`;
  }
  return base;
}

export async function upsertContact(
  cfg: GHLConfig,
  payload: GHLContactPayload,
  idempotencyKey: string,
): Promise<UpsertResult> {
  const fresh = await ensureFreshToken(cfg);
  const headers = buildHeaders(fresh, idempotencyKey);
  const url = fresh.apiVersion === "v2" ? GHL_V2_CONTACTS_URL : GHL_V1_CONTACTS_URL;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GHL upsertContact failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as {
    contact?: { id: string };
    id?: string;
    new?: boolean;
  };
  const contactId = json.contact?.id || json.id || "";
  return {
    contactId,
    status: json.new === false ? "updated" : "created",
    raw: json,
  };
}

// ─── Credential loader from integration_connections ────────────────────────
// NOTE: in production the `credentials_encrypted` column would be
// decrypted by the central integrations helper; for Phase 3A we parse
// it as JSON directly and the credential-decrypt plumbing will be added
// when the integrations layer is exercised in Phase 7. This keeps
// Phase 3A a pure standalone client.

export async function loadGHLConfig(
  connectionId: string,
): Promise<GHLConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.credentialsEncrypted) return null;
  try {
    const parsed = JSON.parse(row.credentialsEncrypted) as GHLConfig;
    return parsed;
  } catch (err) {
    logger.error({ connectionId, err }, "failed to parse GHL credentials");
    return null;
  }
}

export async function saveGHLConfig(
  connectionId: string,
  cfg: GHLConfig,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(integrationConnections)
    .set({
      credentialsEncrypted: JSON.stringify(cfg),
      updatedAt: new Date(),
    })
    .where(eq(integrationConnections.id, connectionId));
}

// ─── Misc helpers used by automation triggers (Phase 3D) ───────────────────

const GHL_V2_WORKFLOWS_URL =
  "https://services.leadconnectorhq.com/contacts/"; // + {contactId}/workflow/{workflowId}
const GHL_V2_TASKS_URL = "https://services.leadconnectorhq.com/contacts/"; // + {contactId}/tasks/

export async function addContactToWorkflow(
  cfg: GHLConfig,
  contactId: string,
  workflowId: string,
): Promise<void> {
  const fresh = await ensureFreshToken(cfg);
  const headers = buildHeaders(
    fresh,
    `workflow-${contactId}-${workflowId}-${Date.now()}`,
  );
  const url = `${GHL_V2_WORKFLOWS_URL}${contactId}/workflow/${workflowId}`;
  const resp = await fetch(url, { method: "POST", headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GHL addContactToWorkflow failed: ${resp.status} ${text}`);
  }
}

export interface GHLTaskInput {
  title: string;
  description?: string;
  dueDate: string; // ISO
  assignedTo?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export async function createTask(
  cfg: GHLConfig,
  contactId: string,
  task: GHLTaskInput,
): Promise<{ id: string }> {
  const fresh = await ensureFreshToken(cfg);
  const headers = buildHeaders(
    fresh,
    `task-${contactId}-${Date.now()}`,
  );
  const url = `${GHL_V2_TASKS_URL}${contactId}/tasks/`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(task),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GHL createTask failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as { id: string };
  return json;
}

// ─── Test helper: validate a payload shape before sending (pure) ───────────
// Used by automation-triggers unit tests to avoid network calls.
export function validateContactPayload(p: GHLContactPayload): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!p.locationId) errors.push("locationId required");
  if (!p.email && !p.phone) errors.push("email or phone required");
  if (p.email && !/.+@.+\..+/.test(p.email)) errors.push("invalid email");
  if (p.phone && !p.phone.startsWith("+")) errors.push("phone must be E.164 (+country)");
  return { ok: errors.length === 0, errors };
}
