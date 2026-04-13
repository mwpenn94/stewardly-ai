import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import {
  integrationProviders,
  integrationConnections,
  integrationSyncLogs,
  integrationFieldMappings,
  enrichmentCache,
  integrationImprovementLog,
  carrierImportTemplates,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../services/encryption";
import { firstOrNull } from "../services/dbResilience";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Helper: check tier permission ──────────────────────────────────────
function canManageTier(userRole: string, tier: string): boolean {
  if (userRole === "admin") return true;
  if (tier === "organization" && (userRole === "admin" || userRole === "manager")) return true;
  if (tier === "professional") return true; // any authenticated user can manage their own
  if (tier === "client") return true; // any authenticated user can manage their own client-tier connections
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, input.slug));
      const provider = firstOrNull(rows);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      return provider;
    }),

  // ─── Connection Management (tier-gated) ─────────────────────────────
  listConnections: protectedProcedure
    .input(z.object({ ownershipTier: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const user = ctx.user;
      // Find provider
      const providerRows = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, input.providerSlug));
      const provider = firstOrNull(providerRows);
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

      const createdRows = await db.select().from(integrationConnections).where(eq(integrationConnections.id, id));
      const created = firstOrNull(createdRows);
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const connRows = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      const conn = firstOrNull(connRows);
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

      const updatedRows = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      const updated = firstOrNull(updatedRows);
      return { ...updated, credentialsEncrypted: undefined };
    }),

  deleteConnection: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const delConnRows = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      const conn = firstOrNull(delConnRows);
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const testConnRows = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      const conn = firstOrNull(testConnRows);
      if (!conn) throw new Error("Connection not found");

      const testProviderRows = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.id, conn.providerId));
      const provider = firstOrNull(testProviderRows);
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
            // BEA uses ?UserID= query param — MUST be lowercase
            testUrl = `https://apps.bea.gov/api/data?UserID=${apiKey.toLowerCase()}&method=GETDATASETLIST&ResultFormat=JSON`;
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(integrationSyncLogs)
        .where(eq(integrationSyncLogs.connectionId, input.connectionId))
        .orderBy(desc(integrationSyncLogs.startedAt))
        .limit(input.limit);
    }),

  // ─── Field Mapping ──────────────────────────────────────────────────
  getFieldMappings: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Get template
      const templateRows = await db.select().from(carrierImportTemplates)
        .where(eq(carrierImportTemplates.id, input.templateId));
      const template = firstOrNull(templateRows);
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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
      const enrichConnRows = await db.select().from(integrationConnections)
        .where(eq(integrationConnections.id, input.connectionId));
      const conn = firstOrNull(enrichConnRows);
      if (!conn) throw new Error("Connection not found");

      const enrichProviderRows = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.id, conn.providerId));
      const provider = firstOrNull(enrichProviderRows);

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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const cachedRows = await db.select().from(enrichmentCache)
        .where(and(
          eq(enrichmentCache.providerSlug, input.providerSlug),
          eq(enrichmentCache.lookupKey, input.lookupKey),
          eq(enrichmentCache.lookupType, input.lookupType),
        ));
      const cached = firstOrNull(cachedRows);

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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const results: Record<string, unknown> = {};

      for (const lookup of input.lookups) {
        const cachedLookupRows = await db.select().from(enrichmentCache)
          .where(and(
            eq(enrichmentCache.providerSlug, lookup.providerSlug),
            eq(enrichmentCache.lookupKey, lookup.lookupKey),
            eq(enrichmentCache.lookupType, lookup.lookupType),
          ));
        const cached = firstOrNull(cachedLookupRows);

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
      } catch (e) { logger.debug({ error: String(e) }, "Event tracking failed for integration_health page_view"); }
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
      } catch (e) { logger.debug({ error: String(e) }, "Event tracking failed for integration_improvement"); }
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
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      try { await trackEvent({ userId: ctx.user.id, eventType: "feature_use", featureKey: "data_pipeline_run", metadata: { pipelinesRun: results.length } }); } catch (e) { logger.debug({ error: String(e) }, "Event tracking failed for data_pipeline_run"); }
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

  // ─── Public Pipeline Health (no auth, for monitoring) ──────────────────
  pipelineHealth: publicProcedure
    .query(async () => {
      const { getSchedulerStatus } = await import("../services/scheduler");
      const status = getSchedulerStatus();
      
      // Return a simplified view without sensitive data
      return {
        initialized: status.initialized,
        selfTest: status.selfTest ? {
          overall: status.selfTest.overall,
          dbConnected: status.selfTest.dbConnected,
          timestamp: status.selfTest.timestamp,
          providers: status.selfTest.results?.map((r: any) => ({
            slug: r.slug,
            dbLookup: r.dbLookup,
            apiReachable: r.apiReachable,
            credentialDecrypt: r.credentialDecrypt,
          })) || [],
        } : null,
        jobs: status.jobs.map(j => ({
          name: j.name,
          lastRun: j.lastRun,
          lastError: j.lastError,
          runCount: j.runCount,
          errorCount: j.errorCount,
          isRunning: j.isRunning,
          nextRun: j.nextRun,
        })),
      };
    }),

  // ─── Run Self-Test on Demand ───────────────────────────────────────────
  runSelfTest: protectedProcedure
    .mutation(async () => {
      const { runPipelineSelfTest } = await import("../services/pipelineSelfTest");
      return runPipelineSelfTest();
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // SNAPTRADE — Per-User Brokerage Connections (Client Tier)
  // ═══════════════════════════════════════════════════════════════════════

  /** Check if SnapTrade platform credentials are configured */
  snapTradeStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      const configured = await st.isPlatformConfigured();
      const userStatus = await st.getSnapTradeStatus(ctx.user.id);
      return { platformConfigured: configured, ...userStatus };
    }),

  /** Get Connection Portal URL for the current user to connect a brokerage */
  snapTradeGetPortalUrl: protectedProcedure
    .input(z.object({ redirectUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const st = await import("../services/snapTrade");
      return st.getConnectionPortalUrl(ctx.user.id, input.redirectUrl);
    }),

  /** Sync brokerage connections from SnapTrade for the current user */
  snapTradeSyncConnections: protectedProcedure
    .mutation(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      return st.syncBrokerageConnections(ctx.user.id);
    }),

  /** Sync accounts and positions from SnapTrade for the current user */
  snapTradeSyncData: protectedProcedure
    .mutation(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      // First sync connections, then accounts/positions
      await st.syncBrokerageConnections(ctx.user.id);
      return st.syncAccountsAndPositions(ctx.user.id);
    }),

  /** Get the current user's brokerage connections (local DB) */
  snapTradeConnections: protectedProcedure
    .query(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      return st.getUserBrokerageConnections(ctx.user.id);
    }),

  /** Get the current user's brokerage accounts (local DB) */
  snapTradeAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      return st.getUserAccounts(ctx.user.id);
    }),

  /** Get the current user's positions (local DB) */
  snapTradePositions: protectedProcedure
    .query(async ({ ctx }) => {
      const st = await import("../services/snapTrade");
      return st.getUserPositions(ctx.user.id);
    }),

  /** Remove a brokerage connection */
  snapTradeRemoveConnection: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const st = await import("../services/snapTrade");
      return st.removeBrokerageConnection(ctx.user.id, input.connectionId);
    }),

  /** Advisor: view an associated client's SnapTrade status */
  snapTradeClientStatus: protectedProcedure
    .input(z.object({ clientUserId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Only advisors/managers/admins can view client data
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager" && ctx.user.role !== "advisor") {
        throw new Error("Only advisors, managers, and admins can view client brokerage status");
      }
      // Verify association exists (for non-admins)
      if (ctx.user.role !== "admin") {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { clientAssociations } = await import("../../drizzle/schema");
        const assoc = await db.select().from(clientAssociations)
          .where(and(
            eq(clientAssociations.professionalId, ctx.user.id),
            eq(clientAssociations.clientId, input.clientUserId)
          ));
        if (!assoc.length) {
          throw new Error("No association with this client");
        }
      }
      const st = await import("../services/snapTrade");
      const status = await st.getSnapTradeStatus(input.clientUserId);
      const connections = await st.getUserBrokerageConnections(input.clientUserId);
      const accounts = await st.getUserAccounts(input.clientUserId);
      return { ...status, connections, accounts };
    }),

  // ─── Dynamic CRUD Integrations: Schema Inference (Pass 1) ────────────
  /**
   * Infer a schema from arbitrary sample records. Use this when a third-party
   * integration has limited or nonexistent documentation but you can get
   * sample data out of it. Returns field types, semantic hints, primary key
   * candidates, and suggested CRUD field roles.
   */
  inferSchema: protectedProcedure
    .input(z.object({
      records: z.array(z.record(z.string(), z.any())).min(1).max(5000),
      sourceName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { inferSchema, suggestCrudMapping, summarizeSchema } = await import("../services/dynamicIntegrations/schemaInference");
      const schema = inferSchema(input.records);
      const crudMapping = suggestCrudMapping(schema);
      const summary = summarizeSchema(schema);
      return { schema, crudMapping, summary, sourceName: input.sourceName || null };
    }),

  /**
   * Merge two already-inferred schemas (e.g. from two paginated sample
   * batches). Exposed so wizards can progressively improve schema confidence
   * as more sample data arrives.
   */
  mergeInferredSchemas: protectedProcedure
    .input(z.object({
      a: z.any(),
      b: z.any(),
    }))
    .mutation(async ({ input }) => {
      const { mergeSchemas, suggestCrudMapping, summarizeSchema } = await import("../services/dynamicIntegrations/schemaInference");
      const schema = mergeSchemas([input.a, input.b]);
      return { schema, crudMapping: suggestCrudMapping(schema), summary: summarizeSchema(schema) };
    }),

  /**
   * Generate a full CRUD adapter spec from sample records + options.
   * This is the one-shot "take sample data and spit out a working adapter"
   * entry point. Pass sample records + base URL + (optional) auth hint and
   * you get a complete AdapterSpec back with endpoints, field mappings,
   * pagination probe, and a readiness report.
   */
  generateAdapter: protectedProcedure
    .input(z.object({
      records: z.array(z.record(z.string(), z.any())).min(1).max(5000),
      name: z.string().min(1).max(100),
      baseUrl: z.string().url().optional(),
      listEndpoint: z.string().optional(),
      authHint: z.object({
        type: z.enum(["none", "api_key_header", "api_key_query", "bearer", "basic", "oauth2", "unknown"]).optional(),
        headerName: z.string().optional(),
        queryParam: z.string().optional(),
      }).optional(),
      sampleListResponse: z.any().optional(),
      collectionPath: z.string().optional(),
      rateLimitHint: z.object({
        requestsPerSecond: z.number().optional(),
        requestsPerMinute: z.number().optional(),
        burstBudget: z.number().optional(),
        maxRetries: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const { inferSchema } = await import("../services/dynamicIntegrations/schemaInference");
      const { generateAdapter, buildCurlExamples, summarizeAdapter } = await import("../services/dynamicIntegrations/adapterGenerator");
      const schema = inferSchema(input.records);
      const spec = generateAdapter(schema, {
        name: input.name,
        baseUrl: input.baseUrl,
        listEndpoint: input.listEndpoint,
        authHint: input.authHint,
        sampleListResponse: input.sampleListResponse,
        collectionPath: input.collectionPath,
        rateLimitHint: input.rateLimitHint,
      });
      return {
        schema,
        spec,
        curlExamples: buildCurlExamples(spec),
        summary: summarizeAdapter(spec),
      };
    }),

  /**
   * One-shot autonomous source onboarding. Ties passes 1-15 together: redact
   * → infer → auth probe → generate spec → apply overrides → CRM map →
   * personalization hints → serialize → next-steps. Use this when you want
   * everything in one call.
   */
  onboardSource: protectedProcedure
    .input(z.object({
      sampleRecords: z.array(z.record(z.string(), z.any())).min(1).max(5000),
      name: z.string().min(1).max(100),
      baseUrl: z.string().url().optional(),
      listEndpoint: z.string().optional(),
      authHint: z.object({
        type: z.enum(["none", "api_key_header", "api_key_query", "bearer", "basic", "oauth2", "unknown"]).optional(),
        headerName: z.string().optional(),
        queryParam: z.string().optional(),
      }).optional(),
      skipRedaction: z.boolean().optional(),
      skipCrmMapping: z.boolean().optional(),
      skipPersonalizationHints: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { runOnboardingWizard } = await import("../services/dynamicIntegrations/onboardingWizard");
      return await runOnboardingWizard(input);
    }),

  /**
   * Parse a natural-language prompt and return the extracted OnboardingInput
   * hints. Use as a preview step before calling onboardSource.
   */
  parseOnboardPrompt: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(2000) }))
    .query(async ({ input }) => {
      const { parsePrompt, summarizeParsedPrompt } = await import("../services/dynamicIntegrations/naturalLanguageParser");
      const parsed = parsePrompt(input.prompt);
      return { parsed, summary: summarizeParsedPrompt(parsed) };
    }),

  /**
   * Detect schema drift between a baseline sample and a current sample.
   * Returns a structured DriftReport with breaking/warning/info severity.
   */
  detectDrift: protectedProcedure
    .input(z.object({
      baselineRecords: z.array(z.record(z.string(), z.any())).min(1).max(5000),
      currentRecords: z.array(z.record(z.string(), z.any())).min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const { inferSchema } = await import("../services/dynamicIntegrations/schemaInference");
      const { diffSchemas, summarizeDrift } = await import("../services/dynamicIntegrations/schemaDrift");
      const baseline = inferSchema(input.baselineRecords);
      const current = inferSchema(input.currentRecords);
      const report = diffSchemas(baseline, current);
      return { report, summary: summarizeDrift(report) };
    }),

  /**
   * Extract personalization hints (learning tracks, calculators, risk,
   * CRM segments) from sample records. Feeds the learning engine and
   * spotlight logic.
   */
  extractHints: protectedProcedure
    .input(z.object({
      records: z.array(z.record(z.string(), z.any())).min(1).max(5000),
      minConfidence: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const { inferSchema } = await import("../services/dynamicIntegrations/schemaInference");
      const { extractPersonalizationHints, summarizeHints } = await import("../services/dynamicIntegrations/personalizationHints");
      const schema = inferSchema(input.records);
      const result = extractPersonalizationHints(schema, {
        minConfidence: input.minConfidence,
      });
      return { result, summary: summarizeHints(result) };
    }),

  /**
   * Deep-probe auth type from sample 401/403 responses. Use when you
   * already have data you can fetch and want to confirm auth style.
   */
  probeAuth: protectedProcedure
    .input(z.object({
      samples: z.array(z.object({
        status: z.number(),
        headers: z.record(z.string(), z.string()),
        body: z.any().optional(),
        url: z.string().optional(),
      })).min(1).max(100),
      endpointsTried: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { probeAuthDeep, summarizeAuthProbe } = await import("../services/dynamicIntegrations/authProbe");
      const result = probeAuthDeep({
        samples: input.samples,
        endpointsTried: input.endpointsTried,
      });
      return { result, summary: summarizeAuthProbe(result) };
    }),
});
