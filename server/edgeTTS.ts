import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Edge TTS service — server-side text-to-speech using Microsoft Edge's
 * Read Aloud API. Returns audio as a Buffer in webm/opus format that
 * browsers can play natively via <audio> or AudioContext.
 *
 * No API key required. Free, high-quality neural voices.
 */

// ─── CURATED VOICE CATALOG ──────────────────────────────────────────
// Organized by region, gender, and style for the voice selector UI.
export const VOICE_CATALOG = [
  // ── US Female ──
  { id: "ava", shortName: "en-US-AvaNeural", label: "Ava", gender: "female" as const, locale: "en-US", description: "Warm, professional" },
  { id: "aria", shortName: "en-US-AriaNeural", label: "Aria", gender: "female" as const, locale: "en-US", description: "Clear, versatile" },
  { id: "emma", shortName: "en-US-EmmaNeural", label: "Emma", gender: "female" as const, locale: "en-US", description: "Friendly, conversational" },
  { id: "jenny", shortName: "en-US-JennyNeural", label: "Jenny", gender: "female" as const, locale: "en-US", description: "Bright, energetic" },
  { id: "michelle", shortName: "en-US-MichelleNeural", label: "Michelle", gender: "female" as const, locale: "en-US", description: "Calm, reassuring" },
  { id: "ana", shortName: "en-US-AnaNeural", label: "Ana", gender: "female" as const, locale: "en-US", description: "Young, approachable" },
  // ── US Male ──
  { id: "andrew", shortName: "en-US-AndrewNeural", label: "Andrew", gender: "male" as const, locale: "en-US", description: "Authoritative, polished" },
  { id: "brian", shortName: "en-US-BrianNeural", label: "Brian", gender: "male" as const, locale: "en-US", description: "Confident, modern" },
  { id: "christopher", shortName: "en-US-ChristopherNeural", label: "Christopher", gender: "male" as const, locale: "en-US", description: "Deep, trustworthy" },
  { id: "eric", shortName: "en-US-EricNeural", label: "Eric", gender: "male" as const, locale: "en-US", description: "Smooth, professional" },
  { id: "guy", shortName: "en-US-GuyNeural", label: "Guy", gender: "male" as const, locale: "en-US", description: "Warm, natural" },
  { id: "roger", shortName: "en-US-RogerNeural", label: "Roger", gender: "male" as const, locale: "en-US", description: "Mature, composed" },
  { id: "steffan", shortName: "en-US-SteffanNeural", label: "Steffan", gender: "male" as const, locale: "en-US", description: "Friendly, relaxed" },
  // ── UK Female ──
  { id: "libby", shortName: "en-GB-LibbyNeural", label: "Libby", gender: "female" as const, locale: "en-GB", description: "British, articulate" },
  { id: "maisie", shortName: "en-GB-MaisieNeural", label: "Maisie", gender: "female" as const, locale: "en-GB", description: "British, youthful" },
  { id: "sonia", shortName: "en-GB-SoniaNeural", label: "Sonia", gender: "female" as const, locale: "en-GB", description: "British, elegant" },
  // ── UK Male ──
  { id: "ryan", shortName: "en-GB-RyanNeural", label: "Ryan", gender: "male" as const, locale: "en-GB", description: "British, confident" },
  { id: "thomas", shortName: "en-GB-ThomasNeural", label: "Thomas", gender: "male" as const, locale: "en-GB", description: "British, warm" },
  // ── Australian ──
  { id: "natasha", shortName: "en-AU-NatashaNeural", label: "Natasha", gender: "female" as const, locale: "en-AU", description: "Australian, friendly" },
  { id: "william", shortName: "en-AU-WilliamNeural", label: "William", gender: "male" as const, locale: "en-AU", description: "Australian, easygoing" },
  // ── Irish ──
  { id: "emily-ie", shortName: "en-IE-EmilyNeural", label: "Emily", gender: "female" as const, locale: "en-IE", description: "Irish, gentle" },
  { id: "connor", shortName: "en-IE-ConnorNeural", label: "Connor", gender: "male" as const, locale: "en-IE", description: "Irish, personable" },
  // ── Indian ──
  { id: "neerja", shortName: "en-IN-NeerjaNeural", label: "Neerja", gender: "female" as const, locale: "en-IN", description: "Indian English, clear" },
  { id: "prabhat", shortName: "en-IN-PrabhatNeural", label: "Prabhat", gender: "male" as const, locale: "en-IN", description: "Indian English, steady" },
  // ── Canadian ──
  { id: "clara", shortName: "en-CA-ClaraNeural", label: "Clara", gender: "female" as const, locale: "en-CA", description: "Canadian, pleasant" },
  { id: "liam-ca", shortName: "en-CA-LiamNeural", label: "Liam", gender: "male" as const, locale: "en-CA", description: "Canadian, composed" },
] as const;

export type VoiceId = string;

// Quick lookup map
const VOICE_MAP = new Map<string, typeof VOICE_CATALOG[number]>(VOICE_CATALOG.map(v => [v.id, v]));

// ─── TTS INSTANCE MANAGEMENT ────────────────────────────────────────
// We create a fresh instance per request to avoid stale websocket issues
// that cause "network" errors on the recognition side.

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
 * Generate speech audio from text.
 *
 * @param text - The text to speak (markdown will be cleaned)
 * @param voiceId - Voice preset ID (default: "aria")
 * @param rate - Speech rate string (e.g., "+0%", "-10%", "+20%"). Default "+0%"
 * @param pitch - Pitch adjustment (e.g., "+0Hz", "+50Hz"). Default "+0Hz"
 * @returns Buffer of webm/opus audio data
 */
export async function generateSpeech(
  text: string,
  voiceId: string = "aria",
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

  const voice = VOICE_MAP.get(voiceId);
  const voiceName = voice?.shortName || "en-US-AriaNeural";

  // Create a fresh TTS instance per request to avoid stale websocket issues
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

  try {
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
        reject(err);
      });
      // Safety timeout — 15 seconds max
      setTimeout(() => {
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error("TTS generation timed out"));
        }
      }, 15000);
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Get the curated voice catalog for the frontend voice selector.
 */
export function getVoiceCatalog() {
  return VOICE_CATALOG.map(v => ({
    id: v.id,
    label: v.label,
    gender: v.gender,
    locale: v.locale,
    description: v.description,
  }));
}
