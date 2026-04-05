/**
 * 5-Layer AI Personalization Router
 *
 * Role-gated CRUD for each layer:
 *  L1 (Platform)     — global_admin only
 *  L2 (Organization) — org_admin (handled in orgBranding.ts, extended here)
 *  L3 (Manager)      — manager+ in org
 *  L4 (Professional) — professional+ in org
 *  L5 (User)         — own user only
 *
 * Plus: preview endpoint to see assembled config for any user (admin/manager can preview)
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  platformAISettings,
  organizationAISettings,
  managerAISettings,
  professionalAISettings,
  userPreferences,
  userOrganizationRoles,
} from "../../drizzle/schema";
import { resolveAIConfig, buildLayerOverlayPrompt, validateInheritance } from "../aiConfigResolver";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getDb() {
  const mod = await import("../db");
  const db = await mod.getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Check if user has global_admin role in any org */
async function isGlobalAdmin(userId: number): Promise<boolean> {
  const mod = await import("../db");
  const db = await mod.getDb();
  if (!db) return false; // Not admin if DB unavailable
  const [role] = await db
    .select()
    .from(userOrganizationRoles)
    .where(
      and(
        eq(userOrganizationRoles.userId, userId),
        eq(userOrganizationRoles.globalRole, "global_admin")
      )
    )
    .limit(1);
  return !!role;
}

/** Check user's org role */
async function getOrgRole(userId: number, orgId: number) {
  const db = await getDb();
  const [role] = await db
    .select()
    .from(userOrganizationRoles)
    .where(
      and(
        eq(userOrganizationRoles.userId, userId),
        eq(userOrganizationRoles.organizationId, orgId)
      )
    )
    .limit(1);
  return role;
}

const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  professional: 1,
  manager: 2,
  org_admin: 3,
};

function hasMinOrgRole(actualRole: string | null | undefined, minRole: string): boolean {
  return (ROLE_HIERARCHY[actualRole ?? "user"] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

export const aiLayersRouter = router({

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Platform Settings (global_admin only)
  // ═══════════════════════════════════════════════════════════════════════════

  getPlatformSettings: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const admin = await isGlobalAdmin(ctx.user.id);
    if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "Global admin required" });

    const db = await getDb();
    const [settings] = await db
      .select()
      .from(platformAISettings)
      .where(eq(platformAISettings.settingKey, "default"))
      .limit(1);
    return settings || null;
  }),

  updatePlatformSettings: protectedProcedure
    .input(z.object({
      baseSystemPrompt: z.string().optional(),
      defaultTone: z.string().max(64).optional(),
      defaultResponseFormat: z.string().max(64).optional(),
      defaultResponseLength: z.string().max(64).optional(),
      modelPreferences: z.record(z.string(), z.string()).optional(),
      ensembleWeights: z.record(z.string(), z.number()).optional(),
      globalGuardrails: z.array(z.string()).optional(),
      prohibitedTopics: z.array(z.string()).optional(),
      maxTokensDefault: z.number().min(256).max(32768).optional(),
      temperatureDefault: z.number().min(0).max(2).optional(),
      enabledFocusModes: z.array(z.string()).optional(),
      platformDisclaimer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await isGlobalAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "Global admin required" });

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(platformAISettings)
        .where(eq(platformAISettings.settingKey, "default"))
        .limit(1);

      const data: Record<string, unknown> = {};
      if (input.baseSystemPrompt !== undefined) data.baseSystemPrompt = input.baseSystemPrompt;
      if (input.defaultTone !== undefined) data.defaultTone = input.defaultTone;
      if (input.defaultResponseFormat !== undefined) data.defaultResponseFormat = input.defaultResponseFormat;
      if (input.defaultResponseLength !== undefined) data.defaultResponseLength = input.defaultResponseLength;
      if (input.modelPreferences !== undefined) data.modelPreferences = input.modelPreferences;
      if (input.ensembleWeights !== undefined) data.ensembleWeights = input.ensembleWeights;
      if (input.globalGuardrails !== undefined) data.globalGuardrails = input.globalGuardrails;
      if (input.prohibitedTopics !== undefined) data.prohibitedTopics = input.prohibitedTopics;
      if (input.maxTokensDefault !== undefined) data.maxTokensDefault = input.maxTokensDefault;
      if (input.temperatureDefault !== undefined) data.temperatureDefault = input.temperatureDefault;
      if (input.enabledFocusModes !== undefined) data.enabledFocusModes = input.enabledFocusModes;
      if (input.platformDisclaimer !== undefined) data.platformDisclaimer = input.platformDisclaimer;

      if (existing) {
        await db.update(platformAISettings).set(data).where(eq(platformAISettings.settingKey, "default"));
      } else {
        await db.insert(platformAISettings).values({ settingKey: "default", ...data });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: Organization Settings (org_admin) — extended from orgBranding
  // ═══════════════════════════════════════════════════════════════════════════

  getOrgAISettings: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const role = await getOrgRole(ctx.user.id, input.organizationId);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      const [settings] = await db
        .select()
        .from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, input.organizationId))
        .limit(1);
      return settings || null;
    }),

  updateOrgAISettings: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      organizationName: z.string().max(256).optional(),
      brandVoice: z.string().optional(),
      approvedProductCategories: z.array(z.string()).optional(),
      prohibitedTopics: z.array(z.string()).optional(),
      complianceLanguage: z.string().optional(),
      customDisclaimers: z.string().optional(),
      promptOverlay: z.string().optional(),
      toneStyle: z.string().max(64).optional(),
      responseFormat: z.string().max(64).optional(),
      responseLength: z.string().max(64).optional(),
      modelPreferences: z.record(z.string(), z.string()).optional(),
      ensembleWeights: z.record(z.string(), z.number()).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(256).max(32768).optional(),
      enabledFocusModes: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const role = await getOrgRole(ctx.user.id, input.organizationId);
      if (!role || !hasMinOrgRole(role.organizationRole, "org_admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Org admin required" });
      }

      const db = await getDb();
      const { organizationId, ...updateData } = input;
      const [existing] = await db
        .select()
        .from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, organizationId))
        .limit(1);

      if (existing) {
        await db.update(organizationAISettings).set(updateData).where(eq(organizationAISettings.organizationId, organizationId));
      } else {
        await db.insert(organizationAISettings).values({
          organizationId,
          organizationName: updateData.organizationName || "Organization",
          ...updateData,
        });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: Manager Settings (manager+ in org)
  // ═══════════════════════════════════════════════════════════════════════════

  getManagerSettings: protectedProcedure
    .input(z.object({ managerId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Manager can only view their own settings, or admin/global_admin can view any
      if (ctx.user.id !== input.managerId) {
        const admin = await isGlobalAdmin(ctx.user.id);
        if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "Can only view your own manager settings" });
      }

      const db = await getDb();
      const [settings] = await db
        .select()
        .from(managerAISettings)
        .where(eq(managerAISettings.managerId, input.managerId))
        .limit(1);
      return settings || null;
    }),

  updateManagerSettings: protectedProcedure
    .input(z.object({
      managerId: z.number(),
      organizationId: z.number().optional(),
      teamFocusAreas: z.array(z.string()).optional(),
      clientSegmentTargeting: z.string().optional(),
      reportingRequirements: z.array(z.string()).optional(),
      promptOverlay: z.string().optional(),
      toneStyle: z.string().max(64).optional(),
      responseFormat: z.string().max(64).optional(),
      responseLength: z.string().max(64).optional(),
      modelPreferences: z.record(z.string(), z.string()).optional(),
      ensembleWeights: z.record(z.string(), z.number()).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(256).max(32768).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Only the manager themselves or a global admin can update
      if (ctx.user.id !== input.managerId) {
        const admin = await isGlobalAdmin(ctx.user.id);
        if (!admin) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      const { managerId, ...updateData } = input;
      const [existing] = await db
        .select()
        .from(managerAISettings)
        .where(eq(managerAISettings.managerId, managerId))
        .limit(1);

      if (existing) {
        await db.update(managerAISettings).set(updateData).where(eq(managerAISettings.managerId, managerId));
      } else {
        await db.insert(managerAISettings).values({ managerId, ...updateData });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: Professional Settings (professional+ in org)
  // ═══════════════════════════════════════════════════════════════════════════

  getProfessionalSettings: protectedProcedure
    .input(z.object({ professionalId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.id !== input.professionalId) {
        const admin = await isGlobalAdmin(ctx.user.id);
        if (!admin) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      const [settings] = await db
        .select()
        .from(professionalAISettings)
        .where(eq(professionalAISettings.professionalId, input.professionalId))
        .limit(1);
      return settings || null;
    }),

  updateProfessionalSettings: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      organizationId: z.number().optional(),
      managerId: z.number().optional(),
      specialization: z.string().max(256).optional(),
      methodology: z.string().optional(),
      communicationStyle: z.string().optional(),
      perClientOverrides: z.record(z.string(), z.unknown()).optional(),
      promptOverlay: z.string().optional(),
      toneStyle: z.string().max(64).optional(),
      responseFormat: z.string().max(64).optional(),
      responseLength: z.string().max(64).optional(),
      modelPreferences: z.record(z.string(), z.string()).optional(),
      ensembleWeights: z.record(z.string(), z.number()).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(256).max(32768).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.id !== input.professionalId) {
        const admin = await isGlobalAdmin(ctx.user.id);
        if (!admin) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      const { professionalId, ...updateData } = input;
      const [existing] = await db
        .select()
        .from(professionalAISettings)
        .where(eq(professionalAISettings.professionalId, professionalId))
        .limit(1);

      if (existing) {
        await db.update(professionalAISettings).set(updateData).where(eq(professionalAISettings.professionalId, professionalId));
      } else {
        await db.insert(professionalAISettings).values({ professionalId, ...updateData });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: User Preferences (own user only)
  // ═══════════════════════════════════════════════════════════════════════════

  getUserPreferences: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = await getDb();
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);
    return prefs || null;
  }),

  updateUserPreferences: protectedProcedure
    .input(z.object({
      communicationStyle: z.enum(["simple", "detailed", "expert"]).optional(),
      responseLength: z.enum(["concise", "standard", "comprehensive"]).optional(),
      responseFormat: z.string().max(64).optional(),
      ttsVoice: z.string().max(64).optional(),
      autoPlayVoice: z.boolean().optional(),
      handsFreeMode: z.boolean().optional(),
      autoGenerateCharts: z.boolean().optional(),
      riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      financialGoals: z.array(z.string()).optional(),
      taxFilingStatus: z.string().max(64).optional(),
      stateOfResidence: z.string().max(64).optional(),
      theme: z.enum(["system", "light", "dark"]).optional(),
      sidebarDefault: z.enum(["expanded", "collapsed"]).optional(),
      chatDensity: z.enum(["comfortable", "compact"]).optional(),
      language: z.string().max(64).optional(),
      modelPreferences: z.record(z.string(), z.string()).optional(),
      ensembleWeights: z.record(z.string(), z.number()).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(256).max(32768).optional(),
      customPromptAdditions: z.string().optional(),
      focusModeDefaults: z.string().max(128).optional(),
      // AI Fine-Tuning fields
      thinkingDepth: z.enum(["quick", "standard", "deep", "extended"]).optional(),
      creativity: z.number().min(0).max(2).optional(),
      contextDepth: z.enum(["recent", "moderate", "full"]).optional(),
      disclaimerVerbosity: z.enum(["minimal", "standard", "comprehensive"]).optional(),
      autoFollowUp: z.boolean().optional(),
      autoFollowUpCount: z.number().min(1).max(10).optional(),
      discoveryDirection: z.enum(["deeper", "broader", "applied", "auto"]).optional(),
      discoveryIdleThresholdMs: z.number().min(30000).max(600000).optional(),
      discoveryContinuous: z.boolean().optional(),
      crossModelVerify: z.boolean().optional(),
      citationStyle: z.enum(["none", "inline", "footnotes"]).optional(),
      reasoningTransparency: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      const [existing] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await db.update(userPreferences).set(input).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ userId: ctx.user.id, ...input });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW: Assembled config for a user (admin/manager can preview others)
  // ═══════════════════════════════════════════════════════════════════════════

  previewConfig: protectedProcedure
    .input(z.object({
      targetUserId: z.number().optional(),
      organizationId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const targetId = input.targetUserId ?? ctx.user.id;

      // If previewing another user, require admin
      if (targetId !== ctx.user.id) {
        const admin = await isGlobalAdmin(ctx.user.id);
        if (!admin) {
          // Check if manager/org_admin in same org
          if (input.organizationId) {
            const role = await getOrgRole(ctx.user.id, input.organizationId);
            if (!role || !hasMinOrgRole(role.organizationRole, "manager")) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Manager+ required to preview other users" });
            }
          } else {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
      }

      const config = await resolveAIConfig({
        userId: targetId,
        organizationId: input.organizationId,
      });

      const assembledPrompt = buildLayerOverlayPrompt(config);

      return {
        config,
        assembledPrompt,
      };
    }),

  /** Get available LLM models from the model registry for the UI model selector */
  getAvailableModels: protectedProcedure.query(async () => {
    const { MODEL_REGISTRY, getEnabledModels, getDefaultModelId } = await import("../shared/config/modelRegistry");
    const enabled = getEnabledModels();
    return {
      models: MODEL_REGISTRY.map(m => ({
        id: m.id,
        displayName: m.displayName,
        description: m.description,
        provider: m.provider,
        costTier: m.costTier,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        enabledByDefault: m.enabledByDefault,
        capabilities: m.capabilities,
        bestFor: m.bestFor,
      })),
      enabledModels: enabled.map(m => m.id),
      defaultModel: getDefaultModelId(),
    };
  }),

  /** Validate inheritance rules across all 5 layers */
  validateInheritance: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      // Fetch each layer's raw settings
      const [platformRows] = await db.select().from(platformAISettings).limit(1);
      const platform = platformRows || null;

      let organization = null;
      if (input.organizationId) {
        const [orgRow] = await db.select().from(organizationAISettings).where(eq(organizationAISettings.organizationId, input.organizationId));
        organization = orgRow || null;
      }

      // Find manager/professional settings for the current user
      let manager = null;
      let professional = null;
      if (input.organizationId) {
        const [mgrRow] = await db.select().from(managerAISettings).where(
          and(eq(managerAISettings.managerId, ctx.user.id), eq(managerAISettings.organizationId, input.organizationId))
        );
        manager = mgrRow || null;
        const [proRow] = await db.select().from(professionalAISettings).where(
          and(eq(professionalAISettings.professionalId, ctx.user.id), eq(professionalAISettings.organizationId, input.organizationId))
        );
        professional = proRow || null;
      }

      const [userRow] = await db.select().from(userPreferences).where(eq(userPreferences.userId, ctx.user.id));
      const user = userRow || null;

      const violations = validateInheritance({ platform, organization, manager, professional, user });
      return { violations, layerCount: [platform, organization, manager, professional, user].filter(Boolean).length };
    }),
});
