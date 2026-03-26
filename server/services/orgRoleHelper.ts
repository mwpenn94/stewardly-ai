/**
 * Organization Role Helper
 * Checks a user's role within an organization using the user_organization_roles table.
 */
import { eq, and } from "drizzle-orm";
import { userOrganizationRoles } from "../../drizzle/schema";
import { getDb } from "../db";

export type OrgRoleName = "org_admin" | "manager" | "professional" | "user";

const ROLE_HIERARCHY: Record<OrgRoleName, number> = {
  org_admin: 4,
  manager: 3,
  professional: 2,
  user: 1,
};

export async function getUserOrgRole(
  userId: number,
  organizationId: number
): Promise<OrgRoleName | null> {
  const db = await getDb();
  if (!db) return null;

  const [role] = await db
    .select({ organizationRole: userOrganizationRoles.organizationRole })
    .from(userOrganizationRoles)
    .where(
      and(
        eq(userOrganizationRoles.userId, userId),
        eq(userOrganizationRoles.organizationId, organizationId),
        eq(userOrganizationRoles.status, "active")
      )
    )
    .limit(1);

  return (role?.organizationRole as OrgRoleName) ?? null;
}

export function hasMinimumOrgRole(
  actualRole: OrgRoleName | null,
  requiredRole: OrgRoleName
): boolean {
  if (!actualRole) return false;
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function checkOrgAccess(
  userId: number,
  organizationId: number,
  requiredRole: OrgRoleName
): Promise<boolean> {
  const role = await getUserOrgRole(userId, organizationId);
  return hasMinimumOrgRole(role, requiredRole);
}
