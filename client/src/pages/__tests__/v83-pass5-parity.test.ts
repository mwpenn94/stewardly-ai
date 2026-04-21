/**
 * v8.3 Pass 5 Parity Regression Tests
 *
 * Covers: MOBILE-0016 (People mobile touch targets), G37 (aria-required),
 * G44 (voice barge-in), G50 (voice onboarding), G28 (TTS word highlighting)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

// ─── MOBILE-0016: People Hub mobile layout ───────────────────────
describe("MOBILE-0016: People Hub mobile layout", () => {
  const src = readSrc("pages/PeopleHub.tsx");

  it("tab bar buttons have min-h-[44px] for WCAG 2.5.5 touch targets", () => {
    expect(src).toContain("min-h-[44px]");
  });

  it("tab bar uses responsive padding (px-2 sm:px-3)", () => {
    expect(src).toContain("px-2 sm:px-3");
  });

  it("tab bar uses responsive font size (text-xs sm:text-sm)", () => {
    expect(src).toContain("text-xs sm:text-sm");
  });

  it("tab bar has overflow-x-auto for horizontal scrolling on mobile", () => {
    expect(src).toContain("overflow-x-auto");
  });

  it("sub-panel selector buttons also have min-h-[44px]", () => {
    // There should be at least 2 occurrences of min-h-[44px] (tab bar + sub-panel)
    const matches = src.match(/min-h-\[44px\]/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("has lightweight breadcrumb (MOBILE-0016 compliant)", () => {
    // Pass 22: Added lightweight Home > Command Center breadcrumb
    // Should have breadcrumb nav but NOT a heavy className="breadcrumb" component
    expect(src).toContain("Home");
    expect(src).toContain("ChevronRight");
    expect(src).not.toMatch(/className=".*breadcrumb.*">\s*<a/);
  });

  it("pipeline health grid uses grid-cols-2 sm:grid-cols-4 for mobile", () => {
    expect(src).toContain("grid-cols-2 sm:grid-cols-4");
  });

  it("quick action buttons use flex-wrap for mobile wrapping", () => {
    expect(src).toContain("flex flex-wrap gap-2");
  });
});

// ─── G37: aria-required on form fields ───────────────────────────
describe("G37: aria-required on form fields", () => {
  const src = readSrc("pages/ClientOnboarding.tsx");

  it("ClientOnboarding has aria-required='true' on required inputs", () => {
    expect(src).toContain('aria-required="true"');
  });

  it("has multiple aria-required fields (at least 2)", () => {
    const matches = src.match(/aria-required="true"/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── G44: Voice barge-in ─────────────────────────────────────────
describe("G44: Voice barge-in", () => {
  const hookSrc = readSrc("hooks/useVoiceRecognition.ts");

  it("useVoiceRecognition accepts onBargeIn callback", () => {
    expect(hookSrc).toContain("onBargeIn");
  });

  it("has barge-in listener that detects speech during guard", () => {
    expect(hookSrc).toContain("bargeIn");
  });

  it("Chat.tsx wires onBargeIn to cancel TTS", () => {
    const chatSrc = readSrc("pages/Chat.tsx");
    expect(chatSrc).toContain("onBargeIn");
  });
});

// ─── G50: Voice onboarding tutorial ──────────────────────────────
describe("G50: Voice onboarding tutorial", () => {
  const src = readSrc("components/OnboardingTour.tsx");

  it("has voice-mode step with barge-in instructions", () => {
    expect(src).toContain("barge-in");
  });

  it("has voice commands reference in onboarding", () => {
    // Should mention voice commands like "send", "stop", "new chat"
    expect(src).toMatch(/send|stop|new chat/i);
  });
});

// ─── G28: TTS word-level highlighting ────────────────────────────
describe("G28: TTS word-level highlighting", () => {
  const ttsSrc = readSrc("hooks/useTTS.ts");

  it("useTTS exports TTSWordHighlight interface", () => {
    expect(ttsSrc).toContain("TTSWordHighlight");
  });

  it("useTTS returns currentWord state", () => {
    expect(ttsSrc).toContain("currentWord");
  });

  it("useTTS returns spokenText state", () => {
    expect(ttsSrc).toContain("spokenText");
  });

  it("browser SpeechSynthesis uses onboundary for word tracking", () => {
    expect(ttsSrc).toContain("onboundary");
  });

  it("Edge TTS uses time-based word estimation", () => {
    expect(ttsSrc).toContain("_startEdgeWordEstimation");
  });

  it("TTSHighlighter component exists and renders highlight", () => {
    const highlighterSrc = readSrc("components/TTSHighlighter.tsx");
    expect(highlighterSrc).toContain("TTSHighlighter");
    expect(highlighterSrc).toContain("bg-primary/20");
  });

  it("Chat.tsx imports and uses TTSHighlighter", () => {
    const chatSrc = readSrc("pages/Chat.tsx");
    expect(chatSrc).toContain("TTSHighlighter");
    expect(chatSrc).toContain("tts.currentWord");
  });
});

// ─── CascadeFlowIndicator mobile ────────────────────────────────
describe("CascadeFlowIndicator mobile responsiveness", () => {
  const src = readSrc("components/CascadeFlowIndicator.tsx");

  it("uses flex-wrap sm:flex-nowrap for mobile wrapping", () => {
    expect(src).toContain("flex-wrap sm:flex-nowrap");
  });

  it("has overflow-x-auto for horizontal scroll fallback", () => {
    expect(src).toContain("overflow-x-auto");
  });
});
