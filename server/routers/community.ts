/**
 * Community Router — Professional forum and discussion
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const communityRouter = router({
  createPost: protectedProcedure
    .input(z.object({ communityType: z.string(), title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { communityPosts } = await import("../../drizzle/schema");
      const [result] = await db.insert(communityPosts).values({
        authorId: ctx.user!.id,
        communityType: input.communityType as any,
        title: input.title,
        content: input.content,
      }).$returningId();
      return { id: result.id };
    }),

  listPosts: protectedProcedure
    .input(z.object({ communityType: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { communityPosts } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt)).limit(input?.limit || 20);
    }),

  reply: protectedProcedure
    .input(z.object({ postId: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { communityReplies } = await import("../../drizzle/schema");
      const [result] = await db.insert(communityReplies).values({
        postId: input.postId,
        authorId: ctx.user!.id,
        content: input.content,
      }).$returningId();
      return { id: result.id };
    }),
});
