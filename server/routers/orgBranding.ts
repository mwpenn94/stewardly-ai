import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  organizationLandingPageConfig,
  organizationAISettings,
  userOrganizationRoles,
} from "../../drizzle/schema";

/**
 * Organization Branding Router
 * Manages landing page config, AI settings, and color schemes per org.
 */
export const orgBrandingRouter = router({
  // ─── LANDING PAGE CONFIG ─────────────────────────────────────────────

  /** Get landing page config for an org (public — for landing pages) */
  getLandingConfig: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const config = await db
        .select()
        .from(organizationLandingPageConfig)
        .where(eq(organizationLandingPageConfig.organizationId, input.organizationId))
        .limit(1);

      return config[0] || null;
    }),

  /** Update landing page config (org_admin only) */
  updateLandingConfig: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        headline: z.string().max(512).optional(),
        subtitle: z.string().max(2000).optional(),
        ctaText: z.string().max(128).optional(),
        secondaryLinkText: z.string().max(128).optional(),
        logoUrl: z.string().optional(),
        primaryColor: z.string().max(7).optional(),
        accentColor: z.string().max(7).optional(),
        backgroundOption: z.string().max(64).optional(),
        trustSignal1: z.string().optional(),
        trustSignal2: z.string().optional(),
        trustSignal3: z.string().optional(),
        disclaimerText: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin role
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.organizationId),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins can update branding" });
      }

      const { organizationId, ...updateData } = input;

      // Check if config exists
      const existing = await db
        .select()
        .from(organizationLandingPageConfig)
        .where(eq(organizationLandingPageConfig.organizationId, organizationId))
        .limit(1);

      if (existing.length) {
        await db
          .update(organizationLandingPageConfig)
          .set(updateData)
          .where(eq(organizationLandingPageConfig.organizationId, organizationId));
      } else {
        await db.insert(organizationLandingPageConfig).values({
          organizationId,
          ...updateData,
        });
      }

      return { success: true };
    }),

  // ─── AI SETTINGS ─────────────────────────────────────────────────────

  /** Get AI settings for an org */
  getAISettings: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify membership
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const settings = await db
        .select()
        .from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, input.organizationId))
        .limit(1);

      return settings[0] || null;
    }),

  /** Update AI settings (org_admin only) */
  updateAISettings: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        organizationName: z.string().max(256).optional(),
        brandVoice: z.string().optional(),
        approvedProductCategories: z.array(z.string()).optional(),
        prohibitedTopics: z.array(z.string()).optional(),
        complianceLanguage: z.string().optional(),
        customDisclaimers: z.string().optional(),
        promptOverlay: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin role
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.organizationId),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins can update AI settings" });
      }

      const { organizationId, ...updateData } = input;

      const existing = await db
        .select()
        .from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, organizationId))
        .limit(1);

      if (existing.length) {
        await db
          .update(organizationAISettings)
          .set(updateData)
          .where(eq(organizationAISettings.organizationId, organizationId));
      } else {
        await db.insert(organizationAISettings).values({
          organizationId,
          organizationName: updateData.organizationName || "Organization",
          ...updateData,
        });
      }

      return { success: true };
    }),
});
