/**
 * Task #37 — Dynamic Permission Boundaries Service
 * Runtime permission evaluation with context-aware access control
 */
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";

export interface PermissionContext {
  userId: number;
  role: string;
  organizationId?: number;
  orgRole?: string;
  action: string;
  resource: string;
  resourceOwnerId?: number;
  metadata?: Record<string, any>;
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
  conditions?: string[];
  auditRequired?: boolean;
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100, global_admin: 100,
  manager: 80, org_admin: 80,
  advisor: 60, professional: 60,
  user: 40,
  anonymous: 10,
};

const RESOURCE_PERMISSIONS: Record<string, Record<string, number>> = {
  conversation: { read: 40, write: 40, delete: 60, admin: 80 },
  document: { read: 40, write: 40, delete: 60, admin: 80, share: 60 },
  product: { read: 10, write: 60, delete: 80, admin: 100 },
  calculator: { read: 10, execute: 40, configure: 80, admin: 100 },
  model: { read: 40, execute: 60, configure: 80, admin: 100 },
  knowledge: { read: 10, write: 60, approve: 80, admin: 100 },
  user: { read_self: 10, read_others: 60, write_self: 40, write_others: 80, admin: 100 },
  organization: { read: 40, write: 80, admin: 100 },
  compliance: { read: 60, write: 80, admin: 100 },
  report: { read: 40, generate: 60, admin: 100 },
  settings: { read_self: 40, write_self: 40, read_org: 80, write_org: 80, admin: 100 },
};

export function evaluatePermission(ctx: PermissionContext): PermissionResult {
  const roleLevel = ROLE_HIERARCHY[ctx.role] ?? ROLE_HIERARCHY[ctx.orgRole ?? "user"] ?? 40;
  const resourcePerms = RESOURCE_PERMISSIONS[ctx.resource];
  if (!resourcePerms) {
    return { allowed: false, reason: `Unknown resource: ${ctx.resource}` };
  }

  const requiredLevel = resourcePerms[ctx.action];
  if (requiredLevel === undefined) {
    return { allowed: false, reason: `Unknown action: ${ctx.action} on ${ctx.resource}` };
  }

  // Self-access override
  if (ctx.resourceOwnerId === ctx.userId && ctx.action.includes("self")) {
    return { allowed: true, reason: "Self-access granted" };
  }

  if (roleLevel >= requiredLevel) {
    const auditRequired = requiredLevel >= 80;
    return {
      allowed: true,
      reason: `Role ${ctx.role} (level ${roleLevel}) meets requirement (${requiredLevel})`,
      auditRequired,
      conditions: auditRequired ? ["Action will be logged to audit trail"] : [],
    };
  }

  return {
    allowed: false,
    reason: `Insufficient permissions: ${ctx.role} (level ${roleLevel}) < required (${requiredLevel})`,
  };
}

export function getAvailableActions(role: string, resource: string): string[] {
  const roleLevel = ROLE_HIERARCHY[role] ?? 40;
  const resourcePerms = RESOURCE_PERMISSIONS[resource];
  if (!resourcePerms) return [];
  return Object.entries(resourcePerms)
    .filter(([_, level]) => roleLevel >= level)
    .map(([action]) => action);
}

export function getAllResources(): string[] {
  return Object.keys(RESOURCE_PERMISSIONS);
}

export function getRoleHierarchy(): Record<string, number> {
  return { ...ROLE_HIERARCHY };
}
