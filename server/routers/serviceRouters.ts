/**
 * Service Routers — Wiring for previously orphaned services
 * esignature, pdfGenerator, creditBureau, crmAdapter
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── eSignature Router ────────────────────────────────────────────────────
export const esignatureRouter = router({
  getEnvelopes: protectedProcedure
    .input(z.object({ clientUserId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { getEnvelopesByProfessional, getEnvelopesByClient } = await import("../services/esignatureService");
      if (input?.clientUserId) return getEnvelopesByClient(input.clientUserId);
      return getEnvelopesByProfessional(ctx.user.id);
    }),

  getEnvelope: protectedProcedure
    .input(z.object({ envelopeId: z.string() }))
    .query(async ({ input }) => {
      const { getEnvelopeByEnvelopeId } = await import("../services/esignatureService");
      const envelope = await getEnvelopeByEnvelopeId(input.envelopeId);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND", message: "Envelope not found" });
      return envelope;
    }),

  create: protectedProcedure
    .input(z.object({
      documentType: z.string().optional(),
      clientUserId: z.number().optional(),
      provider: z.enum(["docusign", "dropbox_sign", "manual"]).default("docusign"),
      relatedProductId: z.number().optional(),
      relatedQuoteId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createEnvelope } = await import("../services/esignatureService");
      return createEnvelope({
        professionalId: ctx.user.id,
        clientUserId: input.clientUserId,
        provider: input.provider,
        documentType: input.documentType,
        relatedProductId: input.relatedProductId,
        relatedQuoteId: input.relatedQuoteId,
      });
    }),

  getPending: protectedProcedure.query(async ({ ctx }) => {
    const { getPendingEnvelopes } = await import("../services/esignatureService");
    return getPendingEnvelopes(ctx.user.id);
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const { getSignatureStats } = await import("../services/esignatureService");
    return getSignatureStats(ctx.user.id);
  }),
});

// ─── PDF Generator Router ────────────────────────────────────────────────
export const pdfRouter = router({
  generateReport: protectedProcedure
    .input(z.object({
      type: z.enum(["financial", "conversation", "suitability"]),
      clientName: z.string(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      sections: z.array(z.object({
        title: z.string(),
        type: z.string(),
        data: z.any(),
      })).optional(),
      conversationTitle: z.string().optional(),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
        timestamp: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateFinancialReport, generateConversationPDF, generateSuitabilityPDF } = await import("../services/pdfGenerator");
      let buffer: Buffer;
      const now = new Date();
      switch (input.type) {
        case "financial":
          buffer = await generateFinancialReport({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            generatedAt: now,
            sections: (input.sections || []) as any,
          });
          break;
        case "conversation":
          buffer = await generateConversationPDF({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            conversationTitle: input.conversationTitle || "Conversation",
            mode: "chat",
            messages: (input.messages || []).map(m => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              createdAt: m.timestamp ? new Date(m.timestamp) : now,
            })),
            generatedAt: now,
          });
          break;
        case "suitability":
          buffer = await generateSuitabilityPDF({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            generatedAt: now,
            overallScore: 0,
            dimensions: [],
            confidenceLevel: 0,
            dataCompleteness: 0,
            status: "draft",
          });
          break;
      }
      return { pdf: buffer.toString("base64"), filename: `${input.clientName}-${input.type}-report.pdf` };
    }),
});

// ─── Credit Bureau Router ────────────────────────────────────────────────
export const creditBureauRouter = router({
  getRating: protectedProcedure
    .input(z.object({ score: z.number().min(300).max(850) }))
    .query(async ({ input }) => {
      const { getCreditRating } = await import("../services/creditBureau");
      return getCreditRating(input.score);
    }),

  analyzeDTI: protectedProcedure
    .input(z.object({
      monthlyDebtPayments: z.number().min(0),
      grossMonthlyIncome: z.number().min(1),
    }))
    .query(async ({ input }) => {
      const { analyzeDTI } = await import("../services/creditBureau");
      return analyzeDTI(input.monthlyDebtPayments, input.grossMonthlyIncome);
    }),

  assessInsuranceImpact: protectedProcedure
    .input(z.object({ creditScore: z.number().min(300).max(850) }))
    .query(async ({ input }) => {
      const { assessInsuranceImpact } = await import("../services/creditBureau");
      return assessInsuranceImpact(input.creditScore);
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const { getCreditHistory } = await import("../services/creditBureau");
    return getCreditHistory(ctx.user.id);
  }),
});

// ─// ─── CRM Adapter Router ─────────────────────────────────────────────
export const crmRouter = router({
  sync: adminProcedure
    .input(z.object({
      provider: z.enum(["wealthbox", "salesforce", "redtail", "gohighlevel", "dripify", "smsit", "workable", "linkedin"]),
      direction: z.enum(["push", "pull", "bidirectional"]).default("pull"),
    }))
    .mutation(async ({ input }) => {
      const { syncCRM } = await import("../services/crmAdapter");
      return syncCRM(input.provider, {}, input.direction);
    }),

  syncHistory: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { crmSyncLog } = await import("../../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(crmSyncLog).orderBy(desc(crmSyncLog.createdAt)).limit(50);
  }),

  providers: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { crmSyncLog } = await import("../../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const rows = await db.select({
      provider: crmSyncLog.crmProvider,
      lastStatus: sql<string>`SUBSTRING_INDEX(GROUP_CONCAT(${crmSyncLog.status} ORDER BY ${crmSyncLog.createdAt} DESC), ',', 1)`,
      lastSync: sql<string>`MAX(${crmSyncLog.createdAt})`,
      totalSynced: sql<number>`COALESCE(SUM(${crmSyncLog.recordsSynced}), 0)`,
    }).from(crmSyncLog).groupBy(crmSyncLog.crmProvider);
    return rows;
  }),

  /** Unified cross-platform sync dashboard data */
  unifiedDashboard: adminProcedure.query(async () => {
    const { getRawPool } = await import("../db");
    const pool = await getRawPool();
    if (!pool) return { platforms: [], recentEvents: [], syncLogs: [] };

    // 1. Per-platform status from integration_connections + integration_providers
    const [platforms] = await pool.query(`
      SELECT
        ip.slug AS provider,
        ip.name AS providerName,
        ip.category,
        ic.status AS connectionStatus,
        ic.last_sync_at AS lastSyncAt,
        ic.last_sync_status AS lastSyncStatus,
        ic.records_synced AS totalRecordsSynced,
        ic.last_sync_error AS lastSyncError,
        ic.id AS connectionId
      FROM integration_connections ic
      JOIN integration_providers ip ON ic.provider_id = ip.id
      ORDER BY ic.last_sync_at DESC
    `) as any;

    // 2. Supplement with crm_sync_log data for providers not in integration_connections
    const [crmProviders] = await pool.query(`
      SELECT
        crm_provider AS provider,
        MAX(created_at) AS lastSyncAt,
        SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY created_at DESC), ',', 1) AS lastSyncStatus,
        COALESCE(SUM(records_synced), 0) AS totalRecordsSynced
      FROM crm_sync_log
      GROUP BY crm_provider
    `) as any;

    // 3. Recent webhook events across all platforms (unified view)
    const [recentEvents] = await pool.query(`
      (
        SELECT
          id, 'integration' AS source, provider_slug AS provider,
          event_type AS eventType, processing_status AS status,
          processing_error AS error, received_at AS receivedAt
        FROM integration_webhook_events
        ORDER BY received_at DESC LIMIT 25
      )
      UNION ALL
      (
        SELECT
          CAST(id AS CHAR) AS id, 'dripify' AS source, 'dripify' AS provider,
          event_type AS eventType,
          CASE WHEN processed = 1 THEN 'processed' ELSE 'pending' END AS status,
          NULL AS error, received_at AS receivedAt
        FROM dripify_webhook_events
        ORDER BY received_at DESC LIMIT 25
      )
      ORDER BY receivedAt DESC LIMIT 50
    `) as any;

    // 4. Recent sync logs from integration_sync_logs
    const [syncLogs] = await pool.query(`
      SELECT
        isl.id, ip.slug AS provider, ip.name AS providerName,
        isl.sync_type AS syncType, isl.direction,
        isl.started_at AS startedAt, isl.completed_at AS completedAt,
        isl.status, isl.records_created AS recordsCreated,
        isl.records_updated AS recordsUpdated,
        isl.records_failed AS recordsFailed,
        isl.triggered_by AS triggeredBy
      FROM integration_sync_logs isl
      JOIN integration_connections ic ON isl.connection_id = ic.id
      JOIN integration_providers ip ON ic.provider_id = ip.id
      ORDER BY isl.started_at DESC
      LIMIT 50
    `) as any;

    // Merge crm_sync_log providers into platforms list (avoid duplicates)
    const platformSlugs = new Set((platforms as any[]).map((p: any) => p.provider));
    for (const cp of crmProviders as any[]) {
      if (!platformSlugs.has(cp.provider)) {
        (platforms as any[]).push({
          provider: cp.provider,
          providerName: cp.provider.charAt(0).toUpperCase() + cp.provider.slice(1),
          category: "crm",
          connectionStatus: "connected",
          lastSyncAt: cp.lastSyncAt,
          lastSyncStatus: cp.lastSyncStatus === "completed" ? "success" : cp.lastSyncStatus,
          totalRecordsSynced: Number(cp.totalRecordsSynced) || 0,
          lastSyncError: null,
          connectionId: null,
        });
      }
    }

    return { platforms, recentEvents, syncLogs };
  }),

  /** Webhook activity feed for a specific platform */
  platformWebhookEvents: adminProcedure
    .input(z.object({
      provider: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const { getRawPool } = await import("../db");
      const pool = await getRawPool();
      if (!pool) return [];

      if (input.provider === "dripify") {
        const [rows] = await pool.query(
          "SELECT id, event_type AS eventType, processed AS isProcessed, lead_pipeline_id AS leadPipelineId, received_at AS receivedAt, processed_at AS processedAt FROM dripify_webhook_events ORDER BY received_at DESC LIMIT ?",
          [input.limit]
        ) as any;
        return rows;
      }

      const [rows] = await pool.query(
        "SELECT id, event_type AS eventType, processing_status AS status, processing_error AS error, received_at AS receivedAt, processed_at AS processedAt FROM integration_webhook_events WHERE provider_slug = ? ORDER BY received_at DESC LIMIT ?",
        [input.provider, input.limit]
      ) as any;
      return rows;
    }),
});
