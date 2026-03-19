import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { hashPassword, verifyPassword, validatePasswordStrength, validateEmail } from "../_core/password";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { nanoid } from "nanoid";

/**
 * Email/Password Authentication Router
 * Provides non-Google account CRUD operations
 */
export const emailAuthRouter = router({
  /**
   * Sign up with email and password
   * Creates a new user account and sets session cookie
   */
  signUp: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1, "Name is required").max(256),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate email
      if (!validateEmail(input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid email address" });
      }

      // Validate password strength
      const passwordCheck = validatePasswordStrength(input.password);
      if (!passwordCheck.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: passwordCheck.errors.join(". ") });
      }

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check if email already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Please sign in instead." });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Generate a unique openId for email-based users
      const openId = `email_${nanoid(24)}`;

      // Create user
      await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "email",
        passwordHash,
        role: "user",
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.signSession(
        { openId, appId: process.env.VITE_APP_ID || "", name: input.name },
        { expiresInMs: ONE_YEAR_MS }
      );

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, message: "Account created successfully" };
    }),

  /**
   * Sign in with email and password
   * Verifies credentials and sets session cookie
   */
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Find user by email
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      const user = result[0];

      // Check if user has a password (might be Google-only account)
      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account uses Google sign-in. Please sign in with Google instead.",
        });
      }

      // Verify password
      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      // Update last signed in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Create session token
      const sessionToken = await sdk.signSession(
        { openId: user.openId, appId: process.env.VITE_APP_ID || "", name: user.name || "" },
        { expiresInMs: ONE_YEAR_MS }
      );

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, message: "Signed in successfully" };
    }),

  /**
   * Update password (for authenticated users)
   */
  updatePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const passwordCheck = validatePasswordStrength(input.newPassword);
      if (!passwordCheck.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: passwordCheck.errors.join(". ") });
      }

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // If user has existing password, verify current password
      if (ctx.user.passwordHash && input.currentPassword) {
        const isValid = await verifyPassword(input.currentPassword, ctx.user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
      } else if (ctx.user.passwordHash && !input.currentPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is required" });
      }

      const newHash = await hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, ctx.user.id));

      return { success: true, message: "Password updated successfully" };
    }),

  /**
   * Update user profile (name, email)
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updateData: Record<string, any> = {};
      if (input.name) updateData.name = input.name;
      if (input.email) {
        if (!validateEmail(input.email)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid email address" });
        }
        // Check if email is taken by another user
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        if (existing.length > 0 && existing[0].id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already in use by another account" });
        }
        updateData.email = input.email;
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));
      }

      return { success: true };
    }),

  /**
   * Delete user account
   * Permanently removes the user and all associated data
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmPassword: z.string().optional(),
        confirmText: z.string().refine((val) => val === "DELETE", {
          message: "Please type DELETE to confirm",
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // If user has password, verify it
      if (ctx.user.passwordHash && input.confirmPassword) {
        const isValid = await verifyPassword(input.confirmPassword, ctx.user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Password is incorrect" });
        }
      }

      // Delete user (cascading deletes should handle related data)
      await db.delete(users).where(eq(users.id, ctx.user.id));

      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);

      return { success: true, message: "Account deleted successfully" };
    }),
});
