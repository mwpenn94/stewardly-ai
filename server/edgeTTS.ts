import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Edge TTS service — server-side text-to-speech using Microsoft Edge's
 * Read Aloud API. Returns audio as a Buffer in webm/opus format that
 * browsers can play natively via <audio> or AudioContext.
 *
 * No API key required. Free, high-quality neural voices.
 */

// Available voice presets (all neural, high quality)
export const VOICES = {
  // Female voices
  "aria": "en-US-AriaNeural",
  "jenny": "en-US-JennyNeural",
  "sara": "en-US-SaraNeural",
  "emma": "en-US-EmmaNeural",
  // Male voices
  "guy": "en-US-GuyNeural",
  "davis": "en-US-DavisNeural",
  "jason": "en-US-JasonNeural",
  "tony": "en-US-TonyNeural",
  // British
  "sonia": "en-GB-SoniaNeural",
  "ryan": "en-GB-RyanNeural",
} as const;

export type VoiceId = keyof typeof VOICES;

// Singleton TTS instance — reused across requests
let ttsInstance: MsEdgeTTS | null = null;
let currentVoice: string | null = null;

/**
 * Clean text for speech — remove markdown, code blocks, URLs, etc.
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block omitted ")
    .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ""))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_~\[\]()>|]/g, "")
    .replace(/---[\s\S]*$/m, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Initialize or reinitialize the TTS engine with a specific voice.
 */
async function ensureTTS(voiceName: string): Promise<MsEdgeTTS> {
  if (ttsInstance && currentVoice === voiceName) {
    return ttsInstance;
  }

  ttsInstance = new MsEdgeTTS();
  await ttsInstance.setMetadata(
    voiceName,
    OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS
  );
  currentVoice = voiceName;
  return ttsInstance;
}

/**
 * Generate speech audio from text.
 *
 * @param text - The text to speak (markdown will be cleaned)
 * @param voice - Voice preset key (default: "aria")
 * @param rate - Speech rate string (e.g., "+0%", "-10%", "+20%"). Default "+0%"
 * @param pitch - Pitch adjustment (e.g., "+0Hz", "+50Hz"). Default "+0Hz"
 * @returns Buffer of webm/opus audio data
 */
export async function generateSpeech(
  text: string,
  voice: VoiceId = "aria",
  rate: string = "+0%",
  pitch: string = "+0Hz"
): Promise<Buffer> {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) {
    throw new Error("No speakable text after cleaning");
  }

  // Truncate very long texts to avoid timeouts (max ~2000 chars)
  const truncated = cleaned.length > 2000
    ? cleaned.slice(0, 2000) + "... content truncated for speech."
    : cleaned;

  const voiceName = VOICES[voice] || VOICES.aria;

  try {
    const tts = await ensureTTS(voiceName);
    const { audioStream } = tts.toStream(truncated, { rate, pitch });

    // Collect stream into buffer
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      audioStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (err: Error) => {
        // Reset instance on error so next call creates fresh connection
        ttsInstance = null;
        currentVoice = null;
        reject(err);
      });
      // Safety timeout — 15 seconds max
      setTimeout(() => {
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          ttsInstance = null;
          currentVoice = null;
          reject(new Error("TTS generation timed out"));
        }
      }, 15000);
    });
  } catch (err) {
    // Reset instance on any error
    ttsInstance = null;
    currentVoice = null;
    throw err;
  }
}

/**
 * Get list of available voices for the frontend.
 */
export function getAvailableVoices() {
  return Object.entries(VOICES).map(([id, name]) => ({
    id,
    name,
    gender: ["aria", "jenny", "sara", "emma", "sonia"].includes(id) ? "female" : "male",
    locale: name.includes("GB") ? "en-GB" : "en-US",
  }));
}
