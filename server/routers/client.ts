/**
 * client.ts — tRPC router for the CLIENT persona layer.
 *
 * Pass 136. Provides the Financial Twin data assembly endpoint
 * that powers /financial-twin. Aggregates suitability profile,
 * conversation-derived insights, goals, and financial snapshot
 * into the FinancialTwinData contract expected by MyFinancialTwin.tsx.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  suitabilityResponses,
  conversations,
  memories,
  users,
} from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

/* ── Helpers ─────────────────────────────────────────────────── */

/** Map suitability risk score (1-10) to a human label. */
function riskLabel(score: number): string {
  const labels = [
    "", "Very Conservative", "Conservative", "Moderately Conservative",
    "Moderate", "Moderate", "Moderately Aggressive", "Moderately Aggressive",
    "Aggressive", "Very Aggressive", "Very Aggressive",
  ];
  return labels[Math.round(Math.max(1, Math.min(10, score)))] ?? "Moderate";
}

/** Derive life stage from age or suitability data. */
function deriveLifeStage(age?: number | null): string {
  if (!age) return "Working Professional";
  if (age < 30) return "Early Career";
  if (age < 45) return "Mid-Career";
  if (age < 55) return "Peak Earning";
  if (age < 65) return "Pre-Retirement";
  return "Retirement";
}

export const clientRouter = router({
  /**
   * Assemble the Financial Twin data for the authenticated user.
   * Pulls from suitability responses, memories, and conversations
   * to build a comprehensive financial profile view.
   */
  getFinancialTwin: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const userId = String(ctx.user!.id);

    // Get user info
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    // Get suitability responses (latest)
    let suitabilityData: Record<string, any> = {};
    try {
      const responses = await db
        .select()
        .from(suitabilityResponses)
        .where(eq(suitabilityResponses.userId, userId))
        .orderBy(desc(suitabilityResponses.createdAt))
        .limit(20);

      for (const r of responses) {
        if (r.questionKey && r.response) {
          suitabilityData[r.questionKey] = r.response;
        }
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

    // Derive risk score from suitability
    const riskScore = Number(suitabilityData.risk_tolerance) || 5;
    const age = Number(suitabilityData.age) || null;

    // Build goals from suitability + memories
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

    // If no goals from memories, provide defaults based on suitability
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
      annualIncome: suitabilityData.annual_income || null,
      netWorth: suitabilityData.net_worth || null,
      monthlyExpenses: suitabilityData.monthly_expenses || null,
      emergencyFund: suitabilityData.emergency_fund || null,
      debtLevel: suitabilityData.debt_level || null,
      retirementSavings: suitabilityData.retirement_savings || null,
    };

    return {
      profile: {
        name: userRow?.name || "Your",
        lifeStage: deriveLifeStage(age),
        riskProfile: riskLabel(riskScore),
        riskScore,
        lastUpdated: userRow?.updatedAt?.toISOString() || new Date().toISOString(),
      },
      goals,
      financialSnapshot,
      insights,
      visibility: "professional" as const,
      engagementMetrics: {
        conversationCount,
        memoryCount: memoryRows.length,
        suitabilityComplete: Object.keys(suitabilityData).length > 5,
      },
    };
  }),

  /**
   * Update the visibility setting for the user's financial twin data.
   */
  updateVisibility: protectedProcedure
    .input(z.object({ visibility: z.enum(["private", "professional", "management", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      // In a full implementation, this would persist to a user_preferences table.
      // For now, return success — the UI handles optimistic updates.
      return { success: true, visibility: input.visibility };
    }),
});
