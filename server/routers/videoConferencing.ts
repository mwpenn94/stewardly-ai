/**
 * Video Conferencing Router
 *
 * Wires Daily.co video rooms and Deepgram real-time transcription
 * into the WealthBridge AI meetings system.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as dailyService from "../services/dailyService";
import * as deepgramService from "../services/deepgramService";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Video Room Management (Daily.co) ──────────────────────────────
const videoRoomRouter = router({
  /** Create a new video room for a meeting */
  createRoom: protectedProcedure
    .input(z.object({
      meetingId: z.number().optional(),
      name: z.string().max(100).optional(),
      maxParticipants: z.number().min(2).max(100).default(10),
      enableRecording: z.boolean().default(false),
      expiryMinutes: z.number().min(15).max(1440).default(120),
      isPrivate: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const roomName = input.name ?? `wb-${ctx.user!.id}-${Date.now()}`;
      const result = await dailyService.createRoom({
        name: roomName,
        maxParticipants: input.maxParticipants,
        enableRecording: input.enableRecording,
        expiryMinutes: input.expiryMinutes,
        isPrivate: input.isPrivate,
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return { ...result, meetingId: input.meetingId };
    }),

  /** Get a meeting token for joining a room */
  getToken: protectedProcedure
    .input(z.object({
      roomName: z.string(),
      isOwner: z.boolean().default(false),
      expiryMinutes: z.number().min(15).max(1440).default(120),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await dailyService.createMeetingToken({
        roomName: input.roomName,
        userName: ctx.user!.name ?? "Participant",
        userId: String(ctx.user!.id),
        isOwner: input.isOwner,
        expiryMinutes: input.expiryMinutes,
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return result;
    }),

  /** Get room details */
  getRoom: protectedProcedure
    .input(z.object({ roomName: z.string() }))
    .query(async ({ input }) => {
      const result = await dailyService.getRoom(input.roomName);
      if ("error" in result) {
        throw new TRPCError({ code: "NOT_FOUND", message: result.error });
      }
      return result;
    }),

  /** List active rooms */
  listRooms: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ input }) => {
      const result = await dailyService.listRooms(input?.limit ?? 50);
      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }
      return result;
    }),

  /** Delete a room */
  deleteRoom: protectedProcedure
    .input(z.object({ roomName: z.string() }))
    .mutation(async ({ input }) => {
      const result = await dailyService.deleteRoom(input.roomName);
      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }
      return result;
    }),

  /** Get recordings for a room */
  getRecordings: protectedProcedure
    .input(z.object({ roomName: z.string() }))
    .query(async ({ input }) => {
      const result = await dailyService.getRoomRecordings(input.roomName);
      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }
      return result;
    }),
});

// ─── Transcription (Deepgram) ──────────────────────────────────────
const transcriptionRouter = router({
  /** Transcribe a pre-recorded audio file */
  transcribe: protectedProcedure
    .input(z.object({
      audioUrl: z.string().url(),
      language: z.string().default("en"),
      model: z.string().default("nova-2"),
      diarize: z.boolean().default(true),
      keywords: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await deepgramService.transcribeWithDeepgram(input.audioUrl, {
        language: input.language,
        model: input.model,
        diarize: input.diarize,
        keywords: input.keywords,
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return result;
    }),

  /** Get a temporary streaming token for real-time transcription in the browser */
  getStreamingToken: protectedProcedure
    .input(z.object({
      expiryMinutes: z.number().min(5).max(60).default(10),
    }).optional())
    .mutation(async ({ input }) => {
      const result = await deepgramService.getDeepgramStreamingToken(
        (input?.expiryMinutes ?? 10) * 60,
      );

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return {
        token: result.token,
        wsUrl: deepgramService.getDeepgramWebSocketUrl(),
      };
    }),

  /** Get the WebSocket URL for streaming (no token needed for public rooms) */
  getStreamingConfig: protectedProcedure
    .input(z.object({
      language: z.string().default("en"),
      model: z.string().default("nova-2"),
      diarize: z.boolean().default(true),
    }).optional())
    .query(({ input }) => {
      return {
        wsUrl: deepgramService.getDeepgramWebSocketUrl({
          language: input?.language,
          model: input?.model,
          diarize: input?.diarize,
        }),
      };
    }),
});

// ─── Combined Router ───────────────────────────────────────────────
export const videoConferencingRouter = router({
  rooms: videoRoomRouter,
  transcription: transcriptionRouter,
});
