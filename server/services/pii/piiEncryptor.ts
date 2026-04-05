/**
 * PII Encryption — AES-256-GCM for database field encryption
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATION_ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decrypt(ciphertext: Buffer): string {
  const iv = ciphertext.subarray(0, IV_LENGTH);
  const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
