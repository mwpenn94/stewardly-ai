import { getDb } from "../db";
import { featurePermissions, permissionAuditLog, contentShares, viewShares } from "../../drizzle/schema";
import { eq, and, or, isNull } from "drizzle-orm";

// ─── Feature Registry ─────────────────────────────────────────────────────
export const FEATURE_REGISTRY: Record<string, { label: string; category: string; defaultEnabled: boolean; defaultDisclosure: number }> = {
  // Person layer
  "chat": { label: "AI Chat", category: "person", defaultEnabled: true, defaultDisclosure: 1 },
  "code_chat": { label: "Code Chat", category: "person", defaultEnabled: true, defaultDisclosure: 2 },
  "documents": { label: "Documents", category: "person", defaultEnabled: true, defaultDisclosure: 1 },
  "audio_studio": { label: "Audio Studio", category: "person", defaultEnabled: true, defaultDisclosure: 2 },
  "my_progress": { label: "My Progress", category: "person", defaultEnabled: true, defaultDisclosure: 1 },
  // Client layer
  "financial_twin": { label: "Financial Twin", category: "client", defaultEnabled: true, defaultDisclosure: 1 },
  "insights": { label: "Insights", category: "client", defaultEnabled: true, defaultDisclosure: 1 },
  "financial_planning": { label: "Financial Planning", category: "client", defaultEnabled: true, defaultDisclosure: 2 },
  "market_data": { label: "Market Data", category: "client", defaultEnabled: true, defaultDisclosure: 2 },
  "tax_planning": { label: "Tax Planning", category: "client", defaultEnabled: true, defaultDisclosure: 3 },
  "estate_planning": { label: "Estate Planning", category: "client", defaultEnabled: true, defaultDisclosure: 3 },
  "income_projection": { label: "Income Projection", category: "client", defaultEnabled: true, defaultDisclosure: 3 },
  // Advisor layer
  "client_management": { label: "Client Management", category: "advisor", defaultEnabled: true, defaultDisclosure: 2 },
  "email_campaigns": { label: "Email Campaigns", category: "advisor", defaultEnabled: true, defaultDisclosure: 3 },
  "compliance_audit": { label: "Compliance Audit", category: "advisor", defaultEnabled: true, defaultDisclosure: 3 },
  "integrations": { label: "Integrations", category: "advisor", defaultEnabled: true, defaultDisclosure: 2 },
  // Manager layer
  "manager_dashboard": { label: "Manager Dashboard", category: "manager", defaultEnabled: true, defaultDisclosure: 2 },
  "agent_manager": { label: "Agent Manager", category: "manager", defaultEnabled: true, defaultDisclosure: 3 },
  "api_keys": { label: "API Keys", category: "manager", defaultEnabled: true, defaultDisclosure: 4 },
  // Steward layer
  "admin_system_health": { label: "System Health", category: "steward", defaultEnabled: true, defaultDisclosure: 4 },
  "admin_user_management": { label: "User Management", category: "steward", defaultEnabled: true, defaultDisclosure: 4 },
  "billing": { label: "Billing", category: "steward", defaultEnabled: true, defaultDisclosure: 2 },
};

// ─── Permission Resolution ────────────────────────────────────────────────
export async function resolveFeaturePermission(
  userId: number,
  featureId: string,
  orgId?: number,
  userRole?: string
): Promise<{ enabled: boolean; disclosureCeiling: number; source: string }> {
  const registry = FEATURE_REGISTRY[featureId];
  const defaultResult = {
    enabled: registry?.defaultEnabled ?? true,
    disclosureCeiling: registry?.defaultDisclosure ?? 4,
    source: "default",
  };

  try {
    const db = (await getDb())!;
    // Check user-specific permission first (highest priority)
    const [userPerm] = await db
      .select()
      .from(featurePermissions)
      .where(and(eq(featurePermissions.userId, userId), eq(featurePermissions.featureId, featureId)))
      .limit(1);

    if (userPerm) {
      return {
        enabled: userPerm.enabled,
        disclosureCeiling: userPerm.disclosureCeiling,
        source: "user",
      };
    }

    // Check org-level permission
    if (orgId) {
      const [orgPerm] = await db
        .select()
        .from(featurePermissions)
        .where(and(eq(featurePermissions.orgId, orgId), eq(featurePermissions.featureId, featureId), isNull(featurePermissions.userId)))
        .limit(1);

      if (orgPerm) {
        return {
          enabled: orgPerm.enabled,
          disclosureCeiling: orgPerm.disclosureCeiling,
          source: "org",
        };
      }
    }

    // Check role-level permission
    if (userRole) {
      const [rolePerm] = await db
        .select()
        .from(featurePermissions)
        .where(and(
          eq(featurePermissions.roleScope, userRole as any),
          eq(featurePermissions.featureId, featureId),
          isNull(featurePermissions.userId),
          isNull(featurePermissions.orgId)
        ))
        .limit(1);

      if (rolePerm) {
        return {
          enabled: rolePerm.enabled,
          disclosureCeiling: rolePerm.disclosureCeiling,
          source: "role",
        };
      }
    }

    return defaultResult;
  } catch {
    return defaultResult;
  }
}

// ─── Batch Permission Resolution ──────────────────────────────────────────
export async function resolveAllFeaturePermissions(
  userId: number,
  orgId?: number,
  userRole?: string
): Promise<Record<string, { enabled: boolean; disclosureCeiling: number; source: string }>> {
  const result: Record<string, { enabled: boolean; disclosureCeiling: number; source: string }> = {};

  for (const featureId of Object.keys(FEATURE_REGISTRY)) {
    result[featureId] = await resolveFeaturePermission(userId, featureId, orgId, userRole);
  }

  return result;
}

// ─── Permission CRUD with Audit ───────────────────────────────────────────
export async function setFeaturePermission(params: {
  actorId: number;
  targetUserId?: number;
  targetOrgId?: number;
  roleScope?: string;
  featureId: string;
  enabled: boolean;
  disclosureCeiling?: number;
  reason?: string;
}) {
  const { actorId, targetUserId, targetOrgId, roleScope, featureId, enabled, disclosureCeiling = 4, reason } = params;
  const db = (await getDb())!;

  // Get previous value for audit
  let previousValue: string | null = null;
  if (targetUserId) {
    const [existing] = await db
      .select()
      .from(featurePermissions)
      .where(and(eq(featurePermissions.userId, targetUserId), eq(featurePermissions.featureId, featureId)))
      .limit(1);
    if (existing) {
      previousValue = JSON.stringify({ enabled: existing.enabled, disclosureCeiling: existing.disclosureCeiling });
    }
  }

  // Upsert the permission
  if (targetUserId) {
    const [existing] = await db
      .select()
      .from(featurePermissions)
      .where(and(eq(featurePermissions.userId, targetUserId), eq(featurePermissions.featureId, featureId)))
      .limit(1);

    if (existing) {
      await db.update(featurePermissions)
        .set({ enabled, disclosureCeiling, grantedBy: actorId, reason })
        .where(eq(featurePermissions.id, existing.id));
    } else {
      await db.insert(featurePermissions).values({
        userId: targetUserId,
        orgId: targetOrgId,
        roleScope: roleScope as any,
        featureId,
        enabled,
        disclosureCeiling,
        grantedBy: actorId,
        reason,
      });
    }
  } else if (targetOrgId) {
    await db.insert(featurePermissions).values({
      orgId: targetOrgId,
      roleScope: roleScope as any,
      featureId,
      enabled,
      disclosureCeiling,
      grantedBy: actorId,
      reason,
    });
  }

  // Write audit log
  await db.insert(permissionAuditLog).values({
    actorId,
    targetUserId: targetUserId ?? null,
    targetOrgId: targetOrgId ?? null,
    actionType: previousValue ? "update_permission" : "grant_permission",
    featureId,
    previousValue,
    newValue: JSON.stringify({ enabled, disclosureCeiling }),
    reason,
    metadata: JSON.stringify({ roleScope }),
  });

  return { success: true };
}

// ─── Sharing Service ──────────────────────────────────────────────────────
export async function createContentShare(params: {
  contentType: string;
  contentId: string;
  ownerId: number;
  sharedWithUserId?: number;
  sharedWithOrgId?: number;
  sharedWithRole?: string;
  permissionLevel?: string;
  expiresAt?: Date;
}) {
  const db = (await getDb())!;
  const [share] = await db.insert(contentShares).values({
    contentType: params.contentType,
    contentId: params.contentId,
    ownerId: params.ownerId,
    sharedWithUserId: params.sharedWithUserId ?? null,
    sharedWithOrgId: params.sharedWithOrgId ?? null,
    sharedWithRole: params.sharedWithRole as any ?? null,
    permissionLevel: (params.permissionLevel as any) ?? "view",
    expiresAt: params.expiresAt ?? null,
  }).$returningId();

  // Audit log
  await db.insert(permissionAuditLog).values({
    actorId: params.ownerId,
    targetUserId: params.sharedWithUserId ?? null,
    targetOrgId: params.sharedWithOrgId ?? null,
    actionType: "share_content",
    featureId: `${params.contentType}:${params.contentId}`,
    newValue: JSON.stringify({ permissionLevel: params.permissionLevel ?? "view" }),
  });

  return share;
}

export async function getContentShares(contentType: string, contentId: string) {
  const db = (await getDb())!;
  return db
    .select()
    .from(contentShares)
    .where(and(
      eq(contentShares.contentType, contentType),
      eq(contentShares.contentId, contentId),
      isNull(contentShares.revokedAt)
    ));
}

export async function revokeContentShare(shareId: number, actorId: number) {
  const db = (await getDb())!;
  const [share] = await db
    .select()
    .from(contentShares)
    .where(eq(contentShares.id, shareId))
    .limit(1);

  if (!share) throw new Error("Share not found");

  await db.update(contentShares)
    .set({ revokedAt: new Date() })
    .where(eq(contentShares.id, shareId));

  await db.insert(permissionAuditLog).values({
    actorId,
    targetUserId: share.sharedWithUserId,
    targetOrgId: share.sharedWithOrgId,
    actionType: "revoke_share",
    featureId: `${share.contentType}:${share.contentId}`,
    previousValue: JSON.stringify({ permissionLevel: share.permissionLevel }),
  });

  return { success: true };
}

export async function checkContentAccess(
  contentType: string,
  contentId: string,
  userId: number,
  userRole?: string,
  orgId?: number
): Promise<{ hasAccess: boolean; permissionLevel: string | null }> {
  const db = (await getDb())!;
  const shares = await db
    .select()
    .from(contentShares)
    .where(and(
      eq(contentShares.contentType, contentType),
      eq(contentShares.contentId, contentId),
      isNull(contentShares.revokedAt),
      or(
        eq(contentShares.ownerId, userId),
        eq(contentShares.sharedWithUserId, userId),
        orgId ? eq(contentShares.sharedWithOrgId, orgId) : undefined,
        userRole ? eq(contentShares.sharedWithRole, userRole as any) : undefined
      )
    ));

  if (shares.length === 0) return { hasAccess: false, permissionLevel: null };

  // Return highest permission level
  const levels = ["view", "comment", "edit", "admin"];
  let highest = "view";
  for (const share of shares) {
    if (share.ownerId === userId) return { hasAccess: true, permissionLevel: "admin" };
    if (levels.indexOf(share.permissionLevel) > levels.indexOf(highest)) {
      highest = share.permissionLevel;
    }
  }

  return { hasAccess: true, permissionLevel: highest };
}

// ─── View Tracking ───────────────────────────────────────────────────────
export async function trackContentView(params: {
  shareId: number;
  viewerId: number;
  viewerIp?: string;
  viewerUserAgent?: string;
}) {
  const db = (await getDb())!;
  await db.insert(viewShares).values({
    // @ts-expect-error — overload resolution mismatch
    shareId: params.shareId,
    viewerId: params.viewerId,
    viewerIp: params.viewerIp ?? null,
    viewerUserAgent: params.viewerUserAgent ?? null,
  });
  return { tracked: true };
}

export async function getShareViewCount(shareId: number): Promise<number> {
  const db = (await getDb())!;
  const views = await db
    .select()
    .from(viewShares)
    // @ts-expect-error — property access on loosely typed object
    .where(eq(viewShares.shareId, shareId));
  return views.length;
}

export async function getAuditLog(params: {
  actorId?: number;
  targetUserId?: number;
  featureId?: string;
  limit?: number;
}) {
  const db = (await getDb())!;
  const conditions = [];
  if (params.actorId) conditions.push(eq(permissionAuditLog.actorId, params.actorId));
  if (params.targetUserId) conditions.push(eq(permissionAuditLog.targetUserId, params.targetUserId));
  if (params.featureId) conditions.push(eq(permissionAuditLog.featureId, params.featureId));

  const query = db.select().from(permissionAuditLog);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).limit(params.limit ?? 100);
  }
  return query.limit(params.limit ?? 100);
}
