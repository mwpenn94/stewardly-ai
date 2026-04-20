/**
 * v8.2 Pass 1 — PIL Gap Closure Tests
 * G21: All specs have haptic field
 * G23: Key specs have earcon sound_effect
 * G24: GlobalVoiceFAB exists and renders
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const specsPath = path.resolve(__dirname, "../../lib/feedbackSpecs.ts");
const specsSrc = fs.readFileSync(specsPath, "utf-8");

const pilPath = path.resolve(__dirname, "../../components/PlatformIntelligence.tsx");
const pilSrc = fs.readFileSync(pilPath, "utf-8");

const fabPath = path.resolve(__dirname, "../../components/GlobalVoiceFAB.tsx");
const fabSrc = fs.readFileSync(fabPath, "utf-8");

describe("G21: Haptic coverage — all 38 specs have haptic field", () => {
  // Extract all spec keys
  const specKeys = [...specsSrc.matchAll(/"([a-z][a-z_.]+)":\s*\(/g)].map(m => m[1]);

  it("has at least 30 spec keys", () => {
    expect(specKeys.length).toBeGreaterThanOrEqual(30);
  });

  it("every spec block contains a haptic field", () => {
    // Split by spec key and check each block
    const blocks = specsSrc.split(/\n  "[a-z]/);
    // Skip the first block (before first spec)
    const specBlocks = blocks.slice(1);
    const missingHaptic = specBlocks.filter(b => !b.includes("haptic:"));
    expect(missingHaptic.length).toBe(0);
  });

  it("navigate.success has haptic: light", () => {
    expect(specsSrc).toContain('"navigate.success"');
    // Check the navigate.success block has haptic
    const navBlock = specsSrc.split('"navigate.success"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(navBlock).toContain('haptic: "light"');
  });

  it("voice.listening_started has haptic: medium", () => {
    const block = specsSrc.split('"voice.listening_started"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('haptic: "medium"');
  });

  it("handsfree.activated has haptic: medium", () => {
    const block = specsSrc.split('"handsfree.activated"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('haptic: "medium"');
  });
});

describe("G23: Earcon wiring — key events have sound_effect", () => {
  it("navigate.success uses sound_effect navigate", () => {
    const block = specsSrc.split('"navigate.success"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('soundId: "navigate"');
  });

  it("chat.streaming_end uses sound_effect receive", () => {
    const block = specsSrc.split('"chat.streaming_end"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('soundId: "receive"');
  });

  it("client.twin_updated uses sound_effect correct", () => {
    const block = specsSrc.split('"client.twin_updated"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('soundId: "correct"');
  });

  it("calculator.result uses sound_effect correct", () => {
    const block = specsSrc.split('"calculator.result"')[1]?.split(/\n  "[a-z]/)[0] || "";
    expect(block).toContain('soundId: "correct"');
  });

  it("SOUNDS map includes receive sound", () => {
    expect(pilSrc).toContain("receive: ()");
  });

  it("SOUNDS map has at least 9 entries", () => {
    const soundKeys = [...pilSrc.matchAll(/^\s+([a-z_]+): \(\)/gm)].map(m => m[1]);
    expect(soundKeys.length).toBeGreaterThanOrEqual(9);
  });
});

describe("G24: GlobalVoiceFAB — discoverable hands-free button", () => {
  it("GlobalVoiceFAB component file exists", () => {
    expect(fs.existsSync(fabPath)).toBe(true);
  });

  it("imports usePlatformIntelligence", () => {
    expect(fabSrc).toContain("usePlatformIntelligence");
  });

  it("has aria-label for accessibility", () => {
    expect(fabSrc).toContain("aria-label");
  });

  it("hides on /chat page", () => {
    expect(fabSrc).toContain('location.startsWith("/chat")');
  });

  it("shows Shift+V keyboard hint", () => {
    expect(fabSrc).toContain("⇧V");
  });

  it("is mounted in App.tsx", () => {
    const appPath = path.resolve(__dirname, "../../App.tsx");
    const appSrc = fs.readFileSync(appPath, "utf-8");
    expect(appSrc).toContain("GlobalVoiceFAB");
    expect(appSrc).toContain("<GlobalVoiceFAB />");
  });

  it("navigates to /chat when activating hands-free", () => {
    expect(fabSrc).toContain('navigate("/chat")');
  });
});
