/**
 * P1-4: Compliant Professional Peer Groups
 * Compliance-gated study groups with discussion threads
 */
import { getDb } from "../../db";
import { peerGroups, peerGroupMembers, peerGroupMessages } from "../../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function createGroup(params: {
  name: string;
  description?: string;
  trackId?: number;
  createdBy: number;
  maxMembers?: number;
  isComplianceGated?: boolean;
  requiredRole?: string;
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(peerGroups).values({
    name: params.name,
    description: params.description || null,
    trackId: params.trackId || null,
    createdBy: params.createdBy,
    maxMembers: params.maxMembers || 20,
    isComplianceGated: params.isComplianceGated !== false,
    requiredRole: params.requiredRole || "advisor",
    currentMembers: 1,
  });

  // Auto-add creator as admin member
  await db.insert(peerGroupMembers).values({
    groupId: result.insertId,
    userId: params.createdBy,
    role: "admin",
  });

  return { success: true, groupId: result.insertId };
}

export async function joinGroup(groupId: number, userId: number, userRole: string) {
  const db = (await getDb())!;

  const [group] = await db.select().from(peerGroups).where(eq(peerGroups.id, groupId)).limit(1);
  if (!group) return { success: false, error: "Group not found" };
  if (group.status !== "active") return { success: false, error: "Group is not active" };
  if (group.currentMembers >= group.maxMembers) return { success: false, error: "Group is full" };

  // Compliance gating check
  if (group.isComplianceGated) {
    const allowedRoles = ["advisor", "manager", "admin"];
    if (!allowedRoles.includes(userRole)) {
      return { success: false, error: "This group requires professional credentials" };
    }
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(peerGroupMembers)
    .where(and(eq(peerGroupMembers.groupId, groupId), eq(peerGroupMembers.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.status === "active") return { success: false, error: "Already a member" };
    // Re-activate
    await db.update(peerGroupMembers).set({ status: "active" }).where(eq(peerGroupMembers.id, existing.id));
  } else {
    await db.insert(peerGroupMembers).values({ groupId, userId });
  }

  await db.update(peerGroups).set({ currentMembers: sql`current_members + 1` }).where(eq(peerGroups.id, groupId));
  return { success: true };
}

export async function leaveGroup(groupId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .update(peerGroupMembers)
    .set({ status: "inactive" })
    .where(and(eq(peerGroupMembers.groupId, groupId), eq(peerGroupMembers.userId, userId)));

  await db.update(peerGroups).set({ currentMembers: sql`GREATEST(current_members - 1, 0)` }).where(eq(peerGroups.id, groupId));
  return { success: true };
}

export async function listGroups(trackId?: number) {
  const db = (await getDb())!;
  if (trackId) {
    return db.select().from(peerGroups).where(and(eq(peerGroups.status, "active"), eq(peerGroups.trackId, trackId)));
  }
  return db.select().from(peerGroups).where(eq(peerGroups.status, "active"));
}

export async function getGroupMembers(groupId: number) {
  const db = (await getDb())!;
  return db.select().from(peerGroupMembers).where(and(eq(peerGroupMembers.groupId, groupId), eq(peerGroupMembers.status, "active")));
}

export async function postMessage(groupId: number, userId: number, content: string) {
  const db = (await getDb())!;

  // Verify membership
  const [member] = await db
    .select()
    .from(peerGroupMembers)
    .where(and(eq(peerGroupMembers.groupId, groupId), eq(peerGroupMembers.userId, userId), eq(peerGroupMembers.status, "active")))
    .limit(1);

  if (!member) return { success: false, error: "Not a member of this group" };

  const [result] = await db.insert(peerGroupMessages).values({ groupId, userId, content });
  return { success: true, messageId: result.insertId };
}

export async function getMessages(groupId: number, limit = 50) {
  const db = (await getDb())!;
  return db
    .select()
    .from(peerGroupMessages)
    .where(eq(peerGroupMessages.groupId, groupId))
    .orderBy(desc(peerGroupMessages.createdAt))
    .limit(limit);
}

export async function getMyGroups(userId: number) {
  const db = (await getDb())!;
  const memberships = await db
    .select()
    .from(peerGroupMembers)
    .where(and(eq(peerGroupMembers.userId, userId), eq(peerGroupMembers.status, "active")));

  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId);
  const groups = await db.select().from(peerGroups).where(sql`${peerGroups.id} IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);
  return groups;
}
