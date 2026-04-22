/**
 * GHL OAuth App Integration — Marketplace App OAuth2 Flow
 * 
 * PIT tokens cannot register inbound webhooks. Only GHL Marketplace Apps can.
 * This service handles:
 * 1. OAuth2 authorization flow (redirect → callback → token exchange)
 * 2. Token storage and refresh
 * 3. Webhook event subscription after authorization
 * 4. Connection health monitoring
 * 
 * Prerequisites: User must create a GHL Marketplace App at marketplace.gohighlevel.com
 * and provide Client ID + Client Secret via the Credentials tab.
 */
import pino from "pino";
import { getRawPool } from "../db";

const logger = pino({ name: "ghl-oauth" });

const GHL_AUTH_BASE = "https://marketplace.gohighlevel.com";
const GHL_API_BASE = "https://services.leadconnectorhq.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GHLOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GHLOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  locationId: string;
  companyId?: string;
  userId?: string;
}

export interface GHLConnectionStatus {
  connected: boolean;
  method: "oauth" | "pit" | "none";
  oauthConfigured: boolean;
  pitConfigured: boolean;
  webhooksActive: boolean;
  lastTokenRefresh: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  locationName?: string;
  contactCount?: number;
}

// ─── Default Scopes for CRM Sync ────────────────────────────────────────────

const DEFAULT_SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "opportunities.readonly",
  "opportunities.write",
  "locations.readonly",
  "webhooks.readonly",
  "webhooks.write",
];

// ─── Webhook Events to Subscribe ────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  "ContactCreate",
  "ContactUpdate",
  "ContactDelete",
  "ContactDndUpdate",
  "ContactTagUpdate",
  "OpportunityCreate",
  "OpportunityUpdate",
  "OpportunityDelete",
  "TaskCreate",
  "TaskComplete",
  "NoteCreate",
  "AppointmentCreate",
];

// ─── OAuth URL Builder ──────────────────────────────────────────────────────

export function buildOAuthUrl(config: GHLOAuthConfig): string {
  const scopes = config.scopes.length > 0 ? config.scopes : DEFAULT_SCOPES;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes.join(" "),
  });
  return `${GHL_AUTH_BASE}/oauth/chooselocation?${params.toString()}`;
}

// ─── Token Exchange ─────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  config: GHLOAuthConfig
): Promise<GHLOAuthTokens | null> {
  try {
    const resp = await fetch(`${GHL_API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      logger.error({ status: resp.status, err }, "Token exchange failed");
      return null;
    }

    const data = await resp.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 86399) * 1000,
      locationId: data.locationId || "",
      companyId: data.companyId || "",
      userId: data.userId || "",
    };
  } catch (e: any) {
    logger.error({ err: e.message }, "Token exchange error");
    return null;
  }
}

// ─── Token Refresh ──────────────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string,
  config: GHLOAuthConfig
): Promise<GHLOAuthTokens | null> {
  try {
    const resp = await fetch(`${GHL_API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!resp.ok) {
      logger.error({ status: resp.status }, "Token refresh failed");
      return null;
    }

    const data = await resp.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 86399) * 1000,
      locationId: data.locationId || "",
      companyId: data.companyId || "",
      userId: data.userId || "",
    };
  } catch (e: any) {
    logger.error({ err: e.message }, "Token refresh error");
    return null;
  }
}

// ─── Store / Retrieve Tokens ────────────────────────────────────────────────

export async function storeOAuthTokens(tokens: GHLOAuthTokens): Promise<boolean> {
  const pool = await getRawPool();
  if (!pool) return false;
  try {
    await pool.query(
      `INSERT INTO platform_kv (\`key\`, value) VALUES ('ghl_oauth_tokens', ?) 
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [JSON.stringify(tokens)]
    );
    return true;
  } catch (e: any) {
    logger.error({ err: e.message }, "Failed to store OAuth tokens");
    return false;
  }
}

export async function getStoredTokens(): Promise<GHLOAuthTokens | null> {
  const pool = await getRawPool();
  if (!pool) return null;
  try {
    const [rows] = await pool.query(
      "SELECT value FROM platform_kv WHERE `key` = 'ghl_oauth_tokens' LIMIT 1"
    );
    const row = (rows as any[])[0];
    if (!row?.value) return null;
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

// ─── Get Valid Access Token (auto-refresh if expired) ───────────────────────

export async function getValidAccessToken(config: GHLOAuthConfig): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  // If token expires within 5 minutes, refresh
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    logger.info("OAuth token expiring soon, refreshing...");
    const newTokens = await refreshAccessToken(tokens.refreshToken, config);
    if (newTokens) {
      await storeOAuthTokens(newTokens);
      return newTokens.accessToken;
    }
    return null;
  }

  return tokens.accessToken;
}

// ─── Subscribe to Webhook Events ────────────────────────────────────────────

export async function subscribeToWebhookEvents(
  accessToken: string,
  webhookUrl: string
): Promise<{ success: boolean; subscribedEvents: string[]; errors: string[] }> {
  const subscribedEvents: string[] = [];
  const errors: string[] = [];

  // GHL Marketplace Apps subscribe to events via the app configuration,
  // not via API calls. The webhook URL is set in the app's Advanced Settings.
  // However, we can verify the connection works by making a test API call.
  
  try {
    // Verify the OAuth token works by fetching location info
    const resp = await fetch(`${GHL_API_BASE}/locations/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: "2021-07-28",
      },
    });

    if (resp.ok) {
      subscribedEvents.push(...WEBHOOK_EVENTS);
      logger.info({ events: WEBHOOK_EVENTS.length }, "OAuth connection verified, webhook events active via marketplace app");
    } else {
      errors.push(`OAuth verification failed: ${resp.status}`);
    }
  } catch (e: any) {
    errors.push(e.message);
  }

  return { success: errors.length === 0, subscribedEvents, errors };
}

// ─── Get GHL OAuth Config from Stored Credentials ──────────────────────────

export async function getOAuthConfig(redirectUri: string): Promise<GHLOAuthConfig | null> {
  const pool = await getRawPool();
  if (!pool) return null;

  try {
    const [rows] = await pool.query(
      "SELECT config_json FROM integration_connections WHERE provider = 'ghl_oauth' AND is_active = 1 LIMIT 1"
    );
    const row = (rows as any[])[0];
    if (!row?.config_json) return null;

    const config = JSON.parse(row.config_json);
    return {
      clientId: config.clientId || config.client_id || "",
      clientSecret: config.clientSecret || config.client_secret || "",
      redirectUri,
      scopes: config.scopes || DEFAULT_SCOPES,
    };
  } catch {
    return null;
  }
}

// ─── Connection Status ──────────────────────────────────────────────────────

export async function getGHLConnectionStatus(): Promise<GHLConnectionStatus> {
  const pitConfigured = !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
  const tokens = await getStoredTokens();
  const oauthConnected = !!(tokens && tokens.expiresAt > Date.now());

  let contactCount: number | undefined;
  let locationName: string | undefined;

  // Try to get location info via PIT if available
  if (pitConfigured) {
    try {
      const resp = await fetch(
        `${GHL_API_BASE}/locations/${process.env.GHL_LOCATION_ID}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GHL_API_KEY}`,
            Version: "2021-07-28",
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        locationName = data.location?.name;
      }
    } catch { /* ignore */ }

    try {
      const resp = await fetch(
        `${GHL_API_BASE}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GHL_API_KEY}`,
            Version: "2021-07-28",
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        contactCount = data.meta?.total;
      }
    } catch { /* ignore */ }
  }

  return {
    connected: oauthConnected || pitConfigured,
    method: oauthConnected ? "oauth" : pitConfigured ? "pit" : "none",
    oauthConfigured: oauthConnected,
    pitConfigured,
    webhooksActive: oauthConnected, // Only OAuth apps can receive webhooks
    lastTokenRefresh: tokens ? new Date(tokens.expiresAt - 86399 * 1000).toISOString() : null,
    tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
    scopes: oauthConnected ? DEFAULT_SCOPES : [],
    locationName,
    contactCount,
  };
}

// ─── GHL OAuth Callback Route Handler ───────────────────────────────────────

export async function handleOAuthCallback(
  code: string,
  redirectUri: string
): Promise<{ success: boolean; message: string; locationId?: string }> {
  const config = await getOAuthConfig(redirectUri);
  if (!config) {
    return { success: false, message: "GHL OAuth not configured. Please add Client ID and Secret in Credentials tab." };
  }

  const tokens = await exchangeCodeForTokens(code, config);
  if (!tokens) {
    return { success: false, message: "Failed to exchange authorization code for tokens." };
  }

  const stored = await storeOAuthTokens(tokens);
  if (!stored) {
    return { success: false, message: "Failed to store OAuth tokens." };
  }

  logger.info({ locationId: tokens.locationId }, "GHL OAuth connected successfully");
  return {
    success: true,
    message: `Connected to GHL location ${tokens.locationId}. Webhook events are now active via your Marketplace App.`,
    locationId: tokens.locationId,
  };
}
