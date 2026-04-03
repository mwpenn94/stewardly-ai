/**
 * Multi-Tenant Context — AsyncLocalStorage-based per-request isolation
 */
import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  tenantId: number | null;
  userId: number;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

export function getCurrentTenant(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** Tables that require tenant isolation (WHERE organizationId = tenantId) */
const TENANT_SCOPED_TABLES = new Set([
  "conversations", "messages", "documents", "document_chunks",
  "user_profiles", "insurance_quotes", "compliance_events",
  "suitability_profiles", "client_associations", "calculator_scenarios",
  "email_campaigns", "email_campaign_sends", "meeting_notes",
  "propagation_events", "propagation_actions",
]);

/** Tables that are global/system-level (no tenant scoping) */
const GLOBAL_TABLES = new Set([
  "users", "sessions", "platform_ai_settings", "integration_providers",
  "feature_flags", "knowledge_articles", "products", "audit_trail",
  "market_data_cache", "data_sources",
]);

export function isTenantScoped(tableName: string): boolean {
  return TENANT_SCOPED_TABLES.has(tableName);
}

export function isGlobalTable(tableName: string): boolean {
  return GLOBAL_TABLES.has(tableName);
}
