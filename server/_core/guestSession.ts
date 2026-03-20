import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { randomUUID } from "crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Guest Session — auto-provisions anonymous users with a real DB user
 * and session cookie so they can use all protectedProcedure endpoints.
 * 
 * The guest user has authTier="anonymous" and a unique openId like "guest_<uuid>".
 * Data persists in DB during the session. When the user signs in via OAuth,
 * we can optionally migrate their guest data to the real account.
 */

const GUEST_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function registerGuestSessionRoutes(app: Express) {
  // POST /api/auth/guest-session — create or refresh a guest session
  app.post("/api/auth/guest-session", async (req: Request, res: Response) => {
    try {
      // Check if user already has a valid session
      const existingCookie = req.cookies?.app_session_id || parseCookieManual(req.headers.cookie, COOKIE_NAME);
      if (existingCookie) {
        const session = await sdk.verifySession(existingCookie);
        if (session) {
          // Already has a valid session — check if user exists
          const existingUser = await db.getUserByOpenId(session.openId);
          if (existingUser) {
            res.json({ 
              status: "existing",
              isGuest: existingUser.authTier === "anonymous",
              userId: existingUser.id,
            });
            return;
          }
        }
      }

      // Create a new guest user
      const guestOpenId = `guest_${randomUUID()}`;
      const guestName = "Guest User";

      await db.upsertUser({
        openId: guestOpenId,
        name: guestName,
        email: null,
        loginMethod: "guest",
        lastSignedIn: new Date(),
      });

      // Set authTier to anonymous
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users)
          .set({ authTier: "anonymous" })
          .where(eq(users.openId, guestOpenId));
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(guestOpenId, {
        name: guestName,
        expiresInMs: GUEST_SESSION_EXPIRY_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: GUEST_SESSION_EXPIRY_MS,
      });

      res.json({
        status: "created",
        isGuest: true,
      });
    } catch (error) {
      console.error("[GuestSession] Failed to create guest session:", error);
      res.status(500).json({ error: "Failed to create guest session" });
    }
  });

  // POST /api/auth/migrate-guest — migrate guest data to authenticated user
  app.post("/api/auth/migrate-guest", async (req: Request, res: Response) => {
    try {
      const { guestOpenId, targetOpenId } = req.body;
      if (!guestOpenId || !targetOpenId) {
        res.status(400).json({ error: "guestOpenId and targetOpenId are required" });
        return;
      }

      const guestUser = await db.getUserByOpenId(guestOpenId);
      const targetUser = await db.getUserByOpenId(targetOpenId);

      if (!guestUser || !targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (guestUser.authTier !== "anonymous") {
        res.status(400).json({ error: "Source user is not a guest" });
        return;
      }

      // Migrate data: update all records owned by guest to target user
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { eq } = await import("drizzle-orm");
        const schema = await import("../../drizzle/schema");

        // Migrate conversations
        if (schema.conversations) {
          await dbConn.update(schema.conversations)
            .set({ userId: targetUser.id })
            .where(eq(schema.conversations.userId, guestUser.id))
            .catch(() => {});
        }

        // Migrate documents
        if (schema.documents) {
          await dbConn.update(schema.documents)
            .set({ userId: targetUser.id })
            .where(eq(schema.documents.userId, guestUser.id))
            .catch(() => {});
        }

        // Migrate suitability data to target user
        if (guestUser.suitabilityData) {
          await dbConn.update(schema.users)
            .set({ 
              suitabilityData: guestUser.suitabilityData,
              suitabilityCompleted: guestUser.suitabilityCompleted,
            })
            .where(eq(schema.users.id, targetUser.id))
            .catch(() => {});
        }

        // Migrate settings if target doesn't have any
        if (guestUser.settings && !targetUser.settings) {
          await dbConn.update(schema.users)
            .set({ settings: guestUser.settings })
            .where(eq(schema.users.id, targetUser.id))
            .catch(() => {});
        }
      }

      res.json({ status: "migrated", migratedFrom: guestUser.id, migratedTo: targetUser.id });
    } catch (error) {
      console.error("[GuestSession] Migration failed:", error);
      res.status(500).json({ error: "Migration failed" });
    }
  });
}

function parseCookieManual(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
