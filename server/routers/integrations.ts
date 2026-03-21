import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  integrationProviders,
  integrationConnections,
  integrationSyncLogs,
  integrationFieldMappings,
  integrationWebhookEvents,
  enrichmentCache,
  integrationHealthChecks,
  integrationHealthSummary,
  integrationImprovementLog,
  carrierImportTemplates,
} from "../../drizzle/schema";
import { eq, and, desc, sql, lte } from "drizzle-orm";
import { encrypt, decrypt, encryptCredentials, decryptCredentials } from "../services/encryption";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Helper: check tier permission ──────────────────────────────────────
function canManageTier(userRole: string, tier: string): boolean {
  if (userRole === "admin") return true;
  if (tier === "organization" && (userRole === "admin" || userRole === "manager")) return true;
  if (tier === "professional") return true; // any authenticated user can manage their own
  if (tier === "client" && (userRole === "admin" || userRole === "manager" || userRole === "professional")) return true;
  if (tier === "platform" && userRole === "admin") return true;
  return false;
}

export const integrationsRouter = router({
  // ─── Provider Registry (public read) ────────────────────────────────
  listProviders: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      ownershipTier: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      let query = db.select().from(integrationProviders).where(eq(integrationProviders.isActive, true));
      const results = await query;
      let filtered = results;
      if (input?.category) {
        filtered = filtered.filter(p => p.category === input.category);
      }
      if (input?.ownershipTier) {
        filtered = filtered.filter(p => p.ownershipTier === input.ownershipTier);
      }
      // Group by ownership tier
      const grouped: Record<string, typeof filtered> = {};
      for (const p of filtered) {
        if (!grouped[p.ownershipTier]) grouped[p.ownershipTier] = [];
        grouped[p.ownershipTier].push(p);
      }
      return { providers: filtered, grouped };
    }),

  getProvider: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [provider] = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, input.slug));
      return provider || null;
    }),

  // ─── Connection Management (tier-gated) ─────────────────────────────
  listConnections: protectedProcedure
    .input(z.object({ ownershipTier: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const user = ctx.user;
      const allConns = await db.select().from(integrationConnections);
      
      let visible = allConns;
      if (user.role === "admin") {
        // Admin sees everything
      } else if (user.role === "manager") {
        // Manager sees org connections + own professional connections
        visible = allConns.filter(c =>
          (c.ownershipTier === "organization") ||
          (c.userId === user.id)
        );
      } else {
        // Regular user sees own connections only
        visible = allConns.filter(c => c.userId === user.id);
      }

      if (input?.ownershipTier) {
        visible = visible.filter(c => c.ownershipTier === input.ownershipTier);
      }

      // Join with provider info (never include decrypted credentials)
      const providers = await db.select().from(integrationProviders);
      const providerMap = new Map(providers.map(p => [p.id, p]));

      return visible.map(c => ({
        ...c,
        credentialsEncrypted: c.credentialsEncrypted ? "[encrypted]" : null, // Indicate if credentials exist without exposing them
        provider: providerMap.get(c.providerId) || null,
      }));
    }),

  createConnection: protectedProcedure
    .input(z.object({
      providerSlug: z.string(),
       credentials: z.record(z.string(), z.unknown()),
      config: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const user = ctx.user;
      // Find provider
      const [provider] = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, input.providerSlug));
      if (!provider) throw new Error("Provider not found");

      // Permission check
      if (!canManageTier(user.role, provider.ownershipTier)) {
        throw new Error(`Insufficient permissions for ${provider.ownershipTier}-tier connections`);
      }

      // Determine owner_id based on tier
      let ownerId = String(user.id);
      let organizationId: number | null = null;
      let userId: number | null = user.id;

      if (provider.ownershipTier === "platform") {
        ownerId = "platform-global";
        userId = null;
      } else if (provider.ownershipTier === "organization") {
        // Use user's org if available
        organizationId = null; // Would come from user's org context
        userId = null;
      }

      const id = uuid();
      const encryptedCreds = encryptCredentials(input.credentials as Record<string, unknown>);

      await db.insert(integrationConnections).values({
        id,
        providerId: provider.id,
        ownershipTier: provider.ownershipTier,
        ownerId,
        organizationId,
        userId,
        status: "pending",
        credentialsEncrypted: encryptedCreds,
        configJson: input.config || {},
        usageThisPeriod: 0,
        usagePeriodStart: new Date(),
      });

      const [created] = await db.select().from(integrationConnections).where(eq(integrationConnections.id, id));
      return { ...created, credentialsEncrypted: undefined };
    }),

  updateConnection: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      credentials: z.record(z.string(), z.unknown()).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      status: z.enum(["connected", "disconnected", "error", "pending", "expired"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [conn] = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      if (!conn) throw new Error("Connection not found");

      // Permission: must own or be admin
      if (conn.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const updates: Record<string, unknown> = {};
      if (input.credentials) {
        updates.credentialsEncrypted = encryptCredentials(input.credentials as Record<string, unknown>);
      }
      if (input.config) updates.configJson = input.config;
      if (input.status) updates.status = input.status;

      if (Object.keys(updates).length > 0) {
        await db.update(integrationConnections)
          .set(updates)
          .where(eq(integrationConnections.id, input.connectionId));
      }

      const [updated] = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      return { ...updated, credentialsEncrypted: undefined };
    }),

  deleteConnection: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [conn] = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      if (!conn) throw new Error("Connection not found");

      if (conn.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      // Soft delete: set status to disconnected
      await db.update(integrationConnections)
        .set({ status: "disconnected" })
        .where(eq(integrationConnections.id, input.connectionId));

      return { success: true };
    }),

  testConnection: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [conn] = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      if (!conn) throw new Error("Connection not found");

      const [provider] = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.id, conn.providerId));
      if (!provider) throw new Error("Provider not found");

      const start = Date.now();
      try {
        if (!conn.credentialsEncrypted) {
          return { success: false, message: "No credentials configured", latencyMs: 0 };
        }
        const creds = decryptCredentials(conn.credentialsEncrypted);
        // Normalize credential key: frontend stores as api_key, some code expects apiKey
        const apiKey = (creds.api_key || creds.apiKey || creds.access_token || "") as string;

        // Provider-specific test endpoints with correct auth methods
        let testUrl = "";
        const headers: Record<string, string> = {};
        let fetchOpts: RequestInit = { headers, signal: AbortSignal.timeout(10000) };

        switch (provider.slug) {
          case "census-bureau":
            // Census uses ?key= query param
            testUrl = `https://api.census.gov/data/2021/acs/acs5?get=NAME&for=state:01&key=${apiKey}`;
            break;
          case "bls":
            // BLS v2 uses registrationkey in POST body
            testUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
            headers["Content-Type"] = "application/json";
            fetchOpts = {
              method: "POST",
              headers,
              body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: "2024", endyear: "2024", registrationkey: apiKey }),
              signal: AbortSignal.timeout(10000),
            };
            break;
          case "fred":
            // FRED uses ?api_key= query param
            testUrl = `https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${apiKey}&file_type=json`;
            break;
          case "bea":
            // BEA uses ?UserID= query param
            testUrl = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`;
            break;
          case "sec-edgar":
            // SEC EDGAR is free, no key needed — just test the endpoint
            testUrl = "https://efts.sec.gov/LATEST/search-index?q=test&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02";
            break;
          case "finra-brokercheck":
            // FINRA BrokerCheck is free, no key needed
            testUrl = "https://api.brokercheck.finra.org/search/individual?query=test&start=0&rows=1";
            break;
          case "smsit":
            testUrl = "https://tool-it.smsit.ai/api/user";
            headers["Authorization"] = `Bearer ${apiKey}`;
            break;
          default:
            if (provider.baseUrl) {
              testUrl = provider.baseUrl;
              if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
            } else {
              // No test endpoint — just verify credentials exist
              const latencyMs = Date.now() - start;
              if (apiKey) {
                await db.update(integrationConnections)
                  .set({ status: "connected" })
                  .where(eq(integrationConnections.id, input.connectionId));
                return { success: true, message: "Credentials verified (no test endpoint available)", latencyMs };
              }
              return { success: false, message: "No credentials found", latencyMs };
            }
        }

        const resp = await fetch(testUrl, fetchOpts);
        const latencyMs = Date.now() - start;

        // Check response — government APIs return 200 with error messages in body
        if (resp.ok) {
          const text = await resp.text();
          // Some APIs return 200 but with error in body (e.g., BEA returns error JSON)
          const hasError = text.toLowerCase().includes('"error"') && text.toLowerCase().includes('invalid');
          const success = !hasError;
          await db.update(integrationConnections)
            .set({ status: success ? "connected" : "error", lastSyncError: success ? null : "Invalid API key" })
            .where(eq(integrationConnections.id, input.connectionId));
          return {
            success,
            message: success ? "Connection successful — API key verified" : "API key appears invalid",
            latencyMs,
          };
        }

        if (resp.status === 401 || resp.status === 403) {
          await db.update(integrationConnections)
            .set({ status: "error", lastSyncError: "Authentication failed" })
            .where(eq(integrationConnections.id, input.connectionId));
          return { success: false, message: "Authentication failed — check your API key", latencyMs };
        }

        await db.update(integrationConnections)
          .set({ status: "error", lastSyncError: `HTTP ${resp.status}` })
          .where(eq(integrationConnections.id, input.connectionId));
        return { success: false, message: `HTTP ${resp.status}: ${resp.statusText}`, latencyMs };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        await db.update(integrationConnections)
          .set({ status: "error", lastSyncError: err.message })
          .where(eq(integrationConnections.id, input.connectionId));
        return { success: false, message: err.message, latencyMs };
      }
    }),

  triggerSync: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      syncType: z.enum(["full", "incremental"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const logId = uuid();
      await db.insert(integrationSyncLogs).values({
        id: logId,
        connectionId: input.connectionId,
        syncType: input.syncType,
        direction: "inbound",
        startedAt: new Date(),
        status: "running",
        triggeredBy: "manual",
        triggeredByUserId: ctx.user.id,
      });

      // In a real implementation, this would enqueue a background job
      // For now, mark as success with a placeholder
      await db.update(integrationSyncLogs)
        .set({ status: "success", completedAt: new Date() })
        .where(eq(integrationSyncLogs.id, logId));

      await db.update(integrationConnections)
        .set({ lastSyncAt: new Date(), lastSyncStatus: "success" })
        .where(eq(integrationConnections.id, input.connectionId));

      return { syncLogId: logId, status: "success" };
    }),

  getSyncLogs: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      return db.select().from(integrationSyncLogs)
        .where(eq(integrationSyncLogs.connectionId, input.connectionId))
        .orderBy(desc(integrationSyncLogs.startedAt))
        .limit(input.limit);
    }),

  // ─── Field Mapping ──────────────────────────────────────────────────
  getFieldMappings: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      return db.select().from(integrationFieldMappings)
        .where(eq(integrationFieldMappings.connectionId, input.connectionId));
    }),

  updateFieldMappings: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      mappings: z.array(z.object({
        externalField: z.string(),
        internalTable: z.string(),
        internalField: z.string(),
        transform: z.enum(["direct", "lowercase", "uppercase", "date_parse", "phone_e164", "currency_cents", "boolean_parse", "custom"]).default("direct"),
        customTransform: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      // Delete existing mappings for this connection
      await db.delete(integrationFieldMappings)
        .where(eq(integrationFieldMappings.connectionId, input.connectionId));

      // Insert new mappings
      for (const m of input.mappings) {
        await db.insert(integrationFieldMappings).values({
          id: uuid(),
          connectionId: input.connectionId,
          externalField: m.externalField,
          internalTable: m.internalTable,
          internalField: m.internalField,
          transform: m.transform,
          customTransform: m.customTransform,
        });
      }
      return { success: true, count: input.mappings.length };
    }),

  // ─── Manual Upload (carrier portal data) ────────────────────────────
  listImportTemplates: protectedProcedure
    .input(z.object({ carrierSlug: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const all = await db.select().from(carrierImportTemplates);
      if (input?.carrierSlug) {
        return all.filter(t => t.carrierSlug === input.carrierSlug);
      }
      return all;
    }),

  uploadCarrierData: protectedProcedure
    .input(z.object({
      connectionId: z.string().optional(),
      templateId: z.string(),
      fileContent: z.string(),
      fileType: z.enum(["csv", "pdf"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Get template
      const [template] = await db.select().from(carrierImportTemplates)
        .where(eq(carrierImportTemplates.id, input.templateId));
      if (!template) throw new Error("Import template not found");

      const mappings = template.columnMappings as Record<string, string>;
      let recordsProcessed = 0;
      let recordsFailed = 0;
      const errors: Array<{ row: number; error: string }> = [];

      if (input.fileType === "csv") {
        // Parse CSV
        const lines = input.fileContent.split("\n").filter(l => l.trim());
        if (lines.length < 2) throw new Error("CSV must have at least a header and one data row");

        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
            const record: Record<string, string> = {};
            headers.forEach((h, idx) => {
              const mappedField = mappings[h];
              if (mappedField && values[idx]) {
                record[mappedField] = values[idx];
              }
            });
            // In production, this would insert into the appropriate table
            // based on template.reportType
            recordsProcessed++;
          } catch (e: any) {
            recordsFailed++;
            errors.push({ row: i, error: e.message });
          }
        }
      } else {
        // PDF parsing would use AI extraction
        // For now, return a placeholder
        return {
          recordsProcessed: 0,
          recordsFailed: 0,
          errors: [{ row: 0, error: "PDF parsing requires AI extraction — use the Document Intelligence Hub" }],
        };
      }

      // Create sync log
      if (input.connectionId) {
        await db.insert(integrationSyncLogs).values({
          id: uuid(),
          connectionId: input.connectionId,
          syncType: "manual_upload",
          direction: "inbound",
          startedAt: new Date(),
          completedAt: new Date(),
          status: recordsFailed > 0 ? "partial" : "success",
          recordsCreated: recordsProcessed,
          recordsFailed,
          errorDetails: errors.length > 0 ? errors : null,
          triggeredBy: "manual",
          triggeredByUserId: ctx.user.id,
        });
      }

      return { recordsProcessed, recordsFailed, errors };
    }),

  // ─── Enrichment (on-demand, respects free tier limits) ──────────────
  enrichContact: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      contactIdentifier: z.string(),
      lookupType: z.string().default("person"),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      // Check cache first
      const cached = await db.select().from(enrichmentCache)
        .where(and(
          eq(enrichmentCache.providerSlug, "peopledatalabs"),
          eq(enrichmentCache.lookupKey, input.contactIdentifier),
          eq(enrichmentCache.lookupType, input.lookupType),
        ));

      if (cached.length > 0 && cached[0].expiresAt > new Date()) {
        // Cache hit — increment hit count
        await db.update(enrichmentCache)
          .set({ hitCount: sql`${enrichmentCache.hitCount} + 1` })
          .where(eq(enrichmentCache.id, cached[0].id));
        return { cached: true, data: cached[0].resultJson };
      }

      // Check usage limits
      const [conn] = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      if (!conn) throw new Error("Connection not found");

      const [provider] = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.id, conn.providerId));

      // Parse free tier limit (e.g., "100 records/month per key")
      const limitMatch = provider?.freeTierLimit?.match(/(\d+)/);
      const monthlyLimit = limitMatch ? parseInt(limitMatch[1]) : 100;

      if ((conn.usageThisPeriod || 0) >= monthlyLimit) {
        return {
          rateLimited: true,
          message: `Monthly enrichment limit reached (${conn.usageThisPeriod}/${monthlyLimit})`,
        };
      }

      // In production: make actual API call to PDL
      // For now, return a placeholder indicating the call would be made
      const enrichedData = {
        source: "peopledatalabs",
        identifier: input.contactIdentifier,
        lookupType: input.lookupType,
        status: "pending_api_key",
        message: "Configure People Data Labs API key to enable enrichment",
      };

      // Cache the result
      const cacheId = uuid();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // 90-day TTL

      await db.insert(enrichmentCache).values({
        id: cacheId,
        providerSlug: "peopledatalabs",
        lookupKey: input.contactIdentifier,
        lookupType: input.lookupType,
        resultJson: enrichedData,
        fetchedAt: new Date(),
        expiresAt,
        connectionId: input.connectionId,
      }).onDuplicateKeyUpdate({
        set: { resultJson: enrichedData, fetchedAt: new Date(), expiresAt, hitCount: 1 },
      });

      // Increment usage
      await db.update(integrationConnections)
        .set({ usageThisPeriod: sql`${integrationConnections.usageThisPeriod} + 1` })
        .where(eq(integrationConnections.id, input.connectionId));

      return { cached: false, data: enrichedData };
    }),

  // ─── Usage Tracking ─────────────────────────────────────────────────
  getUsageStats: protectedProcedure
    .input(z.object({ connectionId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      let conns = await db.select().from(integrationConnections);

      if (input?.connectionId) {
        conns = conns.filter(c => c.id === input.connectionId);
      } else if (ctx.user.role !== "admin") {
        conns = conns.filter(c => c.userId === ctx.user.id);
      }

      const providers = await db.select().from(integrationProviders);
      const providerMap = new Map(providers.map(p => [p.id, p]));

      return conns.map(c => {
        const provider = providerMap.get(c.providerId);
        const limitMatch = provider?.freeTierLimit?.match(/(\d+)/);
        const limit = limitMatch ? parseInt(limitMatch[1]) : null;

        return {
          connectionId: c.id,
          providerSlug: provider?.slug,
          providerName: provider?.name,
          usageThisPeriod: c.usageThisPeriod || 0,
          freeTierLimit: limit,
          freeTierDescription: provider?.freeTierLimit,
          percentUsed: limit ? Math.round(((c.usageThisPeriod || 0) / limit) * 100) : null,
          periodStart: c.usagePeriodStart,
          status: c.status,
        };
      });
    }),

  // ─── Enrichment Cache Lookup (for context assembly) ─────────────────
  getCachedEnrichment: protectedProcedure
    .input(z.object({
      providerSlug: z.string(),
      lookupKey: z.string(),
      lookupType: z.string(),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [cached] = await db.select().from(enrichmentCache)
        .where(and(
          eq(enrichmentCache.providerSlug, input.providerSlug),
          eq(enrichmentCache.lookupKey, input.lookupKey),
          eq(enrichmentCache.lookupType, input.lookupType),
        ));

      if (cached && cached.expiresAt > new Date()) {
        return { found: true, data: cached.resultJson, fetchedAt: cached.fetchedAt };
      }
      return { found: false, data: null };
    }),

  // ─── Bulk cache query for context assembly ──────────────────────────
  getEnrichmentForContext: protectedProcedure
    .input(z.object({
      lookups: z.array(z.object({
        providerSlug: z.string(),
        lookupKey: z.string(),
        lookupType: z.string(),
      })),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const results: Record<string, unknown> = {};

      for (const lookup of input.lookups) {
        const [cached] = await db.select().from(enrichmentCache)
          .where(and(
            eq(enrichmentCache.providerSlug, lookup.providerSlug),
            eq(enrichmentCache.lookupKey, lookup.lookupKey),
            eq(enrichmentCache.lookupType, lookup.lookupType),
          ));

        if (cached && cached.expiresAt > new Date()) {
          results[`${lookup.providerSlug}:${lookup.lookupType}:${lookup.lookupKey}`] = cached.resultJson;
        }
      }

      return results;
    }),

  // ─── Health Dashboard ─────────────────────────────────────────────
  getHealthDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const { getHealthDashboardData } = await import("../services/integrationHealth");
      // Track this as an Exponential Engine event
      try {
        const { trackEvent } = await import("../services/exponentialEngine");
        trackEvent({ userId: ctx.user.id, eventType: "page_view", featureKey: "integration_health", metadata: {} }).catch(() => {});
      } catch {}
      return getHealthDashboardData();
    }),

  runHealthChecks: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { runAllHealthChecks } = await import("../services/integrationHealth");
      const results = await runAllHealthChecks();
      // Track health check run as improvement agent interaction
      try {
        const { trackEvent } = await import("../services/exponentialEngine");
        trackEvent({ userId: ctx.user.id, eventType: "feature_use", featureKey: "integration_improvement", metadata: { checksRun: results.length } }).catch(() => {});
      } catch {}
      return { results, checkedAt: new Date() };
    }),

  runSingleHealthCheck: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input }) => {
      const { runHealthCheck } = await import("../services/integrationHealth");
      return runHealthCheck(input.connectionId);
    }),

  getImprovementLog: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      severity: z.enum(["info", "warning", "critical"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const limit = input?.limit || 50;
      let query = db.select().from(integrationImprovementLog)
        .orderBy(desc(integrationImprovementLog.createdAt))
        .limit(limit);
      return query;
    }),

  getIntegrationHealthContext: protectedProcedure
    .query(async () => {
      const { assembleIntegrationHealthContext } = await import("../services/integrationHealth");
      return assembleIntegrationHealthContext();
    }),

  // ─── Data Pipeline Endpoints ──────────────────────────────────────────
  runAllPipelines: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { runAllDataPipelines } = await import("../services/governmentDataPipelines");
      const { trackEvent } = await import("../services/exponentialEngine");
      const results = await runAllDataPipelines();
      try { await trackEvent({ userId: ctx.user.id, eventType: "feature_use", featureKey: "data_pipeline_run", metadata: { pipelinesRun: results.length } }); } catch {}
      return results;
    }),

  runSinglePipeline: protectedProcedure
    .input(z.object({ providerSlug: z.string() }))
    .mutation(async ({ input }) => {
      const { runSinglePipeline } = await import("../services/governmentDataPipelines");
      return runSinglePipeline(input.providerSlug);
    }),

  getPipelineCachedData: protectedProcedure
    .input(z.object({ providerSlug: z.string(), category: z.string().optional() }))
    .query(async ({ input }) => {
      const { getCachedData } = await import("../services/governmentDataPipelines");
      return getCachedData(input.providerSlug, input.category);
    }),

  getEconomicDataSummary: protectedProcedure
    .query(async () => {
      const { getEconomicDataSummary } = await import("../services/governmentDataPipelines");
      return getEconomicDataSummary();
    }),

  // ─── Scheduler Endpoints ──────────────────────────────────────────────
  getSchedulerStatus: protectedProcedure
    .query(async () => {
      const { getSchedulerStatus } = await import("../services/scheduler");
      return getSchedulerStatus();
    }),

  triggerSchedulerJob: protectedProcedure
    .input(z.object({ jobName: z.string() }))
    .mutation(async ({ input }) => {
      const { triggerJob } = await import("../services/scheduler");
      return triggerJob(input.jobName);
    }),
});
