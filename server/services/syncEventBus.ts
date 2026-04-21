/**
 * Sync Event Bus — Server-Sent Events (SSE) for real-time sync streaming
 *
 * Architecture:
 * - In-memory pub/sub with channel-based routing
 * - Channels: "global" (all events) + "location:{id}" (per-location)
 * - Heartbeat every 30s to keep connections alive
 * - Auto-cleanup on client disconnect
 * - Event types: webhook_received, contact_synced, reconcile_progress,
 *   reconcile_complete, location_provisioned, sync_error
 */

import type { Response } from "express";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SyncEvent {
  type:
    | "webhook_received"
    | "contact_synced"
    | "reconcile_progress"
    | "reconcile_complete"
    | "location_provisioned"
    | "sync_error"
    | "heartbeat";
  locationId?: number;       // internal DB id
  ghlLocationId?: string;    // GHL location ID
  locationName?: string;
  timestamp: number;         // epoch ms
  data: Record<string, any>;
}

interface SSEClient {
  id: string;
  res: Response;
  userId: number;
  locationIds: number[];     // empty = global (admin sees all)
  connectedAt: number;
}

// ─── Event Bus Singleton ───────────────────────────────────────────────────

const clients = new Map<string, SSEClient>();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_MS = 30_000;
const MAX_CLIENTS = 500;

/** Generate a unique client ID */
function makeClientId(): string {
  return `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Format an SSE message string */
function formatSSE(event: string, data: string, id?: string): string {
  let msg = "";
  if (id) msg += `id: ${id}\n`;
  msg += `event: ${event}\n`;
  msg += `data: ${data}\n\n`;
  return msg;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Register a new SSE client connection.
 * Sets up headers, heartbeat, and cleanup on disconnect.
 */
export function addClient(
  res: Response,
  userId: number,
  locationIds: number[],
): string {
  if (clients.size >= MAX_CLIENTS) {
    // Evict oldest client
    const oldest = [...clients.entries()].sort(
      ([, a], [, b]) => a.connectedAt - b.connectedAt,
    )[0];
    if (oldest) {
      oldest[1].res.end();
      clients.delete(oldest[0]);
    }
  }

  const id = makeClientId();

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial connection event
  res.write(
    formatSSE(
      "connected",
      JSON.stringify({ clientId: id, timestamp: Date.now() }),
      "0",
    ),
  );

  const client: SSEClient = {
    id,
    res,
    userId,
    locationIds,
    connectedAt: Date.now(),
  };
  clients.set(id, client);

  // Cleanup on disconnect
  res.on("close", () => {
    clients.delete(id);
  });

  // Start heartbeat if not running
  if (!heartbeatInterval && clients.size > 0) {
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);
  }

  return id;
}

/**
 * Remove a client by ID (e.g., on explicit disconnect).
 */
export function removeClient(id: string): void {
  const client = clients.get(id);
  if (client) {
    client.res.end();
    clients.delete(id);
  }
  if (clients.size === 0 && heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Emit a sync event to all matching clients.
 * - Global events (no locationId) go to all clients
 * - Location-scoped events go to clients subscribed to that location
 * - Admin clients (empty locationIds) receive all events
 */
export function emitSyncEvent(event: SyncEvent): void {
  if (clients.size === 0) return;

  const eventStr = formatSSE(
    event.type,
    JSON.stringify(event),
    `${event.timestamp}`,
  );

  for (const [, client] of clients) {
    try {
      // Admin (empty locationIds) sees everything
      if (client.locationIds.length === 0) {
        client.res.write(eventStr);
        continue;
      }
      // Global events go to everyone
      if (!event.locationId) {
        client.res.write(eventStr);
        continue;
      }
      // Location-scoped: only if client is subscribed
      if (client.locationIds.includes(event.locationId)) {
        client.res.write(eventStr);
      }
    } catch {
      // Client disconnected, clean up
      clients.delete(client.id);
    }
  }
}

/**
 * Send heartbeat to all connected clients.
 */
function sendHeartbeat(): void {
  const heartbeat: SyncEvent = {
    type: "heartbeat",
    timestamp: Date.now(),
    data: { clients: clients.size },
  };
  emitSyncEvent(heartbeat);

  // Stop heartbeat if no clients
  if (clients.size === 0 && heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Get current connection stats.
 */
export function getSSEStats(): {
  connectedClients: number;
  oldestConnection: number | null;
} {
  const oldest = [...clients.values()].sort(
    (a, b) => a.connectedAt - b.connectedAt,
  )[0];
  return {
    connectedClients: clients.size,
    oldestConnection: oldest?.connectedAt ?? null,
  };
}

// ─── Convenience Emitters ──────────────────────────────────────────────────

/** Emit when a webhook event is received */
export function emitWebhookReceived(opts: {
  locationId?: number;
  ghlLocationId?: string;
  locationName?: string;
  eventType: string;
  contactId?: string;
  contactName?: string;
}) {
  emitSyncEvent({
    type: "webhook_received",
    locationId: opts.locationId,
    ghlLocationId: opts.ghlLocationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: {
      eventType: opts.eventType,
      contactId: opts.contactId,
      contactName: opts.contactName,
    },
  });
}

/** Emit when a contact is synced (created/updated/linked) */
export function emitContactSynced(opts: {
  locationId?: number;
  locationName?: string;
  action: "created" | "updated" | "linked" | "deleted";
  contactName?: string;
  direction: "inbound" | "outbound";
}) {
  emitSyncEvent({
    type: "contact_synced",
    locationId: opts.locationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: {
      action: opts.action,
      contactName: opts.contactName,
      direction: opts.direction,
    },
  });
}

/** Emit reconciliation progress */
export function emitReconcileProgress(opts: {
  locationId?: number;
  locationName?: string;
  processed: number;
  total: number;
  matched: number;
  created: number;
  errors: number;
}) {
  emitSyncEvent({
    type: "reconcile_progress",
    locationId: opts.locationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: {
      processed: opts.processed,
      total: opts.total,
      matched: opts.matched,
      created: opts.created,
      errors: opts.errors,
      pct: opts.total > 0 ? Math.round((opts.processed / opts.total) * 100) : 0,
    },
  });
}

/** Emit reconciliation complete */
export function emitReconcileComplete(opts: {
  locationId?: number;
  locationName?: string;
  stats: Record<string, any>;
  durationMs: number;
}) {
  emitSyncEvent({
    type: "reconcile_complete",
    locationId: opts.locationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: {
      stats: opts.stats,
      durationMs: opts.durationMs,
    },
  });
}

/** Emit location provisioned */
export function emitLocationProvisioned(opts: {
  locationId: number;
  ghlLocationId: string;
  locationName: string;
  action: "created" | "reactivated" | "already_exists";
}) {
  emitSyncEvent({
    type: "location_provisioned",
    locationId: opts.locationId,
    ghlLocationId: opts.ghlLocationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: { action: opts.action },
  });
}

/** Emit sync error */
export function emitSyncError(opts: {
  locationId?: number;
  locationName?: string;
  error: string;
  context: string;
}) {
  emitSyncEvent({
    type: "sync_error",
    locationId: opts.locationId,
    locationName: opts.locationName,
    timestamp: Date.now(),
    data: { error: opts.error, context: opts.context },
  });
}
