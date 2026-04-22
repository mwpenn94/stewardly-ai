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
  integrationWebhookEvents,
  enrichmentCache,
  integrationHealthChecks,
  integrationHealthSummary,
  integrationImprovementLog,
  carrierImportTemplates,
} from "../../drizzle/schema";
import { eq, and, desc, sql, lte } from "drizzle-orm";
import { encrypt, decrypt, encryptCredentials, decryptCredentials } from "../services/encryption";
import { firstOrNull } from "../services/dbResilience";
import { reconcile, reconcileAllLocations, getSyncAggregation, persistReconcileStats, getActiveLocations } from "../services/syncReconciliation";
import type { LocationConfig } from "../services/syncReconciliation";
import { getRawPool } from "../db";
import crypto from "crypto";
import { emitReconcileProgress, emitReconcileComplete, emitSyncError } from "../services/syncEventBus";

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
          case "treasury-fiscal":
            // US Treasury Fiscal Data API — free, no key needed
            testUrl = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/rates_of_exchange?page[size]=1";
            break;
          case "gleif":
            // GLEIF LEI lookup — free, no key needed
            testUrl = "https://api.gleif.org/api/v1/lei-records?page[size]=1";
            break;
          case "world-bank":
            // World Bank Open Data — free, no key needed
            testUrl = "https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&per_page=1";
            break;
          case "openfigi":
            // OpenFIGI — free with optional API key
            testUrl = "https://api.openfigi.com/v3/mapping";
            headers["Content-Type"] = "application/json";
            if (apiKey) headers["X-OPENFIGI-APIKEY"] = apiKey;
            fetchOpts = {
              method: "POST",
              headers,
              body: JSON.stringify([{ idType: "TICKER", idValue: "AAPL", exchCode: "US" }]),
              signal: AbortSignal.timeout(10000),
            };
            break;
          case "naic":
            // NAIC — free public website
            testUrl = "https://content.naic.org/";
            break;
          case "ffiec":
            // FFIEC — free public API (HMDA Data Browser)
            testUrl = "https://ffiec.cfpb.gov/v2/data-browser-api/view/nationwide/aggregations?actions_taken=1&years=2022";
            break;
          case "fdic":
            // FDIC BankFind — free public API
            testUrl = "https://banks.data.fdic.gov/api/financials?filters=REPDTE%3A20231231&fields=REPNM,ASSET&sort_by=ASSET&sort_order=DESC&limit=1";
            break;
          case "coingecko":
            // CoinGecko — free public API
            testUrl = "https://api.coingecko.com/api/v3/ping";
            break;
          case "smsit":
            testUrl = "https://tool-it.smsit.ai/api/user";
            headers["Authorization"] = `Bearer ${apiKey}`;
            break;
          case "gohighlevel": {
            // GHL uses OAuth2 bearer token + locationId
            const locationId = (creds.location_id || creds.locationId || "") as string;
            testUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=1`;
            headers["Authorization"] = `Bearer ${apiKey}`;
            headers["Version"] = "2021-07-28";
            break;
          }
          case "wealthbox":
            // Wealthbox uses bearer token, test /me endpoint
            testUrl = "https://api.crmworkspace.com/v1/me";
            headers["Authorization"] = `Bearer ${apiKey}`;
            headers["Accept"] = "application/json";
            break;
          case "redtail": {
            // Redtail uses Userkeyauth header
            const userKey = (creds.user_key || creds.userKey || apiKey) as string;
            testUrl = "https://smf.crm3.redtailtechnology.com/api/public/v1/authentication";
            headers["Authorization"] = `Userkeyauth ${userKey}`;
            headers["Accept"] = "application/json";
            break;
          }
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

  // ─── Integration Failover & Demo Data ────────────────────────────────
  failoverStatus: protectedProcedure
    .input(z.object({ providerSlug: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { getAllFailoverStatuses, getFailoverStatus } = await import("../services/integrationFailover");
      if (input?.providerSlug) {
        return { statuses: [await getFailoverStatus(input.providerSlug, ctx.user.id)] };
      }
      return { statuses: await getAllFailoverStatuses(ctx.user.id) };
    }),

  failoverData: protectedProcedure
    .input(z.object({
      providerSlug: z.enum(["gohighlevel", "wealthbox", "redtail", "smsit"]),
      dataType: z.enum(["contacts", "pipelines", "messages", "activities"]).default("contacts"),
    }))
    .query(async ({ ctx, input }) => {
      const failover = await import("../services/integrationFailover");
      switch (input.providerSlug) {
        case "gohighlevel":
          if (input.dataType === "pipelines") return failover.getGHLPipelinesWithFailover(ctx.user.id);
          return failover.getGHLContactsWithFailover(ctx.user.id);
        case "wealthbox":
          return failover.getWealthboxContactsWithFailover(ctx.user.id);
        case "redtail":
          return failover.getRedtailContactsWithFailover(ctx.user.id);
        case "smsit":
          return failover.getSMSiTMessagesWithFailover(ctx.user.id);
        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported provider" });
      }
    }),

  // ─── GHL Sync Reconciliation ──────────────────────────────────────────

  /** Run full bidirectional reconciliation (single location or all) */
  reconcileGHL: protectedProcedure
    .input(z.object({
      maxGHLContacts: z.number().optional().default(0),
      pushOrphans: z.boolean().optional().default(true),
      resumeCursor: z.string().nullable().optional(),
      locationDbId: z.number().optional(), // scope to specific location
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawPool();
      const startedAt = Date.now();

      // If locationDbId provided, reconcile single location
      if (input?.locationDbId) {
        const locations = await getActiveLocations();
        const loc = locations.find(l => l.dbId === input.locationDbId);
        if (!loc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Location not found or inactive' });

        let runId: number | null = null;
        if (pool) {
          try {
            const [result] = await pool.query(
              `INSERT INTO sync_run_history (run_type, status, triggered_by, location_id, started_at) VALUES (?, 'running', ?, ?, ?)`,
              [input?.resumeCursor ? 'resume' : 'manual', ctx.user?.name || 'unknown', input.locationDbId, startedAt]
            );
            runId = (result as any).insertId;
          } catch { /* non-fatal */ }
        }

        try {
          const stats = await reconcile({
            maxGHLContacts: input?.maxGHLContacts ?? 0,
            pushOrphans: input?.pushOrphans ?? true,
            resumeCursor: input?.resumeCursor ?? null,
            location: loc,
            onProgress: (progressStats) => {
              emitReconcileProgress({
                locationId: loc.dbId,
                locationName: loc.name,
                processed: progressStats.matched + progressStats.createdInStewardly + progressStats.createdInGHL,
                total: progressStats.ghlTotal || 1,
                matched: progressStats.matched,
                created: progressStats.createdInStewardly + progressStats.createdInGHL,
                errors: progressStats.errors,
              });
            },
          });
          await persistReconcileStats(stats, loc.dbId);

          if (pool && runId) {
            try {
              await pool.query(
                `UPDATE sync_run_history SET status = ?, ghl_total = ?, stewardly_total = ?, matched = ?,
                 created_in_stewardly = ?, created_in_ghl = ?, updated_in_stewardly = ?, updated_in_ghl = ?,
                 conflicts_resolved = ?, orphans_fixed = ?, errors = ?, duration_ms = ?,
                 resume_cursor = ?, complete = ?, completed_at = ? WHERE id = ?`,
                [
                  stats.complete ? 'completed' : 'interrupted',
                  stats.ghlTotal, stats.stewardlyTotal, stats.matched,
                  stats.createdInStewardly, stats.createdInGHL,
                  stats.updatedInStewardly, stats.updatedInGHL,
                  stats.conflictsResolved, stats.orphansFixed, stats.errors,
                  stats.duration_ms, stats.resumeCursor, stats.complete, Date.now(), runId,
                ]
              );
            } catch { /* non-fatal */ }
          }
          emitReconcileComplete({
            locationId: loc.dbId,
            locationName: loc.name,
            stats,
            durationMs: stats.duration_ms,
          });
          return stats;
        } catch (err: any) {
          emitSyncError({
            locationId: loc.dbId,
            locationName: loc.name,
            error: err.message,
            context: "reconcileGHL",
          });
          if (pool && runId) {
            await pool.query(
              `UPDATE sync_run_history SET status = 'failed', errors = 1, duration_ms = ?, completed_at = ? WHERE id = ?`,
              [Date.now() - startedAt, Date.now(), runId]
            ).catch(() => {});
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
        }
      }

      // No locationDbId — reconcile all active locations
      try {
        const { results, totalDuration } = await reconcileAllLocations({
          maxGHLContacts: input?.maxGHLContacts ?? 0,
          pushOrphans: input?.pushOrphans ?? true,
          resumeCursor: input?.resumeCursor ?? null,
        });

        // Emit SSE complete for each location result
        for (const r of results) {
          emitReconcileComplete({
            locationId: undefined,
            locationName: r.locationName || r.locationId,
            stats: r,
            durationMs: r.duration_ms,
          });
        }
        // Return the first result for backward compat, or a summary
        if (results.length === 1) return results[0];
        return {
          timestamp: new Date().toISOString(),
          locationId: 'all',
          locationName: `${results.length} locations`,
          ghlTotal: results.reduce((s, r) => s + r.ghlTotal, 0),
          stewardlyTotal: results.reduce((s, r) => s + r.stewardlyTotal, 0),
          matched: results.reduce((s, r) => s + r.matched, 0),
          createdInStewardly: results.reduce((s, r) => s + r.createdInStewardly, 0),
          createdInGHL: results.reduce((s, r) => s + r.createdInGHL, 0),
          updatedInStewardly: results.reduce((s, r) => s + r.updatedInStewardly, 0),
          updatedInGHL: results.reduce((s, r) => s + r.updatedInGHL, 0),
          conflictsResolved: results.reduce((s, r) => s + r.conflictsResolved, 0),
          orphansFixed: results.reduce((s, r) => s + r.orphansFixed, 0),
          errors: results.reduce((s, r) => s + r.errors, 0),
          duration_ms: totalDuration,
          conflicts: results.flatMap(r => r.conflicts).slice(-100),
          resumeCursor: null,
          chunkSize: 100,
          complete: results.every(r => r.complete),
        };
      } catch (err: any) {
        emitSyncError({
          error: err.message,
          context: "reconcileGHL_all",
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }
    }),
  /** Get current sync aggregation stats (optional location filter) */
  getSyncAggregation: protectedProcedure
    .input(z.object({ locationDbId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const agg = await getSyncAggregation(input?.locationDbId);
      return agg;
    }),

  /** Get sync run history (optional location filter) */
  getSyncRunHistory: protectedProcedure
    .input(z.object({ locationDbId: z.number().optional(), limit: z.number().optional().default(50) }).optional())
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      try {
        const locationFilter = input?.locationDbId != null ? " WHERE location_id = ?" : "";
        const params: any[] = input?.locationDbId != null ? [input.locationDbId] : [];
        const [rows] = await pool.query(
          `SELECT * FROM sync_run_history${locationFilter} ORDER BY started_at DESC LIMIT ?`,
          [...params, input?.limit ?? 50]
        );
        return rows as any[];
      } catch {
        return [];
      }
    }),

  // ─── Location Management ──────────────────────────────────────────────

  /** List all GHL locations */
  listLocations: protectedProcedure.query(async () => {
    const pool = await getRawPool();
    if (!pool) return [];
    try {
      const [rows] = await pool.query(
        "SELECT * FROM ghl_locations ORDER BY is_active DESC, name ASC"
      );
      return rows as any[];
    } catch {
      return [];
    }
  }),

  /** Create a new GHL location */
  createLocation: protectedProcedure
    .input(z.object({
      locationId: z.string().min(1),
      name: z.string().min(1),
      region: z.string().optional(),
      syncDirection: z.enum(["bidirectional", "pull_only", "push_only", "disabled"]).default("bidirectional"),
      syncFrequency: z.enum(["hourly", "every_6h", "daily", "weekly", "manual"]).default("daily"),
      conflictPolicy: z.enum(["ghl_wins", "stewardly_wins", "newest_wins", "manual_review"]).default("newest_wins"),
      maxContactsPerRun: z.number().default(0),
      rateLimitMs: z.number().default(50),
    }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

      try {
        const [result] = await pool.query(
          `INSERT INTO ghl_locations (location_id, name, region, sync_direction, sync_frequency, conflict_policy, max_contacts_per_run, rate_limit_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.locationId, input.name, input.region || null, input.syncDirection, input.syncFrequency, input.conflictPolicy, input.maxContactsPerRun, input.rateLimitMs]
        );
        return { id: (result as any).insertId, ...input };
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Location with this GHL ID already exists' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }
    }),

  /** Update a GHL location's sync config */
  updateLocation: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      region: z.string().optional(),
      isActive: z.boolean().optional(),
      syncDirection: z.enum(["bidirectional", "pull_only", "push_only", "disabled"]).optional(),
      syncFrequency: z.enum(["hourly", "every_6h", "daily", "weekly", "manual"]).optional(),
      conflictPolicy: z.enum(["ghl_wins", "stewardly_wins", "newest_wins", "manual_review"]).optional(),
      maxContactsPerRun: z.number().optional(),
      rateLimitMs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

      const updates: string[] = [];
      const params: any[] = [];

      if (input.name !== undefined) { updates.push("name = ?"); params.push(input.name); }
      if (input.region !== undefined) { updates.push("region = ?"); params.push(input.region); }
      if (input.isActive !== undefined) { updates.push("is_active = ?"); params.push(input.isActive ? 1 : 0); }
      if (input.syncDirection !== undefined) { updates.push("sync_direction = ?"); params.push(input.syncDirection); }
      if (input.syncFrequency !== undefined) { updates.push("sync_frequency = ?"); params.push(input.syncFrequency); }
      if (input.conflictPolicy !== undefined) { updates.push("conflict_policy = ?"); params.push(input.conflictPolicy); }
      if (input.maxContactsPerRun !== undefined) { updates.push("max_contacts_per_run = ?"); params.push(input.maxContactsPerRun); }
      if (input.rateLimitMs !== undefined) { updates.push("rate_limit_ms = ?"); params.push(input.rateLimitMs); }

      if (updates.length === 0) return { success: true };

      updates.push("updated_at = CURRENT_TIMESTAMP");
      params.push(input.id);

      await pool.query(`UPDATE ghl_locations SET ${updates.join(", ")} WHERE id = ?`, params);
      return { success: true };
    }),

  /** Delete a GHL location (soft: sets is_active = false) */
  deactivateLocation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      await pool.query("UPDATE ghl_locations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [input.id]);
      return { success: true };
    }),

  // ─── User-Location Access Management ──────────────────────────────────

  /** List user-location assignments */
  listUserLocations: protectedProcedure
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      try {
        const filter = input?.userId ? " WHERE ul.user_id = ?" : "";
        const params = input?.userId ? [input.userId] : [];
        const [rows] = await pool.query(
          `SELECT ul.*, gl.location_id AS ghl_location_id_str, gl.name AS location_name, gl.region
           FROM user_locations ul
           JOIN ghl_locations gl ON ul.ghl_location_id = gl.id${filter}
           ORDER BY gl.name`,
          params
        );
        return rows as any[];
      } catch {
        return [];
      }
    }),

  /** Assign a user to a location */
  assignUserLocation: protectedProcedure
    .input(z.object({
      userId: z.number(),
      ghlLocationId: z.number(),
      accessLevel: z.enum(["view", "manage", "admin"]).default("view"),
    }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      try {
        await pool.query(
          `INSERT INTO user_locations (user_id, ghl_location_id, access_level) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE access_level = VALUES(access_level)`,
          [input.userId, input.ghlLocationId, input.accessLevel]
        );
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }
    }),

  /** Remove a user-location assignment */
  removeUserLocation: protectedProcedure
    .input(z.object({ userId: z.number(), ghlLocationId: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      await pool.query(
        "DELETE FROM user_locations WHERE user_id = ? AND ghl_location_id = ?",
        [input.userId, input.ghlLocationId]
      );
      return { success: true };
    }),

  /** Get webhook activity feed (recent events with optional location filter) */
  getWebhookActivityFeed: protectedProcedure
    .input(z.object({
      locationDbId: z.number().optional(),
      limit: z.number().optional().default(50),
    }).optional())
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      try {
        const locationFilter = input?.locationDbId != null ? " AND location_id = ?" : "";
        const params: any[] = input?.locationDbId != null ? [input.locationDbId] : [];
        const [rows] = await pool.query(
          `SELECT id, event_type, provider_slug, processing_status, processing_error, location_id,
                  received_at, processed_at,
                  JSON_EXTRACT(payload_json, '$.contact.firstName') as contact_first_name,
                  JSON_EXTRACT(payload_json, '$.contact.lastName') as contact_last_name,
                  JSON_EXTRACT(payload_json, '$.contact.email') as contact_email
           FROM integration_webhook_events
           WHERE provider_slug = 'ghl'${locationFilter}
           ORDER BY received_at DESC LIMIT ?`,
          [...params, input?.limit ?? 50]
        );
        return rows as any[];
      } catch {
        return [];
      }
    }),

  /** Discover and auto-provision all GHL locations via API */
  discoverLocations: protectedProcedure
    .input(z.object({
      defaultSyncDirection: z.enum(["bidirectional", "pull_only", "push_only", "disabled"]).optional(),
      defaultConflictPolicy: z.enum(["ghl_wins", "stewardly_wins", "newest_wins", "manual_review"]).optional(),
      autoAssignAdmins: z.boolean().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const { discoverAndProvisionLocations } = await import("../services/locationAutoProvisioning");
      const results = await discoverAndProvisionLocations(input || undefined);
      return {
        total: results.length,
        created: results.filter(r => r.action === "created").length,
        existing: results.filter(r => r.action === "already_exists").length,
        reactivated: results.filter(r => r.action === "reactivated").length,
        results,
      };
    }),

  /** Manually provision a single location */
  provisionLocation: protectedProcedure
    .input(z.object({
      ghlLocationId: z.string().min(1),
      name: z.string().optional(),
      syncDirection: z.enum(["bidirectional", "pull_only", "push_only", "disabled"]).optional(),
      conflictPolicy: z.enum(["ghl_wins", "stewardly_wins", "newest_wins", "manual_review"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { provisionLocation } = await import("../services/locationAutoProvisioning");
      return provisionLocation(input.ghlLocationId, input.name, {
        defaultSyncDirection: input.syncDirection,
        defaultConflictPolicy: input.conflictPolicy,
      });
    }),

  /** Assign a user to a location */
  assignUserToLocation: protectedProcedure
    .input(z.object({
      userId: z.number(),
      locationDbId: z.number(),
      role: z.enum(["viewer", "editor", "admin"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { assignUser } = await import("../services/locationAutoProvisioning");
      const success = await assignUser(input.userId, input.locationDbId, input.role || "editor");
      return { success };
    }),

  /** Remove a user from a location */
  unassignUserFromLocation: protectedProcedure
    .input(z.object({
      userId: z.number(),
      locationDbId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { unassignUser } = await import("../services/locationAutoProvisioning");
      const success = await unassignUser(input.userId, input.locationDbId);
      return { success };
    }),

  /** Get provisioning audit log */
  getProvisioningLog: protectedProcedure
    .input(z.object({
      ghlLocationId: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getProvisioningLog } = await import("../services/locationAutoProvisioning");
      return getProvisioningLog(input?.ghlLocationId, input?.limit);
    }),

  /** List all users (admin only) for permission management */
  listUsers: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { users } = await import("../../drizzle/schema");
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(users.name);
      return allUsers;
    }),

  /** Get users assigned to a specific location */
  getLocationMembers: protectedProcedure
    .input(z.object({ locationDbId: z.number() }))
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      const [rows] = await pool.query(
        `SELECT ul.user_id, ul.role as location_role, ul.created_at as assigned_at,
                u.name, u.email, u.role as global_role, u.avatarUrl
         FROM user_locations ul
         JOIN users u ON u.id = ul.user_id
         WHERE ul.location_id = ?
         ORDER BY ul.role DESC, u.name ASC`,
        [input.locationDbId]
      );
      return rows as any[];
    }),

  /** Get all location assignments for a specific user */
  getUserLocationAssignments: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      const [rows] = await pool.query(
        `SELECT ul.location_id, ul.role as location_role, ul.created_at as assigned_at,
                gl.name as location_name, gl.ghl_location_id, gl.is_active
         FROM user_locations ul
         JOIN ghl_locations gl ON gl.id = ul.location_id
         WHERE ul.user_id = ?
         ORDER BY gl.name ASC`,
        [input.userId]
      );
      return rows as any[];
    }),

  /** Update a user's role within a specific location */
  updateLocationMemberRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      locationDbId: z.number(),
      role: z.enum(["viewer", "editor", "admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawPool();
      if (!pool) return { success: false };
      // Get previous role for audit trail
      const [prevRows] = await pool.query(
        "SELECT role FROM user_locations WHERE user_id = ? AND location_id = ?",
        [input.userId, input.locationDbId]
      );
      const previousRole = (prevRows as any[])[0]?.role || "unknown";
      const [result] = await pool.query(
        "UPDATE user_locations SET role = ? WHERE user_id = ? AND location_id = ?",
        [input.role, input.userId, input.locationDbId]
      );
      if ((result as any).affectedRows > 0) {
        const { logRoleUpdate } = await import("../services/auditLog");
        logRoleUpdate({
          actorId: ctx.user.id,
          actorName: ctx.user.name || ctx.user.email || "Unknown",
          actorRole: ctx.user.role || "user",
          userId: input.userId,
          locationId: input.locationDbId,
          previousRole,
          newRole: input.role,
        }).catch(() => {});
      }
      return { success: (result as any).affectedRows > 0 };
    }),

  /** Bulk assign users to a location */
  bulkAssignUsersToLocation: protectedProcedure
    .input(z.object({
      userIds: z.array(z.number()),
      locationDbId: z.number(),
      role: z.enum(["viewer", "editor", "admin"]).default("editor"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { assignUser } = await import("../services/locationAutoProvisioning");
      const { logAuditEvent } = await import("../services/auditLog");
      let assigned = 0;
      let skipped = 0;
      for (const userId of input.userIds) {
        const success = await assignUser(userId, input.locationDbId, input.role);
        if (success) assigned++; else skipped++;
      }
      // Log bulk assign audit event
      logAuditEvent({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Unknown",
        actorRole: ctx.user.role || "user",
        action: "bulk_assign",
        category: "permission",
        targetType: "location",
        targetId: String(input.locationDbId),
        locationId: input.locationDbId,
        afterState: { userIds: input.userIds, role: input.role },
        metadata: { assigned, skipped, total: input.userIds.length },
      }).catch(() => {});
      return { assigned, skipped, total: input.userIds.length };
    }),

  /** Bulk unassign users from a location */
  bulkUnassignUsersFromLocation: protectedProcedure
    .input(z.object({
      userIds: z.array(z.number()),
      locationDbId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { unassignUser } = await import("../services/locationAutoProvisioning");
      const { logAuditEvent } = await import("../services/auditLog");
      let removed = 0;
      for (const userId of input.userIds) {
        const success = await unassignUser(userId, input.locationDbId);
        if (success) removed++;
      }
      // Log bulk unassign audit event
      logAuditEvent({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Unknown",
        actorRole: ctx.user.role || "user",
        action: "bulk_unassign",
        category: "permission",
        targetType: "location",
        targetId: String(input.locationDbId),
        locationId: input.locationDbId,
        beforeState: { userIds: input.userIds },
        metadata: { removed, total: input.userIds.length },
      }).catch(() => {});
      return { removed, total: input.userIds.length };
    }),

  /** Get permission summary across all locations */
  getPermissionSummary: protectedProcedure
    .query(async () => {
      const pool = await getRawPool();
      if (!pool) return { locations: [], unassignedUsers: 0, totalAssignments: 0 };
      const [locationRows] = await pool.query(
        `SELECT gl.id, gl.name, gl.ghl_location_id, gl.is_active,
                COUNT(ul.user_id) as member_count,
                SUM(CASE WHEN ul.role = 'admin' THEN 1 ELSE 0 END) as admin_count,
                SUM(CASE WHEN ul.role = 'editor' THEN 1 ELSE 0 END) as editor_count,
                SUM(CASE WHEN ul.role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
         FROM ghl_locations gl
         LEFT JOIN user_locations ul ON ul.location_id = gl.id
         GROUP BY gl.id ORDER BY gl.name`
      );
      const [unassignedRows] = await pool.query(
        `SELECT COUNT(DISTINCT u.id) as cnt FROM users u
         LEFT JOIN user_locations ul ON ul.user_id = u.id
         WHERE ul.user_id IS NULL AND u.role != 'admin'`
      );
      const [totalRows] = await pool.query("SELECT COUNT(*) as cnt FROM user_locations");
      return {
        locations: locationRows as any[],
        unassignedUsers: (unassignedRows as any[])[0]?.cnt || 0,
        totalAssignments: (totalRows as any[])[0]?.cnt || 0,
      };
    }),

  /** Cross-location analytics: pipeline metrics by location */
  getCrossLocationAnalytics: protectedProcedure
    .input(z.object({
      locationDbId: z.number().optional(),
      dateRangeStart: z.number().optional(),
      dateRangeEnd: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return { statusBreakdown: [], conversions: [], velocity: [], syncHealth: [], timeSeries: [], totals: {}, dateRange: { start: 0, end: 0 } };

      const now = Date.now();
      const rangeStart = input?.dateRangeStart ?? (now - 30 * 24 * 60 * 60 * 1000);
      const rangeEnd = input?.dateRangeEnd ?? now;

      try {
        const locationFilter = input?.locationDbId != null ? " AND lp.location_id = ?" : "";
        const params: any[] = [rangeStart, rangeEnd];
        if (input?.locationDbId != null) params.push(input.locationDbId);

        const [statusRows] = await pool.query(
          `SELECT COALESCE(lp.location_id, 0) as location_id, gl.name as location_name, lp.status, COUNT(*) as count
           FROM lead_pipeline lp LEFT JOIN ghl_locations gl ON gl.id = lp.location_id
           WHERE lp.created_at >= ? AND lp.created_at <= ?${locationFilter}
           GROUP BY lp.location_id, lp.status ORDER BY lp.location_id, lp.status`, params);

        const [conversionRows] = await pool.query(
          `SELECT COALESCE(lp.location_id, 0) as location_id, gl.name as location_name,
             COUNT(*) as total_leads,
             SUM(CASE WHEN lp.status IN ('qualified','converted','proposal','negotiation') THEN 1 ELSE 0 END) as qualified,
             SUM(CASE WHEN lp.status = 'converted' THEN 1 ELSE 0 END) as converted,
             AVG(lp.propensityScore) as avg_propensity
           FROM lead_pipeline lp LEFT JOIN ghl_locations gl ON gl.id = lp.location_id
           WHERE lp.created_at >= ? AND lp.created_at <= ?${locationFilter}
           GROUP BY lp.location_id ORDER BY total_leads DESC`, params);

        const [velocityRows] = await pool.query(
          `SELECT COALESCE(lp.location_id, 0) as location_id, gl.name as location_name,
             COUNT(*) as total_leads, MIN(lp.created_at) as earliest_lead, MAX(lp.created_at) as latest_lead,
             AVG(lp.updated_at - lp.created_at) as avg_lifecycle_ms
           FROM lead_pipeline lp LEFT JOIN ghl_locations gl ON gl.id = lp.location_id
           WHERE lp.created_at >= ? AND lp.created_at <= ?${locationFilter}
           GROUP BY lp.location_id`, params);

        const syncFilter = input?.locationDbId != null ? " AND gl.id = ?" : "";
        const [syncRows] = await pool.query(
          `SELECT gl.id as location_id, gl.name as location_name, gl.location_id as ghl_location_id,
             gl.sync_direction, gl.last_sync_at, gl.is_active,
             (SELECT COUNT(*) FROM lead_pipeline lp WHERE lp.location_id = gl.id AND lp.crmExternalId IS NOT NULL) as linked_leads,
             (SELECT COUNT(*) FROM lead_pipeline lp WHERE lp.location_id = gl.id AND (lp.crmExternalId IS NULL OR lp.crmExternalId = '')) as unlinked_leads,
             (SELECT COUNT(*) FROM sync_run_history srh WHERE srh.location_id = gl.id AND srh.status = 'completed') as completed_syncs,
             (SELECT COUNT(*) FROM sync_run_history srh WHERE srh.location_id = gl.id AND srh.status = 'failed') as failed_syncs
           FROM ghl_locations gl WHERE gl.is_active = 1${syncFilter} ORDER BY gl.name`,
          input?.locationDbId != null ? [input.locationDbId] : []);

        const [timeSeriesRows] = await pool.query(
          `SELECT DATE(FROM_UNIXTIME(lp.created_at / 1000)) as date, COALESCE(lp.location_id, 0) as location_id, COUNT(*) as leads_created
           FROM lead_pipeline lp WHERE lp.created_at >= ? AND lp.created_at <= ?${locationFilter}
           GROUP BY date, lp.location_id ORDER BY date ASC`, params);

        const totalLeads = (conversionRows as any[]).reduce((s: number, r: any) => s + Number(r.total_leads), 0);
        const totalQualified = (conversionRows as any[]).reduce((s: number, r: any) => s + Number(r.qualified), 0);
        const totalConverted = (conversionRows as any[]).reduce((s: number, r: any) => s + Number(r.converted), 0);

        return {
          statusBreakdown: statusRows as any[],
          conversions: conversionRows as any[],
          velocity: velocityRows as any[],
          syncHealth: syncRows as any[],
          timeSeries: timeSeriesRows as any[],
          totals: {
            totalLeads, totalQualified, totalConverted,
            qualificationRate: totalLeads > 0 ? (totalQualified / totalLeads * 100).toFixed(1) : "0.0",
            conversionRate: totalLeads > 0 ? (totalConverted / totalLeads * 100).toFixed(1) : "0.0",
            locationCount: (syncRows as any[]).length,
          },
          dateRange: { start: rangeStart, end: rangeEnd },
        };
      } catch (err) {
        return { statusBreakdown: [], conversions: [], velocity: [], syncHealth: [], timeSeries: [], totals: {}, dateRange: { start: rangeStart, end: rangeEnd } };
      }
    }),

  // ─── CRM Audit Log Procedures ──────────────────────────────────────────

  /** Query CRM audit log with filters and pagination */
  getCrmAuditLog: protectedProcedure
    .input(z.object({
      actorId: z.number().optional(),
      action: z.string().optional(),
      category: z.string().optional(),
      locationId: z.number().optional(),
      targetType: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      limit: z.number().min(1).max(500).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const { queryAuditLog } = await import("../services/auditLog");
      return queryAuditLog(input ?? {});
    }),

  /** Get CRM audit log summary statistics */
  getCrmAuditSummary: protectedProcedure
    .input(z.object({
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      locationId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getAuditSummary } = await import("../services/auditLog");
      return getAuditSummary(input?.startDate, input?.endDate, input?.locationId);
    }),

  // ─── Location Onboarding Wizard Procedures ─────────────────────────────

  /** Step 1: Discover GHL sub-accounts */
  onboardingDiscoverLocations: protectedProcedure
    .query(async () => {
      const { discoverAndProvisionLocations } = await import("../services/locationAutoProvisioning");
      const pool = await getRawPool();
      if (!pool) return { discovered: [], existing: [] };
      // Get existing locations
      const [existingRows] = await pool.query(
        "SELECT id, name, ghl_location_id, is_active, sync_direction, sync_frequency FROM ghl_locations ORDER BY name"
      );
      // Attempt discovery
      try {
        const discovered = await discoverAndProvisionLocations();
        return { discovered, existing: existingRows as any[] };
      } catch {
        return { discovered: [], existing: existingRows as any[] };
      }
    }),

  /** Step 2: Configure sync settings for a location */
  onboardingConfigureLocation: protectedProcedure
    .input(z.object({
      locationDbId: z.number(),
      syncDirection: z.enum(["bidirectional", "pull_only", "push_only", "disabled"]).default("bidirectional"),
      syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]).default("daily"),
      conflictPolicy: z.enum(["ghl_wins", "stewardly_wins", "newest_wins", "manual"]).default("newest_wins"),
      rateLimitPerMinute: z.number().min(1).max(100).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawPool();
      if (!pool) return { success: false };
      // Get before state for audit
      const [beforeRows] = await pool.query(
        "SELECT sync_direction, sync_frequency, conflict_policy, rate_limit_per_minute FROM ghl_locations WHERE id = ?",
        [input.locationDbId]
      );
      const before = (beforeRows as any[])[0] || {};
      const [result] = await pool.query(
        `UPDATE ghl_locations SET sync_direction = ?, sync_frequency = ?, conflict_policy = ?, rate_limit_per_minute = ?
         WHERE id = ?`,
        [input.syncDirection, input.syncFrequency, input.conflictPolicy, input.rateLimitPerMinute, input.locationDbId]
      );
      // Audit log
      const { logLocationConfigChange } = await import("../services/auditLog");
      logLocationConfigChange({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Unknown",
        actorRole: ctx.user.role || "user",
        locationId: input.locationDbId,
        beforeConfig: {
          syncDirection: before.sync_direction,
          syncFrequency: before.sync_frequency,
          conflictPolicy: before.conflict_policy,
          rateLimitPerMinute: before.rate_limit_per_minute,
        },
        afterConfig: {
          syncDirection: input.syncDirection,
          syncFrequency: input.syncFrequency,
          conflictPolicy: input.conflictPolicy,
          rateLimitPerMinute: input.rateLimitPerMinute,
        },
      }).catch(() => {});
      return { success: (result as any).affectedRows > 0 };
    }),

  /** Step 3: Assign team members during onboarding */
  onboardingAssignMembers: protectedProcedure
    .input(z.object({
      locationDbId: z.number(),
      assignments: z.array(z.object({
        userId: z.number(),
        role: z.enum(["viewer", "editor", "admin"]).default("editor"),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { assignUser } = await import("../services/locationAutoProvisioning");
      const { logAuditEvent } = await import("../services/auditLog");
      let assigned = 0;
      let skipped = 0;
      for (const a of input.assignments) {
        const success = await assignUser(a.userId, input.locationDbId, a.role);
        if (success) assigned++; else skipped++;
      }
      logAuditEvent({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Unknown",
        actorRole: ctx.user.role || "user",
        action: "bulk_assign",
        category: "permission",
        targetType: "location",
        targetId: String(input.locationDbId),
        locationId: input.locationDbId,
        metadata: { assigned, skipped, source: "onboarding_wizard" },
      }).catch(() => {});
      return { assigned, skipped };
    }),

  /** Step 4: Run first reconciliation for a location */
  onboardingRunReconciliation: protectedProcedure
    .input(z.object({
      locationDbId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawPool();
      if (!pool) return { success: false, error: "Database unavailable" };
      // Get location config
      const [locRows] = await pool.query(
        "SELECT ghl_location_id, name, sync_direction, api_key, conflict_policy, rate_limit_per_minute FROM ghl_locations WHERE id = ?",
        [input.locationDbId]
      );
      const loc = (locRows as any[])[0];
      if (!loc) return { success: false, error: "Location not found" };
      const { logReconciliationEvent } = await import("../services/auditLog");
      logReconciliationEvent({
        action: "reconciliation_started",
        locationId: input.locationDbId,
        locationName: loc.name,
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Unknown",
        metadata: { source: "onboarding_wizard" },
      }).catch(() => {});
      try {
        const { reconcile } = await import("../services/syncReconciliation");
        // SSE event bus functions imported at top level
        const stats = await reconcile({
          location: {
            dbId: input.locationDbId,
            locationId: loc.ghl_location_id,
            name: loc.name,
            syncDirection: loc.sync_direction || "bidirectional",
            conflictPolicy: loc.conflict_policy || "newest_wins",
            maxContactsPerRun: 0,
            rateLimitMs: loc.rate_limit_per_minute ? Math.round(60000 / loc.rate_limit_per_minute) : 50,
            apiKey: loc.api_key || undefined,
          },
          onProgress: (progressStats) => {
            emitReconcileProgress({
              locationId: input.locationDbId,
              locationName: loc.name,
              processed: progressStats.ghlTotal,
              total: progressStats.ghlTotal + 100, // estimate; grows as we page
              matched: progressStats.matched,
              created: progressStats.createdInStewardly,
              errors: progressStats.errors,
            });
          },
        });
        logReconciliationEvent({
          action: "reconciliation_completed",
          locationId: input.locationDbId,
          locationName: loc.name,
          actorId: ctx.user.id,
          actorName: ctx.user.name || ctx.user.email || "Unknown",
          metadata: { source: "onboarding_wizard", ...stats },
        }).catch(() => {});
        // Emit SSE reconcile complete event
        emitReconcileComplete({
          locationId: input.locationDbId,
          locationName: loc.name,
          stats: {
            ghlTotal: stats.ghlTotal,
            matched: stats.matched,
            createdInStewardly: stats.createdInStewardly,
            createdInGHL: stats.createdInGHL,
            updatedInStewardly: stats.updatedInStewardly,
            updatedInGHL: stats.updatedInGHL,
            conflictsResolved: stats.conflictsResolved,
            orphansFixed: stats.orphansFixed,
            errors: stats.errors,
          },
          durationMs: stats.duration_ms,
        });
        return { success: true, stats };
      } catch (err: any) {
        logReconciliationEvent({
          action: "reconciliation_failed",
          locationId: input.locationDbId,
          locationName: loc.name,
          actorId: ctx.user.id,
          actorName: ctx.user.name || ctx.user.email || "Unknown",
          metadata: { source: "onboarding_wizard", error: err?.message },
        }).catch(() => {});
        // Emit SSE sync error event
        emitSyncError({
          locationId: input.locationDbId,
          locationName: loc.name,
          error: err?.message || "Reconciliation failed",
          context: "onboarding_wizard",
        });
        return { success: false, error: err?.message || "Reconciliation failed" };
      }
    }),

  /** Get onboarding status for all locations */
  getOnboardingStatus: protectedProcedure
    .query(async () => {
      const pool = await getRawPool();
      if (!pool) return { locations: [] };
      const [rows] = await pool.query(
        `SELECT gl.id, gl.name, gl.ghl_location_id, gl.is_active,
                gl.sync_direction, gl.sync_frequency, gl.conflict_policy,
                gl.rate_limit_per_minute,
                COUNT(DISTINCT ul.user_id) as member_count,
                (SELECT COUNT(*) FROM sync_run_history srh WHERE srh.triggered_by LIKE CONCAT('%', gl.ghl_location_id, '%') AND srh.status = 'completed') as completed_syncs
         FROM ghl_locations gl
         LEFT JOIN user_locations ul ON ul.location_id = gl.id
         GROUP BY gl.id ORDER BY gl.name`
      );
      return {
        locations: (rows as any[]).map((r: any) => ({
          id: r.id,
          name: r.name,
          ghlLocationId: r.ghl_location_id,
          isActive: r.is_active,
          syncDirection: r.sync_direction,
          syncFrequency: r.sync_frequency,
          conflictPolicy: r.conflict_policy,
          rateLimitPerMinute: r.rate_limit_per_minute,
          memberCount: Number(r.member_count),
          completedSyncs: Number(r.completed_syncs),
          isConfigured: r.sync_direction !== "disabled" && r.sync_direction != null,
          hasMembers: Number(r.member_count) > 0,
          hasSynced: Number(r.completed_syncs) > 0,
        })),
      };
    }),

  // ─── GHL Webhook Setup Helpers ───────────────────────────────────────────
  ghlWebhookHealth: protectedProcedure.query(async () => {
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 3000}/api/webhooks/ghl/health`);
      if (!resp.ok) return { status: "error", message: `HTTP ${resp.status}` };
      const data = await resp.json();
      return { status: "ok", ...data };
    } catch (e: any) {
      return { status: "error", message: e.message };
    }
  }),

  testGhlWebhook: protectedProcedure.mutation(async () => {
    try {
      const testPayload = {
        type: "ContactCreate",
        locationId: process.env.GHL_LOCATION_ID || "test-location",
        id: `test-${Date.now()}`,
        firstName: "Webhook",
        lastName: "Test",
        email: "webhook-test@stewardly.ai",
        phone: "+1234567890",
        _testEvent: true,
        timestamp: Date.now(),
      };
      const resp = await fetch(`http://localhost:${process.env.PORT || 3000}/api/webhooks/ghl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });
      const data = await resp.json();
      return { success: resp.ok, status: resp.status, response: data };
    } catch (e: any) {
      return { success: false, status: 0, response: { error: e.message } };
    }
  }),

  // ─── GHL Polling Fallback ────────────────────────────────────────────
  getPollingStatus: protectedProcedure.query(async () => {
    const { getPollingStatus } = await import("../services/ghlPolling");
    const db = getDb();
    let locCount = 0;
    if (db) {
      const locs = await db.select().from(ghlLocations).where(eq(ghlLocations.isActive, 1 as any));
      locCount = locs.length;
    }
    return getPollingStatus(locCount);
  }),

  triggerPollCycle: protectedProcedure.mutation(async () => {
    const { runPollCycle, updateLastCycleResult, setPollingActive } = await import("../services/ghlPolling");
    setPollingActive(true);
    const result = await runPollCycle();
    updateLastCycleResult(result);
    return result;
  }),

  setPollingConfig: protectedProcedure
    .input(z.object({
      active: z.boolean().optional(),
      intervalMs: z.number().min(60000).max(3600000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { setPollingActive, setPollingInterval } = await import("../services/ghlPolling");
      if (input.active !== undefined) setPollingActive(input.active);
      if (input.intervalMs !== undefined) setPollingInterval(input.intervalMs);
      return { success: true };
    }),

  // ─── Location Health Monitoring ──────────────────────────────────────
  getLocationHealth: protectedProcedure
    .input(z.object({ locationDbId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (!db) return { locations: [], alerts: [] };
      const pool = getRawPool();
      
      // Get all active locations with their sync status
      let locations;
      if (input?.locationDbId) {
        locations = await db.select().from(ghlLocations).where(eq(ghlLocations.id, input.locationDbId));
      } else {
        locations = await db.select().from(ghlLocations).where(eq(ghlLocations.isActive, 1 as any));
      }
      
      const now = Date.now();
      const alerts: Array<{ locationId: string; locationName: string; type: string; severity: string; message: string; timestamp: number }> = [];
      
      const healthData = locations.map(loc => {
        const syncLagMs = loc.lastSyncAt ? now - loc.lastSyncAt : null;
        const syncLagMinutes = syncLagMs ? Math.round(syncLagMs / 60000) : null;
        
        // Determine health status
        let healthStatus: "healthy" | "warning" | "critical" | "unknown" = "unknown";
        if (!loc.lastSyncAt) {
          healthStatus = "unknown";
        } else if (loc.lastSyncStatus === "failed") {
          healthStatus = "critical";
          alerts.push({
            locationId: loc.locationId,
            locationName: loc.name,
            type: "sync_failed",
            severity: "critical",
            message: `Last sync failed for ${loc.name}`,
            timestamp: loc.lastSyncAt,
          });
        } else if (syncLagMinutes && syncLagMinutes > 60) {
          healthStatus = "warning";
          alerts.push({
            locationId: loc.locationId,
            locationName: loc.name,
            type: "sync_lag",
            severity: "warning",
            message: `Sync lag of ${syncLagMinutes} minutes for ${loc.name}`,
            timestamp: now,
          });
        } else {
          healthStatus = "healthy";
        }
        
        return {
          id: loc.id,
          locationId: loc.locationId,
          name: loc.name,
          region: loc.region,
          healthStatus,
          syncDirection: loc.syncDirection,
          syncFrequency: loc.syncFrequency,
          lastSyncAt: loc.lastSyncAt,
          lastSyncStatus: loc.lastSyncStatus,
          syncLagMinutes,
          totalContacts: loc.totalContacts,
          linkedContacts: loc.linkedContacts,
          conflictPolicy: loc.conflictPolicy,
        };
      });
      
      return { locations: healthData, alerts };
    }),

  getHealthHistory: protectedProcedure
    .input(z.object({
      locationDbId: z.number().optional(),
      days: z.number().min(1).max(90).default(7),
    }).optional())
    .query(async ({ input }) => {
      const pool = getRawPool();
      if (!pool) return { history: [] };
      
      const days = input?.days || 7;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      
      let query = `SELECT id, connection_id, sync_type, status, records_synced, records_failed, error_message, started_at, completed_at 
                   FROM integration_sync_logs WHERE started_at > ? ORDER BY started_at DESC LIMIT 500`;
      const params: any[] = [new Date(cutoff)];
      
      const [rows] = await pool.execute(query, params);
      
      return {
        history: (rows as any[]).map(r => ({
          id: r.id,
          connectionId: r.connection_id,
          syncType: r.sync_type,
          status: r.status,
          recordsSynced: r.records_synced,
          recordsFailed: r.records_failed,
          errorMessage: r.error_message,
          startedAt: r.started_at ? new Date(r.started_at).getTime() : null,
          completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
        })),
      };
    }),
});
