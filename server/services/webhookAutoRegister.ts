/**
 * Webhook Auto-Registration Service
 * Automatically registers webhook URLs with external platforms when connections are established.
 * Each platform has a different API for webhook management.
 */
import pino from "pino";

const logger = pino({ name: "webhook-auto-register" });

export interface WebhookRegistrationResult {
  platform: string;
  success: boolean;
  webhookId?: string;
  webhookUrl: string;
  message: string;
  requiresManualSetup?: boolean;
  manualSetupUrl?: string;
  manualSetupInstructions?: string;
}

/**
 * Get the base URL for webhook endpoints.
 * Uses ALLOWED_ORIGINS or falls back to common patterns.
 */
function getBaseUrl(): string {
  const origins = process.env.ALLOWED_ORIGINS || "";
  // Prefer the first non-localhost origin
  const productionOrigin = origins.split(",")
    .map(o => o.trim())
    .find(o => o && !o.includes("localhost") && !o.includes("127.0.0.1"));
  if (productionOrigin) return productionOrigin;
  // Fallback to known domain
  return "https://stewardly.manus.space";
}

/**
 * Register webhook with GoHighLevel
 * GHL supports webhook registration via API for OAuth apps and marketplace integrations.
 * For Private Integration Tokens, webhooks must be configured in the GHL UI.
 */
export async function registerGHLWebhook(
  credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/ghl`;
  const apiKey = credentials.api_key || credentials.apiKey || credentials.access_token || process.env.GHL_API_KEY || "";
  const locationId = credentials.location_id || credentials.locationId || process.env.GHL_LOCATION_ID || "";

  if (!apiKey) {
    return { platform: "gohighlevel", success: false, webhookUrl, message: "No API key configured" };
  }

  try {
    // Try to list existing webhooks first
    const listRes = await fetch(
      `https://services.leadconnectorhq.com/webhooks/?locationId=${locationId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      const webhooks = listData?.webhooks || listData?.data || [];
      const existing = Array.isArray(webhooks) && webhooks.find((w: any) => w.url === webhookUrl);
      if (existing) {
        logger.info({ webhookId: existing.id }, "GHL webhook already registered");
        return { platform: "gohighlevel", success: true, webhookId: existing.id, webhookUrl, message: "Already registered" };
      }

      // Try to create
      const createRes = await fetch("https://services.leadconnectorhq.com/webhooks/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          name: "Stewardly CRM Sync",
          locationId,
          events: [
            "ContactCreate", "ContactUpdate", "ContactDelete",
            "ContactDndUpdate", "ContactTagUpdate",
            "NoteCreate", "NoteUpdate",
            "TaskCreate", "TaskComplete",
            "OpportunityCreate", "OpportunityUpdate",
            "OpportunityStageUpdate", "OpportunityStatusUpdate",
            "AppointmentCreate", "AppointmentUpdate",
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        const webhookId = createData?.id || createData?.webhook?.id;
        logger.info({ webhookId }, "GHL webhook registered via API");
        return { platform: "gohighlevel", success: true, webhookId, webhookUrl, message: "Registered via API" };
      }
    }

    // If API doesn't support webhook management (PIT tokens), provide manual instructions
    logger.info("GHL webhook API not available — providing manual setup instructions");
    return {
      platform: "gohighlevel",
      success: false,
      webhookUrl,
      message: "Webhook API not available for this token type. Manual setup required.",
      requiresManualSetup: true,
      manualSetupUrl: "https://app.gohighlevel.com/settings/webhooks",
      manualSetupInstructions: `1. Go to Settings → Webhooks in your GHL account\n2. Click "Add Webhook"\n3. Enter URL: ${webhookUrl}\n4. Select events: Contact Create, Contact Update, Contact Delete, Opportunity Create/Update\n5. Save the webhook`,
    };
  } catch (err: any) {
    logger.error({ err }, "GHL webhook registration failed");
    return {
      platform: "gohighlevel",
      success: false,
      webhookUrl,
      message: err.message,
      requiresManualSetup: true,
      manualSetupUrl: "https://app.gohighlevel.com/settings/webhooks",
      manualSetupInstructions: `Go to Settings → Webhooks and add: ${webhookUrl}`,
    };
  }
}

/**
 * Register webhook with Workable
 * Workable supports webhook subscriptions via their API.
 */
export async function registerWorkableWebhook(
  credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/workable`;
  const apiKey = credentials.api_key || credentials.apiKey || credentials.access_token || "";
  const subdomain = credentials.subdomain || credentials.account_name || "app";

  if (!apiKey) {
    return { platform: "workable", success: false, webhookUrl, message: "No API key configured" };
  }

  try {
    // Workable API: POST /spi/v3/subscriptions
    const createRes = await fetch(`https://${subdomain}.workable.com/spi/v3/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: webhookUrl,
        event: "candidate_created",
        args: { account_id: subdomain },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      logger.info({ subscriptionId: data?.id }, "Workable webhook registered");
      return { platform: "workable", success: true, webhookId: data?.id, webhookUrl, message: "Registered via API" };
    }

    // Also register for candidate_moved event
    await fetch(`https://${subdomain}.workable.com/spi/v3/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: webhookUrl,
        event: "candidate_moved",
        args: { account_id: subdomain },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});

    const errText = await createRes.text().catch(() => "");
    return {
      platform: "workable",
      success: false,
      webhookUrl,
      message: `HTTP ${createRes.status}: ${errText.slice(0, 200)}`,
      requiresManualSetup: true,
      manualSetupUrl: `https://${subdomain}.workable.com/backend/settings/integrations`,
      manualSetupInstructions: `1. Go to Settings → Integrations in Workable\n2. Find Webhooks section\n3. Add webhook URL: ${webhookUrl}\n4. Select events: Candidate Created, Candidate Moved`,
    };
  } catch (err: any) {
    return {
      platform: "workable",
      success: false,
      webhookUrl,
      message: err.message,
      requiresManualSetup: true,
      manualSetupUrl: `https://${subdomain}.workable.com/backend/settings/integrations`,
      manualSetupInstructions: `Add webhook URL: ${webhookUrl} in Workable Settings → Integrations`,
    };
  }
}

/**
 * Register webhook with SMS-iT
 * SMS-iT supports webhook configuration via their API.
 */
export async function registerSmsitWebhook(
  credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/smsit`;
  const apiKey = credentials.api_key || credentials.apiKey || credentials.access_token || "";

  if (!apiKey) {
    return { platform: "smsit", success: false, webhookUrl, message: "No API key configured" };
  }

  try {
    // SMS-iT API: POST /api/webhooks
    const createRes = await fetch("https://tool-it.smsit.ai/api/webhooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["contact.created", "contact.updated", "message.received", "message.sent"],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      logger.info({ webhookId: data?.id }, "SMS-iT webhook registered");
      return { platform: "smsit", success: true, webhookId: data?.id || data?.data?.id, webhookUrl, message: "Registered via API" };
    }

    const errText = await createRes.text().catch(() => "");
    return {
      platform: "smsit",
      success: false,
      webhookUrl,
      message: `HTTP ${createRes.status}: ${errText.slice(0, 200)}`,
      requiresManualSetup: true,
      manualSetupUrl: "https://tool-it.smsit.ai/settings/webhooks",
      manualSetupInstructions: `1. Go to Settings → Webhooks in SMS-iT\n2. Add webhook URL: ${webhookUrl}\n3. Select events: Contact Created, Contact Updated, Message Received`,
    };
  } catch (err: any) {
    return {
      platform: "smsit",
      success: false,
      webhookUrl,
      message: err.message,
      requiresManualSetup: true,
      manualSetupUrl: "https://tool-it.smsit.ai/settings/webhooks",
      manualSetupInstructions: `Add webhook URL: ${webhookUrl} in SMS-iT Settings → Webhooks`,
    };
  }
}

/**
 * Register webhook with Dripify
 * Dripify has limited webhook support — primarily via Zapier/integrations.
 * We provide manual setup instructions.
 */
export async function registerDripifyWebhook(
  _credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/dripify`;

  // Dripify doesn't have a public webhook registration API
  // Users need to set up via Dripify's integration settings or Zapier
  return {
    platform: "dripify",
    success: false,
    webhookUrl,
    message: "Dripify requires manual webhook setup via their integrations page",
    requiresManualSetup: true,
    manualSetupUrl: "https://app.dripify.io/settings/integrations",
    manualSetupInstructions: `1. Go to Settings → Integrations in Dripify\n2. Find Webhooks or Zapier integration\n3. Add webhook URL: ${webhookUrl}\n4. Select events: Lead Responded, Connection Accepted, Profile Viewed`,
  };
}

/**
 * Register webhook with LinkedIn / Sales Navigator
 * LinkedIn doesn't support traditional webhooks for most API access levels.
 * Real-time updates require LinkedIn Partner Program membership.
 */
export async function registerLinkedInWebhook(
  _credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/linkedin`;

  return {
    platform: "linkedin",
    success: false,
    webhookUrl,
    message: "LinkedIn webhooks require Partner Program membership. Using polling-based sync instead.",
    requiresManualSetup: true,
    manualSetupUrl: "https://www.linkedin.com/developers/apps",
    manualSetupInstructions: `LinkedIn real-time webhooks require Partner Program access. For now, Stewardly uses polling-based sync to pull LinkedIn/Sales Navigator data on a schedule. To enable real-time updates:\n1. Apply for LinkedIn Partner Program\n2. Register webhook URL: ${webhookUrl}\n3. Subscribe to member profile change events`,
  };
}

/**
 * Auto-register webhooks for a platform when a connection is established.
 * Returns registration result with instructions for manual setup if needed.
 */
export async function autoRegisterWebhook(
  platform: string,
  credentials: Record<string, string>,
): Promise<WebhookRegistrationResult> {
  const slug = platform.toLowerCase();

  switch (slug) {
    case "gohighlevel":
      return registerGHLWebhook(credentials);
    case "workable":
      return registerWorkableWebhook(credentials);
    case "smsit":
      return registerSmsitWebhook(credentials);
    case "dripify":
      return registerDripifyWebhook(credentials);
    case "linkedin":
    case "sales-navigator":
      return registerLinkedInWebhook(credentials);
    default: {
      const baseUrl = getBaseUrl();
      return {
        platform: slug,
        success: false,
        webhookUrl: `${baseUrl}/api/webhooks/${slug}`,
        message: `No webhook registration handler for platform: ${slug}`,
      };
    }
  }
}

/**
 * Get webhook URLs and status for all platforms.
 */
export function getAllWebhookUrls(): Array<{ platform: string; webhookUrl: string; description: string }> {
  const baseUrl = getBaseUrl();
  return [
    { platform: "gohighlevel", webhookUrl: `${baseUrl}/api/webhooks/ghl`, description: "GoHighLevel contact & opportunity events" },
    { platform: "dripify", webhookUrl: `${baseUrl}/api/webhooks/dripify`, description: "Dripify lead response & connection events" },
    { platform: "smsit", webhookUrl: `${baseUrl}/api/webhooks/smsit`, description: "SMS-iT contact & message events" },
    { platform: "workable", webhookUrl: `${baseUrl}/api/webhooks/workable`, description: "Workable candidate events" },
    { platform: "linkedin", webhookUrl: `${baseUrl}/api/webhooks/linkedin`, description: "LinkedIn profile & connection events" },
  ];
}
