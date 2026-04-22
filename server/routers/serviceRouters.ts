/**
 * Service Routers — Wiring for previously orphaned services
 * esignature, pdfGenerator, creditBureau, crmAdapter
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
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

  /** Register webhook URLs with external platforms */
  registerWebhooks: adminProcedure
    .input(z.object({
      provider: z.enum(["gohighlevel", "smsit", "dripify", "workable", "linkedin"]),
      baseUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const { autoRegisterWebhook } = await import("../services/webhookAutoRegister");
      return autoRegisterWebhook(input.provider, { baseUrl: input.baseUrl });
    }),

  /** Get webhook registration status for all platforms */
  webhookStatus: adminProcedure
    .input(z.object({ baseUrl: z.string().url() }).optional())
    .query(async ({ input }) => {
      const { getAllWebhookUrls } = await import("../services/webhookAutoRegister");
      return getAllWebhookUrls();
    }),

  /** Trigger outbound sync — push leads from lead_pipeline to an external CRM */
  triggerOutboundSync: adminProcedure
    .input(z.object({
      provider: z.enum(["wealthbox", "salesforce", "redtail", "gohighlevel", "smsit", "dripify", "workable", "linkedin"]),
      syncType: z.enum(["full", "incremental"]).default("incremental"),
    }))
    .mutation(async ({ input }) => {
      const { syncCRM } = await import("../services/crmAdapter");
      // For outbound, we need credentials from the connection or env
      const creds: Record<string, string> = {};
      if (input.provider === "gohighlevel") {
        creds.apiToken = process.env.GHL_API_KEY || "";
        creds.locationId = process.env.GHL_LOCATION_ID || "";
      }
      // For other providers, try to get credentials from integration_connections
      if (!creds.apiToken) {
        const { getRawPool } = await import("../db");
        const pool = await getRawPool();
        if (pool) {
          const [rows] = await pool.query(
            `SELECT ic.credentials_encrypted FROM integration_connections ic
             JOIN integration_providers ip ON ic.provider_id = ip.id
             WHERE ip.slug = ? AND ic.status = 'connected' LIMIT 1`,
            [input.provider]
          ) as any;
          if (rows.length > 0 && rows[0].credentials_encrypted) {
            try {
              const { decryptCredentials } = await import("../services/encryption");
              const decrypted = decryptCredentials(rows[0].credentials_encrypted);
              Object.assign(creds, decrypted);
              if (!creds.apiToken) {
                creds.apiToken = (decrypted as any).api_key || (decrypted as any).apiKey || (decrypted as any).access_token || "";
              }
            } catch {}
          }
        }
      }
      const result = await syncCRM(input.provider, creds, "push");
      return {
        provider: input.provider,
        direction: "push",
        contactsSynced: result.contactsSynced,
        contactsCreated: result.contactsCreated,
        contactsUpdated: result.contactsUpdated,
        errors: result.errors,
        status: result.errors.length > 0 ? "partial" : "success",
      };
    }),

  /** Get lead pipeline stats for outbound sync preview */
  outboundSyncPreview: adminProcedure
    .input(z.object({
      provider: z.enum(["wealthbox", "salesforce", "redtail", "gohighlevel", "smsit", "dripify", "workable", "linkedin"]),
    }))
    .query(async ({ input }) => {
      const { getRawPool } = await import("../db");
      const pool = await getRawPool();
      if (!pool) return { totalLeads: 0, unsyncedLeads: 0, syncedLeads: 0 };

      const [totalRows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM lead_pipeline WHERE email IS NOT NULL AND email != ''"
      ) as any;
      const totalLeads = totalRows[0]?.cnt || 0;

      // Leads not from this provider (eligible for push)
      const [unsyncedRows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM lead_pipeline WHERE email IS NOT NULL AND email != '' AND (source IS NULL OR source != ?)",
        [input.provider]
      ) as any;
      const unsyncedLeads = unsyncedRows[0]?.cnt || 0;

      return {
        totalLeads: Number(totalLeads),
        unsyncedLeads: Number(unsyncedLeads),
        syncedLeads: Number(totalLeads) - Number(unsyncedLeads),
      };
    }),

  /** LinkedIn enrichment — enrich a lead with LinkedIn profile data via Manus Data API */
  linkedinEnrich: adminProcedure
    .input(z.object({
      leadId: z.number().optional(),
      email: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!input.leadId) {
        return { leadId: "0", matched: false, profile: null, confidence: 0, enrichedFields: [], error: "leadId is required" };
      }
      const { enrichLead } = await import("../services/linkedinEnrichment");
      return enrichLead(String(input.leadId));
    }),

  /** Batch LinkedIn enrichment for multiple leads */
  linkedinEnrichBatch: adminProcedure
    .input(z.object({
      leadIds: z.array(z.number()).max(50),
    }))
    .mutation(async ({ input }) => {
      const { enrichLead } = await import("../services/linkedinEnrichment");

      const results: Array<{ leadId: number; success: boolean; error?: string }> = [];
      for (const leadId of input.leadIds) {
        try {
          const result = await enrichLead(String(leadId));
          results.push({ leadId, success: result.matched, error: result.matched ? undefined : "No LinkedIn match found" });
          // Rate limit: 2s between enrichments to avoid API throttling
          await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
          results.push({ leadId, success: false, error: e.message });
        }
      }
      return {
        enriched: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  /** Auto-sync status — get current cron job status for CRM sync */
  autoSyncStatus: adminProcedure.query(async () => {
    const { getJobStatus } = await import("../services/cronManager");
    const allJobs = getJobStatus();
    const crmJobs = allJobs.filter(j => j.name.toLowerCase().includes("crm") || j.name.toLowerCase().includes("sync"));
    return { jobs: crmJobs, totalJobs: allJobs.length };
  }),

  /** Toggle auto-sync job on/off */
  toggleAutoSync: adminProcedure
    .input(z.object({ jobId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const { toggleJob } = await import("../services/cronManager");
      return { success: toggleJob(input.jobId, input.enabled) };
    }),

  /** Re-initialize auto-sync (pick up new connections) */
  refreshAutoSync: adminProcedure.mutation(async () => {
    const { initCRMAutoSync } = await import("../services/crmAutoSync");
    await initCRMAutoSync();
    const { getJobStatus } = await import("../services/cronManager");
    const crmJobs = getJobStatus().filter(j => j.name.toLowerCase().includes("crm") || j.name.toLowerCase().includes("sync"));
    return { jobsRegistered: crmJobs.length, jobs: crmJobs };
  }),

  /** Platform connection instructions — returns setup info for each platform */
  connectionInstructions: publicProcedure.query(async () => {
    return [
      {
        provider: "gohighlevel",
        name: "GoHighLevel",
        status: process.env.GHL_API_KEY ? "connected" : "not_configured",
        setupSteps: [
          "Go to GHL Settings > Business Profile > API Keys",
          "Create a Private Integration Token (PIT) with Contacts, Opportunities, and Calendars scopes",
          "Copy the API Key and Location ID",
          "Add them in the Integrations page under GoHighLevel",
        ],
        webhookSteps: [
          "Go to GHL Settings > Webhooks",
          "Click Add Webhook",
          "Paste the webhook URL shown in the CRM Sync dashboard",
          "Select events: Contact Create, Contact Update, Contact Delete",
          "Save the webhook",
        ],
        note: "GHL polling is active as a fallback. Contacts sync every 5 minutes even without webhooks.",
      },
      {
        provider: "smsit",
        name: "SMS-iT",
        status: process.env.SMSIT_API_KEY ? "connected" : "not_configured",
        setupSteps: [
          "Log in to SMS-iT at https://tool-it.smsit.ai",
          "Go to Settings > API > Generate API Key",
          "Copy the API Key",
          "Add it in the Integrations page under SMS-iT",
        ],
        webhookSteps: [
          "Go to SMS-iT Settings > Webhooks",
          "Add the webhook URL shown in the CRM Sync dashboard",
          "Select events: contact.created, contact.updated, contact.opted_out",
        ],
        note: "TCPA compliance: opt-out webhooks are processed immediately.",
      },
      {
        provider: "workable",
        name: "Workable",
        status: "not_configured",
        setupSteps: [
          "Log in to Workable",
          "Go to Settings > Integrations > Access Tokens",
          "Generate an API token with Candidates read/write scope",
          "Copy the token and your Workable subdomain",
          "Add both in the Integrations page under Workable",
        ],
        webhookSteps: [
          "Go to Workable Settings > Integrations > Webhooks",
          "Add the webhook URL shown in the CRM Sync dashboard",
          "Select events: candidate_created, candidate_moved",
        ],
        note: "Workable syncs candidates as leads for recruiting pipeline integration.",
      },
      {
        provider: "dripify",
        name: "Dripify",
        status: "inbound_only",
        setupSteps: [
          "Dripify does not offer a public REST API for pull sync",
          "Sync is inbound-only via Dripify campaign webhooks",
          "In Dripify, go to Campaigns > Select a campaign > Settings > Webhooks",
          "Paste the webhook URL shown in the CRM Sync dashboard",
        ],
        webhookSteps: [
          "Open your Dripify campaign",
          "Go to Settings > Webhooks",
          "Add the webhook URL for each campaign you want to sync",
        ],
        note: "Dripify is inbound-only. Leads flow in from campaigns but cannot be pushed back.",
      },
      {
        provider: "linkedin",
        name: "LinkedIn / Sales Navigator",
        status: "enrichment_available",
        setupSteps: [
          "LinkedIn enrichment works automatically via the Manus Data API (no credentials needed)",
          "For full OAuth sync, connect your LinkedIn account via Settings > Social Accounts",
          "Sales Navigator requires a LinkedIn Sales Navigator subscription",
        ],
        webhookSteps: [],
        note: "LinkedIn enrichment adds profile data (title, company, location, headline) to existing leads. No webhook available.",
      },
      {
        provider: "wealthbox",
        name: "Wealthbox",
        status: "not_configured",
        setupSteps: [
          "Log in to Wealthbox",
          "Go to Settings > API > Generate Access Token",
          "Copy the token",
          "Add it in the Integrations page under Wealthbox",
        ],
        webhookSteps: ["Wealthbox webhooks are registered automatically when you connect"],
        note: "Wealthbox is a popular CRM for financial advisors with full bidirectional sync.",
      },
      {
        provider: "salesforce",
        name: "Salesforce",
        status: "not_configured",
        setupSteps: [
          "Log in to Salesforce",
          "Go to Setup > Apps > App Manager > New Connected App",
          "Enable OAuth and add scopes: api, refresh_token",
          "Copy the Consumer Key and Consumer Secret",
          "Add them in the Integrations page under Salesforce",
        ],
        webhookSteps: [
          "Salesforce uses Outbound Messages or Platform Events for webhooks",
          "Configure in Setup > Workflow Rules > Outbound Messages",
        ],
        note: "Salesforce requires OAuth2 Connected App setup. Full bidirectional sync supported.",
      },
      {
        provider: "redtail",
        name: "Redtail CRM",
        status: "not_configured",
        setupSteps: [
          "Log in to Redtail CRM",
          "Go to Settings > Integrations > API Access",
          "Generate an API key",
          "Add it in the Integrations page under Redtail",
        ],
        webhookSteps: [],
        note: "Redtail is a CRM designed for financial advisors. Pull-based sync with incremental updates.",
      },
    ];
  }),
});
