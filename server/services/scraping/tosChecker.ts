/**
 * Terms of Service Checker — Verify scraping is permitted before accessing a provider
 */
import { logger } from "../../_core/logger";
import { getDb } from "../../db";
import { eq } from "drizzle-orm";
import { integrationProviders } from "../../../drizzle/schema";

const log = logger.child({ module: "tosChecker" });

interface TosCheckResult {
  allowed: boolean;
  reason: string;
  provider: string;
  checkedAt: number;
}

// Providers with known ToS restrictions on automated access
const BLOCKED_PROVIDERS = new Set([
  "ambest.com",
  "cfp-board.org",
  "nasba.org",
  "nmlsconsumeraccess.org",
]);

// Providers with explicit API/data access programs
const ALLOWED_PROVIDERS = new Set([
  "irs.gov",
  "ssa.gov",
  "sec.gov",
  "fred.stlouisfed.org",
  "census.gov",
  "treasury.gov",
  "finra.org",
]);

export async function checkTos(providerDomain: string): Promise<TosCheckResult> {
  const now = Date.now();

  if (ALLOWED_PROVIDERS.has(providerDomain)) {
    return { allowed: true, reason: "Government/public data — no ToS restriction", provider: providerDomain, checkedAt: now };
  }

  if (BLOCKED_PROVIDERS.has(providerDomain)) {
    log.warn({ provider: providerDomain }, "Provider blocked by ToS — use official API instead");
    return { allowed: false, reason: "ToS prohibits automated access — use official API or manual entry", provider: providerDomain, checkedAt: now };
  }

  // Check integration_providers table for known status
  try {
    const db = await getDb();
    if (db) {
      const [provider] = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.slug, providerDomain))
        .limit(1);

      if (provider && !provider.isActive) {
        return { allowed: false, reason: "Provider marked inactive in platform config", provider: providerDomain, checkedAt: now };
      }
    }
  } catch {
    // DB not available — allow with warning
  }

  log.info({ provider: providerDomain }, "ToS status unknown — allowing with caution");
  return { allowed: true, reason: "No known ToS restriction — proceed with rate limiting", provider: providerDomain, checkedAt: now };
}

export async function batchCheckTos(domains: string[]): Promise<TosCheckResult[]> {
  return Promise.all(domains.map(checkTos));
}
