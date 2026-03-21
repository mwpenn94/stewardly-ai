/**
 * Task #53 — CRM Sync Service
 * Bidirectional sync with external CRM systems (Salesforce, HubSpot, etc.)
 */

export interface CRMConnection {
  id: string;
  provider: "salesforce" | "hubspot" | "dynamics" | "zoho" | "custom";
  status: "connected" | "disconnected" | "error" | "syncing";
  lastSyncAt?: string;
  syncDirection: "inbound" | "outbound" | "bidirectional";
  fieldMappings: Array<{ localField: string; remoteField: string; direction: "in" | "out" | "both" }>;
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  recordsSynced: number;
  errors: number;
}

export interface SyncResult {
  connectionId: string;
  startedAt: string;
  completedAt: string;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: Array<{ record: string; error: string }>;
  status: "success" | "partial" | "failed";
}

// In-memory connections
const connections = new Map<string, CRMConnection>();

export function createConnection(data: {
  provider: CRMConnection["provider"];
  syncDirection: CRMConnection["syncDirection"];
  syncFrequency: CRMConnection["syncFrequency"];
  fieldMappings?: CRMConnection["fieldMappings"];
}): CRMConnection {
  const conn: CRMConnection = {
    id: `crm_${Date.now()}`,
    provider: data.provider,
    status: "connected",
    syncDirection: data.syncDirection,
    fieldMappings: data.fieldMappings ?? getDefaultMappings(data.provider),
    syncFrequency: data.syncFrequency,
    recordsSynced: 0,
    errors: 0,
  };
  connections.set(conn.id, conn);
  return conn;
}

function getDefaultMappings(provider: string): CRMConnection["fieldMappings"] {
  return [
    { localField: "name", remoteField: "Name", direction: "both" },
    { localField: "email", remoteField: "Email", direction: "both" },
    { localField: "phone", remoteField: "Phone", direction: "both" },
    { localField: "company", remoteField: "Company", direction: "in" },
    { localField: "riskTolerance", remoteField: "Risk_Tolerance__c", direction: "out" },
    { localField: "suitabilityScore", remoteField: "Suitability_Score__c", direction: "out" },
    { localField: "lastInteraction", remoteField: "Last_Activity_Date", direction: "out" },
  ];
}

export function getConnection(id: string): CRMConnection | null {
  return connections.get(id) ?? null;
}

export function listConnections(): CRMConnection[] {
  return Array.from(connections.values());
}

export function updateConnection(id: string, updates: Partial<CRMConnection>): CRMConnection | null {
  const conn = connections.get(id);
  if (!conn) return null;
  Object.assign(conn, updates);
  return conn;
}

export function deleteConnection(id: string): boolean {
  return connections.delete(id);
}

export function simulateSync(connectionId: string): SyncResult {
  const conn = connections.get(connectionId);
  if (!conn) throw new Error("Connection not found");

  conn.status = "syncing";
  const result: SyncResult = {
    connectionId,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    recordsCreated: Math.floor(Math.random() * 10),
    recordsUpdated: Math.floor(Math.random() * 50),
    recordsSkipped: Math.floor(Math.random() * 5),
    errors: [],
    status: "success",
  };

  conn.status = "connected";
  conn.lastSyncAt = result.completedAt;
  conn.recordsSynced += result.recordsCreated + result.recordsUpdated;

  return result;
}

export function getSyncStats(): {
  totalConnections: number;
  activeConnections: number;
  totalRecordsSynced: number;
  totalErrors: number;
  byProvider: Record<string, number>;
} {
  const conns = Array.from(connections.values());
  const byProvider: Record<string, number> = {};
  for (const c of conns) {
    byProvider[c.provider] = (byProvider[c.provider] ?? 0) + 1;
  }

  return {
    totalConnections: conns.length,
    activeConnections: conns.filter(c => c.status === "connected").length,
    totalRecordsSynced: conns.reduce((s, c) => s + c.recordsSynced, 0),
    totalErrors: conns.reduce((s, c) => s + c.errors, 0),
    byProvider,
  };
}
