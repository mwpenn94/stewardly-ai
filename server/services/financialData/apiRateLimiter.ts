/**
 * API Rate Limiter — Per-adapter rate limit tracking
 *
 * Tracks API call counts per adapter per day/hour/minute to prevent
 * exceeding provider rate limits. In-memory with daily reset.
 *
 * Known limits:
 * - BLS: 500 requests/day (with key), 25/day (without key)
 * - FRED: 120 requests/minute
 * - Census: 500 requests/day (with key)
 * - SEC EDGAR: 10 requests/second (fair access)
 * - BEA: 100 requests/minute
 */

interface RateLimitConfig {
  maxPerDay?: number;
  maxPerMinute?: number;
  maxPerSecond?: number;
}

interface UsageRecord {
  dayKey: string;
  dayCount: number;
  minuteKey: string;
  minuteCount: number;
  secondKey: string;
  secondCount: number;
}

const ADAPTER_LIMITS: Record<string, RateLimitConfig> = {
  bls: { maxPerDay: 450 },         // 500 limit, 90% safety margin
  "bls-nokey": { maxPerDay: 22 },  // 25 limit, 88% safety margin
  fred: { maxPerMinute: 100 },     // 120 limit, 83% safety margin
  census: { maxPerDay: 450 },      // 500 limit, 90% safety margin
  "sec-edgar": { maxPerSecond: 8 },// 10 limit, 80% safety margin
  bea: { maxPerMinute: 80 },       // 100 limit, 80% safety margin
};

const usage = new Map<string, UsageRecord>();

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMinuteKey(): string {
  return new Date().toISOString().slice(0, 16);
}

function getSecondKey(): string {
  return new Date().toISOString().slice(0, 19);
}

function getUsage(adapterId: string): UsageRecord {
  const existing = usage.get(adapterId);
  const dayKey = getDayKey();
  const minuteKey = getMinuteKey();
  const secondKey = getSecondKey();

  if (!existing) {
    const record: UsageRecord = { dayKey, dayCount: 0, minuteKey, minuteCount: 0, secondKey, secondCount: 0 };
    usage.set(adapterId, record);
    return record;
  }

  // Reset counters on period rollover
  if (existing.dayKey !== dayKey) {
    existing.dayKey = dayKey;
    existing.dayCount = 0;
  }
  if (existing.minuteKey !== minuteKey) {
    existing.minuteKey = minuteKey;
    existing.minuteCount = 0;
  }
  if (existing.secondKey !== secondKey) {
    existing.secondKey = secondKey;
    existing.secondCount = 0;
  }

  return existing;
}

/**
 * Check if a request is allowed for the given adapter.
 * Returns { allowed: true } or { allowed: false, reason, retryAfterMs }
 */
export function checkRateLimit(adapterId: string): {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  usage?: { dayCount: number; minuteCount: number; secondCount: number };
} {
  const limits = ADAPTER_LIMITS[adapterId];
  if (!limits) return { allowed: true };

  const record = getUsage(adapterId);

  if (limits.maxPerDay && record.dayCount >= limits.maxPerDay) {
    const msUntilMidnight = new Date(record.dayKey + "T23:59:59Z").getTime() - Date.now();
    return {
      allowed: false,
      reason: `${adapterId}: daily limit reached (${record.dayCount}/${limits.maxPerDay})`,
      retryAfterMs: Math.max(msUntilMidnight, 60000),
      usage: { dayCount: record.dayCount, minuteCount: record.minuteCount, secondCount: record.secondCount },
    };
  }

  if (limits.maxPerMinute && record.minuteCount >= limits.maxPerMinute) {
    return {
      allowed: false,
      reason: `${adapterId}: per-minute limit reached (${record.minuteCount}/${limits.maxPerMinute})`,
      retryAfterMs: 60000,
      usage: { dayCount: record.dayCount, minuteCount: record.minuteCount, secondCount: record.secondCount },
    };
  }

  if (limits.maxPerSecond && record.secondCount >= limits.maxPerSecond) {
    return {
      allowed: false,
      reason: `${adapterId}: per-second limit reached (${record.secondCount}/${limits.maxPerSecond})`,
      retryAfterMs: 1000,
      usage: { dayCount: record.dayCount, minuteCount: record.minuteCount, secondCount: record.secondCount },
    };
  }

  return {
    allowed: true,
    usage: { dayCount: record.dayCount, minuteCount: record.minuteCount, secondCount: record.secondCount },
  };
}

/**
 * Record a successful API call for rate tracking.
 */
export function recordApiCall(adapterId: string): void {
  const record = getUsage(adapterId);
  record.dayCount++;
  record.minuteCount++;
  record.secondCount++;
}

/**
 * Get current usage stats for all adapters.
 */
export function getAllUsageStats(): Record<string, {
  dayCount: number;
  minuteCount: number;
  secondCount: number;
  limits: RateLimitConfig;
}> {
  const stats: Record<string, any> = {};
  for (const [id, limits] of Object.entries(ADAPTER_LIMITS)) {
    const record = getUsage(id);
    stats[id] = {
      dayCount: record.dayCount,
      minuteCount: record.minuteCount,
      secondCount: record.secondCount,
      limits,
    };
  }
  return stats;
}

/**
 * Reset usage for a specific adapter (useful for testing).
 */
export function resetUsage(adapterId?: string): void {
  if (adapterId) {
    usage.delete(adapterId);
  } else {
    usage.clear();
  }
}
