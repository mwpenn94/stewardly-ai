/**
 * Verify all pending integration connections by calling their test endpoints.
 * Run: node scripts/verify-connections.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { mysqlTable, varchar, text, mysqlEnum, timestamp, int, json } from "drizzle-orm/mysql-core";
import crypto from "crypto";

// ─── Inline schema (minimal) ──────────────────────────────────────────
const integrationConnections = mysqlTable("integration_connections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  providerId: varchar("provider_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["connected", "disconnected", "error", "pending", "expired"]).default("pending"),
  credentialsEncrypted: text("credentials_encrypted"),
  lastSyncError: text("last_sync_error"),
});

const integrationProviders = mysqlTable("integration_providers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: text("base_url"),
});

// ─── Encryption helpers ───────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    const fallback = process.env.JWT_SECRET || "stewardly-dev-key-do-not-use-in-prod";
    return crypto.scryptSync(fallback, "stewardly-integration-salt", 32);
  }
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  return crypto.scryptSync(key, "stewardly-integration-salt", 32);
}

function decryptWithKey(ciphertext, key) {
  const combined = Buffer.from(ciphertext, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

function decrypt(ciphertext) {
  const primaryKey = getEncryptionKey();
  try {
    return decryptWithKey(ciphertext, primaryKey);
  } catch {
    // Try legacy JWT_SECRET fallback
    const fallback = process.env.JWT_SECRET || "stewardly-dev-key-do-not-use-in-prod";
    const legacyKey = crypto.scryptSync(fallback, "stewardly-integration-salt", 32);
    return decryptWithKey(ciphertext, legacyKey);
  }
}

function decryptCredentials(enc) {
  return JSON.parse(decrypt(enc));
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

  const db = drizzle(dbUrl);

  // Get all pending connections
  const pending = await db.select().from(integrationConnections)
    .where(eq(integrationConnections.status, "pending"));

  console.log(`Found ${pending.length} pending connections`);

  for (const conn of pending) {
    const [provider] = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.id, conn.providerId));
    if (!provider) { console.log(`  Skip ${conn.id}: no provider found`); continue; }

    console.log(`\nTesting: ${provider.name} (${provider.slug})`);

    if (!conn.credentialsEncrypted) {
      console.log("  ❌ No credentials");
      continue;
    }

    const creds = decryptCredentials(conn.credentialsEncrypted);
    const apiKey = (creds.api_key || creds.apiKey || creds.access_token || "");
    console.log(`  API key: ****${apiKey.slice(-4)}`);

    let testUrl = "";
    const headers = {};
    let fetchOpts = { headers, signal: AbortSignal.timeout(15000) };

    switch (provider.slug) {
      case "census-bureau":
        testUrl = `https://api.census.gov/data/2021/acs/acs5?get=NAME&for=state:01&key=${apiKey}`;
        break;
      case "bls":
        testUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
        headers["Content-Type"] = "application/json";
        fetchOpts = {
          method: "POST",
          headers,
          body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: "2024", endyear: "2024", registrationkey: apiKey }),
          signal: AbortSignal.timeout(15000),
        };
        break;
      case "fred":
        testUrl = `https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${apiKey}&file_type=json`;
        break;
      case "bea":
        testUrl = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`;
        break;
      default:
        console.log(`  ⏭️  No test endpoint for ${provider.slug}`);
        continue;
    }

    const start = Date.now();
    try {
      const resp = await fetch(testUrl, fetchOpts);
      const latency = Date.now() - start;
      const text = await resp.text();

      if (resp.ok) {
        const hasError = text.toLowerCase().includes('"error"') && text.toLowerCase().includes('invalid');
        if (!hasError) {
          console.log(`  ✅ Connected (${latency}ms) — HTTP ${resp.status}`);
          await db.update(integrationConnections)
            .set({ status: "connected", lastSyncError: null })
            .where(eq(integrationConnections.id, conn.id));
        } else {
          console.log(`  ❌ Invalid API key (${latency}ms) — response contained error`);
          console.log(`  Response preview: ${text.substring(0, 200)}`);
          await db.update(integrationConnections)
            .set({ status: "error", lastSyncError: "Invalid API key" })
            .where(eq(integrationConnections.id, conn.id));
        }
      } else {
        console.log(`  ❌ HTTP ${resp.status} (${latency}ms)`);
        console.log(`  Response: ${text.substring(0, 200)}`);
        await db.update(integrationConnections)
          .set({ status: "error", lastSyncError: `HTTP ${resp.status}: ${text.substring(0, 100)}` })
          .where(eq(integrationConnections.id, conn.id));
      }
    } catch (err) {
      const latency = Date.now() - start;
      console.log(`  ❌ Error (${latency}ms): ${err.message}`);
      await db.update(integrationConnections)
        .set({ status: "error", lastSyncError: err.message })
        .where(eq(integrationConnections.id, conn.id));
    }
  }

  // Final status
  const all = await db.select({
    id: integrationConnections.id,
    status: integrationConnections.status,
    slug: integrationProviders.slug,
    name: integrationProviders.name,
    error: integrationConnections.lastSyncError,
  })
  .from(integrationConnections)
  .leftJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id));

  console.log("\n═══ Final Connection Status ═══");
  for (const c of all) {
    const icon = c.status === "connected" ? "✅" : c.status === "error" ? "❌" : "⏳";
    console.log(`${icon} ${c.name} (${c.slug}): ${c.status}${c.error ? ` — ${c.error}` : ""}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
