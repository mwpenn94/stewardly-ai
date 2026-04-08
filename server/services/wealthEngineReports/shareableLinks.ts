/**
 * Shareable plan links — Phase 5C.
 *
 * Generates a time-limited, optionally-password-gated URL that lets a
 * client view a snapshot of their plan in the public portal without
 * requiring a Stewardly account. Uses the existing
 * `analyticalModels` / `modelOutputRecords` infrastructure for storage
 * and a small token table-free design: the share token is a JWT-style
 * compact payload signed with HMAC so we can verify it without a DB
 * lookup, then resolve the actual plan data from the persisted
 * modelOutputRecord.
 *
 * Pure functions are exported separately so unit tests can exercise
 * the encode/decode/expiry/password logic without any side effects.
 */

import crypto from "crypto";

// ─── Token shape ───────────────────────────────────────────────────────────

export interface ShareToken {
  /** modelOutputRecord id this share resolves to */
  recordId: string;
  /** Optional client identifier for audit trail */
  clientId?: string;
  /** Unix epoch (seconds) — token is invalid past this */
  expiresAt: number;
  /** SHA-256 hash of the password (hex), or null if no password */
  passwordHash: string | null;
}

// ─── Encode / decode ──────────────────────────────────────────────────────

const SHARE_SECRET =
  process.env.SHARE_LINK_SECRET ?? "stewardly-share-link-default-rotate-me";

/**
 * Encode a share token into a compact base64url-safe string with an
 * HMAC signature appended. Output shape: `<base64payload>.<sig>`.
 */
export function encodeShareToken(token: ShareToken): string {
  const json = JSON.stringify(token);
  const payload = Buffer.from(json).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SHARE_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Decode + verify a share token. Returns null on tamper, expiry, or
 * malformed input. Pure function — does not check the password (that's
 * a separate step in `verifyPassword`).
 */
export function decodeShareToken(encoded: string): ShareToken | null {
  if (!encoded || typeof encoded !== "string") return null;
  const parts = encoded.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SHARE_SECRET)
    .update(payload)
    .digest("base64url");
  // Constant-time compare
  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  let decoded: ShareToken;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof decoded.recordId !== "string") return null;
  if (typeof decoded.expiresAt !== "number") return null;
  return decoded;
}

/**
 * Hash a password for storage in the token. Uses SHA-256 hex — this
 * is NOT a password store (one-time link); it's a soft gate against
 * casual link sharing. For real auth use bcrypt elsewhere.
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(
  token: ShareToken,
  candidate: string | undefined,
): boolean {
  if (token.passwordHash === null) return true;
  if (!candidate) return false;
  const candidateHash = hashPassword(candidate);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash),
      Buffer.from(token.passwordHash),
    );
  } catch {
    return false;
  }
}

export function isExpired(token: ShareToken, now = Date.now()): boolean {
  return token.expiresAt * 1000 < now;
}

// ─── Convenience builder ──────────────────────────────────────────────────

export interface CreateShareLinkInput {
  recordId: string;
  clientId?: string;
  /** Hours until expiry (default 168 = 7 days) */
  expiresInHours?: number;
  password?: string;
}

export function createShareLink(input: CreateShareLinkInput): {
  token: string;
  expiresAt: Date;
} {
  const expiresInSec = (input.expiresInHours ?? 168) * 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSec;
  const token = encodeShareToken({
    recordId: input.recordId,
    clientId: input.clientId,
    expiresAt,
    passwordHash: input.password ? hashPassword(input.password) : null,
  });
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

// ─── Resolve a token to a public-safe view ───────────────────────────────
// Strips internal-only fields before returning the plan data so a
// shared link cannot leak sensitive metadata (advisor id, etc.).

export interface PublicPlanView {
  recordId: string;
  finalSnapshot: Record<string, unknown> | null;
  expiresAt: Date;
}

export async function resolveShareLink(
  encoded: string,
  password: string | undefined,
): Promise<
  | { ok: true; view: PublicPlanView }
  | { ok: false; reason: "invalid" | "expired" | "password" | "missing" }
> {
  const token = decodeShareToken(encoded);
  if (!token) return { ok: false, reason: "invalid" };
  if (isExpired(token)) return { ok: false, reason: "expired" };
  if (!verifyPassword(token, password)) return { ok: false, reason: "password" };

  // Lazy DB import so the file remains testable without DB.
  const { getDb } = await import("../../db");
  const db = await getDb();
  if (!db) return { ok: false, reason: "missing" };

  const { modelOutputRecords } = await import("../../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(modelOutputRecords)
    .where(eq(modelOutputRecords.id, token.recordId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, reason: "missing" };

  return {
    ok: true,
    view: {
      recordId: row.id,
      finalSnapshot:
        (row.outputValue as Record<string, unknown> | null) ?? null,
      expiresAt: new Date(token.expiresAt * 1000),
    },
  };
}
