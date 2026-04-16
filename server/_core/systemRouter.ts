import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

const clientErrorSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  source: z.enum(["unhandled", "promise", "trpc", "manual"]),
  url: z.string(),
  timestamp: z.number(),
  userAgent: z.string(),
  fingerprint: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// In-memory error buffer for admin dashboard (last 200 errors)
const errorBuffer: Array<z.infer<typeof clientErrorSchema> & { receivedAt: number }> = [];
const MAX_BUFFER = 200;

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * logClientErrors — Receives batched client-side errors for monitoring.
   * Public procedure so errors from unauthenticated users are also captured.
   */
  logClientErrors: publicProcedure
    .input(z.object({
      errors: z.array(clientErrorSchema).max(50),
    }))
    .mutation(({ input }) => {
      const now = Date.now();
      for (const err of input.errors) {
        errorBuffer.push({ ...err, receivedAt: now });
        // Log to server console for debugging
        console.log(`[ClientError] ${err.source} | ${err.message} | ${err.url}`);
      }
      // Trim buffer
      while (errorBuffer.length > MAX_BUFFER) {
        errorBuffer.shift();
      }
      return { received: input.errors.length };
    }),

  /**
   * getClientErrors — Admin-only endpoint to view recent client errors.
   */
  getClientErrors: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      source: z.enum(["unhandled", "promise", "trpc", "manual", "all"]).default("all"),
    }))
    .query(({ input }) => {
      let filtered = [...errorBuffer];
      if (input.source !== "all") {
        filtered = filtered.filter(e => e.source === input.source);
      }
      return filtered.slice(-input.limit).reverse();
    }),
});
