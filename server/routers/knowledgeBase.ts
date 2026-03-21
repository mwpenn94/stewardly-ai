/**
 * Knowledge Base Router — C5/C8/C9/C10
 * Full CRUD, search, freshness, feedback, gap detection, ingestion pipeline
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as kb from "../services/knowledgeBase";
import * as ingestion from "../services/knowledgeIngestion";

export const knowledgeBaseRouter = router({
  // ─── Search & List ─────────────────────────────────────────────────
  search: publicProcedure
    .input(z.object({
      query: z.string(),
      category: z.string().optional(),
      contentType: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input }) => kb.searchArticles(input.query, input)),

  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => kb.listArticles(input ?? undefined)),

  categories: publicProcedure
    .query(async () => kb.getCategories()),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => kb.getArticle(input.id)),

  // ─── CRUD (Protected) ─────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      category: z.string(),
      subcategory: z.string().optional(),
      title: z.string(),
      content: z.string(),
      contentType: z.enum(["process", "concept", "reference", "template", "faq", "policy", "guide"]).optional(),
      metadata: z.any().optional(),
      source: z.enum(["manual", "ingested", "ai_generated", "conversation_mining"]).optional(),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => kb.createArticle({ ...input, createdBy: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      contentType: z.string().optional(),
      metadata: z.any().optional(),
      active: z.boolean().optional(),
      changeReason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, changeReason, ...data } = input;
      return kb.updateArticle(id, data, ctx.user.id, changeReason);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => kb.deleteArticle(input.id)),

  // ─── Feedback ──────────────────────────────────────────────────────
  submitFeedback: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      helpful: z.boolean(),
      feedbackText: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) =>
      kb.submitFeedback(input.articleId, ctx.user.id, input.helpful, input.feedbackText, input.context)),

  // ─── Freshness ─────────────────────────────────────────────────────
  recalculateFreshness: protectedProcedure
    .mutation(async () => kb.recalculateFreshness()),

  // ─── Gap Detection ─────────────────────────────────────────────────
  detectGaps: protectedProcedure
    .input(z.object({ queries: z.array(z.string()) }))
    .mutation(async ({ input }) => kb.detectGaps(input.queries)),

  listGaps: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => kb.listGaps(input?.status)),

  // ─── Context Injection ─────────────────────────────────────────────
  getRelevantContext: publicProcedure
    .input(z.object({
      query: z.string(),
      categories: z.array(z.string()).optional(),
      limit: z.number().min(1).max(20).optional(),
    }))
    .query(async ({ input }) => kb.getRelevantArticlesForContext(input.query, input.categories, input.limit)),

  // ─── Ingestion Pipeline ────────────────────────────────────────────
  ingestDocument: protectedProcedure
    .input(z.object({ content: z.string(), filename: z.string() }))
    .mutation(async ({ input }) => {
      const job = await ingestion.createIngestionJob({ sourceType: "document", sourceFilename: input.filename });
      return ingestion.ingestDocument(job.id, input.content, input.filename);
    }),

  mineConversation: protectedProcedure
    .input(z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) }))
    .mutation(async ({ input }) => {
      const job = await ingestion.createIngestionJob({ sourceType: "conversation" });
      return ingestion.mineConversation(job.id, input.messages);
    }),

  seedFromTemplate: protectedProcedure
    .input(z.object({
      articles: z.array(z.object({
        category: z.string(),
        subcategory: z.string().optional(),
        title: z.string(),
        content: z.string(),
        contentType: z.enum(["process", "concept", "reference", "template", "faq", "policy", "guide"]),
      })),
    }))
    .mutation(async ({ input }) => ingestion.seedFromTemplate(input.articles)),

  ingestionJobs: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ input }) => ingestion.listJobs(input?.limit)),

  ingestionStats: protectedProcedure
    .query(async () => ingestion.getIngestionStats()),
});
