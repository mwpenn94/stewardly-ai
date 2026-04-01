/**
 * Meeting Intelligence Router
 * Pre-meeting briefs, post-meeting summaries, action items, follow-up emails
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { meetings, meetingActionItems } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"

async function db() {
  return (await import("../db")).getDb();
}

export const meetingsRouter = router({
  /** List meetings for the current user */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["scheduled", "preparing", "in_progress", "completed", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const d = (await db())!;
      const conditions = [eq(meetings.userId, ctx.user!.id)];
      if (input?.status) conditions.push(eq(meetings.status, input.status));
      return d
        .select()
        .from(meetings)
        .where(and(...conditions))
        .orderBy(desc(meetings.scheduledAt))
        .limit(input?.limit ?? 20);
    }),

  /** Get a single meeting with its action items */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const d = (await db())!;
      const [meeting] = await d.select().from(meetings).where(
        and(eq(meetings.id, input.id), eq(meetings.userId, ctx.user!.id))
      );
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });
      const actions = await d.select().from(meetingActionItems).where(eq(meetingActionItems.meetingId, input.id));
      return { ...meeting, actionItems: actions };
    }),

  /** Create a new meeting */
  create: protectedProcedure
    .input(z.object({
      clientName: z.string().min(1).max(256),
      clientId: z.number().optional(),
      meetingType: z.enum(["initial_consultation", "portfolio_review", "financial_plan", "tax_planning", "estate_planning", "insurance_review", "general", "follow_up"]).default("general"),
      scheduledAt: z.string().optional(),
      organizationId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [result] = await d.insert(meetings).values({
        userId: ctx.user!.id,
        clientName: input.clientName,
        clientId: input.clientId,
        meetingType: input.meetingType,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        organizationId: input.organizationId,
        status: "scheduled",
      });
      return { id: result.insertId };
    }),

  /** Generate pre-meeting brief using AI */
  generateBrief: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [meeting] = await d.select().from(meetings).where(
        and(eq(meetings.id, input.meetingId), eq(meetings.userId, ctx.user!.id))
      );
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      await d.update(meetings).set({ status: "preparing" }).where(eq(meetings.id, input.meetingId));

      const prompt = `Generate a comprehensive pre-meeting brief for an upcoming ${meeting.meetingType?.replace(/_/g, " ")} meeting with client "${meeting.clientName}".

Include the following sections:
1. **Client Overview** — summarize what we know about this client
2. **Meeting Objectives** — key goals for this meeting type
3. **Discussion Points** — suggested agenda items
4. **Preparation Checklist** — documents/data to have ready
5. **Compliance Reminders** — regulatory considerations for this meeting type
6. **Suggested Questions** — 3-5 questions to ask the client

Keep it concise and actionable. Format in markdown.`;

      const response = await contextualLLM({ userId: ctx.user?.id, contextType: "meeting",
        messages: [
          { role: "system", content: "You are a financial advisor's meeting preparation assistant. Generate thorough but concise pre-meeting briefs." },
          { role: "user", content: prompt },
        ],
      });

      const brief = String(response.choices?.[0]?.message?.content ?? "Unable to generate brief.");

      await d.update(meetings).set({
        preMeetingBrief: brief,
        status: "scheduled",
      }).where(eq(meetings.id, input.meetingId));

      return { brief };
    }),

  /** Generate post-meeting summary from notes/transcript */
  generateSummary: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      notes: z.string().min(10).max(50000),
    }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [meeting] = await d.select().from(meetings).where(
        and(eq(meetings.id, input.meetingId), eq(meetings.userId, ctx.user!.id))
      );
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const prompt = `Based on these meeting notes from a ${meeting.meetingType?.replace(/_/g, " ")} with "${meeting.clientName}", generate a structured post-meeting summary.

Meeting Notes:
${input.notes}

Generate the following sections:
1. **Meeting Summary** — 2-3 sentence overview
2. **Key Decisions** — bullet list of decisions made
3. **Action Items** — specific tasks with suggested owners and deadlines (format: "- [ ] Task description | Owner: X | Due: Y")
4. **Follow-Up Required** — what needs to happen next
5. **Compliance Notes** — any regulatory or compliance considerations discussed
6. **Suggested Follow-Up Date** — recommended next meeting date

Format in markdown. Be specific and actionable.`;

      const response = await contextualLLM({ userId: ctx.user?.id, contextType: "meeting",
        messages: [
          { role: "system", content: "You are a financial advisor's meeting summary assistant. Generate thorough post-meeting summaries with clear action items." },
          { role: "user", content: prompt },
        ],
      });

      const summary = String(response.choices?.[0]?.message?.content ?? "Unable to generate summary.");

      // Extract action items from the summary using AI
      const actionResponse = await contextualLLM({ userId: ctx.user?.id, contextType: "meeting",
        messages: [
          { role: "system", content: "Extract action items from this meeting summary. Return a JSON array of objects with fields: title (string), description (string), assignedTo (string), priority (low|medium|high|urgent), dueDate (ISO string or null)." },
          { role: "user", content: summary },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "action_items",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      assignedTo: { type: "string" },
                      priority: { type: "string" },
                      dueDate: { type: ["string", "null"] },
                    },
                    required: ["title", "description", "assignedTo", "priority", "dueDate"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      });

      // Parse and insert action items
      try {
        const parsed = JSON.parse(String(actionResponse.choices?.[0]?.message?.content ?? "{}"));
        if (parsed.items?.length) {
          for (const item of parsed.items) {
            await d.insert(meetingActionItems).values({
              meetingId: input.meetingId,
              userId: ctx.user!.id,
              title: item.title,
              description: item.description,
              assignedTo: item.assignedTo,
              priority: ["low", "medium", "high", "urgent"].includes(item.priority) ? item.priority as any : "medium",
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
            });
          }
        }
      } catch {
        // Action item extraction failed — summary still saved
      }

      // Update meeting
      await d.update(meetings).set({
        postMeetingSummary: summary,
        transcript: input.notes,
        status: "completed",
        completedAt: new Date(),
      }).where(eq(meetings.id, input.meetingId));

      return { summary };
    }),

  /** Generate follow-up email draft */
  generateFollowUpEmail: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [meeting] = await d.select().from(meetings).where(
        and(eq(meetings.id, input.meetingId), eq(meetings.userId, ctx.user!.id))
      );
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });
      if (!meeting.postMeetingSummary) throw new TRPCError({ code: "BAD_REQUEST", message: "Generate a post-meeting summary first" });

      const prompt = `Draft a professional follow-up email to "${meeting.clientName}" after our ${meeting.meetingType?.replace(/_/g, " ")} meeting.

Meeting Summary:
${meeting.postMeetingSummary}

The email should:
- Thank them for their time
- Summarize key decisions and next steps
- Include action items and deadlines
- Mention the suggested follow-up date
- Be warm but professional
- Be concise (under 300 words)`;

      const response = await contextualLLM({ userId: ctx.user?.id, contextType: "meeting",
        messages: [
          { role: "system", content: "You are a financial advisor drafting a follow-up email. Write in a warm, professional tone." },
          { role: "user", content: prompt },
        ],
      });

      const email = String(response.choices?.[0]?.message?.content ?? "Unable to generate email.");

      await d.update(meetings).set({ followUpEmail: email }).where(eq(meetings.id, input.meetingId));
      return { email };
    }),

  /** Update action item status */
  updateActionItem: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      const [item] = await d.select().from(meetingActionItems).where(
        and(eq(meetingActionItems.id, input.id), eq(meetingActionItems.userId, ctx.user!.id))
      );
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const updates: Record<string, any> = {};
      if (input.status) updates.status = input.status;
      if (input.priority) updates.priority = input.priority;
      if (input.status === "completed") updates.completedAt = new Date();

      await d.update(meetingActionItems).set(updates).where(eq(meetingActionItems.id, input.id));
      return { success: true };
    }),

  /** Get all action items for the user */
  actionItems: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const d = (await db())!;
      const conditions = [eq(meetingActionItems.userId, ctx.user!.id)];
      if (input?.status) conditions.push(eq(meetingActionItems.status, input.status));
      return d.select().from(meetingActionItems).where(and(...conditions)).orderBy(desc(meetingActionItems.createdAt));
    }),

  /** Delete a meeting */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      await d.delete(meetingActionItems).where(eq(meetingActionItems.meetingId, input.id));
      await d.delete(meetings).where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.user!.id)));
      return { success: true };
    }),
});
