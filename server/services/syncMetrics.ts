/**
 * syncMetrics.ts — Sync Event Metrics Service
 *
 * Tracks individual sync events from both webhook and polling channels,
 * computes latency statistics, and provides channel health comparison data
 * for the webhook vs polling comparison panel.
 *
 * Events are recorded in the `sync_event_metrics` table with:
 * - channel (webhook | polling)
 * - event type (contact_create, contact_update, etc.)
 * - detection timestamp and optional GHL origin timestamp
 * - computed latency (detection - origin)
 */
import { getRawPool } from "../db";
import { logger } from "../_core/logger";
import crypto from "crypto";

const log = logger.child({ module: "syncMetrics" });

// ─── Types ──────────────────────────────────────────────────────────────────

export type SyncChannel = "webhook" | "polling";

export type SyncEventType =
  | "contact_create"
  | "contact_update"
  | "contact_delete"
  | "opportunity_create"
  | "opportunity_update";

export interface RecordSyncEventInput {
  channel: SyncChannel;
  eventType: SyncEventType;
  locationId?: string;
  locationDbId?: number;
  contactExternalId?: string;
  detectedAt?: number; // defaults to Date.now()
  ghlTimestamp?: number; // original GHL change timestamp
  payloadSize?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelMetrics {
  channel: SyncChannel;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number; // 0-100
  avgLatencyMs: number | null;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  eventsLast1h: number;
  eventsLast24h: number;
  lastEventAt: number | null;
}

export interface ChannelComparison {
  webhook: ChannelMetrics;
  polling: ChannelMetrics;
  latencyAdvantage: {
    channel: SyncChannel | "tie";
    differenceMs: number;
    description: string;
  };
  coverageComparison: {
    webhookOnly: number;
    pollingOnly: number;
    bothChannels: number;
    description: string;
  };
  recommendation: string;
}

export interface TimelinePoint {
  hour: string; // ISO hour string
  webhookCount: number;
  pollingCount: number;
  webhookAvgLatency: number | null;
  pollingAvgLatency: number | null;
}

export interface EventTypeBreakdown {
  eventType: string;
  webhookCount: number;
  pollingCount: number;
  webhookAvgLatency: number | null;
  pollingAvgLatency: number | null;
}

// ─── Record Events ──────────────────────────────────────────────────────────

/**
 * Record a sync event metric to the database.
 * Non-blocking: errors are logged but never thrown.
 */
export async function recordSyncEvent(input: RecordSyncEventInput): Promise<number | null> {
  try {
    const pool = await getRawPool();
    if (!pool) {
      log.warn("[SyncMetrics] Pool unavailable, skipping metric recording");
      return null;
    }

    const eventId = crypto.randomUUID();
    const detectedAt = input.detectedAt ?? Date.now();
    const latencyMs = input.ghlTimestamp ? detectedAt - input.ghlTimestamp : null;

    // @ts-expect-error — property access on loosely typed object
    const [result] = await pool.execute(
      `INSERT INTO sync_event_metrics
        (event_id, location_id, location_db_id, channel, event_type, contact_external_id,
         detected_at, ghl_timestamp, latency_ms, payload_size, success, error_message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        input.locationId ?? null,
        input.locationDbId ?? null,
        input.channel,
        input.eventType,
        input.contactExternalId ?? null,
        detectedAt,
        input.ghlTimestamp ?? null,
        latencyMs,
        input.payloadSize ?? 0,
        input.success !== false ? 1 : 0,
        input.errorMessage ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    return (result as any).insertId ?? null;
  } catch (err: any) {
    log.error({ err }, `[SyncMetrics] Failed to record sync event: ${err.message}`);
    return null;
  }
}

/**
 * Record a webhook event (convenience wrapper).
 */
export async function recordWebhookEvent(opts: {
  eventType: SyncEventType;
  locationId?: string;
  locationDbId?: number;
  contactExternalId?: string;
  ghlTimestamp?: number;
  payloadSize?: number;
  success?: boolean;
  errorMessage?: string;
}): Promise<number | null> {
  return recordSyncEvent({
    channel: "webhook",
    ...opts,
  });
}

/**
 * Record a polling detection event (convenience wrapper).
 */
export async function recordPollingEvent(opts: {
  eventType: SyncEventType;
  locationId?: string;
  locationDbId?: number;
  contactExternalId?: string;
  ghlTimestamp?: number;
  success?: boolean;
  errorMessage?: string;
}): Promise<number | null> {
  return recordSyncEvent({
    channel: "polling",
    ...opts,
  });
}

// ─── Query Metrics ──────────────────────────────────────────────────────────

/**
 * Get metrics for a specific channel within a time range.
 */
export async function getChannelMetrics(
  channel: SyncChannel,
  since?: number,
  locationId?: string,
): Promise<ChannelMetrics> {
  const pool = await getRawPool();
  const empty: ChannelMetrics = {
    channel,
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    successRate: 0,
    avgLatencyMs: null,
    medianLatencyMs: null,
    p95LatencyMs: null,
    minLatencyMs: null,
    maxLatencyMs: null,
    eventsLast1h: 0,
    eventsLast24h: 0,
    lastEventAt: null,
  };

  if (!pool) return empty;

  const conditions = ["channel = ?"];
  const params: unknown[] = [channel];

  if (since) {
    conditions.push("detected_at >= ?");
    params.push(since);
  }
  if (locationId) {
    conditions.push("location_id = ?");
    params.push(locationId);
  }

  const where = conditions.join(" AND ");

  try {
    // Aggregate stats
    // @ts-expect-error — property access on loosely typed object
    const [aggRows] = await pool.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as avg_latency,
        MIN(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as min_latency,
        MAX(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as max_latency,
        MAX(detected_at) as last_event
      FROM sync_event_metrics WHERE ${where}`,
      params,
    );
    const agg = (aggRows as any[])[0] || {};

    // Events in last 1h and 24h
    const now = Date.now();
    // @ts-expect-error — property access on loosely typed object
    const [hourRows] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM sync_event_metrics WHERE ${where} AND detected_at >= ?`,
      [...params, now - 3600000],
    );
    // @ts-expect-error — property access on loosely typed object
    const [dayRows] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM sync_event_metrics WHERE ${where} AND detected_at >= ?`,
      [...params, now - 86400000],
    );

    // Median and P95 latency (approximate via sorted latencies)
    // @ts-expect-error — property access on loosely typed object
    const [latencyRows] = await pool.execute(
      `SELECT latency_ms FROM sync_event_metrics
       WHERE ${where} AND latency_ms IS NOT NULL
       ORDER BY latency_ms ASC`,
      params,
    );
    const latencies = (latencyRows as any[]).map((r) => Number(r.latency_ms));
    const medianLatency = latencies.length > 0
      ? latencies[Math.floor(latencies.length / 2)]
      : null;
    const p95Latency = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.95)]
      : null;

    const total = Number(agg.total) || 0;
    const successful = Number(agg.successful) || 0;

    return {
      channel,
      totalEvents: total,
      successfulEvents: successful,
      failedEvents: Number(agg.failed) || 0,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      avgLatencyMs: agg.avg_latency != null ? Math.round(Number(agg.avg_latency)) : null,
      medianLatencyMs: medianLatency,
      p95LatencyMs: p95Latency,
      minLatencyMs: agg.min_latency != null ? Number(agg.min_latency) : null,
      maxLatencyMs: agg.max_latency != null ? Number(agg.max_latency) : null,
      eventsLast1h: Number((hourRows as any[])[0]?.cnt) || 0,
      eventsLast24h: Number((dayRows as any[])[0]?.cnt) || 0,
      lastEventAt: agg.last_event ? Number(agg.last_event) : null,
    };
  } catch (err: any) {
    log.error({ err }, `[SyncMetrics] Failed to get channel metrics: ${err.message}`);
    return empty;
  }
}

/**
 * Get a full comparison between webhook and polling channels.
 */
export async function getChannelComparison(
  since?: number,
  locationId?: string,
): Promise<ChannelComparison> {
  const webhook = await getChannelMetrics("webhook", since, locationId);
  const polling = await getChannelMetrics("polling", since, locationId);

  // Determine latency advantage
  let latencyAdvantage: ChannelComparison["latencyAdvantage"];
  if (webhook.avgLatencyMs != null && polling.avgLatencyMs != null) {
    const diff = Math.abs(webhook.avgLatencyMs - polling.avgLatencyMs);
    if (webhook.avgLatencyMs < polling.avgLatencyMs) {
      latencyAdvantage = {
        channel: "webhook",
        differenceMs: diff,
        description: `Webhooks are ${formatDuration(diff)} faster on average`,
      };
    } else if (polling.avgLatencyMs < webhook.avgLatencyMs) {
      latencyAdvantage = {
        channel: "polling",
        differenceMs: diff,
        description: `Polling is ${formatDuration(diff)} faster on average`,
      };
    } else {
      latencyAdvantage = { channel: "tie", differenceMs: 0, description: "Both channels have equal latency" };
    }
  } else if (webhook.avgLatencyMs != null) {
    latencyAdvantage = { channel: "webhook", differenceMs: 0, description: "Only webhook has latency data" };
  } else if (polling.avgLatencyMs != null) {
    latencyAdvantage = { channel: "polling", differenceMs: 0, description: "Only polling has latency data" };
  } else {
    latencyAdvantage = { channel: "tie", differenceMs: 0, description: "No latency data available yet" };
  }

  // Coverage comparison (contacts detected by each channel)
  const coverage = await getCoverageComparison(since, locationId);

  // Generate recommendation
  const recommendation = generateRecommendation(webhook, polling, latencyAdvantage);

  return {
    webhook,
    polling,
    latencyAdvantage,
    coverageComparison: coverage,
    recommendation,
  };
}

/**
 * Get hourly timeline data for the last 24 hours.
 */
export async function getHourlyTimeline(
  since?: number,
  locationId?: string,
): Promise<TimelinePoint[]> {
  const pool = await getRawPool();
  if (!pool) return [];

  const cutoff = since ?? Date.now() - 86400000; // default: last 24h
  const conditions = ["detected_at >= ?"];
  const params: unknown[] = [cutoff];

  if (locationId) {
    conditions.push("location_id = ?");
    params.push(locationId);
  }

  const where = conditions.join(" AND ");

  try {
    // @ts-expect-error — property access on loosely typed object
    const [rows] = await pool.execute(
      `SELECT
        DATE_FORMAT(FROM_UNIXTIME(detected_at / 1000), '%Y-%m-%d %H:00') as hour_bucket,
        channel,
        COUNT(*) as event_count,
        AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as avg_latency
      FROM sync_event_metrics
      WHERE ${where}
      GROUP BY hour_bucket, channel
      ORDER BY hour_bucket ASC`,
      params,
    );

    // Merge webhook and polling data per hour
    const hourMap = new Map<string, TimelinePoint>();
    for (const row of rows as any[]) {
      const hour = row.hour_bucket;
      if (!hourMap.has(hour)) {
        hourMap.set(hour, {
          hour,
          webhookCount: 0,
          pollingCount: 0,
          webhookAvgLatency: null,
          pollingAvgLatency: null,
        });
      }
      const point = hourMap.get(hour)!;
      if (row.channel === "webhook") {
        point.webhookCount = Number(row.event_count);
        point.webhookAvgLatency = row.avg_latency != null ? Math.round(Number(row.avg_latency)) : null;
      } else {
        point.pollingCount = Number(row.event_count);
        point.pollingAvgLatency = row.avg_latency != null ? Math.round(Number(row.avg_latency)) : null;
      }
    }

    return [...hourMap.values()];
  } catch (err: any) {
    log.error({ err }, `[SyncMetrics] Failed to get hourly timeline: ${err.message}`);
    return [];
  }
}

/**
 * Get event type breakdown by channel.
 */
export async function getEventTypeBreakdown(
  since?: number,
  locationId?: string,
): Promise<EventTypeBreakdown[]> {
  const pool = await getRawPool();
  if (!pool) return [];

  const cutoff = since ?? Date.now() - 86400000;
  const conditions = ["detected_at >= ?"];
  const params: unknown[] = [cutoff];

  if (locationId) {
    conditions.push("location_id = ?");
    params.push(locationId);
  }

  const where = conditions.join(" AND ");

  try {
    // @ts-expect-error — property access on loosely typed object
    const [rows] = await pool.execute(
      `SELECT
        event_type,
        channel,
        COUNT(*) as cnt,
        AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as avg_latency
      FROM sync_event_metrics
      WHERE ${where}
      GROUP BY event_type, channel
      ORDER BY event_type ASC`,
      params,
    );

    const typeMap = new Map<string, EventTypeBreakdown>();
    for (const row of rows as any[]) {
      const et = row.event_type;
      if (!typeMap.has(et)) {
        typeMap.set(et, {
          eventType: et,
          webhookCount: 0,
          pollingCount: 0,
          webhookAvgLatency: null,
          pollingAvgLatency: null,
        });
      }
      const entry = typeMap.get(et)!;
      if (row.channel === "webhook") {
        entry.webhookCount = Number(row.cnt);
        entry.webhookAvgLatency = row.avg_latency != null ? Math.round(Number(row.avg_latency)) : null;
      } else {
        entry.pollingCount = Number(row.cnt);
        entry.pollingAvgLatency = row.avg_latency != null ? Math.round(Number(row.avg_latency)) : null;
      }
    }

    return [...typeMap.values()];
  } catch (err: any) {
    log.error({ err }, `[SyncMetrics] Failed to get event type breakdown: ${err.message}`);
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getCoverageComparison(
  since?: number,
  locationId?: string,
): Promise<ChannelComparison["coverageComparison"]> {
  const pool = await getRawPool();
  if (!pool) {
    return { webhookOnly: 0, pollingOnly: 0, bothChannels: 0, description: "No data available" };
  }

  const cutoff = since ?? Date.now() - 86400000;
  const conditions = ["detected_at >= ?"];
  const params: unknown[] = [cutoff];

  if (locationId) {
    conditions.push("location_id = ?");
    params.push(locationId);
  }

  const where = conditions.join(" AND ");

  try {
    // Get unique contact IDs per channel
    // @ts-expect-error — property access on loosely typed object
    const [webhookContacts] = await pool.execute(
      `SELECT DISTINCT contact_external_id FROM sync_event_metrics
       WHERE ${where} AND channel = 'webhook' AND contact_external_id IS NOT NULL`,
      params,
    );
    // @ts-expect-error — property access on loosely typed object
    const [pollingContacts] = await pool.execute(
      `SELECT DISTINCT contact_external_id FROM sync_event_metrics
       WHERE ${where} AND channel = 'polling' AND contact_external_id IS NOT NULL`,
      params,
    );

    const webhookSet = new Set((webhookContacts as any[]).map((r) => r.contact_external_id));
    const pollingSet = new Set((pollingContacts as any[]).map((r) => r.contact_external_id));

    let webhookOnly = 0;
    let pollingOnly = 0;
    let bothChannels = 0;

    for (const id of webhookSet) {
      if (pollingSet.has(id)) bothChannels++;
      else webhookOnly++;
    }
    for (const id of pollingSet) {
      if (!webhookSet.has(id)) pollingOnly++;
    }

    const total = webhookOnly + pollingOnly + bothChannels;
    const description = total === 0
      ? "No contact events recorded yet"
      : `${bothChannels} contacts detected by both channels, ${webhookOnly} webhook-only, ${pollingOnly} polling-only`;

    return { webhookOnly, pollingOnly, bothChannels, description };
  } catch (err: any) {
    log.error({ err }, `[SyncMetrics] Failed to get coverage comparison: ${err.message}`);
    return { webhookOnly: 0, pollingOnly: 0, bothChannels: 0, description: "Error computing coverage" };
  }
}

function generateRecommendation(
  webhook: ChannelMetrics,
  polling: ChannelMetrics,
  latencyAdvantage: ChannelComparison["latencyAdvantage"],
): string {
  // No data yet
  if (webhook.totalEvents === 0 && polling.totalEvents === 0) {
    return "No sync events recorded yet. Configure GHL webhooks or enable polling to start collecting metrics.";
  }

  // Only polling active
  if (webhook.totalEvents === 0 && polling.totalEvents > 0) {
    return "Only polling is active. Consider configuring GHL webhooks for faster event detection. Use the GHL Webhook Setup page to configure webhooks manually.";
  }

  // Only webhooks active
  if (webhook.totalEvents > 0 && polling.totalEvents === 0) {
    return "Only webhooks are active. Consider enabling polling as a fallback to catch any events that webhooks might miss.";
  }

  // Both active
  if (latencyAdvantage.channel === "webhook" && latencyAdvantage.differenceMs > 30000) {
    return `Webhooks are significantly faster (${formatDuration(latencyAdvantage.differenceMs)} advantage). Keep polling enabled as a safety net but rely primarily on webhooks for real-time sync.`;
  }

  if (latencyAdvantage.channel === "polling" && latencyAdvantage.differenceMs > 30000) {
    return `Polling is unexpectedly faster. This may indicate webhook delivery delays. Check webhook configuration and GHL webhook health.`;
  }

  if (webhook.successRate < 90) {
    return `Webhook success rate is low (${webhook.successRate}%). Investigate webhook errors and ensure the endpoint is accessible. Polling provides reliable fallback coverage.`;
  }

  return "Both channels are operating well. Webhooks provide real-time detection while polling ensures complete coverage. This is the recommended configuration.";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
