import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users, authProviderTokens, authEnrichmentLog } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { linkedInAuthService } from "../services/auth/linkedinAuth";
import { googleAuthService } from "../services/auth/googleAuth";
import { emailAuthService } from "../services/auth/emailAuth";
import { profileMerger } from "../services/auth/profileMerger";
import { postSignupEnrichment } from "../services/auth/postSignupEnrichment";

export const authEnrichmentRouter = router({
  /**
   * Get available sign-in methods and their configuration status
   */
  getSignInMethods: publicProcedure.query(async () => {
    const methods = [
      {
        id: "manus",
        name: "Manus OAuth",
        enabled: true,
        configured: true,
        description: "Sign in with your Manus account",
        icon: "shield",
      },
      {
        id: "linkedin",
        name: "LinkedIn",
        enabled: !!process.env.LINKEDIN_CLIENT_ID,
        configured: !!process.env.LINKEDIN_CLIENT_ID && !!process.env.LINKEDIN_CLIENT_SECRET,
        description: "Professional profile, employer, job title, industry",
        icon: "linkedin",
        fieldsProvided: ["name", "email", "photo", "employer", "job_title", "industry", "headline"],
      },
      {
        id: "google",
        name: "Google",
        enabled: !!process.env.GOOGLE_CLIENT_ID,
        configured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
        description: "Personal details, phone, birthday, address, organizations",
        icon: "google",
        fieldsProvided: ["name", "email", "photo", "phone", "birthday", "gender", "address", "organizations"],
      },
      {
        id: "email",
        name: "Email",
        enabled: true,
        configured: true,
        description: "Sign in with magic link, employer inferred from domain",
        icon: "mail",
        fieldsProvided: ["email", "employer_inferred"],
      },
    ];
    return methods;
  }),

  /**
   * Initiate LinkedIn OAuth flow
   */
  initiateLinkedIn: publicProcedure
    .input(z.object({
      redirectUri: z.string().url(),
      state: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!process.env.LINKEDIN_CLIENT_ID) {
        return { error: "LinkedIn sign-in is not configured", authUrl: null };
      }
      const state = input.state || Math.random().toString(36).substring(2);
      const authUrl = linkedInAuthService.getAuthUrl(input.redirectUri, state);
      return { authUrl, state };
    }),

  /**
   * Initiate Google OAuth flow
   */
  initiateGoogle: publicProcedure
    .input(z.object({
      redirectUri: z.string().url(),
      state: z.string().optional(),
      includeSensitiveScopes: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return { error: "Google sign-in is not configured", authUrl: null };
      }
      const state = input.state || Math.random().toString(36).substring(2);
      const authUrl = googleAuthService.getAuthUrl(
        input.redirectUri,
        state,
        input.includeSensitiveScopes
      );
      return { authUrl, state };
    }),

  /**
   * Request email magic link
   */
  requestMagicLink: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const result = await emailAuthService.requestMagicLink(input.email);
      return { sent: result.sent, message: "Check your email for a sign-in link" };
    }),

  /**
   * Link a new auth provider to existing account
   */
  linkProvider: protectedProcedure
    .input(z.object({
      provider: z.enum(["linkedin", "google"]),
      code: z.string(),
      redirectUri: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      if (input.provider === "linkedin") {
        const result = await linkedInAuthService.processSignIn(
          input.code,
          input.redirectUri,
          userId
        );
        // Trigger post-signup enrichment
        await postSignupEnrichment.enrichNewUser(userId);
        return {
          success: true,
          fieldsCaptured: result.fieldsCaptured,
          profile: result.profile,
        };
      }

      if (input.provider === "google") {
        const result = await googleAuthService.processSignIn(
          input.code,
          input.redirectUri,
          userId
        );
        await postSignupEnrichment.enrichNewUser(userId);
        return {
          success: true,
          fieldsCaptured: result.fieldsCaptured,
          profile: result.profile,
        };
      }

      return { success: false, fieldsCaptured: [], profile: null };
    }),

  /**
   * Unlink an auth provider from account
   */
  unlinkProvider: protectedProcedure
    .input(z.object({
      provider: z.enum(["linkedin", "google", "email"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user.id;

      // Remove tokens
      await db
        .delete(authProviderTokens)
        .where(eq(authProviderTokens.userId, userId));

      // Clear provider-specific fields
      const clearFields: Record<string, any> = {};
      if (input.provider === "linkedin") {
        clearFields.linkedinId = null;
        clearFields.linkedinProfileUrl = null;
        clearFields.linkedinHeadline = null;
        clearFields.linkedinIndustry = null;
        clearFields.linkedinLocation = null;
      } else if (input.provider === "google") {
        clearFields.googleId = null;
        clearFields.googlePhone = null;
        clearFields.googleBirthday = null;
        clearFields.googleGender = null;
        clearFields.googleAddressJson = null;
        clearFields.googleOrganizationsJson = null;
      }

      if (Object.keys(clearFields).length > 0) {
        await db.update(users).set(clearFields).where(eq(users.id, userId));
      }

      return { success: true };
    }),

  /**
   * Get connected auth providers for current user
   */
  getConnectedProviders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const tokens = await db
      .select()
      .from(authProviderTokens)
      .where(eq(authProviderTokens.userId, ctx.user.id));

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const user = userRows[0];
    if (!user) return [];

    return [
      {
        provider: "manus",
        connected: true,
        connectedAt: user.createdAt,
      },
      {
        provider: "linkedin",
        connected: !!user.linkedinId,
        connectedAt: tokens.find((t) => t.provider === "linkedin")?.createdAt,
        profileUrl: user.linkedinProfileUrl,
        headline: user.linkedinHeadline,
      },
      {
        provider: "google",
        connected: !!user.googleId,
        connectedAt: tokens.find((t) => t.provider === "google")?.createdAt,
        phone: user.googlePhone,
      },
      {
        provider: "email",
        connected: !!user.email,
        email: user.email,
      },
    ];
  }),

  /**
   * Get enrichment history for current user
   */
  getEnrichmentHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const logs = await db
      .select()
      .from(authEnrichmentLog)
      .where(eq(authEnrichmentLog.userId, ctx.user.id))
      .orderBy(desc(authEnrichmentLog.createdAt))
      .limit(50);

    return logs;
  }),

  /**
   * Get profile completeness and sign-in data
   */
  getProfileCompleteness: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { completeness: 0, fields: {} };

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const user = userRows[0];
    if (!user) return { completeness: 0, fields: {} };

    const signInData = (user.signInDataJson as any) || {};
    const completeness = profileMerger.calculateCompleteness(signInData);

    return {
      completeness,
      fields: {
        name: { value: user.name, source: signInData.name?.source || "manus" },
        email: { value: user.email, source: signInData.email?.source || "manus" },
        phone: { value: user.googlePhone, source: signInData.phone?.source },
        employer: { value: user.employerName, source: signInData.employer?.source },
        jobTitle: { value: user.jobTitle, source: signInData.job_title?.source },
        birthday: { value: user.googleBirthday, source: signInData.birthday?.source },
        gender: { value: user.googleGender, source: signInData.gender?.source },
        address: { value: user.googleAddressJson, source: signInData.address?.source },
        photo: { value: user.avatarUrl, source: signInData.photo?.source },
        linkedinHeadline: { value: user.linkedinHeadline, source: signInData.linkedin_headline?.source },
        linkedinIndustry: { value: user.linkedinIndustry, source: signInData.linkedin_industry?.source },
      },
      authProvider: user.authProvider,
      profileEnrichedAt: user.profileEnrichedAt,
    };
  }),

  /**
   * Force a profile refresh from all connected providers
   */
  forceProfileRefresh: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await postSignupEnrichment.enrichNewUser(ctx.user.id);
    return {
      success: true,
      fieldsEnriched: result.fieldsEnriched,
      completeness: result.completeness,
      sources: result.sources,
    };
  }),
});
