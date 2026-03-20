/**
 * Multi-Modal Processing Router
 * Endpoints for OCR, document extraction, video transcription, unified search, annotations
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  visualOCR,
  documentProcessor,
  videoTranscript,
  unifiedSearch,
  annotationService,
} from "../services/multiModal";

export const multiModalProcessingRouter = router({
  // ─── Visual OCR ──────────────────────────────────────────────────
  ocrExtract: protectedProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return visualOCR.extractText(input.imageUrl);
    }),

  explainVisual: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
      query: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return { explanation: await visualOCR.explainVisual(input.imageUrl, input.query) };
    }),

  // ─── Document Processing ─────────────────────────────────────────
  extractTables: protectedProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      return documentProcessor.extractTables(input.fileUrl, input.mimeType);
    }),

  parseForm: protectedProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      return documentProcessor.parseForm(input.fileUrl, input.mimeType);
    }),

  extractKeyInfo: protectedProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      return documentProcessor.extractKeyInfo(input.fileUrl, input.mimeType);
    }),

  // ─── Video Transcript ────────────────────────────────────────────
  transcribeAndIndex: protectedProcedure
    .input(z.object({
      audioUrl: z.string().url(),
      title: z.string().default("Recording"),
    }))
    .mutation(async ({ ctx, input }) => {
      return videoTranscript.transcribeAndIndex(ctx.user.id, input.audioUrl, input.title);
    }),

  // ─── Unified Search ──────────────────────────────────────────────
  unifiedSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      types: z.array(z.string()).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      return unifiedSearch.search(ctx.user.id, input.query, {
        types: input.types,
        limit: input.limit,
      });
    }),

  // ─── Annotations ─────────────────────────────────────────────────
  createAnnotation: protectedProcedure
    .input(z.object({
      documentId: z.number().optional(),
      imageUrl: z.string().optional(),
      annotationType: z.enum(["highlight", "circle", "arrow", "text", "rectangle"]),
      coordinates: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      color: z.string().default("#FFD700"),
      note: z.string().optional(),
      pageNumber: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return annotationService.createAnnotation(ctx.user.id, input);
    }),

  getAnnotations: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return annotationService.getAnnotations(input.documentId);
    }),
});
