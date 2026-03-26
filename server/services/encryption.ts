import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get the primary encryption key (INTEGRATION_ENCRYPTION_KEY or JWT_SECRET fallback).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
      throw new Error(
        "CRITICAL: INTEGRATION_ENCRYPTION_KEY or JWT_SECRET must be set in production. " +
        "Cannot use hardcoded fallback key."
      );
    }
    const fallback = process.env.JWT_SECRET || "stewardly-dev-key-do-not-use-in-prod";
    return crypto.scryptSync(fallback, "stewardly-integration-salt", 32);
  }
  // If key is hex-encoded (64 chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  // Otherwise derive from the provided string
  return crypto.scryptSync(key, "stewardly-integration-salt", 32);
}

/**
 * Get the legacy fallback key (JWT_SECRET derived) for migration.
 * Returns null if INTEGRATION_ENCRYPTION_KEY is not set (meaning JWT_SECRET IS the primary key).
 */
function getLegacyKey(): Buffer | null {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) return null; // JWT_SECRET is already the primary key
  const fallback = process.env.JWT_SECRET || "stewardly-dev-key-do-not-use-in-prod";
  return crypto.scryptSync(fallback, "stewardly-integration-salt", 32);
}

/**
 * Decrypt with a specific key.
 */
function decryptWithKey(ciphertext: string, key: Buffer): string {
  const combined = Buffer.from(ciphertext, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Always uses the primary key (INTEGRATION_ENCRYPTION_KEY or JWT_SECRET fallback).
 * Output format: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: IV (16) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt ciphertext encrypted with encrypt().
 * Tries the primary key first, then falls back to the legacy JWT_SECRET-derived key.
 * This handles migration from JWT_SECRET to INTEGRATION_ENCRYPTION_KEY seamlessly.
 * Input format: base64(iv + authTag + ciphertext)
 */
export function decrypt(ciphertext: string): string {
  const primaryKey = getEncryptionKey();
  try {
    return decryptWithKey(ciphertext, primaryKey);
  } catch {
    // Try legacy key (JWT_SECRET derived) for credentials encrypted before INTEGRATION_ENCRYPTION_KEY was set
    const legacyKey = getLegacyKey();
    if (legacyKey) {
      try {
        return decryptWithKey(ciphertext, legacyKey);
      } catch {
        throw new Error("Decryption failed with both primary and legacy keys");
      }
    }
    throw new Error("Decryption failed");
  }
}

/**
 * Encrypt a credentials object (JSON-serializable).
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt a credentials blob back to an object.
 * Never expose the result in API responses.
 * Supports migration: tries primary key, then legacy JWT_SECRET key.
 */
export function decryptCredentials(encrypted: string): Record<string, unknown> {
  const decrypted = decrypt(encrypted);
  try {
    const parsed = JSON.parse(decrypted);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Decrypted credentials must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("Failed to parse decrypted credentials: malformed JSON");
    }
    throw e;
  }
}

/**
 * Re-encrypt credentials with the current primary key.
 * Use this to migrate credentials from legacy encryption to the new key.
 */
export function reEncryptCredentials(encrypted: string): string {
  const creds = decryptCredentials(encrypted);
  return encryptCredentials(creds);
}
