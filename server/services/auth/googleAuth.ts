import { getDb } from "../../db";
import { users, authProviderTokens, authEnrichmentLog } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "../encryption";
import crypto from "crypto";

// Google OAuth scopes — basic scopes first, sensitive scopes require verification
const GOOGLE_BASIC_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Sensitive scopes (require Google verification to use in production)
const GOOGLE_SENSITIVE_SCOPES = [
  "https://www.googleapis.com/auth/user.birthday.read",
  "https://www.googleapis.com/auth/user.gender.read",
  "https://www.googleapis.com/auth/user.phonenumbers.read",
  "https://www.googleapis.com/auth/user.addresses.read",
  "https://www.googleapis.com/auth/user.organization.read",
];

interface GoogleUserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  picture?: string;
  locale?: string;
}

interface GooglePeopleData {
  birthdays?: Array<{ date: { year: number; month: number; day: number } }>;
  genders?: Array<{ value: string }>;
  phoneNumbers?: Array<{ value: string; type: string; canonicalForm?: string }>;
  addresses?: Array<{
    formattedValue: string;
    type: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  organizations?: Array<{
    name: string;
    title?: string;
    type?: string;
    current?: boolean;
    startDate?: { year: number };
  }>;
}

export interface GoogleAuthResult {
  userId: number;
  isNewUser: boolean;
  fieldsCaptured: string[];
  profile: {
    name: string;
    email: string;
    googleId: string;
    photoUrl?: string;
    phone?: string;
    birthday?: string;
    gender?: string;
    address?: object;
    employer?: string;
    jobTitle?: string;
  };
}

export class GoogleAuthService {
  /**
   * Generate Google OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string, includeSensitiveScopes = false): string {
    const scopes = includeSensitiveScopes
      ? [...GOOGLE_BASIC_SCOPES, ...GOOGLE_SENSITIVE_SCOPES]
      : GOOGLE_BASIC_SCOPES;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope: string;
  }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  /**
   * Fetch basic user info from Google
   */
  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`Google userinfo failed: ${response.status}`);
    return response.json();
  }

  /**
   * Fetch People API data (birthday, gender, phone, address, organizations)
   */
  async fetchPeopleData(accessToken: string): Promise<GooglePeopleData> {
    try {
      const personFields = "birthdays,genders,phoneNumbers,addresses,organizations";
      const response = await fetch(
        `https://people.googleapis.com/v1/people/me?personFields=${personFields}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        // Sensitive scopes may not be granted — return empty
        return {};
      }

      return response.json();
    } catch {
      return {};
    }
  }

  /**
   * Process Google sign-in: create/update user, store tokens, log enrichment
   */
  async processSignIn(
    code: string,
    redirectUri: string,
    existingUserId?: number
  ): Promise<GoogleAuthResult> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Exchange code
    const tokenData = await this.exchangeCode(code, redirectUri);

    // Fetch basic profile
    const userInfo = await this.fetchUserInfo(tokenData.accessToken);

    // Fetch People API data (may be empty if sensitive scopes not granted)
    const peopleData = await this.fetchPeopleData(tokenData.accessToken);

    // Extract fields
    const phone = peopleData.phoneNumbers?.[0]?.canonicalForm
      || peopleData.phoneNumbers?.[0]?.value;
    const birthday = peopleData.birthdays?.[0]?.date
      ? `${peopleData.birthdays[0].date.year}-${String(peopleData.birthdays[0].date.month).padStart(2, "0")}-${String(peopleData.birthdays[0].date.day).padStart(2, "0")}`
      : undefined;
    const gender = peopleData.genders?.[0]?.value;
    const address = peopleData.addresses?.[0];
    const currentOrg = peopleData.organizations?.find((o) => o.current);
    const employer = currentOrg?.name;
    const jobTitle = currentOrg?.title;

    const fieldsCaptured: string[] = ["name", "email", "google_id"];
    if (userInfo.picture) fieldsCaptured.push("photo");
    if (phone) fieldsCaptured.push("phone");
    if (birthday) fieldsCaptured.push("birthday");
    if (gender) fieldsCaptured.push("gender");
    if (address) fieldsCaptured.push("address");
    if (employer) fieldsCaptured.push("employer");
    if (jobTitle) fieldsCaptured.push("job_title");

    let userId: number;
    let isNewUser = false;

    // Check if user exists by Google ID
    const existingByGoogle = await db
      .select()
      .from(users)
      .where(eq(users.googleId, userInfo.sub))
      .limit(1);

    if (existingByGoogle.length > 0) {
      userId = existingByGoogle[0].id;
    } else if (existingUserId) {
      userId = existingUserId;
    } else {
      // Check by email
      const existingByEmail = userInfo.email
        ? await db.select().from(users).where(eq(users.email, userInfo.email)).limit(1)
        : [];

      if (existingByEmail.length > 0) {
        userId = existingByEmail[0].id;
      } else {
        isNewUser = true;
        userId = 0;
      }
    }

    if (userId > 0) {
      await db
        .update(users)
        .set({
          googleId: userInfo.sub,
          googlePhone: phone || null,
          googleBirthday: birthday ? new Date(birthday) : null,
          googleGender: gender || null,
          googleAddressJson: address || null,
          googleOrganizationsJson: peopleData.organizations || null,
          employerName: employer || undefined,
          jobTitle: jobTitle || undefined,
          avatarUrl: userInfo.picture || undefined,
          authProvider: "google",
          profileEnrichedAt: new Date(),
          profileEnrichmentSource: "google",
        })
        .where(eq(users.id, userId));

      // Store encrypted tokens
      const encryptedAccess = encrypt(tokenData.accessToken);
      const encryptedRefresh = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;
      const grantedScopes = tokenData.scope.split(" ");

      await db
        .insert(authProviderTokens)
        .values({
          id: crypto.randomUUID(),
          userId,
          provider: "google",
          accessTokenEncrypted: encryptedAccess,
          refreshTokenEncrypted: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
          scopesGranted: grantedScopes,
          lastProfileFetchAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            accessTokenEncrypted: encryptedAccess,
            refreshTokenEncrypted: encryptedRefresh,
            tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            scopesGranted: grantedScopes,
            lastProfileFetchAt: new Date(),
          },
        });

      // Log enrichment
      const responseHash = crypto
        .createHash("sha256")
        .update(JSON.stringify({ userInfo, peopleData }))
        .digest("hex");

      await db.insert(authEnrichmentLog).values({
        id: crypto.randomUUID(),
        userId,
        provider: "google",
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
        name: userInfo.name,
        email: userInfo.email,
        googleId: userInfo.sub,
        photoUrl: userInfo.picture,
        phone,
        birthday,
        gender,
        address: address || undefined,
        employer,
        jobTitle,
      },
    };
  }
}

export const googleAuthService = new GoogleAuthService();
