/**
 * Content Router — Article CMS for SEO pillar pages
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const contentRouter = router({
  list: publicProcedure
    .input(z.object({ category: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { contentArticles } = await import("../../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");
      let query = db.select().from(contentArticles).orderBy(desc(contentArticles.publishedAt)).limit(input?.limit || 20);
      return query;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { contentArticles } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [article] = await db.select().from(contentArticles).where(eq(contentArticles.slug, input.slug)).limit(1);
      if (!article) throw new TRPCError({ code: "NOT_FOUND" });
      return article;
    }),

  create: protectedProcedure
    .input(z.object({ slug: z.string(), title: z.string(), content: z.string(), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { contentArticles } = await import("../../drizzle/schema");
      const [result] = await db.insert(contentArticles).values({
        slug: input.slug,
        title: input.title,
        content: input.content,
        category: (input.category as any) || "general",
      }).$returningId();
      return { id: result.id };
    }),
});
