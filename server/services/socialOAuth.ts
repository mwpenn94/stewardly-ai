/**
 * Social OAuth Service — Google and LinkedIn login flows
 * 
 * Architecture:
 * - Google: OpenID Connect (OIDC) with authorization code flow
 * - LinkedIn: OAuth 2.0 with OpenID Connect
 * 
 * Both flows:
 * 1. Frontend redirects to provider's auth URL
 * 2. Provider redirects back to /api/auth/{provider}/callback with code
 * 3. Server exchanges code for tokens, fetches user info
 * 4. Server creates/updates user in DB, issues session cookie
 * 5. Migrates guest data if applicable
 */

import type { Express, Request, Response } from "express";
import { COOKIE_NAME, AUTHENTICATED_SESSION_MS } from "@shared/const";
import { randomUUID } from "crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

// ─── GOOGLE OIDC ─────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people/me";

interface GoogleUserInfo {
  sub: string;          // Google unique ID
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  picture: string;
}

interface GooglePeopleData {
  phoneNumbers?: Array<{ value: string; type: string }>;
  birthdays?: Array<{ date: { year: number; month: number; day: number } }>;
  genders?: Array<{ value: string }>;
  addresses?: Array<{ formattedValue: string; type: string }>;
  organizations?: Array<{ name: string; title: string; current: boolean }>;
}

// ─── LINKEDIN OIDC ───────────────────────────────────────────────

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

interface LinkedInUserInfo {
  sub: string;          // LinkedIn unique ID
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  picture: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────

function buildCallbackUrl(req: Request, provider: string): string {
  // Use the origin from the state parameter if available, otherwise construct from request
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}/api/auth/${provider}/callback`;
}

function parseState(state: string): { origin: string; returnPath: string; guestOpenId?: string; nonce: string } {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return { origin: "", returnPath: "/", nonce: "" };
  }
}

function encodeState(data: { origin: string; returnPath: string; guestOpenId?: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

async function issueSessionAndRedirect(
  req: Request,
  res: Response,
  openId: string,
  name: string,
  returnPath: string,
  guestOpenId?: string,
) {
  // Create session token
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: AUTHENTICATED_SESSION_MS,
  });

  // Set session cookie
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: AUTHENTICATED_SESSION_MS });

  // Migrate guest data if applicable
  if (guestOpenId && guestOpenId !== openId) {
    try {
      const guestUser = await db.getUserByOpenId(guestOpenId);
      if (guestUser && guestUser.authTier === "anonymous") {
        // Trigger migration via internal call
        const targetUser = await db.getUserByOpenId(openId);
        if (targetUser) {
          logger.info( { operation: "socialOAuth" },`[SocialOAuth] Migrating guest ${guestOpenId} → ${openId}`);
          // Migration is handled by the existing migrate-guest endpoint logic
          // We'll do a lightweight version here
          const { getDb } = await import("../db");
          const dbConn = await getDb();
          if (dbConn) {
            const { conversations, documents, users: usersTable } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await dbConn.update(conversations).set({ userId: targetUser.id }).where(eq(conversations.userId, guestUser.id)).catch(() => {});
            await dbConn.update(documents).set({ userId: targetUser.id }).where(eq(documents.userId, guestUser.id)).catch(() => {});
            if (guestUser.suitabilityData) {
              await dbConn.update(usersTable).set({ suitabilityData: guestUser.suitabilityData, suitabilityCompleted: guestUser.suitabilityCompleted }).where(eq(usersTable.id, targetUser.id)).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      logger.error( { operation: "socialOAuth", err: err },"[SocialOAuth] Guest migration failed:", err);
    }
  }

  res.redirect(302, returnPath || "/");
}

// ─── ROUTE REGISTRATION ──────────────────────────────────────────

export function registerSocialAuthRoutes(app: Express) {
  // ── Google: Initiate ──
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      res.status(503).json({ error: "Google OAuth not configured" });
      return;
    }

    const returnPath = (req.query.returnPath as string) || "/";
    const guestOpenId = req.query.guestOpenId as string | undefined;
    const origin = (req.query.origin as string) || `${req.protocol}://${req.headers.host}`;
    const nonce = randomUUID();

    const state = encodeState({ origin, returnPath, guestOpenId, nonce });
    const redirectUri = `${origin}/api/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile https://www.googleapis.com/auth/user.phonenumbers.read https://www.googleapis.com/auth/user.birthday.read https://www.googleapis.com/auth/user.gender.read https://www.googleapis.com/auth/user.addresses.read https://www.googleapis.com/auth/user.organization.read",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // ── Google: Callback ──
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      logger.error( { operation: "googleOauth", err: error },"[Google OAuth] Error:", error);
      res.redirect(302, "/?error=google_auth_failed");
      return;
    }

    if (!code || !stateParam) {
      res.status(400).json({ error: "Missing code or state" });
      return;
    }

    const { origin, returnPath, guestOpenId } = parseState(stateParam);
    const redirectUri = `${origin}/api/auth/google/callback`;

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        logger.error( { operation: "googleOauth" },"[Google OAuth] Token exchange failed:", errBody);
        res.redirect(302, `${returnPath || "/"}?error=google_token_failed`);
        return;
      }

      const tokens = await tokenRes.json() as { access_token: string; id_token: string; refresh_token?: string };

      // Get basic user info
      const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json() as GoogleUserInfo;

      // Get extended People API data
      let peopleData: GooglePeopleData = {};
      try {
        const peopleRes = await fetch(
          `${GOOGLE_PEOPLE_URL}?personFields=phoneNumbers,birthdays,genders,addresses,organizations`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (peopleRes.ok) {
          peopleData = await peopleRes.json() as GooglePeopleData;
        }
      } catch (err) {
        logger.warn( { operation: "googleOauth" },"[Google OAuth] People API fetch failed (non-critical):", err);
      }

      // Create a stable openId from Google sub
      const openId = `google_${userInfo.sub}`;

      // Upsert user with Google data
      await db.upsertUser({
        openId,
        name: userInfo.name || `${userInfo.given_name} ${userInfo.family_name}`,
        email: userInfo.email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Enrich user profile with Google data
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const enrichment: Record<string, unknown> = {
          authProvider: "google",
          googleId: userInfo.sub,
          authTier: "full",
        };

        if (userInfo.picture) enrichment.avatarUrl = userInfo.picture;
        if (peopleData.phoneNumbers?.[0]?.value) enrichment.googlePhone = peopleData.phoneNumbers[0].value;
        if (peopleData.birthdays?.[0]?.date) {
          const bd = peopleData.birthdays[0].date;
          if (bd.year && bd.month && bd.day) {
            enrichment.googleBirthday = new Date(bd.year, bd.month - 1, bd.day);
          }
        }
        if (peopleData.genders?.[0]?.value) enrichment.googleGender = peopleData.genders[0].value;
        if (peopleData.addresses?.length) enrichment.googleAddressJson = JSON.stringify(peopleData.addresses);
        if (peopleData.organizations?.length) {
          enrichment.googleOrganizationsJson = JSON.stringify(peopleData.organizations);
          const current = peopleData.organizations.find(o => o.current);
          if (current) {
            enrichment.employerName = current.name;
            enrichment.jobTitle = current.title;
          }
        }
        enrichment.profileEnrichedAt = new Date();
        enrichment.profileEnrichmentSource = "google";
        enrichment.signInDataJson = JSON.stringify({
          provider: "google",
          sub: userInfo.sub,
          email: userInfo.email,
          email_verified: userInfo.email_verified,
          picture: userInfo.picture,
          lastLogin: new Date().toISOString(),
        });

        await dbConn.update(users).set(enrichment).where(eq(users.openId, openId)).catch(err => {
          logger.error( { operation: "googleOauth", err: err },"[Google OAuth] Profile enrichment failed:", err);
        });
      }

      await issueSessionAndRedirect(req, res, openId, userInfo.name, returnPath, guestOpenId);
    } catch (err) {
      logger.error( { operation: "googleOauth", err: err },"[Google OAuth] Callback failed:", err);
      res.redirect(302, `${returnPath || "/"}?error=google_auth_failed`);
    }
  });

  // ── LinkedIn: Initiate ──
  app.get("/api/auth/linkedin", (req: Request, res: Response) => {
    if (!ENV.linkedinClientId) {
      res.status(503).json({ error: "LinkedIn OAuth not configured" });
      return;
    }

    const returnPath = (req.query.returnPath as string) || "/";
    const guestOpenId = req.query.guestOpenId as string | undefined;
    const origin = (req.query.origin as string) || `${req.protocol}://${req.headers.host}`;
    const nonce = randomUUID();

    const state = encodeState({ origin, returnPath, guestOpenId, nonce });
    const redirectUri = `${origin}/api/auth/linkedin/callback`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.linkedinClientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile email",
    });

    res.redirect(302, `${LINKEDIN_AUTH_URL}?${params.toString()}`);
  });

  // ── LinkedIn: Callback ──
  app.get("/api/auth/linkedin/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      logger.error( { operation: "linkedinOauth", err: error },"[LinkedIn OAuth] Error:", error, req.query.error_description);
      res.redirect(302, "/?error=linkedin_auth_failed");
      return;
    }

    if (!code || !stateParam) {
      res.status(400).json({ error: "Missing code or state" });
      return;
    }

    const { origin, returnPath, guestOpenId } = parseState(stateParam);
    const redirectUri = `${origin}/api/auth/linkedin/callback`;

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: ENV.linkedinClientId,
          client_secret: ENV.linkedinClientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        logger.error( { operation: "linkedinOauth" },"[LinkedIn OAuth] Token exchange failed:", errBody);
        res.redirect(302, `${returnPath || "/"}?error=linkedin_token_failed`);
        return;
      }

      const tokens = await tokenRes.json() as { access_token: string; id_token?: string };

      // Get user info via OpenID Connect userinfo endpoint
      const userInfoRes = await fetch(LINKEDIN_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        const errBody = await userInfoRes.text();
        logger.error( { operation: "linkedinOauth" },"[LinkedIn OAuth] Userinfo failed:", errBody);
        res.redirect(302, `${returnPath || "/"}?error=linkedin_userinfo_failed`);
        return;
      }

      const userInfo = await userInfoRes.json() as LinkedInUserInfo;

      // Create a stable openId from LinkedIn sub
      const openId = `linkedin_${userInfo.sub}`;

      // Upsert user with LinkedIn data
      await db.upsertUser({
        openId,
        name: userInfo.name || `${userInfo.given_name} ${userInfo.family_name}`,
        email: userInfo.email,
        loginMethod: "linkedin",
        lastSignedIn: new Date(),
      });

      // Enrich user profile with LinkedIn data
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const enrichment: Record<string, unknown> = {
          authProvider: "linkedin",
          linkedinId: userInfo.sub,
          authTier: "full",
        };

        if (userInfo.picture) enrichment.avatarUrl = userInfo.picture;
        enrichment.profileEnrichedAt = new Date();
        enrichment.profileEnrichmentSource = "linkedin";
        enrichment.signInDataJson = JSON.stringify({
          provider: "linkedin",
          sub: userInfo.sub,
          email: userInfo.email,
          email_verified: userInfo.email_verified,
          picture: userInfo.picture,
          lastLogin: new Date().toISOString(),
        });

        await dbConn.update(users).set(enrichment).where(eq(users.openId, openId)).catch(err => {
          logger.error( { operation: "linkedinOauth", err: err },"[LinkedIn OAuth] Profile enrichment failed:", err);
        });
      }

      await issueSessionAndRedirect(req, res, openId, userInfo.name, returnPath, guestOpenId);
    } catch (err) {
      logger.error( { operation: "linkedinOauth", err: err },"[LinkedIn OAuth] Callback failed:", err);
      res.redirect(302, `${returnPath || "/"}?error=linkedin_auth_failed`);
    }
  });

  // ── Status endpoint: check which social providers are configured ──
  app.get("/api/auth/social-providers", (_req: Request, res: Response) => {
    res.json({
      google: !!ENV.googleClientId && !!ENV.googleClientSecret,
      linkedin: !!ENV.linkedinClientId && !!ENV.linkedinClientSecret,
    });
  });
}
