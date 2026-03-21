/**
 * Test credential decryption using the actual server encryption service
 */
import { getDb } from "../server/db";
import { integrationConnections, integrationProviders } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decryptCredentials } from "../server/services/encryption";

async function main() {
  console.log("=== Testing Credential Decryption ===");
  console.log("INTEGRATION_ENCRYPTION_KEY exists:", !!process.env.INTEGRATION_ENCRYPTION_KEY);
  console.log("INTEGRATION_ENCRYPTION_KEY length:", process.env.INTEGRATION_ENCRYPTION_KEY?.length);
  console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
  console.log("JWT_SECRET length:", process.env.JWT_SECRET?.length);

  const db = await getDb();
  if (!db) {
    console.error("DB not available");
    return;
  }

  // Get all connected integrations
  const connections = await db.select({
    connId: integrationConnections.id,
    providerId: integrationConnections.providerId,
    status: integrationConnections.status,
    credentialsEncrypted: integrationConnections.credentialsEncrypted,
  }).from(integrationConnections)
    .where(eq(integrationConnections.status, "connected"));

  console.log(`\nFound ${connections.length} connected integrations\n`);

  for (const conn of connections) {
    // Get provider name
    const providers = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.id, conn.providerId));
    const provider = providers[0];
    const slug = provider?.slug || "unknown";

    console.log(`--- ${slug} (${conn.connId}) ---`);
    console.log(`  Has encrypted creds: ${!!conn.credentialsEncrypted}`);

    if (conn.credentialsEncrypted) {
      console.log(`  Encrypted length: ${conn.credentialsEncrypted.length}`);
      console.log(`  Encrypted prefix: ${conn.credentialsEncrypted.substring(0, 40)}...`);

      try {
        const creds = decryptCredentials(conn.credentialsEncrypted);
        console.log(`  Decrypted keys: ${Object.keys(creds).join(", ")}`);
        const apiKey = (creds.api_key || creds.apiKey || creds.access_token || "") as string;
        console.log(`  API key found: ${apiKey ? apiKey.substring(0, 8) + "..." : "EMPTY"}`);
        console.log(`  API key length: ${apiKey.length}`);
      } catch (e: any) {
        console.error(`  DECRYPTION FAILED: ${e.message}`);
      }
    } else {
      console.log(`  No credentials (keyless API)`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
