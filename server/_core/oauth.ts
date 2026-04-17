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
  /**
   * POST /api/auth/set-session
   *
   * Accepts a session token in the request body and sets it as an httpOnly cookie.
   * This endpoint exists because the Manus reverse proxy strips Set-Cookie headers
   * from certain response types (302 redirects and possibly full HTML pages), but
   * preserves them on JSON XHR responses (as proven by /api/auth/guest-session working).
   *
   * The OAuth callback returns an HTML page that:
   *   1. Reads the token from an inline variable (embedded via JSON.stringify)
   *   2. Stores it in localStorage (PRIMARY auth mechanism)
   *   3. POSTs it to this endpoint via fetch() to set cookie (fallback)
   *   4. The Set-Cookie header on the JSON response is preserved by the proxy
   *   5. Then does a client-side redirect to the target page
   *
   * Security: The token is a signed JWT created by our server. We verify it before
   * setting the cookie to prevent arbitrary cookie injection.
   */
  app.post("/api/auth/set-session", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        res.status(400).json({ error: "token is required" });
        return;
      }

      // Verify the token is a valid session JWT signed by us
      const session = await sdk.verifySession(token);
      if (!session) {
        res.status(401).json({ error: "Invalid session token" });
        return;
      }

      // Set the cookie — this is a JSON response, so the proxy will preserve Set-Cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: AUTHENTICATED_SESSION_MS });

      logger.info({
        operation: "oAuth.setSession",
        userName: session.name,
        openId: session.openId,
      }, "[OAuth] Session cookie set via XHR endpoint");

      res.json({ ok: true });
    } catch (error) {
      logger.error({ operation: "oAuth.setSession", err: error }, "[OAuth] set-session failed");
      res.status(500).json({ error: "Failed to set session" });
    }
  });

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
      try {
        await withRetry(() => db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        }));
      } catch (dbError) {
        logger.error(
          { operation: "oAuth.upsertUser", err: dbError },
          "[OAuth] Database upsert failed (non-fatal) — proceeding with login"
        );
      }

      // Step 3: Create session token
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: AUTHENTICATED_SESSION_MS,
      });

      // Step 4: Parse state to determine where to redirect the user after login.
      let redirectTo = "/";
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        try {
          const parsed = JSON.parse(decoded);
          if (parsed.returnPath && typeof parsed.returnPath === "string") {
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
        operation: "oAuth.callback",
        redirectTo,
        userName: userInfo.name,
      }, `[OAuth] Callback successful, sending token via HTML bridge`);

      // Step 5: Return an HTML page that stores the token and redirects.
      //
      // WHY THIS APPROACH:
      // The Manus reverse proxy strips Set-Cookie headers from 302 redirects
      // and from full HTML page responses. However, it preserves Set-Cookie on
      // JSON XHR responses (proven by /api/auth/guest-session working).
      //
      // So we:
      //   1. Return a 200 HTML page with the token embedded inline via JSON.stringify
      //   2. The page's JavaScript stores the token in localStorage (PRIMARY auth path)
      //   3. Also POSTs the token to /api/auth/set-session to set cookie (fallback)
      //   4. After storage, redirect to the target page
      //
      // The token is embedded inline (not via URL fragment) so it never appears
      // in browser history, server logs, or referrer headers.
      const nonce = res.locals?.cspNonce || '';
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
  <style nonce="${nonce}">
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
    .loader { text-align: center; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #d4a843;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { opacity: 0.7; font-size: 14px; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p id="status">Signing you in...</p>
  </div>
  <script nonce="${nonce}">
    (async function() {
      var token = ${JSON.stringify(sessionToken)};
      var redirectTo = ${JSON.stringify(redirectTo)};
      var statusEl = document.getElementById('status');

      try {
        // Store token in localStorage — this is the PRIMARY auth mechanism.
        // The Manus reverse proxy strips Set-Cookie from ALL responses,
        // so we store the token client-side and send it via Authorization header.
        try {
          localStorage.setItem('stewardly_session_token', token);
        } catch(e) {
          console.warn('[OAuth] Failed to save token to localStorage:', e);
        }

        // Also try to set the cookie via XHR as a fallback
        try {
          await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: token })
          });
        } catch(e) {
          // Non-fatal — localStorage token is the primary mechanism
          console.warn('[OAuth] set-session fallback failed:', e);
        }

        // Token is stored — redirect to the target page
        window.location.replace(redirectTo);
      } catch (err) {
        statusEl.textContent = 'Sign-in failed. Redirecting...';
        statusEl.className = 'error';
        console.error('[OAuth] Failed to set session cookie:', err);
        // Redirect to home after a short delay
        setTimeout(function() { window.location.replace('/'); }, 2000);
      }
    })();
  </script>
</body>
</html>`;

      // Do NOT set the cookie here — the proxy strips it.
      // The cookie will be set by the /api/auth/set-session endpoint called from the HTML page.
      res.status(200).type("html").send(html);
    } catch (error) {
      logger.error({ operation: "oAuth", err: error }, "[OAuth] Callback failed");

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
      background: #d4a843;
      color: #0a0a0a;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    a:hover { background: #c49a3a; }
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
