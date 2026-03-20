import { getDb } from "../../db";
import { users, authEnrichmentLog } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// In-memory store for magic link tokens (production should use DB/Redis)
const magicLinkTokens = new Map<string, { email: string; expiresAt: number; used: boolean }>();

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
   */
  async requestMagicLink(email: string): Promise<{ token: string; sent: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

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

    return { token, sent: true };
  }

  /**
   * Verify a magic link token and sign in
   */
  async verifyMagicLink(token: string): Promise<EmailAuthResult> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Look up token
    const tokenData = magicLinkTokens.get(token);
    if (!tokenData) throw new Error("Invalid or expired magic link");
    if (tokenData.used) throw new Error("Magic link already used");
    if (Date.now() > tokenData.expiresAt) {
      magicLinkTokens.delete(token);
      throw new Error("Magic link expired");
    }

    // Mark as used (single-use)
    tokenData.used = true;
    magicLinkTokens.delete(token);

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
}

export const emailAuthService = new EmailAuthService();
