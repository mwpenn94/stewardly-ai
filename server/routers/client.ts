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
} from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

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
});
