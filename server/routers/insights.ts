/**
 * Proactive Insights Router
 * Portfolio drift, life events, engagement scoring, compliance alerts, at-risk flagging
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { proactiveInsights, engagementScores } from "../../drizzle/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

async function db() {
  return (await import("../db")).getDb();
}

export const insightsRouter = router({
  /** List insights for the current user, sorted by priority */
  list: protectedProcedure
    .input(z.object({
      category: z.enum(["compliance", "portfolio", "tax", "engagement", "spending", "life_event"]).optional(),
      status: z.enum(["new", "viewed", "acted", "dismissed", "snoozed"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const d = (await db())!;
      const conditions = [eq(proactiveInsights.userId, ctx.user!.id)];
      if (input?.category) conditions.push(eq(proactiveInsights.category, input.category));
      if (input?.status) {
        conditions.push(eq(proactiveInsights.status, input.status));
      } else {
        // By default exclude dismissed
        conditions.push(ne(proactiveInsights.status, "dismissed"));
      }
      return d
        .select()
        .from(proactiveInsights)
        .where(and(...conditions))
        .orderBy(
          sql`FIELD(${proactiveInsights.priority}, 'critical', 'high', 'medium', 'low')`,
          desc(proactiveInsights.createdAt)
        )
        .limit(input?.limit ?? 50);
    }),

  /** Get insight stats (counts by category and priority) */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const d = (await db())!;
    const all = await d
      .select()
      .from(proactiveInsights)
      .where(and(
        eq(proactiveInsights.userId, ctx.user!.id),
        ne(proactiveInsights.status, "dismissed")
      ));

    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let newCount = 0;

    for (const i of all) {
      byCategory[i.category] = (byCategory[i.category] || 0) + 1;
      byPriority[i.priority] = (byPriority[i.priority] || 0) + 1;
      if (i.status === "new") newCount++;
    }

    return { total: all.length, newCount, byCategory, byPriority };
  }),

  /** Update insight status (act, dismiss, snooze) */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["viewed", "acted", "dismissed", "snoozed"]),
      snoozeDays: z.number().min(1).max(90).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [insight] = await d.select().from(proactiveInsights).where(
        and(eq(proactiveInsights.id, input.id), eq(proactiveInsights.userId, ctx.user!.id))
      );
      if (!insight) throw new TRPCError({ code: "NOT_FOUND" });

      const updates: Record<string, any> = { status: input.status };
      if (input.status === "acted") updates.actedAt = new Date();
      if (input.status === "dismissed") updates.dismissedAt = new Date();
      if (input.status === "snoozed" && input.snoozeDays) {
        const snoozeDate = new Date();
        snoozeDate.setDate(snoozeDate.getDate() + input.snoozeDays);
        updates.snoozeUntil = snoozeDate;
      }

      await d.update(proactiveInsights).set(updates).where(eq(proactiveInsights.id, input.id));
      return { success: true };
    }),

  /** Generate AI-powered insights for the current user */
  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const d = (await db())!;

    const prompt = `You are a proactive financial advisor AI. Generate 3-5 actionable insights for a client.

Consider these categories:
- **compliance**: Suitability reviews, CE deadlines, license renewals, regulatory filings
- **portfolio**: Drift detection, rebalancing opportunities, concentration risk
- **tax**: Tax-loss harvesting windows, Roth conversion opportunities, estimated tax payments
- **engagement**: Client activity patterns, meeting cadence, follow-up reminders
- **life_event**: Age milestones (59½, 62, 65, 67, 72/73, 75), family events, career changes
- **spending**: Budget deviations, unusual patterns, savings rate changes

For each insight, provide:
- category (one of the above)
- priority (low, medium, high, critical)
- title (concise, under 100 chars)
- description (2-3 sentences explaining the insight)
- suggestedAction (specific next step the advisor should take)

Return as JSON array.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a proactive financial advisor intelligence engine. Generate realistic, actionable insights." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    priority: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    suggestedAction: { type: "string" },
                  },
                  required: ["category", "priority", "title", "description", "suggestedAction"],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      },
    });

    try {
      const parsed = JSON.parse(String(response.choices?.[0]?.message?.content ?? "{}"));
      const validCategories = ["compliance", "portfolio", "tax", "engagement", "spending", "life_event"];
      const validPriorities = ["low", "medium", "high", "critical"];
      let inserted = 0;

      for (const insight of (parsed.insights || [])) {
        const cat = validCategories.includes(insight.category) ? insight.category : "portfolio";
        const pri = validPriorities.includes(insight.priority) ? insight.priority : "medium";
        await d.insert(proactiveInsights).values({
          userId: ctx.user!.id,
          category: cat as any,
          priority: pri as any,
          title: String(insight.title).slice(0, 256),
          description: String(insight.description),
          suggestedAction: String(insight.suggestedAction),
          status: "new",
        });
        inserted++;
      }
      return { generated: inserted };
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate insights" });
    }
  }),

  /** Get engagement scores */
  engagementScores: protectedProcedure.query(async ({ ctx }) => {
    const d = (await db())!;
    return d
      .select()
      .from(engagementScores)
      .where(eq(engagementScores.userId, ctx.user!.id))
      .orderBy(desc(engagementScores.createdAt))
      .limit(10);
  }),

  /** Delete an insight */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      await d.delete(proactiveInsights).where(
        and(eq(proactiveInsights.id, input.id), eq(proactiveInsights.userId, ctx.user!.id))
      );
      return { success: true };
    }),
});
