/**
 * tts.ts — Edge TTS endpoint for AudioCompanion
 *
 * POST /api/tts — Generate speech audio from text
 * GET /api/tts/voices — List available voices
 *
 * Uses the existing edgeTTS service (generateSpeech + getVoiceCatalog).
 */

import { Router } from "express";
import { generateSpeech, getVoiceCatalog } from "../edgeTTS";

const ttsRouter = Router();

ttsRouter.post("/api/tts", async (req, res) => {
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

ttsRouter.get("/api/tts/voices", async (_req, res) => {
  const catalog = getVoiceCatalog();
  res.json({ voices: catalog });
});

export default ttsRouter;
