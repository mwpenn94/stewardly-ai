import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createContentShare,
  getContentShares,
  revokeContentShare,
  checkContentAccess,
  resolveAllFeaturePermissions,
  resolveFeaturePermission,
  setFeaturePermission,
  FEATURE_REGISTRY,
  trackContentView,
  getShareViewCount,
  getAuditLog,
} from "../services/featurePermissions";

export const sharingRouter = router({
  // ─── Content Sharing ──────────────────────────────────────────────────
  shareContent: protectedProcedure
    .input(z.object({
      contentType: z.string(),
      contentId: z.string(),
      sharedWithUserId: z.number().optional(),
      sharedWithOrgId: z.number().optional(),
      sharedWithRole: z.enum(["user", "advisor", "manager", "admin"]).optional(),
      permissionLevel: z.enum(["view", "comment", "edit", "admin"]).default("view"),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createContentShare({
        contentType: input.contentType,
        contentId: input.contentId,
        ownerId: ctx.user.id,
        sharedWithUserId: input.sharedWithUserId,
        sharedWithOrgId: input.sharedWithOrgId,
        sharedWithRole: input.sharedWithRole,
        permissionLevel: input.permissionLevel,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      });
    }),

  getShares: protectedProcedure
    .input(z.object({
      contentType: z.string(),
      contentId: z.string(),
    }))
    .query(async ({ input }) => {
      return getContentShares(input.contentType, input.contentId);
    }),

  revokeShare: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return revokeContentShare(input.shareId, ctx.user.id);
    }),

  checkAccess: protectedProcedure
    .input(z.object({
      contentType: z.string(),
      contentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return checkContentAccess(
        input.contentType,
        input.contentId,
        ctx.user.id,
        ctx.user.role ?? undefined
      );
    }),

  // ─── Feature Permissions ──────────────────────────────────────────────
  getMyPermissions: protectedProcedure
    .query(async ({ ctx }) => {
      return resolveAllFeaturePermissions(ctx.user.id, undefined, ctx.user.role ?? undefined);
    }),

  getFeaturePermission: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      return resolveFeaturePermission(ctx.user.id, input.featureId, undefined, ctx.user.role ?? undefined);
    }),

  setFeaturePermission: protectedProcedure
    .input(z.object({
      targetUserId: z.number().optional(),
      targetOrgId: z.number().optional(),
      roleScope: z.string().optional(),
      featureId: z.string(),
      enabled: z.boolean(),
      disclosureCeiling: z.number().min(1).max(4).optional(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only admins can set permissions for others
      if (input.targetUserId && input.targetUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Only admins can modify other users' permissions");
      }
      return setFeaturePermission({
        actorId: ctx.user.id,
        ...input,
      });
    }),

  getFeatureRegistry: protectedProcedure
    .query(() => {
      return FEATURE_REGISTRY;
    }),

  trackView: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return trackContentView({ shareId: input.shareId, viewerId: ctx.user.id });
    }),

  getViewCount: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .query(async ({ input }) => {
      return { count: await getShareViewCount(input.shareId) };
    }),

  getAuditLog: protectedProcedure
    .input(z.object({
      actorId: z.number().optional(),
      targetUserId: z.number().optional(),
      featureId: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && !input.actorId) {
        return getAuditLog({ ...input, actorId: ctx.user.id });
      }
      return getAuditLog(input);
    }),
});
