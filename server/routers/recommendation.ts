/**
 * Recommendation & Matching Router
 * Best-fit matching, invitations, org recommendations
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { matchingService, invitationService } from "../services/recommendation";
import { seedOrganizations, detectColorSchemeFromLogo } from "../services/orgSeedData";

export const recommendationRouter = router({
  // Best-fit professional matching
  findBestFitProfessionals: protectedProcedure
    .input(z.object({
      specialties: z.array(z.string()).optional(),
      location: z.string().optional(),
      maxResults: z.number().default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
      return matchingService.findBestFitProfessionals(ctx.user.id, {
        specialties: input?.specialties,
        location: input?.location,
        maxResults: input?.maxResults,
      });
    }),

  // Best-fit org matching
  findBestFitOrgs: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      relationshipType: z.string().optional(),
      industry: z.string().optional(),
      maxResults: z.number().default(10),
    }))
    .query(async ({ input }) => {
      return matchingService.findBestFitOrgs(input.orgId, {
        relationshipType: input.relationshipType,
        industry: input.industry,
        maxResults: input.maxResults,
      });
    }),

  // Org-level AI recommendations
  generateOrgRecommendations: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .mutation(async ({ input }) => {
      return matchingService.generateOrgRecommendations(input.orgId);
    }),

  // On-platform invitation
  sendInvitation: protectedProcedure
    .input(z.object({
      toUserId: z.number(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return invitationService.sendInvitation(ctx.user.id, input.toUserId, input.message);
    }),

  // Off-platform email invitation
  sendEmailInvitation: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      orgId: z.number().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return invitationService.sendEmailInvitation(ctx.user.id, input.email, input.orgId, input.message);
    }),

  // Respond to invitation
  respondToInvitation: protectedProcedure
    .input(z.object({
      invitationId: z.number(),
      accept: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return invitationService.respondToInvitation(ctx.user.id, input.invitationId, input.accept);
    }),

  // Seed organizations
  seedOrganizations: protectedProcedure
    .input(z.object({ ownerOpenId: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      return seedOrganizations(input?.ownerOpenId);
    }),

  // Detect color scheme from logo
  detectColorScheme: protectedProcedure
    .input(z.object({ logoUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return detectColorSchemeFromLogo(input.logoUrl);
    }),

});
