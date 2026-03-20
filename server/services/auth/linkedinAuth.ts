import { getDb } from "../../db";
import { users, authProviderTokens, authEnrichmentLog } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../encryption";
import crypto from "crypto";

// LinkedIn OpenID Connect scopes
const LINKEDIN_SCOPES = ["openid", "profile", "email"];

interface LinkedInProfile {
  sub: string;          // LinkedIn member ID
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  picture?: string;
  locale?: { country: string; language: string };
}

interface LinkedInLiteProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  localizedHeadline?: string;
  vanityName?: string;
  profilePicture?: { displayImage: string };
}

export interface LinkedInAuthResult {
  userId: number;
  isNewUser: boolean;
  fieldsCaptured: string[];
  profile: {
    name: string;
    email: string;
    linkedinId: string;
    headline?: string;
    industry?: string;
    location?: string;
    profileUrl?: string;
    photoUrl?: string;
    employer?: string;
    jobTitle?: string;
  };
}

export class LinkedInAuthService {
  /**
   * Generate LinkedIn OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      redirect_uri: redirectUri,
      state,
      scope: LINKEDIN_SCOPES.join(" "),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken?: string;
  }> {
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Fetch user profile from LinkedIn using OpenID Connect userinfo endpoint
   */
  async fetchProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`LinkedIn profile fetch failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch lite profile for headline/vanity name (v2 API)
   */
  async fetchLiteProfile(accessToken: string): Promise<LinkedInLiteProfile | null> {
    try {
      const response = await fetch("https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline,vanityName)", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Parse headline to extract employer and job title
   * "Senior VP at Goldman Sachs" → { employer: "Goldman Sachs", jobTitle: "Senior VP" }
   */
  parseHeadline(headline: string): { employer?: string; jobTitle?: string } {
    if (!headline) return {};

    // Common patterns: "Title at Company", "Title | Company", "Title, Company"
    const patterns = [
      /^(.+?)\s+at\s+(.+)$/i,
      /^(.+?)\s*\|\s*(.+)$/,
      /^(.+?)\s*[-–—]\s*(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (match) {
        return {
          jobTitle: match[1].trim(),
          employer: match[2].trim(),
        };
      }
    }

    // If no pattern matches, treat the whole thing as a title
    return { jobTitle: headline };
  }

  /**
   * Process LinkedIn sign-in: create/update user, store tokens, log enrichment
   */
  async processSignIn(
    code: string,
    redirectUri: string,
    existingUserId?: number
  ): Promise<LinkedInAuthResult> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Exchange code for token
    const tokenData = await this.exchangeCode(code, redirectUri);

    // Fetch profile
    const profile = await this.fetchProfile(tokenData.accessToken);
    const liteProfile = await this.fetchLiteProfile(tokenData.accessToken);

    const headline = liteProfile?.localizedHeadline || "";
    const { employer, jobTitle } = this.parseHeadline(headline);
    const profileUrl = liteProfile?.vanityName
      ? `https://www.linkedin.com/in/${liteProfile.vanityName}`
      : undefined;

    const fieldsCaptured: string[] = ["name", "email", "linkedin_id"];
    if (profile.picture) fieldsCaptured.push("photo");
    if (headline) fieldsCaptured.push("headline");
    if (employer) fieldsCaptured.push("employer");
    if (jobTitle) fieldsCaptured.push("job_title");
    if (profileUrl) fieldsCaptured.push("linkedin_profile_url");

    let userId: number;
    let isNewUser = false;

    // Check if user exists by LinkedIn ID
    const existingByLinkedIn = await db
      .select()
      .from(users)
      .where(eq(users.linkedinId, profile.sub))
      .limit(1);

    if (existingByLinkedIn.length > 0) {
      userId = existingByLinkedIn[0].id;
    } else if (existingUserId) {
      // Linking to existing account
      userId = existingUserId;
    } else {
      // Check by email
      const existingByEmail = profile.email
        ? await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
        : [];

      if (existingByEmail.length > 0) {
        userId = existingByEmail[0].id;
      } else {
        // New user — this would be handled by the main auth flow
        // For now, return the profile data for the caller to create the user
        isNewUser = true;
        userId = 0; // Placeholder — caller creates user
      }
    }

    // Update user with LinkedIn data if we have a valid userId
    if (userId > 0) {
      await db
        .update(users)
        .set({
          linkedinId: profile.sub,
          linkedinProfileUrl: profileUrl || null,
          linkedinHeadline: headline || null,
          employerName: employer || null,
          jobTitle: jobTitle || null,
          avatarUrl: profile.picture || undefined,
          authProvider: "linkedin",
          profileEnrichedAt: new Date(),
          profileEnrichmentSource: "linkedin",
        })
        .where(eq(users.id, userId));

      // Store encrypted tokens
      const tokenId = crypto.randomUUID();
      const encryptedAccess = encrypt(tokenData.accessToken);
      const encryptedRefresh = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;

      await db
        .insert(authProviderTokens)
        .values({
          id: tokenId,
          userId,
          provider: "linkedin",
          accessTokenEncrypted: encryptedAccess,
          refreshTokenEncrypted: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
          scopesGranted: LINKEDIN_SCOPES,
          lastProfileFetchAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            accessTokenEncrypted: encryptedAccess,
            refreshTokenEncrypted: encryptedRefresh,
            tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            scopesGranted: LINKEDIN_SCOPES,
            lastProfileFetchAt: new Date(),
          },
        });

      // Log enrichment
      const responseHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(profile))
        .digest("hex");

      await db.insert(authEnrichmentLog).values({
        id: crypto.randomUUID(),
        userId,
        provider: "linkedin",
        eventType: isNewUser ? "initial_signup" : "re_auth",
        fieldsCaptured,
        fieldsNew: fieldsCaptured,
        fieldsUpdated: [],
        rawResponseHash: responseHash,
        suitabilityDimensionsUpdated: ["identity_demographics", "experience_knowledge"],
      });
    }

    return {
      userId,
      isNewUser,
      fieldsCaptured,
      profile: {
        name: profile.name,
        email: profile.email,
        linkedinId: profile.sub,
        headline,
        employer,
        jobTitle,
        profileUrl,
        photoUrl: profile.picture,
      },
    };
  }
}

export const linkedInAuthService = new LinkedInAuthService();
