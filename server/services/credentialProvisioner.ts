/**
 * Credential Auto-Provisioner — Connection Health Monitoring
 * 
 * Provides:
 * 1. Health checks for all configured platform connections
 * 2. Auto-detection of credential validity on save
 * 3. Connection health dashboard data
 * 4. Credential rotation reminders
 * 5. Platform-specific setup guidance
 */
import pino from "pino";
import { getRawPool } from "../db";

const logger = pino({ name: "credential-provisioner" });

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlatformHealth {
  provider: string;
  displayName: string;
  status: "healthy" | "degraded" | "error" | "unconfigured";
  lastChecked: string;
  responseTimeMs: number;
  details: string;
  features: {
    polling: boolean;
    webhooks: boolean;
    bidirectional: boolean;
    enrichment: boolean;
  };
  credentialAge?: number; // days since credential was saved
  expiresAt?: string;
}

export interface HealthReport {
  timestamp: string;
  platforms: PlatformHealth[];
  overallHealth: "healthy" | "degraded" | "critical";
  healthyCount: number;
  degradedCount: number;
  errorCount: number;
  unconfiguredCount: number;
}

// ─── Platform Definitions ───────────────────────────────────────────────────

const PLATFORM_DEFS: Record<string, {
  displayName: string;
  testEndpoint?: string;
  testHeaders: (creds: Record<string, string>) => Record<string, string>;
  features: PlatformHealth["features"];
}> = {
  gohighlevel: {
    displayName: "GoHighLevel",
    testEndpoint: "https://services.leadconnectorhq.com/locations/search",
    testHeaders: (c) => ({
      Authorization: `Bearer ${c.apiKey || c.api_key || ""}`,
      Version: "2021-07-28",
    }),
    features: { polling: true, webhooks: true, bidirectional: true, enrichment: false },
  },
  dripify: {
    displayName: "Dripify",
    testEndpoint: "https://api.dripify.io/v1/account",
    testHeaders: (c) => ({
      "X-Api-Key": c.apiKey || c.api_key || "",
    }),
    features: { polling: true, webhooks: true, bidirectional: true, enrichment: false },
  },
  smsit: {
    displayName: "SMS-iT",
    testEndpoint: "https://api.smsit.ai/v1/account",
    testHeaders: (c) => ({
      Authorization: `Bearer ${c.apiKey || c.api_key || ""}`,
    }),
    features: { polling: true, webhooks: true, bidirectional: true, enrichment: false },
  },
  workable: {
    displayName: "Workable",
    testEndpoint: undefined, // Constructed from subdomain
    testHeaders: (c) => ({
      Authorization: `Bearer ${c.apiKey || c.api_key || ""}`,
    }),
    features: { polling: true, webhooks: true, bidirectional: false, enrichment: false },
  },
  wealthbox: {
    displayName: "Wealthbox",
    testEndpoint: "https://api.crmworkspace.com/v1/contacts?per_page=1",
    testHeaders: (c) => ({
      "ACCESS_TOKEN": c.apiKey || c.access_token || "",
    }),
    features: { polling: true, webhooks: false, bidirectional: true, enrichment: false },
  },
  salesforce: {
    displayName: "Salesforce",
    testEndpoint: undefined, // Requires instance URL
    testHeaders: (c) => ({
      Authorization: `Bearer ${c.accessToken || c.access_token || ""}`,
    }),
    features: { polling: true, webhooks: true, bidirectional: true, enrichment: false },
  },
  redtail: {
    displayName: "Redtail CRM",
    testEndpoint: "https://smf.crm3.redtailtechnology.com/api/public/v1/contacts?count=1",
    testHeaders: (c) => ({
      Authorization: `Basic ${Buffer.from(`${c.username || ""}:${c.password || ""}`).toString("base64")}`,
      "Include": "names",
    }),
    features: { polling: true, webhooks: false, bidirectional: true, enrichment: false },
  },
  linkedin: {
    displayName: "LinkedIn / Sales Navigator",
    testEndpoint: undefined, // Uses Manus Data API
    testHeaders: () => ({}),
    features: { polling: false, webhooks: false, bidirectional: false, enrichment: true },
  },
  ghl_oauth: {
    displayName: "GHL Marketplace App (OAuth)",
    testEndpoint: undefined,
    testHeaders: () => ({}),
    features: { polling: true, webhooks: true, bidirectional: true, enrichment: false },
  },
};

// ─── Health Check for a Single Platform ─────────────────────────────────────

export async function checkPlatformHealth(
  provider: string,
  credentials?: Record<string, string>
): Promise<PlatformHealth> {
  const def = PLATFORM_DEFS[provider];
  if (!def) {
    return {
      provider,
      displayName: provider,
      status: "unconfigured",
      lastChecked: new Date().toISOString(),
      responseTimeMs: 0,
      details: "Unknown platform",
      features: { polling: false, webhooks: false, bidirectional: false, enrichment: false },
    };
  }

  if (!credentials || Object.keys(credentials).length === 0) {
    return {
      provider,
      displayName: def.displayName,
      status: "unconfigured",
      lastChecked: new Date().toISOString(),
      responseTimeMs: 0,
      details: "No credentials configured",
      features: def.features,
    };
  }

  // Special case: LinkedIn uses Manus Data API, no external credentials needed
  if (provider === "linkedin") {
    return {
      provider,
      displayName: def.displayName,
      status: "healthy",
      lastChecked: new Date().toISOString(),
      responseTimeMs: 0,
      details: "Uses Manus Data API — no external credentials required",
      features: def.features,
    };
  }

  // Special case: GHL OAuth — check stored tokens
  if (provider === "ghl_oauth") {
    try {
      const { getStoredTokens } = await import("./ghlOAuth");
      const tokens = await getStoredTokens();
      if (tokens && tokens.expiresAt > Date.now()) {
        return {
          provider,
          displayName: def.displayName,
          status: "healthy",
          lastChecked: new Date().toISOString(),
          responseTimeMs: 0,
          details: `OAuth connected, token valid until ${new Date(tokens.expiresAt).toLocaleString()}`,
          features: def.features,
          expiresAt: new Date(tokens.expiresAt).toISOString(),
        };
      }
      return {
        provider,
        displayName: def.displayName,
        status: "degraded",
        lastChecked: new Date().toISOString(),
        responseTimeMs: 0,
        details: "OAuth token expired — needs re-authorization",
        features: def.features,
      };
    } catch {
      return {
        provider,
        displayName: def.displayName,
        status: "error",
        lastChecked: new Date().toISOString(),
        responseTimeMs: 0,
        details: "Failed to check OAuth token status",
        features: def.features,
      };
    }
  }

  // Standard API health check
  let endpoint = def.testEndpoint;
  if (!endpoint) {
    // Construct from credentials for platforms that need instance URLs
    if (provider === "workable" && credentials.subdomain) {
      endpoint = `https://${credentials.subdomain}.workable.com/spi/v3/accounts`;
    } else if (provider === "salesforce" && credentials.instanceUrl) {
      endpoint = `${credentials.instanceUrl}/services/data/v59.0/limits`;
    } else {
      return {
        provider,
        displayName: def.displayName,
        status: "degraded",
        lastChecked: new Date().toISOString(),
        responseTimeMs: 0,
        details: "Missing instance URL or subdomain in credentials",
        features: def.features,
      };
    }
  }

  const start = Date.now();
  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: def.testHeaders(credentials),
      signal: AbortSignal.timeout(10000),
    });
    const responseTimeMs = Date.now() - start;

    if (resp.ok || resp.status === 200) {
      return {
        provider,
        displayName: def.displayName,
        status: "healthy",
        lastChecked: new Date().toISOString(),
        responseTimeMs,
        details: `API responded in ${responseTimeMs}ms`,
        features: def.features,
      };
    } else if (resp.status === 401 || resp.status === 403) {
      return {
        provider,
        displayName: def.displayName,
        status: "error",
        lastChecked: new Date().toISOString(),
        responseTimeMs,
        details: `Authentication failed (${resp.status}) — check credentials`,
        features: def.features,
      };
    } else if (resp.status === 429) {
      return {
        provider,
        displayName: def.displayName,
        status: "degraded",
        lastChecked: new Date().toISOString(),
        responseTimeMs,
        details: "Rate limited — reduce sync frequency",
        features: def.features,
      };
    } else {
      return {
        provider,
        displayName: def.displayName,
        status: "degraded",
        lastChecked: new Date().toISOString(),
        responseTimeMs,
        details: `API returned ${resp.status}`,
        features: def.features,
      };
    }
  } catch (e: any) {
    return {
      provider,
      displayName: def.displayName,
      status: "error",
      lastChecked: new Date().toISOString(),
      responseTimeMs: Date.now() - start,
      details: e.message || "Connection failed",
      features: def.features,
    };
  }
}

// ─── Full Health Report ─────────────────────────────────────────────────────

export async function getFullHealthReport(): Promise<HealthReport> {
  const pool = await getRawPool();
  const platforms: PlatformHealth[] = [];

  // Check each known platform
  for (const provider of Object.keys(PLATFORM_DEFS)) {
    let creds: Record<string, string> = {};

    // Try to load credentials from integration_connections
    if (pool) {
      try {
        const [rows] = await pool.query(
          "SELECT config_json FROM integration_connections WHERE provider = ? AND is_active = 1 LIMIT 1",
          [provider]
        );
        const row = (rows as any[])[0];
        if (row?.config_json) {
          creds = JSON.parse(row.config_json);
        }
      } catch { /* table may not exist */ }
    }

    // Also check env vars for GHL PIT
    if (provider === "gohighlevel" && !creds.apiKey && process.env.GHL_API_KEY) {
      creds = { apiKey: process.env.GHL_API_KEY };
    }

    const health = await checkPlatformHealth(provider, creds);
    platforms.push(health);
  }

  const healthyCount = platforms.filter(p => p.status === "healthy").length;
  const degradedCount = platforms.filter(p => p.status === "degraded").length;
  const errorCount = platforms.filter(p => p.status === "error").length;
  const unconfiguredCount = platforms.filter(p => p.status === "unconfigured").length;

  let overallHealth: HealthReport["overallHealth"] = "healthy";
  if (errorCount > 0) overallHealth = "critical";
  else if (degradedCount > 0) overallHealth = "degraded";

  return {
    timestamp: new Date().toISOString(),
    platforms,
    overallHealth,
    healthyCount,
    degradedCount,
    errorCount,
    unconfiguredCount,
  };
}

// ─── Platform Setup Guidance ────────────────────────────────────────────────

export function getSetupGuidance(provider: string): {
  steps: string[];
  docsUrl: string;
  requiredFields: string[];
  optionalFields: string[];
} {
  const guides: Record<string, ReturnType<typeof getSetupGuidance>> = {
    gohighlevel: {
      steps: [
        "Log in to your GHL sub-account",
        "Go to Settings → Integrations → API Keys",
        "Create a new Private Integration Token (PIT)",
        "Copy the token and paste it in the API Key field",
        "For webhooks, create a Marketplace App (see GHL Connect tab)",
      ],
      docsUrl: "https://highlevel.stoplight.io/docs/integrations",
      requiredFields: ["apiKey"],
      optionalFields: ["locationId"],
    },
    dripify: {
      steps: [
        "Log in to Dripify at app.dripify.io",
        "Go to Settings → API & Integrations",
        "Generate or copy your API key",
        "Paste the key in the API Key field",
      ],
      docsUrl: "https://dripify.io/api-docs",
      requiredFields: ["apiKey"],
      optionalFields: [],
    },
    smsit: {
      steps: [
        "Log in to SMS-iT dashboard",
        "Navigate to Settings → API Keys",
        "Create a new API key with read/write permissions",
        "Copy and paste the key below",
      ],
      docsUrl: "https://docs.smsit.ai",
      requiredFields: ["apiKey"],
      optionalFields: ["accountId"],
    },
    workable: {
      steps: [
        "Log in to Workable",
        "Go to Settings → Integrations → Access Tokens",
        "Generate a new access token",
        "Enter your Workable subdomain and the access token",
      ],
      docsUrl: "https://workable.readme.io/reference",
      requiredFields: ["apiKey", "subdomain"],
      optionalFields: [],
    },
    wealthbox: {
      steps: [
        "Log in to Wealthbox CRM",
        "Go to Settings → API Access",
        "Generate a new access token",
        "Copy the token and paste it below",
      ],
      docsUrl: "https://dev.wealthbox.com",
      requiredFields: ["apiKey"],
      optionalFields: [],
    },
    salesforce: {
      steps: [
        "Log in to Salesforce",
        "Go to Setup → Apps → Connected Apps",
        "Create a new Connected App with API access",
        "Enter the Consumer Key, Secret, and your instance URL",
      ],
      docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest",
      requiredFields: ["accessToken", "instanceUrl"],
      optionalFields: ["refreshToken", "clientId", "clientSecret"],
    },
    redtail: {
      steps: [
        "Log in to Redtail CRM",
        "Go to Settings → API Settings",
        "Note your API username and password (or API key)",
        "Enter them in the fields below",
      ],
      docsUrl: "https://corporate.redtailtechnology.com/api",
      requiredFields: ["username", "password"],
      optionalFields: ["apiKey"],
    },
    ghl_oauth: {
      steps: [
        "Go to marketplace.gohighlevel.com",
        "Create a new Private App",
        "Add required scopes: contacts.readonly, contacts.write, webhooks.write",
        "Set the redirect URL and webhook URL (see GHL Connect tab)",
        "Copy the Client ID and Client Secret",
        "Paste them below, then use the GHL Connect tab to authorize",
      ],
      docsUrl: "https://marketplace.gohighlevel.com/docs",
      requiredFields: ["clientId", "clientSecret"],
      optionalFields: ["scopes"],
    },
  };

  return guides[provider] || {
    steps: ["Contact support for setup instructions"],
    docsUrl: "",
    requiredFields: ["apiKey"],
    optionalFields: [],
  };
}
