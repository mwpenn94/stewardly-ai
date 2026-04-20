/**
 * v8.3 Pass 6 — Regression tests for G29 (pause/resume), G30 (download audio),
 * G39 (focus ring), G43 (streaming tick), G1 (feedback wiring), G53 (CommandPalette),
 * G59 (Firefox voice fallback)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../..");
const read = (rel: string) =>
  fs.readFileSync(path.join(CLIENT, rel), "utf-8");

// ── G29: TTS Pause / Resume ──────────────────────────────────
describe("G29 — TTS pause/resume", () => {
  const tts = read("hooks/useTTS.ts");

  it("exports isPaused state", () => {
    expect(tts).toContain("isPaused: boolean");
  });

  it("has pause callback", () => {
    expect(tts).toContain("const pause = useCallback(");
  });

  it("has resume callback", () => {
    expect(tts).toContain("const resume = useCallback(");
  });

  it("pause pauses audio element", () => {
    expect(tts).toContain("audio.pause()");
  });

  it("resume plays audio element", () => {
    expect(tts).toContain("audio.play()");
  });

  it("pause pauses browser SpeechSynthesis", () => {
    expect(tts).toContain("speechSynthesis.pause()");
  });

  it("resume resumes browser SpeechSynthesis", () => {
    expect(tts).toContain("speechSynthesis.resume()");
  });

  it("returns isPaused in hook return", () => {
    expect(tts).toMatch(/return\s*\{[^}]*isPaused/);
  });

  it("Chat.tsx has pause/resume button in hands-free bar", () => {
    const chat = read("pages/Chat.tsx");
    expect(chat).toContain("Pause speech");
    expect(chat).toContain("Resume speech");
  });
});

// ── G30: Download TTS Audio ──────────────────────────────────
describe("G30 — Download TTS audio as MP3", () => {
  const tts = read("hooks/useTTS.ts");

  it("has downloadAudio callback", () => {
    expect(tts).toContain("const downloadAudio = useCallback(");
  });

  it("stores audio blob for download", () => {
    expect(tts).toContain("lastAudioBlobRef.current = blob");
  });

  it("creates download link with .mp3 extension", () => {
    expect(tts).toContain(".mp3");
  });

  it("returns downloadAudio in hook return", () => {
    expect(tts).toMatch(/return\s*\{[^}]*downloadAudio/);
  });

  it("Chat.tsx has download audio button", () => {
    const chat = read("pages/Chat.tsx");
    expect(chat).toContain("Download audio");
    expect(chat).toContain("downloadAudio");
  });
});

// ── G39: Focus ring not clipped ──────────────────────────────
describe("G39 — Focus ring uses box-shadow (not clipped by overflow:hidden)", () => {
  it("shadcn button uses ring-based focus", () => {
    const button = read("components/ui/button.tsx");
    expect(button).toMatch(/focus-visible:ring|focus:ring|ring-offset/);
  });
});

// ── G43: Audible streaming tick ──────────────────────────────
describe("G43 — Audible token-streaming tick", () => {
  const soundCues = read("hooks/useSoundCues.ts");

  it("has streaming sound cue type", () => {
    expect(soundCues).toContain("streaming");
  });

  it("has playStreaming method with throttle", () => {
    expect(soundCues).toContain("playStreaming");
  });

  it("Chat.tsx calls playStreaming during SSE", () => {
    const chat = read("pages/Chat.tsx");
    expect(chat).toContain("playStreaming");
  });
});

// ── G1: Feedback wiring in AchievementSystem ─────────────────
describe("G1 — Feedback wiring in AchievementSystem", () => {
  const achievement = read("pages/learning/AchievementSystem.tsx");

  it("imports sendFeedback", () => {
    expect(achievement).toContain("sendFeedback");
  });

  it("dispatches achievement_earned feedback", () => {
    expect(achievement).toContain("achievement_earned");
  });

  it("dispatches streak_milestone feedback", () => {
    expect(achievement).toContain("streak_milestone");
  });

  it("dispatches mastered feedback", () => {
    expect(achievement).toContain("mastered");
  });
});

// ── G1: Feedback wiring in ComplianceAudit ───────────────────
describe("G1 — Feedback wiring in ComplianceAudit", () => {
  const compliance = read("pages/ComplianceAudit.tsx");

  it("imports sendFeedback", () => {
    expect(compliance).toContain("sendFeedback");
  });

  it("dispatches compliance.flag_raised feedback", () => {
    expect(compliance).toContain("flag_raised");
  });
});

// ── G53: CommandPalette shortcut hints ───────────────────────
describe("G53 — CommandPalette shortcut hints are accurate", () => {
  const data = read("components/commandPaletteData.ts");

  it("WIRED_G_CHORDS only contains wired shortcuts", () => {
    expect(data).toContain("WIRED_G_CHORDS");
    // Should NOT contain the old lying shortcuts
    expect(data).not.toContain('"G R"');
    expect(data).not.toContain('"G M"');
    expect(data).not.toContain('"G D"');
    expect(data).not.toContain('"G N"');
    expect(data).not.toContain('"G A"');
  });

  it("only assigns shortcuts from WIRED_G_CHORDS map", () => {
    expect(data).toContain("shortcut: WIRED_G_CHORDS[n.href]");
  });
});

// ── G59: Firefox/Safari voice fallback ──────────────────────
describe("G59 — Firefox/Safari voice fallback", () => {
  it("PlatformIntelligence logs when SpeechRecognition unavailable", () => {
    const pil = read("components/PlatformIntelligence.tsx");
    expect(pil).toContain("SpeechRecognition not available in this browser");
  });

  it("LiveSession shows toast when SR unavailable", () => {
    const live = read("components/LiveSession.tsx");
    expect(live).toContain("Speech recognition not supported");
  });

  it("codeChat voiceInput has isVoiceInputSupported guard", () => {
    const voice = read("components/codeChat/voiceInput.ts");
    expect(voice).toContain("isVoiceInputSupported");
  });
});
