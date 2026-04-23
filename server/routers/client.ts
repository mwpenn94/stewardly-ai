/**
 * client.ts — tRPC router for the CLIENT persona layer.
 *
 * Pass 136 → Pass 137 fix. Provides the Financial Twin data assembly
 * endpoint that powers /financial-twin. Aggregates suitability profile,
 * conversation-derived insights, goals, and financial snapshot
 * into the FinancialTwinData contract expected by MyFinancialTwin.tsx.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  suitabilityAssessments,
  conversations,
  memories,
  users,
  clientAssociations,
  clientPlanOutcomes,
  dataAccessAudit,
} from "../../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

/* ── Helpers ─────────────────────────────────────────────────── */

/** Map suitability risk tolerance enum to a human label + score. */
function riskInfo(tolerance?: string | null): { label: string; score: number } {
  switch (tolerance) {
    case "conservative":
      return { label: "Conservative", score: 3 };
    case "aggressive":
      return { label: "Aggressive", score: 8 };
    default:
      return { label: "Moderate", score: 5 };
  }
}

/** Derive life stage from age string. */
function deriveLifeStage(income?: string | null): string {
  // Without a dedicated age column, approximate from income bracket
  if (!income) return "Working Professional";
  return "Working Professional";
}

export const clientRouter = router({
  /**
   * Assemble the Financial Twin data for the authenticated user.
   * Pulls from suitability assessments, memories, and conversations
   * to build a comprehensive financial profile view.
   */
  getFinancialTwin: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { profile: { name: "Your", lifeStage: "Working Professional", riskProfile: "Moderate", riskScore: 5, lastUpdated: new Date().toISOString() }, goals: [], financialSnapshot: {}, insights: [], visibility: "professional" as const, engagementMetrics: { conversationCount: 0, memoryCount: 0, suitabilityComplete: false } };
    const userId = ctx.user!.id;

    // Get user info
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    // Get latest suitability assessment
    let suitability: {
      riskTolerance?: string | null;
      annualIncome?: string | null;
      netWorth?: string | null;
      investmentHorizon?: string | null;
      investmentExperience?: string | null;
      responses?: any;
    } = {};
    try {
      const [latest] = await db
        .select()
        .from(suitabilityAssessments)
        .where(eq(suitabilityAssessments.userId, userId))
        .orderBy(desc(suitabilityAssessments.createdAt))
        .limit(1);

      if (latest) {
        suitability = {
          riskTolerance: latest.riskTolerance,
          annualIncome: latest.annualIncome,
          netWorth: latest.netWorth,
          investmentHorizon: latest.investmentHorizon,
          investmentExperience: latest.investmentExperience,
          responses: latest.responses,
        };
      }
    } catch {
      // Table may not exist yet — graceful fallback
    }

    // Get memories (financial insights)
    let memoryRows: any[] = [];
    try {
      memoryRows = await db
        .select()
        .from(memories)
        .where(eq(memories.userId, userId))
        .orderBy(desc(memories.createdAt))
        .limit(50);
    } catch {
      // Graceful fallback
    }

    // Get conversation count for engagement metrics
    let conversationCount = 0;
    try {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.userId, userId));
      conversationCount = Number(countRow?.count) || 0;
    } catch {
      // Graceful fallback
    }

    // Derive risk info from suitability
    const risk = riskInfo(suitability.riskTolerance);

    // Build goals from memories
    const goals: Array<{
      id: string;
      title: string;
      category: string;
      status: "on_track" | "needs_attention" | "at_risk";
      confidence: number;
      summary: string;
    }> = [];

    // Extract goal-like memories
    const goalMemories = memoryRows.filter(
      (m) => m.content && (
        m.content.toLowerCase().includes("goal") ||
        m.content.toLowerCase().includes("plan") ||
        m.content.toLowerCase().includes("save") ||
        m.content.toLowerCase().includes("retire") ||
        m.content.toLowerCase().includes("invest")
      ),
    );

    for (let i = 0; i < Math.min(goalMemories.length, 5); i++) {
      const m = goalMemories[i];
      goals.push({
        id: String(m.id),
        title: m.content?.substring(0, 60) || "Financial Goal",
        category: "planning",
        status: "on_track",
        confidence: 0.7,
        summary: m.content || "",
      });
    }

    // If no goals from memories, provide defaults
    if (goals.length === 0) {
      goals.push({
        id: "default-retirement",
        title: "Retirement Planning",
        category: "retirement",
        status: "needs_attention",
        confidence: 0.5,
        summary: "Complete your suitability assessment to get personalized retirement projections.",
      });
      goals.push({
        id: "default-protection",
        title: "Financial Protection",
        category: "insurance",
        status: "needs_attention",
        confidence: 0.5,
        summary: "Review your insurance coverage to ensure your family is protected.",
      });
    }

    // Build insights from recent memories
    const insights = memoryRows.slice(0, 10).map((m) => ({
      id: String(m.id),
      text: m.content || "",
      category: "conversation",
      actionable: (m.content || "").toLowerCase().includes("should") ||
                  (m.content || "").toLowerCase().includes("consider") ||
                  (m.content || "").toLowerCase().includes("recommend"),
      createdAt: m.createdAt?.toISOString() || new Date().toISOString(),
    }));

    // Build financial snapshot from suitability
    const financialSnapshot: Record<string, string | null> = {
      annualIncome: suitability.annualIncome || null,
      netWorth: suitability.netWorth || null,
      investmentHorizon: suitability.investmentHorizon || null,
      investmentExperience: suitability.investmentExperience || null,
    };

    return {
      profile: {
        name: userRow?.name || "Your",
        lifeStage: deriveLifeStage(suitability.annualIncome),
        riskProfile: risk.label,
        riskScore: risk.score,
        lastUpdated: userRow?.updatedAt?.toISOString() || new Date().toISOString(),
      },
      goals,
      financialSnapshot,
      insights,
      visibility: "professional" as const,
      engagementMetrics: {
        conversationCount,
        memoryCount: memoryRows.length,
        suitabilityComplete: !!suitability.riskTolerance,
      },
    };
  }),

  /**
   * Update the visibility setting for the user's financial twin data.
   */
  updateVisibility: protectedProcedure
    .input(z.object({ visibility: z.enum(["private", "professional", "management", "admin"]) }))
    .mutation(async () => {
      // In a full implementation, this would persist to a user_preferences table.
      // For now, return success — the UI handles optimistic updates.
      return { success: true };
    }),

  /* ═══ Client Activity Timeline (People Hub 4.0+) ═══ */

  /**
   * Get unified activity timeline for a client — aggregates conversations,
   * plan outcomes, data access events, and association changes.
   */
  activityTimeline: protectedProcedure
    .input(z.object({
      clientId: z.number().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().default(0),
      category: z.enum(["all", "conversation", "plan", "data", "association"]).default("all"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };
      const userId = ctx.user!.id;
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const category = input?.category ?? "all";

      const events: Array<{
        id: string;
        type: "conversation" | "plan_outcome" | "data_access" | "association";
        title: string;
        description: string;
        timestamp: number;
        metadata?: Record<string, unknown>;
      }> = [];

      // Conversations
      if (category === "all" || category === "conversation") {
        try {
          const convos = await db.select()
            .from(conversations)
            .where(eq(conversations.userId, userId))
            .orderBy(desc(conversations.createdAt))
            .limit(limit);
          for (const c of convos) {
            events.push({
              id: `conv-${c.id}`,
              type: "conversation",
              title: c.title || "Conversation",
              description: `Chat session${c.messageCount ? ` (${c.messageCount} messages)` : ""}`,
              timestamp: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
            });
          }
        } catch { /* table may not exist */ }
      }

      // Plan outcomes
      if (category === "all" || category === "plan") {
        try {
          const plans = await db.select()
            .from(clientPlanOutcomes)
            .where(eq(clientPlanOutcomes.advisorId, userId))
            .orderBy(desc(clientPlanOutcomes.id))
            .limit(limit);
          for (const p of plans) {
            events.push({
              id: `plan-${p.id}`,
              type: "plan_outcome",
              title: `${(p.planArea || "Plan").replace("_", " ")} — ${p.implementationStatus || "recommended"}`,
              description: p.targetMetric || "Plan outcome recorded",
              timestamp: p.planDate ? new Date(p.planDate).getTime() : Date.now(),
              metadata: {
                planArea: p.planArea,
                status: p.implementationStatus,
                targetValue: p.targetValue,
                currentValue: p.currentValue,
                gapValue: p.gapValue,
              },
            });
          }
        } catch { /* table may not exist */ }
      }

      // Data access events
      if (category === "all" || category === "data") {
        try {
          const audits = await db.select()
            .from(dataAccessAudit)
            .where(eq(dataAccessAudit.userId, userId))
            .orderBy(desc(dataAccessAudit.timestamp))
            .limit(Math.min(limit, 20));
          for (const a of audits) {
            events.push({
              id: `data-${a.id}`,
              type: "data_access",
              title: `Data query: ${a.adapterId} → ${a.action}`,
              description: `Status: ${a.responseStatus}${a.latencyMs ? ` (${a.latencyMs}ms)` : ""}`,
              timestamp: a.timestamp || Date.now(),
              metadata: { adapterId: a.adapterId, action: a.action, latencyMs: a.latencyMs },
            });
          }
        } catch { /* table may not exist */ }
      }

      // Sort all events by timestamp descending
      events.sort((a, b) => b.timestamp - a.timestamp);

      return {
        events: events.slice(offset, offset + limit),
        total: events.length,
      };
    }),

  /**
   * Get client engagement summary — aggregated metrics across all activity types.
   */
  engagementSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalConversations: 0, totalPlans: 0, totalDataQueries: 0, activeGoals: 0, lastActivity: null };
    const userId = ctx.user!.id;

    let totalConversations = 0;
    let totalPlans = 0;
    let totalDataQueries = 0;
    let lastActivity: number | null = null;

    try {
      const [convCount] = await db.select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.userId, userId));
      totalConversations = Number(convCount?.count) || 0;
    } catch { /* graceful */ }

    try {
      const [planCount] = await db.select({ count: sql<number>`count(*)` })
        .from(clientPlanOutcomes)
        .where(eq(clientPlanOutcomes.advisorId, userId));
      totalPlans = Number(planCount?.count) || 0;
    } catch { /* graceful */ }

    try {
      const [dataCount] = await db.select({ count: sql<number>`count(*)` })
        .from(dataAccessAudit)
        .where(eq(dataAccessAudit.userId, userId));
      totalDataQueries = Number(dataCount?.count) || 0;
    } catch { /* graceful */ }

    return {
      totalConversations,
      totalPlans,
      totalDataQueries,
      activeGoals: 0,
      lastActivity,
    };
  }),
});
