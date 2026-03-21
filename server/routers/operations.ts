/**
 * Operations Router — Tasks #37-39, #43-47, #49, #52-56
 * Permissions, key rotation, retention, PWA, accessibility, infra docs,
 * field sharing, org AI config, compliance prediction, reconciliation,
 * CRM sync, market streaming, regulatory impact, load testing
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as perms from "../services/dynamicPermissions";
import * as keys from "../services/keyRotation";
import * as retention from "../services/retentionEnforcement";
import * as pwa from "../services/pwaOffline";
import * as a11y from "../services/accessibilityEngine";
import * as infra from "../services/infrastructureDocs";
import * as sharing from "../services/fieldSharing";
import * as orgAi from "../services/orgAiConfig";
import * as compliance from "../services/compliancePrediction";
import * as recon from "../services/accountReconciliation";
import * as crm from "../services/crmSync";
import * as market from "../services/marketStreaming";
import * as regImpact from "../services/regulatoryImpact";
import * as load from "../services/loadTesting";

export const operationsRouter = router({
  // ─── Dynamic Permissions ───────────────────────────────────────────
  permissions: router({
    evaluate: protectedProcedure
      .input(z.object({
        action: z.string(),
        resource: z.string(),
        resourceOwnerId: z.number().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .query(async ({ input, ctx }) => perms.evaluatePermission({
        userId: ctx.user.id,
        role: ctx.user.role ?? "user",
        action: input.action,
        resource: input.resource,
        resourceOwnerId: input.resourceOwnerId,
        metadata: input.metadata,
      })),

    availableActions: protectedProcedure
      .input(z.object({ resource: z.string() }))
      .query(async ({ input, ctx }) => perms.getAvailableActions(ctx.user.role ?? "user", input.resource)),

    resources: publicProcedure
      .query(async () => perms.getAllResources()),

    hierarchy: publicProcedure
      .query(async () => perms.getRoleHierarchy()),
  }),

  // ─── Key Rotation ──────────────────────────────────────────────────
  keys: router({
    health: protectedProcedure
      .query(async () => keys.getKeyHealth()),

    rotate: protectedProcedure
      .input(z.object({ service: z.string(), gracePeriodHours: z.number().optional() }))
      .mutation(async ({ input }) => {
        const result = keys.rotateKey(input.service, input.gracePeriodHours);
        return { keyId: result.record.id, service: result.record.service };
      }),

    revokeExpired: protectedProcedure
      .mutation(async () => ({ revoked: keys.revokeExpiredKeys() })),

    log: protectedProcedure
      .input(z.object({ service: z.string().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => keys.getRotationLog(input?.service, input?.limit)),
  }),

  // ─── Data Retention ────────────────────────────────────────────────
  retention: router({
    policies: protectedProcedure
      .query(async () => retention.getPolicies()),

    updatePolicy: protectedProcedure
      .input(z.object({
        resource: z.string(),
        retentionDays: z.number().optional(),
        action: z.enum(["archive", "delete", "anonymize"]).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { resource, ...updates } = input;
        return retention.updatePolicy(resource, updates);
      }),

    enforce: protectedProcedure
      .mutation(async () => retention.enforceRetention()),

    report: protectedProcedure
      .query(async () => retention.getRetentionReport()),
  }),

  // ─── PWA / Offline ─────────────────────────────────────────────────
  pwa: router({
    manifest: publicProcedure
      .query(async () => pwa.getPWAManifest()),

    serviceWorkerConfig: publicProcedure
      .query(async () => pwa.getServiceWorkerConfig()),

    offlineStats: protectedProcedure
      .query(async () => pwa.getOfflineStats()),

    queueAction: protectedProcedure
      .input(z.object({
        type: z.enum(["message", "feedback", "calculator", "document_view"]),
        payload: z.any(),
      }))
      .mutation(async ({ input }) => pwa.queueOfflineAction({ ...input, timestamp: Date.now() })),

    syncAction: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => ({ synced: pwa.markSynced(input.id) })),
  }),

  // ─── Accessibility ─────────────────────────────────────────────────
  accessibility: router({
    checklist: publicProcedure
      .query(async () => a11y.getAccessibilityChecklist()),

    report: protectedProcedure
      .input(z.object({ passedIds: z.array(z.string()) }))
      .mutation(async ({ input }) => a11y.generateReport(input.passedIds)),

    screenReaderHints: publicProcedure
      .input(z.object({ pageName: z.string() }))
      .query(async ({ input }) => a11y.getScreenReaderHints(input.pageName)),

    contrastCheck: publicProcedure
      .input(z.object({ foreground: z.string(), background: z.string() }))
      .query(async ({ input }) => ({
        ratio: a11y.getContrastRatio(input.foreground, input.background),
        passesAA: a11y.getContrastRatio(input.foreground, input.background) >= 4.5,
        passesAAA: a11y.getContrastRatio(input.foreground, input.background) >= 7,
      })),
  }),

  // ─── Infrastructure Docs ───────────────────────────────────────────
  infra: router({
    architecture: publicProcedure
      .query(async () => infra.getArchitectureOverview()),

    apiEndpoints: publicProcedure
      .query(async () => infra.getAPIEndpoints()),

    deploymentGuide: protectedProcedure
      .query(async () => infra.getDeploymentGuide()),

    databaseStats: protectedProcedure
      .query(async () => infra.getDatabaseStats()),
  }),

  // ─── Field Sharing ─────────────────────────────────────────────────
  fieldSharing: router({
    rules: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => sharing.getFieldRules(input?.category)),

    getVisibility: protectedProcedure
      .input(z.object({ fieldName: z.string() }))
      .query(async ({ input, ctx }) => ({
        fieldName: input.fieldName,
        visibility: sharing.getFieldVisibility(ctx.user.id, input.fieldName),
      })),

    setVisibility: protectedProcedure
      .input(z.object({ fieldName: z.string(), visibility: z.enum(["private", "professional", "management", "admin", "public"]) }))
      .mutation(async ({ input, ctx }) => ({
        success: sharing.setFieldVisibility(ctx.user.id, input.fieldName, input.visibility),
      })),

    overrides: protectedProcedure
      .query(async ({ ctx }) => sharing.getUserFieldOverrides(ctx.user.id)),

    filterForViewer: protectedProcedure
      .input(z.object({ data: z.record(z.string(), z.any()), targetUserId: z.number() }))
      .query(async ({ input, ctx }) => sharing.filterFieldsForViewer(input.data, input.targetUserId, ctx.user.role ?? "user")),
  }),

  // ─── Org AI Config ─────────────────────────────────────────────────
  orgAiConfig: router({
    get: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => orgAi.getOrgConfig(input.orgId)),

    update: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        aiEnabled: z.boolean().optional(),
        maxTokensPerResponse: z.number().optional(),
        allowedCapabilityModes: z.array(z.string()).optional(),
        customSystemPromptPrefix: z.string().optional(),
        customSystemPromptSuffix: z.string().optional(),
        disabledTools: z.array(z.string()).optional(),
        complianceLevel: z.enum(["standard", "enhanced", "strict"]).optional(),
        allowVoiceMode: z.boolean().optional(),
        allowDocumentUpload: z.boolean().optional(),
        allowExports: z.boolean().optional(),
        customDisclaimer: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { orgId, ...updates } = input;
        return orgAi.updateOrgConfig(orgId, updates);
      }),

    list: protectedProcedure
      .query(async () => orgAi.listOrgConfigs()),
  }),

  // ─── Compliance Prediction ─────────────────────────────────────────
  compliancePrediction: router({
    calculate: protectedProcedure
      .input(z.object({
        suitabilityCompletionRate: z.number(),
        disclosureRate: z.number(),
        auditTrailCoverage: z.number(),
        dataRetentionCompliance: z.number(),
        piiProtectionScore: z.number(),
        escalationResponseTime: z.number(),
        regulatoryUpdateLag: z.number(),
        clientComplaintRate: z.number(),
      }))
      .mutation(async ({ input }) => compliance.calculateComplianceRisk(input)),

    aiAssessment: protectedProcedure
      .input(z.object({ context: z.string() }))
      .mutation(async ({ input }) => ({ assessment: await compliance.getAIComplianceAssessment(input.context) })),
  }),

  // ─── Account Reconciliation ────────────────────────────────────────
  reconciliation: router({
    run: protectedProcedure
      .input(z.object({
        profileData: z.record(z.string(), z.any()),
        externalData: z.record(z.string(), z.any()),
        source: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => recon.reconcileAccounts(ctx.user.id, input.profileData, input.externalData, input.source)),

    suggestResolutions: protectedProcedure
      .input(z.object({ report: z.any() }))
      .query(async ({ input }) => recon.suggestResolutions(input.report)),
  }),

  // ─── CRM Sync ──────────────────────────────────────────────────────
  crm: router({
    connections: protectedProcedure
      .query(async () => crm.listConnections()),

    createConnection: protectedProcedure
      .input(z.object({
        provider: z.enum(["salesforce", "hubspot", "dynamics", "zoho", "custom"]),
        syncDirection: z.enum(["inbound", "outbound", "bidirectional"]),
        syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]),
      }))
      .mutation(async ({ input }) => crm.createConnection(input)),

    deleteConnection: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => ({ deleted: crm.deleteConnection(input.id) })),

    sync: protectedProcedure
      .input(z.object({ connectionId: z.string() }))
      .mutation(async ({ input }) => crm.simulateSync(input.connectionId)),

    stats: protectedProcedure
      .query(async () => crm.getSyncStats()),
  }),

  // ─── Market Streaming ──────────────────────────────────────────────
  market: router({
    snapshot: publicProcedure
      .query(async () => market.getMarketSnapshot()),

    symbol: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => market.getSymbolData(input.symbol)),

    createAlert: protectedProcedure
      .input(z.object({
        symbol: z.string(),
        condition: z.enum(["above", "below", "change_percent"]),
        threshold: z.number(),
      }))
      .mutation(async ({ input, ctx }) => market.createAlert(ctx.user.id, input.symbol, input.condition, input.threshold)),

    alerts: protectedProcedure
      .query(async ({ ctx }) => market.getUserAlerts(ctx.user.id)),

    deleteAlert: protectedProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ input }) => ({ deleted: market.deleteAlert(input.alertId) })),

    checkAlerts: protectedProcedure
      .mutation(async () => market.checkAlerts()),

    portfolioImpact: protectedProcedure
      .input(z.object({
        holdings: z.array(z.object({
          symbol: z.string(),
          shares: z.number(),
          costBasis: z.number(),
        })),
      }))
      .query(async ({ input }) => market.calculatePortfolioImpact(input.holdings)),
  }),

  // ─── Regulatory Impact ─────────────────────────────────────────────
  regulatoryImpact: router({
    assess: protectedProcedure
      .input(z.object({
        id: z.string(),
        regulation: z.string(),
        effectiveDate: z.string(),
        summary: z.string(),
        source: z.string(),
        status: z.enum(["proposed", "final", "effective", "repealed"]),
      }))
      .mutation(async ({ input }) => regImpact.assessImpact(input)),

    aiAnalysis: protectedProcedure
      .input(z.object({
        regulation: z.string(),
        effectiveDate: z.string(),
        summary: z.string(),
        source: z.string(),
        status: z.enum(["proposed", "final", "effective", "repealed"]),
      }))
      .mutation(async ({ input }) => ({
        analysis: await regImpact.getAIRegulatoryAnalysis({ ...input, id: `reg_${Date.now()}` }),
      })),
  }),

  // ─── Load Testing ──────────────────────────────────────────────────
  loadTesting: router({
    presets: protectedProcedure
      .query(async () => load.getLoadTestPresets()),

    run: protectedProcedure
      .input(z.object({
        name: z.string(),
        targetEndpoints: z.array(z.string()),
        concurrentUsers: z.number(),
        duration: z.number(),
        rampUpTime: z.number(),
        thinkTime: z.number(),
      }))
      .mutation(async ({ input }) => load.simulateLoadTest(input)),

    metrics: protectedProcedure
      .input(z.object({ endpoint: z.string().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => load.getRecentMetrics(input?.endpoint, input?.limit)),

    summary: protectedProcedure
      .query(async () => load.getPerformanceSummary()),
  }),
});
