/**
 * Usage Analytics Router — Pass 11
 *
 * Aggregates platform engagement metrics for the admin dashboard:
 * - Chat volume (conversations, messages, modes)
 * - Calculator/Wealth Engine usage
 * - Voice mode adoption
 * - User engagement (DAU, WAU, MAU, retention)
 * - Feature adoption rates
 * - Notification workflow stats
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { count, eq, gte, desc, sql, and, avg } from "drizzle-orm";
import {
  conversations, messages, users, modelRuns, auditTrail,
  feedback, meetings,
} from "../../drizzle/schema";
import { getWorkflowStats } from "../services/notificationWorkflows";
import { getConnectionStats } from "../services/websocketNotifications";

export const usageAnalyticsRouter = router({
  /**
   * Overview stats — key platform metrics at a glance
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin or manager access required" });
    }
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return {
      totalUsers: 0, activeUsersToday: 0, activeUsersWeek: 0, activeUsersMonth: 0,
      totalConversations: 0, totalMessages: 0, totalModelRuns: 0,
      avgMessagesPerConversation: 0, wsConnections: 0, workflowRules: 0,
    };

    const now = Date.now();
    const dayAgo = new Date(now - 86400000);
    const weekAgo = new Date(now - 7 * 86400000);
    const monthAgo = new Date(now - 30 * 86400000);

    const [totalU] = await db.select({ count: count() }).from(users);
    const [activeDay] = await db.select({ count: count() }).from(users).where(gte(users.lastSignedIn, dayAgo));
    const [activeWeek] = await db.select({ count: count() }).from(users).where(gte(users.lastSignedIn, weekAgo));
    const [activeMonth] = await db.select({ count: count() }).from(users).where(gte(users.lastSignedIn, monthAgo));
    const [totalConv] = await db.select({ count: count() }).from(conversations);
    const [totalMsg] = await db.select({ count: count() }).from(messages);

    let totalRuns = 0;
    try {
      const [runs] = await db.select({ count: count() }).from(modelRuns);
      totalRuns = runs?.count ?? 0;
    } catch { /* table may not exist */ }

    const avgMsgs = totalConv?.count && totalConv.count > 0
      ? Math.round((totalMsg?.count ?? 0) / totalConv.count * 10) / 10
      : 0;

    const wsStats = getConnectionStats();
    const wfStats = getWorkflowStats();

    return {
      totalUsers: totalU?.count ?? 0,
      activeUsersToday: activeDay?.count ?? 0,
      activeUsersWeek: activeWeek?.count ?? 0,
      activeUsersMonth: activeMonth?.count ?? 0,
      totalConversations: totalConv?.count ?? 0,
      totalMessages: totalMsg?.count ?? 0,
      totalModelRuns: totalRuns,
      avgMessagesPerConversation: avgMsgs,
      wsConnections: wsStats.totalConnections,
      workflowRules: wfStats.totalRules,
    };
  }),

  /**
   * Chat volume over time — daily message counts for the last N days
   */
  chatVolume: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      const since = new Date(Date.now() - input.days * 86400000);
      const rows = await db
        .select({
          date: sql<string>`DATE(${messages.createdAt})`.as("date"),
          role: messages.role,
          count: count().as("count"),
        })
        .from(messages)
        .where(gte(messages.createdAt, since))
        .groupBy(sql`DATE(${messages.createdAt})`, messages.role)
        .orderBy(sql`DATE(${messages.createdAt})`);

      return rows;
    }),

  /**
   * Conversation mode distribution — how users use different chat modes
   */
  modeDistribution: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        mode: conversations.mode,
        count: count().as("count"),
      })
      .from(conversations)
      .groupBy(conversations.mode);

    return rows;
  }),

  /**
   * User engagement trend — DAU over time
   */
  engagementTrend: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      const since = new Date(Date.now() - input.days * 86400000);
      // Use messages as a proxy for daily active users
      const rows = await db
        .select({
          date: sql<string>`DATE(${messages.createdAt})`.as("date"),
          activeUsers: sql<number>`COUNT(DISTINCT ${messages.userId})`.as("activeUsers"),
          messageCount: count().as("messageCount"),
        })
        .from(messages)
        .where(gte(messages.createdAt, since))
        .groupBy(sql`DATE(${messages.createdAt})`)
        .orderBy(sql`DATE(${messages.createdAt})`);

      return rows;
    }),

  /**
   * Feature adoption — which features are being used (from audit trail)
   */
  featureAdoption: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      try {
        const since = new Date(Date.now() - input.days * 86400000);
        const rows = await db
          .select({
            action: auditTrail.action,
            count: count().as("count"),
            uniqueUsers: sql<number>`COUNT(DISTINCT ${auditTrail.userId})`.as("uniqueUsers"),
          })
          .from(auditTrail)
          .where(gte(auditTrail.createdAt, since))
          .groupBy(auditTrail.action)
          .orderBy(desc(count()))
          .limit(25);

        return rows;
      } catch {
        return [];
      }
    }),

  /**
   * Model run analytics — AI model usage patterns
   */
  modelUsage: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      try {
        const since = new Date(Date.now() - input.days * 86400000);
        const rows = await db
          .select({
            date: sql<string>`DATE(${modelRuns.createdAt})`.as("date"),
            status: modelRuns.status,
            count: count().as("count"),
            avgDuration: sql<number>`AVG(${modelRuns.durationMs})`.as("avgDuration"),
          })
          .from(modelRuns)
          .where(gte(modelRuns.createdAt, since))
          .groupBy(sql`DATE(${modelRuns.createdAt})`, modelRuns.status)
          .orderBy(sql`DATE(${modelRuns.createdAt})`);

        return rows;
      } catch {
        return [];
      }
    }),

  /**
   * Feedback summary — user satisfaction metrics
   */
  feedbackSummary: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { total: 0, positive: 0, negative: 0, rate: 0 };

      try {
        const since = new Date(Date.now() - input.days * 86400000);
        const [total] = await db.select({ count: count() }).from(feedback).where(gte(feedback.createdAt, since));
        const [positive] = await db.select({ count: count() }).from(feedback)
          .where(and(gte(feedback.createdAt, since), eq(feedback.rating, "up" as any)));
        const [negative] = await db.select({ count: count() }).from(feedback)
          .where(and(gte(feedback.createdAt, since), eq(feedback.rating, "down" as any)));

        const totalCount = total?.count ?? 0;
        const positiveCount = positive?.count ?? 0;

        return {
          total: totalCount,
          positive: positiveCount,
          negative: negative?.count ?? 0,
          rate: totalCount > 0 ? Math.round(positiveCount / totalCount * 100) : 0,
        };
      } catch {
        return { total: 0, positive: 0, negative: 0, rate: 0 };
      }
    }),

  /**
   * Meeting analytics — meeting volume and completion rates
   */
  meetingStats: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      try {
        const since = new Date(Date.now() - input.days * 86400000);
        const rows = await db
          .select({
            status: meetings.status,
            count: count().as("count"),
          })
          .from(meetings)
          .where(gte(meetings.createdAt, since))
          .groupBy(meetings.status);

        return rows;
      } catch {
        return [];
      }
    }),

  /**
   * Role distribution — users by role
   */
  roleDistribution: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        role: users.role,
        count: count().as("count"),
      })
      .from(users)
      .groupBy(users.role);

    return rows;
  }),

  /**
   * Top users by engagement — most active users
   */
  topUsers: protectedProcedure
    .input(z.object({ limit: z.number().min(5).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          userId: messages.userId,
          userName: users.name,
          messageCount: count().as("messageCount"),
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .groupBy(messages.userId, users.name)
        .orderBy(desc(count()))
        .limit(input.limit);

      return rows;
    }),
});
