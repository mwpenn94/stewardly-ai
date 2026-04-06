/**
 * Rich Media Service — Embed multimedia content in chat responses
 * Supports: video (YouTube), audio (podcasts), images, documents, shopping, charts
 * Bookmarks video/audio to the exact timestamp relevant to the user's query
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "richMedia" });

export type MediaType = "video" | "audio" | "image" | "document" | "shopping" | "chart" | "link_preview";

export interface MediaEmbed {
  type: MediaType;
  source: string;
  title: string;
  thumbnailUrl?: string;
  startTime?: number; // seconds — personalized bookmark
  endTime?: number;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
}

/** Extract media references from AI response and web search results */
export function extractMediaFromResponse(content: string): MediaEmbed[] {
  const embeds: MediaEmbed[] = [];

  // YouTube links → video embeds with timestamp
  const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(?:.*?[&?]t=(\d+))?/g;
  let match;
  while ((match = ytRegex.exec(content)) !== null) {
    embeds.push({
      type: "video",
      source: `https://www.youtube.com/embed/${match[1]}${match[2] ? `?start=${match[2]}` : ""}`,
      title: "Video",
      startTime: match[2] ? parseInt(match[2]) : undefined,
      metadata: { provider: "youtube", videoId: match[1] },
    });
  }

  // Image URLs
  const imgRegex = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/gi;
  while ((match = imgRegex.exec(content)) !== null) {
    embeds.push({
      type: "image",
      source: match[0],
      title: "Image",
      metadata: { provider: "direct" },
    });
  }

  // PDF/document links
  const docRegex = /https?:\/\/\S+\.(?:pdf|docx?|xlsx?)(?:\?\S*)?/gi;
  while ((match = docRegex.exec(content)) !== null) {
    embeds.push({
      type: "document",
      source: match[0],
      title: "Document",
      metadata: { provider: "direct" },
    });
  }

  return embeds;
}

/** Store media embeds for a message */
export async function storeMediaEmbeds(messageId: number, embeds: MediaEmbed[]): Promise<void> {
  if (embeds.length === 0) return;
  const db = await getDb();
  if (!db) return;

  try {
    const { richMediaEmbeds } = await import("../../drizzle/schema");
    for (const embed of embeds.slice(0, 5)) { // Max 5 per message
      await db.insert(richMediaEmbeds).values({
        messageId,
        mediaType: embed.type,
        source: embed.source,
        title: embed.title,
        thumbnailUrl: embed.thumbnailUrl,
        startTime: embed.startTime,
        endTime: embed.endTime,
        metadata: embed.metadata as any,
        relevanceScore: embed.relevanceScore ? String(embed.relevanceScore) : undefined,
      });
    }
  } catch (e: any) {
    log.warn({ messageId, error: e.message }, "Failed to store media embeds");
  }
}

/** Get media embeds for a message */
export async function getMediaEmbeds(messageId: number): Promise<MediaEmbed[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { richMediaEmbeds } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(richMediaEmbeds).where(eq(richMediaEmbeds.messageId, messageId));
    return rows.map(r => ({
      type: r.mediaType as MediaType,
      source: r.source,
      title: r.title || "",
      thumbnailUrl: r.thumbnailUrl || undefined,
      startTime: r.startTime || undefined,
      endTime: r.endTime || undefined,
      metadata: r.metadata as any,
      relevanceScore: r.relevanceScore ? Number(r.relevanceScore) : undefined,
    }));
  } catch {
    return [];
  }
}
