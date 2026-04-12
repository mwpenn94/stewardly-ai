/**
 * tts.ts — Edge TTS endpoint for AudioCompanion
 *
 * POST /api/tts — Generate speech audio from text
 * GET /api/tts/voices — List available voices
 *
 * Uses the existing edgeTTS service (generateSpeech + getVoiceCatalog).
 * All endpoints require authentication (security hardening CBL17).
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { generateSpeech, getVoiceCatalog } from "../edgeTTS";

const ttsRouter = Router();

/** Per-user rate limit: max 30 TTS requests per minute */
const ttsRateLimits = new Map<number, { count: number; resetAt: number }>();
const TTS_RATE_LIMIT = 30;
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
  if (!checkTtsRateLimit(user.id)) { res.status(429).json({ error: "TTS rate limit exceeded (30/min)" }); return; }
  try {
    // Auth check — injected by the mount-point middleware in _core/index.ts
    if (!(req as any).__user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { text, voice = "en-US-GuyNeural", speed = 1.0, pitch = "default" } = req.body;
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
    console.error("[TTS] Error:", error.message);
    res.status(500).json({ error: "TTS generation failed" });
  }
});

ttsRouter.get("/api/tts/voices", async (req, res) => {
  const user = (req as any).__user;
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const catalog = getVoiceCatalog();
  res.json({ voices: catalog });
});

export default ttsRouter;
