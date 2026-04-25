/**
 * tts.ts — Edge TTS endpoint for AudioCompanion
 *
 * POST /api/tts — Generate speech audio from text
 * GET /api/tts/voices — List available voices
 *
 * Uses the existing edgeTTS service (generateSpeech + getVoiceCatalog).
 * All endpoints require authentication (security hardening CBL17).
 */

import { Router } from "express";
import { generateSpeech, getVoiceCatalog } from "../edgeTTS";
import { logger } from "../_core/logger";

const ttsRouter = Router();

/** Per-user rate limit: max 60 TTS requests per minute (increased for audio study sessions) */
const ttsRateLimits = new Map<number, { count: number; resetAt: number }>();
const TTS_RATE_LIMIT = 60;
const TTS_RATE_WINDOW_MS = 60_000;

function checkTtsRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = ttsRateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    ttsRateLimits.set(userId, { count: 1, resetAt: now + TTS_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= TTS_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

ttsRouter.post("/api/tts", async (req, res) => {
  // Auth is enforced by the middleware in index.ts that sets req.__user
  const user = (req as any).__user;
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!checkTtsRateLimit(user.id)) { res.status(429).json({ error: "TTS rate limit exceeded (60/min)" }); return; }
  try {
    const { text, voice = "guy", speed = 1.0, pitch = "default" } = req.body;
    if (!text || text.length === 0) return res.status(400).json({ error: "Text is required" });
    if (text.length > 5000) return res.status(400).json({ error: "Text exceeds 5000 character limit" });

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const pitchString = pitch === "low" ? "-2Hz" : pitch === "high" ? "+2Hz" : "+0Hz";

    const audioBuffer = await generateSpeech(text, voice, rateString, pitchString);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(audioBuffer);
  } catch (error: any) {
    // @ts-expect-error — overload resolution mismatch
    logger.error("[TTS] Error", { error: error.message });
    res.status(500).json({ error: "TTS generation failed" });
  }
});

ttsRouter.get("/api/tts/voices", async (req, res) => {
  const user = (req as any).__user;
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const catalog = getVoiceCatalog();
  res.json({ voices: catalog });
});

/**
 * POST /api/tts/batch — Batch synthesize multiple text items
 * Body: { items: Array<{ id: string; text: string }>, voice?: string, speed?: number, pitch?: string }
 * Returns: JSON array of { id, success, audioBase64?, error? }
 * Max 10 items per batch, 2000 chars each.
 */
ttsRouter.post("/api/tts/batch", async (req, res) => {
  const user = (req as any).__user;
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const { items, voice = "guy", speed = 1.0, pitch = "default" } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }
    if (items.length > 10) {
      return res.status(400).json({ error: "Max 10 items per batch" });
    }

    // Check rate limit for entire batch
    for (let i = 0; i < items.length; i++) {
      if (!checkTtsRateLimit(user.id)) {
        return res.status(429).json({ error: `TTS rate limit exceeded at item ${i + 1}` });
      }
    }

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const pitchString = pitch === "low" ? "-2Hz" : pitch === "high" ? "+2Hz" : "+0Hz";

    const results = await Promise.allSettled(
      items.map(async (item: { id: string; text: string }) => {
        if (!item.text || item.text.length > 2000) {
          throw new Error("Text missing or exceeds 2000 char limit");
        }
        const audioBuffer = await generateSpeech(item.text, voice, rateString, pitchString);
        return {
          id: item.id,
          success: true,
          audioBase64: audioBuffer.toString("base64"),
        };
      }),
    );

    const response = results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { id: items[i]?.id ?? String(i), success: false, error: (r.reason as Error).message },
    );

    res.json({ results: response });
  } catch (error: any) {
    // @ts-expect-error — overload resolution mismatch
    logger.error("[TTS] Batch error", { error: error.message });
    res.status(500).json({ error: "Batch TTS generation failed" });
  }
});

export default ttsRouter;
