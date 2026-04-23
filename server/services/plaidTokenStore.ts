/**
 * PlaidTokenStore — Encrypted Plaid Access Token Storage
 *
 * Security-critical service: Plaid access tokens are stored encrypted
 * using AES-256-GCM and are NEVER exposed to the frontend.
 * All token resolution enforces user-level ownership checks.
 */
import { TRPCError } from "@trpc/server";
import { encrypt, decrypt } from "./encryption";
import { getRawPool } from "../db";

// ─── Store Encrypted Token ──────────────────────────────────────────────────

export async function storeEncryptedToken(params: {
  userId: number;
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
}): Promise<void> {
  const pool = await getRawPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const now = Date.now();
  const encryptedToken = encrypt(params.accessToken);

  await pool.query(
    `INSERT INTO plaid_items (user_id, item_id, access_token_encrypted, institution_id, institution_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
     ON DUPLICATE KEY UPDATE
       access_token_encrypted = VALUES(access_token_encrypted),
       institution_name = VALUES(institution_name),
       status = 'active',
       error_code = NULL,
       error_message = NULL,
       updated_at = VALUES(updated_at)`,
    [params.userId, params.itemId, encryptedToken, params.institutionId, params.institutionName, now, now]
  );
}

// ─── Resolve Access Token (Server-Side Only) ────────────────────────────────

/**
 * Resolve a Plaid access token from an item ID.
 * Enforces user ownership — a user can only access their own tokens.
 * Throws FORBIDDEN if the item doesn't belong to the user.
 * Throws NOT_FOUND if the item doesn't exist or is deactivated.
 */
export async function resolveAccessToken(userId: number, itemId: string): Promise<string> {
  const pool = await getRawPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [rows] = await pool.query(
    `SELECT access_token_encrypted, user_id, status FROM plaid_items WHERE item_id = ? LIMIT 1`,
    [itemId]
  ) as any;

  if (!rows || rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Plaid item not found",
    });
  }

  const row = rows[0];

  // Enforce user ownership — critical security check
  if (row.user_id !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this Plaid item",
    });
  }

  if (row.status !== "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Plaid item is ${row.status}`,
    });
  }

  try {
    return decrypt(row.access_token_encrypted);
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to decrypt Plaid access token",
    });
  }
}

// ─── List User's Plaid Items ────────────────────────────────────────────────

export async function getUserPlaidItems(userId: number): Promise<Array<{
  id: number;
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  status: string;
  lastSyncedAt: number | null;
  errorCode: string | null;
  createdAt: number;
}>> {
  const pool = await getRawPool();
  if (!pool) return [];
  const [rows] = await pool.query(
    `SELECT id, item_id, institution_id, institution_name, status, last_synced_at, error_code, created_at
     FROM plaid_items WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  ) as any;

  return (rows || []).map((r: any) => ({
    id: r.id,
    itemId: r.item_id,
    institutionId: r.institution_id,
    institutionName: r.institution_name,
    status: r.status,
    lastSyncedAt: r.last_synced_at ? Number(r.last_synced_at) : null,
    errorCode: r.error_code,
    createdAt: Number(r.created_at),
  }));
}

// ─── Deactivate a Plaid Item ────────────────────────────────────────────────

export async function deactivatePlaidItem(userId: number, itemId: string): Promise<void> {
  const pool = await getRawPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [result] = await pool.query(
    `UPDATE plaid_items SET status = 'deactivated', updated_at = ? WHERE item_id = ? AND user_id = ?`,
    [Date.now(), itemId, userId]
  ) as any;

  if (result.affectedRows === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Plaid item not found or not owned by user",
    });
  }
}

// ─── Update Sync Status ─────────────────────────────────────────────────────

export async function updatePlaidItemSyncStatus(itemId: string, params: {
  lastSyncedAt?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  status?: string;
}): Promise<void> {
  const updates: string[] = ["updated_at = ?"];
  const values: any[] = [Date.now()];

  if (params.lastSyncedAt !== undefined) {
    updates.push("last_synced_at = ?");
    values.push(params.lastSyncedAt);
  }
  if (params.errorCode !== undefined) {
    updates.push("error_code = ?");
    values.push(params.errorCode);
  }
  if (params.errorMessage !== undefined) {
    updates.push("error_message = ?");
    values.push(params.errorMessage);
  }
  if (params.status !== undefined) {
    updates.push("status = ?");
    values.push(params.status);
  }

  values.push(itemId);
  const pool = await getRawPool();
  if (!pool) return;
  await pool.query(
    `UPDATE plaid_items SET ${updates.join(", ")} WHERE item_id = ?`,
    values
  );
}
