/**
 * register-ghl-webhook.mjs — Register webhook with GoHighLevel API
 *
 * Uses the GHL API v2 to create/update a webhook subscription.
 * Failover: tries API v2 first, then v1 if v2 fails.
 */

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const WEBHOOK_URL = "https://stewardly.manus.space/api/webhooks/ghl";

const EVENTS = [
  "ContactCreate",
  "ContactUpdate",
  "ContactDelete",
  "OpportunityCreate",
  "OpportunityStatusUpdate",
  "ContactDndUpdate",
  "ContactTagUpdate",
  "NoteCreate",
  "NoteUpdate",
  "TaskCreate",
  "TaskComplete",
];

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error("ERROR: GHL_API_KEY and GHL_LOCATION_ID must be set");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

async function tryV2() {
  console.log("[GHL Webhook] Attempting API v2 registration...");
  console.log("[GHL Webhook] URL:", WEBHOOK_URL);
  console.log("[GHL Webhook] Location:", GHL_LOCATION_ID);
  console.log("[GHL Webhook] Events:", EVENTS.join(", "));

  // First, list existing webhooks to check if already registered
  const listResp = await fetch(
    `https://services.leadconnectorhq.com/webhooks/?locationId=${GHL_LOCATION_ID}`,
    { headers, signal: AbortSignal.timeout(15000) }
  );

  if (listResp.ok) {
    const listData = await listResp.json();
    const webhooks = listData.webhooks || [];
    console.log(`[GHL Webhook] Found ${webhooks.length} existing webhook(s)`);

    // Check if our webhook URL is already registered
    const existing = webhooks.find((w) => w.url === WEBHOOK_URL);
    if (existing) {
      console.log("[GHL Webhook] Webhook already registered! ID:", existing.id);
      console.log("[GHL Webhook] Current events:", existing.events?.join(", ") || "none");

      // Update events if needed
      const missingEvents = EVENTS.filter((e) => !(existing.events || []).includes(e));
      if (missingEvents.length > 0) {
        console.log("[GHL Webhook] Updating to add missing events:", missingEvents.join(", "));
        const updateResp = await fetch(
          `https://services.leadconnectorhq.com/webhooks/${existing.id}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              url: WEBHOOK_URL,
              events: EVENTS,
              locationId: GHL_LOCATION_ID,
            }),
            signal: AbortSignal.timeout(15000),
          }
        );
        if (updateResp.ok) {
          console.log("[GHL Webhook] Updated successfully!");
          return true;
        } else {
          const errText = await updateResp.text();
          console.log("[GHL Webhook] Update failed:", updateResp.status, errText);
        }
      } else {
        console.log("[GHL Webhook] All events already registered. No changes needed.");
        return true;
      }
    }
  } else {
    console.log("[GHL Webhook] List webhooks failed:", listResp.status, await listResp.text());
  }

  // Create new webhook
  console.log("[GHL Webhook] Creating new webhook...");
  const createResp = await fetch("https://services.leadconnectorhq.com/webhooks/", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: WEBHOOK_URL,
      events: EVENTS,
      locationId: GHL_LOCATION_ID,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (createResp.ok) {
    const data = await createResp.json();
    console.log("[GHL Webhook] Created successfully! ID:", data.id || data.webhook?.id || "unknown");
    return true;
  }

  const errBody = await createResp.text();
  console.log("[GHL Webhook] Create failed:", createResp.status, errBody);
  return false;
}

async function tryV1() {
  console.log("[GHL Webhook] Attempting v1 fallback...");
  const v1Headers = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    "Content-Type": "application/json",
  };

  const createResp = await fetch("https://rest.gohighlevel.com/v1/webhooks/", {
    method: "POST",
    headers: v1Headers,
    body: JSON.stringify({
      url: WEBHOOK_URL,
      events: EVENTS,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (createResp.ok) {
    const data = await createResp.json();
    console.log("[GHL Webhook] v1 Created successfully!", JSON.stringify(data).substring(0, 200));
    return true;
  }

  const errBody = await createResp.text();
  console.log("[GHL Webhook] v1 Create failed:", createResp.status, errBody);
  return false;
}

async function main() {
  console.log("=== GHL Webhook Registration ===");
  console.log("Timestamp:", new Date().toISOString());

  try {
    if (await tryV2()) {
      console.log("\n✅ GHL webhook registered via API v2");
      process.exit(0);
    }
  } catch (err) {
    console.log("[GHL Webhook] v2 error:", err.message);
  }

  try {
    if (await tryV1()) {
      console.log("\n✅ GHL webhook registered via API v1");
      process.exit(0);
    }
  } catch (err) {
    console.log("[GHL Webhook] v1 error:", err.message);
  }

  console.log("\n⚠️  API registration failed. Manual registration required.");
  console.log("Steps:");
  console.log("1. Go to https://app.gohighlevel.com → Settings → Webhooks");
  console.log("2. Click 'Add Webhook'");
  console.log("3. URL:", WEBHOOK_URL);
  console.log("4. Events:", EVENTS.join(", "));
  console.log("5. Save");
  process.exit(1);
}

main();
