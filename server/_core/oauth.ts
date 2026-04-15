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

      logger.info({
        operation: "oAuth.redirect",
        redirectTo,
        userName: userInfo.name,
      }, `[OAuth] Redirecting to ${redirectTo}`);

      // CRITICAL: Use a 200 HTML page with client-side redirect instead of 302.
      //
      // Why? Behind the Manus reverse proxy, Set-Cookie headers on 302 redirect
      // responses may be stripped or not processed by the browser before following
      // the redirect. This causes the session cookie to be lost.
      //
      // By returning a 200 HTML page that:
      //   1. Has the Set-Cookie header (preserved on 200 responses)
      //   2. Does a client-side redirect via JavaScript
      // We ensure the browser stores the cookie BEFORE navigating to the target page.
      const safeRedirectTo = redirectTo
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { opacity: 0.7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Signing you in...</p>
  </div>
  <script>
    // Set a flag so the AuthContext knows we just completed OAuth
    // and should retry auth.me instead of immediately provisioning a guest.
    try { sessionStorage.setItem('stewardly_oauth_pending', '1'); } catch(e) {}
    // Small delay to ensure the browser has processed the Set-Cookie header
    // before navigating away from this page.
    setTimeout(function() {
      window.location.replace(${JSON.stringify(redirectTo)});
    }, 100);
  </script>
</body>
</html>`;

      res.status(200).type("html").send(html);
    } catch (error) {
      logger.error( { operation: "oAuth", err: error },"[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
