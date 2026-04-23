import { getDb } from "../../db";
import { users, authEnrichmentLog } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../../_core/logger";

const log = logger.child({ service: "emailAuth" });

// ─── Account Lockout Configuration ────────────────────────────────────
const LOCKOUT_CONFIG = {
  maxAttempts: 5,           // Lock after 5 failed attempts
  lockoutDurationMs: 15 * 60 * 1000,  // 15-minute lockout
  attemptWindowMs: 30 * 60 * 1000,    // 30-minute sliding window for attempts
  cleanupIntervalMs: 5 * 60 * 1000,   // Clean stale entries every 5 min
};

// In-memory store for magic link tokens (production should use DB/Redis)
const magicLinkTokens = new Map<string, { email: string; expiresAt: number; used: boolean }>();

// In-memory store for failed attempt tracking (production should use DB/Redis)
interface AttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}
const failedAttempts = new Map<string, AttemptRecord>();

// Rate limiting for magic link requests per email
interface RateLimitRecord {
  count: number;
  windowStart: number;
}
const magicLinkRateLimit = new Map<string, RateLimitRecord>();
const MAGIC_LINK_RATE_LIMIT = { maxPerWindow: 3, windowMs: 15 * 60 * 1000 }; // 3 per 15 min

// Periodic cleanup of stale lockout records
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttempts.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      failedAttempts.delete(key);
    } else if (now - record.firstAttemptAt > LOCKOUT_CONFIG.attemptWindowMs) {
      failedAttempts.delete(key);
    }
  }
  for (const [key, record] of magicLinkRateLimit.entries()) {
    if (now - record.windowStart > MAGIC_LINK_RATE_LIMIT.windowMs) {
      magicLinkRateLimit.delete(key);
    }
  }
  // Clean expired tokens
  for (const [token, data] of magicLinkTokens.entries()) {
    if (now > data.expiresAt || data.used) {
      magicLinkTokens.delete(token);
    }
  }
}, LOCKOUT_CONFIG.cleanupIntervalMs);

export interface EmailAuthResult {
  userId: number;
  isNewUser: boolean;
  fieldsCaptured: string[];
  profile: {
    email: string;
    employerInferred?: string;
    employerConfidence: number;
  };
}

export class EmailAuthService {
  /**
   * Check if an email is currently locked out
   */
  isLockedOut(email: string): { locked: boolean; remainingMs: number } {
    const normalizedEmail = email.toLowerCase().trim();
    const record = failedAttempts.get(normalizedEmail);
    if (!record || !record.lockedUntil) return { locked: false, remainingMs: 0 };

    const now = Date.now();
    if (now >= record.lockedUntil) {
      // Lockout expired — clear record
      failedAttempts.delete(normalizedEmail);
      return { locked: false, remainingMs: 0 };
    }

    return { locked: true, remainingMs: record.lockedUntil - now };
  }

  /**
   * Record a failed authentication attempt
   */
  recordFailedAttempt(email: string): { locked: boolean; attemptsRemaining: number } {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();
    let record = failedAttempts.get(normalizedEmail);

    if (!record || (now - record.firstAttemptAt > LOCKOUT_CONFIG.attemptWindowMs)) {
      // Start new window
      record = { attempts: 1, firstAttemptAt: now, lockedUntil: null };
    } else {
      record.attempts += 1;
    }

    if (record.attempts >= LOCKOUT_CONFIG.maxAttempts) {
      record.lockedUntil = now + LOCKOUT_CONFIG.lockoutDurationMs;
      failedAttempts.set(normalizedEmail, record);
      log.warn({ email: normalizedEmail, attempts: record.attempts }, "[EmailAuth] Account locked due to excessive failed attempts");
      return { locked: true, attemptsRemaining: 0 };
    }

    failedAttempts.set(normalizedEmail, record);
    return { locked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - record.attempts };
  }

  /**
   * Clear failed attempts on successful authentication
   */
  clearFailedAttempts(email: string): void {
    failedAttempts.delete(email.toLowerCase().trim());
  }

  /**
   * Extract potential employer from email domain
   * john@smithfinancial.com → "Smith Financial" (confidence: 0.30)
   * john@gmail.com → null (no inference)
   */
  extractDomainEmployer(email: string): { employer: string; confidence: number } | null {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;

    // Skip common free email providers
    const freeProviders = [
      "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
      "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
      "live.com", "msn.com", "me.com", "mac.com", "fastmail.com",
      "tutanota.com", "gmx.com", "inbox.com",
    ];

    if (freeProviders.includes(domain)) return null;

    // Extract company name from domain
    const parts = domain.split(".");
    const companyPart = parts[0];

    // Capitalize and clean up
    const employer = companyPart
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return { employer, confidence: 0.30 };
  }

  /**
   * Request a magic link for email sign-in
   * Rate-limited to 3 requests per 15 minutes per email
   */
  async requestMagicLink(email: string): Promise<{ token: string; sent: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check account lockout
    const lockout = this.isLockedOut(normalizedEmail);
    if (lockout.locked) {
      const minutesRemaining = Math.ceil(lockout.remainingMs / 60000);
      throw new Error(`Account temporarily locked. Try again in ${minutesRemaining} minutes.`);
    }

    // Rate limit magic link requests
    const now = Date.now();
    const rateRecord = magicLinkRateLimit.get(normalizedEmail);
    if (rateRecord) {
      if (now - rateRecord.windowStart < MAGIC_LINK_RATE_LIMIT.windowMs) {
        if (rateRecord.count >= MAGIC_LINK_RATE_LIMIT.maxPerWindow) {
          throw new Error("Too many magic link requests. Please wait before trying again.");
        }
        rateRecord.count += 1;
      } else {
        // Reset window
        magicLinkRateLimit.set(normalizedEmail, { count: 1, windowStart: now });
      }
    } else {
      magicLinkRateLimit.set(normalizedEmail, { count: 1, windowStart: now });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Store with 15-minute expiry
    magicLinkTokens.set(token, {
      email: normalizedEmail,
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false,
    });

    // In production, send email with link
    // For now, return the token directly (the frontend will handle display)
    // The link would be: ${origin}/api/auth/email/verify?token=${token}

    log.info({ email: normalizedEmail }, "[EmailAuth] Magic link requested");
    return { token, sent: true };
  }

  /**
   * Verify a magic link token and sign in
   * Includes lockout tracking for failed verification attempts
   */
  async verifyMagicLink(token: string): Promise<EmailAuthResult> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Look up token
    const tokenData = magicLinkTokens.get(token);
    if (!tokenData) {
      // We don't know the email for lockout tracking, but log the attempt
      log.warn("[EmailAuth] Invalid magic link verification attempt");
      throw new Error("Invalid or expired magic link");
    }

    // Check lockout before proceeding
    const lockout = this.isLockedOut(tokenData.email);
    if (lockout.locked) {
      const minutesRemaining = Math.ceil(lockout.remainingMs / 60000);
      throw new Error(`Account temporarily locked. Try again in ${minutesRemaining} minutes.`);
    }

    if (tokenData.used) {
      this.recordFailedAttempt(tokenData.email);
      throw new Error("Magic link already used");
    }
    if (Date.now() > tokenData.expiresAt) {
      magicLinkTokens.delete(token);
      this.recordFailedAttempt(tokenData.email);
      throw new Error("Magic link expired");
    }

    // Mark as used (single-use)
    tokenData.used = true;
    magicLinkTokens.delete(token);

    // Clear failed attempts on successful verification
    this.clearFailedAttempts(tokenData.email);

    const email = tokenData.email;
    const employerInference = this.extractDomainEmployer(email);

    const fieldsCaptured: string[] = ["email"];
    if (employerInference) fieldsCaptured.push("employer_inferred");

    let userId: number;
    let isNewUser = false;

    // Check if user exists by email
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      userId = existing[0].id;
      // Update auth provider
      await db
        .update(users)
        .set({
          authProvider: "email",
          employerName: employerInference?.employer || undefined,
        })
        .where(eq(users.id, userId));
    } else {
      isNewUser = true;
      userId = 0; // Caller creates user
    }

    if (userId > 0) {
      // Log enrichment
      const responseHash = crypto
        .createHash("sha256")
        .update(email)
        .digest("hex");

      await db.insert(authEnrichmentLog).values({
        id: crypto.randomUUID(),
        userId,
        provider: "email",
        eventType: isNewUser ? "initial_signup" : "re_auth",
        fieldsCaptured,
        fieldsNew: fieldsCaptured,
        fieldsUpdated: [],
        rawResponseHash: responseHash,
        suitabilityDimensionsUpdated: ["identity_demographics"],
      });
    }

    log.info({ email, userId, isNewUser }, "[EmailAuth] Successful magic link verification");

    return {
      userId,
      isNewUser,
      fieldsCaptured,
      profile: {
        email,
        employerInferred: employerInference?.employer,
        employerConfidence: employerInference?.confidence || 0,
      },
    };
  }

  /**
   * Get lockout status for an email (for admin/monitoring)
   */
  getLockoutStatus(email: string): { locked: boolean; attempts: number; lockedUntil: number | null } {
    const normalizedEmail = email.toLowerCase().trim();
    const record = failedAttempts.get(normalizedEmail);
    if (!record) return { locked: false, attempts: 0, lockedUntil: null };
    
    const now = Date.now();
    if (record.lockedUntil && now >= record.lockedUntil) {
      failedAttempts.delete(normalizedEmail);
      return { locked: false, attempts: 0, lockedUntil: null };
    }

    return {
      locked: !!record.lockedUntil,
      attempts: record.attempts,
      lockedUntil: record.lockedUntil,
    };
  }
}

export const emailAuthService = new EmailAuthService();
