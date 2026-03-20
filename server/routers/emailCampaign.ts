/**
 * Email Campaign Router
 * Provides tRPC procedures for campaign management, recipient handling,
 * AI-powered content generation, batch sending, and analytics.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createCampaign,
  updateCampaign,
  getCampaigns,
  getCampaign,
  deleteCampaign,
  addRecipients,
  getRecipients,
  removeRecipient,
  generateEmailContent,
  sendCampaign,
  getCampaignAnalytics,
} from "../services/emailCampaign";

export const emailCampaignRouter = router({
  // ─── Campaign CRUD ─────────────────────────────────────────────────
  list: protectedProcedure.query(({ ctx }) => getCampaigns(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getCampaign(input.id, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      subject: z.string().min(1).max(500),
      bodyHtml: z.string().min(1),
      templateId: z.string().optional(),
      recipientFilter: z.record(z.string(), z.unknown()).optional(),
      scheduledAt: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => createCampaign(ctx.user.id, input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      subject: z.string().min(1).max(500).optional(),
      bodyHtml: z.string().min(1).optional(),
      recipientFilter: z.record(z.string(), z.unknown()).optional(),
      scheduledAt: z.number().nullable().optional(),
      status: z.enum(["draft", "scheduled", "paused", "cancelled"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateCampaign(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteCampaign(input.id, ctx.user.id)),

  // ─── Recipient Management ──────────────────────────────────────────
  addRecipients: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      recipients: z.array(z.object({
        email: z.string().email(),
        name: z.string().optional(),
      })).min(1).max(1000),
    }))
    .mutation(({ input }) => addRecipients(input.campaignId, input.recipients)),

  getRecipients: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(({ input }) => getRecipients(input.campaignId)),

  removeRecipient: protectedProcedure
    .input(z.object({ sendId: z.number() }))
    .mutation(({ input }) => removeRecipient(input.sendId)),

  // ─── AI Content Generation ─────────────────────────────────────────
  generateContent: protectedProcedure
    .input(z.object({
      purpose: z.string().min(1).max(2000),
      tone: z.enum(["professional", "friendly", "formal", "casual", "urgent"]).optional(),
      recipientType: z.enum(["client", "prospect", "partner", "team", "general"]).optional(),
      keyPoints: z.array(z.string()).max(10).optional(),
    }))
    .mutation(({ input }) => generateEmailContent(input)),

  // ─── Send Campaign ─────────────────────────────────────────────────
  send: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(({ ctx, input }) => sendCampaign(input.campaignId, ctx.user.id)),

  // ─── Analytics ─────────────────────────────────────────────────────
  analytics: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(({ input }) => getCampaignAnalytics(input.campaignId)),
});
