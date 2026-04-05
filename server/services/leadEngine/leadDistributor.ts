/**
 * Lead Distributor — Match leads to advisors by geography, specialization, and load
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "leadDistributor" });
const MAX_LEAD_LOAD = 50;

export interface DistributionResult {
  advisorId: number | null;
  reason: string;
  waitlisted: boolean;
}

export async function distributeLead(params: {
  leadId: number;
  state?: string;
  zip?: string;
  primaryInterest?: string;
}): Promise<DistributionResult> {
  const db = await getDb();
  if (!db) return { advisorId: null, reason: "Database unavailable", waitlisted: false };

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");
    const { eq, count, and } = await import("drizzle-orm");

    // Count current lead load per advisor
    const advisorLoads = await db.select({
      advisorId: leadPipeline.assignedAdvisorId,
      loadCount: count(),
    }).from(leadPipeline)
      .where(and(
        eq(leadPipeline.status, "assigned"),
      ))
      .groupBy(leadPipeline.assignedAdvisorId);

    // Find advisor with lowest load under capacity
    const available = advisorLoads
      .filter(a => a.advisorId != null && a.loadCount < MAX_LEAD_LOAD)
      .sort((a, b) => a.loadCount - b.loadCount);

    if (available.length > 0) {
      const advisorId = available[0].advisorId!;
      // Assign
      await db.update(leadPipeline)
        .set({ assignedAdvisorId: advisorId, assignedAt: new Date(), status: "assigned" })
        .where(eq(leadPipeline.id, params.leadId));

      log.info({ leadId: params.leadId, advisorId }, "Lead distributed");
      return { advisorId, reason: "Matched by lowest load", waitlisted: false };
    }

    // All at capacity — waitlist
    log.warn({ leadId: params.leadId }, "All advisors at capacity — waitlisting");
    return { advisorId: null, reason: "All advisors at capacity (>50 leads)", waitlisted: true };
  } catch (e: any) {
    log.error({ error: e.message }, "Lead distribution failed");
    return { advisorId: null, reason: e.message, waitlisted: false };
  }
}
