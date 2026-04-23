/**
 * MFA Service — TOTP + Backup Codes
 * Split from mfaService.ts for single-responsibility
 */
import { requireDb } from "../../db";
import { mfaSecrets, mfaBackupCodes } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function generateTOTPSecret(): string {
  return crypto.randomBytes(20).toString("hex").slice(0, 32).toUpperCase();
}

function generateTOTP(secret: string, timeStep = 30): string {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", Buffer.from(secret, "base64")).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, "0");
}

export async function enrollMFA(userId: number): Promise<{ secret: string; qrUri: string; backupCodes: string[] }> {
  const db = await requireDb();
  const secret = generateTOTPSecret();

  await db.insert(mfaSecrets).values({
    userId,
    secret,
    method: "totp",
    verified: false,
    enabled: false,
  });

  const backupCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    backupCodes.push(code);
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    await db.insert(mfaBackupCodes).values({ userId, codeHash: hash });
  }

  const qrUri = `otpauth://totp/Stewardly:user${userId}?secret=${secret}&issuer=Stewardly&algorithm=SHA1&digits=6&period=30`;
  return { secret, qrUri, backupCodes };
}

export async function verifyMFA(userId: number, code: string): Promise<boolean> {
  const db = await requireDb();
  const [mfa] = await db.select().from(mfaSecrets).where(and(eq(mfaSecrets.userId, userId), eq(mfaSecrets.method, "totp")));
  if (!mfa) return false;

  const expected = generateTOTP(mfa.secret);
  if (code === expected) {
    if (!mfa.verified) {
      await db.update(mfaSecrets).set({ verified: true, enabled: true }).where(eq(mfaSecrets.id, mfa.id));
    }
    await db.update(mfaSecrets).set({ lastUsedAt: new Date() }).where(eq(mfaSecrets.id, mfa.id));
    return true;
  }

  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const [backup] = await db.select().from(mfaBackupCodes).where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.codeHash, hash), eq(mfaBackupCodes.used, false)));
  if (backup) {
    await db.update(mfaBackupCodes).set({ used: true, usedAt: new Date() }).where(eq(mfaBackupCodes.id, backup.id));
    return true;
  }

  return false;
}

export async function getMFAStatus(userId: number): Promise<{ enrolled: boolean; verified: boolean; enabled: boolean; method: string; backupCodesRemaining: number }> {
  const db = await requireDb();
  const [mfa] = await db.select().from(mfaSecrets).where(eq(mfaSecrets.userId, userId));
  if (!mfa) return { enrolled: false, verified: false, enabled: false, method: "none", backupCodesRemaining: 0 };

  const unusedCodes = await db.select().from(mfaBackupCodes).where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.used, false)));
  return {
    enrolled: true,
    verified: mfa.verified,
    enabled: mfa.enabled,
    method: mfa.method,
    backupCodesRemaining: unusedCodes.length,
  };
}

export async function disableMFA(userId: number) {
  const db = await requireDb();
  await db.update(mfaSecrets).set({ enabled: false }).where(eq(mfaSecrets.userId, userId));
}
