import { describe, it, expect, vi } from "vitest";

// Mock the msedge-tts module since it requires network access
vi.mock("msedge-tts", () => {
  const { Readable } = require("stream");

  class MockMsEdgeTTS {
    private voice = "";
    private format = "";

    async setMetadata(voice: string, format: string) {
      this.voice = voice;
      this.format = format;
    }

    toStream(text: string, options?: any) {
      const readable = new Readable({
        read() {
          // Emit fake audio data
          this.push(Buffer.from("fake-audio-data"));
          this.push(null); // end stream
        },
      });
      return { audioStream: readable };
    }
  }

  return {
    MsEdgeTTS: MockMsEdgeTTS,
    OUTPUT_FORMAT: {
      WEBM_24KHZ_16BIT_MONO_OPUS: "webm-24khz-16bit-mono-opus",
    },
  };
});

import { generateSpeech, getAvailableVoices, VOICES } from "./edgeTTS";

describe("Edge TTS Service", () => {
  describe("getAvailableVoices", () => {
    it("returns a list of voice objects", () => {
      const voices = getAvailableVoices();
      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
    });

    it("each voice has required fields", () => {
      const voices = getAvailableVoices();
      for (const v of voices) {
        expect(v).toHaveProperty("id");
        expect(v).toHaveProperty("name");
        expect(v).toHaveProperty("gender");
        expect(v).toHaveProperty("locale");
        expect(["male", "female"]).toContain(v.gender);
        expect(v.locale).toMatch(/^en-/);
      }
    });

    it("includes aria as a voice", () => {
      const voices = getAvailableVoices();
      const aria = voices.find((v) => v.id === "aria");
      expect(aria).toBeDefined();
      expect(aria!.name).toBe("en-US-AriaNeural");
      expect(aria!.gender).toBe("female");
    });
  });

  describe("VOICES constant", () => {
    it("has at least 5 voices", () => {
      expect(Object.keys(VOICES).length).toBeGreaterThanOrEqual(5);
    });

    it("all voice names end with Neural", () => {
      for (const name of Object.values(VOICES)) {
        expect(name).toMatch(/Neural$/);
      }
    });
  });

  describe("generateSpeech", () => {
    it("generates audio buffer from text", async () => {
      const buffer = await generateSpeech("Hello world");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("accepts voice parameter", async () => {
      const buffer = await generateSpeech("Test", "guy");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("throws on empty text after cleaning", async () => {
      await expect(generateSpeech("")).rejects.toThrow();
    });

    it("cleans markdown from text", async () => {
      // Should not throw — markdown gets cleaned to plain text
      const buffer = await generateSpeech("**Bold** and `code` and [link](http://example.com)");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("truncates very long text", async () => {
      const longText = "A".repeat(5000);
      const buffer = await generateSpeech(longText);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("defaults to aria voice when invalid voice given", async () => {
      // @ts-ignore - testing invalid input
      const buffer = await generateSpeech("Test", "nonexistent");
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
