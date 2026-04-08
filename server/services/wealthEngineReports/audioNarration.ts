/**
 * Wealth-engine audio narration — Phase 5B.
 *
 * Wraps the existing `edgeTTS.generateSpeech` function to produce
 * narrated MP3s for wealth-engine reports. Each narration is split
 * into chapter markers (one per ReportSection) so a downstream
 * audio player can support skip-to-section.
 *
 * The financial pronunciation rules from the v7 HTML calculators
 * (16+ rules: NLG, IUL, ESI, AUM, RMD, DI, LTC, etc.) are applied
 * via the spelling-substitution helper before the text reaches the
 * TTS engine. Edge TTS doesn't natively know "IUL" — without these
 * substitutions it would say "ee-yew-ell" instead of "I U L".
 */

import { generateSpeech } from "../../edgeTTS";

// ─── Pronunciation rules (16 from v7) ─────────────────────────────────────

const PRONUNCIATION_RULES: Array<[RegExp, string]> = [
  // Acronyms — spell out so Edge TTS pronounces each letter
  [/\bIUL\b/g, "I U L"],
  [/\bWL\b/g, "Whole Life"],
  [/\bDI\b/g, "Disability Insurance"],
  [/\bLTC\b/g, "long term care"],
  [/\bFIA\b/g, "F I A"],
  [/\bAUM\b/g, "A U M"],
  [/\bRMD\b/g, "R M D"],
  [/\bGDC\b/g, "G D C"],
  [/\bRVP\b/g, "R V P"],
  [/\bMD\b/g, "Managing Director"],
  [/\bROI\b/g, "R O I"],
  [/\bROTH\b/gi, "Roth"],
  [/\bIRMAA\b/g, "Erma"],
  // Carrier brands
  [/\bNLG\b/g, "N L G"],
  [/\bESI\b/g, "E S I"],
  [/\bSOFR\b/g, "Sofer"],
  // Currency abbreviations to natural language
  [/\$(\d+(?:\.\d+)?)M\b/g, "$$$1 million"],
  [/\$(\d+(?:\.\d+)?)K\b/g, "$$$1 thousand"],
  [/\$(\d+(?:\.\d+)?)B\b/g, "$$$1 billion"],
];

export function applyPronunciationRules(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PRONUNCIATION_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ─── Chapter narration types ──────────────────────────────────────────────

export interface NarrationChapter {
  /** Stable id for the audio player to seek to */
  id: string;
  /** Section title — shown as the chapter label */
  title: string;
  /** Source text (uncleaned, with acronyms) */
  raw: string;
  /** Pronunciation-cleaned text actually sent to TTS */
  cleaned: string;
}

export interface ChapterMarker {
  id: string;
  title: string;
  /** Cumulative byte offset where this chapter's audio starts */
  startByte: number;
  /** Length of the chapter audio in bytes */
  byteLength: number;
}

export interface NarrationResult {
  /** Concatenated MP3 audio for the whole narration */
  audio: Buffer;
  /** Chapter markers for skip-navigation */
  chapters: ChapterMarker[];
  /** Total approximate duration in seconds */
  estimatedSeconds: number;
}

// ─── Main: build a narration from a list of chapter texts ────────────────
// Concatenates per-chapter MP3 buffers. Audio players that respect raw
// MP3 frame boundaries handle this correctly (Edge TTS uses
// AUDIO_24KHZ_96KBITRATE_MONO_MP3, a constant-bitrate frame format).

export async function buildNarration(
  chapters: NarrationChapter[],
  voiceId = "aria",
): Promise<NarrationResult> {
  const buffers: Buffer[] = [];
  const markers: ChapterMarker[] = [];
  let cursor = 0;

  for (const ch of chapters) {
    const buf = await generateSpeech(ch.cleaned, voiceId);
    buffers.push(buf);
    markers.push({
      id: ch.id,
      title: ch.title,
      startByte: cursor,
      byteLength: buf.length,
    });
    cursor += buf.length;
  }

  const audio = Buffer.concat(buffers);
  // 96kbps mono → roughly 12 KB/s → divide bytes by 12000 for seconds
  const estimatedSeconds = audio.length / 12_000;

  return { audio, chapters: markers, estimatedSeconds };
}

// ─── Convenience: build narration from a list of plain section strings ───

export interface SectionNarrationInput {
  id: string;
  title: string;
  text: string;
}

export function chaptersFromSections(
  sections: SectionNarrationInput[],
): NarrationChapter[] {
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    raw: s.text,
    cleaned: applyPronunciationRules(s.text),
  }));
}

// ─── Pre-built narration: "Listen to your plan" ──────────────────────────
// Takes the same kind of input as the Executive Summary template and
// returns chapter texts ready for buildNarration().

export interface ListenToPlanInput {
  clientName: string;
  horizon: number;
  totalValue: number;
  liquidWealth: number;
  netValue: number;
  topStrategy: string;
}

export function buildListenToPlanScript(
  input: ListenToPlanInput,
): SectionNarrationInput[] {
  const fmt = (n: number) =>
    n >= 1e6
      ? `$${(n / 1e6).toFixed(1)} million`
      : n >= 1e3
        ? `$${(n / 1e3).toFixed(0)} thousand`
        : `$${n.toLocaleString()}`;

  return [
    {
      id: "intro",
      title: "Welcome",
      text: `Hello ${input.clientName}. This is your WealthBridge plan summary, narrated by your AI advisor.`,
    },
    {
      id: "headline",
      title: "Headline projection",
      text: `At year ${input.horizon}, your projected total value is ${fmt(input.totalValue)}. Your liquid wealth is ${fmt(input.liquidWealth)}, and your net value after costs is ${fmt(input.netValue)}.`,
    },
    {
      id: "strategy",
      title: "Recommended strategy",
      text: `The plan with the highest projected value at year ${input.horizon} is ${input.topStrategy}.`,
    },
    {
      id: "next-steps",
      title: "Next steps",
      text:
        "Next, review the year-by-year projection in your client portal. If anything looks off, your advisor can adjust the inputs and re-run the simulation in under a minute. Thank you for letting us walk you through your plan.",
    },
  ];
}
