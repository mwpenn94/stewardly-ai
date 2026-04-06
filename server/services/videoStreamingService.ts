/**
 * Video Streaming Service — AI remains responsive during video/screen share
 * Adapted from Grok pattern: AI returns audio + text while in streaming mode
 *
 * Chat UI adapts:
 *   - Video fills main area, chat becomes overlay sidebar
 *   - AI responses appear as text overlay + optional TTS
 *   - User can type or speak while video streams
 *   - AI generates real-time transcript of video content
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "videoStreaming" });

export type StreamType = "screen_share" | "camera" | "co_browse";

export interface StreamSession {
  id: number;
  userId: number;
  conversationId?: number;
  streamType: StreamType;
  status: "connecting" | "active" | "paused" | "ended";
  startedAt: Date;
  aiResponseCount: number;
}

/** Start a video streaming session */
export async function startStream(userId: number, streamType: StreamType, conversationId?: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { videoStreamingSessions } = await import("../../drizzle/schema");
    const [result] = await db.insert(videoStreamingSessions).values({
      userId,
      conversationId,
      streamType,
      status: "active",
    }).$returningId();
    log.info({ userId, streamType, sessionId: result.id }, "Video stream started");
    return result.id;
  } catch (e: any) {
    log.error({ userId, error: e.message }, "Failed to start stream");
    return null;
  }
}

/** End a streaming session with optional transcript */
export async function endStream(sessionId: number, transcript?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { videoStreamingSessions } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(videoStreamingSessions)
      .set({ status: "ended", endedAt: new Date(), transcriptText: transcript })
      .where(eq(videoStreamingSessions.id, sessionId));
  } catch { /* graceful */ }
}

/** Record AI response during stream (for analytics) */
export async function recordStreamResponse(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { videoStreamingSessions } = await import("../../drizzle/schema");
    const { eq, sql } = await import("drizzle-orm");
    await db.update(videoStreamingSessions)
      .set({ aiResponsesDuringStream: sql`${videoStreamingSessions.aiResponsesDuringStream} + 1` })
      .where(eq(videoStreamingSessions.id, sessionId));
  } catch { /* non-critical */ }
}

/** Get chat UI layout config for streaming mode */
export function getStreamingLayoutConfig(streamType: StreamType): {
  chatPosition: "overlay-right" | "overlay-bottom" | "sidebar";
  chatWidth: string;
  videoFill: boolean;
  showTTS: boolean;
  showTranscript: boolean;
} {
  switch (streamType) {
    case "screen_share":
      return { chatPosition: "overlay-right", chatWidth: "320px", videoFill: true, showTTS: true, showTranscript: true };
    case "camera":
      return { chatPosition: "overlay-bottom", chatWidth: "100%", videoFill: false, showTTS: true, showTranscript: false };
    case "co_browse":
      return { chatPosition: "sidebar", chatWidth: "400px", videoFill: true, showTTS: false, showTranscript: true };
  }
}
