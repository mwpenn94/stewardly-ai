/**
 * MFA Service (3A) + Security Hardening (3B) + Row Security (3C) + Privacy Enhancement (3D)
 */
import { requireDb } from "../db";
import { mfaSecrets, mfaBackupCodes, consentTracking } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════
// 3A: MFA — TOTP + Backup Codes
// ═══════════════════════════════════════════════════════════════════════════
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

  // Store secret
  await db.insert(mfaSecrets).values({
    userId,
    secret,
    method: "totp",
    verified: false,
    enabled: false,
  });

  // Generate backup codes
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

  // Check TOTP
  const expected = generateTOTP(mfa.secret);
  if (code === expected) {
    if (!mfa.verified) {
      await db.update(mfaSecrets).set({ verified: true, enabled: true }).where(eq(mfaSecrets.id, mfa.id));
    }
    await db.update(mfaSecrets).set({ lastUsedAt: new Date() }).where(eq(mfaSecrets.id, mfa.id));
    return true;
  }

  // Check backup codes
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

// ═══════════════════════════════════════════════════════════════════════════
// 3B: Security Hardening — CSP, Rate Limiting, XSS Protection
// ═══════════════════════════════════════════════════════════════════════════
export function getCSPHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  entry.count++;
  const allowed = entry.count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - entry.count), resetAt: entry.resetAt };
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// ═══════════════════════════════════════════════════════════════════════════
// 3C: Row-Level Security
// ═══════════════════════════════════════════════════════════════════════════
export interface RowSecurityContext {
  userId: number;
  orgId?: number;
  role: "admin" | "user";
}

export function enforceRowSecurity(ctx: RowSecurityContext, row: { userId?: number; orgId?: number; organizationId?: number }): boolean {
  if (ctx.role === "admin") return true;
  if (row.userId && row.userId === ctx.userId) return true;
  if (row.orgId && ctx.orgId && row.orgId === ctx.orgId) return true;
  if (row.organizationId && ctx.orgId && row.organizationId === ctx.orgId) return true;
  return false;
}

export function buildTenantFilter(ctx: RowSecurityContext): { userId?: number; orgId?: number } {
  if (ctx.role === "admin") return {};
  return { userId: ctx.userId, ...(ctx.orgId ? { orgId: ctx.orgId } : {}) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D: Privacy Enhancement — Consent, DSAR, ROPA
// ═══════════════════════════════════════════════════════════════════════════
export async function recordConsent(params: {
  userId: number;
  consentType: "ai_chat" | "voice" | "doc_upload" | "data_sharing" | "marketing" | "analytics" | "third_party";
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await requireDb();
  const [existing] = await db.select().from(consentTracking).where(and(eq(consentTracking.userId, params.userId), eq(consentTracking.consentType, params.consentType)));

  if (existing) {
    await db.update(consentTracking).set({
      granted: params.granted,
      ...(params.granted ? { grantedAt: new Date() } : { revokedAt: new Date() }),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    }).where(eq(consentTracking.id, existing.id));
  } else {
    await db.insert(consentTracking).values({
      userId: params.userId,
      consentType: params.consentType,
      granted: params.granted,
      grantedAt: params.granted ? new Date() : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }
}

export async function getConsents(userId: number) {
  const db = await requireDb();
  return db.select().from(consentTracking).where(eq(consentTracking.userId, userId));
}

export async function generateDSAR(userId: number): Promise<{
  categories: string[];
  dataPoints: number;
  estimatedSize: string;
  status: string;
  data: Record<string, unknown>;
}> {
  // Data Subject Access Request — compile all user data for export
  const db = await requireDb();
  const { users, conversations, messages, documents, auditTrail, consentTracking } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const userConversations = await db.select().from(conversations).where(eq(conversations.userId, userId));
  const conversationIds = userConversations.map(c => c.id);

  let allMessages: unknown[] = [];
  for (const convId of conversationIds) {
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, convId));
    allMessages = allMessages.concat(msgs);
  }

  const userDocuments = await db.select({
    id: documents.id,
    filename: documents.filename,
    mimeType: documents.mimeType,
    category: documents.category,
    createdAt: documents.createdAt,
  }).from(documents).where(eq(documents.userId, userId));

  const userAuditLogs = await db.select().from(auditTrail).where(eq(auditTrail.userId, userId));
  const userConsent = await db.select().from(consentTracking).where(eq(consentTracking.userId, userId));

  const categories = ["Profile", "Conversations", "Messages", "Documents", "Audit Logs", "Consent Records"];
  const dataPoints =
    1 + userConversations.length + allMessages.length +
    userDocuments.length + userAuditLogs.length + userConsent.length;

  return {
    categories,
    dataPoints,
    estimatedSize: `~${Math.ceil(JSON.stringify({ user, userConversations, allMessages, userDocuments, userAuditLogs, userConsent }).length / 1024)} KB`,
    status: "complete",
    data: {
      profile: user ? { id: user.id, name: user.name, email: user.email, role: user.role, authTier: user.authTier, createdAt: user.createdAt } : null,
      conversations: userConversations,
      messages: allMessages,
      documents: userDocuments,
      auditLogs: userAuditLogs,
      consentRecords: userConsent,
    },
  };
}

export async function generateROPA(): Promise<Array<{ activity: string; purpose: string; legalBasis: string; dataCategories: string[]; retention: string; recipients: string[] }>> {
  return [
    { activity: "User Authentication", purpose: "Account access and security", legalBasis: "Contract", dataCategories: ["Email", "Name", "Login timestamps"], retention: "Account lifetime + 90 days", recipients: ["OAuth Provider"] },
    { activity: "AI Chat", purpose: "Financial advisory assistance", legalBasis: "Consent", dataCategories: ["Chat messages", "Financial queries", "AI responses"], retention: "User-configurable (default 2 years)", recipients: ["LLM Provider (anonymized)"] },
    { activity: "Financial Analysis", purpose: "Portfolio and planning analysis", legalBasis: "Consent", dataCategories: ["Financial data", "Model inputs", "Results"], retention: "User-configurable (default 5 years)", recipients: ["None (processed locally)"] },
    { activity: "Document Processing", purpose: "Financial document analysis", legalBasis: "Consent", dataCategories: ["Uploaded documents", "Extracted data"], retention: "90 days after processing", recipients: ["S3 Storage"] },
    { activity: "Compliance Monitoring", purpose: "Regulatory compliance", legalBasis: "Legal obligation", dataCategories: ["Audit logs", "Compliance scores", "Reviews"], retention: "7 years (regulatory requirement)", recipients: ["Compliance team"] },
    { activity: "Analytics", purpose: "Platform improvement", legalBasis: "Legitimate interest", dataCategories: ["Usage patterns", "Feature engagement", "Performance metrics"], retention: "2 years (aggregated)", recipients: ["Analytics service"] },
  ];
}
