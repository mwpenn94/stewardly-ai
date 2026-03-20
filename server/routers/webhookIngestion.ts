/**
 * Webhook Ingestion Router
 * tRPC procedures for managing webhooks + Express route for receiving webhook payloads
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import {
  registerWebhook,
  listWebhooks,
  toggleWebhook,
  deleteWebhook,
  rotateSecret,
  getEventLog,
  getWebhookStats,
  processWebhook,
  WebhookError,
} from "../services/webhookIngestion";
import type { Express, Request, Response } from "express";

// ─── tRPC Router (management) ──────────────────────────────────────────────

export const webhookIngestionRouter = router({
  // Register a new webhook endpoint
  register: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      allowedIps: z.array(z.string()).optional(),
      rateLimit: z.number().min(1).max(1000).optional(),
      fieldMapping: z.record(z.string(), z.string()).optional(),
      defaultRecordType: z.enum([
        "customer_profile", "organization", "product", "market_price",
        "regulatory_update", "news_article", "competitor_intel",
        "document_extract", "entity", "metric",
      ]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return registerWebhook({
        ...input,
        userId: ctx.user.id,
      });
    }),

  // List all registered webhooks
  list: protectedProcedure.query(async () => {
    return listWebhooks();
  }),

  // Toggle webhook active/inactive
  toggle: protectedProcedure
    .input(z.object({
      webhookId: z.string(),
      active: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return toggleWebhook(input.webhookId, input.active);
    }),

  // Delete a webhook
  delete: protectedProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ input }) => {
      return deleteWebhook(input.webhookId);
    }),

  // Rotate webhook secret key
  rotateSecret: protectedProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ input }) => {
      const newSecret = await rotateSecret(input.webhookId);
      if (!newSecret) throw new Error("Webhook not found");
      return { secretKey: newSecret };
    }),

  // Get webhook event log
  eventLog: protectedProcedure
    .input(z.object({
      webhookId: z.string().optional(),
      limit: z.number().min(1).max(200).optional(),
    }))
    .query(async ({ input }) => {
      return getEventLog(input.webhookId, input.limit);
    }),

  // Get webhook stats
  stats: protectedProcedure.query(async () => {
    return getWebhookStats();
  }),
});

// ─── Express Route (public webhook receiver) ───────────────────────────────

export function registerWebhookRoutes(app: Express) {
  // POST /api/webhooks/:webhookId — receive webhook payloads
  app.post("/api/webhooks/:webhookId", async (req: Request, res: Response) => {
    const { webhookId } = req.params;
    const signature = (req.headers["x-webhook-signature"] || req.headers["x-hub-signature-256"]) as string | undefined;
    const sourceIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";

    // Get raw body
    let rawBody: string;
    if (typeof req.body === "string") {
      rawBody = req.body;
    } else if (req.body && typeof req.body === "object") {
      rawBody = JSON.stringify(req.body);
    } else {
      res.status(400).json({ error: "Empty request body" });
      return;
    }

    try {
      const result = await processWebhook(webhookId, rawBody, signature, sourceIp);
      res.status(200).json({
        status: "accepted",
        accepted: result.accepted,
        rejected: result.rejected,
        jobId: result.jobId,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err: any) {
      if (err instanceof WebhookError) {
        const statusMap: Record<string, number> = {
          WEBHOOK_NOT_FOUND: 404,
          WEBHOOK_DISABLED: 403,
          IP_NOT_ALLOWED: 403,
          INVALID_SIGNATURE: 401,
          RATE_LIMITED: 429,
          INVALID_PAYLOAD: 400,
        };
        res.status(statusMap[err.code] || 500).json({
          status: "error",
          code: err.code,
          message: err.message,
        });
      } else {
        console.error("[Webhook] Unexpected error:", err);
        res.status(500).json({
          status: "error",
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        });
      }
    }
  });

  // GET /api/webhooks/:webhookId/health — health check for webhook
  app.get("/api/webhooks/:webhookId/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", timestamp: Date.now() });
  });
}
