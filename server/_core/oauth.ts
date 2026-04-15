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

/**
 * Attempt a database operation with retry logic for transient connection errors.
 * ECONNRESET, ETIMEDOUT, PROTOCOL_CONNECTION_LOST are all transient.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message ?? err);
      const isTransient = msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("PROTOCOL_CONNECTION_LOST") || msg.includes("Connection lost");
      if (!isTransient || attempt === retries) throw err;
      logger.warn({ operation: "oAuth.dbRetry", attempt: attempt + 1, error: msg }, `[OAuth] DB transient error, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
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
      // Step 1: Exchange code for token and get user info from OAuth provider
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Step 2: Upsert user in database — NON-BLOCKING for the login flow.
      // If the database is temporarily unavailable (ECONNRESET, etc.), we still
      // proceed with setting the session cookie. The user record will be
      // created/updated on the next successful request.
      try {
        await withRetry(() => db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        }));
      } catch (dbError) {
        // Log the error but DO NOT fail the entire OAuth flow.
        // The user has been authenticated by the OAuth provider — we should
        // still set the cookie and redirect them. The user record already
        // exists from their first login, and the upsert is just updating
        // lastSignedIn and name/email.
        logger.error(
          { operation: "oAuth.upsertUser", err: dbError },
          "[OAuth] Database upsert failed (non-fatal) — proceeding with login"
        );
      }

      // Step 3: Create session token — this is the critical step
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: AUTHENTICATED_SESSION_MS,
      });

      // Step 4: Set the session cookie
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

      // Step 5: Parse state to determine where to redirect the user after login.
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
      logger.error({ operation: "oAuth", err: error }, "[OAuth] Callback failed");

      // Even on failure, try to redirect the user to the home page
      // instead of showing a raw JSON error. This is a better UX.
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sign in error</title>
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
    .error-box {
      text-align: center;
      max-width: 400px;
      padding: 32px;
    }
    h2 { margin: 0 0 12px; font-size: 20px; }
    p { opacity: 0.7; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
    a {
      display: inline-block;
      padding: 10px 24px;
      background: #3b82f6;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    a:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="error-box">
    <h2>Sign-in hiccup</h2>
    <p>Something went wrong during sign-in. This is usually temporary — please try again.</p>
    <a href="/">Back to Home</a>
  </div>
</body>
</html>`;
      res.status(500).type("html").send(html);
    }
  });
}
