import { COOKIE_NAME, AUTHENTICATED_SESSION_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { logger } from "./logger";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: AUTHENTICATED_SESSION_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      logger.info({
        operation: "oAuth.setCookie",
        hostname: req.hostname,
        xForwardedHost: req.headers["x-forwarded-host"],
        xForwardedProto: req.headers["x-forwarded-proto"],
        cookieDomain: cookieOptions.domain ?? "(host-only)",
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        userName: userInfo.name,
      }, "[OAuth] Setting session cookie");
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: AUTHENTICATED_SESSION_MS });

      // Parse state to determine where to redirect the user after login.
      // State can be either:
      //   1. JSON: { origin, returnPath } — new format with return path
      //   2. Plain URL string — legacy format (just the callback URL)
      let redirectTo = "/";
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        try {
          const parsed = JSON.parse(decoded);
          if (parsed.returnPath && typeof parsed.returnPath === "string") {
            // Sanitize: only allow relative paths starting with /
            const rp = parsed.returnPath;
            if (rp.startsWith("/") && !rp.startsWith("//")) {
              redirectTo = rp;
            }
          }
        } catch {
          // Legacy format — decoded is a URL string, redirect to /
        }
      } catch {
        // Failed to decode state — fall back to /
      }
      res.redirect(302, redirectTo);
    } catch (error) {
      logger.error( { operation: "oAuth", err: error },"[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
