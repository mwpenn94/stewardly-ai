/**
 * EMBA Learning — content permission model.
 *
 * Pure helpers (no DB calls) for Role-Based Access Control on learning
 * content rows. Used by the learning router and the Content Studio UI
 * to gate CRUD operations. See docs/EMBA_INTEGRATION.md §7B for the
 * authoritative permission matrix.
 */

export type LearningRole = "user" | "advisor" | "manager" | "admin";

export interface ContentRow {
  id?: number;
  createdBy: number | null;
  visibility: "public" | "team" | "private";
  status: string;
}

export interface ActingUser {
  id: number;
  role: LearningRole;
}

/**
 * Can this user edit this content row?
 * - admin: yes, always
 * - owner: yes (rows they created)
 * - advisor: yes, iff team-visible
 * - manager: yes, iff team-visible (managers inherit advisor authoring)
 * - user: no (beyond their own rows)
 */
export function canEditContent(user: ActingUser, content: ContentRow): boolean {
  if (user.role === "admin") return true;
  if (content.createdBy !== null && content.createdBy === user.id) return true;
  if ((user.role === "advisor" || user.role === "manager") && content.visibility === "team") return true;
  return false;
}

/** Only advisor+ can move drafts to published. */
export function canPublish(user: ActingUser): boolean {
  return user.role === "advisor" || user.role === "manager" || user.role === "admin";
}

/** Only admins can seed / bulk-re-import / restore from history. */
export function canSeedContent(user: ActingUser): boolean {
  return user.role === "admin";
}

/**
 * Can this user see this content row?
 * Enforces: drafts only visible to their author (and admins), private
 * rows only to their owner, team rows to any authenticated user, public
 * rows to everyone.
 */
export function canSeeContent(user: ActingUser | null, content: ContentRow): boolean {
  // Drafts/review/archived: author + admin only
  if (content.status !== "published" && content.status !== "active") {
    if (!user) return false;
    if (user.role === "admin") return true;
    return content.createdBy === user.id;
  }
  // Private: owner-only
  if (content.visibility === "private") {
    if (!user) return false;
    return content.createdBy === user.id || user.role === "admin";
  }
  // Team: any authenticated user
  if (content.visibility === "team") return user !== null;
  // Public: everyone
  return true;
}

/**
 * Throws a structured error when the user cannot edit. Used inside
 * tRPC mutations so the thrown TRPCError bubbles as FORBIDDEN.
 */
export function assertCanEdit(user: ActingUser, content: ContentRow): void {
  if (!canEditContent(user, content)) {
    const err = new Error(`User ${user.id} (${user.role}) cannot edit content (owner=${content.createdBy}, visibility=${content.visibility})`);
    (err as any).code = "FORBIDDEN";
    throw err;
  }
}
