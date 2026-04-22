/**
 * P1-5: Faculty/Expert Office Hours Service
 *
 * Manages scheduling, registration, and lifecycle of live office hour sessions.
 * Supports track-specific sessions, capacity limits, and attendance tracking.
 */
import { getDb } from "../../db";
import { officeHours, officeHourRegistrations } from "../../../drizzle/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────

export interface OfficeHourWithRegistration {
  id: number;
  hostUserId: number;
  title: string;
  description: string | null;
  trackId: number | null;
  scheduledAt: Date;
  durationMinutes: number;
  maxAttendees: number;
  currentAttendees: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  meetingUrl: string | null;
  recordingUrl: string | null;
  isRegistered: boolean;
  registrationStatus: string | null;
}

// ─── Session Management ──────────────────────────────────────────────────

/**
 * Create a new office hour session.
 */
export async function createSession(data: {
  hostUserId: number;
  title: string;
  description?: string;
  trackId?: number;
  scheduledAt: Date;
  durationMinutes?: number;
  maxAttendees?: number;
  meetingUrl?: string;
}): Promise<number> {
  const db = await getDb();
  const result = await db!.insert(officeHours).values({
    hostUserId: data.hostUserId,
    title: data.title,
    description: data.description || null,
    trackId: data.trackId || null,
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes || 60,
    maxAttendees: data.maxAttendees || 20,
    currentAttendees: 0,
    status: "scheduled",
    meetingUrl: data.meetingUrl || null,
  });
  return result[0].insertId;
}

/**
 * List upcoming office hours, optionally filtered by track.
 */
export async function listUpcoming(options: {
  trackId?: number;
  userId?: number;
  limit?: number;
}): Promise<OfficeHourWithRegistration[]> {
  const db = await getDb();
  const now = new Date();
  const conditions = [gte(officeHours.scheduledAt, now)];

  if (options.trackId) {
    conditions.push(eq(officeHours.trackId, options.trackId));
  }

  const sessions = await db!
    .select()
    .from(officeHours)
    .where(and(...conditions))
    .orderBy(officeHours.scheduledAt)
    .limit(options.limit || 20);

  // If userId provided, check registration status
  let registrationMap = new Map<number, string>();
  if (options.userId && sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const regs = await db!
      .select()
      .from(officeHourRegistrations)
      .where(
        and(
          inArray(officeHourRegistrations.officeHourId, sessionIds),
          eq(officeHourRegistrations.userId, options.userId),
        ),
      );
    for (const r of regs) registrationMap.set(r.officeHourId, r.status);
  }

  return sessions.map((s) => ({
    ...s,
    scheduledAt: s.scheduledAt,
    isRegistered: registrationMap.has(s.id),
    registrationStatus: registrationMap.get(s.id) || null,
  }));
}

/**
 * List past office hours with recordings.
 */
export async function listPast(options: {
  trackId?: number;
  limit?: number;
}): Promise<typeof officeHours.$inferSelect[]> {
  const db = await getDb();
  const now = new Date();
  const conditions = [lte(officeHours.scheduledAt, now), eq(officeHours.status, "completed")];

  if (options.trackId) {
    conditions.push(eq(officeHours.trackId, options.trackId));
  }

  return db!
    .select()
    .from(officeHours)
    .where(and(...conditions))
    .orderBy(desc(officeHours.scheduledAt))
    .limit(options.limit || 20);
}

// ─── Registration ────────────────────────────────────────────────────────

/**
 * Register a user for an office hour session.
 */
export async function register(officeHourId: number, userId: number): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  // Check session exists and has capacity
  const sessions = await db!
    .select()
    .from(officeHours)
    .where(eq(officeHours.id, officeHourId));

  const session = sessions[0];
  if (!session) return { success: false, message: "Session not found" };
  if (session.status === "cancelled") return { success: false, message: "Session is cancelled" };
  if (session.status === "completed") return { success: false, message: "Session already completed" };
  if (session.currentAttendees >= session.maxAttendees) return { success: false, message: "Session is full" };

  // Check if already registered
  const existing = await db!
    .select()
    .from(officeHourRegistrations)
    .where(
      and(
        eq(officeHourRegistrations.officeHourId, officeHourId),
        eq(officeHourRegistrations.userId, userId),
      ),
    );

  if (existing.length > 0) {
    if (existing[0].status === "cancelled") {
      // Re-register
      await db!
        .update(officeHourRegistrations)
        .set({ status: "registered" })
        .where(eq(officeHourRegistrations.id, existing[0].id));
      await db!
        .update(officeHours)
        .set({ currentAttendees: sql`current_attendees + 1` })
        .where(eq(officeHours.id, officeHourId));
      return { success: true, message: "Re-registered successfully" };
    }
    return { success: false, message: "Already registered" };
  }

  // Register
  await db!.insert(officeHourRegistrations).values({
    officeHourId,
    userId,
    status: "registered",
  });
  await db!
    .update(officeHours)
    .set({ currentAttendees: sql`current_attendees + 1` })
    .where(eq(officeHours.id, officeHourId));

  return { success: true, message: "Registered successfully" };
}

/**
 * Cancel a user's registration.
 */
export async function cancelRegistration(officeHourId: number, userId: number): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  const existing = await db!
    .select()
    .from(officeHourRegistrations)
    .where(
      and(
        eq(officeHourRegistrations.officeHourId, officeHourId),
        eq(officeHourRegistrations.userId, userId),
      ),
    );

  if (existing.length === 0 || existing[0].status === "cancelled") {
    return { success: false, message: "No active registration found" };
  }

  await db!
    .update(officeHourRegistrations)
    .set({ status: "cancelled" })
    .where(eq(officeHourRegistrations.id, existing[0].id));
  await db!
    .update(officeHours)
    .set({ currentAttendees: sql`GREATEST(current_attendees - 1, 0)` })
    .where(eq(officeHours.id, officeHourId));

  return { success: true, message: "Registration cancelled" };
}

/**
 * Mark attendance for a user.
 */
export async function markAttendance(officeHourId: number, userId: number): Promise<void> {
  const db = await getDb();
  await db!
    .update(officeHourRegistrations)
    .set({ status: "attended" })
    .where(
      and(
        eq(officeHourRegistrations.officeHourId, officeHourId),
        eq(officeHourRegistrations.userId, userId),
      ),
    );
}

/**
 * Get registrations for a session (for host view).
 */
export async function getRegistrations(officeHourId: number): Promise<typeof officeHourRegistrations.$inferSelect[]> {
  const db = await getDb();
  return db!
    .select()
    .from(officeHourRegistrations)
    .where(eq(officeHourRegistrations.officeHourId, officeHourId));
}

/**
 * Update session status (go live, complete, cancel).
 */
export async function updateSessionStatus(
  sessionId: number,
  status: "scheduled" | "live" | "completed" | "cancelled",
  updates?: { meetingUrl?: string; recordingUrl?: string },
): Promise<void> {
  const db = await getDb();
  await db!
    .update(officeHours)
    .set({
      status,
      ...(updates?.meetingUrl && { meetingUrl: updates.meetingUrl }),
      ...(updates?.recordingUrl && { recordingUrl: updates.recordingUrl }),
    })
    .where(eq(officeHours.id, sessionId));
}

/**
 * Get a user's upcoming registered sessions.
 */
export async function getMyRegistrations(userId: number): Promise<OfficeHourWithRegistration[]> {
  const db = await getDb();
  const regs = await db!
    .select()
    .from(officeHourRegistrations)
    .where(and(eq(officeHourRegistrations.userId, userId), eq(officeHourRegistrations.status, "registered")));

  if (regs.length === 0) return [];

  const sessionIds = regs.map((r) => r.officeHourId);
  const sessions = await db!
    .select()
    .from(officeHours)
    .where(inArray(officeHours.id, sessionIds))
    .orderBy(officeHours.scheduledAt);

  const regMap = new Map(regs.map((r) => [r.officeHourId, r.status]));

  return sessions.map((s) => ({
    ...s,
    isRegistered: true,
    registrationStatus: regMap.get(s.id) || null,
  }));
}
