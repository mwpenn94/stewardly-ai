/**
 * Per-Domain Token Bucket Rate Limiter
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "scrapingRateLimiter" });

interface Bucket {
  tokens: number;
  lastRefill: number;
  maxRpm: number;
}

const buckets = new Map<string, Bucket>();

export async function acquireToken(provider: string): Promise<boolean> {
  let bucket = buckets.get(provider);

  if (!bucket) {
    // Load from DB
    const maxRpm = await getProviderRpm(provider);
    bucket = { tokens: maxRpm, lastRefill: Date.now(), maxRpm };
    buckets.set(provider, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = Date.now() - bucket.lastRefill;
  const tokensToAdd = Math.floor((elapsed / 60000) * bucket.maxRpm);
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(bucket.maxRpm, bucket.tokens + tokensToAdd);
    bucket.lastRefill = Date.now();
  }

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }

  log.warn({ provider, maxRpm: bucket.maxRpm }, "Rate limit reached");
  return false;
}

async function getProviderRpm(provider: string): Promise<number> {
  const db = await getDb();
  if (!db) return 10; // Conservative default

  try {
    const { rateProfiles } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [profile] = await db.select().from(rateProfiles).where(eq(rateProfiles.provider, provider)).limit(1);
    return profile?.currentRpm ?? 10;
  } catch {
    return 10;
  }
}

export function resetBucket(provider: string): void {
  buckets.delete(provider);
}
