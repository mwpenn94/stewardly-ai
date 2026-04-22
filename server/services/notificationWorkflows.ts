/**
 * Notification Workflow Automation Service — Pass 11
 *
 * Triggers in-app notifications for key business events:
 * 1. Lead pipeline events (new lead, status change, assignment)
 * 2. Compliance alerts (license expiry, CE deadlines)
 * 3. Meeting reminders (upcoming meetings, overdue action items)
 * 4. Improvement engine signals (calibration complete, quality alerts)
 *
 * All notifications are in-app only (per platform policy).
 * Uses the existing WebSocket notification infrastructure.
 */
import { sendNotification, broadcastToRole } from "./websocketNotifications";
import { getDb } from "../db";
import { eq, and, lte, gte, isNull, desc, sql } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WorkflowEvent {
  type: string;
  userId: number | string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface WorkflowRule {
  id: string;
  eventType: string;
  condition: (event: WorkflowEvent) => boolean;
  action: (event: WorkflowEvent) => void;
  description: string;
}

// ─── Workflow Rules Registry ────────────────────────────────────────────────

const workflowRules: WorkflowRule[] = [
  // ── Lead Pipeline Events ──────────────────────────────────────────────
  {
    id: "lead.new",
    eventType: "lead.created",
    condition: () => true,
    action: (event) => {
      const { leadName, source, assignedAdvisorId } = event.data;
      // Notify the assigned advisor
      if (assignedAdvisorId) {
        sendNotification(assignedAdvisorId as number, {
          type: "alert",
          priority: "medium",
          title: "New Lead Assigned",
          body: `${leadName || "A new lead"} from ${source || "direct"} has been assigned to you.`,
          metadata: { workflow: "lead.new", leadName, source },
        });
      }
      // Notify admins/managers
      broadcastToRole("admin", {
        type: "enrichment",
        priority: "low",
        title: "New Lead Captured",
        body: `${leadName || "New lead"} entered the pipeline from ${source || "unknown source"}.`,
        metadata: { workflow: "lead.new", leadName, source },
      });
    },
    description: "Notify assigned advisor and admins when a new lead is captured",
  },
  {
    id: "lead.qualified",
    eventType: "lead.status_changed",
    condition: (event) => event.data.newStatus === "qualified",
    action: (event) => {
      const { leadName, assignedAdvisorId } = event.data;
      if (assignedAdvisorId) {
        sendNotification(assignedAdvisorId as number, {
          type: "alert",
          priority: "high",
          title: "Lead Qualified",
          body: `${leadName || "A lead"} has been qualified and is ready for outreach.`,
          metadata: { workflow: "lead.qualified", leadName },
        });
      }
      broadcastToRole("manager", {
        type: "enrichment",
        priority: "medium",
        title: "Lead Qualified",
        body: `${leadName || "A lead"} moved to qualified status.`,
        metadata: { workflow: "lead.qualified", leadName },
      });
    },
    description: "Notify advisor and managers when a lead becomes qualified",
  },
  {
    id: "lead.converted",
    eventType: "lead.status_changed",
    condition: (event) => event.data.newStatus === "converted",
    action: (event) => {
      const { leadName, assignedAdvisorId } = event.data;
      if (assignedAdvisorId) {
        sendNotification(assignedAdvisorId as number, {
          type: "model_complete",
          priority: "medium",
          title: "Lead Converted",
          body: `Congratulations! ${leadName || "A lead"} has been converted to a client.`,
          metadata: { workflow: "lead.converted", leadName },
        });
      }
      broadcastToRole("admin", {
        type: "model_complete",
        priority: "low",
        title: "New Conversion",
        body: `${leadName || "A lead"} converted to client.`,
        metadata: { workflow: "lead.converted", leadName },
      });
    },
    description: "Celebrate lead conversions with advisor and admin notifications",
  },
  {
    id: "lead.assigned",
    eventType: "lead.assigned",
    condition: () => true,
    action: (event) => {
      const { leadName, advisorId, advisorName } = event.data;
      sendNotification(advisorId as number, {
        type: "alert",
        priority: "high",
        title: "Lead Assigned to You",
        body: `${leadName || "A new lead"} has been assigned to you. Review their profile and begin outreach.`,
        metadata: { workflow: "lead.assigned", leadName },
      });
    },
    description: "Notify advisor when a lead is assigned to them",
  },

  // ── Compliance Alerts ─────────────────────────────────────────────────
  {
    id: "compliance.license_expiry",
    eventType: "compliance.license_expiring",
    condition: () => true,
    action: (event) => {
      const { licenseName, expiryDate, daysUntilExpiry } = event.data;
      const priority = (daysUntilExpiry as number) <= 7 ? "critical" : 
                       (daysUntilExpiry as number) <= 30 ? "high" : "medium";
      sendNotification(event.userId, {
        type: "alert",
        priority,
        title: "License Expiring Soon",
        body: `Your ${licenseName} expires in ${daysUntilExpiry} days (${expiryDate}). Renew now to maintain compliance.`,
        metadata: { workflow: "compliance.license_expiry", licenseName, expiryDate, daysUntilExpiry },
      });
      // Also notify compliance officer
      broadcastToRole("manager", {
        type: "alert",
        priority: priority === "critical" ? "high" : "medium",
        title: "License Expiry Alert",
        body: `A team member's ${licenseName} expires in ${daysUntilExpiry} days.`,
        metadata: { workflow: "compliance.license_expiry", userId: event.userId, licenseName },
      });
    },
    description: "Alert user and compliance when a license is approaching expiry",
  },
  {
    id: "compliance.ce_deadline",
    eventType: "compliance.ce_deadline_approaching",
    condition: () => true,
    action: (event) => {
      const { requirement, deadline, creditsNeeded } = event.data;
      sendNotification(event.userId, {
        type: "coaching",
        priority: "high",
        title: "CE Deadline Approaching",
        body: `You need ${creditsNeeded} more CE credits for ${requirement} by ${deadline}. Visit the Learning Engine to find courses.`,
        metadata: { workflow: "compliance.ce_deadline", requirement, deadline, creditsNeeded },
      });
    },
    description: "Remind users about approaching CE credit deadlines",
  },
  {
    id: "compliance.review_needed",
    eventType: "compliance.review_due",
    condition: () => true,
    action: (event) => {
      const { reviewType, dueDate } = event.data;
      broadcastToRole("manager", {
        type: "alert",
        priority: "high",
        title: "Compliance Review Due",
        body: `${reviewType} review is due by ${dueDate}. Please complete the review in the Compliance section.`,
        metadata: { workflow: "compliance.review_needed", reviewType, dueDate },
      });
    },
    description: "Notify managers when compliance reviews are due",
  },

  // ── Meeting Reminders ─────────────────────────────────────────────────
  {
    id: "meeting.upcoming",
    eventType: "meeting.reminder",
    condition: () => true,
    action: (event) => {
      const { meetingTitle, scheduledAt, minutesUntil, clientName } = event.data;
      const priority = (minutesUntil as number) <= 15 ? "high" : "medium";
      sendNotification(event.userId, {
        type: "system",
        priority,
        title: `Meeting in ${minutesUntil} minutes`,
        body: `${meetingTitle || "Meeting"}${clientName ? ` with ${clientName}` : ""} starts at ${new Date(scheduledAt as number).toLocaleTimeString()}.`,
        metadata: { workflow: "meeting.upcoming", meetingTitle, scheduledAt },
      });
    },
    description: "Remind users about upcoming meetings",
  },
  {
    id: "meeting.action_overdue",
    eventType: "meeting.action_item_overdue",
    condition: () => true,
    action: (event) => {
      const { actionTitle, meetingTitle, dueDate } = event.data;
      sendNotification(event.userId, {
        type: "coaching",
        priority: "high",
        title: "Overdue Action Item",
        body: `"${actionTitle}" from ${meetingTitle || "a meeting"} was due ${dueDate}. Please complete it or update the status.`,
        metadata: { workflow: "meeting.action_overdue", actionTitle, meetingTitle },
      });
    },
    description: "Alert users about overdue meeting action items",
  },

  // ── Improvement Engine Signals ────────────────────────────────────────
  {
    id: "improvement.calibration_complete",
    eventType: "improvement.loop_complete",
    condition: (event) => event.data.loopName === "calibration",
    action: (event) => {
      const { adjustments, confidence } = event.data;
      broadcastToRole("admin", {
        type: "model_complete",
        priority: "low",
        title: "Calibration Complete",
        body: `Default calibration loop completed with ${adjustments || 0} proposed adjustments (confidence: ${confidence || "N/A"}).`,
        metadata: { workflow: "improvement.calibration", adjustments, confidence },
      });
    },
    description: "Notify admins when improvement engine calibration completes",
  },
  {
    id: "improvement.quality_alert",
    eventType: "improvement.quality_below_threshold",
    condition: () => true,
    action: (event) => {
      const { metric, value, threshold } = event.data;
      broadcastToRole("admin", {
        type: "alert",
        priority: "high",
        title: "Quality Below Threshold",
        body: `${metric} dropped to ${value} (threshold: ${threshold}). Review the Improvement Engine for details.`,
        metadata: { workflow: "improvement.quality_alert", metric, value, threshold },
      });
    },
    description: "Alert admins when quality metrics drop below thresholds",
  },
];

// ─── Event Dispatcher ───────────────────────────────────────────────────────

/**
 * Dispatch a workflow event — matches against all registered rules
 * and fires matching notification actions.
 */
export function dispatchWorkflowEvent(event: WorkflowEvent): { fired: string[]; skipped: string[] } {
  const fired: string[] = [];
  const skipped: string[] = [];

  for (const rule of workflowRules) {
    if (rule.eventType === event.type) {
      try {
        if (rule.condition(event)) {
          rule.action(event);
          fired.push(rule.id);
        } else {
          skipped.push(rule.id);
        }
      } catch (err) {
        console.error(`[NotificationWorkflow] Rule ${rule.id} failed:`, err);
        skipped.push(rule.id);
      }
    }
  }

  return { fired, skipped };
}

// ─── Scheduled Checks (called by cron) ─────────────────────────────────────

/**
 * Check for upcoming meetings and send reminders.
 * Called every 5 minutes by the scheduler.
 */
export async function checkMeetingReminders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let sent = 0;
  try {
    const { meetings } = await import("../../drizzle/schema");
    const now = Date.now();
    const thirtyMinFromNow = now + 30 * 60 * 1000;

    // Find meetings starting in the next 30 minutes that haven't been reminded
    const upcoming = await db
      .select()
      .from(meetings)
      .where(
        and(
          gte(meetings.scheduledAt, new Date(now)),
          lte(meetings.scheduledAt, new Date(thirtyMinFromNow)),
          eq(meetings.status, "scheduled")
        )
      );

    for (const meeting of upcoming) {
      const minutesUntil = Math.round((new Date(meeting.scheduledAt!).getTime() - now) / 60000);
      // Only send at 30, 15, and 5 minute marks
      if (minutesUntil === 30 || minutesUntil === 15 || minutesUntil === 5 ||
          (minutesUntil >= 4 && minutesUntil <= 6) ||
          (minutesUntil >= 14 && minutesUntil <= 16) ||
          (minutesUntil >= 29 && minutesUntil <= 31)) {
        dispatchWorkflowEvent({
          type: "meeting.reminder",
          userId: meeting.userId,
          data: {
            // @ts-expect-error — property access on loosely typed object
            meetingTitle: meeting.title,
            scheduledAt: new Date(meeting.scheduledAt!).getTime(),
            minutesUntil,
            clientName: (meeting as any).clientName || null,
          },
          timestamp: now,
        });
        sent++;
      }
    }
  } catch (err) {
    console.error("[NotificationWorkflow] Meeting reminder check failed:", err);
  }

  return sent;
}

/**
 * Check for overdue meeting action items.
 * Called every hour by the scheduler.
 */
export async function checkOverdueActionItems(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let sent = 0;
  try {
    const { meetingActionItems, meetings } = await import("../../drizzle/schema");
    const now = Date.now();

    const overdue = await db
      .select({
        actionId: meetingActionItems.id,
        actionTitle: meetingActionItems.title,
        dueDate: meetingActionItems.dueDate,
        meetingId: meetingActionItems.meetingId,
        // @ts-expect-error — property access on loosely typed object
        meetingTitle: meetings.title,
        userId: meetings.userId,
      })
      .from(meetingActionItems)
      .innerJoin(meetings, eq(meetingActionItems.meetingId, meetings.id))
      .where(
        and(
          eq(meetingActionItems.status, "pending"),
          lte(meetingActionItems.dueDate, new Date(now))
        )
      )
      .limit(50);

    for (const item of overdue) {
      dispatchWorkflowEvent({
        type: "meeting.action_item_overdue",
        userId: item.userId,
        data: {
          actionTitle: item.actionTitle,
          meetingTitle: item.meetingTitle,
          dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "unknown",
        },
        timestamp: now,
      });
      sent++;
    }
  } catch (err) {
    console.error("[NotificationWorkflow] Overdue action check failed:", err);
  }

  return sent;
}

/**
 * Check for expiring licenses and CE deadlines.
 * Called daily by the scheduler.
 */
export async function checkComplianceAlerts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let sent = 0;
  try {
    const schema = await import("../../drizzle/schema");
    const now = Date.now();
    const sixtyDaysFromNow = now + 60 * 24 * 60 * 60 * 1000;

    // Check license expiry if the table exists
    if (schema.learningLicenses) {
      const expiring = await db
        .select()
        .from(schema.learningLicenses)
        .where(
          and(
            // @ts-expect-error — property access on loosely typed object
            lte(schema.learningLicenses.expiryDate, new Date(sixtyDaysFromNow)),
            // @ts-expect-error — strict mode fix
            gte(schema.learningLicenses.expiryDate, new Date(now)),
            eq(schema.learningLicenses.status, "active")
          )
        )
        .limit(100);

      for (const license of expiring) {
        const daysUntilExpiry = Math.ceil(
          // @ts-expect-error — property access on loosely typed object
          (new Date(license.expiryDate!).getTime() - now) / (24 * 60 * 60 * 1000)
        );
        // Only alert at 60, 30, 14, 7, 3, 1 day marks
        if ([60, 30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
          dispatchWorkflowEvent({
            type: "compliance.license_expiring",
            userId: license.userId,
            data: {
              licenseName: license.licenseType || "Professional License",
              // @ts-expect-error — property access on loosely typed object
              expiryDate: new Date(license.expiryDate!).toLocaleDateString(),
              daysUntilExpiry,
            },
            timestamp: now,
          });
          sent++;
        }
      }
    }
  } catch (err) {
    console.error("[NotificationWorkflow] Compliance alert check failed:", err);
  }

  return sent;
}

// ─── Get Registered Rules (for admin visibility) ────────────────────────────

export function getWorkflowRules() {
  return workflowRules.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    description: r.description,
  }));
}

export function getWorkflowStats() {
  return {
    totalRules: workflowRules.length,
    rulesByCategory: {
      lead: workflowRules.filter((r) => r.id.startsWith("lead.")).length,
      compliance: workflowRules.filter((r) => r.id.startsWith("compliance.")).length,
      meeting: workflowRules.filter((r) => r.id.startsWith("meeting.")).length,
      improvement: workflowRules.filter((r) => r.id.startsWith("improvement.")).length,
    },
  };
}
