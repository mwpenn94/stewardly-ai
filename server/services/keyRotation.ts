/**
 * Task #38 — Key Rotation + Secrets Management Service
 * Automated key rotation with grace periods, audit logging, and health checks
 */
import { getDb } from "../db";
import { eq, and, desc, lt } from "drizzle-orm";
import crypto from "crypto";

interface KeyRecord {
  id: string;
  service: string;
  keyHash: string;
  status: "active" | "grace" | "revoked";
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
  gracePeriodEnds?: Date;
}

// In-memory key store (in production, this would be in a secrets manager)
const keyStore = new Map<string, KeyRecord>();
const rotationLog: Array<{ service: string; action: string; timestamp: Date; details: string }> = [];

export function generateKey(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function registerKey(service: string, key: string, expiresInDays = 90): KeyRecord {
  const record: KeyRecord = {
    id: crypto.randomUUID(),
    service,
    keyHash: hashKey(key),
    status: "active",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
  };
  keyStore.set(record.id, record);
  rotationLog.push({ service, action: "register", timestamp: new Date(), details: `Key registered, expires in ${expiresInDays} days` });
  return record;
}

export function rotateKey(service: string, gracePeriodHours = 24): { newKey: string; record: KeyRecord } {
  // Find current active key
  const current = Array.from(keyStore.values()).find(k => k.service === service && k.status === "active");
  if (current) {
    current.status = "grace";
    current.rotatedAt = new Date();
    current.gracePeriodEnds = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);
  }

  // Generate new key
  const newKey = generateKey();
  const record = registerKey(service, newKey);
  rotationLog.push({ service, action: "rotate", timestamp: new Date(), details: `New key generated, old key in grace period for ${gracePeriodHours}h` });
  return { newKey, record };
}

export function revokeExpiredKeys(): number {
  let revoked = 0;
  const now = new Date();
  for (const [id, record] of Array.from(keyStore.entries())) {
    if (record.status === "grace" && record.gracePeriodEnds && record.gracePeriodEnds < now) {
      record.status = "revoked";
      revoked++;
      rotationLog.push({ service: record.service, action: "revoke", timestamp: now, details: "Grace period expired" });
    }
    if (record.status === "active" && record.expiresAt < now) {
      record.status = "revoked";
      revoked++;
      rotationLog.push({ service: record.service, action: "auto_revoke", timestamp: now, details: "Key expired" });
    }
  }
  return revoked;
}

export function getKeyHealth(): Array<{ service: string; status: string; expiresAt: Date; daysUntilExpiry: number; needsRotation: boolean }> {
  const now = Date.now();
  const allKeys = Array.from(keyStore.values());
  return allKeys
    .filter(k => k.status === "active")
    .map(k => ({
      service: k.service,
      status: k.status,
      expiresAt: k.expiresAt,
      daysUntilExpiry: Math.ceil((k.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)),
      needsRotation: (k.expiresAt.getTime() - now) < 14 * 24 * 60 * 60 * 1000, // 14 days warning
    }));
}

export function getRotationLog(service?: string, limit = 50) {
  const filtered = service ? rotationLog.filter(l => l.service === service) : rotationLog;
  return filtered.slice(-limit);
}

export function validateKey(service: string, key: string): boolean {
  const hash = hashKey(key);
  const allKeys2 = Array.from(keyStore.values());
  return allKeys2.some(
    k => k.service === service && k.keyHash === hash && (k.status === "active" || k.status === "grace")
  );
}
