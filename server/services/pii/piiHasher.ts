/**
 * PII Hashing — SHA-256 for dedup queries without storing PII in plaintext
 */
import { createHash } from "crypto";

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export function hashPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return createHash("sha256").update(digitsOnly).digest("hex");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}
