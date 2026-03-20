import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createFileUpload,
  uploadFileToStorage,
  processFilePipeline,
  getUserFiles,
  getFileChunks,
  getFileEnrichments,
} from "../services/fileProcessor";

export const fileProcessingRouter = router({
  // List user's files
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return getUserFiles(ctx.user.id, input?.limit ?? 50);
    }),

  // Create a file upload record (before uploading bytes)
  create: protectedProcedure
    .input(z.object({
      filename: z.string(),
      mimeType: z.string().optional(),
      sizeBytes: z.number().optional(),
      category: z.enum([
        "personal_docs", "financial_products", "regulations", "training",
        "artifacts", "skills", "carrier_report", "client_data", "compliance",
      ]).optional().default("personal_docs"),
      visibility: z.enum(["private", "professional", "management", "admin"]).optional().default("private"),
      connectionId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createFileUpload({
        userId: ctx.user.id,
        ...input,
      });
      return { id };
    }),

  // Process a file through the full pipeline
  process: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ input }) => {
      return processFilePipeline(input.fileId);
    }),

  // Get chunks for a file
  getChunks: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      return getFileChunks(input.fileId);
    }),

  // Get enrichments for a file
  getEnrichments: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      return getFileEnrichments(input.fileId);
    }),
});
