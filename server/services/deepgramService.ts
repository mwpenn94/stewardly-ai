/**
 * Deepgram Real-Time Transcription Service
 *
 * Provides real-time speech-to-text using Deepgram's API.
 * Used for meeting transcription, voice notes, and live captioning.
 */
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

const log = logger.child({ service: "deepgram" });

export interface DeepgramTranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  channels: number;
  duration: number;
  language?: string;
}

export interface DeepgramConfig {
  language?: string;
  model?: string;
  punctuate?: boolean;
  diarize?: boolean;
  smartFormat?: boolean;
  utterances?: boolean;
  keywords?: string[];
}

const DEFAULT_CONFIG: DeepgramConfig = {
  language: "en",
  model: "nova-2",
  punctuate: true,
  diarize: true,
  smartFormat: true,
  utterances: true,
};

/**
 * Transcribe a pre-recorded audio file via Deepgram REST API.
 * For real-time streaming, use the WebSocket endpoint.
 */
export async function transcribeWithDeepgram(
  audioUrl: string,
  config: DeepgramConfig = {},
): Promise<DeepgramTranscriptionResult | { error: string; code: string }> {
  if (!ENV.deepgramApiKey) {
    return { error: "Deepgram API key not configured", code: "NOT_CONFIGURED" };
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const params = new URLSearchParams();
  if (mergedConfig.language) params.set("language", mergedConfig.language);
  if (mergedConfig.model) params.set("model", mergedConfig.model);
  if (mergedConfig.punctuate) params.set("punctuate", "true");
  if (mergedConfig.diarize) params.set("diarize", "true");
  if (mergedConfig.smartFormat) params.set("smart_format", "true");
  if (mergedConfig.utterances) params.set("utterances", "true");
  if (mergedConfig.keywords?.length) params.set("keywords", mergedConfig.keywords.join(","));

  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${ENV.deepgramApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: audioUrl }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      log.error({ status: response.status, error: errorText }, "Deepgram API error");
      return {
        error: `Deepgram API error: ${response.status}`,
        code: "API_ERROR",
      };
    }

    const data = await response.json() as any;
    const channel = data.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      return { error: "No transcription result", code: "EMPTY_RESULT" };
    }

    return {
      transcript: alternative.transcript ?? "",
      confidence: alternative.confidence ?? 0,
      words: (alternative.words ?? []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
        speaker: w.speaker,
      })),
      channels: data.results?.channels?.length ?? 1,
      duration: data.metadata?.duration ?? 0,
      language: data.metadata?.language ?? mergedConfig.language,
    };
  } catch (err: any) {
    log.error({ error: err.message }, "Deepgram transcription failed");
    return { error: `Transcription failed: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Get a temporary Deepgram API key for client-side WebSocket streaming.
 * This creates a short-lived key that can be used in the browser.
 */
export async function getDeepgramStreamingToken(
  expiresInSeconds = 600,
): Promise<{ token: string } | { error: string; code: string }> {
  if (!ENV.deepgramApiKey) {
    return { error: "Deepgram API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/manage/keys", {
      method: "POST",
      headers: {
        Authorization: `Token ${ENV.deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: `WealthBridge streaming token`,
        scopes: ["usage:write"],
        time_to_live_in_seconds: expiresInSeconds,
      }),
    });

    if (!response.ok) {
      return { error: `Failed to create streaming token: ${response.status}`, code: "TOKEN_ERROR" };
    }

    const data = await response.json() as any;
    return { token: data.key ?? data.api_key ?? "" };
  } catch (err: any) {
    return { error: `Token creation failed: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Get the WebSocket URL for real-time streaming.
 */
export function getDeepgramWebSocketUrl(config: DeepgramConfig = {}): string {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const params = new URLSearchParams();
  if (mergedConfig.language) params.set("language", mergedConfig.language);
  if (mergedConfig.model) params.set("model", mergedConfig.model);
  if (mergedConfig.punctuate) params.set("punctuate", "true");
  if (mergedConfig.diarize) params.set("diarize", "true");
  if (mergedConfig.smartFormat) params.set("smart_format", "true");
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}
