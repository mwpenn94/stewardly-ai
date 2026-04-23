/**
 * Row-Level Security — Tenant filtering and row ownership enforcement
 * Split from mfaService.ts for single-responsibility
 */

export interface RowSecurityContext {
  userId: number;
  orgId?: number;
  role: "admin" | "user";
}

/**
 * Check if a user has access to a specific row based on ownership
 */
export function enforceRowSecurity(ctx: RowSecurityContext, row: { userId?: number; orgId?: number; organizationId?: number }): boolean {
  if (ctx.role === "admin") return true;
  if (row.userId && row.userId === ctx.userId) return true;
  if (row.orgId && ctx.orgId && row.orgId === ctx.orgId) return true;
  if (row.organizationId && ctx.orgId && row.organizationId === ctx.orgId) return true;
  return false;
}

/**
 * Build a WHERE clause filter for tenant-scoped queries
 */
export function buildTenantFilter(ctx: RowSecurityContext): { userId?: number; orgId?: number } {
  if (ctx.role === "admin") return {};
  return { userId: ctx.userId, ...(ctx.orgId ? { orgId: ctx.orgId } : {}) };
}

/**
 * Assert row-level access — throws if denied
 */
export function assertRowAccess(ctx: RowSecurityContext, row: { userId?: number; orgId?: number; organizationId?: number }, resourceName = "resource"): void {
  if (!enforceRowSecurity(ctx, row)) {
    throw new Error(`Access denied: you do not have permission to access this ${resourceName}`);
  }
}
